import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getUsageStatus, UsageStatus, UsageCounter } from '../services/usage';

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

const USAGE_CACHE_KEY = 'usage:status-cache';

function getCachedUsage(): UsageStatus | null {
    try {
        const raw = localStorage.getItem(USAGE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.plan ? parsed : null;
    } catch {
        localStorage.removeItem(USAGE_CACHE_KEY);
        return null;
    }
}

function setCachedUsage(data: UsageStatus | null) {
    try {
        if (data) {
            localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(data));
        } else {
            localStorage.removeItem(USAGE_CACHE_KEY);
        }
    } catch {
        // Ignore cache write failures.
    }
}

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady } = useAuth();
    const userKey = user?.id || user?.email || null;
    const initialUsage = getCachedUsage();

    const [usage, setUsage] = useState<UsageStatus | null>(initialUsage);
    const [loading, setLoading] = useState(() => !initialUsage);
    const [resolved, setResolved] = useState(() => !!initialUsage);
    const mountedRef = useRef(true);
    const activeUserKeyRef = useRef<string | null>(userKey);
    const inflightRequestRef = useRef<Promise<void> | null>(null);
    const inflightUserKeyRef = useRef<string | null>(null);

    useEffect(() => {
        activeUserKeyRef.current = userKey;
    }, [userKey]);

    const fetchUsage = useCallback(async (options: { foreground?: boolean } = {}) => {
        const { foreground = true } = options;
        const requestUserKey = userKey;

        if (!requestUserKey) {
            setUsage(null);
            setLoading(false);
            setResolved(true);
            setCachedUsage(null);
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

                const data = await getUsageStatus();
                if (mountedRef.current && activeUserKeyRef.current === requestUserKey) {
                    setUsage(data);
                    setResolved(true);
                    setCachedUsage(data);
                }
            } catch (err) {
                console.warn('UsageContext: Failed to fetch usage status', err);
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
        if (!userKey) {
            setUsage(null);
            setResolved(true);
            setLoading(false);
            setCachedUsage(null);
        }
    }, [userKey]);

    useEffect(() => {
        mountedRef.current = true;

        if (authReady) {
            void fetchUsage({ foreground: !getCachedUsage() });
        }

        return () => {
            mountedRef.current = false;
        };
    }, [authReady, fetchUsage, userKey]);

    useEffect(() => {
        if (!userKey) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            void fetchUsage({ foreground: false });
        }, 60_000);
        return () => clearInterval(interval);
    }, [userKey, fetchUsage]);

    const isLimitExceeded = useCallback(
        (counter: CounterName): boolean => {
            if (!resolved || !usage) return false;
            if (usage.is_admin) return false;
            const c = usage.counters[counter];
            if (!c) return false;
            if (c.limit === -1) return false;
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
        await fetchUsage({ foreground: true });
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

export const useUsage = (): UsageContextType => {
    const context = useContext(UsageContext);
    if (context === undefined) {
        throw new Error('useUsage must be used within a UsageProvider');
    }
    return context;
};
