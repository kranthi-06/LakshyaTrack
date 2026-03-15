import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

interface LockedButtonProps {
    /** Whether action is locked */
    isLocked: boolean;
    /** onClick when unlocked */
    onClick: () => void;
    /** onClick when locked (e.g., open gate) */
    onLockedClick: () => void;
    /** Button content */
    children: React.ReactNode;
    /** Additional class name */
    className?: string;
    /** Disabled state (independent of lock) */
    disabled?: boolean;
    /** Show lock icon overlay */
    showLockIcon?: boolean;
}

/**
 * A button that shows a lock icon when the feature is locked.
 * When locked, clicking triggers onLockedClick instead of onClick.
 */
export default function LockedButton({
    isLocked,
    onClick,
    onLockedClick,
    children,
    className = '',
    disabled = false,
    showLockIcon = true,
}: LockedButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: isLocked ? 1 : 1.02 }}
            whileTap={{ scale: isLocked ? 1 : 0.98 }}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLocked) {
                    onLockedClick();
                } else {
                    onClick();
                }
            }}
            disabled={disabled && !isLocked}
            className={`relative ${className} ${
                isLocked
                    ? 'opacity-70 cursor-not-allowed'
                    : ''
            }`}
            title={isLocked ? 'Upgrade to unlock this feature' : undefined}
        >
            {children}

            {/* Lock icon overlay */}
            {isLocked && showLockIcon && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md shadow-amber-200/50 z-10">
                    <Lock className="w-2.5 h-2.5 text-white" />
                </span>
            )}
        </motion.button>
    );
}
