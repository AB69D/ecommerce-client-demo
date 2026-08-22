import { Router } from 'express';
import { bookCourier, syncCourierStatus, steadfastWebhook } from '../controllers/courier.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// `admin` is mounted under requireAuth at /api/admin/courier; `webhook` is
// mounted PUBLIC (no requireAuth) at /api/courier/webhook — see server.js.
// Booking/syncing use the existing fulfillment:write permission (Sales &
// Operations group), not courier:manage — that one guards the separate
// credentials/settings screen only.
const admin = Router();

admin.post('/order/:id/book-courier', requirePermission('fulfillment:write'), bookCourier);
admin.post('/order/:id/sync-courier-status', requirePermission('fulfillment:write'), syncCourierStatus);

const webhook = Router();

// No requirePermission/requireAuth here — Steadfast calls this directly
// from their servers. Verification happens inside the handler itself
// (bearer token checked against integrations.steadfast.webhookToken).
webhook.post('/steadfast', steadfastWebhook);

export default { admin, webhook };
