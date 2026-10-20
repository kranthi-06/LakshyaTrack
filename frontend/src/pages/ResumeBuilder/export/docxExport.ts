import { zipSync, strToU8 } from 'fflate';
import { saveAs } from 'file-saver';
import type { BaseTemplate } from '../templates/templateCatalog';
import type {
    ResumeDocumentContact,
    ResumeDocumentModel,
    ResumeDocumentSection,
} from './resumeDocument';

/**
 * Real OOXML (.docx) export.
 *
 * A .docx is a ZIP of XML parts. Generating the package ourselves keeps the
 * output editable in Word/Google Docs, preserves section order and custom
 * sections, and gives hyperlinks real external relationships instead of the
 * HTML-in-a-.doc wrapper that Word cannot reliably re-edit.
 */

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/* A4 in twentieths of a point (twips). */
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 1020;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

interface DocxTheme {
    font: string;
    accent: string;
    headingAccent: string;
    bodySize: number;
    smallSize: number;
    nameSize: number;
    uppercaseHeadings: boolean;
    serif: boolean;
}

function cleanHex(value: string | undefined, fallback = '#111827'): string {
    const match = value?.trim().match(/^#?([0-9a-f]{6})$/i);
    return (match?.[1] ?? fallback.slice(1)).toUpperCase();
}

function themeFor(base: BaseTemplate, accent: string): DocxTheme {
    const color = cleanHex(accent, '#5C52D2');
    const serif = base === 'classic' || base === 'academic' || base === 'executive' || base === 'elegant';
    const monospace = base === 'developer';
    return {
        font: monospace ? 'Consolas' : serif ? 'Georgia' : 'Calibri',
        accent: color,
        headingAccent: base === 'elegant' ? color : base === 'developer' ? '22C55E' : color,
        bodySize: base === 'compact' ? 19 : 21,
        smallSize: base === 'compact' ? 16 : 18,
        nameSize: base === 'bold-header' ? 44 : base === 'compact' ? 32 : 38,
        uppercaseHeadings: base !== 'executive',
        serif,
    };
}

export function escapeXml(value: string): string {
    return (value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

interface RunOptions {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: number;
    font?: string;
    style?: string;
    caps?: boolean;
}

function run(text: string, options: RunOptions = {}): string {
    if (!text) return '';
    const props: string[] = [];
    if (options.style) props.push(`<w:rStyle w:val="${options.style}"/>`);
    if (options.font) props.push(`<w:rFonts w:ascii="${escapeXml(options.font)}" w:hAnsi="${escapeXml(options.font)}" w:cs="${escapeXml(options.font)}"/>`);
    if (options.bold) props.push('<w:b/><w:bCs/>');
    if (options.italic) props.push('<w:i/><w:iCs/>');
    if (options.caps) props.push('<w:caps/>');
    if (options.color) props.push(`<w:color w:val="${cleanHex(options.color)}"/>`);
    if (options.size) props.push(`<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>`);
    const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
    return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

interface ParagraphOptions {
    style?: string;
    align?: 'left' | 'center' | 'right' | 'both';
    before?: number;
    after?: number;
    keepNext?: boolean;
    keepLines?: boolean;
    numbering?: boolean;
    indent?: number;
    rightTab?: boolean;
    borderBottom?: { color: string; size: number };
}

function paragraph(content: string, options: ParagraphOptions = {}): string {
    const props: string[] = [];
    if (options.style) props.push(`<w:pStyle w:val="${options.style}"/>`);
    if (options.keepNext) props.push('<w:keepNext/>');
    if (options.keepLines) props.push('<w:keepLines/>');
    if (options.numbering) {
        props.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
    }
    if (options.rightTab) {
        props.push(`<w:tabs><w:tab w:val="right" w:pos="${CONTENT_WIDTH}"/></w:tabs>`);
    }
    if (options.indent) props.push(`<w:ind w:left="${options.indent}"/>`);
    const before = options.before ?? 0;
    const after = options.after ?? 60;
    props.push(`<w:spacing w:before="${before}" w:after="${after}"/>`);
    if (options.align) props.push(`<w:jc w:val="${options.align}"/>`);
    if (options.borderBottom) {
        props.push(
            `<w:pBdr><w:bottom w:val="single" w:sz="${options.borderBottom.size}" w:space="4" w:color="${options.borderBottom.color}"/></w:pBdr>`,
        );
    }
    const pPr = props.length > 0 ? `<w:pPr>${props.join('')}</w:pPr>` : '';
    return `<w:p>${pPr}${content}</w:p>`;
}

function emptyParagraph(): string {
    return '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
}

/* ─────────────────────────── styles & parts ─────────────────────────── */

function stylesXml(theme: DocxTheme): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${WORD_NS}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="${theme.font}" w:hAnsi="${theme.font}" w:cs="${theme.font}" w:eastAsia="${theme.font}"/>
      <w:sz w:val="${theme.bodySize}"/><w:szCs w:val="${theme.bodySize}"/>
      <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:before="0" w:after="60" w:line="252" w:lineRule="auto"/>
      <w:widowControl/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="40"/><w:jc w:val="left"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="${theme.accent}"/><w:sz w:val="${theme.nameSize}"/><w:szCs w:val="${theme.nameSize}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:rPr><w:color w:val="6B7280"/><w:sz w:val="${theme.smallSize + 2}"/><w:szCs w:val="${theme.smallSize + 2}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr>
      <w:keepNext/><w:keepLines/>
      <w:spacing w:before="260" w:after="90"/>
      <w:outlineLvl w:val="0"/>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${theme.headingAccent}"/></w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/><w:color w:val="${theme.headingAccent}"/>
      <w:sz w:val="${theme.bodySize + 1}"/><w:szCs w:val="${theme.bodySize + 1}"/>
      ${theme.uppercaseHeadings ? '<w:caps/>' : ''}
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EntryTitle">
    <w:name w:val="Entry Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="80" w:after="20"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="${theme.bodySize + 1}"/><w:szCs w:val="${theme.bodySize + 1}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EntryMeta">
    <w:name w:val="Entry Meta"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="6B7280"/><w:sz w:val="${theme.smallSize}"/><w:szCs w:val="${theme.smallSize}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="30"/><w:ind w:left="360" w:hanging="180"/></w:pPr>
  </w:style>
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>
  </w:style>
</w:styles>`;
}

function numberingXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${WORD_NS}">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
}

function settingsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${WORD_NS}">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;
}

/* ─────────────────────────── document body ─────────────────────────── */

function contactRun(contact: ResumeDocumentContact, relId: string | null): string {
    if (relId) {
        return `<w:hyperlink r:id="${relId}" w:history="1">${run(contact.label, { style: 'Hyperlink' })}</w:hyperlink>`;
    }
    return run(contact.label);
}

function contactsParagraph(
    contacts: ResumeDocumentContact[],
    relIds: Map<number, string>,
    theme: DocxTheme,
    align: 'left' | 'center',
): string {
    if (contacts.length === 0) return '';
    const pieces: string[] = [];
    contacts.forEach((contact, index) => {
        if (index > 0) pieces.push(run('  •  ', { color: '9CA3AF', size: theme.smallSize }));
        pieces.push(contactRun(contact, relIds.get(index) ?? null));
    });
    return paragraph(pieces.join(''), {
        align,
        after: 120,
        keepNext: true,
    });
}

function sectionHeading(section: ResumeDocumentSection, theme: DocxTheme): string {
    if (!section.heading) return '';
    return paragraph(run(section.heading, { bold: true }), {
        style: 'Heading1',
        before: 280,
        after: 100,
        keepNext: true,
    });
}

function entryXml(
    title: string,
    subtitle: string | undefined,
    date: string | undefined,
    description: string | undefined,
    bullets: string[] | undefined,
    theme: DocxTheme,
): string {
    const pieces: string[] = [];
    const dateRun = date ? run(date, { color: '6B7280', size: theme.smallSize }) : '';
    const titleContent = date
        ? `${run(title, { bold: true })}<w:r><w:tab/></w:r>${dateRun}`
        : run(title, { bold: true });
    pieces.push(paragraph(titleContent, { style: 'EntryTitle', rightTab: Boolean(date), keepNext: true }));
    if (subtitle) {
        pieces.push(paragraph(run(subtitle, { italic: true }), { style: 'EntryMeta', keepNext: Boolean(description || bullets?.length) }));
    }
    if (description) {
        pieces.push(paragraph(run(description), { after: 50 }));
    }
    for (const bullet of bullets ?? []) {
        pieces.push(paragraph(run(bullet), { style: 'ListParagraph', numbering: true, after: 30 }));
    }
    return pieces.join('');
}

function customXml(section: ResumeDocumentSection, theme: DocxTheme): string {
    const pieces: string[] = [];
    for (const line of section.paragraphs ?? []) {
        if (!line.trim()) {
            pieces.push(emptyParagraph());
            continue;
        }
        if (/^[-•*]\s+/.test(line)) {
            pieces.push(paragraph(run(line.replace(/^[-•*]\s+/, '')), { style: 'ListParagraph', numbering: true, after: 30 }));
        } else {
            pieces.push(paragraph(run(line), { after: 60 }));
        }
    }
    return pieces.join('');
}

function skillsXml(section: ResumeDocumentSection, theme: DocxTheme): string {
    const pieces: string[] = [];
    for (const group of section.skillGroups ?? []) {
        pieces.push(paragraph(run(group.label, { bold: true, color: theme.headingAccent, size: theme.smallSize }), {
            before: 40,
            after: 20,
            keepNext: true,
        }));
        pieces.push(paragraph(run(group.values.join('  ·  ')), { after: 80 }));
    }
    return pieces.join('');
}

function sectionXml(
    section: ResumeDocumentSection,
    theme: DocxTheme,
): string {
    const heading = sectionHeading(section, theme);
    switch (section.kind) {
        case 'summary':
            return `${heading}${paragraph(run(section.paragraphs?.join(' ') ?? ''), { after: 100 })}`;
        case 'skills':
            return `${heading}${skillsXml(section, theme)}`;
        case 'custom':
            return `${heading}${customXml(section, theme)}`;
        default:
            return `${heading}${(section.entries ?? [])
                .map(entry => entryXml(entry.title, entry.subtitle, entry.date, entry.description, entry.bullets, theme))
                .join('')}`;
    }
}

export interface BuiltResumeDocx {
    bytes: Uint8Array;
    filename: string;
}

export function buildResumeDocx(model: ResumeDocumentModel): BuiltResumeDocx {
    const theme = themeFor(model.base, model.accentColor);

    // Relationship ids for external contact links. rId1/rId2 are the styles
    // and numbering parts, so hyperlinks start at rId3.
    const relIds = new Map<number, string>();
    const relEntries: string[] = [
        `<Relationship Id="rId1" Type="${REL_NS}/styles" Target="styles.xml"/>`,
        `<Relationship Id="rId2" Type="${REL_NS}/numbering" Target="numbering.xml"/>`,
    ];
    let nextRel = 3;
    model.contacts.forEach((contact, index) => {
        if (!contact.href) return;
        const id = `rId${nextRel++}`;
        relIds.set(index, id);
        relEntries.push(
            `<Relationship Id="${id}" Type="${REL_NS}/hyperlink" Target="${escapeXml(contact.href)}" TargetMode="External"/>`,
        );
    });

    const header: string[] = [
        paragraph(run(model.name, { bold: true }), {
            style: 'Title',
            align: theme.serif ? 'center' : 'left',
            after: 20,
            keepNext: true,
        }),
    ];
    if (model.headline) {
        header.push(paragraph(run(model.headline), {
            style: 'Subtitle',
            align: theme.serif ? 'center' : 'left',
            after: 100,
            keepNext: model.contacts.length > 0,
        }));
    }
    header.push(contactsParagraph(model.contacts, relIds, theme, theme.serif ? 'center' : 'left'));

    const body = model.sections.map(section => sectionXml(section, theme)).join('');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}">
  <w:body>
    ${header.join('')}
    ${body}
    <w:sectPr>
      <w:pgSz w:w="${PAGE_WIDTH}" w:h="${PAGE_HEIGHT}"/>
      <w:pgMar w:top="${PAGE_MARGIN}" w:right="${PAGE_MARGIN}" w:bottom="${PAGE_MARGIN}" w:left="${PAGE_MARGIN}" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  ${relEntries.join('\n  ')}
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  <Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="${REL_NS}/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

    const timestamp = new Date().toISOString();
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(model.name)} — Resume</dc:title>
  <dc:creator>LakshyaTrack Resume Studio</dc:creator>
  <cp:lastModifiedBy>LakshyaTrack Resume Studio</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;

    const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>LakshyaTrack Resume Studio</Application>
  <AppVersion>1.0</AppVersion>
</Properties>`;

    const files: Record<string, Uint8Array> = {
        '[Content_Types].xml': strToU8(contentTypes),
        '_rels/.rels': strToU8(rootRels),
        'docProps/core.xml': strToU8(coreXml),
        'docProps/app.xml': strToU8(appXml),
        'word/document.xml': strToU8(documentXml),
        'word/styles.xml': strToU8(stylesXml(theme)),
        'word/numbering.xml': strToU8(numberingXml()),
        'word/settings.xml': strToU8(settingsXml()),
        'word/_rels/document.xml.rels': strToU8(documentRels),
    };

    const bytes = zipSync(files, { level: 6 });
    return {
        bytes,
        filename: `${slugifyName(model.name)}_Resume.docx`,
    };
}

function slugifyName(name: string): string {
    const safe = (name || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return safe || 'resume';
}

export async function exportToDOCX(model: ResumeDocumentModel, filename?: string): Promise<void> {
    const { bytes, filename: suggested } = buildResumeDocx(model);
    const blob = new Blob([bytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(blob, filename || suggested);
}
