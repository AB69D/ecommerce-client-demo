"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiTarget, FiSearch } from "react-icons/fi";
import { listLandingPages, createLandingPage, deleteLandingPage } from "@/services/landingPages";
import { useAdminAuth } from "@/context/AdminAuthContext";

// Mirrors the slug rule enforced server-side (validations/landingPage.schema.js):
// lowercase letters/numbers, single hyphens, no leading/trailing/duplicate hyphens.
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugify = (s) =>
    (s || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const BLANK_NEW = { title: "", slug: "", slugTouched: false };

export default function LandingPagesListPage() {
    const router = useRouter();
    const { can } = useAdminAuth();
    const canWrite = can("content:write");
    const canRead = can("content:read");

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [message, setMessage] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);

    const [newModal, setNewModal] = useState({ show: false, ...BLANK_NEW });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const limit = 20;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listLandingPages({ page, limit, search });
            if (res?.success) {
                setItems(res.data?.items || []);
                setTotalPages(res.data?.totalPages || 1);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    // Reset to page 1 whenever the search term changes.
    useEffect(() => { setPage(1); }, [search]);

    const flash = (m) => { setMessage(m); setTimeout(() => setMessage(""), 2500); };

    const openNew = () => { setCreateError(""); setNewModal({ show: true, ...BLANK_NEW }); };
    const closeNew = () => setNewModal({ show: false, ...BLANK_NEW });

    const setNewTitle = (v) =>
        setNewModal((m) => ({ ...m, title: v, slug: m.slugTouched ? m.slug : slugify(v) }));
    const setNewSlug = (v) => setNewModal((m) => ({ ...m, slug: v, slugTouched: true }));

    const submitNew = async () => {
        setCreateError("");
        const title = newModal.title.trim();
        const slug = newModal.slug.trim().toLowerCase();
        if (!title) { setCreateError("Enter a page title."); return; }
        if (!SLUG_RE.test(slug)) {
            setCreateError("Slug must be lowercase letters, numbers and single hyphens only (e.g. summer-deal).");
            return;
        }
        setCreating(true);
        try {
            const res = await createLandingPage({ title, slug, blocks: [], isPublished: false });
            if (res?.success) {
                closeNew();
                router.push(`/admin/landing-pages/${res.data._id}/edit`);
            } else {
                setCreateError(res?.message || "Could not create landing page.");
            }
        } catch {
            setCreateError("Could not create landing page.");
        } finally {
            setCreating(false);
        }
    };

    const doDelete = async (item) => {
        try {
            const res = await deleteLandingPage(item._id);
            if (res?.success) { flash("Landing page deleted"); load(); }
        } catch {
            /* ignore */
        } finally {
            setConfirmDelete(null);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiTarget className="text-indigo-600" /> Landing Pages
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Single-product ad-campaign pages built from blocks.</p>
                </div>
                {canWrite && (
                    <button onClick={openNew} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2">
                        <FiPlus className="w-4 h-4" /> New landing page
                    </button>
                )}
            </div>

            {message && <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{message}</div>}

            <div className="relative mb-4 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title or slug…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {loading ? (
                <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : !canRead ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <p className="text-sm text-gray-400">You don&apos;t have permission to view landing pages.</p>
                </div>
            ) : items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiTarget className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No landing pages yet. Create your first campaign page.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-gray-100">
                                    <th className="py-2.5 px-3 font-medium">Title</th>
                                    <th className="py-2.5 px-3 font-medium">Slug</th>
                                    <th className="py-2.5 px-3 font-medium">Published</th>
                                    <th className="py-2.5 px-3 font-medium">Blocks</th>
                                    <th className="py-2.5 px-3 font-medium">Updated</th>
                                    <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                                        <td className="py-2.5 px-3">
                                            <span className="font-medium text-gray-800">{item.title}</span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <Link
                                                href={`/lp/${item.slug}`}
                                                target="_blank"
                                                className="font-mono text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 px-2 py-1 rounded"
                                            >
                                                /lp/{item.slug}
                                            </Link>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                                {item.isPublished ? "Published" : "Draft"}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-600">{item.blocks?.length || 0}</td>
                                        <td className="py-2.5 px-3 text-gray-500 text-xs">
                                            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {canWrite && (
                                                    <button
                                                        onClick={() => router.push(`/admin/landing-pages/${item._id}/edit`)}
                                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button
                                                        onClick={() => setConfirmDelete(item)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* New landing page modal — just title + slug; block editing happens on the builder page. */}
            {newModal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeNew} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800">New landing page</h3>
                            <button onClick={closeNew} className="p-1.5 text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {createError && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{createError}</div>}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                                <input
                                    autoFocus
                                    value={newModal.title}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Summer Sale — Wireless Earbuds"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400 shrink-0">/lp/</span>
                                    <input
                                        value={newModal.slug}
                                        onChange={(e) => setNewSlug(e.target.value)}
                                        placeholder="summer-sale-earbuds"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">Lowercase letters, numbers and hyphens only. You can change this later.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex gap-2">
                            <button onClick={closeNew} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={submitNew} disabled={creating} className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                {creating ? "Creating…" : "Create & edit blocks"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Delete landing page?</h3>
                        <p className="text-sm text-gray-500 mb-6">Delete <strong>{confirmDelete.title}</strong> (<span className="font-mono">/lp/{confirmDelete.slug}</span>)? This cannot be undone.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={() => doDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
