import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
    getSubscriptionStatus,
    SubscriptionStatus,
} from '../services/subscription';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface SubscriptionContextType {
    /** Current subscription stage (0-3) */
    stage: number;
    /** Plan name: 'free' | 'starter' | 'professional' | 'ultimate' */
    plan: string;
    /** Subscription status: 'active' | 'expired' | 'cancelled' | 'none' */
    status: string;
    /** Whether the user is admin/super-admin */
    isAdmin: boolean;
    /** Feature access map: feature_key -> boolean */
    features: Record<string, boolean>;
    /** Feature expiry map: feature_key -> ISO timestamp or null */
    featureExpires: Record<string, string | null>;
    /** Subscription expiry date (ISO string or null) */
    expiresAt: string | null;
    /**
     * Whether subscription data is loading.
     * Components MUST check this before rendering subscription-dependent UI.
     * If loading is true, show a skeleton/shimmer — NEVER default to free.
     */
    loading: boolean;
    /**
     * Whether the subscription data has been fetched at least once.
     * This prevents the "free -> premium" flicker on first render.
     */
    resolved: boolean;
    /** Check if a specific feature is accessible */
    hasFeature: (featureKey: string) => boolean;
    /** Get expiry time for a feature (for countdown timer) */
    getFeatureExpiry: (featureKey: string) => Date | null;
    /** Refresh subscription data from server */
    refreshAccess: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const ALWAYS_AVAILABLE_FEATURES: Record<string, boolean> = {
    dashboard: true,
    resume_preview: true,
    quiz_limited: true,
    analytics_limited: true,
    resume_download: true,
    resume_builder: true,
    roadmap_generate: true,
    interview_start: true,
    job_portal: true,
};

// ══════════════════════════════════════════════════════════════
// PROVIDER
// ══════════════════════════════════════════════════════════════

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady } = useAuth();

    // ── State ──────────────────────────────────────────────────
    // CRITICAL: We do NOT initialize with any default subscription data.
    // The initial state is "loading" until the backend responds.
    // This prevents the free -> premium flicker entirely.
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [resolved, setResolved] = useState(false);
    const mountedRef = useRef(true);

    // ── Fetch subscription status from backend ────────────────
    const fetchStatus = useCallback(async () => {
        if (!user) {
            // No user = definitely free, no need to call API
            setSubscriptionData(null);
            setLoading(false);
            setResolved(true);
            return;
        }

        try {
            setLoading(true);
            const data = await getSubscriptionStatus();
            if (mountedRef.current) {
                setSubscriptionData(data);
                setResolved(true);
            }
        } catch (err) {
            console.warn('SubscriptionContext: Failed to fetch subscription status', err);
            // On failure, mark as resolved with null data (free tier)
            // so the UI doesn't stay loading forever
            if (mountedRef.current) {
                setResolved(true);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [user]);

    // ── Fetch on mount and when user/authReady changes ────────
    useEffect(() => {
        mountedRef.current = true;

        if (authReady) {
            fetchStatus();
        }

        return () => {
            mountedRef.current = false;
        };
    }, [authReady, fetchStatus]);

    // ── Auto-refresh every 60 seconds to catch expiry changes ─
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(fetchStatus, 60_000);
        return () => clearInterval(interval);
    }, [user, fetchStatus]);

    // ── Derived values ────────────────────────────────────────
    const stage = subscriptionData?.stage ?? 0;
    const plan = subscriptionData?.plan ?? 'free';
    const status = subscriptionData?.status ?? 'none';
    const isAdmin = subscriptionData?.is_admin ?? false;
    const features = {
        ...ALWAYS_AVAILABLE_FEATURES,
        ...(subscriptionData?.features ?? {}),
    };
    const featureExpires = subscriptionData?.feature_expires ?? {};
    const expiresAt = subscriptionData?.expires_at ?? null;

    const hasFeature = useCallback(
        (featureKey: string): boolean => {
            // If not resolved yet, deny access (safe default)
            if (!resolved) return false;
            // Admins always have full access
            if (isAdmin) return true;
            return features[featureKey] ?? false;
        },
        [resolved, isAdmin, features],
    );

    const getFeatureExpiry = useCallback(
        (featureKey: string): Date | null => {
            const expiry = featureExpires[featureKey];
            if (!expiry) return null;
            return new Date(expiry);
        },
        [featureExpires],
    );

    const refreshAccess = useCallback(async () => {
        await fetchStatus();
    }, [fetchStatus]);

    const contextValue = useMemo<SubscriptionContextType>(
        () => ({
            stage,
            plan,
            status,
            isAdmin,
            features,
            featureExpires,
            expiresAt,
            loading,
            resolved,
            hasFeature,
            getFeatureExpiry,
            refreshAccess,
        }),
        [stage, plan, status, isAdmin, features, featureExpires, expiresAt, loading, resolved, hasFeature, getFeatureExpiry, refreshAccess],
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
