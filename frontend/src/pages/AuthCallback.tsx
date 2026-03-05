import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

/**
 * This page is shown during OAuth callbacks (e.g., Google Sign-In redirect).
 * It displays a premium loading screen while the AuthContext processes the session.
 * Once the user is set, it redirects to the dashboard.
 * If auth fails after a timeout, it redirects to login.
 */
export default function AuthCallback() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    useEffect(() => {
        if (hasNavigated.current) return;

        // If loading is done, decide where to go
        if (!loading) {
            if (user) {
                hasNavigated.current = true;
                navigate('/dashboard', { replace: true });
            } else {
                // The AuthContext's onAuthStateChange handler will often navigate
                // for us, but as a safety net, wait a bit then redirect to login.
                const timeout = setTimeout(() => {
                    if (!hasNavigated.current) {
                        hasNavigated.current = true;
                        navigate('/login', { replace: true });
                    }
                }, 5000);
                return () => clearTimeout(timeout);
            }
        }
    }, [user, loading, navigate]);

    return <AuthLoadingScreen />;
}
