// Expand/collapse accordion. Plain server component — native <details>/
// <summary> gives zero-JS accordion behavior, so no client directive needed.
export default function FaqBlock({ data }) {
    const { heading, items } = data || {};
    const list = Array.isArray(items) ? items : [];

    if (!list.length) return null;

    return (
        <section className="max-w-3xl mx-auto px-4 py-10">
            {heading && (
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6">{heading}</h2>
            )}
            <div className="space-y-3">
                {list.map((f, i) => (
                    <details key={i} className="group bg-white border border-gray-200 open:border-emerald-200 rounded-xl px-5 py-4 transition-colors">
                        <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-gray-800">
                            {f.question}
                            <span className="shrink-0 w-7 h-7 rounded-full bg-gray-50 group-open:bg-emerald-50 flex items-center justify-center text-gray-500 group-open:text-emerald-600 text-lg leading-none transition-all group-open:rotate-45">
                                +
                            </span>
                        </summary>
                        {f.answer && <p className="text-gray-600 mt-3 leading-relaxed whitespace-pre-line">{f.answer}</p>}
                    </details>
                ))}
            </div>
        </section>
    );
}
