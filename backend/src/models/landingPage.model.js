import mongoose from 'mongoose';

// Campaign/ad landing pages (Phase 5 of the fraud/fulfillment roadmap) — a
// SEPARATE system from the Page model above. Page is deliberately locked to a
// fixed registry of ~7 known routes (about/privacy-policy/...) with a single
// raw-HTML body; landing pages need the opposite on both counts: admins
// create arbitrary new slugs on demand for ad campaigns, and need per-block
// editability (reorder a testimonial, swap a hero image) that an HTML blob
// can't give cheaply. See the roadmap notes for the full reasoning.
//
// `blocks` is a typed array rather than raw HTML — each block's `data` is
// validated by a Zod discriminated union (validations/landingPage.schema.js)
// keyed on `type`, so there's no injection surface the way dangerouslySetInnerHTML
// would have. The rendering side (frontend block registry) does the same
// type -> component lookup. Adding a new block type is additive: new type
// string + new data shape, nothing existing has to change.
const blockSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['hero', 'productHighlight', 'orderForm', 'testimonials', 'countdown', 'faq', 'trustBadges', 'stickyOrderBar', 'whatsappCta'],
        },
        // Shape depends on `type` — see validations/landingPage.schema.js for
        // the per-type Zod schema both the admin save endpoint and (informally)
        // the renderer agree on.
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { _id: true },
);

const landingPageSchema = new mongoose.Schema(
    {
        // Admin-chosen, becomes the public URL: /lp/<slug>. Arbitrary (unlike
        // Page's fixed registry) — validated as URL-safe at the API layer.
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },

        // Internal-only name shown in the admin list — never rendered publicly.
        title: { type: String, required: true, trim: true },

        blocks: { type: [blockSchema], default: [] },

        // Unpublished pages 404 on the public route regardless of slug.
        isPublished: { type: Boolean, default: false, index: true },

        seoTitle: { type: String, default: '', trim: true },
        seoDescription: { type: String, default: '', trim: true },
        ogImage: { type: String, default: '' },

        createdBy: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
            username: { type: String, default: '' },
        },
    },
    { timestamps: true },
);

export const LandingPage = mongoose.model('LandingPage', landingPageSchema);
