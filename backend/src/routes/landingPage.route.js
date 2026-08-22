import { Router } from 'express';
import {
    listLandingPages,
    getLandingPage,
    createLandingPage,
    updateLandingPage,
    deleteLandingPage,
    getPublicLandingPage,
} from '../controllers/landingPage.controller.js';
import { validate } from '../utils/validate.js';
import {
    createLandingPageSchema,
    updateLandingPageSchema,
    listLandingPageQuerySchema,
} from '../validations/landingPage.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// Mounted under requireAuth at /api/admin/landing-page (see server.js).
const admin = Router();
admin.get('/', requirePermission('content:read'), validate({ query: listLandingPageQuerySchema }), listLandingPages);
admin.post('/', requirePermission('content:write'), validate({ body: createLandingPageSchema }), createLandingPage);
admin.get('/:id', requirePermission('content:read'), getLandingPage);
admin.put('/:id', requirePermission('content:write'), validate({ body: updateLandingPageSchema }), updateLandingPage);
admin.patch('/:id', requirePermission('content:write'), validate({ body: updateLandingPageSchema }), updateLandingPage);
admin.delete('/:id', requirePermission('content:write'), deleteLandingPage);

const client = Router();
client.get('/:slug', getPublicLandingPage);

export default { admin, client };
