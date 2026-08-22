import { Schema, model } from 'mongoose';

// Phone numbers blocked from checkout, keyed by a normalized E.164-without-plus
// form (see lib/blocklist.js normalizePhoneBD) so "01712345678", "+8801712345678",
// and "8801712345678" all resolve to the same entry.
const blockedPhoneSchema = new Schema(
    {
        phoneE164: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        reason: { type: String, default: '', trim: true, maxlength: 500 },

        // hard  -> reject the order outright at checkout
        // soft  -> let the order through, but flag it for manual review
        severity: { type: String, enum: ['hard', 'soft'], default: 'hard' },

        // Where this entry came from — lets an admin tell a manual decision
        // apart from something an automated fraud check flagged.
        source: {
            type: String,
            enum: ['manual', 'auto-fake-order', 'auto-courier-ratio'],
            default: 'manual',
        },

        createdBy: {
            id: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
            username: { type: String, default: '' },
        },

        // null = permanent block.
        expiresAt: { type: Date, default: null },

        hitCount: { type: Number, default: 0, min: 0 },
        lastHitAt: { type: Date, default: null },
    },
    { timestamps: true },
);

const BlockedPhoneModel = model('BlockedPhone', blockedPhoneSchema);

export default BlockedPhoneModel;
