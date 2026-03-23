import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Crown, Sparkles, X, ArrowRight, Zap, Shield, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ══════════════════════════════════════════════════════════════
// UPGRADE MODAL — shown when a user hits a usage limit
// ══════════════════════════════════════════════════════════════

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Which counter triggered the limit */
    counter?: string;
    /** Current usage count */
    current?: number;
    /** Plan limit */
    limit?: number;
    /** Custom title override */
    title?: string;
    /** Custom message override */
    message?: string;
}

const COUNTER_LABELS: Record<string, { label: string; icon: string; description: string }> = {
    resume_count: {
        label: 'Resume Creation',
        icon: '📄',
        description: 'You\'ve reached your monthly resume creation limit. Wait for next month or upgrade your plan.',
    },
    interview_count_weekly: {
        label: 'Interview Practice',
        icon: '🎤',
        description: 'You\'ve used all your interview sessions for this week.',
    },
    plan_count: {
        label: 'Roadmap Generator',
        icon: '🗺️',
        description: 'You\'ve reached your roadmap generation limit.',
    },
    resume_edit_monthly: {
        label: 'Resume Edits',
        icon: '✏️',
        description: 'You\'ve used all your resume edits for this month.',
    },
};

const PLAN_BENEFITS = [
    { icon: Zap, label: 'Starter', desc: 'More creations & interviews', color: '#3B82F6' },
    { icon: Shield, label: 'Professional', desc: 'Full platform access', color: '#8B5CF6' },
    { icon: Rocket, label: 'Ultimate', desc: 'Unlimited everything', color: '#F59E0B' },
];

export default function UpgradeModal({
    isOpen,
    onClose,
    counter,
    current,
    limit,
    title,
    message,
}: UpgradeModalProps) {
    const navigate = useNavigate();

    const counterInfo = counter ? COUNTER_LABELS[counter] : null;

    const displayTitle = title || 'Upgrade Required';
    const displayMessage =
        message ||
        counterInfo?.description ||
        'You\'ve reached your plan\'s limit for this feature.';

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                        className="fixed inset-0 z-[201] flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-[#0f0f1e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                            {/* Header with gradient */}
                            <div className="relative bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-6 text-white">
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                                    <Lock className="w-8 h-8" />
                                </div>

                                <h3 className="text-xl font-bold">{displayTitle}</h3>
                                <p className="text-white/80 text-sm mt-1.5 leading-relaxed">
                                    {displayMessage}
                                </p>

                                {/* Usage indicator */}
                                {current !== undefined && limit !== undefined && limit > 0 && (
                                    <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl p-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium flex items-center gap-1.5">
                                                {counterInfo?.icon && <span>{counterInfo.icon}</span>}
                                                {counterInfo?.label || 'Usage'}
                                            </span>
                                            <span className="font-bold">
                                                {current} / {limit}
                                            </span>
                                        </div>
                                        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-white rounded-full transition-all"
                                                style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                {/* Plan options */}
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Upgrade to unlock more
                                </p>

                                <div className="space-y-2.5 mb-6">
                                    {PLAN_BENEFITS.map(({ icon: Icon, label, desc, color }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                                        >
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${color}15` }}
                                            >
                                                <Icon className="w-4.5 h-4.5" style={{ color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {label}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {desc}
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Buttons */}
                                <button
                                    onClick={() => {
                                        onClose();
                                        navigate('/plans');
                                    }}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" />
                                    View All Plans
                                    <Sparkles className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={onClose}
                                    className="w-full mt-2.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
