"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getRecentlyViewed, subscribeRecentlyViewed } from "@/services/recentlyViewed.js";
import Reveal from "./Reveal.jsx";

// A personalization touch most competitor demos skip: "products you looked
// at" tracked purely client-side (localStorage), no account required.
export default function RecentlyViewed({ excludeId, title = "Recently Viewed" }) {
    const [items, setItems] = useState([]);
    const { symbol } = useCurrency();

    useEffect(() => {
        setItems(getRecentlyViewed(excludeId));
        return subscribeRecentlyViewed((list) => setItems(list.filter((p) => p._id !== excludeId)));
    }, [excludeId]);

    if (items.length === 0) return null;

    return (
        <Reveal className="w-full py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">{title}</h3>
                <div className="flex gap-3 sm:gap-4 overflow-x-auto hide-scrollbar pb-1">
                    {items.map((p) => {
                        const unit = (p.price || 0) - (p.price || 0) * ((p.discountPercent || 0) / 100);
                        return (
                            <Link
                                key={p._id}
                                href={`/product/${p._id}`}
                                className="card-hover flex-shrink-0 w-32 sm:w-36 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900"
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    {p.cover_image && (
                                        <img src={p.cover_image} alt={p.firstName} loading="lazy" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="p-2.5">
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.firstName}</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-50 mt-0.5">{symbol}{unit.toFixed(0)}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </Reveal>
    );
}
