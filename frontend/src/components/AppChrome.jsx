"use client";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar.jsx";
import HeaderTop from "@/components/Header-top.jsx";
import Footer from "@/components/Footer.jsx";
import OrderChatbot from "@/components/OrderChatbot.jsx";

// The admin panel and POS terminal are full-screen apps with their own chrome
// (sidebar, header, etc.) — they must not be wrapped in the storefront's
// navbar/footer/centered container. Without this check, root layout.js used
// to render both on every route, which caused the storefront navbar to
// overlap the admin sidebar, wasted a navbar cart/wishlist fetch on every
// admin/POS page load, and squeezed the full-width admin panel inside the
// storefront's max-w-7xl container (visible as gradient strips on the edges).
const isAppShell = (pathname) =>
    pathname?.startsWith("/admin") || pathname?.startsWith("/pos");

export default function AppChrome({ children }) {
    const pathname = usePathname();

    if (isAppShell(pathname)) {
        return <>{children}</>;
    }

    return (
        <>
            <HeaderTop />
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
            </main>
            <Footer />
            <OrderChatbot />
        </>
    );
}
