"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FiX, FiShoppingCart, FiCheck, FiArrowRight } from "react-icons/fi";
import { useQuickView } from "@/context/QuickViewContext.jsx";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { addToCart } from "@/utils/cart.js";
import { trackAddToCart } from "@/lib/tracking";

// A centered modal that fetches full product detail on open, so a shopper
// can compare a size, see the price, and add to cart without ever leaving
// the grid they were browsing. Mounted once in AppChrome; any "Quick View"
// button calls useQuickView().open(product) to trigger it.
export default function QuickViewModal() {
    const { product: summary, close } = useQuickView();
    const { symbol } = useCurrency();
    const [full, setFull] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedWeight, setSelectedWeight] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        if (!summary?._id) {
            setFull(null);
            return undefined;
        }
        setLoading(true);
        setSelectedWeight(0);
        setQuantity(1);
        setAdded(false);
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/client/product/product/${summary._id}`);
                const data = await res.json();
                if (!cancelled && data.success) setFull(data.data);
            } catch (err) {
                console.error("Quick view fetch failed", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [summary?._id]);

    useEffect(() => {
        if (!summary) return undefined;
        const onKey = (e) => e.key === "Escape" && close();
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [summary, close]);

    if (!summary) return null;

    const product = full || summary;
    const currentWeight = product.weights?.[selectedWeight];
    const image = currentWeight?.images?.[0] || product.cover_image || (product.weights?.[0]?.images?.[0]);
    const hasDiscount = currentWeight?.discountPercent > 0;
    const unitPrice = currentWeight ? currentWeight.price - (currentWeight.price * (currentWeight.discountPercent || 0) / 100) : 0;

    const handleAdd = async () => {
        if (!currentWeight) return;
        setAdding(true);
        try {
            await addToCart(product._id, quantity, currentWeight.weight, selectedWeight, currentWeight.price, currentWeight.discountPercent || 0);
            trackAddToCart({ productId: product._id, name: product.firstName, price: unitPrice, quantity, currency: undefined });
            window.dispatchEvent(new Event("cart-updated"));
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
        } catch (err) {
            console.error("Quick add to cart failed", err);
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fade-in_.2s_ease-out]"
                onClick={close}
                aria-hidden="true"
            />
            <div className="relative w-full sm:max-w-2xl sm:mx-4 bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-[fade-in_.25s_ease-out]">
                <button
                    onClick={close}
                    aria-label="Close quick view"
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
                >
                    <FiX className="w-5 h-5" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 sm:rounded-l-3xl overflow-hidden relative">
                        {image ? (
                            <img src={image} alt={product.firstName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                        {hasDiscount && (
                            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                -{currentWeight.discountPercent}%
                            </span>
                        )}
                    </div>

                    <div className="p-5 sm:p-6">
                        {product.category && (
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--theme-accent)" }}>
                                {product.category.category_name}
                            </p>
                        )}
                        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">{product.firstName}</h2>
                        {product.lastName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.lastName}</p>}

                        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                            {hasDiscount ? (
                                <>
                                    <span className="text-2xl font-extrabold" style={{ color: "var(--theme-primary)" }}>{symbol}{unitPrice.toFixed(0)}</span>
                                    <span className="text-base text-gray-400 dark:text-gray-500 line-through">{symbol}{currentWeight.price}</span>
                                </>
                            ) : (
                                <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{symbol}{currentWeight?.price || 0}</span>
                            )}
                        </div>

                        {loading && !full && (
                            <div className="mt-4 h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        )}

                        {product.weights?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Size / Weight</p>
                                <div className="flex flex-wrap gap-2">
                                    {product.weights.map((w, i) => {
                                        const out = !w.stock || w.stock < 1;
                                        const sel = selectedWeight === i;
                                        return (
                                            <button
                                                key={i}
                                                disabled={out}
                                                onClick={() => { setSelectedWeight(i); setQuantity(1); }}
                                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                                    out
                                                        ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 line-through cursor-not-allowed"
                                                        : sel
                                                        ? "text-white shadow-sm"
                                                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                                                }`}
                                                style={sel && !out ? { background: "var(--theme-primary)", borderColor: "var(--theme-primary)" } : undefined}
                                            >
                                                {w.weight} · {symbol}{w.price}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Qty</span>
                            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">−</button>
                                <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{quantity}</span>
                                <button onClick={() => setQuantity((q) => Math.min(currentWeight?.stock || 10, q + 1))} className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">+</button>
                            </div>
                        </div>

                        <button
                            onClick={handleAdd}
                            disabled={adding || !currentWeight?.stock}
                            className="mt-5 w-full text-white font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: added ? "#059669" : "var(--theme-primary)" }}
                        >
                            {adding ? "Adding..." : added ? <><FiCheck className="w-4 h-4" /> Added to cart</> : <><FiShoppingCart className="w-4 h-4" /> {currentWeight?.stock > 0 ? "Add to Cart" : "Out of Stock"}</>}
                        </button>

                        <Link
                            href={`/product/${product._id}`}
                            onClick={close}
                            className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                            View full details <FiArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
