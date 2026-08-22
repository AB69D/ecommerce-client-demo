"use client";

// Bottom-fixed order bar shown only on mobile widths. Client component
// because the CTA needs a scrollIntoView onClick handler (unlike HeroBlock's
// CTA, which uses a plain anchor since it stays a server component).
export default function StickyOrderBarBlock({ data }) {
    const { label, ctaTarget } = data || {};

    if (!label) return null;

    const handleClick = () => {
        if (typeof document === "undefined") return;
        document.getElementById(ctaTarget)?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="fixed bottom-0 inset-x-0 lg:hidden z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] px-4 py-3">
            <button
                type="button"
                onClick={handleClick}
                className="relative w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-transform overflow-hidden"
            >
                <span className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <span className="relative">{label}</span>
            </button>
        </div>
    );
}
