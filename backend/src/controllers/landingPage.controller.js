// ---------------------------------------------------------------
// Landing page controller.
//
// Admin CRUD for campaign/ad landing pages (Phase 5) plus a public
// slug-lookup used by the storefront's /lp/<slug> route. See
// models/landingPage.model.js for why this is a separate system from Page.
// ---------------------------------------------------------------
import { LandingPage } from '../models/landingPage.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created, noContent } from '../lib/ApiResponse.js';

const paginate = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

// ---------------------------------------------------------------
// GET /api/admin/landing-page  (content:read)
// ---------------------------------------------------------------
export const listLandingPages = asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const query = {};
    if (req.query.search) {
        const rx = { $regex: req.query.search, $options: 'i' };
        query.$or = [{ title: rx }, { slug: rx }];
    }

    const [items, total] = await Promise.all([
        LandingPage.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        LandingPage.countDocuments(query),
    ]);

    return ok(res, { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

// ---------------------------------------------------------------
// GET /api/admin/landing-page/:id  (content:read)
// ---------------------------------------------------------------
export const getLandingPage = asyncHandler(async (req, res) => {
    const doc = await LandingPage.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Landing page not found');
    return ok(res, doc);
});

// ---------------------------------------------------------------
// POST /api/admin/landing-page  (content:write)
// ---------------------------------------------------------------
export const createLandingPage = asyncHandler(async (req, res) => {
    const { slug } = req.body;
    const exists = await LandingPage.findOne({ slug }).lean();
    if (exists) throw ApiError.conflict(`Slug "${slug}" is already in use`);

    const doc = await LandingPage.create({
        ...req.body,
        createdBy: { id: req.adminDoc?._id || null, username: req.adminDoc?.username || req.admin?.username || '' },
    });

    req.audit?.({
        action: 'landing_page.create',
        resource: 'LandingPage',
        resourceId: doc._id,
        message: `Created landing page "${doc.slug}"`,
        after: { slug: doc.slug, title: doc.title, isPublished: doc.isPublished },
    });
    return created(res, doc, 'Landing page created');
});

// ---------------------------------------------------------------
// PUT/PATCH /api/admin/landing-page/:id  (content:write)
// ---------------------------------------------------------------
export const updateLandingPage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await LandingPage.findById(id);
    if (!doc) throw ApiError.notFound('Landing page not found');

    if (req.body.slug && req.body.slug !== doc.slug) {
        const clash = await LandingPage.findOne({ slug: req.body.slug, _id: { $ne: id } }).lean();
        if (clash) throw ApiError.conflict(`Slug "${req.body.slug}" is already in use`);
    }

    Object.assign(doc, req.body);
    await doc.save();
    req.audit?.({
        action: 'landing_page.update',
        resource: 'LandingPage',
        resourceId: doc._id,
        message: `Updated landing page "${doc.slug}"`,
    });
    return ok(res, doc, 'Landing page updated');
});

// ---------------------------------------------------------------
// DELETE /api/admin/landing-page/:id  (content:write)
// ---------------------------------------------------------------
export const deleteLandingPage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await LandingPage.findByIdAndDelete(id);
    if (!doc) throw ApiError.notFound('Landing page not found');
    req.audit?.({
        action: 'landing_page.delete',
        resource: 'LandingPage',
        resourceId: id,
        message: `Deleted landing page "${doc.slug}"`,
    });
    return noContent(res);
});

// ---------------------------------------------------------------
// GET /api/client/landing-page/:slug
// Public. Only published pages are ever returned — an existing-but-
// unpublished slug 404s exactly like an unknown slug so drafts aren't
// leaked to the public.
// ---------------------------------------------------------------
export const getPublicLandingPage = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const doc = await LandingPage.findOne({ slug, isPublished: true });
    if (!doc) throw ApiError.notFound('Landing page not found');
    return ok(res, doc);
});
