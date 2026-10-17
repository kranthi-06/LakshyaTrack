import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';
import AuthRecoveryScreen from './AuthRecoveryScreen';
import { resolveRouteGuardState } from './routeGuardState';
import { useRouteGuardWait } from './useRouteGuardWait';

const TOKEN_KEY = 'token';

function hasToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && token !== 'undefined' && token !== 'null';
}

export const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    const { user, loading, authReady } = useAuth();
    const tokenPresent = hasToken();
    const waitExpired = useRouteGuardWait({
        loading,
        authReady,
        hasUser: Boolean(user),
        hasToken: tokenPresent,
    });
    const state = resolveRouteGuardState({
        loading,
        authReady,
        hasUser: Boolean(user),
        hasToken: tokenPresent,
        waitExpired,
    });

    // ── AUTH LOADING GUARD ──────────────────────────────────────
    // Wait until the authentication state is FULLY resolved before
    // making any redirect decisions. This prevents incorrect redirects
    // during slow network conditions or delayed Supabase responses.
    if (state === 'loading') {
        return <AuthLoadingScreen />;
    }

    // Waiting too long (auth unresolved, or a token exists but the user
    // can't be fetched) → offer retry / sign out instead of an endless loader.
    if (state === 'recover') {
        return <AuthRecoveryScreen reloadOnRetry={loading || !authReady} />;
    }

    // ── REDIRECT DECISIONS (only after auth loading is complete) ──

    // User object is available → render normally
    if (state === 'render') {
        return children;
    }

    // Genuinely not authenticated — redirect to login
    return <Navigate to="/login" replace />;
};
