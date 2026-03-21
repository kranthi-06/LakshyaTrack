import api from './api';

export const uploadAndExtractReasoningQuestions = async (formData: FormData) => {
    const res = await api.post('/reasoning/upload-extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

export const getReasoningStats = async () => {
    const res = await api.get('/reasoning/stats');
    return res.data;
};

export const getReasoningPopulateStatus = async () => {
    const res = await api.get('/reasoning/admin/populate-status');
    return res.data;
};

export const startReasoningPopulate = async () => {
    const res = await api.post('/reasoning/admin/populate-all');
    return res.data;
};
