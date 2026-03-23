import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Crown, Check, Zap, Star, ArrowRight, Sparkles,
    Clock, Shield, Rocket, X, Tag, Lock,
    FileText, Mic, Map, Edit3, Infinity,
} from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { useUsage } from '../context/UsageContext';
import {
    getPlans, getMicroPlans, checkout, verifyPayment, applyCoupon,
    SubscriptionPlan, MicroPlan,
} from '../services/subscription';
import { getPlanLimits } from '../services/usage';

// ══════════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ══════════════════════════════════════════════════════════════

const STAGE_COLORS: Record<number, { gradient: string; accent: string; glow: string; text: string; light: string; border: string }> = {
    0: {
        gradient: 'from-slate-400 to-slate-500',
        accent: '#94A3B8',
        glow: 'shadow-slate-500/10',
        text: 'text-slate-600 dark:text-slate-400',
        light: 'bg-slate-50 dark:bg-slate-500/10',
        border: 'border-slate-200/80 dark:border-slate-800/60',
    },
    1: {
        gradient: 'from-blue-500 to-cyan-400',
        accent: '#3B82F6',
        glow: 'shadow-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        light: 'bg-blue-50 dark:bg-blue-500/10',
        border: 'border-blue-200/50 dark:border-blue-500/20',
    },
    2: {
        gradient: 'from-violet-500 to-purple-400',
        accent: '#8B5CF6',
        glow: 'shadow-violet-500/20',
        text: 'text-violet-600 dark:text-violet-400',
        light: 'bg-violet-50 dark:bg-violet-500/10',
        border: 'border-violet-200/50 dark:border-violet-500/20',
    },
    3: {
        gradient: 'from-amber-500 to-orange-400',
        accent: '#F59E0B',
        glow: 'shadow-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        light: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200/50 dark:border-amber-500/20',
    },
};

const STAGE_NAMES: Record<number, string> = {
    0: 'Free',
    1: 'Starter',
    2: 'Professional',
    3: 'Ultimate',
};

const STAGE_DESCRIPTIONS: Record<number, string> = {
    0: 'Get started with basic features',
    1: 'Perfect for beginners',
    2: 'For serious career builders',
    3: 'Unlimited access to everything',
};

const STAGE_ICONS: Record<number, any> = {
    0: Star,
    1: Zap,
    2: Shield,
    3: Rocket,
};

interface LimitDefinition {
    resume_count: number;
    interview_count_weekly: number;
    plan_count: number;
    resume_edit_monthly: number;
}

const LIMIT_LABELS: { key: keyof LimitDefinition; label: string; icon: any; unit: string }[] = [
    { key: 'resume_count', label: 'Resume Storage', icon: FileText, unit: 'resumes' },
    { key: 'interview_count_weekly', label: 'Weekly Interviews', icon: Mic, unit: '/week' },
    { key: 'plan_count', label: 'Roadmaps', icon: Map, unit: 'roadmaps' },
    { key: 'resume_edit_monthly', label: 'Monthly Edits', icon: Edit3, unit: '/month' },
];

const FREE_FEATURES = [
    'Dashboard access',
    'Resume creation preview',
    'Limited quiz & analytics',
    '1 resume storage',
    '2 interviews/week',
    '1 roadmap',
    '3 resume edits/month',
];

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function Plans() {
    const navigate = useNavigate();
    const { stage: currentStage, refreshAccess } = useSubscription();
    const { usage, refreshUsage } = useUsage();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [microPlans, setMicroPlans] = useState<MicroPlan[]>([]);
    const [planLimits, setPlanLimits] = useState<Record<string, LimitDefinition> | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [loading, setLoading] = useState(true);
    const [showCheckout, setShowCheckout] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponResult, setCouponResult] = useState<{ valid: boolean; discount: number; final_amount: number; message: string } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showComparison, setShowComparison] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [planData, microData, limitData] = await Promise.all([
                    getPlans(),
                    getMicroPlans(),
                    getPlanLimits(),
                ]);
                setPlans(planData);
                setMicroPlans(microData);
                setPlanLimits(limitData.plans as Record<string, LimitDefinition>);
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
                await Promise.all([refreshAccess(), refreshUsage()]);
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
        transition: { delay: i * 0.08, duration: 0.5 },
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading plans...</p>
                </div>
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
                        Unlock premium features to accelerate your career journey.
                        All limits are enforced securely — upgrade anytime.
                    </p>
                </motion.div>

                {/* ── Current Usage Summary ── */}
                {usage && !usage.is_admin && (
                    <motion.div {...fadeIn(0.5)} className="mb-8">
                        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Your Current Usage
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF]">
                                        {STAGE_NAMES[usage.stage]} Plan
                                    </span>
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {LIMIT_LABELS.map(({ key, label, icon: Icon, unit }) => {
                                    const counter = usage.counters[key];
                                    if (!counter) return null;
                                    const isUnlimited = counter.limit === -1;
                                    const pct = isUnlimited ? 0 : Math.min(100, (counter.current / counter.limit) * 100);
                                    const isExceeded = !isUnlimited && counter.exceeded;

                                    return (
                                        <div key={key} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icon className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    {label}
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-1 mb-2">
                                                <span className={`text-lg font-bold ${isExceeded ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {counter.current}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    / {isUnlimited ? '∞' : counter.limit} {unit}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        isExceeded ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: isUnlimited ? '0%' : `${pct}%` }}
                                                />
                                            </div>
                                            {isExceeded && (
                                                <div className="flex items-center gap-1 mt-1.5">
                                                    <Lock className="w-3 h-3 text-rose-400" />
                                                    <span className="text-[10px] font-semibold text-rose-500">Limit reached</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-10">
                    {/* Free Plan */}
                    <motion.div
                        {...fadeIn(2)}
                        className={`relative bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border p-5 lg:p-6 transition-all ${
                            currentStage === 0
                                ? 'border-[#6C63FF]/30 ring-2 ring-[#6C63FF]/10'
                                : 'border-slate-200/80 dark:border-slate-800/60'
                        }`}
                    >
                        {currentStage === 0 && (
                            <div className="absolute -top-3 left-5 px-3 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold uppercase tracking-wider">
                                Current Plan
                            </div>
                        )}

                        <div className="mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                <Star className="w-5 h-5 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Free</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {STAGE_DESCRIPTIONS[0]}
                            </p>
                            <div className="mt-3">
                                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">₹0</span>
                                <span className="text-slate-400 text-sm ml-1">forever</span>
                            </div>
                        </div>

                        {/* Limits */}
                        <div className="space-y-2 mb-4">
                            {planLimits && (
                                <>
                                    {LIMIT_LABELS.map(({ key, label, icon: Icon }) => {
                                        const limit = planLimits.free?.[key] ?? 0;
                                        return (
                                            <div key={key} className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                    <Icon className="w-2.5 h-2.5 text-slate-400" />
                                                </div>
                                                <span>{label}:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {limit === -1 ? 'Unlimited' : limit}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        <ul className="space-y-2 mb-5">
                            {FREE_FEATURES.slice(0, 3).map((f) => (
                                <li key={f} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-2.5 h-2.5 text-slate-400" />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            disabled
                            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
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
                        const planKey = STAGE_NAMES[stage].toLowerCase();

                        return (
                            <motion.div
                                key={stage}
                                {...fadeIn(i + 3)}
                                className={`relative bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border p-5 lg:p-6 transition-all hover:shadow-xl ${colors.glow} ${
                                    isRecommended
                                        ? `${colors.border} ring-2 ring-[${colors.accent}]/15 scale-[1.02] lg:scale-[1.03]`
                                        : isCurrentPlan
                                        ? 'border-[#6C63FF]/30 ring-2 ring-[#6C63FF]/10'
                                        : 'border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                            >
                                {isRecommended && (
                                    <div className={`absolute -top-3 left-5 px-3 py-0.5 rounded-full bg-gradient-to-r ${colors.gradient} text-white text-[10px] font-bold uppercase tracking-wider shadow-lg ${colors.glow}`}>
                                        <span className="flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            Most Popular
                                        </span>
                                    </div>
                                )}
                                {isCurrentPlan && !isRecommended && (
                                    <div className="absolute -top-3 left-5 px-3 py-0.5 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold uppercase tracking-wider">
                                        Current Plan
                                    </div>
                                )}

                                <div className="mb-4">
                                    <div className={`w-10 h-10 rounded-2xl ${colors.light} flex items-center justify-center mb-3`}>
                                        <StageIcon className="w-5 h-5" style={{ color: colors.accent }} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {STAGE_NAMES[stage]}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {STAGE_DESCRIPTIONS[stage]}
                                    </p>
                                    <div className="mt-3 flex items-baseline gap-1">
                                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
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

                                {/* Limits */}
                                <div className="space-y-2 mb-4">
                                    {planLimits && (
                                        <>
                                            {LIMIT_LABELS.map(({ key, label, icon: Icon }) => {
                                                const limit = planLimits[planKey]?.[key] ?? 0;
                                                const isUnlimited = limit === -1;
                                                return (
                                                    <div key={key} className="flex items-center gap-2.5 text-xs font-medium">
                                                        <div className={`w-5 h-5 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                                                            {isUnlimited ? (
                                                                <Infinity className="w-2.5 h-2.5" style={{ color: colors.accent }} />
                                                            ) : (
                                                                <Icon className="w-2.5 h-2.5" style={{ color: colors.accent }} />
                                                            )}
                                                        </div>
                                                        <span className="text-slate-500 dark:text-slate-400">{label}:</span>
                                                        <span className={`font-bold ${isUnlimited ? colors.text : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {isUnlimited ? 'Unlimited' : limit}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-2 mb-5">
                                    {activePlan.features.slice(0, 4).map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                            <div className={`w-4 h-4 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                                                <Check className="w-2.5 h-2.5" style={{ color: colors.accent }} />
                                            </div>
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleSelectPlan(activePlan)}
                                    disabled={isCurrentPlan || currentStage > stage}
                                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
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

                {/* ── Feature Comparison Toggle ── */}
                <motion.div {...fadeIn(6)} className="text-center mb-6">
                    <button
                        onClick={() => setShowComparison(!showComparison)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        {showComparison ? 'Hide' : 'Show'} Feature Comparison
                        <ArrowRight className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
                    </button>
                </motion.div>

                {/* ── Feature Comparison Table ── */}
                {showComparison && planLimits && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-16 overflow-hidden"
                    >
                        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-slate-800/60">
                                            <th className="text-left py-4 px-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Feature
                                            </th>
                                            {['Free', 'Starter', 'Professional', 'Ultimate'].map((name, idx) => (
                                                <th key={name} className="text-center py-4 px-4">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`text-xs font-bold ${idx === 2 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {name}
                                                        </span>
                                                        {idx === 2 && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                                                                POPULAR
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {LIMIT_LABELS.map(({ key, label, icon: Icon }) => {
                                            const plans_arr = ['free', 'starter', 'professional', 'ultimate'];
                                            return (
                                                <tr key={key} className="border-b border-slate-100 dark:border-slate-800/40 last:border-0">
                                                    <td className="py-3.5 px-5">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                                                        </div>
                                                    </td>
                                                    {plans_arr.map((plan, idx) => {
                                                        const val = planLimits[plan]?.[key] ?? 0;
                                                        const isUnlimited = val === -1;
                                                        return (
                                                            <td key={plan} className="text-center py-3.5 px-4">
                                                                {isUnlimited ? (
                                                                    <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-500">
                                                                        <Infinity className="w-3.5 h-3.5" />
                                                                        ∞
                                                                    </span>
                                                                ) : (
                                                                    <span className={`text-sm font-bold ${idx === 0 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                        {val}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        {/* Additional feature rows */}
                                        {[
                                            { label: 'Dashboard Access', values: [true, true, true, true] },
                                            { label: 'Resume Builder', values: [false, true, true, true] },
                                            { label: 'Job Portal', values: [false, false, true, true] },
                                            { label: 'Ad-Free Experience', values: [false, false, true, true] },
                                            { label: 'Priority Support', values: [false, false, false, true] },
                                        ].map(({ label, values }) => (
                                            <tr key={label} className="border-b border-slate-100 dark:border-slate-800/40 last:border-0">
                                                <td className="py-3.5 px-5">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                                                </td>
                                                {values.map((has, idx) => (
                                                    <td key={idx} className="text-center py-3.5 px-4">
                                                        {has ? (
                                                            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto">
                                                                <Check className="w-3 h-3 text-emerald-500" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                                                                <X className="w-3 h-3 text-slate-400" />
                                                            </div>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Micro Plans Section ── */}
                {microPlans.length > 0 && (
                    <motion.div {...fadeIn(7)}>
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
                                    {...fadeIn(i + 8)}
                                    className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-pointer"
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

                {/* ── Security Badge ── */}
                <motion.div {...fadeIn(12)} className="mt-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-semibold">
                            All limits enforced server-side • Secure payments • Cancel anytime
                        </span>
                    </div>
                </motion.div>
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

                                        {/* What you'll unlock */}
                                        {planLimits && (
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    What you'll unlock
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {LIMIT_LABELS.map(({ key, label, icon: Icon }) => {
                                                        const planKey = STAGE_NAMES[selectedPlan.stage].toLowerCase();
                                                        const limit = planLimits[planKey]?.[key] ?? 0;
                                                        return (
                                                            <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-[#6C63FF]/5">
                                                                <Icon className="w-3.5 h-3.5 text-[#6C63FF]" />
                                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                    {label}: <span className="font-bold text-[#6C63FF]">{limit === -1 ? '∞' : limit}</span>
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

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
