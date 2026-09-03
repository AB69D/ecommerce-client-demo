"use client";
import { createContext, useContext, useState, useCallback } from "react";

const QuickViewContext = createContext({ product: null, open: () => {}, close: () => {} });

// Lets any product card open the QuickViewModal (mounted once in AppChrome)
// without prop-drilling the modal state through every grid component.
export function QuickViewProvider({ children }) {
    const [product, setProduct] = useState(null);

    const open = useCallback((p) => setProduct(p), []);
    const close = useCallback(() => setProduct(null), []);

    return (
        <QuickViewContext.Provider value={{ product, open, close }}>
            {children}
        </QuickViewContext.Provider>
    );
}

export const useQuickView = () => useContext(QuickViewContext);
