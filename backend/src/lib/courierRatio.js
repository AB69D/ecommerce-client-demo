import { logger } from './logger.js';
import { getSettings } from './siteSettings.js';

// Fraud BD (fraudbd.com) — third-party aggregator of Bangladeshi courier
// delivery/return history by phone number. Chosen over scraping individual
// couriers' merchant-panel logins (Steadfast/Pathao/RedX have no official,
// key-authenticated "check this phone" endpoint — see the roadmap): this
// pushes that fragility onto Fraud BD's integration instead of ours, and only
// needs a scoped api_key rather than real courier account passwords.
const SANDBOX_BASE = 'https://fraudbd.com/api/sandbox';
const PRODUCTION_BASE = 'https://fraudbd.com/api';
const TIMEOUT_MS = 3000;

// Checkout must never hang or fail because a third party is slow/down, and
// the vendor's own rate limit (60 req/min) is easy to burn on retries of the
// same checkout — so cache each phone's result for a few minutes.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map();

function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(key);
        return undefined;
    }
    return hit.value;
}
function cacheSet(key, value) {
    cache.set(key, { at: Date.now(), value });
}

// Fraud BD expects the local "01XXXXXXXXX" form, not our internal
// normalized "880XXXXXXXXXX" identity (verified against the live sandbox —
// the E.164-without-plus form gets a 500 "error occurred" response). Convert
// at the network boundary only; everywhere else in this codebase keeps using
// the normalized form as the stable identity/cache key.
const toLocalBD = (phoneE164) => (phoneE164.startsWith('880') ? `0${phoneE164.slice(3)}` : phoneE164);

// Looks up a phone's aggregate cross-courier delivery history. Returns null
// when the feature isn't configured (no API key saved in site settings — see
// siteSettings.model.js `integrations.fraudbd`), the phone is empty, or the
// call fails for any reason (timeout, network error, vendor outage, bad
// response shape) — always fails open rather than blocking or slowing checkout.
export async function checkCourierRatio(phoneE164) {
    if (!phoneE164) return null;

    const settings = await getSettings();
    const config = settings?.integrations?.fraudbd;
    const apiKey = config?.apiKey;
    if (!apiKey) return null;

    const cached = cacheGet(phoneE164);
    if (cached !== undefined) return cached;

    const base = config.mode === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${base}/check-courier-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', api_key: apiKey },
            body: JSON.stringify({ phone_number: toLocalBD(phoneE164) }),
            signal: controller.signal,
        });
        if (!res.ok) {
            logger.warn({ status: res.status }, 'Fraud BD check-courier-info returned non-OK status');
            cacheSet(phoneE164, null);
            return null;
        }
        const json = await res.json();
        const summary = json?.data?.totalSummary;
        if (!json?.status || !summary) {
            cacheSet(phoneE164, null);
            return null;
        }

        const result = {
            provider: 'fraudbd',
            totalOrders: Number(summary.total) || 0,
            successCount: Number(summary.success) || 0,
            cancelCount: Number(summary.cancel) || 0,
            // Percent (0-100), not a 0-1 fraction — matches Fraud BD's own field.
            successRate: typeof summary.successRate === 'number' ? summary.successRate : null,
            checkedAt: new Date(),
        };
        cacheSet(phoneE164, result);
        return result;
    } catch (err) {
        logger.warn({ err: err?.message }, 'Fraud BD courier-ratio check failed; continuing without it');
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

// Turns a raw checkCourierRatio() result into a risk signal, or null when
// there isn't enough history to judge or the rate is above threshold. Kept
// separate from the fetch above so it's easy to unit-test / tune without
// touching the network call.
export function evaluateCourierRatio(result, rules = {}) {
    if (!result || result.successRate === null) return null;
    const minOrders = rules.courierMinOrdersForRatio ?? 3;
    const threshold = rules.courierSuccessRateThreshold ?? 60;

    // Too little cross-courier history to mean anything — a brand-new phone
    // isn't treated as risky by this signal (mirrors the in-house scorer).
    if (result.totalOrders < minOrders) return null;
    if (result.successRate >= threshold) return null;

    return {
        reason: `${result.successRate}% courier delivery success rate across ${result.totalOrders} past orders (below ${threshold}% threshold)`,
        source: 'auto-courier-ratio',
    };
}
