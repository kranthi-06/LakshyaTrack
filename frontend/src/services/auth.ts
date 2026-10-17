import api from './api';
import { cachedRequest, invalidateCache } from './cache';
import type { SubscriptionStatus } from './subscription';

const ME_CACHE_KEY = 'auth:me';

/** Shape returned by /login/access-token, /verify-otp and /google-login (TokenWithUser). */
export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: UserResponse | null;
}

/** Minimal user record mirroring backend app/schemas/user.py (User + Profile).
 *  email is required because the backend /users/me always returns it and
 *  AuthContext's local User type declares email as non-optional. */
export interface UserResponse {
    id?: string;
    email: string;
    login_type?: string;
    is_active?: boolean;
    is_superuser?: boolean;
    full_name?: string;
    role?: 'user' | 'admin' | 'black_admin';
    is_blacklisted?: boolean;
    last_active_at?: string;
    created_at?: string;
    updated_at?: string;
    profile?: UserProfile | undefined;
    subscription_status?: SubscriptionStatus | null;
}

export interface UserProfile {
    id?: string;
    full_name?: string;
    profile_photo_url?: string;
    profile_image_url?: string;
    resume_url?: string;
    certificate_url?: string;
    project_image_url?: string;
    phone_number?: string;
    bio?: string;
    links?: Record<string, unknown>;
    skills?: string[];
    activity_log?: Array<Record<string, unknown>>;
    role?: string;
    is_blacklisted?: boolean;
    last_active_at?: string;
    created_at?: string;
    updated_at?: string;
}

/** Request body for signup. */
export interface RegisterRequest {
    email: string;
    password: string;
    full_name?: string;
    [key: string]: unknown;
}

export interface OtpResponse {
    message?: string;
    warning?: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/login/access-token', formData);
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const register = async (userData: RegisterRequest): Promise<LoginResponse> => {
    const response = await api.post('/signup', userData);
    return response.data;
};

export const sendOtp = async (email: string): Promise<OtpResponse> => {
    const response = await api.post('/send-otp', { email });
    return response.data;
};

export const verifyOtp = async (email: string, otp: string): Promise<LoginResponse> => {
    const response = await api.post('/verify-otp', { email, otp });
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const getMe = async (bypassCache = false): Promise<UserResponse | null> =>
    cachedRequest(
        ME_CACHE_KEY,
        async () => {
            const response = await api.get('/users/me');
            return response.data;
        },
        {
            ttlMs: 120_000, // 2 min — user data rarely changes mid-session
            persist: true,
            bypassCache,
        },
    );

export const googleLogin = async (idToken: string): Promise<LoginResponse> => {
    const response = await api.post('/google-login', { token: idToken });
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const updateProfile = async (profileData: {
    full_name?: string;
    phone_number?: string;
    bio?: string;
    links?: Record<string, unknown>;
    skills?: string[];
    profile_image_url?: string;
    profile_photo_url?: string;
    resume_url?: string;
    certificate_url?: string;
    project_image_url?: string;
}): Promise<LoginResponse> => {
    const response = await api.put('/users/me/profile', profileData);
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};
