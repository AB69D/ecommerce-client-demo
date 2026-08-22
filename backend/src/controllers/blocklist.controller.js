// ---------------------------------------------------------------
// Blocklist controller.
//
// Admin CRUD for the two blocklist collections (phone, IP) that
// lib/blocklist.js's checkBlocklist() reads at checkout. Kept as two small,
// separate resources rather than one polymorphic one — see the model files
// for why the shapes differ.
// ---------------------------------------------------------------
import BlockedPhoneModel from '../models/blockedPhone.model.js';
import BlockedIpModel from '../models/blockedIp.model.js';
import { normalizePhoneBD, normalizeIp, invalidateCidrCache } from '../lib/blocklist.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created, noContent } from '../lib/ApiResponse.js';

const paginate = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

// ---------------------------------------------------------------
// Phones — GET/POST /api/admin/blocklist/phones, DELETE /:id  (blocklist:read/write)
// ---------------------------------------------------------------
export const listBlockedPhones = asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const query = {};
    if (req.query.search) {
        query.phoneE164 = { $regex: normalizePhoneBD(req.query.search) || req.query.search, $options: 'i' };
    }

    const [items, total] = await Promise.all([
        BlockedPhoneModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BlockedPhoneModel.countDocuments(query),
    ]);

    return ok(res, { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const createBlockedPhone = asyncHandler(async (req, res) => {
    const phoneE164 = normalizePhoneBD(req.body.phone);
    if (!phoneE164) throw ApiError.badRequest('A valid phone number is required');

    const exists = await BlockedPhoneModel.findOne({ phoneE164 }).lean();
    if (exists) throw ApiError.conflict('This phone number is already blocked');

    const entry = await BlockedPhoneModel.create({
        phoneE164,
        reason: req.body.reason,
        severity: req.body.severity,
        expiresAt: req.body.expiresAt ?? null,
        source: 'manual',
        createdBy: { id: req.adminDoc?._id || null, username: req.adminDoc?.username || req.admin?.username || '' },
    });

    req.audit?.({
        action: 'blocklist.phone_add',
        resource: 'BlockedPhone',
        resourceId: entry._id,
        message: `Blocked phone ${entry.phoneE164}`,
        after: { phoneE164: entry.phoneE164, severity: entry.severity, reason: entry.reason },
    });
    return created(res, entry, 'Phone blocked');
});

export const deleteBlockedPhone = asyncHandler(async (req, res) => {
    const entry = await BlockedPhoneModel.findByIdAndDelete(req.params.id);
    if (!entry) throw ApiError.notFound('Blocklist entry not found');
    req.audit?.({
        action: 'blocklist.phone_remove',
        resource: 'BlockedPhone',
        resourceId: req.params.id,
        message: `Unblocked phone ${entry.phoneE164}`,
    });
    return noContent(res);
});

// ---------------------------------------------------------------
// IPs — GET/POST /api/admin/blocklist/ips, DELETE /:id  (blocklist:read/write)
// ---------------------------------------------------------------
export const listBlockedIps = asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const query = {};
    if (req.query.search) {
        query.ip = { $regex: req.query.search, $options: 'i' };
    }

    const [items, total] = await Promise.all([
        BlockedIpModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BlockedIpModel.countDocuments(query),
    ]);

    return ok(res, { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const createBlockedIp = asyncHandler(async (req, res) => {
    const type = req.body.type === 'cidr' ? 'cidr' : 'single';
    const ip = type === 'single' ? normalizeIp(req.body.ip) : req.body.ip.trim();
    if (!ip) throw ApiError.badRequest('A valid IP address (or CIDR range) is required');

    const exists = await BlockedIpModel.findOne({ type, ip }).lean();
    if (exists) throw ApiError.conflict('This IP is already blocked');

    const entry = await BlockedIpModel.create({
        type,
        ip,
        reason: req.body.reason,
        severity: req.body.severity,
        expiresAt: req.body.expiresAt ?? null,
        source: 'manual',
        createdBy: { id: req.adminDoc?._id || null, username: req.adminDoc?.username || req.admin?.username || '' },
    });

    if (entry.type === 'cidr') invalidateCidrCache();

    req.audit?.({
        action: 'blocklist.ip_add',
        resource: 'BlockedIp',
        resourceId: entry._id,
        message: `Blocked IP ${entry.ip}`,
        after: { ip: entry.ip, type: entry.type, severity: entry.severity, reason: entry.reason },
    });
    return created(res, entry, 'IP blocked');
});

export const deleteBlockedIp = asyncHandler(async (req, res) => {
    const entry = await BlockedIpModel.findByIdAndDelete(req.params.id);
    if (!entry) throw ApiError.notFound('Blocklist entry not found');
    if (entry.type === 'cidr') invalidateCidrCache();
    req.audit?.({
        action: 'blocklist.ip_remove',
        resource: 'BlockedIp',
        resourceId: req.params.id,
        message: `Unblocked IP ${entry.ip}`,
    });
    return noContent(res);
});
