import api from './api';
import { cachedRequest, invalidateCache } from './cache';

const SAVED_RESUMES_CACHE_KEY = 'resumes:saved';

export const saveResumeToProfile = async (payload: {
    resume_name: string;
    resume_data: any;
    template_id: string;
    theme: string;
    target_role?: string;
    ats_score?: number;
    is_primary?: boolean;
}) => {
    const res = await api.post('/saved-resumes/', payload);
    invalidateCache(SAVED_RESUMES_CACHE_KEY);
    return res.data;
};

export const updateSavedResume = async (resumeId: string, payload: {
    resume_name?: string;
    resume_data?: any;
    template_id?: string;
    theme?: string;
    target_role?: string;
    ats_score?: number;
    is_primary?: boolean;
}) => {
    const res = await api.put(`/saved-resumes/${resumeId}`, payload);
    invalidateCache(SAVED_RESUMES_CACHE_KEY);
    return res.data;
};

export const getSavedResumes = async () =>
    cachedRequest(
        SAVED_RESUMES_CACHE_KEY,
        async () => {
            const res = await api.get('/saved-resumes/');
            return res.data;
        },
        { ttlMs: 60_000, persist: true },
    );

export const deleteSavedResume = async (resumeId: string) => {
    const res = await api.delete(`/saved-resumes/${resumeId}`);
    invalidateCache(SAVED_RESUMES_CACHE_KEY);
    return res.data;
};

export const authorizeResumeDownload = async (resumeId?: string) => {
    const res = await api.post('/saved-resumes/download-authorize', {
        resume_id: resumeId || null,
    });
    return res.data;
};
