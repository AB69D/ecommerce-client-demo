import { Router } from 'express';
import {
    getPublicSettings,
    getAdminSettings,
    updateSettings,
    uploadSettingsImage,
    listDuplicates,
    resolveDuplicates,
} from '../controllers/siteSettings.controller.js';
import { validate } from '../utils/validate.js';
import { updateSiteSettingsSchema } from '../validations/siteSettings.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js';

const admin = Router();
admin.get('/', requirePermission('content:read'), getAdminSettings);
admin.put('/', requirePermission('content:write'), validate({ body: updateSiteSettingsSchema }), updateSettings);
admin.patch('/', requirePermission('content:write'), validate({ body: updateSiteSettingsSchema }), updateSettings);
admin.post(
    '/upload',
    requirePermission('content:write'),
    cloudinary_upload.single('image'),
    processAndUploadImages,
    uploadSettingsImage,
);
// TEMPORARY — remove after the duplicate 'global' docs are cleaned up.
admin.get('/_dedupe-check', requirePermission('content:read'), listDuplicates);
admin.post('/_dedupe-resolve', requirePermission('content:write'), resolveDuplicates);

const client = Router();
client.get('/', getPublicSettings);

export default { admin, client };
