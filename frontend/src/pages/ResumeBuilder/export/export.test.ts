import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from 'pdf-lib';
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

function countPdfImages(doc: PDFDocument): number {
    let count = 0;
    for (const page of doc.getPages()) {
        const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
        if (!xobjects) continue;
        for (const [, value] of xobjects.entries()) {
            const stream = doc.context.lookup(value);
            if (stream instanceof PDFRawStream
                && stream.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
                count += 1;
            }
        }
    }
    return count;
}

function pdfContentStreams(doc: PDFDocument): string {
    return doc.getPages().map(page => {
        const contents = page.node.Contents();
        const references = contents instanceof PDFArray
            ? contents.asArray()
            : contents
                ? [contents]
                : [];
        return references.map(reference => {
            const stream = doc.context.lookup(reference);
            return stream instanceof PDFRawStream
                ? Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')
                : '';
        }).join('\n');
    }).join('\n');
}

function docxRunIsShaded(xml: string, text: string): boolean {
    // Chip labels keep words together with non-breaking spaces, so normalise
    // them before locating the run. Replacing one character with one character
    // keeps every index stable.
    const normalized = xml.replace(/\u00A0/g, ' ');
    const index = normalized.indexOf(text);
    if (index < 0) return false;
    const start = normalized.lastIndexOf('<w:r>', index);
    return start >= 0 && normalized.slice(start, index).includes('<w:shd');
}

/** Return one balanced WordprocessingML element, including nested instances. */
function balancedXml(xml: string, tag: string): string {
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    const start = xml.indexOf(open);
    if (start < 0) return '';
    let depth = 0;
    let cursor = start;
    while (cursor < xml.length) {
        const nextOpen = xml.indexOf(open, cursor);
        const nextClose = xml.indexOf(close, cursor);
        if (nextClose < 0) return '';
        if (nextOpen >= 0 && nextOpen < nextClose) {
            depth += 1;
            cursor = nextOpen + open.length;
        } else {
            depth -= 1;
            cursor = nextClose + close.length;
            if (depth === 0) return xml.slice(start, cursor);
        }
    }
    return '';
}

/** Count tables that are direct children of the body, excluding nested tables. */
function topLevelTableCount(xml: string): number {
    let depth = 0;
    let count = 0;
    for (const match of xml.matchAll(/<w:tbl>|<\/w:tbl>/g)) {
        if (match[0] === '<w:tbl>') {
            if (depth === 0) count += 1;
            depth += 1;
        } else {
            depth -= 1;
        }
    }
    return count;
}

function docxParagraphs(xml: string): string[] {
    return xml
        .split('<w:p>')
        .slice(1)
        .map(part => part.slice(0, part.indexOf('</w:p>')));
}

/** The first row/first cell of the outermost table. */
function firstTableFirstCell(xml: string): string {
    const table = balancedXml(xml, 'w:tbl');
    const row = balancedXml(table, 'w:tr');
    return balancedXml(row, 'w:tc');
}

function docxRunSize(xml: string, text: string): string | null {
    const index = xml.indexOf(text);
    if (index < 0) return null;
    const start = xml.lastIndexOf('<w:r>', index);
    return xml.slice(start, index).match(/<w:sz w:val="(\d+)"\/>/)?.[1] ?? null;
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

    it('draws embedded contact icons and keeps each icon inside its link target', async () => {
        const model = buildResumeDocument(sampleData, 'modern', '#5c52d2');
        const { bytes } = await buildResumePdf(model);
        const doc = await PDFDocument.load(bytes);

        // Ten contact kinds are present. Each must contribute one drawn image
        // XObject rather than only selectable text.
        expect(countPdfImages(doc)).toBeGreaterThanOrEqual(10);
        const content = pdfContentStreams(doc);
        expect(content).not.toContain('NaN');
        // One image draw per contact kind, all inside the same page.
        expect(content.match(/\bDo\b/g) ?? []).toHaveLength(10);

        const links = (await extractPdfLinks(bytes)).flatMap(page => page.links);
        const email = links.find(link => link.uri === 'mailto:aarav.krishnan@example.com');
        expect(email).toBeDefined();
        const [left, bottom, right, top] = email!.rect;
        // The glyph plus its gap widens the clickable area beyond the text.
        expect(right - left).toBeGreaterThan(90);
        expect(top - bottom).toBeGreaterThan(9);
    });

    it('matches template-specific sidebar skill treatments', async () => {
        const textFor = async (base: BaseTemplate, accent: string) => {
            const model = buildResumeDocument(sampleData, base, accent);
            const pages = await extractPdfPages((await buildResumePdf(model)).bytes);
            // PDF.js inserts spaces between letter-spaced glyphs, so compare
            // the heading text without whitespace.
            return pages
                .flatMap(page => page.items.map(item => item.text))
                .join('')
                .replace(/\s+/g, '');
        };

        const creative = await textFor('creative', '#E11D48');
        expect(creative).toContain('SKILLS');
        expect(creative).not.toContain('TECHNICALSKILLS');
        expect(creative).toContain('TOOLS');
        expect(creative).toContain('SOFTSKILLS');

        const modern = await textFor('modern', '#5C52D2');
        expect(modern).toContain('TOOLS&FRAMEWORKS');

        const infographic = await textFor('infographic', '#2563EB');
        expect(infographic).toContain('SKILLS');
        expect(infographic).not.toContain('TECHNICALSKILLS');
        expect(infographic).not.toContain('TOOLS');
        expect(infographic).toContain('SOFTSKILLS');
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
    }, 20_000);

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
        const contentTypes = strFromU8(entries['[Content_Types].xml']);
        expect(document).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
        // The Executive header is a full-bleed band (paper-edge to paper-edge),
        // mirroring the editor preview and the PDF export.
        expect(document).toContain('<w:pgMar w:top="0" w:right="480" w:bottom="720" w:left="480"');
        expect(document).toContain('<w:shd w:val="clear" w:color="auto" w:fill="0F172A"/><w:tcMar><w:top w:w="780"');
        expect(document).toContain('Aarav Krishnan');
        expect(document).toContain('Leadership Experience');
        expect(document).toContain('Awards &amp; Recognition');
        expect(document).toContain('Engineering Excellence Award');
        expect(document).toContain('<w:numPr>');
        expect(document).toContain('<w:hyperlink r:id="rId3"');
        expect(document.indexOf('Leadership Experience')).toBeLessThan(document.indexOf('Awards &amp; Recognition'));

        // Every contact carries an embedded raster glyph. Ten contacts means
        // ten inline drawings and ten light PNG parts — the band background is
        // the dark `0F172A` accent, so dark glyphs would be invisible on it.
        expect(document.match(/<wp:inline/g) ?? []).toHaveLength(10);
        expect(Object.keys(entries).filter(name => /^word\/media\/contact-.+-light\.png$/.test(name))).toHaveLength(10);
        expect(contentTypes).toContain('Extension="png"');
        expect(relationships).toContain('/image" Target="media/contact-email-light.png"');

        expect(relationships).toContain('TargetMode="External"');
        expect(relationships).toContain('mailto:aarav.krishnan@example.com');
        expect(relationships).toContain('https://www.linkedin.com/in/aarav-krishnan');
        expect(relationships).toContain('https://github.com/aaravk');

        // The icon drawing must live inside the same hyperlink as the label,
        // otherwise clicking the glyph would not open the contact link.
        const emailTextIndex = document.indexOf('aarav.krishnan@example.com');
        const emailLinkStart = document.lastIndexOf('<w:hyperlink', emailTextIndex);
        const emailLinkEnd = document.indexOf('</w:hyperlink>', emailTextIndex);
        expect(emailLinkStart).toBeGreaterThanOrEqual(0);
        expect(emailLinkEnd).toBeGreaterThan(emailTextIndex);
        expect(document.slice(emailLinkStart, emailLinkEnd)).toContain('<w:drawing>');
    });

    it('renders modern sidebar zones in a shaded two-column table with image icons', () => {
        const model = buildResumeDocument(sampleData, 'modern', '#5C52D2');
        const entries = unzipSync(buildResumeDocx(model).bytes);
        const document = strFromU8(entries['word/document.xml']);
        const relationships = strFromU8(entries['word/_rels/document.xml.rels']);

        expect(document).toContain('<w:tbl>');
        expect(document).toContain('<w:tblInd w:w="0"');
        expect(document).toContain('<w:tblLayout w:type="fixed"/>');
        expect(document).toContain('<w:gridCol w:w="3810"/>');
        expect(document).toContain('<w:gridCol w:w="8096"/>');
        expect(document).toMatch(/<w:shd w:val="clear" w:color="auto" w:fill="[0-9A-F]{6}"\/>/);
        expect(document.match(/Technical Skills/g) ?? []).toHaveLength(1);
        expect(document).toContain('Tools &amp; Frameworks');
        expect(document, 'sidebar row should flow with its content').not.toContain('<w:trHeight w:val="12800"');
        expect(document.indexOf('Technical Skills')).toBeLessThan(document.indexOf('Professional Summary'));
        expect(document.indexOf('Languages')).toBeLessThan(document.indexOf('Professional Summary'));
        expect(document.match(/<wp:inline/g) ?? []).toHaveLength(10);
        expect(relationships).toContain('Target="media/contact-email-dark.png"');
        expect(relationships).toContain('Target="media/contact-leetcode-dark.png"');
        expect(entries['word/media/contact-leetcode-dark.png']).toBeDefined();

        // The header and sidebar must be one table so Word never strands the
        // header on page one and pushes the sidebar to page two.
        expect(topLevelTableCount(document)).toBe(1);
        expect(document.indexOf('<w:tbl>')).toBeLessThan(document.indexOf('Aarav Krishnan'));
        expect(document.match(/<w:gridSpan w:val="2"\/>/g) ?? []).toHaveLength(1);

        // Header contacts use compact names, not long URLs, and keep the
        // small sidebar/contact size. The URL itself stays in relationships.
        for (const label of ['LinkedIn', 'GitHub', 'Portfolio', 'Website', 'LeetCode', 'HackerRank', 'Kaggle']) {
            expect(document).toContain(`>${label}<`);
        }
        expect(document).not.toContain('linkedin.com/in/aarav-krishnan');
        expect(docxRunSize(document, 'LinkedIn')).toBe('16');
        const modernStyles = strFromU8(entries['word/styles.xml']);
        expect(modernStyles).toContain('<w:sz w:val="18"/>');
        expect(modernStyles).toContain('<w:sz w:val="16"/>');
    });

    it('uses the accent sidebar fill and light contact icons for colored sidebars', () => {
        const model = buildResumeDocument(sampleData, 'two-column', '#0F766E');
        const entries = unzipSync(buildResumeDocx(model).bytes);
        const document = strFromU8(entries['word/document.xml']);
        const relationships = strFromU8(entries['word/_rels/document.xml.rels']);

        expect(document).toContain('<w:shd w:val="clear" w:color="auto" w:fill="0F766E"/>');
        expect(document).toContain('<w:color w:val="FFFFFF"/>');
        expect(document).toContain('<w:gridCol w:w="4524"/>');
        expect(document).toContain('<w:pgMar w:top="0" w:right="480" w:bottom="0" w:left="480"');
        expect(document.match(/Technical Skills/g) ?? []).toHaveLength(1);
        expect(document).toContain('<w:trHeight w:val="15900" w:hRule="atLeast"/>');
        expect(document.indexOf('Technical Skills')).toBeLessThan(document.indexOf('Profile'));
        expect(document.match(/<wp:inline/g) ?? []).toHaveLength(10);
        expect(relationships).toContain('Target="media/contact-email-light.png"');
        expect(entries['word/media/contact-kaggle-light.png']).toBeDefined();

        // Sidebar contacts are one paragraph each, not one inline run-on
        // paragraph. This keeps every icon attached to its own label.
        const sidebarCell = firstTableFirstCell(document);
        const contactParagraphs = docxParagraphs(sidebarCell)
            .filter(paragraph => paragraph.includes('<w:drawing>'));
        expect(contactParagraphs).toHaveLength(10);
        // Location is the one non-clickable contact; the other nine all keep
        // their icon and label inside the same hyperlink.
        expect(contactParagraphs.filter(paragraph => paragraph.includes('<w:hyperlink'))).toHaveLength(9);
        for (const paragraph of contactParagraphs) {
            expect(paragraph).not.toContain('•');
        }
        expect(topLevelTableCount(document)).toBe(1);
        expect(document).not.toContain('<w:gridSpan');
        for (const label of ['LinkedIn', 'GitHub', 'Portfolio', 'Website', 'LeetCode', 'HackerRank', 'Kaggle']) {
            expect(document).toContain(`>${label}<`);
        }
        expect(docxRunSize(document, 'LinkedIn')).toBe('16');
        const twoColumnStyles = strFromU8(entries['word/styles.xml']);
        expect(twoColumnStyles).toContain('<w:sz w:val="18"/>');
        expect(twoColumnStyles).toContain('<w:sz w:val="16"/>');
    });

    it('applies Creative and Infographic skill treatments in Word', () => {
        const creative = buildResumeDocument(sampleData, 'creative', '#E11D48');
        const creativeDoc = strFromU8(unzipSync(buildResumeDocx(creative).bytes)['word/document.xml']);
        expect(creativeDoc).not.toContain('Technical Skills');
        expect(creativeDoc).toContain('>Skills<');
        expect(creativeDoc).toContain('>Tools<');
        expect(creativeDoc).toContain('>Soft Skills<');
        // The sidebar background ends with the content in the browser, so the
        // creative table must not force a full-page row height.
        expect(creativeDoc).not.toContain('<w:trHeight w:val="12400"');
        // The red banner is full bleed: no top page margin, with the old
        // 18pt inset folded into the banner cell padding.
        expect(creativeDoc).toContain('<w:pgMar w:top="0" w:right="480" w:bottom="720" w:left="480"');
        expect(creativeDoc).toContain('<w:shd w:val="clear" w:color="auto" w:fill="E11D48"/><w:tcMar><w:top w:w="780"');
        expect(topLevelTableCount(creativeDoc)).toBe(1);
        expect(creativeDoc.match(/<w:gridSpan w:val="2"\/>/g) ?? []).toHaveLength(2);
        expect(creativeDoc).toContain('>LinkedIn<');
        expect(creativeDoc).not.toContain('linkedin.com/in/aarav-krishnan');
        // Creative technical skills are bullets, tools are chips, and soft
        // skills are plain lines rather than another chip cloud.
        expect(docxRunIsShaded(creativeDoc, 'TypeScript')).toBe(false);
        expect(docxRunIsShaded(creativeDoc, 'Terraform')).toBe(true);
        expect(docxRunIsShaded(creativeDoc, 'Technical Leadership')).toBe(false);
        expect(creativeDoc.match(/<w:trHeight w:val="50" w:hRule="exact"\/>/g) ?? []).toHaveLength(0);

        const infographic = buildResumeDocument(sampleData, 'infographic', '#2563EB');
        const infographicDoc = strFromU8(unzipSync(buildResumeDocx(infographic).bytes)['word/document.xml']);
        expect(infographicDoc).not.toContain('Technical Skills');
        expect(infographicDoc).toContain('>Skills<');
        expect(infographicDoc).toContain('>Soft Skills<');
        expect(infographicDoc).not.toContain('>Tools<');
        expect(infographicDoc).toContain('<w:trHeight w:val="15900" w:hRule="atLeast"/>');
        // Infographic merges technical skills and tools into ten bars.
        expect(infographicDoc.match(/<w:trHeight w:val="50" w:hRule="exact"\/>/g) ?? []).toHaveLength(10);
        expect(infographicDoc).not.toContain('\u00A0AWS\u00A0');
        expect(infographicDoc).not.toContain('\u00A0GCP\u00A0');
        expect(docxRunIsShaded(infographicDoc, 'Terraform')).toBe(false);
        expect(docxRunIsShaded(infographicDoc, 'Technical Leadership')).toBe(true);

        // The infographic header also stacks its ten contacts in the colored
        // sidebar, one icon-and-label hyperlink per paragraph.
        const infographicSidebar = firstTableFirstCell(infographicDoc);
        const infographicContactParagraphs = docxParagraphs(infographicSidebar)
            .filter(paragraph => paragraph.includes('<w:drawing>'));
        expect(infographicContactParagraphs).toHaveLength(10);
        expect(topLevelTableCount(infographicDoc)).toBe(1);
        expect(infographicDoc).not.toContain('<w:gridSpan');
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
