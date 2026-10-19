import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';
import AuthRecoveryScreen from './AuthRecoveryScreen';
import { resolveRouteGuardState } from './routeGuardState';
import { useRouteGuardWait } from './useRouteGuardWait';

interface AdminRouteProps {
    children: React.ReactElement;
    requireBlackAdmin?: boolean;
}

export const AdminRoute = ({ children, requireBlackAdmin = false }: AdminRouteProps) => {
    const { user, loading, authReady, authUnavailable } = useAuth();
    const waitExpired = useRouteGuardWait({
        loading,
        authReady,
        authUnavailable,
        hasUser: Boolean(user),
        hasToken: false,
    });
    const state = resolveRouteGuardState({
        loading,
        authReady,
        authUnavailable,
        hasUser: Boolean(user),
        hasToken: false,
        waitExpired,
    });

    // ── AUTH LOADING GUARD ──────────────────────────────────────
    if (state === 'loading') {
        return <AuthLoadingScreen />;
    }

    // Wait for full auth pipeline before redirecting
    if (state === 'recover') {
        return <AuthRecoveryScreen reloadOnRetry={loading || !authReady} />;
    }

    // ── REDIRECT DECISIONS (only after auth loading is complete) ──

    // If user object is available, do normal role checks
    if (user) {
        const role = user.role || 'user';

        if (requireBlackAdmin && role !== 'black_admin') {
            return <Navigate to="/dashboard" replace />;
        }

        if (!requireBlackAdmin && role !== 'admin' && role !== 'black_admin') {
            return <Navigate to="/dashboard" replace />;
        }

        return children;
    }

    // Genuinely not authenticated
    return <Navigate to="/login" replace />;
};
