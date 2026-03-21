import api from './api';

export const generateQuizQuestions = async (payload: {
    topic: string;
    difficulty: string;
    count: number;
}) => {
    const res = await api.post('/quiz/generate', payload);
    return res.data;
};
