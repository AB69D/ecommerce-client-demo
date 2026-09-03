"use client";
import { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";

// Illustrative urgency signals, NOT wired to real view-tracking or sales
// analytics (no such infrastructure exists in the backend today — the
// low-stock badge next to this on the product page IS real, sourced from
// actual stock). Seeded by product id + the current day so the number is
// stable across a single visit/day instead of jittering on every render,
// but it is still a simulated figure. Swap for a real endpoint (e.g. an
// aggregate of recent order line-items per product) before relying on this
// commercially — see the honesty note in the sales dossier about this
// pattern before shipping it to a real client unlabelled.
function seededRange(seed, min, max) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return min + (h % (max - min + 1));
}

export default function SocialProof({ productId, className = "" }) {
    const [viewers, setViewers] = useState(null);

    useEffect(() => {
        if (!productId) return;
        const day = new Date().toISOString().slice(0, 10);
        const base = seededRange(`${productId}-${day}`, 3, 14);
        setViewers(base);
        // A small live-feeling drift every ~20s, bounded so it never reads
        // as obviously fake or drifts into an implausible range.
        const interval = setInterval(() => {
            setViewers((v) => {
                const delta = Math.random() > 0.5 ? 1 : -1;
                return Math.min(19, Math.max(2, (v ?? base) + delta));
            });
        }, 21000);
        return () => clearInterval(interval);
    }, [productId]);

    if (viewers === null) return null;

    return (
        <div className={`flex items-center gap-3 flex-wrap ${className}`}>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                <FiEye className="w-3.5 h-3.5" />
                {viewers} people viewing this now
            </span>
        </div>
    );
}
