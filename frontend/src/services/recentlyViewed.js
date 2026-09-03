// Same convention as services/wishlist.js: localStorage cache + a window
// event so every mounted <RecentlyViewed> stays in sync within the tab.
const LS_KEY = "recentlyViewed";
const EVENT = "recently-viewed-updated";
const MAX_ITEMS = 12;

const read = () => {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch {
        return [];
    }
};

const write = (list) => {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
};

// Call once a product's real detail has loaded (so the snapshot has an
// accurate price/image), not from a card hover — this tracks actual views.
export function recordView(product) {
    if (!product?._id) return;
    const snapshot = {
        _id: product._id,
        firstName: product.firstName,
        cover_image: product.cover_image || product.weights?.[0]?.images?.[0] || "",
        price: product.weights?.[0]?.price || 0,
        discountPercent: product.weights?.[0]?.discountPercent || 0,
        viewedAt: Date.now(),
    };
    const list = read().filter((p) => p._id !== product._id);
    list.unshift(snapshot);
    write(list.slice(0, MAX_ITEMS));
}

export function getRecentlyViewed(excludeId) {
    return read().filter((p) => p._id !== excludeId);
}

export function subscribeRecentlyViewed(callback) {
    const handler = () => callback(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
        window.removeEventListener(EVENT, handler);
        window.removeEventListener("storage", handler);
    };
}
