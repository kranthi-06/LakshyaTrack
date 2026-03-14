export type BuilderStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface PersonalInfo {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    professional_summary: string;
}

export interface EducationItem {
    degree: string;
    institution: string;
    duration: string;
    description: string;
}

export interface ExperienceItem {
    title: string;
    organization: string;
    duration: string;
    description: string;
    bullets: string[];
}

export interface ProjectItem {
    name: string;
    technologies: string;
    description: string;
    project_image_url?: string;
}

export interface SkillsData {
    raw_skills: string;
    technical_skills: string[];
    tools: string[];
    soft_skills: string[];
    suggested_skills: string[];
}

export interface ATSResult {
    score: number;
    strengths: string[];
    improvements: string[];
}

export interface ResumeData {
    target_role: string;
    personal: PersonalInfo;
    education: EducationItem[];
    experience: ExperienceItem[];
    projects: ProjectItem[];
    skills: SkillsData;
    ats: ATSResult | null;
}

export const defaultResumeData: ResumeData = {
    target_role: '',
    personal: { full_name: '', email: '', phone: '', location: '', professional_summary: '' },
    education: [{ degree: '', institution: '', duration: '', description: '' }],
    experience: [{ title: '', organization: '', duration: '', description: '', bullets: [] }],
    projects: [{ name: '', technologies: '', description: '' }],
    skills: { raw_skills: '', technical_skills: [], tools: [], soft_skills: [], suggested_skills: [] },
    ats: null,
};

export const STEP_CONFIG = [
    { id: 1, label: 'Target Role', icon: 'Target' },
    { id: 2, label: 'Personal Info', icon: 'User' },
    { id: 3, label: 'Education', icon: 'GraduationCap' },
    { id: 4, label: 'Experience', icon: 'Briefcase' },
    { id: 5, label: 'Projects', icon: 'Laptop' },
    { id: 6, label: 'Skills', icon: 'Wrench' },
    { id: 7, label: 'ATS & Preview', icon: 'ShieldCheck' },
    { id: 8, label: 'Visual Studio', icon: 'Palette' },
];
