// Client-side helper: call after an admin save succeeds so the storefront's
// cached fetch (see lib/dynamicContent.js) is busted immediately instead of
// waiting out its 60s ISR window.
export const revalidateTags = async (tags) => {
    try {
        await fetch("/api/revalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags }),
        });
    } catch {
        // Best-effort — the 60s ISR window still catches it if this fails.
    }
};
