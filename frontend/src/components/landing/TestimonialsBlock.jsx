import StarRating from "@/components/StarRating.jsx";

// Simple quote-card grid. Plain server component — reuses the existing
// StarRating presentational component (value 0-5, half-stars supported).
export default function TestimonialsBlock({ data }) {
    const { heading, items } = data || {};
    const list = Array.isArray(items) ? items : [];

    if (!list.length && !heading) return null;

    return (
        <section className="max-w-5xl mx-auto px-4 py-10">
            {heading && (
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">{heading}</h2>
            )}
            {list.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {list.map((t, i) => (
                        <div key={i} className="relative bg-white border border-gray-100 rounded-2xl p-6 shadow-md shadow-gray-900/5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            <span aria-hidden className="absolute top-4 right-5 text-5xl leading-none font-serif text-emerald-100 select-none">&rdquo;</span>
                            <StarRating value={t.rating} size="sm" className="mb-3" />
                            {t.quote && <p className="relative text-gray-700 mb-5 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>}
                            <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                                {t.avatarUrl ? (
                                    <img
                                        src={t.avatarUrl}
                                        alt={t.name || "Customer"}
                                        loading="lazy"
                                        className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-100"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                                        {(t.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {t.name && <span className="text-sm font-semibold text-gray-800">{t.name}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
