"use client";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { useWhatsApp } from "@/hooks/useWhatsApp";

// Reuses the existing WhatsApp integration (admin-configured business number
// + feature flag from site settings). Client component because useWhatsApp
// reads site settings via a client-side hook. No-ops entirely when WhatsApp
// isn't configured for this store, matching every other consumer of the hook.
export default function WhatsappCtaBlock({ data }) {
    const { message = "" } = data || {};
    const wa = useWhatsApp();

    if (!wa.enabled) return null;

    return (
        <section className="max-w-lg mx-auto px-4 py-6 text-center">
            <a
                href={wa.chatUrl(message)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/30 hover:-translate-y-0.5 transition-all"
            >
                <PiWhatsappLogoBold className="w-5 h-5" />
                Chat on WhatsApp
            </a>
        </section>
    );
}
