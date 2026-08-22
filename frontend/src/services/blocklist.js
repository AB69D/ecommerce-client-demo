import { authFetch } from "./api";

const BASE = "/api/admin/blocklist";
const jsonHeaders = { "Content-Type": "application/json" };

const qs = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.append(k, v);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
};

// Phones (blocklist:read/write).
export const listBlockedPhones = (params) => authFetch(`${BASE}/phones${qs(params)}`).then((r) => r.json());

export const createBlockedPhone = (payload) =>
    authFetch(`${BASE}/phones`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const deleteBlockedPhone = (id) =>
    authFetch(`${BASE}/phones/${id}`, { method: "DELETE" }).then((r) => (r.status === 204 ? { success: true } : r.json()));

// IPs (blocklist:read/write).
export const listBlockedIps = (params) => authFetch(`${BASE}/ips${qs(params)}`).then((r) => r.json());

export const createBlockedIp = (payload) =>
    authFetch(`${BASE}/ips`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const deleteBlockedIp = (id) =>
    authFetch(`${BASE}/ips/${id}`, { method: "DELETE" }).then((r) => (r.status === 204 ? { success: true } : r.json()));
