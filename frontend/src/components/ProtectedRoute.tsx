import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_LOADING_MS = 15000; // 15s safety timeout

/**
 * Check whether a non-empty auth token lives in localStorage.
 * This lets us distinguish "genuinely not logged in" from
 * "logged in but the backend/network was temporarily unreachable".
 */
function hasValidToken(): boolean {
    const token = localStorage.getItem('token');
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
    if (!authReady && !timedOut && hasValidToken()) {
        return <AuthLoadingScreen />;
    }

    // ── REDIRECT DECISIONS (only after auth loading is complete) ──

    // User object is available → render normally
    if (user) {
        return children;
    }

    // No user object, but a token exists in localStorage.
    // This means the network/backend was temporarily unreachable.
    // Render the page anyway instead of kicking the user to /login.
    if (hasValidToken()) {
        return children;
    }

    // Genuinely not authenticated — redirect to login
    return <Navigate to="/login" replace />;
};
