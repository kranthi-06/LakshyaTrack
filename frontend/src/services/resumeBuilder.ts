import api from './api';

// Personal Info
export const enhancePersonalInfo = async (data: object) => {
    const response = await api.post('/resume-builder/enhance/personal-info', data);
    return response.data;
};

// Education
export const enhanceEducation = async (data: object) => {
    const response = await api.post('/resume-builder/enhance/education', data);
    return response.data;
};

// Experience
export const enhanceExperience = async (data: object) => {
    const response = await api.post('/resume-builder/enhance/experience', data);
    return response.data;
};

// Projects
export const enhanceProjects = async (data: object) => {
    const response = await api.post('/resume-builder/enhance/projects', data);
    return response.data;
};

// Skills
export const enhanceSkills = async (data: object) => {
    const response = await api.post('/resume-builder/enhance/skills', data);
    return response.data;
};

// ATS Check
export const runATSCheck = async (data: object) => {
    const response = await api.post('/resume-builder/ats-check', data);
    return response.data;
};

// Regenerate Section
export const regenerateSection = async (data: object) => {
    const response = await api.post('/resume-builder/regenerate', data);
    return response.data;
};

// Full Resume AI Optimization (for Visual Builder)
export const optimizeResumeContent = async (data: object) => {
    const response = await api.post('/resume-builder/optimize', data);
    return response.data;
};
