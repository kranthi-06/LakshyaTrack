import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Lock, ArrowRight } from 'lucide-react';

interface BlurOverlayProps {
    /** Whether the overlay is active (content is locked) */
    isLocked: boolean;
    /** Feature name for the message */
    featureName: string;
    /** Custom message */
    message?: string;
    /** Blur intensity in pixels */
    blurAmount?: number;
    /** Children to render underneath */
    children: React.ReactNode;
    /** Custom action instead of View Plans */
    onAction?: () => void;
    /** Custom action label */
    actionLabel?: string;
    /** Additional className for the container */
    className?: string;
}

/**
 * Wraps content with a blur overlay when feature is locked.
 * Shows premium upgrade message with View Plans button.
 */
export default function BlurOverlay({
    isLocked,
    featureName,
    message,
    blurAmount = 8,
    children,
    onAction,
    actionLabel,
    className = '',
}: BlurOverlayProps) {
    const navigate = useNavigate();

    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className={`relative ${className}`}>
            {/* Blurred content */}
            <div
                className="pointer-events-none select-none"
                style={{ filter: `blur(${blurAmount}px)` }}
                aria-hidden="true"
            >
                {children}
            </div>

            {/* Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 dark:bg-[#0a0a14]/60 backdrop-blur-[2px]"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
                    className="text-center space-y-4 max-w-sm mx-4"
                >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C63FF]/10 to-[#4F46E5]/10 border border-[#6C63FF]/20 flex items-center justify-center mx-auto">
                        <Lock className="w-7 h-7 text-[#6C63FF]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {featureName}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {message || `Upgrade your plan to unlock ${featureName.toLowerCase()}.`}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => {
                                if (onAction) {
                                    onAction();
                                } else {
                                    navigate('/plans');
                                }
                            }}
                            className="group flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all"
                        >
                            <Crown className="w-4 h-4" />
                            {actionLabel || 'View Plans'}
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
