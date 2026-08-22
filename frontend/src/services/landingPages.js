import { authFetch } from "./api";

const BASE = "/api/admin/landing-page";
const jsonHeaders = { "Content-Type": "application/json" };

const qs = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.append(k, v);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
};

// Campaign landing pages (content:read/content:write). See
// backend/src/routes/landingPage.route.js for the exact contract.
export const listLandingPages = (params) => authFetch(`${BASE}${qs(params)}`).then((r) => r.json());

export const getLandingPage = (id) => authFetch(`${BASE}/${id}`).then((r) => r.json());

export const createLandingPage = (payload) =>
    authFetch(BASE, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const updateLandingPage = (id, payload) =>
    authFetch(`${BASE}/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const deleteLandingPage = (id) =>
    authFetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => (r.status === 204 ? { success: true } : r.json()));
