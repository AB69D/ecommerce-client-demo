import { Router } from 'express';
import {
    listBlockedPhones,
    createBlockedPhone,
    deleteBlockedPhone,
    listBlockedIps,
    createBlockedIp,
    deleteBlockedIp,
} from '../controllers/blocklist.controller.js';
import { validate } from '../utils/validate.js';
import {
    createBlockedPhoneSchema,
    createBlockedIpSchema,
    listBlocklistQuerySchema,
} from '../validations/blocklist.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// Mounted under requireAuth at /api/admin/blocklist (see server.js).
const admin = Router();

admin.get('/phones', requirePermission('blocklist:read'), validate({ query: listBlocklistQuerySchema }), listBlockedPhones);
admin.post('/phones', requirePermission('blocklist:write'), validate({ body: createBlockedPhoneSchema }), createBlockedPhone);
admin.delete('/phones/:id', requirePermission('blocklist:write'), deleteBlockedPhone);

admin.get('/ips', requirePermission('blocklist:read'), validate({ query: listBlocklistQuerySchema }), listBlockedIps);
admin.post('/ips', requirePermission('blocklist:write'), validate({ body: createBlockedIpSchema }), createBlockedIp);
admin.delete('/ips/:id', requirePermission('blocklist:write'), deleteBlockedIp);

export default { admin };
