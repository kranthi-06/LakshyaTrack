import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown, Tag, DollarSign, Users, X, Plus, Save,
    Trash2, ToggleLeft, ToggleRight, Activity, Search,
    ArrowLeft, ChevronDown, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    getPlans, getMicroPlans, adminGetCoupons, adminCreateCoupon,
    adminUpdateCoupon, adminDisableCoupon, adminUpdatePlan,
    adminUpdateMicroPlan, adminGetTransactions, adminManageSubscription,
    SubscriptionPlan, MicroPlan, Coupon, PaymentTransaction,
} from '../services/subscription';

type Tab = 'pricing' | 'coupons' | 'transactions';

export default function AdminSubscriptionPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('pricing');
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [microPlans, setMicroPlans] = useState<MicroPlan[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Coupon creation form
    const [showCouponForm, setShowCouponForm] = useState(false);
    const [newCoupon, setNewCoupon] = useState({
        code: '', discount_type: 'percentage' as 'percentage' | 'fixed',
        discount_value: 0, max_uses: null as number | null,
        applicable_to: 'all', expires_at: '', is_active: true,
    });

    // Edit states
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [editingPrice, setEditingPrice] = useState<number>(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [p, mp, c, t] = await Promise.all([
                getPlans().catch(() => []),
                getMicroPlans().catch(() => []),
                adminGetCoupons().catch(() => []),
                adminGetTransactions().catch(() => []),
            ]);
            setPlans(p);
            setMicroPlans(mp);
            setCoupons(c);
            setTransactions(t);
        } catch (err) {
            console.error('Admin panel data fetch error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePrice = async (id: string, type: 'plan' | 'micro') => {
        try {
            if (type === 'plan') {
                await adminUpdatePlan(id, { price: editingPrice });
                setPlans(prev => prev.map(p => p.id === id ? { ...p, price: editingPrice } : p));
            } else {
                await adminUpdateMicroPlan(id, { price: editingPrice });
                setMicroPlans(prev => prev.map(p => p.id === id ? { ...p, price: editingPrice } : p));
            }
            setEditingPlanId(null);
        } catch (err) {
            alert('Failed to update price');
        }
    };

    const handleCreateCoupon = async () => {
        if (!newCoupon.code.trim()) return;
        try {
            const created = await adminCreateCoupon({
                ...newCoupon,
                expires_at: newCoupon.expires_at || null,
                code: newCoupon.code.toUpperCase(),
            } as any);
            setCoupons(prev => [created, ...prev]);
            setShowCouponForm(false);
            setNewCoupon({
                code: '', discount_type: 'percentage', discount_value: 0,
                max_uses: null, applicable_to: 'all', expires_at: '', is_active: true,
            });
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to create coupon');
        }
    };

    const handleToggleCoupon = async (coupon: Coupon) => {
        if (!coupon.is_active) {
            try {
                const updated = await adminUpdateCoupon(coupon.id, { is_active: true });
                setCoupons(prev => prev.map(c => c.id === coupon.id ? updated : c));
            } catch {
                alert('Failed to enable coupon');
            }
        } else {
            try {
                await adminDisableCoupon(coupon.id);
                setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: false } : c));
            } catch {
                alert('Failed to disable coupon');
            }
        }
    };

    const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
        { key: 'pricing', label: 'Pricing', icon: DollarSign },
        { key: 'coupons', label: 'Coupons', icon: Tag, count: coupons.filter(c => c.is_active).length },
        { key: 'transactions', label: 'Transactions', icon: Activity, count: transactions.length },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#6C63FF]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 md:px-6 lg:px-8 py-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to="/admin/users"
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscription Management</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage pricing, coupons, and monitor transactions</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 mb-8 w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-bold">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ═════════════════════════════════════════════ */}
                {/* TAB: PRICING                                  */}
                {/* ═════════════════════════════════════════════ */}
                {activeTab === 'pricing' && (
                    <div className="space-y-8">
                        {/* Stage Plans */}
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-500" />
                                Stage Subscription Plans
                            </h2>
                            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                                            <th className="text-left p-4">Plan</th>
                                            <th className="text-left p-4">Stage</th>
                                            <th className="text-left p-4">Cycle</th>
                                            <th className="text-left p-4">Price</th>
                                            <th className="text-left p-4">Limits</th>
                                            <th className="text-right p-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {plans.map(plan => (
                                            <tr key={plan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="p-4 font-semibold text-slate-900 dark:text-white">{plan.name}</td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-bold">
                                                        Stage {plan.stage}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500 capitalize">{plan.billing_cycle}</td>
                                                <td className="p-4">
                                                    {editingPlanId === plan.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={editingPrice}
                                                                onChange={e => setEditingPrice(Number(e.target.value))}
                                                                className="w-24 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                                                            />
                                                            <button
                                                                onClick={() => handleUpdatePrice(plan.id, 'plan')}
                                                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                                            >
                                                                <Save className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingPlanId(null)}
                                                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="font-bold text-slate-900 dark:text-white">₹{plan.price}</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-xs text-slate-400">
                                                    {plan.resume_limit === -1 ? '∞' : plan.resume_limit} resumes · {plan.roadmap_limit === -1 ? '∞' : plan.roadmap_limit} roadmaps
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPlanId(plan.id);
                                                            setEditingPrice(plan.price);
                                                        }}
                                                        className="text-xs font-semibold text-[#6C63FF] hover:underline"
                                                    >
                                                        Edit Price
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Micro Plans */}
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Micro Plans</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {microPlans.map(mp => (
                                    <div key={mp.id} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-slate-900 dark:text-white">{mp.name}</h4>
                                            {editingPlanId === mp.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={editingPrice}
                                                        onChange={e => setEditingPrice(Number(e.target.value))}
                                                        className="w-20 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                                                    />
                                                    <button onClick={() => handleUpdatePrice(mp.id, 'micro')} className="p-1 rounded bg-emerald-500/10 text-emerald-500">
                                                        <Save className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => setEditingPlanId(null)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{mp.price}</span>
                                                    <button
                                                        onClick={() => { setEditingPlanId(mp.id); setEditingPrice(mp.price); }}
                                                        className="text-[11px] text-[#6C63FF] hover:underline font-semibold"
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">{mp.feature_key}</span>
                                            <span>{mp.duration_hours ? `${mp.duration_hours}h` : 'Single use'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═════════════════════════════════════════════ */}
                {/* TAB: COUPONS                                  */}
                {/* ═════════════════════════════════════════════ */}
                {activeTab === 'coupons' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Coupon Management</h2>
                            <button
                                onClick={() => setShowCouponForm(!showCouponForm)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-bold hover:bg-[#5B54E8] transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create Coupon
                            </button>
                        </div>

                        {/* New Coupon Form */}
                        <AnimatePresence>
                            {showCouponForm && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden mb-6"
                                >
                                    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">New Coupon</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Code</label>
                                                <input
                                                    value={newCoupon.code}
                                                    onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                                    placeholder="SAVE20"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Type</label>
                                                <select
                                                    value={newCoupon.discount_type}
                                                    onChange={e => setNewCoupon(p => ({ ...p, discount_type: e.target.value as any }))}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                                                >
                                                    <option value="percentage">Percentage (%)</option>
                                                    <option value="fixed">Fixed (₹)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Value</label>
                                                <input
                                                    type="number"
                                                    value={newCoupon.discount_value}
                                                    onChange={e => setNewCoupon(p => ({ ...p, discount_value: Number(e.target.value) }))}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Max Uses</label>
                                                <input
                                                    type="number"
                                                    value={newCoupon.max_uses ?? ''}
                                                    onChange={e => setNewCoupon(p => ({ ...p, max_uses: e.target.value ? Number(e.target.value) : null }))}
                                                    placeholder="Unlimited"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Applies To</label>
                                                <select
                                                    value={newCoupon.applicable_to}
                                                    onChange={e => setNewCoupon(p => ({ ...p, applicable_to: e.target.value }))}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                                                >
                                                    <option value="all">All Plans</option>
                                                    <option value="subscription">Subscriptions Only</option>
                                                    <option value="micro">Micro Plans Only</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Expires</label>
                                                <input
                                                    type="datetime-local"
                                                    value={newCoupon.expires_at}
                                                    onChange={e => setNewCoupon(p => ({ ...p, expires_at: e.target.value }))}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end mt-4 gap-3">
                                            <button
                                                onClick={() => setShowCouponForm(false)}
                                                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreateCoupon}
                                                className="px-5 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-bold hover:bg-[#5B54E8] transition-colors"
                                            >
                                                Create Coupon
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Coupon List */}
                        <div className="space-y-3">
                            {coupons.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Tag className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">No coupons created yet</p>
                                </div>
                            ) : coupons.map(coupon => (
                                <div
                                    key={coupon.id}
                                    className={`bg-white dark:bg-slate-900/50 rounded-xl border p-4 flex items-center gap-4 ${
                                        coupon.is_active
                                            ? 'border-slate-200 dark:border-slate-800'
                                            : 'border-red-200/50 dark:border-red-500/10 opacity-60'
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                                        <Tag className="w-5 h-5 text-[#6C63FF]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{coupon.code}</span>
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${coupon.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {coupon.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
                                            {coupon.max_uses && ` · ${coupon.times_used}/${coupon.max_uses} used`}
                                            {coupon.applicable_to !== 'all' && ` · ${coupon.applicable_to} only`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleCoupon(coupon)}
                                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        title={coupon.is_active ? 'Disable coupon' : 'Enable coupon'}
                                    >
                                        {coupon.is_active ? (
                                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═════════════════════════════════════════════ */}
                {/* TAB: TRANSACTIONS                             */}
                {/* ═════════════════════════════════════════════ */}
                {activeTab === 'transactions' && (
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Payment Transactions</h2>
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                                        <th className="text-left p-4">Date</th>
                                        <th className="text-left p-4">Plan</th>
                                        <th className="text-left p-4">Type</th>
                                        <th className="text-right p-4">Amount</th>
                                        <th className="text-right p-4">Discount</th>
                                        <th className="text-right p-4">Paid</th>
                                        <th className="text-left p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400">
                                                No transactions yet
                                            </td>
                                        </tr>
                                    ) : transactions.map(txn => (
                                        <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4 text-slate-500 text-xs">
                                                {txn.created_at ? new Date(txn.created_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-4 font-medium text-slate-900 dark:text-white">{txn.plan_name || '-'}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium capitalize">
                                                    {txn.order_type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">₹{txn.amount}</td>
                                            <td className="p-4 text-right font-mono text-emerald-500">
                                                {txn.discount > 0 ? `-₹${txn.discount}` : '-'}
                                            </td>
                                            <td className="p-4 text-right font-bold font-mono text-slate-900 dark:text-white">₹{txn.final_amount}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                    txn.status === 'success'
                                                        ? 'bg-emerald-500/10 text-emerald-500'
                                                        : txn.status === 'pending'
                                                        ? 'bg-amber-500/10 text-amber-500'
                                                        : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                    {txn.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
