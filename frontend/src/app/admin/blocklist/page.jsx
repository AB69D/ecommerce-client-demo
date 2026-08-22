"use client";
import { useState, useEffect, useCallback } from "react";
import { FiPlus, FiTrash2, FiX, FiShield, FiSearch, FiPhone, FiGlobe } from "react-icons/fi";
import {
    listBlockedPhones,
    createBlockedPhone,
    deleteBlockedPhone,
    listBlockedIps,
    createBlockedIp,
    deleteBlockedIp,
} from "@/services/blocklist";
import { useAdminAuth } from "@/context/AdminAuthContext";

const BLANK_PHONE = { phone: "", reason: "", severity: "hard", expiresAt: "" };
const BLANK_IP = { type: "single", ip: "", reason: "", severity: "soft", expiresAt: "" };

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

const SOURCE_LABEL = {
    manual: "Manual",
    "auto-fake-order": "Auto (fake order)",
    "auto-courier-ratio": "Auto (courier ratio)",
};

export default function BlocklistPage() {
    const { can } = useAdminAuth();
    const canWrite = can("blocklist:write");

    const [tab, setTab] = useState("phones");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState({ show: false, form: BLANK_PHONE });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = tab === "phones"
                ? await listBlockedPhones({ search, limit: 100 })
                : await listBlockedIps({ search, limit: 100 });
            if (res?.success) setItems(res.data?.items || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [tab, search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    const flash = (m) => { setMessage(m); setTimeout(() => setMessage(""), 2500); };

    const openCreate = () => {
        setError("");
        setModal({ show: true, form: tab === "phones" ? { ...BLANK_PHONE } : { ...BLANK_IP } });
    };
    const closeModal = () => setModal({ show: false, form: tab === "phones" ? BLANK_PHONE : BLANK_IP });
    const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

    const save = async () => {
        setError("");
        const f = modal.form;

        setSaving(true);
        try {
            const res = tab === "phones"
                ? await createBlockedPhone({
                    phone: f.phone.trim(),
                    reason: f.reason.trim(),
                    severity: f.severity,
                    expiresAt: f.expiresAt || "",
                })
                : await createBlockedIp({
                    type: f.type,
                    ip: f.ip.trim(),
                    reason: f.reason.trim(),
                    severity: f.severity,
                    expiresAt: f.expiresAt || "",
                });
            if (res?.success) {
                closeModal();
                flash(tab === "phones" ? "Phone blocked" : "IP blocked");
                load();
            } else {
                setError(res?.message || "Could not save.");
            }
        } catch {
            setError("Could not save.");
        } finally {
            setSaving(false);
        }
    };

    const doDelete = async (item) => {
        try {
            const res = tab === "phones" ? await deleteBlockedPhone(item._id) : await deleteBlockedIp(item._id);
            if (res?.success) { flash("Removed from blocklist"); load(); }
        } catch {
            /* ignore */
        } finally {
            setConfirmDelete(null);
        }
    };

    const switchTab = (t) => { setTab(t); setSearch(""); setItems([]); setLoading(true); };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiShield className="text-indigo-600" /> Customer Blocklist
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Block abusive customers by phone or IP at checkout. Hard blocks reject the order outright; soft blocks let it through flagged for review.
                    </p>
                </div>
                {canWrite && (
                    <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2">
                        <FiPlus className="w-4 h-4" /> {tab === "phones" ? "Block phone" : "Block IP"}
                    </button>
                )}
            </div>

            {message && <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{message}</div>}

            <div className="flex gap-1 mb-4 border border-gray-200 rounded-lg p-1 w-fit">
                <button onClick={() => switchTab("phones")} className={`px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "phones" ? "bg-indigo-600 text-white" : "text-gray-500"}`}>
                    <FiPhone className="w-3.5 h-3.5" /> Phones
                </button>
                <button onClick={() => switchTab("ips")} className={`px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "ips" ? "bg-indigo-600 text-white" : "text-gray-500"}`}>
                    <FiGlobe className="w-3.5 h-3.5" /> IP addresses
                </button>
            </div>

            <div className="relative mb-4 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={tab === "phones" ? "Search phone…" : "Search IP…"}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {loading ? (
                <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiShield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Nothing blocked yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400 border-b border-gray-100">
                                <th className="py-2.5 px-3 font-medium">{tab === "phones" ? "Phone" : "IP / Range"}</th>
                                <th className="py-2.5 px-3 font-medium">Severity</th>
                                <th className="py-2.5 px-3 font-medium">Source</th>
                                <th className="py-2.5 px-3 font-medium">Reason</th>
                                <th className="py-2.5 px-3 font-medium">Hits</th>
                                <th className="py-2.5 px-3 font-medium">Expires</th>
                                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr key={it._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-gray-800">
                                        {tab === "phones" ? it.phoneE164 : it.ip}
                                        {tab === "ips" && it.type === "cidr" && <span className="ml-1.5 text-xs font-sans text-gray-400">(range)</span>}
                                    </td>
                                    <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${it.severity === "hard" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                                            {it.severity === "hard" ? "Hard block" : "Soft (review)"}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-gray-500 text-xs">{SOURCE_LABEL[it.source] || it.source}</td>
                                    <td className="py-2.5 px-3 text-gray-600 max-w-[220px] truncate">{it.reason || "—"}</td>
                                    <td className="py-2.5 px-3 text-gray-600">{it.hitCount || 0}</td>
                                    <td className="py-2.5 px-3 text-gray-500 text-xs">{it.expiresAt ? fmtDate(it.expiresAt) : "Never"}</td>
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {canWrite && (
                                                <button onClick={() => setConfirmDelete(it)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
            )}

            {/* Create modal */}
            {modal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800">{tab === "phones" ? "Block a phone number" : "Block an IP address"}</h3>
                            <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            {error && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

                            {tab === "phones" ? (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone number</label>
                                    <input value={modal.form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="01XXXXXXXXX" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                            <button type="button" onClick={() => setField("type", "single")} className={`flex-1 py-2 text-sm ${modal.form.type === "single" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>Single IP</button>
                                            <button type="button" onClick={() => setField("type", "cidr")} className={`flex-1 py-2 text-sm ${modal.form.type === "cidr" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>CIDR range</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{modal.form.type === "cidr" ? "Range (e.g. 103.10.20.0/24)" : "IP address"}</label>
                                        <input value={modal.form.ip} onChange={(e) => setField("ip", e.target.value)} placeholder={modal.form.type === "cidr" ? "103.10.20.0/24" : "103.10.20.5"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
                                <input value={modal.form.reason} onChange={(e) => setField("reason", e.target.value)} placeholder="3 fake COD orders, refused delivery" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Severity</label>
                                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                        <button type="button" onClick={() => setField("severity", "hard")} className={`flex-1 py-2 text-sm ${modal.form.severity === "hard" ? "bg-red-600 text-white" : "text-gray-600"}`}>Hard</button>
                                        <button type="button" onClick={() => setField("severity", "soft")} className={`flex-1 py-2 text-sm ${modal.form.severity === "soft" ? "bg-amber-500 text-white" : "text-gray-600"}`}>Soft</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Expires (optional)</label>
                                    <input type="date" value={modal.form.expiresAt} onChange={(e) => setField("expiresAt", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">
                                {modal.form.severity === "hard"
                                    ? "Hard: the order is rejected outright at checkout."
                                    : "Soft: the order is still created, but flagged for manual review in Orders."}
                            </p>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex gap-2">
                            <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={save} disabled={saving} className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Block"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Remove from blocklist?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Unblock <strong className="font-mono">{tab === "phones" ? confirmDelete.phoneE164 : confirmDelete.ip}</strong>?
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
                            <button onClick={() => doDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
