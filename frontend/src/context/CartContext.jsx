"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCart, updateCartItem, removeFromCart } from "@/utils/cart.js";

const CartContext = createContext({
    cart: null,
    items: [],
    count: 0,
    totalAmount: 0,
    loading: true,
    drawerOpen: false,
    openDrawer: () => {},
    closeDrawer: () => {},
    refresh: async () => {},
    changeQuantity: async () => {},
    removeItem: async () => {},
});

const getGuestId = () => {
    if (typeof window === "undefined") return null;
    let id = localStorage.getItem("guestId");
    if (!id) {
        id = `guest_${Date.now()}`;
        localStorage.setItem("guestId", id);
    }
    return id;
};

// Single source of truth for cart contents, mirroring the CurrencyContext /
// CustomerAuthContext pattern already used elsewhere: fetch on mount, then
// stay in sync via the `cart-updated` window event every other component
// already dispatches after a mutating call.
export function CartProvider({ children }) {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const res = await getCart();
            if (res?.success) setCart(res.data);
        } catch (err) {
            console.error("Failed to refresh cart", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onUpdate = () => refresh();
        window.addEventListener("cart-updated", onUpdate);
        return () => window.removeEventListener("cart-updated", onUpdate);
    }, [refresh]);

    const changeQuantity = useCallback(async (itemId, quantity) => {
        if (quantity < 1) return;
        await updateCartItem(itemId, quantity);
        window.dispatchEvent(new Event("cart-updated"));
    }, []);

    const removeItem = useCallback(async (itemId) => {
        await removeFromCart(itemId);
        window.dispatchEvent(new Event("cart-updated"));
    }, []);

    const items = cart?.items || [];
    const count = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalAmount = cart?.totalAmount || 0;

    return (
        <CartContext.Provider
            value={{
                cart,
                items,
                count,
                totalAmount,
                loading,
                drawerOpen,
                openDrawer: () => setDrawerOpen(true),
                closeDrawer: () => setDrawerOpen(false),
                refresh,
                changeQuantity,
                removeItem,
                guestId: getGuestId(),
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);
