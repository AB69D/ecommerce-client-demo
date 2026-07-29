import express from 'express';
import { submitContactMessage, getAllContactMessages, deleteContactMessage } from '../controllers/contactMessage.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// Public: anyone can submit the contact form, no auth.
const client = express.Router();
client.post('/submit', submitContactMessage);

// Admin-only: listing and deleting customer submissions. Mounted under
// requireAuth in server.js; requirePermission narrows it further to staff
// who actually have content access.
const admin = express.Router();
admin.get('/messages', requirePermission('content:read'), getAllContactMessages);
admin.delete('/delete/:id', requirePermission('content:write'), deleteContactMessage);

export default { admin, client };
