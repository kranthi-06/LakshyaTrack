import type { ResumeData } from './types';

/**
 * Shared section-ordering model consumed by every template and the visual
 * builder's drag-and-drop palette.
 *
 * Entries use stable ids: the five standard sections plus `custom:<uuid>` for
 * user-created sections. Templates derive their body layout from
 * resolveLayoutSections()/resolveZoneSections() so a saved order survives
 * template switches and never depends on render markup.
 */

export const STANDARD_SECTIONS = ['summary', 'experience', 'education', 'projects', 'skills'] as const;
export type StandardSectionId = (typeof STANDARD_SECTIONS)[number];

/** Every section id ever allowed in section_order / hidden_sections. */
export type SectionId = StandardSectionId | `custom:${string}`;

export const SECTION_LABELS: Record<StandardSectionId, string> = {
    summary: 'Professional Summary',
    experience: 'Work Experience',
    education: 'Education',
    projects: 'Projects',
    skills: 'Technical Skills',
};

export const DEFAULT_SECTION_ORDER: StandardSectionId[] = ['summary', 'experience', 'education', 'projects', 'skills'];

/**
 * Native section flow of each engine. Used as the fallback when a resume has
 * no persisted order, so existing resumes keep their original layout until the
 * user explicitly reorders sections.
 */
export const BASE_DEFAULT_ORDER: Record<BaseEngineId, StandardSectionId[]> = {
    modern: ['summary', 'experience', 'projects', 'skills', 'education'],
    classic: DEFAULT_SECTION_ORDER,
    creative: ['summary', 'experience', 'skills', 'education', 'projects'],
    developer: ['summary', 'experience', 'skills', 'education', 'projects'],
    'minimal-ats': ['summary', 'experience', 'skills', 'education', 'projects'],
    academic: ['summary', 'education', 'projects', 'experience', 'skills'],
    executive: ['summary', 'experience', 'education', 'skills', 'projects'],
    'two-column': ['summary', 'experience', 'projects', 'skills', 'education'],
    portfolio: ['summary', 'projects', 'experience', 'skills', 'education'],
    compact: ['summary', 'experience', 'skills', 'education', 'projects'],
    timeline: ['summary', 'experience', 'education', 'projects', 'skills'],
    elegant: ['summary', 'experience', 'education', 'projects', 'skills'],
    'bold-header': ['summary', 'experience', 'education', 'projects', 'skills'],
    infographic: ['summary', 'experience', 'projects', 'skills', 'education'],
    corporate: ['summary', 'experience', 'education', 'skills', 'projects'],
    fresh: ['summary', 'experience', 'projects', 'skills', 'education'],
};

/**
 * Layout zones for column-based templates. A section's zone is part of the
 * template's visual identity, so drag-and-drop reorders within a zone but
 * never rewrites the template's column design.
 */
export type SectionZone = 'main' | 'sidebar';

type ZoneMap = Partial<Record<StandardSectionId, SectionZone>>;

/** Sections rendered in the sidebar by two-column engines; everything else is main. */
const SIDEBAR_ZONES: Partial<Record<BaseEngineId, ZoneMap>> = {
    modern: { skills: 'sidebar', education: 'sidebar' },
    creative: { skills: 'sidebar', education: 'sidebar' },
    infographic: { skills: 'sidebar', education: 'sidebar' },
    'two-column': { skills: 'sidebar', education: 'sidebar' },
};

export type BaseEngineId =
    | 'modern' | 'classic' | 'creative' | 'developer' | 'minimal-ats' | 'academic'
    | 'executive' | 'two-column' | 'portfolio' | 'compact' | 'timeline' | 'elegant'
    | 'bold-header' | 'infographic' | 'corporate' | 'fresh';

export function sectionZone(base: BaseEngineId, id: StandardSectionId): SectionZone {
    return SIDEBAR_ZONES[base]?.[id] ?? 'main';
}

const CUSTOM_PREFIX = 'custom:';

export function customSectionId(id: string): `custom:${string}` {
    return `${CUSTOM_PREFIX}${id}`;
}

export function parseCustomSectionId(id: string): string | null {
    return id.startsWith(CUSTOM_PREFIX) ? id.slice(CUSTOM_PREFIX.length) : null;
}

export function isStandardSectionId(value: string): value is StandardSectionId {
    return (STANDARD_SECTIONS as readonly string[]).includes(value);
}

export function isKnownSectionId(value: string, data: Pick<ResumeData, 'custom_sections'>): value is SectionId {
    if (isStandardSectionId(value)) return true;
    const customId = parseCustomSectionId(value);
    return customId !== null && (data.custom_sections ?? []).some(cs => cs.id === customId);
}

/**
 * Resolve the persisted order into a complete, deduplicated ordering.
 * Unknown or dangling ids (e.g. a deleted custom section) are dropped; missing
 * standard sections are appended in canonical order so no section can ever be
 * lost by a bad persisted value.
 */
export function normalizeSectionOrder(
    raw: string[] | undefined,
    data: Pick<ResumeData, 'custom_sections'>,
    fallbackOrder: StandardSectionId[] = DEFAULT_SECTION_ORDER,
): SectionId[] {
    const known = new Set<string>(STANDARD_SECTIONS);
    for (const cs of data.custom_sections ?? []) known.add(customSectionId(cs.id));

    const result: string[] = [];
    for (const id of raw ?? []) {
        if (!known.has(id) || result.includes(id)) continue;
        result.push(id);
    }
    for (const id of fallbackOrder) {
        if (!result.includes(id)) result.push(id);
    }
    for (const cs of data.custom_sections ?? []) {
        const cid = customSectionId(cs.id);
        if (!result.includes(cid)) result.push(cid);
    }
    return result as SectionId[];
}

/** Ordered entries this data value actually renders (non-empty content). */
export function resolveLayoutSections(data: ResumeData, base?: BaseEngineId): SectionId[] {
    const fallback = base ? BASE_DEFAULT_ORDER[base] : DEFAULT_SECTION_ORDER;
    const order = normalizeSectionOrder(data.section_order, data, fallback);
    const hidden = new Set(data.hidden_sections ?? []);
    return order.filter(id => {
        if (hidden.has(id)) return false;
        if (isStandardSectionId(id)) return sectionHasContent(data, id);
        // A newly added custom section starts empty. It should stay in the
        // palette (so the user can fill it in) but must not render a heading
        // with a blank body in the resume or in exports.
        const custom = (data.custom_sections ?? []).find(cs => customSectionId(cs.id) === id);
        return Boolean(custom?.title?.trim() && custom?.content?.trim());
    });
}

/** Ordered entries for one zone of a column-based engine. */
export function resolveZoneSections(data: ResumeData, base: BaseEngineId, zone: SectionZone): SectionId[] {
    return resolveLayoutSections(data, base).filter(id => {
        if (!isStandardSectionId(id)) {
            const custom = (data.custom_sections ?? []).find(cs => customSectionId(cs.id) === id);
            return (custom?.zone || 'main') === zone;
        }
        return sectionZone(base, id) === zone;
    });
}

export function sectionHasContent(
    data: Pick<ResumeData, 'personal' | 'experience' | 'education' | 'projects' | 'skills'>,
    id: StandardSectionId,
): boolean {
    switch (id) {
        case 'summary': return Boolean(data.personal.professional_summary?.trim());
        case 'experience': return data.experience.some(e => e.title?.trim());
        case 'education': return data.education.some(e => e.degree?.trim());
        case 'projects': return data.projects.some(p => p.name?.trim());
        case 'skills':
            return data.skills.technical_skills.length > 0
                || data.skills.tools.length > 0
                || data.skills.soft_skills.length > 0;
    }
}

/** Ordered entries for the palette: visible first, hidden kept for restore. */
export function resolvePaletteSections(
    data: ResumeData,
    base: BaseEngineId,
): Array<{ id: SectionId; label: string; zone: SectionZone; visible: boolean; renderable: boolean }> {
    const order = normalizeSectionOrder(data.section_order, data, BASE_DEFAULT_ORDER[base]);
    const hidden = new Set(data.hidden_sections ?? []);
    return order.map(id => {
        const isStandard = isStandardSectionId(id);
        let label: string;
        let zone: SectionZone;
        
        if (isStandard) {
            // Fallback to id if label is missing, then to a human-readable version
            label = SECTION_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1) || 'Section';
            zone = sectionZone(base, id);
        } else {
            const custom = (data.custom_sections ?? []).find(cs => customSectionId(cs.id) === id);
            // Fallback for custom sections without titles
            label = custom?.title?.trim() || 'Custom Section';
            // Use custom section's zone if specified, otherwise default to main
            zone = (custom?.zone === 'sidebar' ? 'sidebar' : 'main') as SectionZone;
        }
        
        return {
            id,
            label,
            zone,
            visible: !hidden.has(id),
            renderable: isStandard ? sectionHasContent(data, id) : Boolean((data.custom_sections ?? []).find(cs => customSectionId(cs.id) === id)?.content?.trim()),
        };
    });
}
