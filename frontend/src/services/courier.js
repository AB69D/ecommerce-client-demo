import { authFetch } from "./api";

const BASE = "/api/admin/courier";
const jsonHeaders = { "Content-Type": "application/json" };

// Steadfast courier booking / status sync (fulfillment:write).
export const bookCourier = (orderId) =>
    authFetch(`${BASE}/order/${orderId}/book-courier`, { method: "POST", headers: jsonHeaders }).then((r) => r.json());

export const syncCourierStatus = (orderId) =>
    authFetch(`${BASE}/order/${orderId}/sync-courier-status`, { method: "POST", headers: jsonHeaders }).then((r) => r.json());
