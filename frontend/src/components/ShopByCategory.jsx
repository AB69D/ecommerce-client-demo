"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Reveal from "./Reveal.jsx";

// A tap-friendly horizontal rail of category chips — the pattern shoppers
// already know from Daraz/Shopee/Instagram — so browsing by category on a
// phone is one thumb-swipe away instead of buried in the nav drawer.
export default function ShopByCategory() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/client/category/get-all-category`);
                const data = await res.json();
                if (data.success) setCategories(data.data || []);
            } catch (err) {
                console.error("Failed to fetch categories", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toHref = (name) => `/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`;

    if (!loading && categories.length === 0) return null;

    return (
        <div className="w-full py-6 sm:py-8 px-4">
            <Reveal className="max-w-7xl mx-auto flex flex-col items-center text-center mb-5 sm:mb-6">
                <span
                    className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em]"
                    style={{ color: "var(--theme-accent)" }}
                >
                    Browse
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    Shop by Category
                </h2>
                <span
                    className="mt-2 h-1 w-14 rounded-full"
                    style={{ background: "linear-gradient(to right, var(--theme-primary), var(--theme-accent))" }}
                />
            </Reveal>

            <div className="max-w-7xl mx-auto">
                <div className="flex gap-4 sm:gap-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory scroll-px-4 px-1 py-1">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 snap-start">
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100 animate-pulse" />
                                  <div className="w-14 h-3 rounded bg-gray-100 animate-pulse" />
                              </div>
                          ))
                        : categories.map((cat, i) => (
                              <Reveal key={cat._id} delay={i * 40} className="flex-shrink-0 snap-start">
                                  <Link
                                      href={toHref(cat.category_name)}
                                      className="group flex flex-col items-center gap-2 w-20 sm:w-24 active:scale-95 transition-transform"
                                  >
                                      <span
                                          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105"
                                          style={{ background: "linear-gradient(135deg, var(--theme-primary), var(--theme-accent))" }}
                                      >
                                          <span className="block w-full h-full rounded-full bg-white p-[3px]">
                                              <span className="block w-full h-full rounded-full overflow-hidden bg-gray-100 shadow-sm">
                                                  {cat.category_image ? (
                                                      <img
                                                          src={cat.category_image}
                                                          alt={cat.category_name}
                                                          loading="lazy"
                                                          decoding="async"
                                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                      />
                                                  ) : (
                                                      <span
                                                          className="flex w-full h-full items-center justify-center text-lg font-bold"
                                                          style={{ color: "var(--theme-primary)" }}
                                                      >
                                                          {cat.category_name?.[0]?.toUpperCase()}
                                                      </span>
                                                  )}
                                              </span>
                                          </span>
                                      </span>
                                      <span className="text-xs sm:text-sm font-medium text-gray-700 text-center leading-tight line-clamp-2">
                                          {cat.category_name}
                                      </span>
                                  </Link>
                              </Reveal>
                          ))}
                </div>
            </div>
        </div>
    );
}
