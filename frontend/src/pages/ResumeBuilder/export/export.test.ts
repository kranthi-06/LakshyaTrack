import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { defaultResumeData, type ResumeData } from '../types';
import { TEMPLATE_CATALOG, resolveBaseTemplate, type BaseTemplate } from '../templates/templateCatalog';
import { buildResumeDocument } from './resumeDocument';
import { A4_HEIGHT_PT, A4_WIDTH_PT, buildResumePdf } from './pdfExport';
import { buildResumeDocx } from './docxExport';
import { buildResumeJson, stringifyResumeJson } from './jsonExport';

const sampleData: ResumeData = {
    ...defaultResumeData,
    target_role: 'Staff Platform Engineer',
    personal: {
        full_name: 'Aarav Krishnan',
        email: 'aarav.krishnan@example.com',
        phone: '+91 98765 43210',
        location: 'Bengaluru, Karnataka, India',
        headline: 'Staff Platform Engineer',
        professional_summary:
            'Platform engineer with 9 years of experience building reliable distributed systems, developer tooling, and cloud infrastructure. Led migrations affecting 40M monthly users and reduced deployment lead time from days to minutes.',
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
            bullets: [
                'Designed a multi-region service mesh rollout that cut p99 latency by 38% for 40M monthly users.',
                'Built a self-service deployment platform adopted by 23 teams, reducing release lead time from 3 days to 12 minutes.',
            ],
        },
        {
            title: 'Senior Backend Engineer',
            organization: 'Meridian Analytics',
            duration: '2018 — 2021',
            description: '',
            bullets: ['Owned the event ingestion pipeline processing 2.4B events per day with 99.99% availability.'],
        },
    ],
    education: [
        {
            degree: 'B.Tech in Computer Science',
            institution: 'Indian Institute of Technology, Madras',
            duration: '2012 — 2016',
            description: "GPA 9.1/10 · Dean's List",
        },
    ],
    projects: [
        {
            name: 'OpenTelemetry Cost Advisor',
            technologies: 'TypeScript, Go, Kubernetes',
            description: 'Open-source tool that attributes observability spend to teams and recommends sampling policies.',
        },
    ],
    skills: {
        raw_skills: '',
        technical_skills: ['TypeScript', 'Go', 'Python', 'Distributed Systems', 'Kubernetes', 'PostgreSQL'],
        tools: ['Terraform', 'Prometheus', 'Grafana', 'GitHub Actions', 'AWS', 'GCP'],
        soft_skills: ['Technical Leadership', 'Mentoring', 'Incident Command'],
        suggested_skills: [],
    },
    ats: { score: 87, strengths: ['Clear impact'], improvements: ['Add metrics'] },
    section_order: ['summary', 'experience', 'projects', 'skills', 'education', 'custom:awards', 'custom:languages'],
    hidden_sections: ['education'],
    custom_sections: [
        {
            id: 'awards',
            title: 'Awards & Recognition',
            content: 'Engineering Excellence Award, Northstar Cloud (2024)\nSpeaker, KubeCon India (2023)',
            zone: 'main',
        },
        {
            id: 'languages',
            title: 'Languages',
            content: 'English (professional), Tamil (native), Hindi (conversational)',
            zone: 'sidebar',
        },
    ],
};

const longData: ResumeData = {
    ...sampleData,
    personal: {
        ...sampleData.personal,
        professional_summary: Array.from(
            { length: 8 },
            () => 'Led cross-functional platform programmes across distributed teams and delivered measurable reliability improvements for customers in regulated industries.',
        ).join(' '),
    },
    experience: Array.from({ length: 12 }, (_, index) => ({
        title: `Principal Platform Engineer ${index + 1}`,
        organization: 'Northstar Cloud Systems International',
        duration: `20${10 + index} — 20${11 + index}`,
        description:
            'Owned platform strategy, reliability, and developer productivity for a global engineering organisation.',
        bullets: Array.from(
            { length: 6 },
            (_, bullet) =>
                `Delivered programme ${bullet + 1} across 14 regions, reducing operational toil and improving service reliability for millions of customers.`,
        ),
    })),
};

async function extractPdfPages(bytes: Uint8Array) {
    const task = getDocument({
        data: new Uint8Array(bytes),
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
    });
    const pdf = await task.promise;
    const pages: Array<{
        text: string;
        items: Array<{ text: string; x: number; y: number; width: number; height: number }>;
    }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items
            .filter((item): item is (typeof content.items)[number] & { str: string; transform: number[]; width: number; height: number } =>
                'str' in item && Array.isArray(item.transform))
            .map(item => ({
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
                height: item.height,
            }));
        pages.push({ text: items.map(item => item.text).join(' '), items });
        page.cleanup();
    }
    await pdf.destroy();
    return pages;
}

interface PdfLink {
    uri: string;
    rect: number[];
}

function expectNoOverlappingText(pages: Awaited<ReturnType<typeof extractPdfPages>>): void {
    for (const [pageIndex, page] of pages.entries()) {
        const items = page.items.filter(item => item.text.trim() && item.width > 0 && item.height > 0);
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i];
                const b = items[j];
                const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                // Text runs may touch, but two distinct runs must never paint
                // over each other. Ignore identical strings extracted twice by
                // the PDF text layering heuristics.
                if (xOverlap > 1 && yOverlap > 1 && a.text !== b.text) {
                    throw new Error(
                        `Overlapping text on page ${pageIndex + 1}: "${a.text}" and "${b.text}"`,
                    );
                }
            }
        }
    }
}

async function extractPdfLinks(bytes: Uint8Array): Promise<Array<{ page: number; links: PdfLink[] }>> {
    const doc = await PDFDocument.load(bytes);
    return doc.getPages().map((page, index) => {
        const annotations = page.node.Annots()?.asArray() ?? [];
        const links: PdfLink[] = [];
        for (const reference of annotations) {
            const annotation = doc.context.lookup(reference);
            if (!(annotation instanceof PDFDict)) continue;
            const action = annotation.lookup(PDFName.of('A'), PDFDict);
            const uri = action?.lookup(PDFName.of('URI'), PDFString);
            const rect = annotation.lookup(PDFName.of('Rect'));
            if (!uri) continue;
            links.push({
                uri: uri.decodeText(),
                rect: rect instanceof PDFArray
                    ? rect.asArray().map(value => Number(value.toString()))
                    : [],
            });
        }
        return { page: index + 1, links };
    });
}

describe('resume document model', () => {
    it('preserves section order, visibility and custom-section zones', () => {
        const model = buildResumeDocument(sampleData, 'creative', '#e11d48');
        expect(model.sections.map(section => section.id)).toEqual([
            'summary',
            'experience',
            'projects',
            'skills',
            'custom:awards',
            'custom:languages',
        ]);
        expect(model.sections.find(section => section.id === 'education')).toBeUndefined();
        expect(model.sections.find(section => section.id === 'custom:languages')?.zone).toBe('sidebar');
        expect(model.sections.find(section => section.id === 'custom:awards')?.heading).toBe('Awards & Recognition');
        expect(model.contacts).toHaveLength(10);
        expect(model.contacts.find(contact => contact.kind === 'linkedin')?.href).toContain('linkedin.com');
    });

    it('drops empty custom sections instead of rendering blank headings', () => {
        const data: ResumeData = {
            ...sampleData,
            custom_sections: [
                { id: 'empty', title: 'Empty Section', content: '   ' },
                { id: 'untitled', title: '', content: 'Some content' },
            ],
            section_order: ['summary', 'custom:empty', 'custom:untitled'],
            hidden_sections: [],
        };
        const model = buildResumeDocument(data, 'modern', '#5c52d2');
        const ids = model.sections.map(section => section.id);
        expect(ids).toContain('summary');
        expect(ids).not.toContain('custom:empty');
        expect(ids).not.toContain('custom:untitled');
    });

    it('resolves all 52 catalog templates to a base engine', () => {
        expect(TEMPLATE_CATALOG).toHaveLength(52);
        const bases = new Set<BaseTemplate>();
        for (const template of TEMPLATE_CATALOG) {
            const resolved = resolveBaseTemplate(template.template_id);
            expect(resolved).toBe(template.base);
            bases.add(resolved);
            const model = buildResumeDocument(sampleData, resolved, template.default_color);
            expect(model.base).toBe(template.base);
            expect(model.sections.length).toBeGreaterThan(0);
        }
        expect(bases.size).toBe(16);
        expect(resolveBaseTemplate('modern')).toBe('modern');
        expect(resolveBaseTemplate('unknown-template')).toBe('modern');
        expect(resolveBaseTemplate(null)).toBe('modern');
    });
});

describe('PDF export', () => {
    it('builds an A4 document with selectable text and real link annotations', async () => {
        const model = buildResumeDocument(sampleData, 'modern', '#5c52d2');
        const { bytes, pageCount } = await buildResumePdf(model);
        expect(pageCount).toBeGreaterThanOrEqual(1);
        expect(bytes.byteLength).toBeGreaterThan(2_000);

        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(pageCount);
        for (const page of doc.getPages()) {
            expect(page.getWidth()).toBeCloseTo(A4_WIDTH_PT, 2);
            expect(page.getHeight()).toBeCloseTo(A4_HEIGHT_PT, 2);
        }

        const pages = await extractPdfPages(bytes);
        const text = pages.map(page => page.text).join('\n');
        const compactText = text.replace(/\s+/g, '').toLowerCase();
        expect(text).toContain('Aarav Krishnan');
        expect(text).toContain('Staff Platform Engineer');
        expect(compactText).toContain('awards&recognition');
        expect(compactText).toContain('languages');
        expect(text).toContain('Northstar Cloud Systems');

        for (const page of pages) {
            for (const item of page.items) {
                if (!item.text.trim()) continue;
                expect(item.x).toBeGreaterThanOrEqual(-0.5);
                expect(item.x + item.width).toBeLessThanOrEqual(A4_WIDTH_PT + 0.5);
                expect(item.y).toBeGreaterThanOrEqual(-0.5);
                expect(item.y + item.height).toBeLessThanOrEqual(A4_HEIGHT_PT + 0.5);
            }
        }

        const links = await extractPdfLinks(bytes);
        const uris = links.flatMap(page => page.links.map(link => link.uri));
        expect(uris).toContain('mailto:aarav.krishnan@example.com');
        expect(uris).toContain('tel:+919876543210');
        expect(uris).toContain('https://www.linkedin.com/in/aarav-krishnan');
        expect(uris).toContain('https://github.com/aaravk');
        for (const page of links) {
            for (const link of page.links) {
                expect(link.rect).toHaveLength(4);
                expect(link.rect[0]).toBeGreaterThanOrEqual(0);
                expect(link.rect[2]).toBeLessThanOrEqual(A4_WIDTH_PT + 0.5);
                expect(link.rect[1]).toBeGreaterThanOrEqual(0);
                expect(link.rect[3]).toBeLessThanOrEqual(A4_HEIGHT_PT + 0.5);
            }
        }
    });

    it('paginates long resumes without clipping text', async () => {
        const model = buildResumeDocument(longData, 'classic', '#1f2937');
        const { bytes, pageCount } = await buildResumePdf(model);
        expect(pageCount).toBeGreaterThan(1);
        const pages = await extractPdfPages(bytes);
        expect(pages).toHaveLength(pageCount);
        for (const page of pages) {
            expect(page.items.some(item => item.text.trim())).toBe(true);
            for (const item of page.items) {
                if (!item.text.trim()) continue;
                expect(item.x).toBeGreaterThanOrEqual(-0.5);
                expect(item.x + item.width).toBeLessThanOrEqual(A4_WIDTH_PT + 0.5);
                expect(item.y).toBeGreaterThanOrEqual(-0.5);
                expect(item.y + item.height).toBeLessThanOrEqual(A4_HEIGHT_PT + 0.5);
            }
        }
    });

    it('keeps headings, dates and body text from overlapping on every engine', async () => {
        for (const template of TEMPLATE_CATALOG) {
            const model = buildResumeDocument(longData, template.base, template.default_color);
            const { bytes } = await buildResumePdf(model);
            const pages = await extractPdfPages(bytes);
            expect(() => expectNoOverlappingText(pages), template.template_id).not.toThrow();
        }
    });

    it('wraps long contact values in the developer code header', async () => {
        const data: ResumeData = {
            ...sampleData,
            personal: {
                ...sampleData.personal,
                website_url: `https://example.com/${'very-long-segment-'.repeat(8)}`,
            },
        };
        const model = buildResumeDocument(data, 'developer', '#22c55e');
        const { bytes } = await buildResumePdf(model);
        const pages = await extractPdfPages(bytes);
        const uris = (await extractPdfLinks(bytes)).flatMap(page => page.links.map(link => link.uri));
        expect(pages[0].text).toContain('developer');
        expect(uris.some(uri => uri.includes('very-long-segment'))).toBe(true);
        for (const item of pages[0].items) {
            expect(item.x + item.width).toBeLessThanOrEqual(A4_WIDTH_PT + 0.5);
        }
    });
});

describe('DOCX export', () => {
    it('produces a real OOXML package with formatting and hyperlink relationships', () => {
        const model = buildResumeDocument(sampleData, 'executive', '#0f172a');
        const { bytes, filename } = buildResumeDocx(model);
        expect(filename).toBe('Aarav_Krishnan_Resume.docx');

        const entries = unzipSync(bytes);
        expect(Object.keys(entries)).toEqual(expect.arrayContaining([
            '[Content_Types].xml',
            '_rels/.rels',
            'word/document.xml',
            'word/styles.xml',
            'word/numbering.xml',
            'word/settings.xml',
            'word/_rels/document.xml.rels',
        ]));

        const document = strFromU8(entries['word/document.xml']);
        const relationships = strFromU8(entries['word/_rels/document.xml.rels']);
        expect(document).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
        expect(document).toContain('<w:pgMar w:top="1020"');
        expect(document).toContain('Aarav Krishnan');
        expect(document).toContain('Leadership Experience');
        expect(document).toContain('Awards &amp; Recognition');
        expect(document).toContain('Engineering Excellence Award');
        expect(document).toContain('<w:numPr>');
        expect(document).toContain('<w:hyperlink r:id="rId3"');
        expect(document.indexOf('Leadership Experience')).toBeLessThan(document.indexOf('Awards &amp; Recognition'));

        expect(relationships).toContain('TargetMode="External"');
        expect(relationships).toContain('mailto:aarav.krishnan@example.com');
        expect(relationships).toContain('https://www.linkedin.com/in/aarav-krishnan');
        expect(relationships).toContain('https://github.com/aaravk');
    });
});

describe('JSON export', () => {
    it('preserves all resume and layout fields', () => {
        const payload = buildResumeJson(sampleData, {
            template: 'tech-modern',
            templateName: 'Tech Modern',
            atsScore: 91,
        });
        expect(payload.format).toBe('lakshyatrack.resume');
        expect(payload.version).toBe(2);
        expect(payload.personal_info).toEqual(sampleData.personal);
        expect(payload.section_order).toEqual(sampleData.section_order);
        expect(payload.hidden_sections).toEqual(['education']);
        expect(payload.custom_sections).toEqual(sampleData.custom_sections);
        expect(payload.experience).toEqual(sampleData.experience);
        expect(payload.skills).toEqual(sampleData.skills);
        expect(payload.meta.template).toBe('tech-modern');
        expect(payload.meta.template_name).toBe('Tech Modern');
        expect(payload.meta.ats_score).toBe(91);

        const parsed = JSON.parse(stringifyResumeJson(sampleData));
        expect(parsed.personal_info.linkedin_url).toBe(sampleData.personal.linkedin_url);
        expect(parsed.section_order).toEqual(sampleData.section_order);
        expect(parsed.custom_sections[0].title).toBe('Awards & Recognition');
    });
});
