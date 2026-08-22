import ipaddr from 'ipaddr.js';
import BlockedPhoneModel from '../models/blockedPhone.model.js';
import BlockedIpModel from '../models/blockedIp.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from './ApiError.js';
import { writeAudit } from './audit.js';

// Bangladeshi phone numbers show up in this codebase in at least four shapes
// ("01712345678", "+8801712345678", "8801712345678", "1712345678") — normalize
// all of them to the same digits-only, country-code-prefixed form so a
// blocklist entry actually matches regardless of which shape a customer types.
export function normalizePhoneBD(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2); // "00880..." intl dialing prefix
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('0')) return '880' + digits.slice(1);
    if (digits.length === 10) return '880' + digits; // bare local number, no leading 0
    return digits;
}

// Collapses an IPv4-mapped IPv6 address ("::ffff:1.2.3.4") to its IPv4 form
// before comparison, closing the bypass class where a blocked "1.2.3.4" would
// otherwise miss a client that shows up as "::ffff:1.2.3.4".
export function normalizeIp(raw) {
    if (!raw) return '';
    try {
        return ipaddr.process(String(raw).trim()).toNormalizedString();
    } catch {
        return String(raw).trim();
    }
}

// The CIDR list is expected to stay small (dozens of entries, not thousands),
// so a short-TTL in-memory cache is cheap and avoids a DB round trip on every
// checkout just to test range membership.
let cidrCache = { at: 0, entries: [] };
const CIDR_CACHE_MS = 30_000;

async function getCidrEntries() {
    const now = Date.now();
    if (now - cidrCache.at < CIDR_CACHE_MS) return cidrCache.entries;
    const entries = await BlockedIpModel.find({ type: 'cidr' }).lean();
    cidrCache = { at: now, entries };
    return entries;
}

// Call after any write to a CIDR-type BlockedIp entry so a newly-blocked (or
// just-removed) range takes effect immediately instead of waiting out the
// cache TTL. Cheap to over-call — worst case is one extra query.
export function invalidateCidrCache() {
    cidrCache = { at: 0, entries: [] };
}

function matchesCidr(ipNorm, entry) {
    try {
        const testAddr = ipaddr.process(ipNorm);
        const cidr = ipaddr.parseCIDR(entry.ip);
        if (testAddr.kind() !== cidr[0].kind()) return false;
        return testAddr.match(cidr);
    } catch {
        return false;
    }
}

const isActive = (entry) => !!entry && (!entry.expiresAt || new Date(entry.expiresAt) > new Date());

// Pure, side-effect-free lookup — mirrors the style of lib/coupon.js. Returns
// whether {ip, phone} hits an active blocklist entry, and the entries matched
// so the caller can decide hard-reject vs soft-flag and log/record the hit.
export async function checkBlocklist({ ip, phone } = {}) {
    const phoneNorm = normalizePhoneBD(phone);
    const ipNorm = normalizeIp(ip);

    const [phoneEntry, singleIpEntry, cidrEntries] = await Promise.all([
        phoneNorm ? BlockedPhoneModel.findOne({ phoneE164: phoneNorm }) : null,
        ipNorm ? BlockedIpModel.findOne({ type: 'single', ip: ipNorm }) : null,
        ipNorm ? getCidrEntries() : [],
    ]);

    const matchedCidr = ipNorm ? cidrEntries.find((e) => matchesCidr(ipNorm, e)) : null;

    const matches = [phoneEntry, singleIpEntry, matchedCidr].filter(isActive);

    if (!matches.length) {
        return { blocked: false, severity: null, matches: [] };
    }

    const severity = matches.some((m) => m.severity === 'hard') ? 'hard' : 'soft';
    return { blocked: true, severity, matches };
}

// Side effect, kept separate from the pure lookup above: bump hitCount/lastHitAt
// on whichever entries actually matched. Best-effort — a failure here should
// never be allowed to break the checkout request it's attached to.
export async function recordBlocklistHit(matches = []) {
    const now = new Date();
    await Promise.allSettled(
        matches.map((m) =>
            (m.type ? BlockedIpModel : BlockedPhoneModel).updateOne(
                { _id: m._id },
                { $inc: { hitCount: 1 }, $set: { lastHitAt: now } },
            ),
        ),
    );
}

// Checkout middleware. Mounted directly on POST /api/client/order/create,
// after required-field validation (phone must already be present) and before
// the idempotency-key lookup / stock decrement / order.save() — so a blocked
// attempt never touches inventory or creates a row.
//
// Hard match  -> reject the request outright (403), nothing is created.
// Soft match  -> let the request continue; req.riskFlag is set so the route
//                handler can persist it on the order for the admin review
//                queue instead of silently accepting it.
export const screenCheckout = asyncHandler(async (req, res, next) => {
    const phone = req.body?.customerPhone;
    const ip = req.ip;

    const { blocked, severity, matches } = await checkBlocklist({ ip, phone });
    if (!blocked) return next();

    // Best-effort — never let hit-tracking or audit logging block checkout.
    recordBlocklistHit(matches).catch(() => {});

    const reason = matches.map((m) => m.reason).filter(Boolean).join('; ') || 'blocklist match';
    const sources = matches.map((m) => (m.type ? `ip:${m.ip}` : `phone:${m.phoneE164}`)).join(', ');

    if (severity === 'hard') {
        writeAudit({
            actor: { username: 'system', role: 'system' },
            action: 'checkout.blocked',
            resource: 'Order',
            method: 'POST',
            path: '/api/client/order/create',
            statusCode: 403,
            ip: req.ip || '',
            userAgent: (req.headers['user-agent'] || '').slice(0, 300),
            message: `Checkout blocked (${sources})`,
            success: false,
            meta: { reason, matchedIds: matches.map((m) => String(m._id)) },
        }).catch(() => {});
        throw ApiError.forbidden('This order could not be placed. Please contact support.');
    }

    req.riskFlag = { flagged: true, reason, source: sources, flaggedAt: new Date() };
    next();
});
