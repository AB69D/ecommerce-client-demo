import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

// Bumped by the admin panel right after a successful save so the storefront
// picks up the change immediately instead of waiting out the 60s ISR window
// (see lib/dynamicContent.js). Whitelisted so this can only bust the caches
// it's meant to, never an arbitrary tag.
const ALLOWED_PREFIXES = ["site-settings", "footer", "nav-menu", "page:"];

const isAllowed = (tag) =>
    typeof tag === "string" && ALLOWED_PREFIXES.some((p) => tag === p || tag.startsWith(p));

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
    }

    const tags = Array.isArray(body?.tags) ? body.tags : body?.tag ? [body.tag] : [];
    const validTags = tags.filter(isAllowed);

    if (validTags.length === 0) {
        return NextResponse.json({ success: false, message: "No valid tag provided" }, { status: 400 });
    }

    validTags.forEach((tag) => revalidateTag(tag));
    return NextResponse.json({ success: true, revalidated: validTags });
}
