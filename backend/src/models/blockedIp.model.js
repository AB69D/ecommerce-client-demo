import { Schema, model } from 'mongoose';

// IP addresses/ranges blocked from checkout. Kept as a separate collection
// from BlockedPhone (see backend/docs or the roadmap) since IP entries need a
// different shape (single address vs CIDR range) and a different matching
// strategy (exact index lookup vs in-memory CIDR scan — see lib/blocklist.js).
const blockedIpSchema = new Schema(
    {
        type: { type: String, enum: ['single', 'cidr'], default: 'single' },
        // "103.10.20.5" for type:single, "103.10.20.0/24" for type:cidr.
        // Normalized (see lib/blocklist.js normalizeIp) before saving/matching
        // so IPv4-mapped-IPv6 forms can't slip past a blocked plain IPv4 entry.
        ip: { type: String, required: true, trim: true, index: true },

        reason: { type: String, default: '', trim: true, maxlength: 500 },
        severity: { type: String, enum: ['hard', 'soft'], default: 'soft' },
        source: {
            type: String,
            enum: ['manual', 'auto-fake-order', 'auto-courier-ratio'],
            default: 'manual',
        },

        createdBy: {
            id: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
            username: { type: String, default: '' },
        },

        expiresAt: { type: Date, default: null },

        hitCount: { type: Number, default: 0, min: 0 },
        lastHitAt: { type: Date, default: null },
    },
    { timestamps: true },
);

const BlockedIpModel = model('BlockedIp', blockedIpSchema);

export default BlockedIpModel;
