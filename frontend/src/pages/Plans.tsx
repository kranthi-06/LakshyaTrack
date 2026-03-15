import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Crown, Check, Zap, Star, ArrowRight, Sparkles,
    Clock, Shield, Rocket, ChevronLeft, Tag, X,
} from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import {
    getPlans, getMicroPlans, checkout, verifyPayment, applyCoupon,
    SubscriptionPlan, MicroPlan,
} from '../services/subscription';

const STAGE_COLORS: Record<number, { gradient: string; accent: string; glow: string; text: string; light: string }> = {
    1: {
        gradient: 'from-blue-500 to-cyan-400',
        accent: '#3B82F6',
        glow: 'shadow-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        light: 'bg-blue-50 dark:bg-blue-500/10',
    },
    2: {
        gradient: 'from-violet-500 to-purple-400',
        accent: '#8B5CF6',
        glow: 'shadow-violet-500/20',
        text: 'text-violet-600 dark:text-violet-400',
        light: 'bg-violet-50 dark:bg-violet-500/10',
    },
    3: {
        gradient: 'from-amber-500 to-orange-400',
        accent: '#F59E0B',
        glow: 'shadow-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        light: 'bg-amber-50 dark:bg-amber-500/10',
    },
};

const STAGE_NAMES: Record<number, string> = {
    0: 'Free',
    1: 'Starter',
    2: 'Professional',
    3: 'Ultimate',
};

const STAGE_ICONS: Record<number, any> = {
    1: Zap,
    2: Shield,
    3: Rocket,
};

const FREE_FEATURES = [
    'Dashboard access',
    'Resume creation preview',
    'Limited quiz & analytics',
];

export default function Plans() {
    const navigate = useNavigate();
    const { stage: currentStage, refreshAccess } = useSubscription();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [microPlans, setMicroPlans] = useState<MicroPlan[]>([]);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [loading, setLoading] = useState(true);
    const [showCheckout, setShowCheckout] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponResult, setCouponResult] = useState<{ valid: boolean; discount: number; final_amount: number; message: string } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [planData, microData] = await Promise.all([
                    getPlans(),
                    getMicroPlans(),
                ]);
                setPlans(planData);
                setMicroPlans(microData);
            } catch (err) {
                console.error('Failed to load plans:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Group plans by stage
    const stageGroups = [1, 2, 3].map((stage) => {
        const stagePlans = plans.filter((p) => p.stage === stage);
        const monthlyPlan = stagePlans.find((p) => p.billing_cycle === 'monthly');
        const yearlyPlan = stagePlans.find((p) => p.billing_cycle === 'yearly');
        const activePlan = billingCycle === 'monthly' ? monthlyPlan : yearlyPlan;
        const isRecommended = stagePlans.some((p) => p.is_recommended);
        return { stage, activePlan, monthlyPlan, yearlyPlan, isRecommended };
    });

    const handleSelectPlan = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan);
        setCouponCode('');
        setCouponResult(null);
        setShowCheckout(true);
    };

    const handleApplyCoupon = async () => {
        if (!selectedPlan || !couponCode.trim()) return;
        try {
            const result = await applyCoupon(
                couponCode.trim(),
                'subscription',
                selectedPlan.id,
                selectedPlan.price,
            );
            setCouponResult(result);
        } catch (err: any) {
            setCouponResult({
                valid: false,
                discount: 0,
                final_amount: selectedPlan.price,
                message: err?.response?.data?.detail || 'Failed to apply coupon',
            });
        }
    };

    const handleCheckout = async () => {
        if (!selectedPlan) return;
        setProcessing(true);

        try {
            const checkoutResult = await checkout(
                selectedPlan.id,
                'subscription',
                couponResult?.valid ? couponCode : undefined,
            );

            // Demo mode: verify immediately
            const result = await verifyPayment(checkoutResult.transaction_id);

            if (result.success) {
                setSuccess(true);
                await refreshAccess();
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            }
        } catch (err: any) {
            console.error('Checkout failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const fadeIn = (i: number) => ({
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: i * 0.1, duration: 0.5 },
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 md:px-6 lg:px-8 py-8 lg:py-12">
            <div className="max-w-6xl mx-auto">
                {/* ── Header ── */}
                <motion.div {...fadeIn(0)} className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-bold uppercase tracking-wider mb-4">
                        <Crown className="w-3.5 h-3.5" />
                        Subscription Plans
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Choose Your{' '}
                        <span className="bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] bg-clip-text text-transparent">
                            Growth Plan
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-base font-medium max-w-xl mx-auto">
                        Unlock premium features to accelerate your career journey
                    </p>
                </motion.div>

                {/* ── Billing Toggle ── */}
                <motion.div {...fadeIn(1)} className="flex justify-center mb-10">
                    <div className="relative inline-flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`relative z-10 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                                billingCycle === 'monthly'
                                    ? 'text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`relative z-10 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                                billingCycle === 'yearly'
                                    ? 'text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Yearly
                            <span className="ml-1.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400">
                                Save 33%
                            </span>
                        </button>
                        {/* Sliding background */}
                        <motion.div
                            layout
                            className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] shadow-lg shadow-indigo-500/20"
                            style={{
                                left: billingCycle === 'monthly' ? '4px' : '50%',
                                right: billingCycle === 'yearly' ? '4px' : '50%',
                            }}
                            transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                        />
                    </div>
                </motion.div>

                {/* ── Plan Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 mb-16">
                    {/* Free Plan */}
                    <motion.div
                        {...fadeIn(2)}
                        className={`relative bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border p-6 lg:p-7 transition-all ${
                            currentStage === 0
                                ? 'border-[#6C63FF]/30 ring-2 ring-[#6C63FF]/10'
                                : 'border-slate-200/80 dark:border-slate-800/60'
                        }`}
                    >
                        {currentStage === 0 && (
                            <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold uppercase tracking-wider">
                                Current Plan
                            </div>
                        )}

                        <div className="mb-5">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Star className="w-5 h-5 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Free</h3>
                            <div className="mt-2">
                                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">₹0</span>
                                <span className="text-slate-400 text-sm ml-1">forever</span>
                            </div>
                        </div>

                        <ul className="space-y-3 mb-6">
                            {FREE_FEATURES.map((f) => (
                                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-slate-400" />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            disabled
                            className="w-full py-3 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        >
                            {currentStage === 0 ? 'Active Plan' : 'Free Tier'}
                        </button>
                    </motion.div>

                    {/* Paid Plans */}
                    {stageGroups.map(({ stage, activePlan, isRecommended }, i) => {
                        if (!activePlan) return null;
                        const colors = STAGE_COLORS[stage];
                        const StageIcon = STAGE_ICONS[stage];
                        const isCurrentPlan = currentStage === stage;

                        return (
                            <motion.div
                                key={stage}
                                {...fadeIn(i + 3)}
                                className={`relative bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border p-6 lg:p-7 transition-all hover:shadow-xl ${colors.glow} ${
                                    isRecommended
                                        ? `border-[${colors.accent}]/30 ring-2 ring-[${colors.accent}]/10 scale-[1.02]`
                                        : isCurrentPlan
                                        ? 'border-[#6C63FF]/30 ring-2 ring-[#6C63FF]/10'
                                        : 'border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                            >
                                {isRecommended && (
                                    <div className={`absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-gradient-to-r ${colors.gradient} text-white text-[10px] font-bold uppercase tracking-wider shadow-lg ${colors.glow}`}>
                                        <span className="flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            Recommended
                                        </span>
                                    </div>
                                )}
                                {isCurrentPlan && !isRecommended && (
                                    <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold uppercase tracking-wider">
                                        Current Plan
                                    </div>
                                )}

                                <div className="mb-5">
                                    <div className={`w-11 h-11 rounded-2xl ${colors.light} flex items-center justify-center mb-4`}>
                                        <StageIcon className="w-5 h-5" style={{ color: colors.accent }} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {STAGE_NAMES[stage]}
                                    </h3>
                                    <div className="mt-2 flex items-baseline gap-1">
                                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                                            ₹{activePlan.price}
                                        </span>
                                        <span className="text-slate-400 text-sm">
                                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                                        </span>
                                    </div>
                                    {billingCycle === 'yearly' && (
                                        <p className="text-emerald-500 dark:text-emerald-400 text-xs font-semibold mt-1">
                                            Save up to 33% annually
                                        </p>
                                    )}
                                </div>

                                <ul className="space-y-3 mb-6">
                                    {activePlan.features.map((f) => (
                                        <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                            <div className={`w-5 h-5 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                                                <Check className="w-3 h-3" style={{ color: colors.accent }} />
                                            </div>
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleSelectPlan(activePlan)}
                                    disabled={isCurrentPlan || currentStage > stage}
                                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                                        isCurrentPlan
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                            : currentStage > stage
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                            : `bg-gradient-to-r ${colors.gradient} text-white shadow-lg ${colors.glow} hover:shadow-xl hover:scale-[1.02]`
                                    }`}
                                >
                                    {isCurrentPlan
                                        ? 'Active Plan'
                                        : currentStage > stage
                                        ? 'Downgrade'
                                        : `Upgrade to ${STAGE_NAMES[stage]}`
                                    }
                                </button>
                            </motion.div>
                        );
                    })}
                </div>

                {/* ── Micro Plans Section ── */}
                {microPlans.length > 0 && (
                    <motion.div {...fadeIn(6)}>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                                <Zap className="w-6 h-6 text-amber-500" />
                                Quick Access Passes
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-2">
                                Need a single feature? Get instant access without a subscription.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {microPlans.map((mp, i) => (
                                <motion.div
                                    key={mp.id}
                                    {...fadeIn(i + 7)}
                                    className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-pointer"
                                    onClick={() => {
                                        setSelectedPlan(null);
                                        // Could handle micro plan checkout here
                                    }}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                            {mp.usage_type === 'time_limited' ? (
                                                <Clock className="w-5 h-5 text-amber-500" />
                                            ) : (
                                                <Zap className="w-5 h-5 text-amber-500" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{mp.name}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {mp.duration_hours ? `${mp.duration_hours}h access` : 'Single use'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                                        {mp.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                                            ₹{mp.price}
                                        </span>
                                        <span className="text-xs font-semibold text-[#6C63FF] group-hover:underline flex items-center gap-1">
                                            Buy Now <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ════════════════════════════════════════════════ */}
            {/* CHECKOUT MODAL                                   */}
            {/* ════════════════════════════════════════════════ */}
            {showCheckout && selectedPlan && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !processing && setShowCheckout(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-[#0f0f1e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                            {success ? (
                                <div className="p-8 text-center">
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', bounce: 0.4 }}
                                    >
                                        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                                            <Sparkles className="w-10 h-10 text-emerald-500" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                            Welcome to {STAGE_NAMES[selectedPlan.stage]}! 🎉
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                                            All features have been unlocked. Redirecting...
                                        </p>
                                    </motion.div>
                                </div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] p-6 text-white relative">
                                        <button
                                            onClick={() => !processing && setShowCheckout(false)}
                                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <h3 className="text-lg font-bold">Complete Your Upgrade</h3>
                                        <p className="text-white/80 text-sm mt-1">
                                            {STAGE_NAMES[selectedPlan.stage]} · {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                                        </p>
                                    </div>

                                    {/* Body */}
                                    <div className="p-6 space-y-5">
                                        {/* Plan summary */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                    {selectedPlan.name}
                                                </span>
                                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                                    ₹{selectedPlan.price}
                                                </span>
                                            </div>
                                            {couponResult?.valid && (
                                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                                    <span className="text-sm font-medium flex items-center gap-1">
                                                        <Tag className="w-3.5 h-3.5" />
                                                        Coupon Discount
                                                    </span>
                                                    <span className="text-sm font-bold">
                                                        -₹{couponResult.discount}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2 flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Total
                                                </span>
                                                <span className="text-xl font-extrabold text-[#6C63FF]">
                                                    ₹{couponResult?.valid ? couponResult.final_amount : selectedPlan.price}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Coupon input */}
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                                Have a coupon?
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="Enter code"
                                                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 focus:border-[#6C63FF]"
                                                />
                                                <button
                                                    onClick={handleApplyCoupon}
                                                    disabled={!couponCode.trim()}
                                                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                            {couponResult && (
                                                <p className={`text-xs mt-2 font-medium ${couponResult.valid ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {couponResult.message}
                                                </p>
                                            )}
                                        </div>

                                        {/* Pay button */}
                                        <button
                                            onClick={handleCheckout}
                                            disabled={processing}
                                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {processing ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Crown className="w-4 h-4" />
                                                    Pay ₹{couponResult?.valid ? couponResult.final_amount : selectedPlan.price}
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[11px] text-center text-slate-400 font-medium">
                                            Demo mode: Payment is processed instantly
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
}
