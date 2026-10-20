import { zipSync, strToU8 } from 'fflate';
import { saveAs } from 'file-saver';
import type { BaseTemplate } from '../templates/templateCatalog';
import type { ContactKind } from '../templates/contactLinkUtils';
import type {
    ResumeDocumentContact,
    ResumeDocumentModel,
    ResumeDocumentSection,
    ResumeDocumentSkillGroup,
} from './resumeDocument';
import { CONTACT_ICON_PNGS } from './contactIconPngs';

/**
 * Real OOXML (.docx) export.
 *
 * A .docx is a ZIP of XML parts. Generating the package ourselves keeps the
 * output editable in Word/Google Docs, preserves section order and custom
 * sections, and gives hyperlinks real external relationships instead of the
 * HTML-in-a-.doc wrapper that Word cannot reliably re-edit.
 *
 * Sidebar templates use a full-page-width, two-cell table. Word tables are the
 * only portable OOXML construct that can paint a coloured column behind flowing
 * multi-page content while remaining editable. Cell margins reproduce the
 * template's padding, and each section is routed through the shared `zone`
 * field from resumeDocument.ts.
 */

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const ART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PICTURE_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

/* A4 in twentieths of a point (twips). */
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 1020;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
/* 9.3pt icon, comfortably aligned with 9pt contact text. */
const ICON_EMU = 118000;

type IconVariant = 'dark' | 'light';
type HeaderKind = 'plain' | 'band' | 'sidebar';
type SidebarVariant = 'modern' | 'creative' | 'two-column' | 'infographic';

interface DocxMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface DocxSidebarTheme {
    widthPct: number;
    background: string;
    text: string;
    muted: string;
    heading: string;
    chipBackground: string;
    chipText: string;
    chipBorder?: string;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    mainPaddingLeft: number;
    mainPaddingRight: number;
    mainPaddingTop: number;
    headerInSidebar: boolean;
    onColor: boolean;
}

interface DocxTheme {
    font: string;
    accent: string;
    headingAccent: string;
    bodySize: number;
    smallSize: number;
    nameSize: number;
    uppercaseHeadings: boolean;
    serif: boolean;
    header: HeaderKind;
    headerAlign: 'left' | 'center';
    nameColor: string;
    headlineColor: string;
    contactColor: string;
    contactMuted: string;
    margins: DocxMargins;
    headerRule: boolean;
    sidebar?: DocxSidebarTheme;
    sidebarVariant?: SidebarVariant;
    band?: {
        background: string;
        text: string;
        muted: string;
        stripBackground: string;
    };
}

function cleanHex(value: string | undefined, fallback = '#111827'): string {
    const match = value?.trim().match(/^#?([0-9a-f]{6})$/i);
    return (match?.[1] ?? fallback.slice(1)).toUpperCase();
}

/** Blend `foreground` over `background`; weight is the foreground share. */
function mixHex(foreground: string, background: string, weight: number): string {
    const fg = cleanHex(foreground);
    const bg = cleanHex(background);
    const channel = (offset: number) => {
        const f = parseInt(fg.slice(offset, offset + 2), 16);
        const b = parseInt(bg.slice(offset, offset + 2), 16);
        return Math.round(f * weight + b * (1 - weight))
            .toString(16)
            .padStart(2, '0');
    };
    return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

function themeFor(base: BaseTemplate, accent: string): DocxTheme {
    const color = cleanHex(accent, '#5C52D2');
    const serif = base === 'classic' || base === 'academic' || base === 'executive' || base === 'elegant';
    const monospace = base === 'developer';
    const baseTheme: DocxTheme = {
        font: monospace ? 'Consolas' : serif ? 'Georgia' : 'Calibri',
        accent: color,
        headingAccent: base === 'elegant' ? color : base === 'developer' ? '22C55E' : color,
        bodySize: base === 'compact' ? 19 : 21,
        smallSize: base === 'compact' ? 16 : 18,
        nameSize: base === 'bold-header' ? 44 : base === 'compact' ? 32 : 38,
        uppercaseHeadings: base !== 'executive',
        serif,
        header: 'plain',
        headerAlign: serif ? 'center' : 'left',
        nameColor: color,
        headlineColor: '6B7280',
        contactColor: '4B5563',
        contactMuted: '9CA3AF',
        margins: {
            top: PAGE_MARGIN,
            right: PAGE_MARGIN,
            bottom: PAGE_MARGIN,
            left: PAGE_MARGIN,
        },
        headerRule: false,
    };

    /*
     * The sidebar page margins are deliberately small: the table's negative
     * indent cancels the left margin so the colour reaches the paper edge.
     * Cell margins then recreate the template's internal padding.
     */
    if (base === 'modern') {
        return {
            ...baseTheme,
            bodySize: 18,
            smallSize: 16,
            nameSize: 44,
            nameColor: '111827',
            headlineColor: color,
            headerRule: true,
            margins: { top: 360, right: 480, bottom: 720, left: 480 },
            sidebarVariant: 'modern',
            sidebar: {
                widthPct: 0.32,
                background: mixHex(color, '#FFFFFF', 0.035),
                text: '374151',
                muted: '6B7280',
                heading: color,
                chipBackground: 'FFFFFF',
                chipText: '374151',
                chipBorder: mixHex(color, '#FFFFFF', 0.3),
                paddingLeft: 480,
                paddingRight: 480,
                paddingTop: 480,
                mainPaddingLeft: 480,
                mainPaddingRight: 480,
                mainPaddingTop: 480,
                headerInSidebar: false,
                onColor: false,
            },
        };
    }

    if (base === 'creative') {
        return {
            ...baseTheme,
            bodySize: 18,
            smallSize: 16,
            nameSize: 44,
            header: 'band',
            nameColor: 'FFFFFF',
            headlineColor: 'FFFFFF',
            // The red band is the page background on this template, so it
            // starts at the paper edge. The band cell adds the old 18pt top
            // inset back as padding to keep the name in the same position.
            margins: { top: 0, right: 480, bottom: 720, left: 480 },
            band: {
                background: color,
                text: 'FFFFFF',
                muted: 'F8FAFC',
                stripBackground: 'F9FAFB',
            },
            sidebarVariant: 'creative',
            sidebar: {
                widthPct: 0.35,
                background: 'FBFBFC',
                text: '374151',
                muted: '6B7280',
                heading: color,
                chipBackground: color,
                chipText: 'FFFFFF',
                paddingLeft: 480,
                paddingRight: 480,
                paddingTop: 480,
                mainPaddingLeft: 480,
                mainPaddingRight: 480,
                mainPaddingTop: 480,
                headerInSidebar: false,
                onColor: false,
            },
        };
    }

    if (base === 'two-column') {
        return {
            ...baseTheme,
            bodySize: 18,
            smallSize: 16,
            nameSize: 32,
            header: 'sidebar',
            nameColor: 'FFFFFF',
            headlineColor: 'F1F5F9',
            contactColor: 'FFFFFF',
            contactMuted: 'E5E7EB',
            // The coloured sidebar is the page background on this template,
            // so the table must start and end at the paper edges.
            margins: { top: 0, right: 480, bottom: 0, left: 480 },
            sidebarVariant: 'two-column',
            sidebar: {
                widthPct: 0.38,
                background: color,
                text: 'FFFFFF',
                muted: 'E5E7EB',
                heading: 'FFFFFF',
                chipBackground: mixHex('#FFFFFF', color, 0.22),
                chipText: 'FFFFFF',
                paddingLeft: 480,
                paddingRight: 480,
                paddingTop: 480,
                mainPaddingLeft: 480,
                mainPaddingRight: 480,
                mainPaddingTop: 480,
                headerInSidebar: true,
                onColor: true,
            },
        };
    }

    if (base === 'infographic') {
        return {
            ...baseTheme,
            bodySize: 18,
            smallSize: 16,
            nameSize: 36,
            header: 'sidebar',
            nameColor: 'FFFFFF',
            headlineColor: 'F1F5F9',
            contactColor: 'FFFFFF',
            contactMuted: 'E5E7EB',
            margins: { top: 0, right: 480, bottom: 0, left: 480 },
            sidebarVariant: 'infographic',
            sidebar: {
                widthPct: 0.35,
                background: color,
                text: 'FFFFFF',
                muted: 'E5E7EB',
                heading: 'FFFFFF',
                chipBackground: mixHex('#FFFFFF', color, 0.22),
                chipText: 'FFFFFF',
                paddingLeft: 480,
                paddingRight: 480,
                paddingTop: 480,
                mainPaddingLeft: 420,
                mainPaddingRight: 420,
                mainPaddingTop: 420,
                headerInSidebar: true,
                onColor: true,
            },
        };
    }

    return baseTheme;
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
    shading?: string;
    border?: { color: string; size: number };
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
    if (options.shading) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${cleanHex(options.shading)}"/>`);
    if (options.border) {
        props.push(
            `<w:bdr w:val="single" w:sz="${options.border.size}" w:space="1" w:color="${cleanHex(options.border.color)}"/>`,
        );
    }
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
    /** `true` uses the body width; a number sets an exact tab position. */
    rightTab?: boolean | number;
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
        const position = typeof options.rightTab === 'number' ? options.rightTab : CONTENT_WIDTH;
        props.push(`<w:tabs><w:tab w:val="right" w:pos="${position}"/></w:tabs>`);
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

/** A one-point paragraph used after nested tables and at the document tail. */
function tinyParagraph(): string {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:r></w:p>';
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

/* ─────────────────────────── contacts & icons ─────────────────────────── */

interface ContactRenderOptions {
    align: 'left' | 'center';
    textColor: string;
    mutedColor: string;
    iconVariant: IconVariant;
    imageRel: (kind: ContactKind, variant: IconVariant) => string;
    nextDrawingId: () => number;
    after?: number;
}

function contactIconRun(
    kind: ContactKind,
    relId: string,
    variant: IconVariant,
    drawingId: number,
): string {
    const name = `${kind}-${variant}.png`;
    return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${ICON_EMU}" cy="${ICON_EMU}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${drawingId}" name="${escapeXml(kind)} contact icon" descr="${escapeXml(kind)} icon"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${PICTURE_NS}"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ICON_EMU}" cy="${ICON_EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function contactRun(
    contact: ResumeDocumentContact,
    relId: string | null,
    options: ContactRenderOptions,
    theme: DocxTheme,
): string {
    const imageRel = options.imageRel(contact.kind, options.iconVariant);
    const icon = contactIconRun(contact.kind, imageRel, options.iconVariant, options.nextDrawingId());
    const space = run('\u00A0', { color: options.textColor, size: theme.smallSize });
    // Every live template uses `compactNames`, so profiles read "LinkedIn"
    // rather than the full URL in the header. Keep the same compact labels in
    // Word so the header wraps like the preview and stays one or two lines.
    const label = run(contact.shortLabel, { color: options.textColor, size: theme.smallSize });
    const content = `${icon}${space}${label}`;
    return relId
        ? `<w:hyperlink r:id="${relId}" w:history="1">${content}</w:hyperlink>`
        : content;
}

function contactsParagraph(
    contacts: ResumeDocumentContact[],
    relIds: Map<number, string>,
    theme: DocxTheme,
    options: ContactRenderOptions,
): string {
    if (contacts.length === 0) return '';
    const pieces: string[] = [];
    contacts.forEach((contact, index) => {
        if (index > 0) {
            pieces.push(run('  •  ', { color: options.mutedColor, size: theme.smallSize }));
        }
        pieces.push(contactRun(contact, relIds.get(index) ?? null, options, theme));
    });
    return paragraph(pieces.join(''), {
        align: options.align,
        after: options.after ?? 120,
        keepNext: true,
    });
}

/**
 * Sidebar templates stack contact rows vertically. Rendering them inline in a
 * 32-38% column produces ragged wraps and lets icons drift away from their
 * labels; one paragraph per contact matches the live preview and the PDF.
 */
function contactsStacked(
    contacts: ResumeDocumentContact[],
    relIds: Map<number, string>,
    theme: DocxTheme,
    options: ContactRenderOptions,
): string {
    if (contacts.length === 0) return '';
    return contacts.map((contact, index) => paragraph(
        contactRun(contact, relIds.get(index) ?? null, options, theme),
        {
            align: options.align,
            after: options.after ?? 40,
            keepNext: true,
        },
    )).join('');
}

/* ─────────────────────────── tables ─────────────────────────── */

interface CellOptions {
    width: number;
    shading?: string;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    /** Span both sidebar and main columns for full-width header rows. */
    gridSpan?: number;
}

function cell(content: string, options: CellOptions): string {
    const shading = options.shading
        ? `<w:shd w:val="clear" w:color="auto" w:fill="${cleanHex(options.shading)}"/>`
        : '';
    const margins = `<w:tcMar><w:top w:w="${options.marginTop ?? 0}" w:type="dxa"/><w:left w:w="${options.marginLeft ?? 0}" w:type="dxa"/><w:bottom w:w="${options.marginBottom ?? 0}" w:type="dxa"/><w:right w:w="${options.marginRight ?? 0}" w:type="dxa"/></w:tcMar>`;
    const span = options.gridSpan && options.gridSpan > 1
        ? `<w:gridSpan w:val="${options.gridSpan}"/>`
        : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${options.width}" w:type="dxa"/>${span}${shading}${margins}<w:vAlign w:val="top"/></w:tcPr>${content || emptyParagraph()}</w:tc>`;
}

function tableRow(content: string, options: { height?: number } = {}): string {
    const height = options.height
        ? `<w:trPr><w:trHeight w:val="${options.height}" w:hRule="atLeast"/></w:trPr>`
        : '';
    return `<w:tr>${height}${content}</w:tr>`;
}

function table(
    width: number,
    indent: number,
    columns: number[],
    rows: string,
): string {
    return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblInd w:w="${indent}" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${columns.map(column => `<w:gridCol w:w="${column}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
}

/* ─────────────────────────── document body ─────────────────────────── */

interface SectionStyle {
    width: number;
    sidebar: boolean;
    textColor: string;
    mutedColor: string;
    headingColor: string;
    onColor: boolean;
    variant?: SidebarVariant;
}

function mainStyle(theme: DocxTheme, width = CONTENT_WIDTH): SectionStyle {
    return {
        width,
        sidebar: false,
        textColor: '111827',
        mutedColor: '6B7280',
        headingColor: theme.headingAccent,
        onColor: false,
    };
}

function sidebarStyle(theme: DocxTheme, width: number): SectionStyle {
    const sidebar = theme.sidebar!;
    return {
        width,
        sidebar: true,
        textColor: sidebar.text,
        mutedColor: sidebar.muted,
        headingColor: sidebar.heading,
        onColor: sidebar.onColor,
        variant: theme.sidebarVariant,
    };
}

function sectionHeading(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    if (!section.heading) return '';
    if (style.sidebar) {
        return paragraph(
            run(section.heading, {
                bold: true,
                color: style.headingColor,
                size: theme.bodySize + 1,
                caps: theme.uppercaseHeadings,
            }),
            {
                before: 180,
                after: 80,
                keepNext: true,
                keepLines: true,
            },
        );
    }
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
    style: SectionStyle,
): string {
    const pieces: string[] = [];
    if (style.sidebar) {
        pieces.push(paragraph(run(title, {
            bold: true,
            color: style.textColor,
            size: theme.bodySize + 1,
        }), {
            before: 60,
            after: 10,
            keepNext: true,
            keepLines: true,
        }));
        if (subtitle) {
            pieces.push(paragraph(run(subtitle, {
                italic: true,
                color: style.mutedColor,
                size: theme.smallSize,
            }), {
                after: 10,
                keepNext: Boolean(description || bullets?.length),
            }));
        }
        if (date) {
            pieces.push(paragraph(run(date, {
                color: style.mutedColor,
                size: theme.smallSize,
            }), { after: 30 }));
        }
    } else {
        const dateRun = date ? run(date, { color: style.mutedColor, size: theme.smallSize }) : '';
        const titleContent = date
            ? `${run(title, { bold: true, color: style.textColor })}<w:r><w:tab/></w:r>${dateRun}`
            : run(title, { bold: true, color: style.textColor });
        pieces.push(paragraph(titleContent, {
            style: 'EntryTitle',
            rightTab: date ? style.width : undefined,
            keepNext: true,
        }));
        if (subtitle) {
            pieces.push(paragraph(run(subtitle, {
                italic: true,
                color: style.mutedColor,
            }), {
                style: 'EntryMeta',
                keepNext: Boolean(description || bullets?.length),
            }));
        }
    }
    if (description) {
        pieces.push(paragraph(run(description, { color: style.textColor }), { after: 50 }));
    }
    for (const bullet of bullets ?? []) {
        if (style.sidebar) {
            pieces.push(paragraph(
                `${run('•  ', { color: style.headingColor, size: theme.smallSize })}${run(bullet, { color: style.textColor })}`,
                { indent: 180, after: 30, keepLines: true },
            ));
        } else {
            pieces.push(paragraph(run(bullet, { color: style.textColor }), {
                style: 'ListParagraph',
                numbering: true,
                after: 30,
            }));
        }
    }
    return pieces.join('');
}

function customXml(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    const pieces: string[] = [];
    for (const line of section.paragraphs ?? []) {
        if (!line.trim()) {
            pieces.push(emptyParagraph());
            continue;
        }
        if (/^[-•*]\s+/.test(line)) {
            const text = line.replace(/^[-•*]\s+/, '');
            if (style.sidebar) {
                pieces.push(paragraph(
                    `${run('•  ', { color: style.headingColor, size: theme.smallSize })}${run(text, { color: style.textColor })}`,
                    { indent: 180, after: 30, keepLines: true },
                ));
            } else {
                pieces.push(paragraph(run(text, { color: style.textColor }), {
                    style: 'ListParagraph',
                    numbering: true,
                    after: 30,
                }));
            }
        } else {
            pieces.push(paragraph(run(line, { color: style.textColor }), { after: 60 }));
        }
    }
    return pieces.join('');
}

function barTableXml(width: number, percent: number, fill: string, track: string): string {
    const fillWidth = Math.max(1, Math.min(width - 1, Math.round(width * percent / 100)));
    const restWidth = Math.max(1, width - fillWidth);
    const barCell = (cellWidth: number, color: string) =>
        `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${cleanHex(color)}"/><w:vAlign w:val="center"/></w:tcPr>${tinyParagraph()}</w:tc>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${fillWidth}"/><w:gridCol w:w="${restWidth}"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val="50" w:hRule="exact"/></w:trPr>${barCell(fillWidth, fill)}${barCell(restWidth, track)}</w:tr></w:tbl>${tinyParagraph()}`;
}

function skillBarXml(
    value: string,
    index: number,
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const pct = 70 + ((index * 7 + 11) % 30);
    const fill = style.onColor ? 'FFFFFF' : style.headingColor;
    const track = style.onColor
        ? mixHex('#FFFFFF', theme.sidebar?.background ?? '#FFFFFF', 0.22)
        : mixHex(style.headingColor, '#FFFFFF', 0.18);
    return `${paragraph(
        `${run(value, { bold: true, color: style.textColor, size: theme.smallSize })}<w:r><w:tab/></w:r>${run(`${pct}%`, { color: style.mutedColor, size: theme.smallSize })}`,
        { rightTab: style.width, after: 20, keepNext: true },
    )}${barTableXml(style.width, pct, fill, track)}`;
}

function skillChipsXml(
    values: string[],
    theme: DocxTheme,
): string {
    const sidebar = theme.sidebar!;
    // Creative uses an 80%-opacity accent chip; Word shading has no alpha, so
    // blend the accent over the sidebar before writing the hex value.
    const background = theme.sidebarVariant === 'creative'
        ? mixHex(sidebar.chipBackground, sidebar.background, 0.8)
        : sidebar.chipBackground;
    const pieces: string[] = [];
    values.forEach((value, index) => {
        if (index > 0) pieces.push(run('  ', { size: theme.smallSize }));
        pieces.push(run(`\u00A0${value}\u00A0`, {
            color: sidebar.chipText,
            size: theme.smallSize,
            shading: background,
            border: sidebar.chipBorder ? { color: sidebar.chipBorder, size: 4 } : undefined,
        }));
    });
    return paragraph(pieces.join(''), { after: 80 });
}

function skillGroupLabelXml(label: string, theme: DocxTheme, style: SectionStyle): string {
    return paragraph(run(label, {
        bold: true,
        color: style.headingColor,
        size: theme.smallSize,
        caps: style.sidebar && theme.uppercaseHeadings,
    }), {
        before: style.sidebar ? 40 : 80,
        after: 20,
        keepNext: true,
    });
}

function infographicSkillsXml(
    groups: ResumeDocumentSkillGroup[],
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const pieces: string[] = [];
    const softGroups = groups.filter(group => group.label.toLowerCase().includes('soft'));
    const combined = groups
        .filter(group => !group.label.toLowerCase().includes('soft'))
        .flatMap(group => group.values)
        .slice(0, 10);
    if (combined.length > 0) {
        pieces.push(skillGroupLabelXml('Skills', theme, style));
        combined.forEach((value, index) => {
            pieces.push(skillBarXml(value, index, theme, style));
        });
    }
    for (const group of softGroups) {
        pieces.push(skillGroupLabelXml(group.label, theme, style));
        pieces.push(skillChipsXml(group.values, theme));
    }
    return pieces.join('');
}

function skillsXml(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    const groups = section.skillGroups ?? [];
    if (style.sidebar && style.variant === 'infographic') {
        return infographicSkillsXml(groups, theme, style);
    }

    const pieces: string[] = [];
    for (const group of groups) {
        const label = group.label.toLowerCase();
        const isSoft = label.includes('soft');
        const isTools = label.startsWith('tool');
        const variant = style.variant;
        const displayLabel = style.sidebar && variant === 'modern' && isTools
            ? 'Tools & Frameworks'
            : style.sidebar && variant === 'creative' && !isSoft && !isTools
                ? 'Skills'
                : group.label;
        pieces.push(skillGroupLabelXml(displayLabel, theme, style));

        if (!style.sidebar) {
            pieces.push(paragraph(run(group.values.join('  ·  '), { color: style.textColor }), { after: 80 }));
            continue;
        }

        if (variant === 'creative') {
            if (isTools) {
                pieces.push(skillChipsXml(group.values, theme));
            } else if (isSoft) {
                for (const value of group.values) {
                    pieces.push(paragraph(run(value, {
                        color: style.textColor,
                        size: theme.bodySize,
                    }), { after: 30 }));
                }
            } else {
                for (const value of group.values) {
                    pieces.push(paragraph(
                        `${run('•  ', { color: style.headingColor, size: theme.smallSize })}${run(value, { color: style.textColor })}`,
                        { indent: 180, after: 30, keepLines: true },
                    ));
                }
            }
            continue;
        }

        if (variant === 'two-column' && isSoft) {
            for (const value of group.values) {
                pieces.push(paragraph(
                    `${run('•  ', { color: style.headingColor, size: theme.smallSize })}${run(value, { color: style.textColor })}`,
                    { indent: 180, after: 30, keepLines: true },
                ));
            }
            continue;
        }

        const bars = variant === 'two-column' && !isTools;
        if (bars) {
            group.values.forEach((value, index) => {
                pieces.push(skillBarXml(value, index, theme, style));
            });
        } else {
            pieces.push(skillChipsXml(group.values, theme));
        }
    }
    return pieces.join('');
}

function sectionXml(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    // Sidebar skills are split into labelled groups by skillsXml(); rendering
    // the section heading as well would duplicate "Technical Skills".
    const heading = section.kind === 'skills' && style.sidebar
        ? ''
        : sectionHeading(section, theme, style);
    switch (section.kind) {
        case 'summary':
            return `${heading}${paragraph(run(section.paragraphs?.join(' ') ?? '', { color: style.textColor }), { after: 100 })}`;
        case 'skills':
            return `${heading}${skillsXml(section, theme, style)}`;
        case 'custom':
            return `${heading}${customXml(section, theme, style)}`;
        default:
            return `${heading}${(section.entries ?? [])
                .map(entry => entryXml(entry.title, entry.subtitle, entry.date, entry.description, entry.bullets, theme, style))
                .join('')}`;
    }
}

/* ─────────────────────────── headers ─────────────────────────── */

interface HeaderHelpers {
    relIds: Map<number, string>;
    imageRel: (kind: ContactKind, variant: IconVariant) => string;
    nextDrawingId: () => number;
}

function headerPlain(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const pieces: string[] = [
        paragraph(run(model.name, {
            bold: true,
            color: theme.nameColor,
            size: theme.nameSize,
        }), {
            align: theme.headerAlign,
            after: 20,
            keepNext: true,
        }),
    ];
    if (model.headline) {
        pieces.push(paragraph(run(model.headline, {
            color: theme.headlineColor,
            size: theme.smallSize + 2,
        }), {
            align: theme.headerAlign,
            after: 100,
            keepNext: model.contacts.length > 0,
        }));
    }
    pieces.push(contactsParagraph(model.contacts, helpers.relIds, theme, {
        align: theme.headerAlign,
        textColor: theme.contactColor,
        mutedColor: theme.contactMuted,
        iconVariant: 'dark',
        imageRel: helpers.imageRel,
        nextDrawingId: helpers.nextDrawingId,
    }));
    if (theme.headerRule) {
        pieces.push(paragraph('', {
            after: 120,
            borderBottom: { color: theme.accent, size: 18 },
        }));
    }
    return pieces.join('');
}

function headerBandRows(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const band = theme.band!;
    const width = PAGE_WIDTH;
    const title = [
        paragraph(run(model.name, {
            bold: true,
            color: band.text,
            size: theme.nameSize,
        }), { after: 20, keepNext: true }),
    ];
    if (model.headline) {
        title.push(paragraph(run(model.headline, {
            color: band.muted,
            size: theme.smallSize + 2,
        }), { after: 100, keepNext: false }));
    }
    const contacts = contactsParagraph(model.contacts, helpers.relIds, theme, {
        align: 'left',
        textColor: '4B5563',
        mutedColor: '9CA3AF',
        iconVariant: 'dark',
        imageRel: helpers.imageRel,
        nextDrawingId: helpers.nextDrawingId,
        after: 60,
    });
    return [
        tableRow(cell(title.join(''), {
            width,
            gridSpan: 2,
            shading: band.background,
            // 780 = the old 360-twip page margin + the original 420-twip
            // cell inset. This keeps the name at the same vertical position
            // while letting the band colour reach the top paper edge.
            marginTop: 780,
            marginBottom: 300,
            marginLeft: theme.margins.left,
            marginRight: theme.margins.right,
        })),
        tableRow(cell(contacts || emptyParagraph(), {
            width,
            gridSpan: 2,
            shading: band.stripBackground,
            marginTop: 100,
            marginBottom: 80,
            marginLeft: theme.margins.left,
            marginRight: theme.margins.right,
        })),
    ].join('');
}

function headerSidebar(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const pieces: string[] = [
        paragraph(run(model.name, {
            bold: true,
            color: theme.nameColor,
            size: theme.nameSize,
        }), { after: 20, keepNext: true }),
    ];
    if (model.headline) {
        pieces.push(paragraph(run(model.headline, {
            color: theme.headlineColor,
            size: theme.smallSize + 2,
        }), { after: 100, keepNext: model.contacts.length > 0 }));
    }
    pieces.push(contactsStacked(model.contacts, helpers.relIds, theme, {
        align: 'left',
        textColor: theme.contactColor,
        mutedColor: theme.contactMuted,
        iconVariant: 'light',
        imageRel: helpers.imageRel,
        nextDrawingId: helpers.nextDrawingId,
        after: 40,
    }));
    return pieces.join('');
}

function sidebarDocument(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const sidebar = theme.sidebar!;
    const sidebarWidth = Math.round(PAGE_WIDTH * sidebar.widthPct);
    const mainWidth = PAGE_WIDTH - sidebarWidth;
    const sidebarContentWidth = sidebarWidth - sidebar.paddingLeft - sidebar.paddingRight;
    const mainContentWidth = mainWidth - sidebar.mainPaddingLeft - sidebar.mainPaddingRight;
    const sidebarSections = model.sections.filter(section => section.zone === 'sidebar');
    const mainSections = model.sections.filter(section => section.zone !== 'sidebar');
    const sideStyle = sidebarStyle(theme, sidebarContentWidth);
    const bodyStyle = mainStyle(theme, mainContentWidth);

    // Keep the header and the two-column row in one table. If the header was
    // emitted as a separate table, Word could move the whole sidebar table to
    // page two when a resume is slightly too tall, leaving page one with only
    // the header. One table starts on page one and lets the sidebar row flow.
    const headerRows = sidebar.headerInSidebar
        ? ''
        : theme.header === 'band'
            ? headerBandRows(model, theme, helpers)
            : tableRow(cell(headerPlain(model, theme, helpers), {
                width: PAGE_WIDTH,
                gridSpan: 2,
                marginLeft: theme.margins.left,
                marginRight: theme.margins.right,
            }));

    const sidebarContent = [
        sidebar.headerInSidebar
            ? headerSidebar(model, theme, helpers)
            : '',
        ...sidebarSections.map(section => sectionXml(section, theme, sideStyle)),
    ].join('');
    const mainContent = mainSections
        .map(section => sectionXml(section, theme, bodyStyle))
        .join('');

    // `atLeast` rows keep the sidebar colour running to the bottom of the
    // first page even when the resume is short. The value must stay under the
    // remaining content height, otherwise Word pushes the row onto page two
    // and leaves a stray shaded strip there.
    const rowHeight = sidebar.headerInSidebar
        ? 15900
        : theme.header === 'band'
            ? 12400
            : 12800;
    const sidebarRow = tableRow(
        [
            cell(sidebarContent, {
                width: sidebarWidth,
                shading: sidebar.background,
                marginTop: sidebar.paddingTop,
                marginBottom: 240,
                marginLeft: sidebar.paddingLeft,
                marginRight: sidebar.paddingRight,
            }),
            cell(mainContent, {
                width: mainWidth,
                marginTop: sidebar.mainPaddingTop,
                marginBottom: 240,
                marginLeft: sidebar.mainPaddingLeft,
                marginRight: sidebar.mainPaddingRight,
            }),
        ].join(''),
        { height: rowHeight },
    );

    return table(
        PAGE_WIDTH,
        -theme.margins.left,
        [sidebarWidth, mainWidth],
        headerRows + sidebarRow,
    ) + tinyParagraph();
}

/* ─────────────────────────── package ─────────────────────────── */

export interface BuiltResumeDocx {
    bytes: Uint8Array;
    filename: string;
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
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

    const mediaFiles: Record<string, Uint8Array> = {};
    const imageRelIds = new Map<string, string>();
    const imageRel = (kind: ContactKind, variant: IconVariant): string => {
        const key = `${kind}-${variant}`;
        const existing = imageRelIds.get(key);
        if (existing) return existing;
        const id = `rId${nextRel++}`;
        const target = `media/contact-${kind}-${variant}.png`;
        imageRelIds.set(key, id);
        relEntries.push(`<Relationship Id="${id}" Type="${REL_NS}/image" Target="${target}"/>`);
        mediaFiles[`word/${target}`] = base64ToBytes(CONTACT_ICON_PNGS[kind][variant]);
        return id;
    };

    let drawingId = 1;
    const helpers: HeaderHelpers = {
        relIds,
        imageRel,
        nextDrawingId: () => drawingId++,
    };

    const header = theme.sidebar ? '' : headerPlain(model, theme, helpers);

    const body = theme.sidebar
        ? sidebarDocument(model, theme, helpers)
        : model.sections
            .map(section => sectionXml(section, theme, mainStyle(theme)))
            .join('');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}" xmlns:wp="${DRAWING_NS}" xmlns:a="${ART_NS}" xmlns:pic="${PICTURE_NS}">
  <w:body>
    ${header}
    ${body}
    <w:sectPr>
      <w:pgSz w:w="${PAGE_WIDTH}" w:h="${PAGE_HEIGHT}"/>
      <w:pgMar w:top="${theme.margins.top}" w:right="${theme.margins.right}" w:bottom="${theme.margins.bottom}" w:left="${theme.margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
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
  <Default Extension="png" ContentType="image/png"/>
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
        ...mediaFiles,
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
