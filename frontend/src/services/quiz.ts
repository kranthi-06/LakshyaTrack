import api from './api';

export interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    correct: number;
}

export const generateQuizQuestions = async (payload: {
    topic: string;
    difficulty: string;
    count: number;
}): Promise<QuizQuestion[]> => {
    const res = await api.post('/quiz/generate', payload);
    return res.data;
};
