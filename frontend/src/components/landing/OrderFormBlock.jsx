"use client";
import { useRef, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";

// Same delivery-area list/charges checkout/page.jsx hardcodes, used whenever
// the admin didn't configure `deliveryAreas` on this block.
const DEFAULT_DELIVERY_AREAS = [
    { key: "local", label: "Local Delivery", charge: 70 },
    { key: "regional", label: "Regional", charge: 100 },
];

// Same guestId convention as checkout/page.jsx's getGuestId() (and the
// underlying convention in utils/cart.js): read localStorage, mint
// `guest_${Date.now()}` and persist it back if absent.
const getGuestId = () => {
    if (typeof window === "undefined") return null;
    let guestId = localStorage.getItem("guestId");
    if (!guestId) {
        guestId = `guest_${Date.now()}`;
        localStorage.setItem("guestId", guestId);
    }
    return guestId;
};

// Compressed single-product version of checkout/page.jsx's flow: add the one
// product to the cart, then create the order through the exact same
// cart/add + order/create endpoints the main store checkout uses. This is
// what lets every fraud-prevention check already wired into order/create
// (IP/phone blocklist, fake-order scoring, courier-ratio check) cover
// landing-page orders automatically, with no separate/simplified path.
export default function OrderFormBlock({ data }) {
    const {
        heading = "Order Now",
        productId,
        productName = "",
        price = 0,
        weightIndex = 0,
        deliveryAreas,
    } = data || {};

    const areas = Array.isArray(deliveryAreas) && deliveryAreas.length ? deliveryAreas : DEFAULT_DELIVERY_AREAS;
    const { symbol } = useCurrency();

    const [form, setForm] = useState({
        customerName: "",
        customerPhone: "",
        shippingAddress: "",
        deliveryArea: areas[0]?.key || "local",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [orderData, setOrderData] = useState(null);

    // Generated once and reused across a retried/double-tapped submit (same
    // pattern as checkout/page.jsx's idempotencyKeyRef) so a network retry
    // can't create a duplicate order — the server returns the original instead.
    const idempotencyKeyRef = useRef(null);

    const handleChange = (e) => {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    };

    const selectedArea = areas.find((a) => a.key === form.deliveryArea) || areas[0];
    const charge = selectedArea?.charge ?? 0;
    const total = Number(price || 0) + Number(charge || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!productId) {
            setError("This offer isn't available right now.");
            return;
        }
        setSubmitting(true);
        setError("");

        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current =
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        }

        try {
            const guestId = getGuestId();

            // (a) Add the single product to the cart — same endpoint/body shape
            // the main storefront's add-to-cart flow uses.
            const addRes = await fetch(`/api/client/cart/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "guest-id": guestId },
                body: JSON.stringify({ productId, quantity: 1, weightIndex }),
            });
            const addData = await addRes.json();
            if (!addRes.ok || !addData.success) {
                setError(addData.message || "Could not add this product to your cart.");
                setSubmitting(false);
                return;
            }

            // (b) Create the order — cash-on-delivery only for v1 (no online
            // payment option here; scope cut, see landing-page work notes).
            const headers = {
                "Content-Type": "application/json",
                "guest-id": guestId,
                "idempotency-key": idempotencyKeyRef.current,
            };
            const token = typeof window !== "undefined" ? localStorage.getItem("customer_token") : null;
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const orderRes = await fetch(`/api/client/order/create`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    customerName: form.customerName,
                    customerPhone: form.customerPhone,
                    shippingAddress: form.shippingAddress,
                    deliveryArea: form.deliveryArea,
                    paymentMethod: "cash_on_delivery",
                    notes: "",
                    couponCode: "",
                }),
            });
            const orderJson = await orderRes.json();
            if (!orderRes.ok || !orderJson.success) {
                // Includes blocklist/fraud-check rejections — the backend's
                // `message` is shown to the shopper as-is, inline, no alert().
                setError(orderJson.message || "Failed to place order. Please try again.");
                setSubmitting(false);
                return;
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cart-updated"));
            }
            setOrderData(orderJson.data);
        } catch (err) {
            setError("Failed to place order. Please check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // (c) Success: replace the form in place, don't navigate away — the whole
    // point of a landing page is not losing the visitor.
    if (orderData) {
        return (
            <div id="order-form" className="max-w-xl mx-auto px-4 py-10">
                <div className="bg-white border border-emerald-100 rounded-3xl shadow-xl shadow-emerald-900/5 p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/25">
                        <FiCheck className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Order placed!</h3>
                    <p className="text-gray-600">
                        Your order ID is{" "}
                        <span className="font-mono font-semibold text-emerald-700">{orderData.orderId}</span>, we&apos;ll
                        call you to confirm.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div id="order-form" className="max-w-xl mx-auto px-4 py-10">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-900/5 p-5 sm:p-8">
                {heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{heading}</h2>}
                {productName && <p className="text-gray-500 mb-5">{productName}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <input
                            type="text"
                            name="customerName"
                            value={form.customerName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                            placeholder="Your full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                        <input
                            type="tel"
                            name="customerPhone"
                            value={form.customerPhone}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                            placeholder="01XXXXXXXXX"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Area</label>
                        <select
                            name="deliveryArea"
                            value={form.deliveryArea}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                        >
                            {areas.map((a) => (
                                <option key={a.key} value={a.key}>
                                    {a.label} ({symbol}
                                    {a.charge})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                        <textarea
                            name="shippingAddress"
                            value={form.shippingAddress}
                            onChange={handleChange}
                            required
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                            placeholder="Full delivery address"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {submitting ? "Placing Order..." : `Order Now — ${symbol}${total}`}
                    </button>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                        <FiCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Cash on Delivery — pay when it arrives
                    </div>
                </form>
            </div>
        </div>
    );
}
