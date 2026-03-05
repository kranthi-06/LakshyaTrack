import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_LOADING_MS = 10000; // 10s safety timeout

export const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    const { user, loading } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    // Safety net: if loading takes too long, force a redirect to login
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

    return children;
};
