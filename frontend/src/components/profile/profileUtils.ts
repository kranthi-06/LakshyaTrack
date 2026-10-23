import { THEME_COLORS, resolveCatalogTemplate } from '../../pages/ResumeBuilder/templates';
import type { ResumeData, ProjectItem } from '../../pages/ResumeBuilder/types';
import { defaultResumeData } from '../../pages/ResumeBuilder/types';
import { normalizeProfileUrl } from '../../pages/ResumeBuilder/templates/contactLinkUtils';
import type { SavedResumeRecord } from '../../services/resumeStorage';

export const PROFILE_TABS = [
    'overview',
    'projects',
    'achievements',
    'skills',
    'activity',
    'resumes',
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export function parseProfileTab(value: string | null | undefined): ProfileTab {
    if (value && (PROFILE_TABS as readonly string[]).includes(value)) {
        return value as ProfileTab;
    }
    return 'overview';
}

export function linkString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function formatJoinDate(dateStr?: string | null): string {
    if (!dateStr) return 'Recently joined';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Recently joined';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatResumeDate(dateStr?: string | null): string {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function resumeTimestamp(resume: SavedResumeRecord): number {
    const raw = resume.updated_at || resume.created_at;
    if (!raw) return 0;
    const value = new Date(raw).getTime();
    return Number.isNaN(value) ? 0 : value;
}

export function asResumeData(raw: unknown): ResumeData {
    if (!raw || typeof raw !== 'object') return { ...defaultResumeData };
    const rd = raw as Partial<ResumeData> & { personal?: Partial<ResumeData['personal']> };
    return {
        target_role: rd.target_role || '',
        personal: {
            ...defaultResumeData.personal,
            ...(rd.personal || {}),
        },
        education: rd.education?.length ? rd.education : defaultResumeData.education,
        experience: rd.experience?.length ? rd.experience : defaultResumeData.experience,
        projects: rd.projects?.length ? rd.projects : defaultResumeData.projects,
        skills: rd.skills || defaultResumeData.skills,
        ats: rd.ats || null,
        section_order: rd.section_order || [],
        hidden_sections: rd.hidden_sections || [],
        custom_sections: rd.custom_sections || [],
    };
}

export function resumeAccentColor(resume: SavedResumeRecord): string {
    const theme = (resume.theme || '').trim();
    if (theme.startsWith('#')) return theme;
    const named = THEME_COLORS.find(item => item.id === theme || item.label.toLowerCase() === theme.toLowerCase());
    if (named) return named.color;
    return resolveCatalogTemplate(resume.template_id).default_color;
}

export interface ProfileProject {
    key: string;
    name: string;
    technologies: string;
    description: string;
    imageUrl?: string;
    sourceResumeId: string;
    sourceResumeName: string;
}

export function extractProjectsFromResumes(resumes: SavedResumeRecord[]): ProfileProject[] {
    const seen = new Set<string>();
    const projects: ProfileProject[] = [];

    for (const resume of resumes) {
        const data = asResumeData(resume.resume_data);
        for (const project of data.projects) {
            const name = (project.name || '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            projects.push({
                key,
                name,
                technologies: (project.technologies || '').trim(),
                description: (project.description || '').trim(),
                imageUrl: (project as ProjectItem).project_image_url,
                sourceResumeId: resume.id,
                sourceResumeName: resume.resume_name,
            });
        }
    }

    return projects;
}

export type ResumeSortKey = 'updated' | 'name' | 'created';

export function filterAndSortResumes(
    resumes: SavedResumeRecord[],
    query: string,
    sort: ResumeSortKey,
): SavedResumeRecord[] {
    const needle = query.trim().toLowerCase();
    const filtered = needle
        ? resumes.filter(resume => {
            const template = resolveCatalogTemplate(resume.template_id);
            const haystack = [
                resume.resume_name,
                resume.template_id,
                template.name,
                resume.target_role || '',
            ].join(' ').toLowerCase();
            return haystack.includes(needle);
        })
        : [...resumes];

    filtered.sort((a, b) => {
        if (sort === 'name') {
            return a.resume_name.localeCompare(b.resume_name);
        }
        if (sort === 'created') {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
        return resumeTimestamp(b) - resumeTimestamp(a);
    });

    return filtered;
}

export function duplicateResumeName(original: string): string {
    const base = original.trim() || 'Untitled Resume';
    if (/\(copy(?: \d+)?\)$/i.test(base)) {
        const match = base.match(/\(copy(?: (\d+))?\)$/i);
        const next = match?.[1] ? Number(match[1]) + 1 : 2;
        return base.replace(/\(copy(?: \d+)?\)$/i, `(copy ${next})`);
    }
    return `${base} (copy)`;
}

export { normalizeProfileUrl };
