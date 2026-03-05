import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { login as loginApi, register as registerApi, getMe, verifyOtp as verifyOtpApi, sendOtp as sendOtpApi } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface User {
    email: string;
    full_name?: string;
    profile?: {
        full_name?: string;
        profile_photo_url?: string;
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
const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/auth/callback'];
const SUPABASE_TIMEOUT_MS = 4000;
const AUTH_CALLBACK_SAFETY_TIMEOUT_MS = 8000;
const TOKEN_KEY = 'token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Track state inside closures to avoid stale reads
    const userRef = useRef<User | null>(null);
    const mountedRef = useRef(true);
    const authInProgressRef = useRef(false); // Prevents duplicate auth flows

    const updateUser = useCallback((u: User | null) => {
        userRef.current = u;
        setUser(u);
    }, []);

    /** Safely attempt to fetch the current user from backend */
    const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token || token === 'undefined' || token === 'null') {
            return null;
        }
        try {
            const userData = await getMe();
            return userData;
        } catch (err) {
            console.warn('AuthContext: Failed to fetch user from backend', err);
            // Token was invalid — clear it so we don't loop
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }
    }, []);

    // ── Initialise auth state on mount ──────────────────────────
    useEffect(() => {
        mountedRef.current = true;

        const initSession = async () => {
            if (authInProgressRef.current) return;
            authInProgressRef.current = true;

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

                if (supabaseSession) {
                    // Supabase has a valid session — store the token and fetch user
                    localStorage.setItem(TOKEN_KEY, supabaseSession.access_token);
                    const userData = await fetchCurrentUser();
                    if (mountedRef.current) updateUser(userData);
                } else {
                    // No Supabase session — try local token (custom email/password login)
                    const userData = await fetchCurrentUser();
                    if (mountedRef.current) updateUser(userData);
                }
            } catch (err) {
                console.error('AuthContext: Session init error', err);
            } finally {
                authInProgressRef.current = false;

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
                        if (mountedRef.current) setLoading(false);
                    }, AUTH_CALLBACK_SAFETY_TIMEOUT_MS);
                } else {
                    setLoading(false);
                }
            }
        };

        initSession();

        // 2. Listen for Supabase auth state changes (Google Sign‑In, token refresh, sign‑out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('AuthContext: onAuthStateChange', event);

            if (event === 'SIGNED_IN' && session) {
                localStorage.setItem(TOKEN_KEY, session.access_token);

                try {
                    const userData = await fetchCurrentUser();
                    if (!mountedRef.current) return;
                    updateUser(userData);

                    // Navigate only when the user is on a public / callback page
                    const currentPath = window.location.pathname;
                    if (PUBLIC_PATHS.includes(currentPath)) {
                        navigate('/dashboard', { replace: true });
                    }
                } catch (err: any) {
                    console.error('AuthContext: Backend sync failed on SIGNED_IN', err);
                    localStorage.removeItem(TOKEN_KEY);
                    await supabase.auth.signOut().catch(() => { });
                    if (mountedRef.current) {
                        updateUser(null);
                        navigate('/login', { replace: true });
                    }
                }
            } else if (event === 'TOKEN_REFRESHED' && session) {
                // Silent refresh — just update the token, don't navigate anywhere
                localStorage.setItem(TOKEN_KEY, session.access_token);
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem(TOKEN_KEY);
                if (mountedRef.current) {
                    updateUser(null);
                    navigate('/login', { replace: true });
                }
            }

            // Always ensure loading is cleared after an event
            if (mountedRef.current) setLoading(false);
        });

        return () => {
            mountedRef.current = false;
            subscription.unsubscribe();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Email + Password Login ──────────────────────────────────
    const login = useCallback(async (data: any) => {
        const response = await loginApi(data.username || data.email, data.password);
        if (response.access_token) {
            localStorage.setItem(TOKEN_KEY, response.access_token);
            const userData = await getMe();
            updateUser(userData);
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
            const userData = await getMe();
            updateUser(userData);
        }
    }, [updateUser]);

    // ── Resend OTP ──────────────────────────────────────────────
    const resendOtp = useCallback(async (email: string) => {
        await sendOtpApi(email);
    }, []);

    // ── Refresh User Data ───────────────────────────────────────
    const refreshUser = useCallback(async () => {
        const userData = await fetchCurrentUser();
        if (userData && mountedRef.current) updateUser(userData);
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
        localStorage.removeItem(TOKEN_KEY);
        // Sign out from Supabase too (if applicable)
        await supabase.auth.signOut().catch(() => { });
        updateUser(null);
        navigate('/login', { replace: true });
    }, [navigate, updateUser]);

    const contextValue = useMemo(() => ({
        user,
        loading,
        login,
        register,
        verifyOtp,
        resendOtp,
        signInWithGoogle,
        logout,
        refreshUser,
    }), [user, loading, login, register, verifyOtp, resendOtp, signInWithGoogle, logout, refreshUser]);

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
