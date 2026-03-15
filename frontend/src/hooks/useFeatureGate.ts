import { useState, useCallback } from 'react';
import { useSubscription } from '../context/SubscriptionContext';

/**
 * Feature gate hook — provides a simple API for guarding premium actions.
 *
 * Usage:
 *   const { guardAction, gateProps } = useFeatureGate('resume_download', 'Resume Download', 1);
 *
 *   <button onClick={() => guardAction(() => handleDownload())}>Download</button>
 *   <PremiumGate {...gateProps} />
 */
export function useFeatureGate(
    featureKey: string,
    featureName: string,
    requiredStage: number = 1,
    featureDescription?: string,
) {
    const { hasFeature, isAdmin, stage, getFeatureExpiry, refreshAccess } = useSubscription();
    const [showGate, setShowGate] = useState(false);

    const isLocked = !hasFeature(featureKey) && !isAdmin;

    /**
     * Guard an action: if the user has access, call the action immediately.
     * Otherwise, show the PremiumGate modal.
     */
    const guardAction = useCallback(
        (action: () => void | Promise<void>) => {
            if (!isLocked) {
                action();
            } else {
                setShowGate(true);
            }
        },
        [isLocked],
    );

    const closeGate = useCallback(() => setShowGate(false), []);
    const openGate = useCallback(() => setShowGate(true), []);

    const expiry = getFeatureExpiry(featureKey);

    /**
     * Props to spread onto a PremiumGate component.
     */
    const gateProps = {
        isOpen: showGate,
        onClose: closeGate,
        featureKey,
        featureName,
        featureDescription,
        requiredStage,
        onPurchaseSuccess: () => {
            refreshAccess();
        },
    };

    return {
        /** Whether this feature is currently locked */
        isLocked,
        /** Whether user is admin (always has access) */
        isAdmin,
        /** Current subscription stage */
        stage,
        /** Feature expiry date (for countdown timer) */
        expiry,
        /** Guard a callback — runs it if unlocked, shows gate if locked */
        guardAction,
        /** Direct open/close controls for the gate modal */
        openGate,
        closeGate,
        /** Whether the gate modal is showing */
        showGate,
        /** Props to spread onto <PremiumGate /> */
        gateProps,
        /** Refresh subscription data */
        refreshAccess,
    };
}
