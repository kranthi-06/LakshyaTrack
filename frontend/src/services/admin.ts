import api from './api';

export interface AdminUser {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'black_admin';
    is_active: boolean;
    is_blacklisted: boolean;
    last_active_at: string | null;
    created_at: string | null;
    full_name: string;
    progress_status?: string;
    career_score?: number;
    quizzes_passed?: number;
    interviews_done?: number;
}

// ── REQUIRE_ADMIN ROUTES ──────────────────────────────────
export const getAdminUsers = async (skip = 0, limit = 50, search?: string): Promise<{
    users: AdminUser[];
    total: number;
    skip: number;
    limit: number;
}> => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data;
};

export const getAdminProgress = async () => {
    const response = await api.get('/admin/progress');
    return response.data;
};

export const getAdminInactivity = async (days = 7) => {
    const response = await api.get(`/admin/inactivity?days=${days}`);
    return response.data;
};

export const getAdminStats = async () => {
    const response = await api.get('/admin/stats');
    return response.data;
};

// ── REQUIRE_BLACK_ADMIN ROUTES ────────────────────────────
export const getAdminCommandCentre = async () => {
    const response = await api.get('/admin/command-centre');
    return response.data;
};

export const getAdminBlacklist = async () => {
    const response = await api.get('/admin/blacklist');
    return response.data;
};

export const blacklistUser = async (userId: string, reason: string = "Blacklisted by admin") => {
    const response = await api.post('/admin/blacklist-user', { user_id: userId, reason });
    return response.data;
};

export const unblacklistUser = async (userId: string) => {
    const response = await api.post('/admin/unblacklist-user', { user_id: userId });
    return response.data;
};

export const promoteUser = async (userId: string) => {
    const response = await api.post('/admin/promote-user', { user_id: userId });
    return response.data;
};

export const demoteUser = async (userId: string) => {
    const response = await api.post('/admin/demote-user', { user_id: userId });
    return response.data;
};

export const deleteUser = async (userId: string) => {
    const response = await api.post('/admin/delete-user', { user_id: userId });
    return response.data;
};
