import { notFound } from "next/navigation";
import registry from "@/components/landing/registry.js";
import { SITE_URL, absoluteUrl } from "@/lib/seo.js";

// Single-product ad-campaign landing pages built from admin-authored blocks.
// Follows the same fetch pattern as product/[id]/page.jsx: resolve the
// backend base URL from NEXT_PUBLIC_BACKEND_URL, revalidate every 60s, and
// tag the fetch so the admin save flow can invalidate this page's ISR cache.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Shared per-request fetch — generateMetadata() and the page component both
// call this; Next dedupes identical GET fetches within a render.
async function getLandingPage(slug) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/landing-page/${slug}`, {
            next: { revalidate: 60, tags: [`landing:${slug}`] },
        });
        const json = await res.json();
        // A 404 (unknown slug, or an existing-but-unpublished one) comes back
        // as `{success:false, message:"Landing page not found"}` — treat any
        // non-success response as "doesn't exist" so the caller 404s.
        return json?.success ? json.data : null;
    } catch {
        return null;
    }
}

async function getSettings() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/client/site-settings`, { next: { revalidate: 60 } });
        const json = await res.json();
        return json?.data || {};
    } catch {
        return {};
    }
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const page = await getLandingPage(slug);
    if (!page) {
        return { title: "Landing Page" };
    }

    const heroBlock = (page.blocks || []).find((b) => b?.type === "hero");
    const title = page.seoTitle || heroBlock?.data?.headline || page.title;
    const description = page.seoDescription || undefined;
    const imageSrc = page.ogImage || heroBlock?.data?.imageUrl;
    const image = imageSrc ? absoluteUrl(imageSrc) : undefined;

    return {
        title,
        description,
        alternates: { canonical: `/lp/${slug}` },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/lp/${slug}`,
            images: image ? [{ url: image, width: 800, height: 600, alt: title }] : undefined,
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: image ? [image] : undefined,
        },
    };
}

export default async function LandingPage({ params }) {
    const { slug } = await params;
    const [page, settings] = await Promise.all([getLandingPage(slug), getSettings()]);

    if (!page) notFound();

    const currencySymbol = settings?.currencySymbol || "৳";
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const hasStickyBar = blocks.some((b) => b?.type === "stickyOrderBar");

    return (
        <div className={`w-full ${hasStickyBar ? "pb-20 lg:pb-0" : ""}`}>
            {blocks.map((block) => {
                // Unknown/malformed block types are silently skipped — one bad
                // block (a stale type from a future admin change, corrupt data)
                // never takes down the whole page.
                const Component = registry[block?.type];
                if (!Component) return null;
                return <Component key={block._id} data={block.data} currencySymbol={currencySymbol} />;
            })}
        </div>
    );
}
