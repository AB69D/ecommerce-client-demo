import { FiTruck, FiShield, FiCheckCircle, FiClock, FiPackage, FiPhone, FiCreditCard, FiRefreshCw } from "react-icons/fi";

// `icon` names one of these react-icons/fi exports; an unrecognized name
// (e.g. a future admin-added label) falls back to FiCheckCircle rather than
// crashing the page.
const ICONS = { FiTruck, FiShield, FiCheckCircle, FiClock, FiPackage, FiPhone, FiCreditCard, FiRefreshCw };

export default function TrustBadgesBlock({ data }) {
    const { items } = data || {};
    const list = Array.isArray(items) ? items : [];

    if (!list.length) return null;

    return (
        <section className="max-w-4xl mx-auto px-4 py-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {list.map((b, i) => {
                    const Icon = ICONS[b?.icon] || FiCheckCircle;
                    return (
                        <div key={i} className="flex flex-col items-center text-center gap-2.5 group">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                                <Icon className="w-6 h-6 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-700">{b?.label}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
