"use client";
import { useState, useEffect } from "react";
import { FiTrash2, FiMail, FiClock } from "react-icons/fi";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function AdminMessagesPage() {
    const { can } = useAdminAuth();
    const canDelete = can("content:write");

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchMessages = async () => {
        try {
            const res = await authFetch(`/api/admin/contact/messages`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
            } else {
                setError(data.message || "Failed to fetch messages");
            }
        } catch (err) {
            setError("Failed to fetch messages");
        } finally {
            setLoading(false);
        }
    };

    const deleteMessage = async (id) => {
        if (!confirm("Are you sure you want to delete this message?")) return;

        try {
            const res = await authFetch(`/api/admin/contact/delete/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.success) {
                setMessages((prev) => prev.filter((msg) => msg._id !== id));
            } else {
                alert(data.message || "Failed to delete message");
            }
        } catch (err) {
            alert("Failed to delete message");
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Messages</h1>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {messages.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <p className="text-gray-500">No messages yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg._id} className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                            <div className="flex justify-between items-start gap-3 mb-4">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-gray-900 truncate">{msg.name}</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-gray-500 text-sm">
                                        <div className="flex items-center gap-1">
                                            <FiMail className="w-4 h-4 shrink-0" />
                                            <span className="truncate">{msg.email}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <FiClock className="w-4 h-4 shrink-0" />
                                            <span>{new Date(msg.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                {canDelete && (
                                    <button
                                        onClick={() => deleteMessage(msg._id)}
                                        className="text-red-500 hover:text-red-700 transition-colors p-2 shrink-0"
                                        title="Delete message"
                                    >
                                        <FiTrash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <div className="mb-3">
                                <h4 className="font-semibold text-gray-800 mb-1 text-sm">Subject</h4>
                                <p className="text-gray-700 text-sm">{msg.subject}</p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-800 mb-1 text-sm">Message</h4>
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
