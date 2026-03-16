import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

/**
 * OAuth Callback — PKCE Flow Handler
 *
 * With PKCE, Google OAuth redirects here with ?code=... in the URL.
 * This page exchanges the code for a session, then redirects to /dashboard.
 *
 * Flow:
 *   Google OAuth → /auth/callback?code=... → exchange code → session → /dashboard
 *
 * Rules:
 *   • NEVER show the landing page during this process.
 *   • Exchange the PKCE code immediately on mount.
 *   • Show the premium loading screen while processing.
 *   • Only redirect after auth state is fully resolved.
 *   • Show an error with retry if something fails.
 */
const OAUTH_TIMEOUT_MS = 20000; // 20s max wait for the full OAuth flow
const OAUTH_ERROR_STORAGE_KEY = 'auth:last_oauth_error';

export default function AuthCallback() {
    const { user, loading, authReady } = useAuth();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);
    const codeExchanged = useRef(false);
    const [error, setError] = useState<string | null>(null);

    // Step 0: If Supabase redirected back with an explicit error, capture it and
    // send the user back to the login page with clear guidance.
    useEffect(() => {
        const url = new URL(window.location.href);
        const oauthError = url.searchParams.get('error');
        if (!oauthError) return;

        const errorCode = url.searchParams.get('error_code');
        const errorDescription = url.searchParams.get('error_description') || undefined;
        const normalizedDescription = errorDescription?.replace(/\+/g, ' ');

        const suggestRegister = !!normalizedDescription?.toLowerCase().includes('database error saving new user');
        const friendlyMessage = suggestRegister
            ? 'We could not finish Google sign-in because this Google account is new here. Please create an account first, then connect Google.'
            : normalizedDescription || 'Google sign-in could not be completed. Please try again.';

        sessionStorage.setItem(
            OAUTH_ERROR_STORAGE_KEY,
            JSON.stringify({
                message: friendlyMessage,
                reason: oauthError,
                code: errorCode,
                suggestRegister,
                ts: Date.now(),
            })
        );

        // Clean any partial session so the next attempt starts from a known state.
        localStorage.removeItem('token');
        supabase.auth.signOut().catch(() => {});

        hasNavigated.current = true;
        navigate('/login', { replace: true });
    }, [navigate]);

    // Step 1: Exchange the PKCE authorization code for a session
    useEffect(() => {
        if (codeExchanged.current) return;

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
            codeExchanged.current = true;
            // Supabase's exchangeCodeForSession handles the PKCE code exchange.
            // After this, onAuthStateChange in AuthContext will fire SIGNED_IN.
            supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
                if (exchangeError) {
                    console.error('AuthCallback: Code exchange failed', exchangeError);
                    setError('Google sign-in could not be completed. Please try again.');
                }
                // Clean the URL of the code parameter (cosmetic)
                window.history.replaceState({}, '', '/auth/callback');
            });
        } else if (
            // Legacy implicit flow fallback: check for hash fragments
            !window.location.hash.includes('access_token')
        ) {
            // No code and no hash token — might be a direct visit or stale callback
            // Wait briefly for auth state to resolve before showing error
        }
    }, []);

    // Step 2: Navigate once auth resolves
    useEffect(() => {
        if (hasNavigated.current || error) return;

        // Still loading — wait for auth to resolve
        if (loading || !authReady) return;

        // Auth resolved with a user — go to dashboard
        if (user) {
            hasNavigated.current = true;
            navigate('/dashboard', { replace: true });
            return;
        }

        // Auth resolved WITHOUT a user, but a token exists.
        // The backend might be slow — wait for onAuthStateChange to finish.
        const token = localStorage.getItem('token');
        if (token && token !== 'undefined' && token !== 'null') {
            return; // Token exists — wait for SIGNED_IN event
        }

        // No user AND no token — something went wrong. Show an error.
        setError('Google sign-in could not be completed. Please try again.');
    }, [user, loading, authReady, navigate, error]);

    // Safety timeout — don't leave user stuck forever
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasNavigated.current && !user) {
                setError('Google sign-in is taking too long. Please try again.');
            }
        }, OAUTH_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [user]);

    // Error state — show a clear message with retry
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
                                codeExchanged.current = false;
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
