"use client";
import { useState, useEffect, useCallback } from "react";
import { FiShield, FiSave, FiCheck, FiAlertCircle } from "react-icons/fi";
import { getSiteSettings, updateSiteSettings } from "@/services/siteSettings";
import { useAdminAuth } from "@/context/AdminAuthContext";

// Split out of the old Site Settings "Fraud Prevention" tab so it lives
// under the Risk & Fraud nav group next to Blocklist — same underlying
// SiteSettings document and PATCH endpoint (partial $set, see
// backend/src/controllers/siteSettings.controller.js's flattenForSet), just
// a page of its own for faster access.
const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            {children}
            {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
        </label>
    );
}

export default function FraudSettingsPage() {
    const { can } = useAdminAuth();
    const editable = can("content:write");

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getSiteSettings();
        if (res?.success) setSettings(res.data);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const setFraudbd = (patch) =>
        setSettings((p) => ({
            ...p,
            integrations: { ...(p.integrations || {}), fraudbd: { ...(p.integrations?.fraudbd || {}), ...patch } },
        }));
    const setSteadfast = (patch) =>
        setSettings((p) => ({
            ...p,
            integrations: { ...(p.integrations || {}), steadfast: { ...(p.integrations?.steadfast || {}), ...patch } },
        }));

    const save = async () => {
        setSaving(true);
        setMsg({ type: "", text: "" });
        try {
            const payload = {
                integrations: {
                    fraudbd: {
                        apiKey: settings.integrations?.fraudbd?.apiKey || "",
                        mode: settings.integrations?.fraudbd?.mode === "production" ? "production" : "sandbox",
                    },
                    steadfast: {
                        apiKey: settings.integrations?.steadfast?.apiKey || "",
                        secretKey: settings.integrations?.steadfast?.secretKey || "",
                        webhookToken: settings.integrations?.steadfast?.webhookToken || "",
                    },
                },
            };
            const res = await updateSiteSettings(payload);
            if (res?.success) {
                if (res.data) setSettings(res.data);
                setMsg({ type: "success", text: "Settings saved successfully" });
                setTimeout(() => setMsg({ type: "", text: "" }), 2500);
            } else {
                setMsg({ type: "error", text: res?.message || "Failed to save settings" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiShield className="text-indigo-600" /> Fraud Prevention
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Third-party checks that screen orders before they're accepted.</p>
                </div>
                {editable && (
                    <button onClick={save} disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-xl">
                        {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                        Save changes
                    </button>
                )}
            </div>

            {msg.text && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-6 ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {msg.type === "success" ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            <fieldset disabled={!editable} className="space-y-5 disabled:opacity-70">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Fake-order detection</h3>
                    <p className="text-xs text-gray-500 -mt-1">
                        Flags suspicious checkouts (rapid repeat orders, phones with a high cancel/return
                        rate on this store) for manual review, using only this store&apos;s own order history.
                        No account or API key needed. Tune it under Site Settings &rarr; Features.
                    </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Courier delivery-ratio check (Fraud BD)</h3>
                    <p className="text-xs text-gray-500 -mt-1">
                        Looks up a customer&apos;s cross-courier delivery success rate (Pathao, Steadfast,
                        Paperfly, RedX) via{" "}
                        <a href="https://fraudbd.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">fraudbd.com</a>{" "}
                        before accepting an order, and flags a low success rate for review. <strong>Off by
                        default</strong> — this stays disabled until an API key is saved below. Get a key by
                        signing up at fraudbd.com; a public sandbox key works for testing with dummy data.
                    </p>
                    <Field label="Mode">
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                            <button type="button" onClick={() => setFraudbd({ mode: "sandbox" })} className={`px-4 py-2 text-sm ${((settings.integrations?.fraudbd?.mode || "sandbox") === "sandbox") ? "bg-indigo-600 text-white" : "text-gray-600"}`}>Sandbox (test)</button>
                            <button type="button" onClick={() => setFraudbd({ mode: "production" })} className={`px-4 py-2 text-sm ${settings.integrations?.fraudbd?.mode === "production" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>Production (live)</button>
                        </div>
                    </Field>
                    <Field label="API key" hint="From your Fraud BD account settings. Kept secret — never sent to the storefront. Leave blank to turn this feature off.">
                        <input type="password" autoComplete="new-password" className={inputCls} value={settings.integrations?.fraudbd?.apiKey || ""} onChange={(e) => setFraudbd({ apiKey: e.target.value })} placeholder="Paste your Fraud BD api_key" />
                    </Field>
                    <p className="text-xs text-gray-500">
                        Status:{" "}
                        {settings.integrations?.fraudbd?.apiKey ? (
                            <span className="text-emerald-600 font-medium">Enabled ({settings.integrations?.fraudbd?.mode === "production" ? "production" : "sandbox"} mode)</span>
                        ) : (
                            <span className="text-gray-500 font-medium">Off — no key saved</span>
                        )}
                    </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Steadfast Courier</h3>
                    <p className="text-xs text-gray-500 -mt-1">
                        Book confirmed orders directly with Steadfast Courier and keep delivery status in
                        sync, from the Orders page.
                    </p>
                    <Field label="API Key" hint="From your Steadfast merchant dashboard. Kept secret — never sent to the storefront. Leave blank to turn this feature off.">
                        <input type="password" autoComplete="new-password" className={inputCls} value={settings.integrations?.steadfast?.apiKey || ""} onChange={(e) => setSteadfast({ apiKey: e.target.value })} placeholder="Paste your Steadfast Api Key" />
                    </Field>
                    <Field label="Secret Key" hint="From your Steadfast merchant dashboard. Kept secret — never sent to the storefront.">
                        <input type="password" autoComplete="new-password" className={inputCls} value={settings.integrations?.steadfast?.secretKey || ""} onChange={(e) => setSteadfast({ secretKey: e.target.value })} placeholder="Paste your Steadfast Secret Key" />
                    </Field>
                    <Field label="Webhook Token" hint="Pick any secret string, save it here, then paste the same value as the Bearer token in your Steadfast merchant dashboard's Webhook settings (Callback URL: your backend's /api/courier/webhook/steadfast).">
                        <input type="password" autoComplete="new-password" className={inputCls} value={settings.integrations?.steadfast?.webhookToken || ""} onChange={(e) => setSteadfast({ webhookToken: e.target.value })} placeholder="Choose a secret webhook token" />
                    </Field>
                    <p className="text-xs text-gray-500">
                        Status:{" "}
                        {settings.integrations?.steadfast?.apiKey && settings.integrations?.steadfast?.secretKey ? (
                            <span className="text-emerald-600 font-medium">Enabled</span>
                        ) : (
                            <span className="text-gray-500 font-medium">Off — no credentials saved</span>
                        )}
                    </p>
                </div>
            </fieldset>
        </div>
    );
}
