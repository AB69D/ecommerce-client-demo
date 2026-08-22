"use client";
import { useState } from "react";
import Image from "next/image";
import { FiImage, FiUpload, FiTrash2 } from "react-icons/fi";
import { uploadSiteImage } from "@/services/siteSettings";

// Shared image-upload control (Cloudinary-backed, via the same generic
// /api/admin/site-settings/upload endpoint every other admin upload already
// uses — it just streams to Cloudinary and hands back a URL, nothing
// settings-specific about it). Used by the Settings page (logo/favicon/OG
// image) and the landing-page builder (hero banner, product image) so there
// is exactly one upload implementation in the admin panel, not one per screen.
export default function ImageUpload({ label, value, onChange, hint }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const pick = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setErr("");
        try {
            const res = await uploadSiteImage(file);
            if (res?.success && res.data?.url) onChange(res.data.url);
            else setErr(res?.message || "Upload failed");
        } catch {
            setErr("Upload failed");
        } finally {
            setBusy(false);
            e.target.value = "";
        }
    };

    return (
        <label className="block">
            {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {value ? (
                        <Image src={value} alt={label || "Uploaded image"} width={80} height={80} className="object-contain w-full h-full" unoptimized />
                    ) : (
                        <FiImage className="w-7 h-7 text-gray-300" />
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl cursor-pointer w-fit">
                        {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiUpload className="w-4 h-4" />}
                        {busy ? "Uploading..." : "Upload"}
                        <input type="file" accept="image/*" onChange={pick} className="hidden" disabled={busy} />
                    </span>
                    {value && (
                        <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 w-fit">
                            <FiTrash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                    )}
                    {err && <span className="text-xs text-red-500">{err}</span>}
                </div>
            </div>
            {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
        </label>
    );
}
