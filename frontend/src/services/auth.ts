import api from './api';

export const login = async (username: string, password: string): Promise<any> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/login/access-token', formData);
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
    return response.data;
};

export const getMe = async () => {
    const response = await api.get('/users/me');
    return response.data;
};

export const googleLogin = async (idToken: string): Promise<any> => {
    const response = await api.post('/google-login', { token: idToken });
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
    return response.data;
};
