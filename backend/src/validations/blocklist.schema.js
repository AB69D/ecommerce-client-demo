import { z } from 'zod';

// Date that accepts ISO strings / Date / null, mirroring coupon.schema.js.
const dateField = z.preprocess((v) => {
    if (v === undefined) return undefined;
    if (v === '' || v === null) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}, z.date().nullable().optional());

const severity = z.enum(['hard', 'soft']).optional().default('hard');
const reason = z.string().trim().max(500).optional().default('');

export const createBlockedPhoneSchema = z.object({
    phone: z.string().trim().min(6).max(20),
    reason,
    severity,
    expiresAt: dateField,
});

export const createBlockedIpSchema = z.object({
    type: z.enum(['single', 'cidr']).optional().default('single'),
    ip: z.string().trim().min(3).max(64),
    reason,
    severity: z.enum(['hard', 'soft']).optional().default('soft'),
    expiresAt: dateField,
});

export const listBlocklistQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
});
