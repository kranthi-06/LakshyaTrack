import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getUsageStatus, UsageStatus, UsageCounter } from '../services/usage';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type CounterName = 'resume_count' | 'interview_count_weekly' | 'plan_count' | 'resume_edit_monthly';

interface UsageContextType {
    /** Current usage status from the backend */
    usage: UsageStatus | null;
    /** Whether usage data is loading */
    loading: boolean;
    /** Whether usage data has been fetched at least once */
    resolved: boolean;
    /** Check if a specific counter has exceeded its limit */
    isLimitExceeded: (counter: CounterName) => boolean;
    /** Get usage details for a specific counter */
    getCounter: (counter: CounterName) => UsageCounter | null;
    /** Get remaining count for a counter (-1 = unlimited) */
    getRemaining: (counter: CounterName) => number;
    /** Get the limit for a counter (-1 = unlimited) */
    getLimit: (counter: CounterName) => number;
    /** Refresh usage data from the server */
    refreshUsage: () => Promise<void>;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

// ══════════════════════════════════════════════════════════════
// PROVIDER
// ══════════════════════════════════════════════════════════════

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady } = useAuth();

    const [usage, setUsage] = useState<UsageStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [resolved, setResolved] = useState(false);
    const mountedRef = useRef(true);

    // ── Fetch usage status from backend ───────────────────────
    const fetchUsage = useCallback(async () => {
        if (!user) {
            setUsage(null);
            setLoading(false);
            setResolved(true);
            return;
        }

        try {
            setLoading(true);
            const data = await getUsageStatus();
            if (mountedRef.current) {
                setUsage(data);
                setResolved(true);
            }
        } catch (err) {
            console.warn('UsageContext: Failed to fetch usage status', err);
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
            fetchUsage();
        }
        return () => {
            mountedRef.current = false;
        };
    }, [authReady, fetchUsage]);

    // ── Auto-refresh every 30 seconds to keep UI in sync ──────
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(fetchUsage, 30_000);
        return () => clearInterval(interval);
    }, [user, fetchUsage]);

    // ── Helper functions ──────────────────────────────────────
    const isLimitExceeded = useCallback(
        (counter: CounterName): boolean => {
            if (!resolved || !usage) return false;
            if (usage.is_admin) return false;
            const c = usage.counters[counter];
            if (!c) return false;
            if (c.limit === -1) return false; // unlimited
            return c.exceeded;
        },
        [resolved, usage],
    );

    const getCounter = useCallback(
        (counter: CounterName): UsageCounter | null => {
            if (!usage) return null;
            return usage.counters[counter] ?? null;
        },
        [usage],
    );

    const getRemaining = useCallback(
        (counter: CounterName): number => {
            if (!usage) return 0;
            if (usage.is_admin) return -1;
            const c = usage.counters[counter];
            if (!c) return 0;
            return c.remaining;
        },
        [usage],
    );

    const getLimit = useCallback(
        (counter: CounterName): number => {
            if (!usage) return 0;
            if (usage.is_admin) return -1;
            const c = usage.counters[counter];
            if (!c) return 0;
            return c.limit;
        },
        [usage],
    );

    const refreshUsage = useCallback(async () => {
        await fetchUsage();
    }, [fetchUsage]);

    const contextValue = useMemo<UsageContextType>(
        () => ({
            usage,
            loading,
            resolved,
            isLimitExceeded,
            getCounter,
            getRemaining,
            getLimit,
            refreshUsage,
        }),
        [usage, loading, resolved, isLimitExceeded, getCounter, getRemaining, getLimit, refreshUsage],
    );

    return (
        <UsageContext.Provider value={contextValue}>
            {children}
        </UsageContext.Provider>
    );
};

// ══════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════

export const useUsage = (): UsageContextType => {
    const context = useContext(UsageContext);
    if (context === undefined) {
        throw new Error('useUsage must be used within a UsageProvider');
    }
    return context;
};
