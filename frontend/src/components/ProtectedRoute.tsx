import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_LOADING_MS = 15000; // 15s safety timeout
const TOKEN_KEY = 'token';

function hasToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && token !== 'undefined' && token !== 'null';
}

export const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    const { user, loading, authReady } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    // Safety net: if loading takes too long, stop showing the spinner
    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => setTimedOut(true), MAX_LOADING_MS);
        return () => clearTimeout(timer);
    }, [loading]);

    // ── AUTH LOADING GUARD ──────────────────────────────────────
    // Wait until the authentication state is FULLY resolved before
    // making any redirect decisions. This prevents incorrect redirects
    // during slow network conditions or delayed Supabase responses.
    if (loading && !timedOut) {
        return <AuthLoadingScreen />;
    }

    // Even if `loading` just turned false, make sure the full init
    // pipeline has completed (authReady). If not, keep showing the
    // loading screen briefly — the init will finish momentarily.
    if (!authReady && !timedOut) {
        return <AuthLoadingScreen />;
    }

    // ── REDIRECT DECISIONS (only after auth loading is complete) ──

    // User object is available → render normally
    if (user) {
        return children;
    }

    // Keep the user on the authenticated route while a valid token still exists.
    // This prevents OAuth users from bouncing back to /login during temporary
    // backend hydration issues right after callback or refresh.
    if (hasToken()) {
        return <AuthLoadingScreen />;
    }

    // Genuinely not authenticated — redirect to login
    return <Navigate to="/login" replace />;
};
