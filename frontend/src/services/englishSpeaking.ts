import api from './api';

export const generateEnglishPassage = async (payload: { category: string; difficulty: string }) => {
    const res = await api.post('/english/generate-passage', payload);
    return res.data;
};

export const generateEnglishTopic = async () => {
    const res = await api.post('/english/generate-topic');
    return res.data;
};

export const analyzeEnglishSpeaking = async (payload: {
    type: 'sentence' | 'topic' | 'interview';
    original_text: string;
    user_text: string;
}) => {
    const res = await api.post('/english/analyze-speaking', payload);
    return res.data;
};
