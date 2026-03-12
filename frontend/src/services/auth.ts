import api from './api';
import { cachedRequest, invalidateCache } from './cache';

const ME_CACHE_KEY = 'auth:me';

export const login = async (username: string, password: string): Promise<any> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/login/access-token', formData);
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const register = async (userData: any): Promise<any> => {
    // userData should contain { email, password, full_name, etc }
    const response = await api.post('/signup', userData);
    return response.data;
};

export const sendOtp = async (email: string): Promise<any> => {
    const response = await api.post('/send-otp', { email });
    return response.data;
};

export const verifyOtp = async (email: string, otp: string): Promise<any> => {
    const response = await api.post('/verify-otp', { email, otp });
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const getMe = async (bypassCache = false) =>
    cachedRequest(
        ME_CACHE_KEY,
        async () => {
            const response = await api.get('/users/me');
            return response.data;
        },
        {
            ttlMs: 45_000,
            persist: true,
            bypassCache,
        },
    );

export const googleLogin = async (idToken: string): Promise<any> => {
    const response = await api.post('/google-login', { token: idToken });
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};

export const updateProfile = async (profileData: {
    full_name?: string;
    phone_number?: string;
    bio?: string;
    links?: Record<string, any>;
    skills?: string[];
    profile_photo_url?: string;
}): Promise<any> => {
    const response = await api.put('/users/me/profile', profileData);
    invalidateCache(ME_CACHE_KEY);
    return response.data;
};
