// ---------------------------------------------------------------
// Courier controller (Phase 4).
//
// Admin actions to book a Steadfast consignment for an order and to
// re-sync its delivery status, plus the public webhook Steadfast calls
// with status updates. See lib/couriers/steadfast.js for the vendor
// integration itself and the roadmap notes on why booking/sync throw
// instead of failing open (unlike the background lib/courierRatio.js check).
// ---------------------------------------------------------------
import OrderModel from '../models/order.model.js';
import { createConsignment, getStatus } from '../lib/couriers/steadfast.js';
import { getSettings } from '../lib/siteSettings.js';
import { writeAudit } from '../lib/audit.js';
import { logger } from '../lib/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok } from '../lib/ApiResponse.js';

// ---------------------------------------------------------------
// POST /api/admin/order/:id/book-courier  (fulfillment:write)
// ---------------------------------------------------------------
export const bookCourier = asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    if (order.courier?.consignmentId) {
        throw ApiError.conflict('This order has already been booked with a courier.');
    }

    let booked;
    try {
        booked = await createConsignment(order);
    } catch (err) {
        throw new ApiError(502, err.message);
    }

    order.courier = {
        provider: 'steadfast',
        consignmentId: booked.consignmentId,
        trackingCode: booked.trackingCode,
        status: booked.status,
        bookedAt: new Date(),
        lastSyncedAt: new Date(),
    };
    await order.save();

    req.audit?.({
        action: 'order.courier_booked',
        resource: 'Order',
        resourceId: order._id,
        message: `Booked courier for order ${order.orderId} (consignment ${booked.consignmentId})`,
    });

    return ok(res, order, 'Courier booked');
});

// ---------------------------------------------------------------
// POST /api/admin/order/:id/sync-courier-status  (fulfillment:write)
// ---------------------------------------------------------------
export const syncCourierStatus = asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    if (!order.courier?.consignmentId) {
        throw ApiError.badRequest('This order has not been booked with a courier yet.');
    }

    let result;
    try {
        result = await getStatus(order.courier.consignmentId);
    } catch (err) {
        throw new ApiError(502, err.message);
    }

    order.courier.status = result.status;
    order.courier.lastSyncedAt = new Date();
    await order.save();

    req.audit?.({
        action: 'order.courier_status_synced',
        resource: 'Order',
        resourceId: order._id,
        message: `Synced courier status for order ${order.orderId}: ${result.status}`,
    });

    return ok(res, order, 'Courier status synced');
});

// ---------------------------------------------------------------
// POST /api/courier/webhook/steadfast  (PUBLIC — no requireAuth)
//
// Steadfast calls this directly from their servers with status updates, so
// there's no admin session to authenticate. Instead we verify the bearer
// token against the webhookToken the admin configured in Settings > Courier
// (and pasted into Steadfast's own dashboard). Always respond 200 once the
// token checks out — even if no matching order is found — because webhook
// senders retry aggressively on non-2xx and a missing-order case is not
// something retrying will fix.
// ---------------------------------------------------------------
export const steadfastWebhook = asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const webhookToken = settings?.integrations?.steadfast?.webhookToken;

    const authHeader = req.headers['authorization'] || '';
    const [scheme, token] = authHeader.split(' ');
    const presented = scheme === 'Bearer' ? token : '';

    if (!webhookToken || !presented || presented !== webhookToken) {
        return res.status(401).json({ success: false, message: 'Invalid webhook token' });
    }

    const { consignment_id, invoice, status, cod_amount } = req.body || {};

    let order = null;
    if (consignment_id !== undefined && consignment_id !== null) {
        order = await OrderModel.findOne({ 'courier.consignmentId': String(consignment_id) });
    }
    if (!order && invoice) {
        order = await OrderModel.findOne({ orderId: invoice });
    }

    if (order) {
        order.courier = order.courier || {};
        order.courier.status = status || order.courier.status;
        order.courier.lastSyncedAt = new Date();
        await order.save();
    } else {
        logger.warn({ consignment_id, invoice }, 'Steadfast webhook: no matching order found');
    }

    // No req.audit on this unauthenticated route — write directly.
    // Fire-and-forget: writeAudit never throws, and this must not block the
    // response Steadfast is waiting on.
    writeAudit({
        actor: { username: 'steadfast-webhook', role: 'system' },
        action: 'order.courier_webhook',
        resource: 'Order',
        resourceId: order ? String(order._id) : '',
        method: 'POST',
        path: '/api/courier/webhook/steadfast',
        statusCode: 200,
        message: order
            ? `Steadfast webhook: order ${order.orderId} -> ${status}`
            : `Steadfast webhook: no matching order for consignment ${consignment_id} / invoice ${invoice}`,
        success: true,
        meta: { consignment_id, invoice, status, cod_amount },
    });

    return res.status(200).json({ success: true });
});
