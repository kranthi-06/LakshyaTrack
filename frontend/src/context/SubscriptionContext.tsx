import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
    getSubscriptionStatus,
    SubscriptionStatus,
} from '../services/subscription';

// TYPES

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

const SUB_CACHE_KEY = 'sub:status-cache';

function getCachedSubscription(): SubscriptionStatus | null {
    try {
        const raw = localStorage.getItem(SUB_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.plan ? parsed : null;
    } catch {
        localStorage.removeItem(SUB_CACHE_KEY);
        return null;
    }
}

function setCachedSubscription(data: SubscriptionStatus | null) {
    try {
        if (data) {
            localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(data));
        } else {
            localStorage.removeItem(SUB_CACHE_KEY);
        }
    } catch {
        // Ignore cache write failures.
    }
}

function getHydratedSubscription(snapshot: unknown): SubscriptionStatus | null {
    if (!snapshot || typeof snapshot !== 'object') return null;

    const candidate = snapshot as Partial<SubscriptionStatus>;
    return candidate.plan ? (candidate as SubscriptionStatus) : null;
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady } = useAuth();
    const userKey = user?.id || user?.email || null;
    const hydratedSubscription = useMemo(
        () => getHydratedSubscription(user?.subscription_status),
        [user?.subscription_status],
    );
    const initialSubscription = hydratedSubscription || getCachedSubscription();

    // Seed from the hydrated auth snapshot or the last known cache so the UI
    // can render immediately, then validate in the background.
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(initialSubscription);
    const [loading, setLoading] = useState(() => !initialSubscription);
    const [resolved, setResolved] = useState(() => !!initialSubscription);
    const mountedRef = useRef(true);
    const activeUserKeyRef = useRef<string | null>(userKey);
    const inflightRequestRef = useRef<Promise<void> | null>(null);
    const inflightUserKeyRef = useRef<string | null>(null);

    useEffect(() => {
        activeUserKeyRef.current = userKey;
    }, [userKey]);

    const fetchStatus = useCallback(async (options: { foreground?: boolean } = {}) => {
        const { foreground = true } = options;
        const requestUserKey = userKey;

        if (!requestUserKey) {
            setSubscriptionData(null);
            setLoading(false);
            setResolved(true);
            setCachedSubscription(null);
            return;
        }

        if (inflightRequestRef.current && inflightUserKeyRef.current === requestUserKey) {
            return inflightRequestRef.current;
        }

        const request = (async () => {
            try {
                if (foreground) {
                    setLoading(true);
                }

                const data = await getSubscriptionStatus();
                if (mountedRef.current && activeUserKeyRef.current === requestUserKey) {
                    setSubscriptionData(data);
                    setResolved(true);
                    setCachedSubscription(data);
                }
            } catch (err) {
                console.warn('SubscriptionContext: Failed to fetch subscription status', err);
                if (mountedRef.current && activeUserKeyRef.current === requestUserKey) {
                    setResolved(true);
                }
            } finally {
                if (mountedRef.current && activeUserKeyRef.current === requestUserKey && foreground) {
                    setLoading(false);
                }
            }
        })();

        inflightUserKeyRef.current = requestUserKey;
        const trackedRequest = request.finally(() => {
            if (inflightRequestRef.current === trackedRequest) {
                inflightRequestRef.current = null;
                inflightUserKeyRef.current = null;
            }
        });
        inflightRequestRef.current = trackedRequest;
        return trackedRequest;
    }, [userKey]);

    useEffect(() => {
        if (hydratedSubscription) {
            setSubscriptionData(hydratedSubscription);
            setResolved(true);
            setLoading(false);
            setCachedSubscription(hydratedSubscription);
            return;
        }

        if (!userKey) {
            setSubscriptionData(null);
            setResolved(true);
            setLoading(false);
            setCachedSubscription(null);
        }
    }, [hydratedSubscription, userKey]);

    useEffect(() => {
        mountedRef.current = true;

        if (authReady) {
            void fetchStatus({ foreground: !(hydratedSubscription || getCachedSubscription()) });
        }

        return () => {
            mountedRef.current = false;
        };
    }, [authReady, fetchStatus, hydratedSubscription, userKey]);

    useEffect(() => {
        if (!userKey) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            void fetchStatus({ foreground: false });
        }, 120_000);
        return () => clearInterval(interval);
    }, [userKey, fetchStatus]);

    const stage = subscriptionData?.stage ?? 0;
    const plan = subscriptionData?.plan ?? 'free';
    const status = subscriptionData?.status ?? 'none';
    const isAdmin = subscriptionData?.is_admin ?? false;
    const features = useMemo(
        () => ({
            ...ALWAYS_AVAILABLE_FEATURES,
            ...(subscriptionData?.features ?? {}),
        }),
        [subscriptionData?.features],
    );
    const featureExpires = useMemo(
        () => subscriptionData?.feature_expires ?? {},
        [subscriptionData?.feature_expires],
    );
    const expiresAt = subscriptionData?.expires_at ?? null;

    const hasFeature = useCallback(
        (featureKey: string): boolean => {
            if (!resolved) return false;
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
        await fetchStatus({ foreground: true });
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

export const useSubscription = (): SubscriptionContextType => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};
