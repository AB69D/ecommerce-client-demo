"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    FiPlus, FiTrash2, FiX, FiArrowUp, FiArrowDown, FiSave, FiExternalLink,
    FiCheck, FiAlertCircle, FiChevronDown, FiChevronUp, FiSearch, FiArrowLeft,
} from "react-icons/fi";
import { getLandingPage, updateLandingPage } from "@/services/landingPages";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import ImageUpload from "@/components/admin/ImageUpload";
import { revalidateTags } from "@/lib/revalidate";

// Mirrors the slug rule enforced server-side (validations/landingPage.schema.js).
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugify = (s) =>
    (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Client-only key for React lists / reordering — never sent to the server.
// Existing blocks key off their Mongo subdocument _id; new ones get a random one.
const genKey = () => `k_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

// The 9 block types this builder supports, with human labels and sensible
// empty defaults for each `data` shape (see the block-data contract this
// admin panel shares with the public /lp/<slug> renderer).
const BLOCK_TYPES = [
    { type: "hero", label: "Hero / Banner" },
    { type: "productHighlight", label: "Product Highlight" },
    { type: "orderForm", label: "Order Form", single: true },
    { type: "testimonials", label: "Testimonials" },
    { type: "countdown", label: "Countdown Timer" },
    { type: "faq", label: "FAQ" },
    { type: "trustBadges", label: "Trust Badges" },
    { type: "stickyOrderBar", label: "Sticky Order Bar" },
    { type: "whatsappCta", label: "WhatsApp CTA" },
];
const BLOCK_LABELS = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label]));

const defaultBlockData = (type) => {
    switch (type) {
        case "hero":
            return { headline: "", subheadline: "", imageUrl: "", ctaLabel: "Order Now", ctaTarget: "order-form" };
        case "productHighlight":
            return { title: "", imageUrl: "", description: "", price: "", comparePrice: "", badge: "" };
        case "orderForm":
            return { heading: "Place Your Order", productId: "", productName: "", price: "", weightIndex: 0, deliveryAreas: [] };
        case "testimonials":
            return { heading: "What Our Customers Say", items: [] };
        case "countdown":
            return { heading: "Offer Ends In", endsAt: "" };
        case "faq":
            return { heading: "Frequently Asked Questions", items: [] };
        case "trustBadges":
            return { items: [] };
        case "stickyOrderBar":
            return { label: "Order Now", ctaTarget: "order-form" };
        case "whatsappCta":
            return { message: "" };
        default:
            return {};
    }
};

// ---------------------------------------------------------------------
// Generic repeatable-rows sub-editor (testimonials.items, faq.items,
// trustBadges.items, orderForm.deliveryAreas). No drag-and-drop, just
// add/remove-row buttons — matches this panel's other repeatable-array
// editors (see footer columns in admin/settings/page.jsx).
// ---------------------------------------------------------------------
function RepeatableRows({ label, rows, onChange, renderRow, newRow, addLabel = "Add row" }) {
    const update = (i, patch) => {
        const arr = [...rows];
        arr[i] = { ...arr[i], ...patch };
        onChange(arr);
    };
    const remove = (i) => onChange(rows.filter((_, j) => j !== i));
    const add = () => onChange([...rows, newRow()]);
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className={labelCls + " mb-0"}>{label}</span>
                <button type="button" onClick={add} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
                    <FiPlus className="w-3.5 h-3.5" /> {addLabel}
                </button>
            </div>
            {rows.length === 0 && <p className="text-xs text-gray-400 mb-2">None yet.</p>}
            <div className="space-y-2">
                {rows.map((row, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
                        <div className="flex-1">{renderRow(row, (patch) => update(i, patch))}</div>
                        <button type="button" onClick={() => remove(i)} className="p-1.5 text-gray-400 hover:text-red-600 shrink-0" title="Remove row">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------
// Product search + details helpers for the orderForm block's product picker.
// There's no dedicated products service module in this codebase — the
// existing admin screens (discount, labels, all-products) all hit these two
// endpoints directly with authFetch, so this mirrors that pattern.
// ---------------------------------------------------------------------
function useProductSearch() {
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/product/get-all-product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page: 1, limit: 50, search: query }),
                });
                const data = await res.json();
                if (!cancelled && data.success) setOptions(data.data || []);
            } catch {
                /* ignore */
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        const t = setTimeout(run, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [query]);
    return { query, setQuery, options, loading };
}

// Fetches the currently-selected product by id so the picker shows its real
// name/variants even when it falls outside the default 50-result list.
// Keyed on the productId it was fetched for so a stale result from a
// previous id never leaks through while the new fetch is in flight — no
// synchronous setState in the effect body itself, only inside the async
// callback once the response is in.
function useProductDetails(productId) {
    const [fetched, setFetched] = useState(null); // { id, product } | null
    useEffect(() => {
        if (!productId) return;
        let cancelled = false;
        authFetch(`/api/admin/product/get-product-details`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
        })
            .then((r) => r.json())
            .then((data) => { if (!cancelled && data.success) setFetched({ id: productId, product: data.data }); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [productId]);
    return fetched?.id === productId ? fetched.product : null;
}

// ---------------------------------------------------------------------
// Per-type field editors. Each receives `data` (the block's data object)
// and `onChange(patch)` which shallow-merges into it.
// ---------------------------------------------------------------------
function HeroFields({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Headline</label>
                <input className={inputCls} value={data.headline || ""} onChange={(e) => onChange({ headline: e.target.value })} placeholder="Wireless Earbuds — 50% Off Today" />
            </div>
            <div>
                <label className={labelCls}>Subheadline</label>
                <input className={inputCls} value={data.subheadline || ""} onChange={(e) => onChange({ subheadline: e.target.value })} placeholder="Free delivery across Bangladesh" />
            </div>
            <ImageUpload label="Banner image" value={data.imageUrl} onChange={(url) => onChange({ imageUrl: url })} hint="Shown as the hero background/banner. Wide images work best." />
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>CTA button label</label>
                    <input className={inputCls} value={data.ctaLabel || ""} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder="Order Now" />
                </div>
                <div>
                    <label className={labelCls}>CTA target anchor</label>
                    <input className={inputCls} value={data.ctaTarget || ""} onChange={(e) => onChange({ ctaTarget: e.target.value })} placeholder="order-form" />
                    <p className="text-[11px] text-gray-400 mt-1">No leading #. Keep as &quot;order-form&quot; unless you know why not.</p>
                </div>
            </div>
        </div>
    );
}

function ProductHighlightFields({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Title</label>
                <input className={inputCls} value={data.title || ""} onChange={(e) => onChange({ title: e.target.value })} />
            </div>
            <ImageUpload label="Product image" value={data.imageUrl} onChange={(url) => onChange({ imageUrl: url })} hint="Square or portrait images work best." />
            <div>
                <label className={labelCls}>Description</label>
                <textarea rows={4} className={inputCls} value={data.description || ""} onChange={(e) => onChange({ description: e.target.value })} placeholder="A short pitch — what it is, why it's worth buying." />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
                <div>
                    <label className={labelCls}>Price</label>
                    <input type="number" className={inputCls} value={data.price ?? ""} onChange={(e) => onChange({ price: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div>
                    <label className={labelCls}>Compare-at price (optional)</label>
                    <input type="number" className={inputCls} value={data.comparePrice ?? ""} onChange={(e) => onChange({ comparePrice: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div>
                    <label className={labelCls}>Badge (optional)</label>
                    <input className={inputCls} value={data.badge || ""} onChange={(e) => onChange({ badge: e.target.value })} placeholder="Best Seller" />
                </div>
            </div>
        </div>
    );
}

function OrderFormFields({ data, onChange }) {
    const { query, setQuery, options, loading } = useProductSearch();
    const selectedProduct = useProductDetails(data.productId);

    const mergedOptions = useMemo(() => {
        if (!selectedProduct) return options;
        if (options.some((p) => p._id === selectedProduct._id)) return options;
        return [selectedProduct, ...options];
    }, [options, selectedProduct]);

    const weights = selectedProduct?.weights || [];

    const pickProduct = (productId) => {
        if (!productId) { onChange({ productId: "", productName: "", weightIndex: 0 }); return; }
        const p = mergedOptions.find((x) => x._id === productId);
        const name = p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "";
        onChange({ productId, productName: name, weightIndex: 0, price: p?.weights?.[0]?.price ?? data.price ?? "" });
    };

    const pickWeight = (idx) => {
        onChange({ weightIndex: idx, price: weights[idx]?.price ?? data.price ?? "" });
    };

    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Heading</label>
                <input className={inputCls} value={data.heading || ""} onChange={(e) => onChange({ heading: e.target.value })} placeholder="Place Your Order" />
            </div>

            <div>
                <label className={labelCls}>Product</label>
                <div className="relative mb-1.5">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                        className={`${inputCls} pl-8`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={loading ? "Searching…" : "Search products by name…"}
                    />
                </div>
                <select className={inputCls} value={data.productId || ""} onChange={(e) => pickProduct(e.target.value)}>
                    <option value="">Select a product…</option>
                    {mergedOptions.map((p) => (
                        <option key={p._id} value={p._id}>{[p.firstName, p.lastName].filter(Boolean).join(" ")}</option>
                    ))}
                </select>
                {data.productId && !selectedProduct && (
                    <p className="text-[11px] text-gray-400 mt-1">Currently: {data.productName || data.productId}</p>
                )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Variant (weight)</label>
                    <select
                        className={inputCls}
                        value={data.weightIndex ?? 0}
                        onChange={(e) => pickWeight(Number(e.target.value))}
                        disabled={weights.length === 0}
                    >
                        {weights.length === 0 && <option value={0}>{data.productId ? "Loading variants…" : "Pick a product first"}</option>}
                        {weights.map((w, i) => (
                            <option key={i} value={i}>{w.weight} {w.price != null ? `— ${w.price}` : ""}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Price</label>
                    <input type="number" className={inputCls} value={data.price ?? ""} onChange={(e) => onChange({ price: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
            </div>

            <RepeatableRows
                label="Delivery areas (optional — leave empty to use the storefront default local/regional/international options)"
                rows={data.deliveryAreas || []}
                onChange={(rows) => onChange({ deliveryAreas: rows })}
                addLabel="Add delivery area"
                newRow={() => ({ key: "", label: "", charge: 0 })}
                renderRow={(row, patch) => (
                    <div className="grid sm:grid-cols-3 gap-2">
                        <input className={inputCls} placeholder="key (e.g. local)" value={row.key || ""} onChange={(e) => patch({ key: e.target.value })} />
                        <input className={inputCls} placeholder="Label (e.g. Local Delivery)" value={row.label || ""} onChange={(e) => patch({ label: e.target.value })} />
                        <input type="number" className={inputCls} placeholder="Charge" value={row.charge ?? ""} onChange={(e) => patch({ charge: e.target.value === "" ? "" : Number(e.target.value) })} />
                    </div>
                )}
            />
        </div>
    );
}

function TestimonialsFields({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Heading</label>
                <input className={inputCls} value={data.heading || ""} onChange={(e) => onChange({ heading: e.target.value })} />
            </div>
            <RepeatableRows
                label="Testimonials"
                rows={data.items || []}
                onChange={(rows) => onChange({ items: rows })}
                addLabel="Add testimonial"
                newRow={() => ({ name: "", quote: "", rating: 5, avatarUrl: "" })}
                renderRow={(row, patch) => (
                    <div className="grid sm:grid-cols-2 gap-2">
                        <input className={inputCls} placeholder="Name" value={row.name || ""} onChange={(e) => patch({ name: e.target.value })} />
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400 shrink-0">Rating (1–5)</label>
                            <input type="number" min={1} max={5} className={inputCls} value={row.rating ?? 5} onChange={(e) => patch({ rating: Number(e.target.value) })} />
                        </div>
                        <textarea rows={2} className={`${inputCls} sm:col-span-2`} placeholder="Quote" value={row.quote || ""} onChange={(e) => patch({ quote: e.target.value })} />
                        <input className={`${inputCls} sm:col-span-2`} placeholder="Avatar URL (optional)" value={row.avatarUrl || ""} onChange={(e) => patch({ avatarUrl: e.target.value })} />
                    </div>
                )}
            />
        </div>
    );
}

function CountdownFields({ data, onChange }) {
    // <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm"; storage/contract is ISO.
    const toLocalInput = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Heading</label>
                <input className={inputCls} value={data.heading || ""} onChange={(e) => onChange({ heading: e.target.value })} placeholder="Offer Ends In" />
            </div>
            <div>
                <label className={labelCls}>Ends at (fixed deadline)</label>
                <input
                    type="datetime-local"
                    className={inputCls}
                    value={toLocalInput(data.endsAt)}
                    onChange={(e) => onChange({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                />
            </div>
        </div>
    );
}

function FaqFields({ data, onChange }) {
    return (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Heading</label>
                <input className={inputCls} value={data.heading || ""} onChange={(e) => onChange({ heading: e.target.value })} />
            </div>
            <RepeatableRows
                label="Questions"
                rows={data.items || []}
                onChange={(rows) => onChange({ items: rows })}
                addLabel="Add question"
                newRow={() => ({ question: "", answer: "" })}
                renderRow={(row, patch) => (
                    <div className="space-y-2">
                        <input className={inputCls} placeholder="Question" value={row.question || ""} onChange={(e) => patch({ question: e.target.value })} />
                        <textarea rows={2} className={inputCls} placeholder="Answer" value={row.answer || ""} onChange={(e) => patch({ answer: e.target.value })} />
                    </div>
                )}
            />
        </div>
    );
}

function TrustBadgesFields({ data, onChange }) {
    return (
        <RepeatableRows
            label="Badges"
            rows={data.items || []}
            onChange={(rows) => onChange({ items: rows })}
            addLabel="Add badge"
            newRow={() => ({ icon: "", label: "" })}
            renderRow={(row, patch) => (
                <div className="grid sm:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Icon name (e.g. FiTruck)" value={row.icon || ""} onChange={(e) => patch({ icon: e.target.value })} />
                    <input className={inputCls} placeholder="Label (e.g. Fast Delivery)" value={row.label || ""} onChange={(e) => patch({ label: e.target.value })} />
                </div>
            )}
        />
    );
}

function StickyOrderBarFields({ data, onChange }) {
    return (
        <div className="grid sm:grid-cols-2 gap-3">
            <div>
                <label className={labelCls}>Label</label>
                <input className={inputCls} value={data.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Order Now" />
            </div>
            <div>
                <label className={labelCls}>CTA target anchor</label>
                <input className={inputCls} value={data.ctaTarget || ""} onChange={(e) => onChange({ ctaTarget: e.target.value })} placeholder="order-form" />
            </div>
        </div>
    );
}

function WhatsappCtaFields({ data, onChange }) {
    return (
        <div>
            <label className={labelCls}>Pre-filled WhatsApp message</label>
            <textarea rows={3} className={inputCls} value={data.message || ""} onChange={(e) => onChange({ message: e.target.value })} placeholder="Hi! I'm interested in this product…" />
        </div>
    );
}

const FIELDS_BY_TYPE = {
    hero: HeroFields,
    productHighlight: ProductHighlightFields,
    orderForm: OrderFormFields,
    testimonials: TestimonialsFields,
    countdown: CountdownFields,
    faq: FaqFields,
    trustBadges: TrustBadgesFields,
    stickyOrderBar: StickyOrderBarFields,
    whatsappCta: WhatsappCtaFields,
};

// ---------------------------------------------------------------------
// One block card: header (type label, reorder, remove) + its field editor.
// ---------------------------------------------------------------------
function BlockCard({ block, index, total, editable, onMove, onRemove, onChange }) {
    const Fields = FIELDS_BY_TYPE[block.type];
    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{BLOCK_LABELS[block.type] || block.type}</span>
                </div>
                {editable && (
                    <div className="flex items-center gap-1">
                        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent">
                            <FiArrowUp className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent">
                            <FiArrowDown className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={onRemove} title="Remove block" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <FiTrash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
            <div className="p-4">
                <fieldset disabled={!editable} className="disabled:opacity-70">
                    {Fields ? <Fields data={block.data || {}} onChange={onChange} /> : <p className="text-xs text-gray-400">Unknown block type &quot;{block.type}&quot;.</p>}
                </fieldset>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------
export default function LandingPageBuilderPage() {
    const { id } = useParams();
    const router = useRouter();
    const { can } = useAdminAuth();
    const editable = can("content:write");

    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [seoOpen, setSeoOpen] = useState(false);
    const [slugTouched, setSlugTouched] = useState(true); // editing an existing slug — don't auto-derive it

    // Tracks the slug this page is currently published under, so a save can bust
    // the old /lp/<slug> ISR cache too if the admin renamed it in this edit.
    const liveSlugRef = useRef("");

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getLandingPage(id);
        if (res?.success) {
            const d = res.data;
            liveSlugRef.current = d.slug || "";
            setDraft({
                title: d.title || "",
                slug: d.slug || "",
                isPublished: !!d.isPublished,
                seoTitle: d.seoTitle || "",
                seoDescription: d.seoDescription || "",
                ogImage: d.ogImage || "",
                blocks: (d.blocks || []).map((b) => ({ __key: b._id || genKey(), type: b.type, data: b.data || {} })),
            });
        } else {
            setMsg({ type: "error", text: res?.message || "Could not load landing page" });
        }
        setLoading(false);
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const setField = (patch) => setDraft((d) => ({ ...d, ...patch }));

    const updateBlockData = (key, patch) =>
        setDraft((d) => ({
            ...d,
            blocks: d.blocks.map((b) => (b.__key === key ? { ...b, data: { ...b.data, ...patch } } : b)),
        }));

    const moveBlock = (key, dir) =>
        setDraft((d) => {
            const idx = d.blocks.findIndex((b) => b.__key === key);
            const newIdx = idx + dir;
            if (idx < 0 || newIdx < 0 || newIdx >= d.blocks.length) return d;
            const blocks = [...d.blocks];
            [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
            return { ...d, blocks };
        });

    const removeBlock = (key) => {
        if (!confirm("Remove this block? This can't be undone until you leave without saving.")) return;
        setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.__key !== key) }));
    };

    const addBlock = (type) => {
        if (!type) return;
        setDraft((d) => ({ ...d, blocks: [...d.blocks, { __key: genKey(), type, data: defaultBlockData(type) }] }));
    };

    const hasOrderForm = useMemo(() => (draft?.blocks || []).some((b) => b.type === "orderForm"), [draft]);

    const save = async () => {
        if (!draft) return;
        setMsg({ type: "", text: "" });
        const title = draft.title.trim();
        const slug = draft.slug.trim().toLowerCase();
        if (!title) { setMsg({ type: "error", text: "Enter a page title." }); return; }
        if (!SLUG_RE.test(slug)) {
            setMsg({ type: "error", text: "Slug must be lowercase letters, numbers and single hyphens only." });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title,
                slug,
                isPublished: !!draft.isPublished,
                seoTitle: draft.seoTitle || "",
                seoDescription: draft.seoDescription || "",
                ogImage: draft.ogImage || "",
                blocks: draft.blocks.map(({ type, data }) => ({ type, data })),
            };
            const res = await updateLandingPage(id, payload);
            if (res?.success) {
                const d = res.data;
                // Bust the public page's ISR cache for both the slug it's live
                // under now and the one it was live under before this save (a
                // rename would otherwise leave the old URL serving a stale page
                // for the rest of its 60s window and the new one 404ing).
                const tags = new Set([`landing:${d.slug}`]);
                if (liveSlugRef.current && liveSlugRef.current !== d.slug) tags.add(`landing:${liveSlugRef.current}`);
                revalidateTags([...tags]);
                liveSlugRef.current = d.slug || "";
                setDraft({
                    title: d.title || "",
                    slug: d.slug || "",
                    isPublished: !!d.isPublished,
                    seoTitle: d.seoTitle || "",
                    seoDescription: d.seoDescription || "",
                    ogImage: d.ogImage || "",
                    blocks: (d.blocks || []).map((b) => ({ __key: b._id || genKey(), type: b.type, data: b.data || {} })),
                });
                setMsg({ type: "success", text: "Saved" });
                setTimeout(() => setMsg({ type: "", text: "" }), 2500);
            } else {
                setMsg({ type: "error", text: res?.message || "Failed to save" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!draft) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm text-gray-500 mb-4">{msg.text || "Landing page not found."}</p>
                <Link href="/admin/landing-pages" className="text-sm text-indigo-600 hover:text-indigo-700">← Back to Landing Pages</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Link href="/admin/landing-pages" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600">
                <FiArrowLeft className="w-3.5 h-3.5" /> Landing Pages
            </Link>

            {/* Top bar */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Title (internal — never shown publicly)</label>
                        <input
                            className={inputCls}
                            value={draft.title}
                            onChange={(e) => {
                                const v = e.target.value;
                                setField(!slugTouched ? { title: v, slug: slugify(v) } : { title: v });
                            }}
                            disabled={!editable}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Slug</label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400 shrink-0">/lp/</span>
                            <input
                                className={`${inputCls} font-mono`}
                                value={draft.slug}
                                onChange={(e) => { setSlugTouched(true); setField({ slug: e.target.value }); }}
                                disabled={!editable}
                            />
                        </div>
                        {draft.slug && !SLUG_RE.test(draft.slug.trim().toLowerCase()) && (
                            <p className="text-[11px] text-red-500 mt-1">Lowercase letters, numbers and single hyphens only.</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setField({ isPublished: !draft.isPublished })}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${draft.isPublished ? "bg-indigo-600" : "bg-gray-300"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${draft.isPublished ? "translate-x-5" : ""}`} />
                        </button>
                        <span className="text-sm text-gray-700">{draft.isPublished ? "Published" : "Draft"}</span>

                        <Link href={`/lp/${draft.slug || ""}`} target="_blank"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-indigo-600 border border-gray-200 rounded-lg">
                            <FiExternalLink className="w-3.5 h-3.5" /> Preview
                        </Link>
                    </div>

                    {editable && (
                        <button onClick={save} disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-xl">
                            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                            Save
                        </button>
                    )}
                </div>

                {msg.text && (
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {msg.type === "success" ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                        {msg.text}
                    </div>
                )}
            </div>

            {/* SEO */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setSeoOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">
                    SEO
                    {seoOpen ? <FiChevronUp className="w-4 h-4 text-gray-400" /> : <FiChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {seoOpen && (
                    <fieldset disabled={!editable} className="p-4 space-y-3 disabled:opacity-70">
                        <div>
                            <label className={labelCls}>SEO title</label>
                            <input className={inputCls} value={draft.seoTitle} onChange={(e) => setField({ seoTitle: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>SEO description</label>
                            <input className={inputCls} value={draft.seoDescription} onChange={(e) => setField({ seoDescription: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>OG image URL</label>
                            <input className={inputCls} value={draft.ogImage} onChange={(e) => setField({ ogImage: e.target.value })} placeholder="https://…" />
                            <p className="text-[11px] text-gray-400 mt-1">Plain URL only — no upload widget in this version.</p>
                        </div>
                    </fieldset>
                )}
            </div>

            {/* Blocks */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-800">Blocks</h2>
                </div>

                {draft.blocks.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
                        No blocks yet. Add one below to start building the page.
                    </div>
                )}

                <div className="space-y-4">
                    {draft.blocks.map((block, i) => (
                        <BlockCard
                            key={block.__key}
                            block={block}
                            index={i}
                            total={draft.blocks.length}
                            editable={editable}
                            onMove={(dir) => moveBlock(block.__key, dir)}
                            onRemove={() => removeBlock(block.__key)}
                            onChange={(patch) => updateBlockData(block.__key, patch)}
                        />
                    ))}
                </div>

                {editable && (
                    <div className="flex items-center gap-2 pt-2">
                        <select
                            className={`${inputCls} max-w-xs`}
                            value=""
                            onChange={(e) => addBlock(e.target.value)}
                        >
                            <option value="">Add block…</option>
                            {BLOCK_TYPES.map((t) => (
                                <option key={t.type} value={t.type} disabled={t.single && hasOrderForm}>
                                    {t.label}{t.single && hasOrderForm ? " (already added)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
