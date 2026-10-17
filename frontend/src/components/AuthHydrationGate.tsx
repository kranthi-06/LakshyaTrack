import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_BOOTSTRAP_WAIT_MS = 20000;
const PUBLIC_PATHS = new Set([
    '/',
    '/login',
    '/register',
    '/verify-email',
    '/auth/callback',
    '/begin',
]);

export default function AuthHydrationGate({ children }: { children: React.ReactNode }) {
    const { loading, authReady } = useAuth();
    const { pathname } = useLocation();
    const isPublicPath = PUBLIC_PATHS.has(pathname);
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (isPublicPath || (!loading && authReady)) return;
        const timer = setTimeout(() => setTimedOut(true), MAX_BOOTSTRAP_WAIT_MS);
        return () => clearTimeout(timer);
    }, [loading, authReady, isPublicPath]);

    if (isPublicPath) {
        return <>{children}</>;
    }

    if ((!authReady || loading) && !timedOut) {
        return <AuthLoadingScreen message="Connecting to LakshyaTrack..." />;
    }

    return <>{children}</>;
}
