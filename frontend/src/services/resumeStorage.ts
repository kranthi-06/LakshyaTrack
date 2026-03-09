import api from './api';

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
    return res.data;
};

export const getSavedResumes = async () => {
    const res = await api.get('/saved-resumes/');
    return res.data;
};

export const deleteSavedResume = async (resumeId: string) => {
    const res = await api.delete(`/saved-resumes/${resumeId}`);
    return res.data;
};
