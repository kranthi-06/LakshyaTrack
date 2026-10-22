import type { BaseTemplate } from '../templates/templateCatalog';

/**
 * Template-specific skill and summary presentations.
 *
 * The live previews do not share one skill design: some use labelled rows,
 * some use outlined chips, some solid pills, and the academic template uses a
 * three-column bullet grid. Keeping the presentation here means the PDF and
 * DOCX exporters can describe the same design without copy-pasting the
 * template JSX into two renderers.
 */

export type SkillCategory = 'technical' | 'tools' | 'soft';

export interface SkillChipSpec {
    /** Solid hex fill, or `#FFFFFF` for an outline-only chip. */
    background: string;
    text: string;
    border?: string;
    /** Border width in PDF points; the DOCX exporter converts to eighths. */
    borderWidth?: number;
    /** Fill opacity; used by the Creative tool chips. */
    opacity?: number;
    padX?: number;
    padY?: number;
    /** Space between chips in PDF points. */
    gap?: number;
    /** Corner radius in PDF points; large values produce pills. */
    radius?: number;
}

export interface SkillBoxSpec {
    background?: string;
    border?: { color: string; width: number };
    leftBar?: { color: string; width: number };
    paddingX: number;
    paddingY: number;
    headingInside: boolean;
    headingColor: string;
}

export type MainSkillLayout =
    | {
        kind: 'chips';
        groups: 'flat' | 'grouped';
        include: SkillCategory[];
        chip: SkillChipSpec;
        box?: SkillBoxSpec;
        /** Preview heading when it differs from the shared section label. */
        heading?: string;
        showHeading: boolean;
        /** The preview hides the whole block unless one of these groups exists. */
        requiresAny?: SkillCategory[];
    }
    | {
        kind: 'inline-labeled';
        include: SkillCategory[];
        labels: Record<SkillCategory, string>;
        separator: string;
        requiresAny?: SkillCategory[];
    }
    | {
        kind: 'inline';
        separator: string;
        include: SkillCategory[];
        center?: boolean;
        requiresAny?: SkillCategory[];
    }
    | {
        kind: 'bullet-grid';
        columns: number;
        include: SkillCategory[];
        requiresAny?: SkillCategory[];
    }
    | {
        kind: 'code';
        include: SkillCategory[];
        requiresAny?: SkillCategory[];
    };

export interface SummaryBoxSpec {
    background?: string;
    border?: { color: string; width: number };
    leftBar?: { color: string; width: number };
    paddingX: number;
    paddingY: number;
    headingInside: boolean;
    headingColor: string;
    /** Some previews render the summary without its shared section label. */
    hideHeading?: boolean;
}

export function cleanHex(value: string): string {
    const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
    return `#${(match?.[1] ?? '111827').toUpperCase()}`;
}

/** Blend `foreground` over `background`; weight is the foreground share. */
export function blendColor(foreground: string, background: string, weight: number): string {
    const fg = cleanHex(foreground).slice(1);
    const bg = cleanHex(background).slice(1);
    const channel = (offset: number) => Math.round(
        parseInt(fg.slice(offset, offset + 2), 16) * weight
        + parseInt(bg.slice(offset, offset + 2), 16) * (1 - weight),
    ).toString(16).padStart(2, '0');
    return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

/** The colour a CSS `#RRGGBBAA` fill resolves to over a known surface. */
export function alphaColor(color: string, surface: string, alpha: number): string {
    return blendColor(color, surface, alpha);
}

/** Blend a colour towards white. */
export function tintColor(color: string, amount: number): string {
    return blendColor(color, '#FFFFFF', amount);
}

export function skillCategory(groupLabel: string): SkillCategory {
    const label = groupLabel.toLowerCase();
    if (label.includes('soft')) return 'soft';
    if (label.startsWith('tool')) return 'tools';
    return 'technical';
}

export function layoutRequires(
    layout: MainSkillLayout,
    groups: Array<{ label: string }>,
): boolean {
    if (!layout.requiresAny || layout.requiresAny.length === 0) return true;
    return groups.some(group => layout.requiresAny!.includes(skillCategory(group.label)));
}

export function mainSkillLayoutFor(base: BaseTemplate, accent: string): MainSkillLayout {
    const color = cleanHex(accent);
    const all: SkillCategory[] = ['technical', 'tools', 'soft'];

    switch (base) {
        case 'classic':
            return {
                kind: 'inline-labeled',
                include: all,
                labels: {
                    technical: 'Languages & Technologies',
                    tools: 'Tools & Frameworks',
                    soft: 'Soft Skills',
                },
                separator: ', ',
            };

        case 'minimal-ats':
            return {
                kind: 'inline-labeled',
                include: all,
                labels: {
                    technical: 'Languages & Technologies',
                    tools: 'Tools & Frameworks',
                    soft: 'Soft Skills',
                },
                separator: ', ',
                requiresAny: ['technical', 'tools'],
            };

        case 'academic':
            return { kind: 'bullet-grid', columns: 3, include: all };

        case 'compact':
            return {
                kind: 'inline',
                separator: '  •  ',
                include: all,
                requiresAny: ['technical', 'tools'],
            };

        case 'elegant':
            return {
                kind: 'inline',
                separator: '  ·  ',
                include: all,
                center: true,
                requiresAny: ['technical', 'tools'],
            };

        case 'executive':
            return {
                kind: 'chips',
                groups: 'flat',
                include: all,
                heading: 'Core Competencies',
                showHeading: true,
                requiresAny: ['technical', 'soft'],
                chip: { background: color, text: '#FFFFFF', padX: 5, padY: 2.4, gap: 4, radius: 3 },
                box: {
                    background: tintColor(color, 0.02),
                    border: { color: tintColor(color, 0.08), width: 0.6 },
                    paddingX: 10,
                    paddingY: 8,
                    headingInside: true,
                    headingColor: '#9CA3AF',
                },
            };

        case 'corporate':
            return {
                kind: 'chips',
                groups: 'flat',
                include: ['technical', 'tools'],
                heading: 'Core Competencies',
                showHeading: true,
                requiresAny: ['technical'],
                chip: { background: color, text: '#FFFFFF', padX: 4.5, padY: 1.8, gap: 3.5, radius: 2 },
            };

        case 'timeline':
            return {
                kind: 'chips',
                groups: 'flat',
                include: ['technical', 'tools'],
                showHeading: false,
                requiresAny: ['technical', 'tools'],
                chip: { background: color, text: '#FFFFFF', padX: 5, padY: 2, gap: 4, radius: 99 },
            };

        case 'portfolio':
            return {
                kind: 'chips',
                groups: 'flat',
                include: ['technical', 'tools'],
                heading: 'Skills & Tools',
                showHeading: true,
                requiresAny: ['technical', 'tools'],
                chip: {
                    background: tintColor(color, 0.035),
                    text: color,
                    border: tintColor(color, 0.25),
                    borderWidth: 0.8,
                    padX: 4.5,
                    padY: 2.2,
                    gap: 4,
                    radius: 3.5,
                },
            };

        case 'fresh':
            return {
                kind: 'chips',
                groups: 'flat',
                include: ['technical', 'tools'],
                heading: 'Skills',
                showHeading: true,
                requiresAny: ['technical'],
                chip: {
                    background: tintColor(color, 0.063),
                    text: color,
                    padX: 4.5,
                    padY: 1.8,
                    gap: 3.5,
                    radius: 4,
                },
            };

        case 'bold-header':
            return {
                kind: 'chips',
                groups: 'flat',
                include: all,
                heading: 'Skills',
                showHeading: true,
                requiresAny: ['technical'],
                chip: {
                    background: '#FFFFFF',
                    text: color,
                    border: color,
                    borderWidth: 1.5,
                    padX: 4.5,
                    padY: 2.2,
                    gap: 4,
                    radius: 3,
                },
            };

        case 'developer':
            return {
                kind: 'code',
                include: all,
                requiresAny: ['technical', 'tools'],
            };

        default:
            // Sidebar templates render skills through the sidebar treatment.
            return { kind: 'inline', separator: '  ·  ', include: all };
    }
}

export function summaryBoxFor(base: BaseTemplate, accent: string): SummaryBoxSpec | null {
    const color = cleanHex(accent);
    switch (base) {
        case 'creative':
            return {
                background: tintColor(color, 0.031),
                leftBar: { color, width: 3 },
                paddingX: 11,
                paddingY: 9,
                headingInside: true,
                headingColor: color,
            };
        case 'portfolio':
            return {
                background: tintColor(color, 0.05),
                border: { color: '#F3F4F6', width: 0.8 },
                paddingX: 11,
                paddingY: 9,
                headingInside: true,
                headingColor: color,
            };
        case 'fresh':
            return {
                background: tintColor(color, 0.016),
                border: { color: tintColor(color, 0.125), width: 0.8 },
                paddingX: 10,
                paddingY: 8,
                headingInside: false,
                headingColor: color,
            };
        case 'corporate':
            return {
                background: tintColor(color, 0.024),
                leftBar: { color, width: 3 },
                paddingX: 10,
                paddingY: 8,
                headingInside: false,
                headingColor: color,
            };
        case 'executive':
            return {
                leftBar: { color: '#B8860B', width: 1.5 },
                paddingX: 9,
                paddingY: 2,
                headingInside: false,
                headingColor: '#9CA3AF',
            };
        case 'timeline':
            return {
                leftBar: { color, width: 3 },
                paddingX: 8,
                paddingY: 2,
                headingInside: false,
                headingColor: color,
                hideHeading: true,
            };
        default:
            return null;
    }
}
