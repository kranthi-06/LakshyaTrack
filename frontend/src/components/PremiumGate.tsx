import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Zap, ArrowRight, Sparkles, Clock, Shield } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { checkout, verifyPayment, MicroPlan } from '../services/subscription';

interface PremiumGateProps {
    /** Whether the popup is visible */
    isOpen: boolean;
    /** Close the popup */
    onClose: () => void;
    /** Feature key being accessed */
    featureKey: string;
    /** Human-readable feature name */
    featureName: string;
    /** Description of what this feature does */
    featureDescription?: string;
    /** Minimum stage required */
    requiredStage?: number;
    /** Available micro plans for this feature */
    microPlans?: MicroPlan[];
    /** Called after successful purchase */
    onPurchaseSuccess?: () => void;
}

/**
 * Premium feature gate popup.
 * Shows when a user tries to access a locked feature.
 * Offers stage subscription or micro-plan purchase options.
 */
export default function PremiumGate({
    isOpen,
    onClose,
    featureKey,
    featureName,
    featureDescription,
    requiredStage = 1,
    microPlans = [],
    onPurchaseSuccess,
}: PremiumGateProps) {
    const navigate = useNavigate();
    const { refreshAccess } = useSubscription();
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseError, setPurchaseError] = useState('');
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);

    const relevantMicroPlans = microPlans.filter(
        (mp) => mp.feature_key === featureKey && mp.is_active,
    );

    const handleGoToPlans = () => {
        onClose();
        navigate('/plans');
    };

    const handleMicroPurchase = async (microPlan: MicroPlan) => {
        setPurchasing(true);
        setPurchaseError('');

        try {
            // Create checkout
            const checkoutResult = await checkout(microPlan.id, 'micro');

            // Demo mode: immediately verify
            const result = await verifyPayment(checkoutResult.transaction_id);

            if (result.success) {
                setPurchaseSuccess(true);
                await refreshAccess();
                setTimeout(() => {
                    onClose();
                    onPurchaseSuccess?.();
                }, 1500);
            } else {
                setPurchaseError(result.message || 'Payment failed');
            }
        } catch (err: any) {
            setPurchaseError(err?.response?.data?.detail || 'Purchase failed. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const stageNames: Record<number, string> = {
        1: 'Starter',
        2: 'Professional',
        3: 'Ultimate',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-[#0f0f1e] rounded-3xl shadow-2xl shadow-black/20 w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                            {/* Header with gradient */}
                            <div className="relative bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] p-6 pb-8 text-white overflow-hidden">
                                {/* Background decoration */}
                                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full" />

                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="relative">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                                        <Crown className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-1">
                                        Unlock {featureName}
                                    </h3>
                                    <p className="text-white/80 text-sm font-medium">
                                        {featureDescription || `This feature requires a ${stageNames[requiredStage] || 'premium'} subscription.`}
                                    </p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                {purchaseSuccess ? (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-center py-6"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                            <Sparkles className="w-8 h-8 text-emerald-500" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                            Feature Unlocked! 🎉
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            You now have access. Enjoy!
                                        </p>
                                    </motion.div>
                                ) : (
                                    <>
                                        {/* Stage subscription option */}
                                        <button
                                            onClick={handleGoToPlans}
                                            className="w-full group bg-gradient-to-r from-[#6C63FF]/5 to-[#4F46E5]/5 hover:from-[#6C63FF]/10 hover:to-[#4F46E5]/10 border border-[#6C63FF]/20 hover:border-[#6C63FF]/40 rounded-2xl p-4 text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                                                    <Shield className="w-5 h-5 text-[#6C63FF]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C63FF] transition-colors">
                                                        Subscribe to a Plan
                                                    </h5>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Get {stageNames[requiredStage] || 'full'} access with all features
                                                    </p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#6C63FF] transition-colors flex-shrink-0" />
                                            </div>
                                        </button>

                                        {/* Micro plan options */}
                                        {relevantMicroPlans.length > 0 && (
                                            <>
                                                <div className="flex items-center gap-3 text-slate-400 dark:text-slate-600">
                                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                                    <span className="text-[11px] font-medium uppercase tracking-wider">or quick access</span>
                                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                                </div>

                                                <div className="space-y-2">
                                                    {relevantMicroPlans.map((mp) => (
                                                        <button
                                                            key={mp.id}
                                                            onClick={() => handleMicroPurchase(mp)}
                                                            disabled={purchasing}
                                                            className="w-full group bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 text-left transition-all disabled:opacity-50"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                                                    {mp.usage_type === 'time_limited' ? (
                                                                        <Clock className="w-4 h-4 text-amber-500" />
                                                                    ) : (
                                                                        <Zap className="w-4 h-4 text-amber-500" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h6 className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                                                        {mp.name}
                                                                    </h6>
                                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                        {mp.description || (mp.duration_hours ? `${mp.duration_hours}h access` : 'Single use')}
                                                                    </p>
                                                                </div>
                                                                <div className="flex-shrink-0 text-right">
                                                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                                        ₹{mp.price}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {purchaseError && (
                                            <p className="text-xs text-red-500 text-center font-medium">
                                                {purchaseError}
                                            </p>
                                        )}

                                        {purchasing && (
                                            <div className="flex items-center justify-center gap-2 py-2">
                                                <div className="w-4 h-4 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                                                <span className="text-xs text-slate-500 font-medium">Processing...</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
