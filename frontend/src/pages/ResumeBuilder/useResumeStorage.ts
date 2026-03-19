import { useCallback } from 'react';
import type { ResumeData } from './types';
import { defaultResumeData } from './types';

export const RESUME_DRAFT_STORAGE_KEY = 'vidhyamitra_resume_draft';

type DraftLoadResult = {
    data: ResumeData;
    loaded: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceString(val: unknown, fallback: string): string {
    return typeof val === 'string' ? val : fallback;
}

function coerceStringArray(val: unknown): string[] {
    if (!Array.isArray(val)) return [];
    return val
        .map(v => (typeof v === 'string' ? v : null))
        .filter((v): v is string => v !== null);
}

function coerceResumeData(input: unknown): ResumeData {
    // Start from defaults and selectively coerce fields.
    const base: ResumeData = {
        ...defaultResumeData,
        personal: { ...defaultResumeData.personal },
        education: [...defaultResumeData.education],
        experience: [...defaultResumeData.experience],
        projects: [...defaultResumeData.projects],
        skills: { ...defaultResumeData.skills },
        ats: defaultResumeData.ats,
    };

    if (!isPlainObject(input)) return base;

    const personal = input.personal;
    if (isPlainObject(personal)) {
        base.personal = {
            ...base.personal,
            full_name: coerceString(personal.full_name, base.personal.full_name),
            email: coerceString(personal.email, base.personal.email),
            phone: coerceString(personal.phone, base.personal.phone),
            location: coerceString(personal.location, base.personal.location),
            professional_summary: coerceString(personal.professional_summary, base.personal.professional_summary),
        };
    }

    const target_role = input.target_role;
    if (typeof target_role === 'string') base.target_role = target_role;

    const education = input.education;
    if (Array.isArray(education) && education.length > 0) {
        base.education = education
            .map((item: unknown) => {
                if (!isPlainObject(item)) return null;
                return {
                    degree: coerceString(item.degree, ''),
                    institution: coerceString(item.institution, ''),
                    duration: coerceString(item.duration, ''),
                    description: coerceString(item.description, ''),
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
        if (base.education.length === 0) base.education = [...defaultResumeData.education];
    }

    const experience = input.experience;
    if (Array.isArray(experience) && experience.length > 0) {
        base.experience = experience
            .map((item: unknown) => {
                if (!isPlainObject(item)) return null;
                return {
                    title: coerceString(item.title, ''),
                    organization: coerceString(item.organization, ''),
                    duration: coerceString(item.duration, ''),
                    description: coerceString(item.description, ''),
                    bullets: coerceStringArray((item as any).bullets),
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
        if (base.experience.length === 0) base.experience = [...defaultResumeData.experience];
    }

    const projects = input.projects;
    if (Array.isArray(projects) && projects.length > 0) {
        base.projects = projects
            .map((item: unknown) => {
                if (!isPlainObject(item)) return null;
                return {
                    name: coerceString(item.name, ''),
                    technologies: coerceString(item.technologies, ''),
                    description: coerceString(item.description, ''),
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
        if (base.projects.length === 0) base.projects = [...defaultResumeData.projects];
    }

    const skills = input.skills;
    if (isPlainObject(skills)) {
        base.skills = {
            ...base.skills,
            raw_skills: coerceString((skills as any).raw_skills, base.skills.raw_skills),
            technical_skills: coerceStringArray((skills as any).technical_skills),
            tools: coerceStringArray((skills as any).tools),
            soft_skills: coerceStringArray((skills as any).soft_skills),
            suggested_skills: coerceStringArray((skills as any).suggested_skills),
        };
    }

    const ats = input.ats;
    if (isPlainObject(ats)) {
        const scoreVal = (ats as any).score;
        base.ats = {
            score: typeof scoreVal === 'number' ? scoreVal : (typeof scoreVal === 'string' ? Number(scoreVal) : 0),
            strengths: coerceStringArray((ats as any).strengths),
            improvements: coerceStringArray((ats as any).improvements),
        };
    }

    return base;
}

function safeLoadFromLocalStorage(storageKey: string): DraftLoadResult | null {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return { data: coerceResumeData(parsed), loaded: true };
    } catch {
        // Corrupted data should never break the app.
        return null;
    }
}

export function useResumeStorage(storageKey: string = RESUME_DRAFT_STORAGE_KEY) {
    const loadDraft = useCallback((): DraftLoadResult | null => {
        if (typeof window === 'undefined') return null;
        return safeLoadFromLocalStorage(storageKey);
    }, [storageKey]);

    const saveDraft = useCallback((data: ResumeData) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
            return true;
        } catch {
            return false;
        }
    }, [storageKey]);

    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Ignore.
        }
    }, [storageKey]);

    return { loadDraft, saveDraft, clearDraft };
}

