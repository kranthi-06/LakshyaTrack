import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SECTION_ORDER,
    customSectionId,
    normalizeSectionOrder,
    resolveLayoutSections,
    resolvePaletteSections,
    resolveZoneSections,
} from './sectionModel';
import { defaultResumeData, type ResumeData } from './types';

function makeData(overrides: Partial<ResumeData>): ResumeData {
    return {
        ...defaultResumeData,
        personal: { ...defaultResumeData.personal, professional_summary: 'Driven engineer.' },
        experience: [{ title: 'Engineer', organization: 'Acme', duration: '2020-2022', description: '', bullets: [] }],
        education: [{ degree: 'B.Tech', institution: 'IIT', duration: '2016-2020', description: '' }],
        projects: [{ name: 'Apollo', technologies: 'React', description: '' }],
        skills: { raw_skills: '', technical_skills: ['React'], tools: [], soft_skills: [], suggested_skills: [] },
        ...overrides,
    };
}

describe('normalizeSectionOrder', () => {
    it('falls back to the canonical order for legacy resumes with no persisted order', () => {
        expect(normalizeSectionOrder(undefined, makeData({}))).toEqual(DEFAULT_SECTION_ORDER);
        expect(normalizeSectionOrder([], makeData({}))).toEqual(DEFAULT_SECTION_ORDER);
    });

    it('honors a persisted order and appends missing standard sections', () => {
        expect(normalizeSectionOrder(['projects', 'summary'], makeData({})))
            .toEqual(['projects', 'summary', 'experience', 'education', 'skills']);
    });

    it('drops unknown ids, duplicates, and dangling custom ids', () => {
        const data = makeData({});
        expect(normalizeSectionOrder(['projects', 'nonsense', 'projects', 'custom:ghost', 'summary'], data))
            .toEqual(['projects', 'summary', 'experience', 'education', 'skills']);
    });

    it('keeps custom sections that exist and appends new ones at the end', () => {
        const data = makeData({ custom_sections: [{ id: 'c1', title: 'Certifications', content: 'AWS SA' }] });
        expect(normalizeSectionOrder(['custom:c1', 'skills', 'summary'], data))
            .toEqual(['custom:c1', 'skills', 'summary', 'experience', 'education', 'projects']);
    });
});

describe('resolveLayoutSections', () => {
    it('orders the rendered sections by the persisted order and skips empty sections', () => {
        const data = makeData({ section_order: ['skills', 'experience'] });
        expect(resolveLayoutSections(data)).toEqual(['skills', 'experience', 'summary', 'education', 'projects']);
    });

    it('omits sections hidden by the user', () => {
        const data = makeData({ hidden_sections: ['summary', 'education'] });
        expect(resolveLayoutSections(data)).toEqual(['experience', 'projects', 'skills']);
    });

    it('renders custom sections at their persisted position', () => {
        const data = makeData({
            section_order: ['summary', 'custom:c1', 'experience'],
            custom_sections: [{ id: 'c1', title: 'Awards', content: 'Winner 2023' }],
        });
        expect(resolveLayoutSections(data)).toEqual(['summary', 'custom:c1', 'experience', 'education', 'projects', 'skills']);
    });

    it('drops a custom section from the layout once it is deleted from data', () => {
        const data = makeData({ section_order: ['custom:c1', 'summary'], custom_sections: [] });
        expect(resolveLayoutSections(data)).toEqual(['summary', 'experience', 'education', 'projects', 'skills']);
    });
});

describe('resolveZoneSections', () => {
    it('keeps each column engine zone stable while honoring order within the zone', () => {
        const data = makeData({ section_order: ['education', 'skills', 'projects', 'summary'] });
        expect(resolveZoneSections(data, 'modern', 'sidebar')).toEqual(['education', 'skills']);
        expect(resolveZoneSections(data, 'modern', 'main')).toEqual(['projects', 'summary', 'experience']);
    });

    it('renders single-column engines entirely in the main zone', () => {
        const data = makeData({});
        expect(resolveZoneSections(data, 'classic', 'main')).toEqual(DEFAULT_SECTION_ORDER);
        expect(resolveZoneSections(data, 'classic', 'sidebar')).toEqual([]);
    });

    it('always places custom sections in the main zone', () => {
        const data = makeData({
            custom_sections: [{ id: 'c1', title: 'Languages', content: 'English, Telugu' }],
        });
        expect(resolveZoneSections(data, 'infographic', 'sidebar')).toEqual(['skills', 'education']);
        expect(resolveZoneSections(data, 'infographic', 'main')).toEqual(['summary', 'experience', 'projects', 'custom:c1']);
    });
});

describe('resolvePaletteSections', () => {
    it('reports visibility, zone, and renderable state for the drag-and-drop palette', () => {
        const data = makeData({
            section_order: ['summary', 'skills'],
            hidden_sections: ['projects'],
            custom_sections: [{ id: 'c1', title: 'Awards', content: '' }],
        });
        const palette = resolvePaletteSections(data, 'modern');
        const byId = Object.fromEntries(palette.map(e => [e.id, e]));

        expect(byId['skills'].zone).toBe('sidebar');
        expect(byId['summary'].zone).toBe('main');
        expect(byId['projects'].visible).toBe(false);
        expect(byId['summary'].visible).toBe(true);
        expect(byId['summary'].renderable).toBe(true);
        expect(byId['custom:c1'].label).toBe('Awards');
        expect(byId['custom:c1'].renderable).toBe(false);
    });

    it('uses the custom id helper consistently', () => {
        expect(customSectionId('abc')).toBe('custom:abc');
    });
});
