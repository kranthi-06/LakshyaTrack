import type { ResumeData } from '../types';

/**
 * JSON export payload.
 *
 * The v1 export only contained the five content arrays, which silently dropped
 * the section ordering, hidden sections and custom sections that the editor
 * and the other exports honour. Keeping those fields at the top level means an
 * exported file can be inspected (or re-imported) without losing layout state.
 */
export interface ResumeJsonExport {
    format: 'lakshyatrack.resume';
    version: 2;
    meta: {
        generated_at: string;
        target_role: string;
        template: string | null;
        template_name: string | null;
        ats_score: number | null;
    };
    personal_info: ResumeData['personal'];
    education: ResumeData['education'];
    experience: ResumeData['experience'];
    projects: ResumeData['projects'];
    skills: ResumeData['skills'];
    target_role: string;
    ats: ResumeData['ats'];
    section_order: NonNullable<ResumeData['section_order']>;
    hidden_sections: NonNullable<ResumeData['hidden_sections']>;
    custom_sections: NonNullable<ResumeData['custom_sections']>;
}

export function buildResumeJson(
    data: ResumeData,
    options: { template?: string | null; templateName?: string | null; atsScore?: number | null } = {},
): ResumeJsonExport {
    return {
        format: 'lakshyatrack.resume',
        version: 2,
        meta: {
            generated_at: new Date().toISOString(),
            target_role: data.target_role,
            template: options.template ?? null,
            template_name: options.templateName ?? null,
            ats_score: options.atsScore ?? data.ats?.score ?? null,
        },
        personal_info: data.personal,
        education: data.education,
        experience: data.experience,
        projects: data.projects,
        skills: data.skills,
        target_role: data.target_role,
        ats: data.ats,
        section_order: data.section_order ?? [],
        hidden_sections: data.hidden_sections ?? [],
        custom_sections: data.custom_sections ?? [],
    };
}

export function stringifyResumeJson(
    data: ResumeData,
    options: { template?: string | null; templateName?: string | null; atsScore?: number | null } = {},
): string {
    return JSON.stringify(buildResumeJson(data, options), null, 2);
}
