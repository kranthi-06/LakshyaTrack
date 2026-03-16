import { useSubscription } from '../context/SubscriptionContext';

interface SubscriptionBadgeProps {
    className?: string;
}

const STAGE_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
    0: { label: 'Free', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
    1: { label: 'Starter', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
    2: { label: 'Pro', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
    3: { label: 'Ultimate', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
};

/**
 * Small badge showing the user's current subscription tier.
 * Shows a shimmer skeleton while subscription data is loading
 * to prevent the "Free" -> "Ultimate" flicker.
 */
export default function SubscriptionBadge({ className = '' }: SubscriptionBadgeProps) {
    const { stage, isAdmin, loading, resolved } = useSubscription();

    // ── Loading state: show shimmer skeleton ──────────────────
    // This prevents the flicker where "Free" shows briefly before
    // the actual subscription status loads.
    if (loading || !resolved) {
        return (
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${className}`}
            >
                <span className="w-8 h-2.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </span>
        );
    }

    // ── Admin badge ───────────────────────────────────────────
    if (isAdmin) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/15 dark:to-yellow-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 ${className}`}>
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Admin
            </span>
        );
    }

    // ── Normal subscription badge ─────────────────────────────
    const config = STAGE_CONFIG[stage] || STAGE_CONFIG[0];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color} border ${config.border} ${className}`}>
            {stage > 0 && (
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            )}
            {config.label}
        </span>
    );
}
