import OrderModel from '../models/order.model.js';
import { normalizePhoneBD } from './blocklist.js';
import { getSettings, isFeatureEnabled } from './siteSettings.js';

// Orders that resolved "badly" — the customer didn't end up keeping the
// delivery. Anything still in flight (pending/confirmed/processing/shipped)
// is excluded from the return-rate calculation since it hasn't resolved yet.
const BAD_STATUSES = new Set(['cancelled', 'return_requested', 'returned']);

// In-house, no-external-dependency fake-order risk check. Looks at THIS
// store's own order history only (courier-wide delivery ratios are a later,
// external-API-backed phase). Returns null when the feature is off or
// nothing looked suspicious; otherwise a { reason, source } pair meant to be
// merged into req.riskFlag the same way a soft blocklist match is.
export async function scoreCheckoutRisk({ phone, ip }) {
    if (!(await isFeatureEnabled('fakeOrderDetection'))) return null;

    const settings = await getSettings();
    const rules = settings.fraudRules || {};
    const velocityWindowMinutes = rules.velocityWindowMinutes ?? 120;
    const velocityMaxOrders = rules.velocityMaxOrders ?? 3;
    const minHistoryForReturnRate = rules.minHistoryForReturnRate ?? 3;
    const returnRateThreshold = rules.returnRateThreshold ?? 0.5;

    const phoneNorm = normalizePhoneBD(phone);
    const since = new Date(Date.now() - velocityWindowMinutes * 60_000);
    const signals = [];

    const [priorOrdersByPhone, recentByIpCount] = await Promise.all([
        phoneNorm
            ? OrderModel.find({ customerPhoneE164: phoneNorm }).select('orderStatus createdAt').lean()
            : [],
        ip ? OrderModel.countDocuments({ ip, createdAt: { $gte: since } }) : 0,
    ]);

    // Velocity: this order would be the (count-in-window + 1)th from the same
    // phone/IP — catches a script or a repeat abuser regardless of whether
    // any of those past orders have resolved yet.
    const recentByPhoneCount = priorOrdersByPhone.filter((o) => o.createdAt >= since).length;
    if (recentByPhoneCount + 1 > velocityMaxOrders) {
        signals.push(`${recentByPhoneCount + 1} orders from this phone in the last ${velocityWindowMinutes} min`);
    }
    if (recentByIpCount + 1 > velocityMaxOrders) {
        signals.push(`${recentByIpCount + 1} orders from this IP in the last ${velocityWindowMinutes} min`);
    }

    // Return-rate: only judged once there's enough resolved history to mean
    // something — a brand-new phone isn't treated as risky by this signal
    // (it may still be caught by velocity above).
    const badCount = priorOrdersByPhone.filter((o) => BAD_STATUSES.has(o.orderStatus)).length;
    const deliveredCount = priorOrdersByPhone.filter((o) => o.orderStatus === 'delivered').length;
    const resolvedCount = badCount + deliveredCount;
    if (resolvedCount >= minHistoryForReturnRate) {
        const rate = badCount / resolvedCount;
        if (rate >= returnRateThreshold) {
            signals.push(`${Math.round(rate * 100)}% of this phone's past ${resolvedCount} resolved orders were cancelled/returned`);
        }
    }

    if (!signals.length) return null;
    return { reason: signals.join('; '), source: 'auto-fake-order' };
}
