import { getSettings } from '../siteSettings.js';

// Steadfast Courier (portal.steadfast.com.bd) — the first of several planned
// courier integrations (Phase 4 of the fraud/fulfillment roadmap). Unlike
// Fraud BD (lib/courierRatio.js), Steadfast has no documented sandbox, so
// this can only be smoke-tested for its config-missing / error paths until
// real merchant credentials are entered in Settings > Courier.
//
// Booking/syncing is a deliberate admin action (not a background checkout
// signal), so — unlike checkCourierRatio()'s fail-open/return-null
// behaviour — both functions here THROW on any failure. The admin needs to
// see *why* a booking or sync failed, not have it silently no-op.
const BASE_URL = 'https://portal.steadfast.com.bd/api/v1';
const TIMEOUT_MS = 8000;

const getCredentials = async () => {
    const settings = await getSettings();
    const config = settings?.integrations?.steadfast;
    if (!config?.apiKey || !config?.secretKey) {
        throw new Error('Steadfast is not configured — add an API key and secret key in Settings > Courier.');
    }
    return config;
};

const authHeaders = (config) => ({
    'Content-Type': 'application/json',
    'Api-Key': config.apiKey,
    'Secret-Key': config.secretKey,
});

// Pulls a human-readable error message out of whatever shape Steadfast
// returned (a top-level `message`, or a field-keyed `errors` object), so the
// admin sees something actionable instead of a bare status code.
const extractErrorMessage = (json) => {
    if (!json) return '';
    if (typeof json.message === 'string' && json.message) return json.message;
    if (json.errors && typeof json.errors === 'object') {
        const first = Object.values(json.errors).flat().find(Boolean);
        if (first) return String(first);
    }
    return '';
};

async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

// Books a consignment for the given order. Throws on any failure (missing
// config, network/timeout error, non-2xx response, or an unexpected
// response shape). On success returns the fields we persist on
// order.courier.
export async function createConsignment(order) {
    const config = await getCredentials();

    let res;
    try {
        res = await fetchWithTimeout(`${BASE_URL}/create_order`, {
            method: 'POST',
            headers: authHeaders(config),
            body: JSON.stringify({
                invoice: order.orderId,
                recipient_name: order.customerName,
                recipient_phone: order.customerPhone,
                recipient_address: order.shippingAddress,
                cod_amount: order.paymentMethod === 'cash_on_delivery' ? order.totalAmount : 0,
            }),
        });
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error('Steadfast did not respond in time. Please try again.');
        }
        throw new Error(`Could not reach Steadfast: ${err?.message || 'network error'}`);
    }

    let json;
    try {
        json = await res.json();
    } catch {
        json = null;
    }

    if (!res.ok) {
        throw new Error(extractErrorMessage(json) || `Steadfast booking failed (HTTP ${res.status})`);
    }

    const consignment = json?.consignment;
    if (!consignment?.consignment_id) {
        throw new Error(extractErrorMessage(json) || 'Steadfast returned an unexpected response while booking.');
    }

    return {
        consignmentId: String(consignment.consignment_id),
        trackingCode: consignment.tracking_code || '',
        status: consignment.status || '',
    };
}

// Looks up the current delivery status for a previously booked consignment.
// Throws on any failure — see the module note above for why.
export async function getStatus(consignmentId) {
    const config = await getCredentials();

    let res;
    try {
        res = await fetchWithTimeout(`${BASE_URL}/status_by_cid/${consignmentId}`, {
            method: 'GET',
            headers: authHeaders(config),
        });
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error('Steadfast did not respond in time. Please try again.');
        }
        throw new Error(`Could not reach Steadfast: ${err?.message || 'network error'}`);
    }

    let json;
    try {
        json = await res.json();
    } catch {
        json = null;
    }

    if (!res.ok) {
        throw new Error(extractErrorMessage(json) || `Steadfast status lookup failed (HTTP ${res.status})`);
    }

    if (!json || typeof json.delivery_status !== 'string') {
        throw new Error(extractErrorMessage(json) || 'Steadfast returned an unexpected response while checking status.');
    }

    return { status: json.delivery_status };
}
