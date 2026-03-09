/**
 * Career Platform API Service
 * Provides typed frontend wrappers for all new advanced AI career endpoints.
 * Follows the existing api.ts/resume.ts pattern.
 */
import api from './api';

// ════════════════════════════════════════════
// 1. ROADMAP ENGINE
// ════════════════════════════════════════════

export const generateRoadmap = async (
    targetRole: string,
    currentSkills: string[] = [],
    skillGaps: string[] = [],
    topicName?: string,
    difficulty?: string
) => {
    const res = await api.post('/roadmap/generate', {
        target_role: targetRole,
        current_skills: currentSkills,
        skill_gaps: skillGaps,
        topic_name: topicName || undefined,
        difficulty: difficulty || undefined,
    });
    return res.data;
};

export const getActiveRoadmap = async () => {
    const res = await api.get('/roadmap/active');
    return res.data;
};

export const getAllRoadmaps = async () => {
    const res = await api.get('/roadmap/all');
    return res.data;
};

export const setActiveRoadmap = async (roadmapId: string) => {
    const res = await api.post('/roadmap/set-active', { roadmap_id: roadmapId });
    return res.data;
};

export const deleteRoadmap = async (roadmapId: string) => {
    const res = await api.post('/roadmap/delete', { roadmap_id: roadmapId });
    return res.data;
};

export const updateSkillStatus = async (roadmapId: string, skillId: string, status: string) => {
    const res = await api.post('/roadmap/update-skill', {
        roadmap_id: roadmapId,
        skill_id: skillId,
        status
    });
    return res.data;
};

// ════════════════════════════════════════════
// 2. QUIZ GATING SYSTEM
// ════════════════════════════════════════════

export const generateSkillQuiz = async (skillName: string, level: string, count: number = 10) => {
    const res = await api.post('/quiz-gating/generate-skill-quiz', {
        skill_name: skillName,
        level,
        count
    });
    return res.data;
};

export const submitSkillQuiz = async (
    roadmapId: string | null,
    skillId: string,
    skillName: string,
    level: string,
    answers: any[]
) => {
    const res = await api.post('/quiz-gating/submit', {
        roadmap_id: roadmapId,
        skill_id: skillId,
        skill_name: skillName,
        level,
        answers
    });
    return res.data;
};

export const getQuizHistory = async (skillId?: string) => {
    const params = skillId ? `?skill_id=${skillId}` : '';
    const res = await api.get(`/quiz-gating/history${params}`);
    return res.data;
};

export const checkQuizPassed = async (skillId: string) => {
    const res = await api.get(`/quiz-gating/check-passed/${skillId}`);
    return res.data;
};

// ════════════════════════════════════════════
// 3. LEARNING CONTENT
// ════════════════════════════════════════════

export const getLearningResources = async (skillName: string, level: string = 'Beginner') => {
    const res = await api.post('/learning-content/resources', {
        skill_name: skillName,
        level
    });
    return res.data;
};

export const refreshLearningResources = async (skillName: string, level: string = 'Beginner') => {
    const res = await api.post('/learning-content/refresh', {
        skill_name: skillName,
        level
    });
    return res.data;
};

// ════════════════════════════════════════════
// 4. ADVANCED INTERVIEW
// ════════════════════════════════════════════

export const checkInterviewUnlock = async (roadmapId: string, levelName: string) => {
    const res = await api.post('/interview-advanced/check-unlock', {
        roadmap_id: roadmapId,
        level_name: levelName
    });
    return res.data;
};

export const getAdvancedInterviewQuestion = async (
    position: string,
    roundType: string,
    history: any[] = [],
    resumeSummary?: string,
    targetSkills?: string[]
) => {
    const res = await api.post('/interview-advanced/next-question-advanced', {
        position,
        round_type: roundType,
        history,
        resume_summary: resumeSummary,
        target_skills: targetSkills
    });
    return res.data;
};

export const finishAdvancedInterview = async (
    position: string,
    roundType: string,
    responses: any[],
    roadmapId?: string,
    level?: string,
    resumeSummary?: string
) => {
    const res = await api.post('/interview-advanced/finish-advanced', {
        roadmap_id: roadmapId,
        level,
        position,
        round_type: roundType,
        responses,
        resume_summary: resumeSummary
    });
    return res.data;
};

export const getAdvancedInterviewHistory = async () => {
    const res = await api.get('/interview-advanced/history-advanced');
    return res.data;
};

// ════════════════════════════════════════════
// 5. OPPORTUNITY PORTAL
// ════════════════════════════════════════════

export const browseOpportunities = async (params: {
    category?: string;
    skill?: string;
    location?: string;
    search?: string;
    page?: number;
    per_page?: number;
}) => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.skill) searchParams.set('skill', params.skill);
    if (params.location) searchParams.set('location', params.location);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.per_page) searchParams.set('per_page', String(params.per_page));
    const res = await api.get(`/opportunities/browse?${searchParams.toString()}`);
    return res.data;
};

export const getFilterOptions = async () => {
    const res = await api.get('/opportunities/filters');
    return res.data;
};

export const discoverOpportunities = async (targetRole: string, skills: string[] = [], level: string = 'Beginner') => {
    const res = await api.post('/opportunities/discover', {
        target_role: targetRole,
        skills,
        level
    });
    return res.data;
};

export const getMatchedOpportunities = async (
    skills: string[] = [],
    level?: string,
    opportunityType?: string,
    limit: number = 20
) => {
    const res = await api.post('/opportunities/matched', {
        skills,
        level,
        opportunity_type: opportunityType,
        limit
    });
    return res.data;
};

export const getRecommendations = async (skills: string[] = [], targetRole: string = 'Software Engineer', limit: number = 12) => {
    const res = await api.post('/opportunities/recommend', {
        skills,
        target_role: targetRole,
        limit,
    });
    return res.data;
};

export const fetchExternalSources = async () => {
    const res = await api.post('/opportunities/fetch-external');
    return res.data;
};

export const liveSearchOpportunities = async (searchQuery: string, category?: string) => {
    const res = await api.post('/opportunities/live-search', {
        search_query: searchQuery,
        category: category || undefined,
    });
    return res.data;
};

// ════════════════════════════════════════════
// 6. PROGRESS TRACKING
// ════════════════════════════════════════════

export const getCurrentProgress = async (resumeAtsScore: number = 0) => {
    const res = await api.get(`/progress/current?resume_ats_score=${resumeAtsScore}`);
    return res.data;
};

export const saveProgressSnapshot = async (resumeAtsScore: number = 0) => {
    const res = await api.post('/progress/snapshot', {
        resume_ats_score: resumeAtsScore
    });
    return res.data;
};

export const getProgressHistory = async (limit: number = 30) => {
    const res = await api.get(`/progress/history?limit=${limit}`);
    return res.data;
};

// ════════════════════════════════════════════
// 7. EXAM PROCTORING SYSTEM
// ════════════════════════════════════════════

export const recordExamViolation = async (
    violationType: string,
    examTopic?: string,
    examDifficulty?: string,
) => {
    const res = await api.post('/exam/record-violation', {
        violation_type: violationType,
        exam_topic: examTopic,
        exam_difficulty: examDifficulty,
    });
    return res.data;
};

export const checkExamEligibility = async () => {
    const res = await api.get('/exam/check-eligibility');
    return res.data;
};

export const checkExamCooldown = async (skillId: string) => {
    const res = await api.get(`/exam/cooldown/${skillId}`);
    return res.data;
};

export const getViolationHistory = async () => {
    const res = await api.get('/exam/violation-history');
    return res.data;
};

// ════════════════════════════════════════════
// 8. MULTI-STAGE INTERVIEW SYSTEM
// ════════════════════════════════════════════

export const createMultistageSession = async (
    position: string,
    interviewMode: string = 'resume_screening',
    difficulty: string = 'intermediate'
) => {
    const res = await api.post('/interview-multistage/create-session', {
        position,
        interview_mode: interviewMode,
        difficulty
    });
    return res.data;
};

export const getScreeningQuestion = async (
    sessionId: string,
    resumeSummary: string = '',
    skills: string[] = [],
    projects: string[] = [],
    history: any[] = []
) => {
    const res = await api.post('/interview-multistage/screening-question', {
        session_id: sessionId,
        resume_summary: resumeSummary,
        skills,
        projects,
        history
    });
    return res.data;
};

export const getTechnicalQuestion = async (
    sessionId: string,
    skills: string[] = [],
    history: any[] = []
) => {
    const res = await api.post('/interview-multistage/technical-question', {
        session_id: sessionId,
        skills,
        history
    });
    return res.data;
};

export const getCodingProblem = async (
    sessionId: string,
    skills: string[] = [],
    difficulty: string = 'intermediate'
) => {
    const res = await api.post('/interview-multistage/coding-problem', {
        session_id: sessionId,
        skills,
        difficulty
    });
    return res.data;
};

export const getHRQuestion = async (
    sessionId: string,
    history: any[] = []
) => {
    const res = await api.post('/interview-multistage/hr-question', {
        session_id: sessionId,
        history
    });
    return res.data;
};

export const evaluateInterviewStage = async (
    sessionId: string,
    stage: string,
    data: {
        responses?: any[];
        resume_summary?: string;
        skills?: string[];
        code?: string;
        language?: string;
        problem?: any;
        passed_tests?: number;
        total_tests?: number;
        attempts?: number;
    }
) => {
    const res = await api.post('/interview-multistage/evaluate-stage', {
        session_id: sessionId,
        stage,
        ...data
    });
    return res.data;
};

export const getMultistageFinalAnalysis = async (
    sessionId: string,
    screeningEval: any,
    technicalEval: any,
    codingEval: any,
    hrEval: any
) => {
    const res = await api.post('/interview-multistage/final-analysis', {
        session_id: sessionId,
        screening_eval: screeningEval,
        technical_eval: technicalEval,
        coding_eval: codingEval,
        hr_eval: hrEval
    });
    return res.data;
};

export const getMultistageHistory = async () => {
    const res = await api.get('/interview-multistage/history');
    return res.data;
};
