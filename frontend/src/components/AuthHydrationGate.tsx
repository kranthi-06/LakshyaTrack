import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const MAX_BOOTSTRAP_WAIT_MS = 20000;

export default function AuthHydrationGate({ children }: { children: React.ReactNode }) {
    const { loading, authReady } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (!loading && authReady) return;
        const timer = setTimeout(() => setTimedOut(true), MAX_BOOTSTRAP_WAIT_MS);
        return () => clearTimeout(timer);
    }, [loading, authReady]);

    if ((!authReady || loading) && !timedOut) {
        return <AuthLoadingScreen message="Connecting to LakshyaTrack..." />;
    }

    return <>{children}</>;
}
