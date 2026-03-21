import api from './api';

export const getReasoningTopics = async () => {
    const res = await api.get('/reasoning/topics');
    return res.data;
};

export const getReasoningCompanies = async () => {
    const res = await api.get('/reasoning/companies');
    return res.data;
};

export const getTopicQuestions = async (topic: string, mode: string, limit = 36) => {
    const res = await api.get(`/reasoning/questions/topic/${topic}?mode=${mode}&limit=${limit}`);
    return res.data;
};

export const getCompanyQuestions = async (company: string, limit = 30) => {
    const res = await api.get(`/reasoning/questions/company/${company}?limit=${limit}`);
    return res.data;
};

export const generateReasoningQuestions = async (payload: {
    topic: string;
    difficulty?: string;
    count?: number;
    company?: string;
}) => {
    const res = await api.post('/reasoning/generate', payload);
    return res.data;
};

export const submitReasoningTest = async (payload: {
    user_id?: string;
    test_type: string;
    category: string;
    score: number;
    total: number;
    answers: any[];
}) => {
    const res = await api.post('/reasoning/submit-test', payload);
    return res.data;
};
