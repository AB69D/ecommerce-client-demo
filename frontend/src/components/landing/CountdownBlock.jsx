"use client";
import { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

// Ticking hours:minutes:seconds countdown to a fixed `endsAt` ISO datetime.
export default function CountdownBlock({ data }) {
    const { heading, endsAt } = data || {};
    const target = endsAt ? new Date(endsAt).getTime() : NaN;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!Number.isFinite(target)) return undefined;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [target]);

    // Already in the past (or no/invalid endsAt) — don't show a negative or
    // broken countdown, just skip the block entirely.
    if (!Number.isFinite(target) || target <= now) return null;

    const diff = target - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const units = [
        { v: hours, label: "Hours" },
        { v: minutes, label: "Min" },
        { v: seconds, label: "Sec" },
    ];

    return (
        <section className="max-w-lg mx-auto px-4 py-8 text-center">
            {heading && (
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4">{heading}</h3>
            )}
            <div className="inline-flex items-center gap-2 sm:gap-3">
                {units.map((u, i) => (
                    <div key={u.label} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex flex-col items-center bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl px-4 sm:px-5 py-3 shadow-lg shadow-gray-900/20 min-w-[68px] sm:min-w-[80px]">
                            <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">{pad(u.v)}</span>
                            <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mt-0.5">{u.label}</span>
                        </div>
                        {i < units.length - 1 && (
                            <span className="text-2xl font-bold text-gray-300 animate-pulse">:</span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
