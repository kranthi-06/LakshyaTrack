import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

/**
 * OAuth Callback — Strict Google Sign-In Flow
 *
 * Flow:
 *   Google OAuth → this page (loading screen) → session verified → /begin
 *
 * Rules:
 *   • NEVER redirect to /login during the OAuth process.
 *   • Show an error message if OAuth fails, with a retry button.
 *   • Only redirect after auth state is fully resolved.
 */
const OAUTH_TIMEOUT_MS = 20000; // 20s max wait for the full OAuth flow

export default function AuthCallback() {
    const { user, loading, authReady } = useAuth();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (hasNavigated.current) return;

        // Still loading — wait for auth to resolve
        if (loading || !authReady) return;

        // Auth resolved with a user — redirect to /begin
        if (user) {
            hasNavigated.current = true;
            navigate('/begin', { replace: true });
            return;
        }

        // Auth resolved WITHOUT a user, but a token exists.
        // This can happen if the backend is slow but the Supabase token is valid.
        // Give it more time — the onAuthStateChange handler may still fire.
        const token = localStorage.getItem('token');
        if (token && token !== 'undefined' && token !== 'null') {
            // Token exists — wait for onAuthStateChange to process SIGNED_IN
            return;
        }

        // No user AND no token — something went wrong. Show an error.
        // Do NOT redirect to /login automatically.
        setError('Google sign-in could not be completed. Please try again.');
    }, [user, loading, authReady, navigate]);

    // Safety timeout — if the entire OAuth process takes too long,
    // show an error rather than leave the user stuck on the loading screen.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasNavigated.current && !user) {
                setError('Google sign-in is taking too long. Please try again.');
            }
        }, OAUTH_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [user]);

    // Error state — show a clear message with retry, never auto-redirect to /login
    if (error) {
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #6366f1 75%, #818cf8 100%)',
                    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                    zIndex: 9999,
                }}
            >
                <div
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '48px',
                        textAlign: 'center',
                        maxWidth: '420px',
                    }}
                >
                    {/* Error icon */}
                    <div
                        style={{
                            width: '64px',
                            height: '64px',
                            background: 'rgba(239,68,68,0.2)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                            fontSize: '28px',
                        }}
                    >
                        ⚠️
                    </div>
                    <h2
                        style={{
                            color: 'white',
                            fontSize: '20px',
                            fontWeight: 800,
                            margin: '0 0 12px',
                        }}
                    >
                        Sign-In Issue
                    </h2>
                    <p
                        style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '14px',
                            fontWeight: 500,
                            lineHeight: 1.6,
                            margin: '0 0 28px',
                        }}
                    >
                        {error}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button
                            onClick={() => {
                                setError(null);
                                hasNavigated.current = false;
                                window.location.href = '/login';
                            }}
                            style={{
                                padding: '12px 28px',
                                borderRadius: '12px',
                                border: '2px solid rgba(255,255,255,0.2)',
                                background: 'transparent',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Back to Login
                        </button>
                        <button
                            onClick={() => {
                                setError(null);
                                hasNavigated.current = false;
                                // Retry — reload the callback page to re-trigger auth flow
                                window.location.reload();
                            }}
                            style={{
                                padding: '12px 28px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default: show the premium loading screen while auth resolves
    return <AuthLoadingScreen />;
}
