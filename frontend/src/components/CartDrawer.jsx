"use client";
import { useEffect } from "react";
import Link from "next/link";
import { FiX, FiShoppingBag, FiTrash2, FiTruck } from "react-icons/fi";
import { useCart } from "@/context/CartContext.jsx";
import { useCurrency } from "@/context/CurrencyContext.jsx";

// Demo/display-only nudge — not wired to the real per-area delivery charge
// calculated at checkout (clientOrder.route.js). Shows the pattern; hook it
// up to a real site-settings threshold before relying on it commercially.
const FREE_DELIVERY_THRESHOLD = 999;

export default function CartDrawer() {
    const { items, count, totalAmount, drawerOpen, closeDrawer, changeQuantity, removeItem, loading } = useCart();
    const { symbol } = useCurrency();

    useEffect(() => {
        if (!drawerOpen) return undefined;
        const onKey = (e) => e.key === "Escape" && closeDrawer();
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [drawerOpen, closeDrawer]);

    const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - totalAmount);
    const progressPct = Math.min(100, (totalAmount / FREE_DELIVERY_THRESHOLD) * 100);

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-[1px] z-[70] transition-opacity duration-300 ${
                    drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={closeDrawer}
                aria-hidden="true"
            />
            <aside
                className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-gray-900 z-[80] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                    drawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
                role="dialog"
                aria-label="Shopping cart"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                        <FiShoppingBag className="w-5 h-5" style={{ color: "var(--theme-primary)" }} />
                        Your Cart {count > 0 && <span className="text-gray-400 dark:text-gray-500 font-medium">({count})</span>}
                    </h2>
                    <button onClick={closeDrawer} aria-label="Close cart" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {totalAmount > 0 && (
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                        {remaining > 0 ? (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                Add <b style={{ color: "var(--theme-primary)" }}>{symbol}{remaining.toFixed(0)}</b> more for free delivery
                            </p>
                        ) : (
                            <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--theme-primary)" }}>
                                <FiTruck className="w-3.5 h-3.5" /> You've unlocked free delivery
                            </p>
                        )}
                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--theme-primary), var(--theme-accent))" }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
                                        <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <FiShoppingBag className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Your cart is empty</p>
                            <button
                                onClick={closeDrawer}
                                className="mt-4 text-sm font-medium"
                                style={{ color: "var(--theme-primary)" }}
                            >
                                Continue shopping
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {items.map((item) => {
                                const unit = (item.price || 0) * (1 - (item.discountPercent || 0) / 100);
                                return (
                                    <li key={item._id} className="flex gap-3">
                                        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                                            {item.productImage ? (
                                                <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                                            {item.weight && <p className="text-xs text-gray-500 dark:text-gray-400">{item.weight}</p>}
                                            <div className="flex items-center justify-between mt-1.5">
                                                <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                    <button
                                                        onClick={() => changeQuantity(item._id, item.quantity - 1)}
                                                        disabled={item.quantity <= 1}
                                                        className="w-6 h-6 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="w-6 text-center text-xs font-semibold text-gray-900 dark:text-gray-100">{item.quantity}</span>
                                                    <button
                                                        onClick={() => changeQuantity(item._id, item.quantity + 1)}
                                                        className="w-6 h-6 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{symbol}{(unit * item.quantity).toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeItem(item._id)}
                                            aria-label="Remove item"
                                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 self-start mt-0.5"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                            <span className="text-lg font-extrabold text-gray-900 dark:text-gray-50">{symbol}{totalAmount.toFixed(0)}</span>
                        </div>
                        <Link
                            href="/checkout"
                            onClick={closeDrawer}
                            className="block w-full text-center text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98]"
                            style={{ background: "var(--theme-primary)" }}
                        >
                            Checkout
                        </Link>
                        <Link
                            href="/cart"
                            onClick={closeDrawer}
                            className="block w-full text-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-2.5"
                        >
                            View full cart
                        </Link>
                    </div>
                )}
            </aside>
        </>
    );
}
