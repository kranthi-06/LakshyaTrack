import { useEffect, useMemo, useState } from 'react';
import {
    resolveRouteGuardState,
    SESSION_RESTORE_GRACE_MS,
} from './routeGuardState';

interface RouteGuardWaitInput {
    loading: boolean;
    authReady: boolean;
    hasUser: boolean;
    hasToken: boolean;
}

export function useRouteGuardWait(input: RouteGuardWaitInput): boolean {
    const stateBeforeExpiry = resolveRouteGuardState({
        ...input,
        waitExpired: false,
    });
    const waitCycle = useMemo(
        () => Symbol(`route guard wait: ${stateBeforeExpiry}`),
        [stateBeforeExpiry],
    );
    const [expiredWaitCycle, setExpiredWaitCycle] = useState<symbol | null>(null);

    useEffect(() => {
        if (stateBeforeExpiry !== 'loading') {
            return;
        }

        const timer = window.setTimeout(
            () => setExpiredWaitCycle(waitCycle),
            SESSION_RESTORE_GRACE_MS,
        );

        return () => window.clearTimeout(timer);
    }, [stateBeforeExpiry, waitCycle]);

    return stateBeforeExpiry === 'loading' && expiredWaitCycle === waitCycle;
}
