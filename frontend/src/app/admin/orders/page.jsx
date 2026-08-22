"use client";
import { authFetch } from "@/services/api";
import { listAdminUsers } from "@/services/adminUsers";
import { bookCourier, syncCourierStatus } from "@/services/courier";
import React, { useState, useEffect } from "react";
import { FiSearch, FiEye, FiCheck, FiX, FiPackage, FiTruck, FiClock, FiChevronRight, FiDollarSign, FiCalendar, FiUser, FiMapPin, FiPhone, FiMail, FiShoppingBag, FiGlobe, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useCurrency } from "@/context/CurrencyContext.jsx";

export default function AdminOrdersPage() {
    const wa = useWhatsApp();
    const { can } = useAdminAuth();
    const { symbol } = useCurrency();
    const canWrite = can("order:write");
    const canChangeStatus = canWrite || can("order:status");
    const canFulfillment = can("fulfillment:write");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [soldByFilter, setSoldByFilter] = useState("all");
    const [sellers, setSellers] = useState([]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ show: false, order: null, deliveryDate: "", adminNotes: "" });
    const [processing, setProcessing] = useState(false);
    const [courierBooking, setCourierBooking] = useState(false);
    const [courierSyncing, setCourierSyncing] = useState(false);
    const [courierMsg, setCourierMsg] = useState("");
    const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0, cancelled: 0 });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const PAGE_SIZE = 20;

    // Debounce the free-text search so it doesn't re-query on every keystroke;
    // everything else (status/source/date/page) re-fetches immediately.
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // Any filter change should jump back to page 1 — staying on, say, page 4
    // of a now-narrower result set would just show an empty page.
    useEffect(() => {
        setPage(1);
    }, [statusFilter, sourceFilter, soldByFilter, debouncedSearch, dateFrom, dateTo]);

    useEffect(() => {
        fetchOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, sourceFilter, soldByFilter, debouncedSearch, dateFrom, dateTo, page]);

    // Load POS sellers once for the salesman filter. Silently no-op if the
    // viewer lacks user:read — the filter simply stays empty.
    useEffect(() => {
        (async () => {
            try {
                const res = await listAdminUsers();
                if (res?.success && Array.isArray(res.data)) {
                    setSellers(res.data.filter((u) => u.role === "salesman"));
                }
            } catch {
                /* ignore — viewer may not have user:read */
            }
        })();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const body = {
                page,
                limit: PAGE_SIZE,
                search: debouncedSearch || undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                source: sourceFilter !== "all" ? sourceFilter : undefined,
                soldById: soldByFilter !== "all" ? soldByFilter : undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            };
            const res = await authFetch(`/api/admin/order/get-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                setOrders(data.data);
                setTotalPages(data.totalNoPage || 1);

                // Status breakdown is an aggregate over ALL matching orders
                // (server-computed), not just this page.
                const sc = data.statusCounts || {};
                setStats({
                    total: data.totalCount || 0,
                    pending: sc.pending || 0,
                    confirmed: sc.confirmed || 0,
                    delivered: sc.delivered || 0,
                    cancelled: sc.cancelled || 0,
                });
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewOrder = (order, e) => {
        e.stopPropagation();
        setCourierMsg("");
        setSelectedOrder(order);
    };

    const handleRowClick = (order) => {
        setCourierMsg("");
        setSelectedOrder(order);
    };

    const handleCloseDetail = () => {
        setSelectedOrder(null);
        setCourierMsg("");
    };

    const handleConfirmOrder = async (e) => {
        e.preventDefault();
        if (!confirmModal.order) return;

        setProcessing(true);
        try {
            const res = await authFetch(`/api/admin/order/confirm-order`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: confirmModal.order.orderId,
                    deliveryDate: confirmModal.deliveryDate,
                    adminNotes: confirmModal.adminNotes
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchOrders();
                setConfirmModal({ show: false, order: null, deliveryDate: "", adminNotes: "" });
                setSelectedOrder(data.data);
            } else {
                alert(data.message || "Failed to confirm order");
            }
        } catch (error) {
            alert("Failed to confirm order");
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        if (!confirm(`Are you sure you want to mark this order as ${newStatus}?`)) return;
        
        try {
            const res = await authFetch(`/api/admin/order/update-status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, orderStatus: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                fetchOrders();
                if (selectedOrder?.orderId === orderId) {
                    setSelectedOrder(data.data);
                }
            }
        } catch (error) {
            console.error("Failed to update order status:", error);
        }
    };

    // Update both the open detail modal and the matching row in the current
    // page's list from a single fresh order object — avoids a full refetch
    // just to reflect a newly-booked/synced courier field.
    const applyOrderUpdate = (updated) => {
        if (!updated) return;
        setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
    };

    const handleBookCourier = async () => {
        if (!selectedOrder) return;
        setCourierMsg("");
        setCourierBooking(true);
        try {
            const res = await bookCourier(selectedOrder._id);
            if (res?.success && res.data) {
                applyOrderUpdate(res.data);
            } else {
                setCourierMsg(res?.message || "Could not book this order with the courier.");
            }
        } catch (error) {
            setCourierMsg("Network error. Please try again.");
        } finally {
            setCourierBooking(false);
        }
    };

    const handleSyncCourier = async () => {
        if (!selectedOrder) return;
        setCourierMsg("");
        setCourierSyncing(true);
        try {
            const res = await syncCourierStatus(selectedOrder._id);
            if (res?.success && res.data) {
                applyOrderUpdate(res.data);
            } else {
                setCourierMsg(res?.message || "Could not refresh courier status.");
            }
        } catch (error) {
            setCourierMsg("Network error. Please try again.");
        } finally {
            setCourierSyncing(false);
        }
    };

    const toLocalYMD = (iso) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Search/status/source/date filters are now all applied server-side (see
    // fetchOrders) so pagination stays correct; `orders` is already exactly
    // this page's matching results.
    const filteredOrders = orders;

    const todayYMD = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const setQuickRange = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setDateFrom(fmt(start));
        setDateTo(fmt(end));
    };

    const getStatusBadge = (status) => {
        const statusStyles = {
            pending: { bg: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: FiClock },
            confirmed: { bg: "bg-blue-100 text-blue-700 border-blue-200", icon: FiCheck },
            processing: { bg: "bg-purple-100 text-purple-700 border-purple-200", icon: FiPackage },
            shipped: { bg: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: FiTruck },
            delivered: { bg: "bg-green-100 text-green-700 border-green-700", icon: FiCheck },
            cancelled: { bg: "bg-red-100 text-red-700 border-red-200", icon: FiX }
        };
        const style = statusStyles[status] || statusStyles.pending;
        const Icon = style.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg}`}>
                <Icon className="w-3 h-3" />
                <span className="capitalize">{status}</span>
            </span>
        );
    };

    const getChannelBadge = (order) => {
        if (order.source === "pos") {
            const who = order.soldBy?.fullName || order.soldBy?.username;
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200 w-fit">
                        <FiShoppingBag className="w-3 h-3" />
                        POS
                        {order.saleType && (
                            <span className="capitalize opacity-75">· {order.saleType}</span>
                        )}
                    </span>
                    {who && <span className="text-[11px] text-gray-500 pl-1">by {who}</span>}
                </div>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-sky-100 text-sky-700 border-sky-200 w-fit">
                <FiGlobe className="w-3 h-3" />
                E-commerce
            </span>
        );
    };

    const getNextStatuses = (currentStatus) => {
        const flow = {
            pending: [{ key: 'confirmed', label: 'Confirm', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' }],
            confirmed: [{ key: 'processing', label: 'Process', color: 'bg-blue-600 hover:bg-blue-700 text-white' }],
            processing: [{ key: 'shipped', label: 'Ship', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' }],
            shipped: [{ key: 'delivered', label: 'Deliver', color: 'bg-green-600 hover:bg-green-700 text-white' }],
            delivered: [{ key: 'return_requested', label: 'Return', color: 'bg-orange-100 hover:bg-orange-200 text-orange-700' }],
            cancelled: []
        };
        return flow[currentStatus] || [];
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                    <p className="text-sm text-yellow-700">Pending</p>
                    <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-700">Confirmed</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.confirmed}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <p className="text-sm text-green-700">Delivered</p>
                    <p className="text-2xl font-bold text-green-700">{stats.delivered}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <p className="text-sm text-red-700">Cancelled</p>
                    <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
                </div>
            </div>

            {/* Header */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-2xl font-bold text-gray-800">Orders Management</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Order ID, Name, Phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm w-full sm:w-72 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="returned">Returned</option>
                        </select>
                        <select
                            value={sourceFilter}
                            onChange={(e) => { setSourceFilter(e.target.value); if (e.target.value !== "pos") setSoldByFilter("all"); }}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="all">All Channels</option>
                            <option value="ecommerce">E-commerce</option>
                            <option value="pos">POS</option>
                        </select>
                        {sourceFilter === "pos" && (
                            <select
                                value={soldByFilter}
                                onChange={(e) => setSoldByFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="all">All Salesmen</option>
                                {sellers.map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.fullName || s.username}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Date Filter Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-gray-600">
                        <FiCalendar className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium">Filter by date:</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                max={dateTo || undefined}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                min={dateFrom || undefined}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => { const t = todayYMD(); setDateFrom(t); setDateTo(t); }}
                            className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickRange(7)}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
                        >
                            Last 7 days
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickRange(30)}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
                        >
                            Last 30 days
                        </button>
                        {(dateFrom || dateTo) && (
                            <button
                                type="button"
                                onClick={() => { setDateFrom(""); setDateTo(""); }}
                                className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"
                            >
                                <FiX className="w-3 h-3" /> Clear
                            </button>
                        )}
                    </div>
                    {(dateFrom || dateTo) && (
                        <span className="text-xs text-gray-500 sm:ml-auto whitespace-nowrap">
                            {stats.total} order{stats.total === 1 ? '' : 's'} in range
                        </span>
                    )}
                </div>
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <FiPackage className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No orders found</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <p className="sm:hidden px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                        Swipe left/right to see all columns →
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Channel</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map((order) => (
                                    <tr 
                                        key={order._id} 
                                        onClick={() => handleRowClick(order)}
                                        className="cursor-pointer hover:bg-emerald-50/50 transition-colors"
                                    >
                                        <td className="px-4 py-4">
                                            <span className="font-mono text-sm font-semibold text-emerald-700">{order.orderId}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                                    <FiUser className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                                                        {order.customerName}
                                                        {order.riskFlag?.flagged && (
                                                            <span title={order.riskFlag.reason || "Flagged for review"} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                                                <FiAlertTriangle className="w-3 h-3" /> Flagged
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{order.customerPhone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {getChannelBadge(order)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm text-gray-600">{order.items?.length || 0} items</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-bold text-gray-900">{symbol}{order.totalAmount}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {getStatusBadge(order.orderStatus)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm text-gray-500">
                                                {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={(e) => handleViewOrder(order, e)}
                                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                            >
                                                <FiEye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                                Page {page} of {totalPages} · {stats.total} total
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && !confirmModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Order Details</h3>
                                <p className="text-sm text-gray-500 font-mono">{selectedOrder.orderId}</p>
                            </div>
                            <button 
                                onClick={handleCloseDetail} 
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Status Badge */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {getStatusBadge(selectedOrder.orderStatus)}
                                    {getChannelBadge(selectedOrder)}
                                </div>
                                <span className="text-sm text-gray-500">
                                    {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>

                            {selectedOrder.riskFlag?.flagged && (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <FiAlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-amber-800 text-sm">Flagged for review</p>
                                        <p className="text-sm text-amber-700 mt-0.5">{selectedOrder.riskFlag.reason || "This order matched a soft blocklist entry."}</p>
                                    </div>
                                </div>
                            )}

                            {/* Courier Ratio Check (Fraud BD) — full breakdown, not just the
                                one-line summary baked into the riskFlag reason above. */}
                            {selectedOrder.courierRatioCheck?.provider && (
                                <div className="bg-gray-50 rounded-xl p-5">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <FiTruck className="w-4 h-4" />
                                            Courier Ratio Check
                                        </h4>
                                        <span className="text-xs text-gray-400">
                                            via {selectedOrder.courierRatioCheck.provider}
                                            {selectedOrder.courierRatioCheck.checkedAt && (
                                                <> &middot; {new Date(selectedOrder.courierRatioCheck.checkedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                                            )}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-white rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-gray-800">{selectedOrder.courierRatioCheck.totalOrders}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Total orders</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-emerald-600">{selectedOrder.courierRatioCheck.successCount}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Delivered</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-red-500">{selectedOrder.courierRatioCheck.cancelCount}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Cancelled</p>
                                        </div>
                                        <div className={`rounded-lg p-3 text-center ${
                                            selectedOrder.courierRatioCheck.successRate >= 70 ? "bg-emerald-50" :
                                            selectedOrder.courierRatioCheck.successRate >= 50 ? "bg-amber-50" : "bg-red-50"
                                        }`}>
                                            <p className={`text-xl font-bold ${
                                                selectedOrder.courierRatioCheck.successRate >= 70 ? "text-emerald-600" :
                                                selectedOrder.courierRatioCheck.successRate >= 50 ? "text-amber-600" : "text-red-600"
                                            }`}>
                                                {selectedOrder.courierRatioCheck.successRate ?? "—"}%
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">Success rate</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3">
                                        Cross-courier delivery history for this phone number at the time this order was placed — not specific to this store.
                                    </p>
                                </div>
                            )}

                            {/* Customer Info Card */}
                            <div className="bg-gray-50 rounded-xl p-5">
                                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FiUser className="w-4 h-4" />
                                    Customer Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                            <FiUser className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Name</p>
                                            <p className="font-medium text-gray-800">{selectedOrder.customerName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                            <FiPhone className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500">Phone</p>
                                            <p className="font-medium text-gray-800">{selectedOrder.customerPhone}</p>
                                        </div>
                                        {wa.featureEnabled && selectedOrder.customerPhone && (
                                            <a
                                                href={wa.linkTo(
                                                    selectedOrder.customerPhone,
                                                    wa.statusTemplate
                                                        ? wa.fillTemplate(wa.statusTemplate, {
                                                              name: selectedOrder.customerName,
                                                              orderId: selectedOrder.orderId,
                                                              status: selectedOrder.orderStatus,
                                                          })
                                                        : `Hi ${selectedOrder.customerName || ""}, regarding your order ${selectedOrder.orderId}.`
                                                )}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
                                                title="Message customer on WhatsApp"
                                            >
                                                <PiWhatsappLogoBold className="w-4 h-4" />
                                                WhatsApp
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                            <FiMail className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Email</p>
                                            <p className="font-medium text-gray-800">{selectedOrder.customerEmail || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                            <FiMapPin className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Address</p>
                                            <p className="font-medium text-gray-800">{selectedOrder.shippingAddress}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Courier Card — only shown once there's something to say: the
                                order is confirmed (so it CAN be booked) or it's already booked. */}
                            {(selectedOrder.courier?.consignmentId || selectedOrder.orderStatus === 'confirmed') && (
                                <div className="bg-gray-50 rounded-xl p-5">
                                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <FiTruck className="w-4 h-4" />
                                        Courier
                                    </h4>

                                    {selectedOrder.courier?.consignmentId ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500">Consignment ID</p>
                                                    <p className="font-medium text-gray-800">{selectedOrder.courier.consignmentId}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Tracking Code</p>
                                                    <p className="font-medium text-gray-800">{selectedOrder.courier.trackingCode || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Status</p>
                                                    <p className="font-medium text-gray-800 capitalize">{selectedOrder.courier.status || 'Unknown'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Last Synced</p>
                                                    <p className="font-medium text-gray-800">
                                                        {selectedOrder.courier.lastSyncedAt
                                                            ? new Date(selectedOrder.courier.lastSyncedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                            : 'Never'}
                                                    </p>
                                                </div>
                                            </div>
                                            {canFulfillment && (
                                                <button
                                                    onClick={handleSyncCourier}
                                                    disabled={courierSyncing}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    {courierSyncing ? (
                                                        <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                                    ) : (
                                                        <FiRefreshCw className="w-4 h-4" />
                                                    )}
                                                    {courierSyncing ? 'Syncing…' : 'Sync Status'}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        canFulfillment && (
                                            <button
                                                onClick={handleBookCourier}
                                                disabled={courierBooking}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {courierBooking ? (
                                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <FiTruck className="w-4 h-4" />
                                                )}
                                                {courierBooking ? 'Booking…' : 'Book Courier'}
                                            </button>
                                        )
                                    )}

                                    {courierMsg && (
                                        <p className="text-xs text-gray-500 mt-3">{courierMsg}</p>
                                    )}
                                </div>
                            )}

                            {/* Order Items Card */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FiPackage className="w-4 h-4" />
                                    Order Items
                                </h4>
                                <div className="space-y-3">
                                    {selectedOrder.items?.map((item, index) => (
                                        <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                                            <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                                {item.productImage ? (
                                                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <FiPackage className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">{item.productName}</p>
                                                <p className="text-sm text-gray-500">Qty: {item.quantity} x {symbol}{item.price}</p>
                                            </div>
                                            <p className="font-bold text-gray-800">{symbol}{item.totalPrice}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t mt-4 pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="font-medium">{symbol}{selectedOrder.subtotal}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Delivery Charge</span>
                                        <span className="font-medium">{symbol}{selectedOrder.deliveryCharge}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                        <span>Total Amount</span>
                                        <span className="text-emerald-700">{symbol}{selectedOrder.totalAmount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Date */}
                            {selectedOrder.deliveryDate && (
                                <div className="bg-emerald-50 rounded-xl p-5">
                                    <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                                        <FiCalendar className="w-4 h-4" />
                                        Expected Delivery
                                    </h4>
                                    <p className="text-lg font-bold text-emerald-700">
                                        {new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB', { 
                                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                                        })}
                                    </p>
                                    {selectedOrder.returnAvailableUntil && (
                                        <p className="text-sm text-emerald-600 mt-2">
                                            Return available until: {new Date(selectedOrder.returnAvailableUntil).toLocaleDateString('en-GB')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Notes */}
                            {(selectedOrder.notes || selectedOrder.adminNotes) && (
                                <div className="space-y-3">
                                    {selectedOrder.notes && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Customer Notes</p>
                                            <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                                        </div>
                                    )}
                                    {selectedOrder.adminNotes && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Admin Notes</p>
                                            <p className="text-sm bg-emerald-50 p-3 rounded-lg text-emerald-700">{selectedOrder.adminNotes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            {canWrite && selectedOrder.orderStatus === 'pending' && (
                                <button
                                    onClick={() => setConfirmModal({
                                        show: true,
                                        order: selectedOrder,
                                        deliveryDate: "",
                                        adminNotes: ""
                                    })}
                                    className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 font-medium"
                                >
                                    <FiCheck className="w-5 h-5" />
                                    Confirm Order
                                </button>
                            )}

                            {canChangeStatus && selectedOrder.orderStatus !== 'pending' && selectedOrder.orderStatus !== 'cancelled' && selectedOrder.orderStatus !== 'delivered' && (
                                <div className="flex gap-3">
                                    {getNextStatuses(selectedOrder.orderStatus).map((action) => (
                                        <button
                                            key={action.key}
                                            onClick={() => handleUpdateStatus(selectedOrder.orderId, action.key)}
                                            className={`flex-1 px-4 py-3 rounded-xl font-medium ${action.color}`}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {canChangeStatus && selectedOrder.orderStatus !== 'cancelled' && selectedOrder.orderStatus !== 'delivered' && (
                                <button
                                    onClick={() => handleUpdateStatus(selectedOrder.orderId, 'cancelled')}
                                    className="w-full border border-red-200 text-red-600 px-4 py-3 rounded-xl hover:bg-red-50 font-medium"
                                >
                                    Cancel Order
                                </button>
                            )}

                            {!canChangeStatus && !canWrite && (
                                <p className="text-center text-xs text-gray-400 pt-2">You have view-only access to orders.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Order Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">Confirm Order</h3>
                            <p className="text-sm text-gray-500 mb-6">Set delivery date and add notes</p>
                            
                            <form onSubmit={handleConfirmOrder} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                                    <input
                                        type="date"
                                        value={confirmModal.deliveryDate}
                                        onChange={(e) => setConfirmModal({ ...confirmModal, deliveryDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Optional)</label>
                                    <textarea
                                        value={confirmModal.adminNotes}
                                        onChange={(e) => setConfirmModal({ ...confirmModal, adminNotes: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                                        placeholder="Any notes for the customer..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setConfirmModal({ show: false, order: null, deliveryDate: "", adminNotes: "" })}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={processing}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
                                    >
                                        {processing ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}