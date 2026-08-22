// Big banner block. Plain server component — the CTA is a same-page anchor
// link (`#<ctaTarget>`) rather than an onClick handler so this file never
// needs "use client". Smooth scrolling for the jump is enabled globally via
// `html { scroll-behavior: smooth }` in globals.css.
export default function HeroBlock({ data }) {
    const { headline, subheadline, imageUrl, ctaLabel, ctaTarget } = data || {};

    if (!headline && !subheadline && !imageUrl && !ctaLabel) return null;

    return (
        <section className="w-full bg-gradient-to-b from-emerald-50 via-white to-white">
            {imageUrl && (
                // Arbitrary admin-pasted URL — not run through next/image since its
                // host is unlikely to be in next.config.mjs's remotePatterns.
                <div className="relative">
                    <img
                        src={imageUrl}
                        alt={headline || "Hero image"}
                        loading="lazy"
                        className="w-full max-h-[440px] sm:max-h-[560px] object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                </div>
            )}
            <div className="text-center max-w-2xl mx-auto px-4 py-10 sm:py-14">
                {headline && (
                    <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight tracking-tight text-balance">
                        {headline}
                    </h1>
                )}
                {subheadline && (
                    <p className="text-base sm:text-xl text-gray-600 mb-8 text-balance">{subheadline}</p>
                )}
                {ctaLabel && ctaTarget && (
                    <a
                        href={`#${ctaTarget}`}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold px-9 py-3.5 rounded-full text-lg shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all"
                    >
                        {ctaLabel}
                        <span aria-hidden className="text-xl leading-none">→</span>
                    </a>
                )}
            </div>
        </section>
    );
}
