"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiSearch, FiArrowRight } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";

// Debounced live-search dropdown backed by the backend's real `search` query
// param (GET /api/client/product/products?search=...) — the same endpoint
// the /search page fetches from, just server-filtered instead of the page's
// client-side substring match over the first 50 products.
export default function SearchBox({ autoFocus = false, onNavigate, inputClassName = "", placeholder = "Search products..." }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const { symbol } = useCurrency();
    const router = useRouter();
    const rootRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setOpen(false);
            return undefined;
        }
        setLoading(true);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/client/product/products?search=${encodeURIComponent(query.trim())}&limit=6`);
                const data = await res.json();
                if (data.success) {
                    setResults(data.data || []);
                    setOpen(true);
                }
            } catch (err) {
                console.error("Live search failed", err);
            } finally {
                setLoading(false);
            }
        }, 280);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const goToFullResults = () => {
        if (!query.trim()) return;
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
        onNavigate?.();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        goToFullResults();
    };

    const minPrice = (weights = []) => {
        if (!weights.length) return null;
        return weights.reduce((min, w) => {
            const a = (min.price || 0) - (min.price || 0) * ((min.discountPercent || 0) / 100);
            const b = (w.price || 0) - (w.price || 0) * ((w.discountPercent || 0) / 100);
            return b < a ? w : min;
        }, weights[0]);
    };

    return (
        <div ref={rootRef} className="relative w-full">
            <form onSubmit={handleSubmit} className="relative">
                <input
                    type="text"
                    value={query}
                    autoFocus={autoFocus}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    className={inputClassName}
                />
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center" aria-label="Search" style={{ color: "var(--theme-primary)" }}>
                    <FiSearch className="w-5 h-5" />
                </button>
            </form>

            {open && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="p-4 space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
                                        <div className="h-3 w-1/4 bg-gray-100 dark:bg-gray-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <p className="p-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No products match &ldquo;{query}&rdquo;
                        </p>
                    ) : (
                        <>
                            <ul className="py-1.5">
                                {results.map((p) => {
                                    const mw = minPrice(p.weights);
                                    const hasDiscount = mw && mw.discountPercent > 0;
                                    const unit = mw ? mw.price - (mw.price * (mw.discountPercent || 0)) / 100 : 0;
                                    const image = p.cover_image || p.weights?.[0]?.images?.[0];
                                    return (
                                        <li key={p._id}>
                                            <Link
                                                href={`/product/${p._id}`}
                                                onClick={() => { setOpen(false); onNavigate?.(); }}
                                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                                                    {image && <img src={image} alt={p.firstName} className="w-full h-full object-cover" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.firstName}</p>
                                                    {p.category?.category_name && (
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{p.category.category_name}</p>
                                                    )}
                                                </div>
                                                {mw && (
                                                    <div className="flex-shrink-0 text-right">
                                                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{symbol}{unit.toFixed(0)}</span>
                                                        {hasDiscount && <span className="block text-[10px] text-gray-400 line-through">{symbol}{mw.price}</span>}
                                                    </div>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                            <button
                                onClick={goToFullResults}
                                className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: "var(--theme-primary)" }}
                            >
                                See all results for &ldquo;{query}&rdquo; <FiArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
