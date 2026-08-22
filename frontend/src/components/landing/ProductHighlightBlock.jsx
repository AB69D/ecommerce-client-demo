// Product name/image/price block. Plain server component. `currencySymbol` is
// fetched server-side by the page (matching product/[id]/page.jsx's pattern
// of resolving site-settings currency for SSR'd price text) and passed down,
// since this component cannot use the client-only CurrencyContext hook.
export default function ProductHighlightBlock({ data, currencySymbol = "৳" }) {
    const { title, imageUrl, description, price, comparePrice, badge } = data || {};
    const showCompare = comparePrice != null && Number(comparePrice) > Number(price || 0);
    const discountPct = showCompare ? Math.round((1 - Number(price) / Number(comparePrice)) * 100) : null;

    if (!title && !imageUrl && price == null) return null;

    return (
        <section className="max-w-2xl mx-auto px-4 py-10">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-900/5 p-5 sm:p-8 text-center">
                {imageUrl && (
                    <div className="relative mb-6">
                        <img
                            src={imageUrl}
                            alt={title || "Product"}
                            loading="lazy"
                            className="w-full max-h-96 object-contain mx-auto rounded-2xl bg-gray-50"
                        />
                        {discountPct > 0 && (
                            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-extrabold px-2.5 py-1.5 rounded-full shadow-md">
                                -{discountPct}%
                            </span>
                        )}
                    </div>
                )}
                {badge && (
                    <span className="inline-block bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 ring-1 ring-amber-200 text-xs font-bold px-3 py-1.5 rounded-full mb-3 tracking-wide">
                        ★ {badge}
                    </span>
                )}
                {title && <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 text-balance">{title}</h2>}
                {description && (
                    <p className="text-gray-600 leading-relaxed mb-6 whitespace-pre-line max-w-lg mx-auto">{description}</p>
                )}
                {price != null && (
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        {showCompare && (
                            <span className="text-lg text-gray-400 line-through">
                                {currencySymbol}
                                {comparePrice}
                            </span>
                        )}
                        <span className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
                            {currencySymbol}
                            {price}
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}
