"use client";
import { useEffect, useRef, useState } from "react";

// Fades + lifts children into place the first time they scroll into view.
// IntersectionObserver only — no animation library, mirrors the project's
// existing dependency-free approach (fade-in-stagger, hand-rolled charts).
export default function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        // Already-visible-on-load sections shouldn't wait for a scroll event.
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92) {
            setVisible(true);
            return undefined;
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                // Reveal on intersection, or if a large/instant scroll jump
                // (fast flick, "scroll to" navigation) carried the element
                // past the viewport before it ever intersected — better to
                // show it than leave it permanently stuck at opacity 0.
                const passedAbove = entry.boundingClientRect.bottom < 0;
                if (entry.isIntersecting || passedAbove) {
                    setVisible(true);
                    io.disconnect();
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <Tag
            ref={ref}
            className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            } ${className}`}
            style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
        >
            {children}
        </Tag>
    );
}
