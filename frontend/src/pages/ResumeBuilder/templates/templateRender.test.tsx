import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultResumeData, type ResumeData } from '../types';
import { TEMPLATE_CATALOG, type BaseTemplate } from './templateCatalog';
import {
    AcademicTemplate,
    BoldHeaderTemplate,
    ClassicTemplate,
    CompactTemplate,
    CorporateTemplate,
    CreativeTemplate,
    DeveloperTemplate,
    ElegantTemplate,
    ExecutiveTemplate,
    FreshTemplate,
    InfographicTemplate,
    MinimalATSTemplate,
    ModernTemplate,
    PortfolioTemplate,
    TimelineTemplate,
    TwoColumnTemplate,
} from './index';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

const templates: Record<BaseTemplate, ComponentType<TemplateProps>> = {
    modern: ModernTemplate,
    classic: ClassicTemplate,
    creative: CreativeTemplate,
    developer: DeveloperTemplate,
    'minimal-ats': MinimalATSTemplate,
    academic: AcademicTemplate,
    executive: ExecutiveTemplate,
    'two-column': TwoColumnTemplate,
    portfolio: PortfolioTemplate,
    compact: CompactTemplate,
    timeline: TimelineTemplate,
    elegant: ElegantTemplate,
    'bold-header': BoldHeaderTemplate,
    infographic: InfographicTemplate,
    corporate: CorporateTemplate,
    fresh: FreshTemplate,
};

const populated: ResumeData = {
    ...defaultResumeData,
    target_role: 'Staff Platform Engineer',
    personal: {
        full_name: 'Aarav Krishnan',
        email: 'aarav.krishnan@example.com',
        phone: '+91 98765 43210',
        location: 'Bengaluru, Karnataka, India',
        headline: 'Staff Platform Engineer',
        professional_summary: 'Platform engineer building reliable distributed systems.',
        linkedin_url: 'https://www.linkedin.com/in/aarav-krishnan',
        github_url: 'https://github.com/aaravk',
        portfolio_url: 'https://aarav.dev',
        website_url: 'https://aarav.dev/writing',
        leetcode_url: 'https://leetcode.com/u/aaravk',
        hackerrank_url: 'https://www.hackerrank.com/profile/aaravk',
        kaggle_url: 'https://www.kaggle.com/aaravk',
    },
    experience: [
        {
            title: 'Staff Platform Engineer',
            organization: 'Northstar Cloud Systems',
            duration: '2021 — Present',
            description: '',
            bullets: ['Cut p99 latency by 38% for 40M monthly users.'],
        },
    ],
    education: [
        {
            degree: 'B.Tech in Computer Science',
            institution: 'Indian Institute of Technology, Madras',
            duration: '2012 — 2016',
            description: 'GPA 9.1/10',
        },
    ],
    projects: [
        {
            name: 'OpenTelemetry Cost Advisor',
            technologies: 'TypeScript, Go',
            description: 'Attributes observability spend to teams.',
        },
    ],
    skills: {
        raw_skills: '',
        technical_skills: ['TypeScript', 'Go'],
        tools: ['Terraform', 'Kubernetes'],
        soft_skills: ['Mentoring'],
        suggested_skills: [],
    },
    section_order: ['summary', 'experience', 'projects', 'skills', 'education', 'custom:awards', 'custom:languages'],
    hidden_sections: [],
    custom_sections: [
        {
            id: 'awards',
            title: 'Awards & Recognition',
            content: 'Engineering Excellence Award (2024)',
            zone: 'main',
        },
        {
            id: 'languages',
            title: 'Languages',
            content: 'English, Tamil, Hindi',
            zone: 'sidebar',
        },
    ],
};

const emptyPersonal: ResumeData = {
    ...populated,
    personal: {
        ...defaultResumeData.personal,
    },
};

function render(template: BaseTemplate, data: ResumeData, accentColor?: string) {
    return renderToStaticMarkup(createElement(templates[template], { data, accentColor }));
}

describe('template rendering', () => {
    it('renders every catalog template and preserves contact links', () => {
        expect(TEMPLATE_CATALOG).toHaveLength(52);

        for (const template of TEMPLATE_CATALOG) {
            const html = render(template.base, populated, template.default_color);
            expect(html.length, template.template_id).toBeGreaterThan(1_000);
            expect(html, template.template_id).not.toContain('undefined');
            expect(html, template.template_id).toContain('Aarav Krishnan');
            expect(html, template.template_id).toContain('href="mailto:aarav.krishnan@example.com"');
            expect(html, template.template_id).toContain('href="tel:+919876543210"');

            if (template.base === 'developer') {
                // The terminal template intentionally renders contacts as code
                // fields rather than icon chips, but every profile must survive.
                for (const value of ['linkedin.com/in/aarav-krishnan', 'github.com/aaravk', 'leetcode.com/u/aaravk']) {
                    expect(html, template.template_id).toContain(value);
                }
            } else {
                expect(html, template.template_id).toContain('href="https://www.linkedin.com/in/aarav-krishnan"');
                expect(html, template.template_id).toContain('href="https://github.com/aaravk"');
                for (const label of ['LeetCode', 'HackerRank', 'Kaggle']) {
                    expect(html, template.template_id).toContain(label);
                }
                // Every ContactLinks item is an inline-flex row whose icon slot
                // is exactly one line tall and vertically centred.
                expect(html, template.template_id).toContain('inline-flex items-center');
                expect(html, template.template_id).toContain('leading-none');
            }
        }
    });

    it('omits every contact element when the personal fields are empty', () => {
        for (const template of TEMPLATE_CATALOG) {
            const html = render(template.base, emptyPersonal, template.default_color);
            expect(html, template.template_id).not.toContain('mailto:');
            expect(html, template.template_id).not.toContain('tel:');
            expect(html, template.template_id).not.toContain('undefined');
            expect(html, template.template_id).not.toContain('>null<');
        }
    });

    it('renders custom sections in the configured zone for column templates', () => {
        const modern = render('modern', populated);
        expect(modern).toContain('Awards &amp; Recognition');
        expect(modern).toContain('Languages');
        expect(modern).toContain('Engineering Excellence Award');

        const developer = render('developer', populated);
        expect(developer).toContain('Awards &amp; Recognition');
        expect(developer).toContain('Engineering Excellence Award');
    });

    it('keeps separate date labels non-shrinking so long titles cannot overlap them', () => {
        const data: ResumeData = {
            ...populated,
            experience: [
                {
                    ...populated.experience[0],
                    title: 'Principal Platform Engineer, Reliability and Developer Experience',
                    duration: 'January 2021 — Present (5 yrs 4 mos)',
                },
            ],
            education: [
                {
                    ...populated.education[0],
                    degree: 'B.Tech in Computer Science and Engineering, Minor in Economics',
                    duration: 'August 2008 — May 2012',
                },
            ],
        };
        const flexDateBases: BaseTemplate[] = [
            'minimal-ats', 'modern', 'classic', 'corporate', 'compact', 'academic',
            'fresh', 'timeline', 'infographic', 'two-column', 'bold-header',
            'creative', 'portfolio', 'executive',
        ];
        for (const base of flexDateBases) {
            const html = render(base, data);
            expect(html, base).toContain('whitespace-nowrap');
            expect(html, base).toContain('flex-shrink-0');
            expect(html, base).not.toContain('undefined');
        }
    });
});
