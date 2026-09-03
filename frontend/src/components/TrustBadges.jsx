"use client";
import { FiTruck, FiShield, FiRotateCcw, FiHeadphones } from "react-icons/fi";
import Reveal from "./Reveal.jsx";

const ITEMS = [
    { icon: FiTruck, title: "Fast Delivery", sub: "Nationwide shipping" },
    { icon: FiShield, title: "Secure Checkout", sub: "Your data is safe" },
    { icon: FiRotateCcw, title: "Easy Returns", sub: "Hassle-free policy" },
    { icon: FiHeadphones, title: "Real Support", sub: "We reply fast" },
];

// A quiet confidence strip — the four questions a first-time visitor is
// silently asking before they trust a store enough to check out.
export default function TrustBadges() {
    return (
        <div className="w-full px-4 py-6 sm:py-8">
            <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {ITEMS.map(({ icon: Icon, title, sub }, i) => (
                    <Reveal key={title} delay={i * 60}>
                        <div className="h-full flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-gray-100 bg-white px-3 sm:px-4 py-3.5 sm:py-4 shadow-sm">
                            <span
                                className="flex-shrink-0 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl"
                                style={{
                                    background: "color-mix(in srgb, var(--theme-primary) 12%, white)",
                                    color: "var(--theme-primary)",
                                }}
                            >
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[12px] sm:text-sm font-semibold text-gray-900 leading-snug">
                                    {title}
                                </span>
                                <span className="block text-[10.5px] sm:text-xs text-gray-500 leading-snug">{sub}</span>
                            </span>
                        </div>
                    </Reveal>
                ))}
            </div>
        </div>
    );
}
