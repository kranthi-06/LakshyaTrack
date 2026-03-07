import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_LOADING_MS = 15000;

function hasValidToken(): boolean {
    const token = localStorage.getItem('token');
    return !!token && token !== 'undefined' && token !== 'null';
}

interface AdminRouteProps {
    children: React.ReactElement;
    requireBlackAdmin?: boolean;
}

export const AdminRoute = ({ children, requireBlackAdmin = false }: AdminRouteProps) => {
    const { user, loading, authReady } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => setTimedOut(true), MAX_LOADING_MS);
        return () => clearTimeout(timer);
    }, [loading]);

    // ── AUTH LOADING GUARD ──────────────────────────────────────
    if (loading && !timedOut) {
        return <AuthLoadingScreen />;
    }

    // Wait for full auth pipeline before redirecting
    if (!authReady && !timedOut && hasValidToken()) {
        return <AuthLoadingScreen />;
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

    // No user but token exists → network issue, render children to avoid logout
    if (hasValidToken()) {
        return children;
    }

    // Genuinely not authenticated
    return <Navigate to="/login" replace />;
};
