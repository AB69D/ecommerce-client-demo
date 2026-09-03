"use client";
import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";

const STORAGE_KEY = "theme";

// The class itself is already applied pre-hydration by the inline script in
// layout.js (avoids a flash of the wrong theme) — this component only needs
// to read that starting state back out and toggle it from then on.
export default function ThemeToggle({ className = "" }) {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        setDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    };

    return (
        <button
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={dark}
            className={className}
        >
            {dark ? <FiSun className="w-5 h-5 sm:w-6 sm:h-6" /> : <FiMoon className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
    );
}
