"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    FiShoppingCart,
    FiCheck,
    FiHelpCircle,
    FiMessageCircle,
    FiPhoneCall,
    FiPackage,
    FiArrowLeft,
    FiMinus,
    FiPlus,
    FiTruck,
    FiShield,
    FiRotateCcw,
    FiChevronLeft,
    FiChevronRight,
} from "react-icons/fi";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { addToCart } from "@/utils/cart";
import { trackViewContent, trackAddToCart } from "@/lib/tracking";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductReviews from "@/components/ProductReviews.jsx";
import WishlistButton from "@/components/WishlistButton.jsx";
import Reveal from "@/components/Reveal.jsx";
import { useWhatsApp } from "@/hooks/useWhatsApp";

const MINI_TRUST = [
    { icon: FiTruck, label: "Fast delivery" },
    { icon: FiShield, label: "Secure checkout" },
    { icon: FiRotateCcw, label: "Easy returns" },
];

export default function ProductClient({ productId }) {
    const wa = useWhatsApp();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedWeight, setSelectedWeight] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const [qaExpanded, setQaExpanded] = useState({});
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [relatedLoading, setRelatedLoading] = useState(false);
    const [showStickyBar, setShowStickyBar] = useState(false);
    const { symbol, code } = useCurrency();
    const router = useRouter();
    const productRef = useRef(null);
    const galleryRef = useRef(null);
    const ctaRef = useRef(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                if (!productId) return;

                const res = await fetch(`/api/client/product/product/${productId}`);
                const data = await res.json();

                if (data.success) {
                    setProduct(data.data);
                    if (productRef.current) {
                        productRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    if (data.data.category?._id) {
                        fetchRelatedProducts(data.data.category._id, productId);
                    }
                } else {
                    setError(data.message);
                }
            } catch (err) {
                setError("Failed to fetch product");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

    const fetchRelatedProducts = async (categoryId, currentProductId) => {
        setRelatedLoading(true);
        try {
            const res = await fetch(`/api/client/product/products?category=${categoryId}&limit=8`);
            const data = await res.json();
            if (data.success) {
                const filtered = data.data.filter(p => p._id !== currentProductId).slice(0, 4);
                setRelatedProducts(filtered);
            }
        } catch (err) {
            console.error("Failed to fetch related products", err);
        } finally {
            setRelatedLoading(false);
        }
    };

        if (productId) {
            fetchProduct();
        }
    }, [productId]);

    // Fire the Meta Pixel "ViewContent" event once the product has loaded
    // (browser + server-side via the shared tracking helper).
    useEffect(() => {
        if (product?._id) {
            trackViewContent(product, { currency: code, price: product.weights?.[0]?.price });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?._id]);

    // Sticky mobile "Add to cart" bar: appears once the real CTA scrolls out
    // of view, so the buy action is always one thumb-tap away on a phone.
    useEffect(() => {
        const el = ctaRef.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting), {
            threshold: 0,
            rootMargin: "0px 0px -10% 0px",
        });
        io.observe(el);
        return () => io.disconnect();
    }, [product]);

    const handleAddToCart = async () => {
        if (!product || !product.weights[selectedWeight]) return;

        setAdding(true);
        try {
            const guestId = (() => {
                let id = localStorage.getItem('guestId');
                if (!id) {
                    id = `guest_${Date.now()}`;
                    localStorage.setItem('guestId', id);
                }
                return id;
            })();

            const res = await fetch(`/api/client/cart/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'guest-id': guestId
                },
                body: JSON.stringify({
                    productId: product._id,
                    productName: product.firstName,
                    productImage: product.cover_image,
                    quantity: quantity,
                    weight: product.weights[selectedWeight].weight,
                    weightIndex: selectedWeight,
                    price: product.weights[selectedWeight].price,
                    discountPercent: product.weights[selectedWeight].discountPercent || 0
                })
            });
            const data = await res.json();

            if (data.success) {
                const w = product.weights[selectedWeight];
                const effPrice = (w.price || 0) * (1 - (w.discountPercent || 0) / 100);
                trackAddToCart({ productId: product._id, name: product.firstName, price: effPrice, quantity, currency: code });
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
                window.dispatchEvent(new Event('cart-updated'));
            } else {
                alert(data.message || 'Failed to add to cart');
            }
        } catch (err) {
            alert('Failed to add to cart');
        } finally {
            setAdding(false);
        }
    };

    const handleCashOnDelivery = async () => {
        if (!product || !product.weights[selectedWeight]) return;

        const currentWeight = product.weights[selectedWeight];
        if (!currentWeight?.stock || currentWeight.stock < 1) {
            alert('This size is out of stock');
            return;
        }

        setAdding(true);
        try {
            const guestId = (() => {
                let id = localStorage.getItem('guestId');
                if (!id) {
                    id = `guest_${Date.now()}`;
                    localStorage.setItem('guestId', id);
                }
                return id;
            })();

            const res = await fetch(`/api/client/cart/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'guest-id': guestId
                },
                body: JSON.stringify({
                    productId: product._id,
                    productName: product.firstName,
                    productImage: product.cover_image,
                    quantity: quantity,
                    weight: currentWeight.weight,
                    weightIndex: selectedWeight,
                    price: currentWeight.price,
                    discountPercent: currentWeight.discountPercent || 0
                })
            });
            const data = await res.json();

            if (data.success) {
                const effPrice = (currentWeight.price || 0) * (1 - (currentWeight.discountPercent || 0) / 100);
                trackAddToCart({ productId: product._id, name: product.firstName, price: effPrice, quantity, currency: code });
                window.dispatchEvent(new Event('cart-updated'));
                router.push('/checkout');
            } else {
                alert(data.message || 'Failed to proceed');
            }
        } catch (err) {
            alert('Failed to proceed');
        } finally {
            setAdding(false);
        }
    };

    const goToCart = () => {
        router.push('/cart');
    };

    const toggleQA = (index) => {
        setQaExpanded(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Swipe-to-browse on the main gallery image (touch only — desktop uses
    // the thumbnail rail). A pure horizontal-distance check keeps vertical
    // page scrolling untouched.
    const touchStartX = useRef(null);
    const handleGalleryTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleGalleryTouchEnd = (e, imagesLength) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) return;
        setSelectedImage((prev) => {
            if (dx < 0) return Math.min(prev + 1, imagesLength - 1);
            return Math.max(prev - 1, 0);
        });
    };

    if (loading) {
        return (
            <div className="w-full py-6 sm:py-8 px-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 animate-pulse">
                    <div className="aspect-square bg-gray-100 rounded-2xl sm:rounded-3xl" />
                    <div className="space-y-4">
                        <div className="h-4 w-24 bg-gray-100 rounded" />
                        <div className="h-8 w-3/4 bg-gray-100 rounded" />
                        <div className="h-10 w-40 bg-gray-100 rounded" />
                        <div className="h-12 w-full bg-gray-100 rounded-xl" />
                        <div className="h-12 w-full bg-gray-100 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="w-full min-h-[70vh] flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                        <FiPackage className="h-9 w-9 text-emerald-600" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                        Product not available
                    </h1>
                    <p className="mt-2 text-sm sm:text-base text-gray-500">
                        This product may have been removed or is no longer sold online.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                            <FiArrowLeft className="h-4 w-4" />
                            Continue shopping
                        </Link>
                        <Link
                            href="/search"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            Browse products
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const currentWeight = product.weights?.[selectedWeight];
    const allImages = currentWeight?.images?.length > 0
        ? currentWeight.images
        : (product.cover_image ? [product.cover_image] : []);
    const hasDiscount = currentWeight?.discountPercent > 0;
    const unitPrice = currentWeight ? currentWeight.price - (currentWeight.price * (currentWeight.discountPercent || 0) / 100) : 0;
    const lowStock = currentWeight?.stock > 0 && currentWeight.stock <= 5;

    return (
        <div ref={productRef} className="w-full py-4 sm:py-8 px-4 max-w-7xl mx-auto pb-28 lg:pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
                {/* ---------------- Gallery ---------------- */}
                <div className="order-1">
                    <div
                        ref={galleryRef}
                        onTouchStart={handleGalleryTouchStart}
                        onTouchEnd={(e) => handleGalleryTouchEnd(e, allImages.length)}
                        className="relative aspect-square bg-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden mb-3 sm:mb-4 shadow-sm ring-1 ring-black/5 group"
                    >
                        {allImages.length > 0 ? (
                            <img
                                key={selectedImage}
                                src={allImages[selectedImage]}
                                alt={product.firstName}
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                className="w-full h-full object-cover fade-in sm:transition-transform sm:duration-500 sm:group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                No Image
                            </div>
                        )}

                        {hasDiscount && (
                            <span className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-red-500 text-white text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full shadow-sm">
                                -{currentWeight.discountPercent}%
                            </span>
                        )}

                        {allImages.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setSelectedImage((p) => Math.max(0, p - 1))}
                                    disabled={selectedImage === 0}
                                    className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity"
                                    aria-label="Previous image"
                                >
                                    <FiChevronLeft className="w-5 h-5 text-gray-700" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedImage((p) => Math.min(allImages.length - 1, p + 1))}
                                    disabled={selectedImage === allImages.length - 1}
                                    className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity"
                                    aria-label="Next image"
                                >
                                    <FiChevronRight className="w-5 h-5 text-gray-700" />
                                </button>

                                {/* Swipe dots — mobile only, mirrors the hero slider's language */}
                                <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/25 backdrop-blur-sm">
                                    {allImages.map((_, i) => (
                                        <span
                                            key={i}
                                            className="rounded-full transition-all duration-300"
                                            style={
                                                i === selectedImage
                                                    ? { width: "1.25rem", height: "0.4rem", backgroundColor: "var(--theme-accent)" }
                                                    : { width: "0.4rem", height: "0.4rem", backgroundColor: "rgba(255,255,255,0.75)" }
                                            }
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {allImages.length > 1 && (
                        <div className="hidden sm:flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(index)}
                                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                                        selectedImage === index ? 'border-emerald-600 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300'
                                    }`}
                                >
                                    <img
                                        src={img}
                                        alt={`${product.firstName} ${index + 1}`}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ---------------- Details ---------------- */}
                <div className="order-2">
                    {product.category && (
                        <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--theme-accent)" }}>
                            {product.category.category_name}
                        </p>
                    )}

                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">
                        {product.firstName}
                    </h1>
                    {product.lastName && (
                        <p className="text-base sm:text-lg text-gray-500 mt-1.5">
                            {product.lastName}
                        </p>
                    )}

                    {/* Price */}
                    <div className="mt-4 sm:mt-5 flex items-center gap-3 flex-wrap">
                        {hasDiscount ? (
                            <>
                                <p key={`d-${selectedWeight}`} className="fade-in text-3xl sm:text-4xl font-extrabold" style={{ color: "var(--theme-primary)" }}>
                                    {symbol}{unitPrice.toFixed(0)}
                                </p>
                                <p className="text-lg sm:text-xl text-gray-400 line-through">
                                    {symbol}{currentWeight?.price}
                                </p>
                                <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                                    Save {symbol}{(currentWeight.price - unitPrice).toFixed(0)}
                                </span>
                            </>
                        ) : (
                            <p key={`p-${selectedWeight}`} className="fade-in text-3xl sm:text-4xl font-extrabold text-gray-900">
                                {symbol}{currentWeight?.price || 0}
                            </p>
                        )}
                    </div>

                    <div className="mt-2">
                        {currentWeight?.stock > 0 ? (
                            lowStock ? (
                                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-soft-pulse" />
                                    Only {currentWeight.stock} left — order soon
                                </p>
                            ) : (
                                <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                                    <FiCheck className="w-4 h-4" /> In stock
                                </p>
                            )
                        ) : (
                            <p className="text-sm text-red-500">Out of stock</p>
                        )}
                    </div>

                    {/* Variant selector */}
                    {product.weights && product.weights.length > 0 && (
                        <div className="mt-6 sm:mt-7">
                            <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                                Size / Weight
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {product.weights.map((weight, index) => {
                                    const isSelected = selectedWeight === index;
                                    const isOut = !weight.stock || weight.stock < 1;
                                    return (
                                        <button
                                            key={index}
                                            disabled={isOut}
                                            onClick={() => {
                                                setSelectedWeight(index);
                                                setSelectedImage(0);
                                                setQuantity(1);
                                            }}
                                            className={`relative px-4 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                                                isOut
                                                    ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                                    : isSelected
                                                    ? 'text-white shadow-md scale-[1.03]'
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                            style={isSelected && !isOut ? { background: "var(--theme-primary)", borderColor: "var(--theme-primary)" } : undefined}
                                        >
                                            {weight.weight} · {symbol}{weight.price}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Quantity */}
                    <div className="mt-5 sm:mt-6 flex items-center gap-4">
                        <span className="text-sm font-semibold text-gray-800">Quantity</span>
                        <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600"
                                aria-label="Decrease quantity"
                            >
                                <FiMinus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center text-sm font-bold text-gray-900 tabular-nums">
                                {quantity}
                            </span>
                            <button
                                onClick={() => setQuantity(Math.min(currentWeight?.stock || 10, quantity + 1))}
                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600"
                                aria-label="Increase quantity"
                            >
                                <FiPlus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Primary actions */}
                    <div ref={ctaRef} className="mt-6 sm:mt-8 flex flex-col gap-3">
                         <div className="flex gap-3">
                             <button
                                 onClick={added ? goToCart : handleAddToCart}
                                 disabled={adding || !currentWeight?.stock}
                                 className="flex-1 min-w-0 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
                                 style={{ background: added ? "#059669" : "var(--theme-primary)" }}
                             >
                                 {adding ? 'Adding...' : added ? <><FiCheck className="w-5 h-5" /> Added</> : <><FiShoppingCart className="w-4 h-4" /> {currentWeight?.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</>}
                             </button>
                             <button
                                 onClick={handleCashOnDelivery}
                                 disabled={adding || !currentWeight?.stock}
                                 className="flex-1 min-w-0 font-semibold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] border-2"
                                 style={{ borderColor: "var(--theme-primary)", color: "var(--theme-primary)" }}
                             >
                                 Cash on Delivery
                             </button>
                         </div>
                         {wa.enabled && (
                             <a
                                 href={wa.chatUrl(`Hi, I'd like to know more about ${product?.firstName}.`)}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="w-full bg-green-500 hover:bg-green-600 text-white text-sm sm:text-base font-medium py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                             >
                                 <PiWhatsappLogoBold className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                 <span>Chat on WhatsApp</span>
                             </a>
                         )}
                         {product && <WishlistButton product={product} variant="detail" className="w-full" />}
                         <div className="flex gap-3">
                             {wa.contactPhone && (
                                 <a
                                     href={`tel:${wa.contactPhone.replace(/\s/g, "")}`}
                                     className="flex-1 min-w-0 bg-emerald-700 hover:bg-emerald-800 text-white text-sm sm:text-base font-medium py-3 sm:py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-center shadow-sm hover:shadow-md"
                                     aria-label="Call to order"
                                 >
                                     <FiPhoneCall className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                     <span>Call to Order</span>
                                 </a>
                             )}
                             <a
                                 href={`https://m.me/ab9d-ecommerce?text=${encodeURIComponent(`Hi, I'd like to know more about ${product?.firstName}.`)}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="flex-1 min-w-0 bg-blue-500 hover:bg-blue-600 text-white text-sm sm:text-base font-medium py-3 sm:py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-center shadow-sm hover:shadow-md"
                             >
                                 <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                     <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/>
                                 </svg>
                                 <span>Messenger</span>
                             </a>
                         </div>
                     </div>

                    {/* Mini trust row */}
                    <div className="mt-6 flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3">
                        {MINI_TRUST.map(({ icon: Icon, label }) => (
                            <span key={label} className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-gray-600">
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: "var(--theme-primary)" }} />
                                <span className="hidden xs:inline sm:inline">{label}</span>
                            </span>
                        ))}
                    </div>

                    {product.description && (
                        <div className="mt-8 sm:mt-10">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                Description
                            </h3>
                            <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                                {product.description}
                            </p>
                        </div>
                    )}

                    {product.qa && product.qa.length > 0 && (
                         <div className="mt-8 sm:mt-10">
                             <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                 <FiHelpCircle className="w-5 h-5" style={{ color: "var(--theme-primary)" }} />
                                 Questions & Answers
                             </h3>
                             <div className="space-y-2.5">
                                 {product.qa.map((item, index) => {
                                     const open = !!qaExpanded[index];
                                     return (
                                         <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                                             <button
                                                 onClick={() => toggleQA(index)}
                                                 aria-expanded={open}
                                                 className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                             >
                                                 <span className="font-medium text-gray-800 text-sm sm:text-base pr-4">
                                                     {item.question}
                                                 </span>
                                                 <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
                                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                     </svg>
                                                 </span>
                                             </button>
                                             <div className={`accordion-grid ${open ? 'is-open' : ''}`}>
                                                 <div>
                                                     <p className="p-4 bg-white border-t border-gray-200 text-gray-600 text-sm sm:text-base leading-relaxed">
                                                         {item.answer}
                                                     </p>
                                                 </div>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}

                     {relatedProducts.length > 0 && (
                         <Reveal className="mt-10 sm:mt-12">
                             <h3 className="text-xl font-bold text-gray-900 mb-5">You may also like</h3>
                             {relatedLoading ? (
                                 <div className="flex items-center justify-center py-8">
                                     <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                                 </div>
                             ) : (
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 fade-in-stagger">
                                     {relatedProducts.map((item) => (
                                         <Link
                                             key={item._id}
                                             href={`/product/${item._id}`}
                                             className="card-hover group border border-gray-100 rounded-xl overflow-hidden bg-white"
                                         >
                                             <div className="aspect-square bg-gray-100 overflow-hidden">
                                                 <img
                                                     src={item.cover_image || (item.weights?.[0]?.images?.[0]) || '/logo.png'}
                                                     alt={item.firstName}
                                                     loading="lazy"
                                                     decoding="async"
                                                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                 />
                                             </div>
                                             <div className="p-3">
                                                 <h4 className="text-sm font-medium text-gray-800 truncate">{item.firstName}</h4>
                                                 {item.lastName && (
                                                     <p className="text-xs text-gray-600 truncate">{item.lastName}</p>
                                                 )}
                                                 <p className="text-sm font-bold mt-1" style={{ color: "var(--theme-primary)" }}>
                                                     {symbol}{item.weights?.[0]?.price || 0}
                                                 </p>
                                             </div>
                                         </Link>
                                     ))}
                                 </div>
                             )}
                         </Reveal>
                     )}
                </div>
            </div>

            <Reveal>
                <ProductReviews productId={product._id} productName={product.firstName} />
            </Reveal>

            {/* Sticky mobile add-to-cart bar — shows once the real CTA scrolls
                out of view, so buying never requires scrolling back up. */}
            <div
                className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] transition-transform duration-300 ${
                    showStickyBar ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
                <div className="flex items-center gap-3 max-w-7xl mx-auto">
                    <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 truncate max-w-[9rem]">{product.firstName}</p>
                        <p className="text-lg font-extrabold" style={{ color: "var(--theme-primary)" }}>
                            {symbol}{unitPrice.toFixed(0)}
                        </p>
                    </div>
                    <button
                        onClick={added ? goToCart : handleAddToCart}
                        disabled={adding || !currentWeight?.stock}
                        className="flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                        style={{ background: added ? "#059669" : "var(--theme-primary)" }}
                    >
                        {adding ? 'Adding...' : added ? <><FiCheck className="w-4 h-4" /> Added</> : <><FiShoppingCart className="w-4 h-4" /> {currentWeight?.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
