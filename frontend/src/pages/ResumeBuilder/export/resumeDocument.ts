import type { ResumeData } from '../types';
import type { BaseTemplate } from '../templates/templateCatalog';
import type { StandardSectionId, SectionId, SectionZone } from '../sectionModel';
import {
    customSectionId,
    resolveLayoutSections,
    sectionZone,
    SECTION_LABELS,
} from '../sectionModel';
import { buildContactItems, type ContactKind } from '../templates/contactLinkUtils';

/**
 * Shared, renderer-agnostic resume document model.
 *
 * The live preview, PDF, DOCX and JSON exports all need the same section
 * order, hidden-section handling and custom-section placement. Building that
 * once here avoids the classic bug where one export path silently drops
 * metadata that another one honours.
 */

export interface ResumeDocumentContact {
    kind: ContactKind;
    /** Full value shown on the resume (e-mail, phone, URL or location). */
    label: string;
    /** Compact profile name (LinkedIn, GitHub, Portfolio…) when available. */
    shortLabel: string;
    /** Safe mailto:/tel:/https: target, or null for plain text such as location. */
    href: string | null;
}

export interface ResumeDocumentEntry {
    title: string;
    subtitle?: string;
    date?: string;
    description?: string;
    bullets?: string[];
}

export interface ResumeDocumentSkillGroup {
    label: string;
    values: string[];
}

export type ResumeDocumentSectionKind =
    | 'summary'
    | 'experience'
    | 'education'
    | 'projects'
    | 'skills'
    | 'custom';

export interface ResumeDocumentSection {
    id: SectionId;
    kind: ResumeDocumentSectionKind;
    zone: SectionZone;
    heading: string;
    paragraphs?: string[];
    entries?: ResumeDocumentEntry[];
    skillGroups?: ResumeDocumentSkillGroup[];
    /** Raw custom-section text, kept so DOCX can preserve line breaks verbatim. */
    content?: string;
}

export interface ResumeDocumentModel {
    name: string;
    headline: string;
    contacts: ResumeDocumentContact[];
    sections: ResumeDocumentSection[];
    base: BaseTemplate;
    accentColor: string;
}

const BASE_SECTION_LABELS: Record<BaseTemplate, Partial<Record<StandardSectionId, string>>> = {
    modern: {
        summary: 'Professional Summary',
        experience: 'Professional Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Technical Skills',
    },
    classic: {
        summary: 'Professional Summary',
        experience: 'Professional Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Technical Skills',
    },
    creative: {
        summary: 'About Me',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    developer: {
        summary: 'Summary',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Tech Stack',
    },
    'minimal-ats': {
        summary: 'Summary',
        experience: 'Professional Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Technical Skills',
    },
    academic: {
        summary: 'Career Objective',
        experience: 'Teaching & Research Experience',
        education: 'Education',
        projects: 'Research & Projects',
        skills: 'Skills & Competencies',
    },
    executive: {
        summary: 'Executive Summary',
        experience: 'Leadership Experience',
        education: 'Education',
        projects: 'Selected Projects',
        skills: 'Core Competencies',
    },
    'two-column': {
        summary: 'Profile',
        experience: 'Work Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Technical Skills',
    },
    portfolio: {
        summary: 'About Me',
        experience: 'Experience',
        education: 'Education',
        projects: 'Featured Projects',
        skills: 'Skills',
    },
    compact: {
        summary: 'Summary',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    timeline: {
        summary: 'Summary',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    elegant: {
        // Elegant renders its summary without a heading in the preview.
        summary: '',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    'bold-header': {
        summary: '',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    infographic: {
        summary: 'Profile',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
    corporate: {
        summary: '',
        experience: 'Professional Experience',
        education: 'Education',
        projects: 'Key Projects',
        skills: 'Core Competencies',
    },
    fresh: {
        summary: '',
        experience: 'Experience',
        education: 'Education',
        projects: 'Projects',
        skills: 'Skills',
    },
};

export function sectionLabelFor(base: BaseTemplate, id: StandardSectionId): string {
    return BASE_SECTION_LABELS[base]?.[id] ?? SECTION_LABELS[id];
}

function skillGroupsFor(data: ResumeData): ResumeDocumentSkillGroup[] {
    const groups: ResumeDocumentSkillGroup[] = [];
    if (data.skills.technical_skills.length > 0) {
        groups.push({ label: 'Technical Skills', values: data.skills.technical_skills });
    }
    if (data.skills.tools.length > 0) {
        groups.push({ label: 'Tools', values: data.skills.tools });
    }
    if (data.skills.soft_skills.length > 0) {
        groups.push({ label: 'Soft Skills', values: data.skills.soft_skills });
    }
    return groups;
}

function customParagraphs(content: string): string[] {
    return content
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .filter((line, index, all) => {
            // Keep intentional blank lines between paragraphs, but trim the
            // leading/trailing ones so headings don't get extra dead space.
            if (line.trim()) return true;
            return index > 0 && index < all.length - 1;
        });
}

function buildSection(
    data: ResumeData,
    base: BaseTemplate,
    id: SectionId,
    zone: SectionZone,
): ResumeDocumentSection | null {
    if (id === 'summary') {
        const summary = data.personal.professional_summary?.trim();
        if (!summary) return null;
        return {
            id,
            kind: 'summary',
            zone,
            heading: sectionLabelFor(base, id),
            paragraphs: [summary],
        };
    }

    if (id === 'experience') {
        const entries = data.experience
            .filter(exp => exp.title?.trim())
            .map((exp): ResumeDocumentEntry => ({
                title: exp.title.trim(),
                subtitle: exp.organization?.trim() || undefined,
                date: exp.duration?.trim() || undefined,
                description: exp.description?.trim() || undefined,
                bullets: (exp.bullets ?? []).map(b => b.trim()).filter(Boolean),
            }));
        if (entries.length === 0) return null;
        return { id, kind: 'experience', zone, heading: sectionLabelFor(base, id), entries };
    }

    if (id === 'education') {
        const entries = data.education
            .filter(ed => ed.degree?.trim())
            .map((ed): ResumeDocumentEntry => ({
                title: ed.degree.trim(),
                subtitle: ed.institution?.trim() || undefined,
                date: ed.duration?.trim() || undefined,
                description: ed.description?.trim() || undefined,
            }));
        if (entries.length === 0) return null;
        return { id, kind: 'education', zone, heading: sectionLabelFor(base, id), entries };
    }

    if (id === 'projects') {
        const entries = data.projects
            .filter(project => project.name?.trim())
            .map((project): ResumeDocumentEntry => ({
                title: project.name.trim(),
                subtitle: project.technologies?.trim() || undefined,
                description: project.description?.trim() || undefined,
            }));
        if (entries.length === 0) return null;
        return { id, kind: 'projects', zone, heading: sectionLabelFor(base, id), entries };
    }

    if (id === 'skills') {
        const skillGroups = skillGroupsFor(data);
        if (skillGroups.length === 0) return null;
        return { id, kind: 'skills', zone, heading: sectionLabelFor(base, id), skillGroups };
    }

    const customId = id.startsWith('custom:') ? id.slice('custom:'.length) : null;
    if (!customId) return null;
    const custom = (data.custom_sections ?? []).find(section => section.id === customId);
    if (!custom?.title?.trim() || !custom.content?.trim()) return null;

    return {
        id,
        kind: 'custom',
        zone,
        heading: custom.title.trim(),
        paragraphs: customParagraphs(custom.content),
        content: custom.content,
    };
}

export function buildResumeDocument(
    data: ResumeData,
    base: BaseTemplate,
    accentColor: string,
): ResumeDocumentModel {
    const personal = data.personal ?? ({} as ResumeData['personal']);
    const sections = resolveLayoutSections(data, base)
        .map(id => {
            const custom = id.startsWith('custom:')
                ? (data.custom_sections ?? []).find(section => customSectionId(section.id) === id)
                : undefined;
            const zone: SectionZone = custom
                ? custom.zone === 'sidebar' ? 'sidebar' : 'main'
                : sectionZone(base, id as StandardSectionId);
            return buildSection(data, base, id, zone);
        })
        .filter((section): section is ResumeDocumentSection => section !== null);

    return {
        name: personal.full_name?.trim() || 'Your Name',
        headline: personal.headline?.trim() || data.target_role?.trim() || '',
        contacts: buildContactItems(personal).map(contact => ({
            kind: contact.kind,
            label: contact.label,
            shortLabel: contact.platformName || contact.label,
            href: contact.href,
        })),
        sections,
        base,
        accentColor,
    };
}
