import { z } from 'zod';

// URL-safe, hyphen-separated slug — becomes the public URL /lp/<slug>.
// Lowercased/trimmed so "Summer-Deal" and " summer-deal " collide as the
// same slug rather than creating two documents.
const slug = z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only');

// Block envelope only — `data`'s internal shape is intentionally unvalidated
// (Mixed in the model) so the admin block editor and public renderer can
// iterate on exact field names per block type without a backend round-trip.
// See models/landingPage.model.js for the reasoning.
export const blockSchema = z.object({
    type: z.enum([
        'hero',
        'productHighlight',
        'orderForm',
        'testimonials',
        'countdown',
        'faq',
        'trustBadges',
        'stickyOrderBar',
        'whatsappCta',
    ]),
    data: z.record(z.any()),
});

export const createLandingPageSchema = z.object({
    slug,
    title: z.string().min(1).max(200),
    blocks: z.array(blockSchema).optional().default([]),
    isPublished: z.boolean().optional().default(false),
    seoTitle: z.string().max(200).optional(),
    seoDescription: z.string().max(300).optional(),
    ogImage: z.string().url().or(z.literal('')).optional(),
});

// Partial for updates — every field optional. `slug` stays editable (an
// admin may rename a campaign page); the controller re-checks uniqueness
// when it changes.
export const updateLandingPageSchema = z.object({
    slug: slug.optional(),
    title: z.string().min(1).max(200).optional(),
    blocks: z.array(blockSchema).optional(),
    isPublished: z.boolean().optional(),
    seoTitle: z.string().max(200).optional(),
    seoDescription: z.string().max(300).optional(),
    ogImage: z.string().url().or(z.literal('')).optional(),
});

export const listLandingPageQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().max(80).optional(),
});
