import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_LOADING_MS = 10000;

interface AdminRouteProps {
    children: React.ReactElement;
    requireBlackAdmin?: boolean;
}

export const AdminRoute = ({ children, requireBlackAdmin = false }: AdminRouteProps) => {
    const { user, loading } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => setTimedOut(true), MAX_LOADING_MS);
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading && !timedOut) {
        return <AuthLoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const role = user.role || 'user';

    if (requireBlackAdmin && role !== 'black_admin') {
        return <Navigate to="/dashboard" replace />;
    }

    if (!requireBlackAdmin && role !== 'admin' && role !== 'black_admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};
