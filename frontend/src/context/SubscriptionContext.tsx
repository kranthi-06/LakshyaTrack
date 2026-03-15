import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
    getFeatureAccess,
    FeatureAccess,
    UserSubscription,
    UserMicroPurchase,
} from '../services/subscription';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface SubscriptionContextType {
    /** Current subscription stage (0-3) */
    stage: number;
    /** Whether the user is admin/super-admin */
    isAdmin: boolean;
    /** Active subscription details */
    subscription: UserSubscription | null;
    /** Active micro purchases */
    microPurchases: UserMicroPurchase[];
    /** Feature access map: feature_key -> boolean */
    features: Record<string, boolean>;
    /** Feature expiry map: feature_key -> ISO timestamp or null */
    featureExpires: Record<string, string | null>;
    /** Whether subscription data is loading */
    loading: boolean;
    /** Check if a specific feature is accessible */
    hasFeature: (featureKey: string) => boolean;
    /** Get expiry time for a feature (for countdown timer) */
    getFeatureExpiry: (featureKey: string) => Date | null;
    /** Refresh subscription data from server */
    refreshAccess: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Default access for non-logged-in or free users
const DEFAULT_ACCESS: FeatureAccess = {
    stage: 0,
    is_admin: false,
    subscription: null,
    active_micro_purchases: [],
    features: {
        dashboard: true,
        resume_preview: true,
        quiz_limited: true,
        analytics_limited: true,
        resume_download: false,
        resume_builder: false,
        roadmap_generate: false,
        interview_start: false,
        job_portal: false,
        ads_free: false,
    },
    feature_expires: {},
};

// ══════════════════════════════════════════════════════════════
// PROVIDER
// ══════════════════════════════════════════════════════════════

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady } = useAuth();
    const [access, setAccess] = useState<FeatureAccess>(DEFAULT_ACCESS);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    const fetchAccess = useCallback(async () => {
        if (!user) {
            setAccess(DEFAULT_ACCESS);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await getFeatureAccess();
            if (mountedRef.current) {
                setAccess(data);
            }
        } catch (err) {
            console.warn('SubscriptionContext: Failed to fetch feature access', err);
            // Keep existing access on failure (don't reset to default)
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [user]);

    // Fetch on mount and when user changes
    useEffect(() => {
        mountedRef.current = true;
        if (authReady) {
            fetchAccess();
        }
        return () => {
            mountedRef.current = false;
        };
    }, [authReady, fetchAccess]);

    // Auto-refresh every 60 seconds to catch expiry changes
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(fetchAccess, 60_000);
        return () => clearInterval(interval);
    }, [user, fetchAccess]);

    const hasFeature = useCallback(
        (featureKey: string): boolean => {
            // Admins always have full access
            if (access.is_admin) return true;
            return access.features[featureKey] ?? false;
        },
        [access],
    );

    const getFeatureExpiry = useCallback(
        (featureKey: string): Date | null => {
            const expiry = access.feature_expires[featureKey];
            if (!expiry) return null;
            return new Date(expiry);
        },
        [access],
    );

    const refreshAccess = useCallback(async () => {
        await fetchAccess();
    }, [fetchAccess]);

    const contextValue = useMemo<SubscriptionContextType>(
        () => ({
            stage: access.stage,
            isAdmin: access.is_admin,
            subscription: access.subscription,
            microPurchases: access.active_micro_purchases,
            features: access.features,
            featureExpires: access.feature_expires,
            loading,
            hasFeature,
            getFeatureExpiry,
            refreshAccess,
        }),
        [access, loading, hasFeature, getFeatureExpiry, refreshAccess],
    );

    return (
        <SubscriptionContext.Provider value={contextValue}>
            {children}
        </SubscriptionContext.Provider>
    );
};

// ══════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════

export const useSubscription = (): SubscriptionContextType => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};
