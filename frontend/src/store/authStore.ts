import { create } from 'zustand';

export interface AuthUser {
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

interface AuthStoreState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    setUser: (user: AuthUser | null) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
    user: null,
    isAuthenticated: false,
    loading: true,
    setUser: (user) =>
        set({
            user,
            isAuthenticated: !!user,
        }),
    logout: () =>
        set({
            user: null,
            isAuthenticated: false,
            loading: false,
        }),
    setLoading: (loading) => set({ loading }),
}));
