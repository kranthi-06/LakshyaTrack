import { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useUsage } from '../context/UsageContext';
import UpgradeModal from './UpgradeModal';

// ══════════════════════════════════════════════════════════════
// FEATURE LOCK BUTTON — wraps any button/action with limit checks
//
// Usage:
//   <FeatureLockButton
//     counter="resume_count"
//     onClick={() => handleSaveResume()}
//     className="btn-primary"
//   >
//     Save Resume
//   </FeatureLockButton>
// ══════════════════════════════════════════════════════════════

type CounterName = 'resume_count' | 'interview_count_weekly' | 'plan_count' | 'resume_edit_monthly';

interface FeatureLockButtonProps {
    /** Which usage counter to check */
    counter: CounterName;
    /** Handler to call when the action is allowed */
    onClick: () => void;
    /** Button content */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Whether the button is disabled for other reasons */
    disabled?: boolean;
    /** Optional: icon to show when locked (defaults to Lock) */
    lockIcon?: React.ReactNode;
    /** Optional: custom upgrade modal title */
    upgradeTitle?: string;
    /** Optional: custom upgrade modal message */
    upgradeMessage?: string;
}

const COUNTER_FRIENDLY_NAMES: Record<string, string> = {
    resume_count: 'Monthly Resume Creation',
    interview_count_weekly: 'Weekly Interviews',
    plan_count: 'Roadmap Generator',
    resume_edit_monthly: 'Resume Edits',
};

export default function FeatureLockButton({
    counter,
    onClick,
    children,
    className = '',
    disabled = false,
    lockIcon,
    upgradeTitle,
    upgradeMessage,
}: FeatureLockButtonProps) {
    const { isLimitExceeded, getCounter, resolved } = useUsage();
    const [showUpgrade, setShowUpgrade] = useState(false);

    const exceeded = isLimitExceeded(counter);
    const counterData = getCounter(counter);
    const isLocked = exceeded && resolved;

    const handleClick = useCallback(() => {
        if (isLocked) {
            setShowUpgrade(true);
            return;
        }
        onClick();
    }, [isLocked, onClick]);

    return (
        <>
            <button
                onClick={handleClick}
                disabled={disabled}
                className={`relative group ${className} ${
                    isLocked
                        ? 'opacity-80 cursor-pointer'
                        : ''
                }`}
                title={
                    isLocked
                        ? `${COUNTER_FRIENDLY_NAMES[counter] || counter} limit reached — click to upgrade`
                        : undefined
                }
            >
                {/* Lock overlay badge */}
                {isLocked && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
                        {lockIcon || <Lock className="w-2.5 h-2.5" />}
                    </span>
                )}

                {/* Original button content */}
                <span className={`flex items-center gap-2 ${isLocked ? 'opacity-70' : ''}`}>
                    {isLocked && (
                        <Lock className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    )}
                    {children}
                </span>

                {/* Remaining count badge (when NOT exceeded) */}
                {resolved && !isLocked && counterData && counterData.limit > 0 && counterData.remaining <= 3 && (
                    <span className="absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {counterData.remaining}
                    </span>
                )}
            </button>

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                counter={counter}
                current={counterData?.current}
                limit={counterData?.limit}
                title={upgradeTitle}
                message={upgradeMessage}
            />
        </>
    );
}


// ══════════════════════════════════════════════════════════════
// USAGE BADGE — shows remaining usage inline
// ══════════════════════════════════════════════════════════════

interface UsageBadgeProps {
    counter: CounterName;
    className?: string;
    showWhenUnlimited?: boolean;
}

export function UsageBadge({ counter, className = '', showWhenUnlimited = false }: UsageBadgeProps) {
    const { getCounter, resolved } = useUsage();

    if (!resolved) return null;

    const data = getCounter(counter);
    if (!data) return null;

    // Don't show for unlimited plans unless explicitly requested
    if (data.limit === -1 && !showWhenUnlimited) return null;

    const isUnlimited = data.limit === -1;
    const pct = isUnlimited ? 0 : Math.min(100, (data.current / data.limit) * 100);
    const isWarning = !isUnlimited && pct >= 80;
    const isExceeded = !isUnlimited && data.exceeded;

    return (
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${
                        isExceeded
                            ? 'bg-rose-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                    }`}
                    style={{ width: isUnlimited ? '0%' : `${pct}%` }}
                />
            </div>
            <span
                className={
                    isExceeded
                        ? 'text-rose-500'
                        : isWarning
                        ? 'text-amber-500'
                        : 'text-slate-500 dark:text-slate-400'
                }
            >
                {isUnlimited ? '∞' : `${data.current}/${data.limit}`}
            </span>
        </div>
    );
}
