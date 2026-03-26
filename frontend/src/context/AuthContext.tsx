import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { login as loginApi, register as registerApi, getMe, verifyOtp as verifyOtpApi, sendOtp as sendOtpApi } from '../services/auth';
import { setAuthInitialized, setUnauthorizedHandler } from '../services/api';
import { invalidateCache } from '../services/cache';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { touchDailyStreak } from '../services/careerPlatform';
import { useAuthStore } from '../store/authStore';

interface User {
    email: string;
    full_name?: string;
    profile?: {
        full_name?: string;
        profile_image_url?: string;
        profile_photo_url?: string;
        resume_url?: string;
        certificate_url?: string;
        project_image_url?: string;
        phone_number?: string;
        bio?: string;
        links?: Record<string, any>;
        resume_step?: number;
        resume_completion?: number;
        skills?: string[];
    };
    is_active?: boolean;
    role?: 'user' | 'admin' | 'black_admin';
    is_blacklisted?: boolean;
    last_active_at?: string;
    created_at?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    authReady: boolean;  // true once the full init pipeline has completed
    login: (data: any) => Promise<void>;
    register: (data: any) => Promise<any>;
    verifyOtp: (email: string, otp: string) => Promise<void>;
    resendOtp: (email: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Constants ────────────────────────────────────────────────
const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/auth/callback', '/begin'];
const SUPABASE_TIMEOUT_MS = 4000;
const AUTH_CALLBACK_SAFETY_TIMEOUT_MS = 8000;
const BACKEND_FETCH_TIMEOUT_MS = 10000; // Max wait for /users/me during init
const TOKEN_KEY = 'token';
const USER_CACHE_KEY = 'auth:user-cache';
const RETRY_INTERVAL_MS = 15000; // Retry fetching user every 15s when offline

/** Check whether a non-empty auth token lives in localStorage */
function hasValidToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && token !== 'undefined' && token !== 'null';
}

function getCachedUserSnapshot(): User | null {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as User;
        return parsed?.email ? parsed : null;
    } catch {
        localStorage.removeItem(USER_CACHE_KEY);
        return null;
    }
}

function buildSessionFallbackUser(sessionOrUser: any): User | null {
    const rawUser = sessionOrUser?.user || sessionOrUser;
    const email = rawUser?.email;
    if (!email) return null;

    const fullName =
        rawUser?.user_metadata?.full_name ||
        rawUser?.user_metadata?.name ||
        rawUser?.identities?.[0]?.identity_data?.full_name ||
        undefined;

    return {
        email,
        full_name: fullName,
        profile: fullName ? { full_name: fullName } : undefined,
        is_active: true,
    };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const user = useAuthStore((s) => s.user) as User | null;
    const loading = useAuthStore((s) => s.loading);
    const setStoreUser = useAuthStore((s) => s.setUser);
    const setStoreLoading = useAuthStore((s) => s.setLoading);
    const storeLogout = useAuthStore((s) => s.logout);
    const [authReady, setAuthReady] = useState(false); // Only true after full init
    const navigate = useNavigate();

    // Track state inside closures to avoid stale reads
    const userRef = useRef<User | null>(null);
    const mountedRef = useRef(true);
    const authInProgressRef = useRef(false); // Prevents duplicate auth flows
    const explicitLogoutRef = useRef(false); // Tracks if user explicitly clicked logout
    const initCompleteRef = useRef(false); // Has the init pipeline finished?

    const updateUser = useCallback((u: User | null) => {
        userRef.current = u;
        setStoreUser(u);
        if (u) {
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
        } else {
            localStorage.removeItem(USER_CACHE_KEY);
        }
    }, [setStoreUser]);

    /**
     * Safely attempt to fetch the current user from backend.
     * On network / timeout errors, returns the EXISTING user (if any)
     * so we never accidentally wipe a valid session due to a connectivity blip.
     * During initial load, enforces a timeout so the app doesn't hang forever.
     */
    const fetchCurrentUser = useCallback(async (withTimeout = false, bypassCache = false): Promise<User | null> => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token || token === 'undefined' || token === 'null') {
            return null;
        }
        try {
            let userData: any;
            if (withTimeout) {
                // During init: race against a timeout so a hung backend doesn't
                // leave the user stuck on the loading screen forever.
                userData = await Promise.race([
                    getMe(bypassCache),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('backend_timeout')), BACKEND_FETCH_TIMEOUT_MS)
                    ),
                ]);
            } else {
                userData = await getMe(bypassCache);
            }
            return userData;
        } catch (err: any) {
            // Only clear token on GENUINE 401 (token is truly invalid/expired).
            // Network errors, timeouts, 500s etc. should NOT log the user out.
            const status = err?.response?.status;
            if (status === 401) {
                // Don't clear token during initial load — could be a race condition
                if (initCompleteRef.current) {
                    console.warn('AuthContext: Token invalid (401) — clearing.');
                    localStorage.removeItem(TOKEN_KEY);
                    invalidateCache('auth:');
                }
                return null;
            }
            // For any other error (network, timeout, 500), keep the token
            // AND preserve the existing user so we don't trigger a redirect.
            console.warn('AuthContext: Failed to fetch user (non-auth error, keeping token & user)', err?.message || err);
            return userRef.current || getCachedUserSnapshot();
        }
    }, []);

    // ── Background retry: re-fetch user when token exists but user is null ──
    useEffect(() => {
        const interval = setInterval(async () => {
            // Only retry if we have a token but no user (network temporarily failed)
            if (!hasValidToken() || userRef.current) return;
            console.log('AuthContext: Background retry — attempting to fetch user...');
            try {
                const userData = await getMe();
                if (userData && mountedRef.current) {
                    updateUser(userData);
                    console.log('AuthContext: Background retry succeeded, user restored.');
                }
            } catch {
                // Silently ignore — will retry next interval
            }
        }, RETRY_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [updateUser]);

    // ── Re-fetch user when the browser comes back online ──────
    useEffect(() => {
        const handleOnline = async () => {
            if (!hasValidToken() || userRef.current) return;
            console.log('AuthContext: Browser came online — re-fetching user...');
            try {
                const userData = await getMe();
                if (userData && mountedRef.current) {
                    updateUser(userData);
                }
            } catch {
                // Will be retried by background interval
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [updateUser]);

    // ── Initialise auth state on mount ──────────────────────────
    useEffect(() => {
        mountedRef.current = true;

        const initSession = async () => {
            if (authInProgressRef.current) return;
            authInProgressRef.current = true;
            initCompleteRef.current = false;

            try {
                // 1. Try Supabase session (with timeout so we don't hang on paused projects)
                let supabaseSession: any = null;
                try {
                    const result: any = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('timeout')), SUPABASE_TIMEOUT_MS)
                        ),
                    ]);
                    supabaseSession = result?.data?.session || null;
                } catch {
                    console.warn('AuthContext: Supabase session check timed out — falling back to local token.');
                }

                if (!mountedRef.current) return;

                // 2. Fetch user from backend (with timeout during init)
                if (supabaseSession) {
                    // Supabase has a valid session — store the token and fetch user
                    localStorage.setItem(TOKEN_KEY, supabaseSession.access_token);
                    const backendUser = await fetchCurrentUser(true);
                    const resolvedUser = backendUser || buildSessionFallbackUser(supabaseSession);
                    if (mountedRef.current) updateUser(resolvedUser);
                } else {
                    // No Supabase session — try local token (custom email/password login)
                    const userData = await fetchCurrentUser(true);
                    if (mountedRef.current) updateUser(userData);
                }
            } catch (err) {
                console.error('AuthContext: Session init error', err);
            } finally {
                authInProgressRef.current = false;
                initCompleteRef.current = true;
                setAuthInitialized(); // Tell api.ts interceptor that init is done

                if (!mountedRef.current) return;

                // If this is an OAuth callback page, give Supabase a moment to fire
                // the SIGNED_IN event before we clear the loading state.
                const isOAuthCallback =
                    window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.search.includes('code') ||
                    window.location.pathname === '/auth/callback';

                if (isOAuthCallback) {
                    // Safety net: clear loading after a generous timeout
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setStoreLoading(false);
                            setAuthReady(true);
                        }
                    }, AUTH_CALLBACK_SAFETY_TIMEOUT_MS);
                } else {
                    setStoreLoading(false);
                    setAuthReady(true);
                }
            }
        };

        initSession();

        // 2. Listen for Supabase auth state changes (Google Sign‑In, token refresh, sign‑out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('AuthContext: onAuthStateChange', event);

            if (event === 'SIGNED_IN' && session) {
                invalidateCache('auth:');
                localStorage.setItem(TOKEN_KEY, session.access_token);

                try {
                    const backendUser = await fetchCurrentUser();
                    const resolvedUser = backendUser || buildSessionFallbackUser(session);
                    if (!mountedRef.current) return;
                    updateUser(resolvedUser);
                    if (backendUser) {
                        touchDailyStreak().catch(() => { });
                    }

                    // Navigate only when the user is on a public / callback page
                    const currentPath = window.location.pathname;
                    if (PUBLIC_PATHS.includes(currentPath)) {
                        navigate('/dashboard', { replace: true });
                    }
                } catch (err: any) {
                    // ── STRICT OAUTH FIX ──────────────────────────────────
                    // Do NOT redirect to /login during SIGNED_IN. The backend
                    // may be slow or temporarily down. Keep the token and let
                    // the AuthCallback / route guards handle the UX gracefully.
                    console.error('AuthContext: Backend sync failed on SIGNED_IN', err);

                    // Only clear token on genuine 401 (token truly invalid)
                    const status = err?.response?.status;
                    if (status === 401) {
                        localStorage.removeItem(TOKEN_KEY);
                        invalidateCache('auth:');
                        await supabase.auth.signOut().catch(() => { });
                        if (mountedRef.current) updateUser(null);
                    }
                    // For network / timeout / 500 errors, keep the token —
                    // the user has a valid Google session even if our backend
                    // is temporarily unreachable.
                }
            } else if (event === 'TOKEN_REFRESHED' && session) {
                // Silent refresh — just update the token, don't navigate anywhere
                localStorage.setItem(TOKEN_KEY, session.access_token);
            } else if (event === 'SIGNED_OUT') {
                // ── CRITICAL FIX ──────────────────────────────────────────
                // Supabase can fire spurious SIGNED_OUT events during network
                // issues or SDK reconnection. Only honour this event if:
                //   a) The user explicitly clicked logout, OR
                //   b) The token has already been removed (genuine sign-out)
                if (explicitLogoutRef.current || !hasValidToken()) {
                    explicitLogoutRef.current = false;
                    localStorage.removeItem(TOKEN_KEY);
                    invalidateCache('auth:');
                    if (mountedRef.current) {
                        updateUser(null);
                        navigate('/login', { replace: true });
                    }
                } else {
                    console.warn('AuthContext: Ignoring spurious SIGNED_OUT event (token still exists). Likely a network issue.');
                }
            }

            // Always ensure loading is cleared after an event
            if (mountedRef.current) setStoreLoading(false);
        });

        return () => {
            mountedRef.current = false;
            subscription.unsubscribe();
        };
    }, [fetchCurrentUser, navigate, setStoreLoading, updateUser]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        // Optional fast hydration: seed user from cache while revalidating with backend.
        try {
            const raw = localStorage.getItem(USER_CACHE_KEY);
            if (raw && hasValidToken() && !userRef.current) {
                const parsed = JSON.parse(raw) as User;
                if (parsed?.email) {
                    updateUser(parsed);
                }
            }
        } catch {
            localStorage.removeItem(USER_CACHE_KEY);
        }
    }, [updateUser]);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            explicitLogoutRef.current = true;
            localStorage.removeItem(TOKEN_KEY);
            invalidateCache('auth:');
            updateUser(null);
            storeLogout();
            if (window.location.pathname !== '/login') {
                navigate('/login', { replace: true });
            }
        });
        return () => setUnauthorizedHandler(null);
    }, [navigate, storeLogout, updateUser]);

    // ── Email + Password Login ──────────────────────────────────
    const login = useCallback(async (data: any) => {
        const response = await loginApi(data.username || data.email, data.password);
        if (response.access_token) {
            localStorage.setItem(TOKEN_KEY, response.access_token);
            invalidateCache('auth:');
            invalidateCache('roadmap:');
            invalidateCache('progress:');
            const userData = await getMe();
            updateUser(userData);
            // Best-effort daily streak touch (non-blocking).
            touchDailyStreak().catch(() => { });
            navigate('/dashboard', { replace: true });
        }
    }, [navigate, updateUser]);

    // ── Registration (no auto‑login — OTP verification required) ─
    const register = useCallback(async (data: any) => {
        return await registerApi(data);
    }, []);

    // ── OTP Verification ────────────────────────────────────────
    const verifyOtp = useCallback(async (email: string, otp: string) => {
        const response = await verifyOtpApi(email, otp);
        if (response.access_token) {
            localStorage.setItem(TOKEN_KEY, response.access_token);
            invalidateCache('auth:');
            invalidateCache('roadmap:');
            invalidateCache('progress:');
            const userData = await getMe();
            updateUser(userData);
            touchDailyStreak().catch(() => { });
        }
    }, [updateUser]);

    // ── Resend OTP ──────────────────────────────────────────────
    const resendOtp = useCallback(async (email: string) => {
        await sendOtpApi(email);
    }, []);

    // ── Refresh User Data ───────────────────────────────────────
    const refreshUser = useCallback(async () => {
        const userData = await fetchCurrentUser(false, true);
        if (userData && mountedRef.current) {
            updateUser(userData);
            // Touch streak on first successful refresh each day (safe to call often).
            touchDailyStreak().catch(() => { });
        }
    }, [fetchCurrentUser, updateUser]);

    // ── Google Sign‑In via Supabase ─────────────────────────────
    const signInWithGoogle = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/auth/callback',
            },
        });
        if (error) throw error;
        // Supabase handles the redirect. The onAuthStateChange listener
        // will pick up the SIGNED_IN event on the callback page.
    }, []);

    // ── Logout ──────────────────────────────────────────────────
    const logout = useCallback(async () => {
        explicitLogoutRef.current = true; // Mark this as an explicit user action
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_CACHE_KEY);
        invalidateCache('auth:');
        invalidateCache('roadmap:');
        invalidateCache('progress:');
        // Sign out from Supabase too (if applicable)
        await supabase.auth.signOut().catch(() => { });
        updateUser(null);
        storeLogout();
        navigate('/login', { replace: true });
    }, [navigate, storeLogout, updateUser]);

    const contextValue = useMemo(() => ({
        user,
        loading,
        authReady,
        login,
        register,
        verifyOtp,
        resendOtp,
        signInWithGoogle,
        logout,
        refreshUser,
    }), [user, loading, authReady, login, register, verifyOtp, resendOtp, signInWithGoogle, logout, refreshUser]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
