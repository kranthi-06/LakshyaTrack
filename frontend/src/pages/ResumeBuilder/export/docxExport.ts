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
import {
    layoutRequires,
    mainSkillLayoutFor,
    skillCategory,
    summaryBoxFor,
    type MainSkillLayout,
    type SkillCategory,
    type SkillChipSpec,
} from './skillStyles';

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
type HeaderKind = 'plain' | 'band' | 'split' | 'sidebar';
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
    base: BaseTemplate;
    font: string;
    accent: string;
    headingAccent: string;
    bodySize: number;
    smallSize: number;
    nameSize: number;
    /** Multiple of single line spacing used by Normal paragraphs. */
    lineHeight: number;
    uppercaseHeadings: boolean;
    uppercaseName?: boolean;
    uppercaseHeadline?: boolean;
    headlineItalic?: boolean;
    showHeadline?: boolean;
    nameSpacing?: number;
    headlineSpacing?: number;
    headingSize?: number;
    headingSpacing?: number;
    headingAlign?: 'left' | 'center';
    centerBody?: boolean;
    headingRule?: { color: string; size: number };
    headerRuleWidth?: number;
    bodyText?: string;
    mutedText?: string;
    pageBackground?: string;
    iconVariant?: IconVariant;
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
    /** Square initials badge used by the hero/fresh headers and sidebar templates. */
    avatar?: {
        /** Badge edge length in twips. */
        size: number;
        background: string;
        color: string;
        /** Initial letter size in half-points. */
        fontSize: number;
    };
    band?: {
        background: string;
        text: string;
        muted: string;
        stripBackground: string;
        contactsInBand?: boolean;
        contactText?: string;
        contactMuted?: string;
        ruleColor?: string;
        ruleSize?: number;
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
        base,
        font: monospace ? 'Consolas' : serif ? 'Georgia' : 'Arial',
        accent: color,
        headingAccent: color,
        bodySize: base === 'compact' ? 16 : 18,
        smallSize: base === 'compact' ? 14 : 16,
        nameSize: base === 'bold-header' ? 64 : base === 'compact' ? 30 : 40,
        lineHeight: 1.45,
        uppercaseHeadings: true,
        uppercaseName: false,
        uppercaseHeadline: false,
        showHeadline: true,
        nameSpacing: 0,
        headlineSpacing: 0,
        headingSize: base === 'compact' ? 15 : 17,
        headingSpacing: 0,
        headingAlign: 'left',
        serif,
        header: 'plain',
        headerAlign: serif ? 'center' : 'left',
        nameColor: color,
        headlineColor: '6B7280',
        contactColor: '4B5563',
        contactMuted: '9CA3AF',
        bodyText: '111827',
        mutedText: '6B7280',
        margins: {
            top: PAGE_MARGIN,
            right: PAGE_MARGIN,
            bottom: PAGE_MARGIN,
            left: PAGE_MARGIN,
        },
        headerRule: false,
    };

    if (base === 'classic') {
        return {
            ...baseTheme,
            nameSize: 40,
            lineHeight: 1.5,
            nameColor: '1F2937',
            headlineColor: '6B7280',
            uppercaseName: true,
            uppercaseHeadline: true,
            nameSpacing: 40,
            headlineSpacing: 20,
            headerAlign: 'center',
            headerRule: true,
            accent: color,
            headingAccent: '1F2937',
            headingRule: { color, size: 8 },
            headingSpacing: 20,
            headingSize: 17,
        };
    }

    if (base === 'minimal-ats') {
        return {
            ...baseTheme,
            nameSize: 36,
            showHeadline: false,
            uppercaseName: true,
            nameSpacing: 20,
            headerAlign: 'center',
            headerRule: true,
            nameColor: color,
            headingAccent: color,
            headingRule: { color: 'E5E7EB', size: 6 },
            headingSpacing: 12,
            headingSize: 16,
        };
    }

    if (base === 'academic') {
        return {
            ...baseTheme,
            nameSize: 40,
            lineHeight: 1.5,
            nameColor: color,
            headlineColor: '6B7280',
            headlineItalic: true,
            headerAlign: 'center',
            headerRule: true,
            headingAccent: color,
            headingRule: { color: mixHex(color, '#FFFFFF', 0.25), size: 6 },
            headingSize: 17,
            headingSpacing: 6,
        };
    }

    if (base === 'executive') {
        return {
            ...baseTheme,
            nameSize: 44,
            lineHeight: 1.55,
            header: 'band',
            nameColor: 'FFFFFF',
            headlineColor: 'FFFFFF',
            contactColor: 'FFFFFF',
            contactMuted: 'FFFFFF',
            uppercaseHeadline: true,
            headlineSpacing: 16,
            headingAccent: '6B7280',
            headingSpacing: 16,
            headingSize: 17,
            margins: { top: 0, right: 480, bottom: 720, left: 480 },
            band: {
                background: color,
                text: 'FFFFFF',
                muted: 'FFFFFF',
                stripBackground: color,
                contactsInBand: true,
                contactText: 'FFFFFF',
                contactMuted: 'FFFFFF',
                ruleColor: 'B8860B',
                ruleSize: 24,
            },
        };
    }

    if (base === 'corporate') {
        return {
            ...baseTheme,
            nameSize: 40,
            header: 'split',
            nameColor: color,
            headlineColor: '64748B',
            contactColor: '64748B',
            headingAccent: color,
            headingRule: { color, size: 16 },
            headingSize: 17,
            margins: { top: 0, right: 480, bottom: 720, left: 480 },
        };
    }

    if (base === 'portfolio') {
        return {
            ...baseTheme,
            nameSize: 44,
            header: 'band',
            nameColor: 'FFFFFF',
            headlineColor: 'FFFFFF',
            contactColor: '6B7280',
            contactMuted: '9CA3AF',
            headingAccent: color,
            headingSize: 16,
            avatar: { size: 920, background: 'FFFFFF', color, fontSize: 44 },
            margins: { top: 0, right: 480, bottom: 720, left: 480 },
            band: {
                background: color,
                text: 'FFFFFF',
                muted: 'FFFFFF',
                stripBackground: 'F9FAFB',
                contactText: '6B7280',
                contactMuted: '9CA3AF',
            },
        };
    }

    if (base === 'fresh') {
        return {
            ...baseTheme,
            nameSize: 40,
            header: 'band',
            nameColor: color,
            headlineColor: '9CA3AF',
            contactColor: '6B7280',
            headingAccent: color,
            headingSize: 17,
            avatar: { size: 800, background: color, color: 'FFFFFF', fontSize: 40 },
            margins: { top: 0, right: 480, bottom: 720, left: 480 },
            band: {
                background: mixHex(color, '#FFFFFF', 0.07),
                text: color,
                muted: '9CA3AF',
                stripBackground: mixHex(color, '#FFFFFF', 0.07),
                contactsInBand: true,
                contactText: '6B7280',
                contactMuted: '9CA3AF',
            },
        };
    }

    if (base === 'timeline') {
        return {
            ...baseTheme,
            nameSize: 42,
            nameColor: color,
            headlineColor: '6B7280',
            headingAccent: color,
            headingSize: 17,
        };
    }

    if (base === 'elegant') {
        return {
            ...baseTheme,
            nameSize: 34,
            lineHeight: 1.65,
            nameColor: color,
            headlineColor: 'A8A29E',
            contactColor: 'A8A29E',
            contactMuted: 'A8A29E',
            uppercaseName: true,
            uppercaseHeadline: true,
            nameSpacing: 60,
            headlineSpacing: 28,
            headerAlign: 'center',
            headingAccent: color,
            headingAlign: 'center',
            centerBody: true,
            headingSpacing: 44,
            headingSize: 16,
            margins: { top: 840, right: 720, bottom: 720, left: 720 },
        };
    }

    if (base === 'bold-header') {
        return {
            ...baseTheme,
            nameSize: 64,
            nameColor: color,
            headlineColor: '9CA3AF',
            headingAccent: color,
            headingSize: 19,
            headerRule: true,
            headerRuleWidth: 1200,
        };
    }

    if (base === 'developer') {
        return {
            ...baseTheme,
            nameSize: 34,
            lineHeight: 1.5,
            nameColor: color,
            headlineColor: 'E5E7EB',
            contactColor: 'FBBF24',
            contactMuted: '8B949E',
            headingAccent: '22C55E',
            headingSize: 18,
            bodyText: 'D1D5DB',
            mutedText: '8B949E',
            pageBackground: '0D1117',
            iconVariant: 'light',
            margins: { top: 480, right: 480, bottom: 480, left: 480 },
        };
    }

    if (base === 'compact') {
        return {
            ...baseTheme,
            nameSize: 30,
            lineHeight: 1.34,
            nameColor: color,
            showHeadline: false,
            headerAlign: 'center',
            headerRule: true,
            headingAccent: color,
            headingSize: 15,
            bodySize: 16,
            smallSize: 14,
            margins: { top: 540, right: 600, bottom: 480, left: 600 },
        };
    }

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
            headingAccent: color,
            headingSize: 16,
            headingSpacing: 20,
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
            headingAccent: color,
            headingSize: 16,
            headingSpacing: 16,
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
            nameSize: 38,
            header: 'sidebar',
            nameColor: 'FFFFFF',
            headlineColor: 'F1F5F9',
            uppercaseHeadline: true,
            headingSpacing: 10,
            headingSize: 16,
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
            nameSize: 34,
            header: 'sidebar',
            nameColor: 'FFFFFF',
            headlineColor: 'F1F5F9',
            headingSpacing: 8,
            headingSize: 16,
            contactColor: 'FFFFFF',
            contactMuted: 'E5E7EB',
            avatar: { size: 960, background: 'FFFFFF', color, fontSize: 42 },
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
    spacing?: number;
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
    if (options.spacing) props.push(`<w:spacing w:val="${Math.round(options.spacing)}"/>`);
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
    rightIndent?: number;
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
    if (options.rightIndent) props.push(`<w:ind w:right="${options.rightIndent}"/>`);
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
      <w:spacing w:before="0" w:after="60" w:line="${Math.round(theme.lineHeight * 240)}" w:lineRule="auto"/>
      <w:widowControl/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
    <w:rPr><w:color w:val="${theme.bodyText ?? '111827'}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="40"/><w:jc w:val="left"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="${theme.accent}"/><w:sz w:val="${theme.nameSize}"/><w:szCs w:val="${theme.nameSize}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:rPr><w:color w:val="${theme.mutedText ?? '6B7280'}"/><w:sz w:val="${theme.smallSize + 2}"/><w:szCs w:val="${theme.smallSize + 2}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr>
      <w:keepNext/><w:keepLines/>
      <w:spacing w:before="260" w:after="90"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/><w:color w:val="${theme.headingAccent}"/>
      <w:sz w:val="${theme.headingSize ?? theme.bodySize + 1}"/><w:szCs w:val="${theme.headingSize ?? theme.bodySize + 1}"/>
      ${theme.headingSpacing ? `<w:spacing w:val="${theme.headingSpacing}"/>` : ''}
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
    <w:rPr><w:i/><w:color w:val="${theme.mutedText ?? '6B7280'}"/><w:sz w:val="${theme.smallSize}"/><w:szCs w:val="${theme.smallSize}"/></w:rPr>
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
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
}

function settingsXml(theme: DocxTheme): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${WORD_NS}">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  ${theme.pageBackground ? '<w:displayBackgroundShape/>' : ''}
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
    /** Split inline contacts across explicit rows to avoid long header lines. */
    maxPerRow?: number;
    /** Starting index used to resolve hyperlink relationships for a slice. */
    startIndex?: number;
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
    const startIndex = options.startIndex ?? 0;
    contacts.forEach((contact, index) => {
        if (index > 0) {
            pieces.push(run('  •  ', { color: options.mutedColor, size: theme.smallSize }));
        }
        pieces.push(contactRun(contact, relIds.get(startIndex + index) ?? null, options, theme));
    });
    return paragraph(pieces.join(''), {
        align: options.align,
        after: options.after ?? 120,
        keepNext: true,
    });
}

function contactsInlineRows(
    contacts: ResumeDocumentContact[],
    relIds: Map<number, string>,
    theme: DocxTheme,
    options: ContactRenderOptions,
    perRow: number,
): string {
    if (contacts.length === 0) return '';
    const rows: string[] = [];
    for (let start = 0; start < contacts.length; start += perRow) {
        rows.push(contactsParagraph(
            contacts.slice(start, start + perRow),
            relIds,
            theme,
            {
                ...options,
                startIndex: start,
                after: start + perRow >= contacts.length ? options.after : 10,
            },
        ));
    }
    return rows.join('');
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

interface CellBorder {
    color: string;
    /** Border width in eighths of a point, as OOXML expects. */
    size: number;
}

interface CellOptions {
    width: number;
    shading?: string;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    borders?: {
        top?: CellBorder;
        left?: CellBorder;
        bottom?: CellBorder;
        right?: CellBorder;
    };
    /** Span both sidebar and main columns for full-width header rows. */
    gridSpan?: number;
    vAlign?: 'top' | 'center';
}

function cellBordersXml(borders: CellOptions['borders']): string {
    if (!borders) return '';
    const side = (name: 'top' | 'left' | 'bottom' | 'right') => {
        const border = borders[name];
        return border
            ? `<w:${name} w:val="single" w:sz="${border.size}" w:space="0" w:color="${cleanHex(border.color)}"/>`
            : '';
    };
    const values = [side('top'), side('left'), side('bottom'), side('right')].join('');
    return values ? `<w:tcBorders>${values}</w:tcBorders>` : '';
}

function cell(content: string, options: CellOptions): string {
    const shading = options.shading
        ? `<w:shd w:val="clear" w:color="auto" w:fill="${cleanHex(options.shading)}"/>`
        : '';
    const margins = `<w:tcMar><w:top w:w="${options.marginTop ?? 0}" w:type="dxa"/><w:left w:w="${options.marginLeft ?? 0}" w:type="dxa"/><w:bottom w:w="${options.marginBottom ?? 0}" w:type="dxa"/><w:right w:w="${options.marginRight ?? 0}" w:type="dxa"/></w:tcMar>`;
    const span = options.gridSpan && options.gridSpan > 1
        ? `<w:gridSpan w:val="${options.gridSpan}"/>`
        : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${options.width}" w:type="dxa"/>${span}${cellBordersXml(options.borders)}${shading}${margins}<w:vAlign w:val="${options.vAlign ?? 'top'}"/></w:tcPr>${content || emptyParagraph()}</w:tc>`;
}

function tableRow(
    content: string,
    options: { height?: number; cantSplit?: boolean } = {},
): string {
    const props: string[] = [];
    if (options.cantSplit) props.push('<w:cantSplit/>');
    if (options.height) {
        props.push(`<w:trHeight w:val="${options.height}" w:hRule="atLeast"/>`);
    }
    const rowProps = props.length > 0 ? `<w:trPr>${props.join('')}</w:trPr>` : '';
    return `<w:tr>${rowProps}${content}</w:tr>`;
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
        textColor: theme.bodyText ?? '111827',
        mutedColor: theme.mutedText ?? '6B7280',
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

function sectionHeading(
    section: ResumeDocumentSection,
    theme: DocxTheme,
    style: SectionStyle,
    text: string = section.heading,
): string {
    if (!text) return '';
    if (style.sidebar) {
        return paragraph(
            run(text, {
                bold: true,
                color: style.headingColor,
                size: theme.headingSize ?? theme.bodySize + 1,
                caps: theme.uppercaseHeadings,
                spacing: theme.headingSpacing,
            }),
            {
                before: 180,
                after: 80,
                keepNext: true,
                keepLines: true,
            },
        );
    }
    return paragraph(run(text, {
        bold: true,
        color: style.headingColor,
        size: theme.headingSize ?? theme.bodySize + 1,
        caps: theme.uppercaseHeadings,
        spacing: theme.headingSpacing,
    }), {
        style: 'Heading1',
        align: theme.headingAlign ?? 'left',
        before: 280,
        after: 100,
        keepNext: true,
        borderBottom: theme.headingRule,
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
    } else if (theme.centerBody) {
        pieces.push(paragraph(run(title, { bold: true, color: style.textColor }), {
            style: 'EntryTitle',
            align: 'center',
            after: 10,
            keepNext: true,
        }));
        const meta = [subtitle, date].filter(Boolean).join(' · ');
        if (meta) {
            pieces.push(paragraph(run(meta, {
                italic: true,
                color: style.mutedColor,
            }), {
                style: 'EntryMeta',
                align: 'center',
                keepNext: Boolean(description || bullets?.length),
            }));
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
        pieces.push(paragraph(run(description, { color: style.textColor }), {
            align: theme.centerBody ? 'center' : undefined,
            after: 50,
        }));
    }
    for (const bullet of bullets ?? []) {
        if (theme.centerBody) {
            pieces.push(paragraph(run(bullet, { color: style.textColor }), {
                align: 'center',
                after: 30,
                keepLines: true,
            }));
        } else if (style.sidebar) {
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
            pieces.push(paragraph(run(line, {
                color: style.textColor,
                italic: theme.base === 'elegant',
            }), {
                align: theme.centerBody ? 'center' : undefined,
                after: 60,
            }));
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

function chipLabel(value: string): string {
    // Word breaks lines at ordinary spaces, which splits a single chip over
    // two rows. A non-breaking space keeps each skill on one pill.
    return value.replace(/ /g, '\u00A0');
}

function sidebarSkillChipsXml(
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
        if (index > 0) pieces.push(run('   ', { size: theme.smallSize }));
        pieces.push(run(`\u00A0${chipLabel(value)}\u00A0`, {
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
        pieces.push(sidebarSkillChipsXml(group.values, theme));
    }
    return pieces.join('');
}

/* ─────────────────────── main-column skill renderers ─────────────────────── */

interface BoxRenderOptions {
    shading?: string;
    border?: { color: string; width: number };
    leftBar?: { color: string; width: number };
    paddingX: number;
    paddingY: number;
}

/** One-cell, zero-bordered table used for summary and competency boxes. */
function boxedTableXml(content: string, width: number, options: BoxRenderOptions): string {
    const border = options.border
        ? {
            color: options.border.color,
            size: Math.max(2, Math.round(options.border.width * 8)),
        }
        : undefined;
    const leftBar = options.leftBar
        ? {
            color: options.leftBar.color,
            size: Math.max(2, Math.round(options.leftBar.width * 8)),
        }
        : undefined;
    const borders: CellOptions['borders'] = border
        ? { top: border, right: border, bottom: border, left: leftBar ?? border }
        : leftBar
            ? { left: leftBar }
            : undefined;
    const paddingX = Math.round(options.paddingX * 20);
    const paddingY = Math.round(options.paddingY * 20);
    return table(width, 0, [width], tableRow(cell(content, {
        width,
        shading: options.shading,
        borders,
        marginTop: paddingY,
        marginBottom: paddingY,
        marginLeft: paddingX,
        marginRight: paddingX,
    }), { cantSplit: true })) + tinyParagraph();
}

function mainChipRun(value: string, chip: SkillChipSpec, theme: DocxTheme): string {
    const padding = '\u00A0\u00A0';
    return run(`${padding}${chipLabel(value)}${padding}`, {
        bold: true,
        color: chip.text,
        size: theme.smallSize,
        shading: chip.background,
        border: chip.border
            ? { color: chip.border, size: Math.max(2, Math.round((chip.borderWidth ?? 0.5) * 8)) }
            : undefined,
    });
}

function mainChipsXml(
    values: string[],
    chip: SkillChipSpec,
    theme: DocxTheme,
    after = 80,
): string {
    const pieces: string[] = [];
    values.forEach((value, index) => {
        if (index > 0) pieces.push(run('   ', { size: theme.smallSize }));
        pieces.push(mainChipRun(value, chip, theme));
    });
    return paragraph(pieces.join(''), { after, keepLines: true });
}

function skillBoxXml(
    section: ResumeDocumentSection,
    layout: Extract<MainSkillLayout, { kind: 'chips' }>,
    values: string[],
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const box = layout.box!;
    const heading = layout.showHeading ? layout.heading ?? section.heading : '';
    const headingXml = heading
        ? paragraph(run(heading, {
            bold: true,
            color: box.headingColor,
            size: theme.smallSize + 1,
            caps: theme.uppercaseHeadings,
        }), { after: 60, keepNext: true })
        : '';
    return boxedTableXml(
        `${headingXml}${mainChipsXml(values, layout.chip, theme, 0)}`,
        style.width,
        {
            shading: box.background,
            border: box.border,
            leftBar: box.leftBar,
            paddingX: box.paddingX,
            paddingY: box.paddingY,
        },
    );
}

function bulletGridXml(
    values: string[],
    columns: number,
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const columnWidth = Math.floor(style.width / columns);
    const widths = Array.from(
        { length: columns },
        (_, index) => index === columns - 1 ? style.width - columnWidth * (columns - 1) : columnWidth,
    );
    const rows: string[] = [];
    for (let index = 0; index < values.length; index += columns) {
        const row = values.slice(index, index + columns);
        const cells = widths.map((width, column) => {
            const content = row[column]
                ? paragraph(
                    `${run('•  ', { color: style.headingColor, size: theme.smallSize })}${run(row[column], { color: style.textColor })}`,
                    { after: 20, keepLines: true },
                )
                : emptyParagraph();
            return cell(content, { width });
        }).join('');
        rows.push(tableRow(cells));
    }
    return table(style.width, 0, widths, rows.join('')) + tinyParagraph();
}

function developerSkillsXml(
    groups: ResumeDocumentSkillGroup[],
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const keyNames: Record<SkillCategory, string> = {
        technical: 'languages',
        tools: 'tools',
        soft: 'softSkills',
    };
    const pieces: string[] = [
        paragraph(
            `${run('const ', { bold: true, color: '7C3AED' })}${run('techStack', { bold: true, color: theme.accent })}${run(' = {', { color: style.textColor })}`,
            { before: 280, after: 60, keepNext: true },
        ),
    ];
    for (const group of groups) {
        const key = keyNames[skillCategory(group.label)];
        const values = group.values.map(value => `"${value}"`).join(', ');
        pieces.push(paragraph(
            `${run(`${key}: [`, { color: '2563EB' })}${run(values, { color: 'B45309' })}${run('],', { color: style.textColor })}`,
            { indent: 360, after: 30, keepLines: true },
        ));
    }
    pieces.push(paragraph(run('};', { color: style.textColor }), { after: 80 }));
    return pieces.join('');
}

function includedSkillGroups(
    section: ResumeDocumentSection,
    layout: MainSkillLayout,
): ResumeDocumentSkillGroup[] {
    return (section.skillGroups ?? []).filter(group =>
        layout.include.includes(skillCategory(group.label)),
    );
}

function mainSkillsXml(
    section: ResumeDocumentSection,
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const groups = section.skillGroups ?? [];
    const layout = mainSkillLayoutFor(theme.base, theme.accent);
    if (!layoutRequires(layout, groups)) return '';
    const included = includedSkillGroups(section, layout);
    if (included.length === 0) return '';

    if (layout.kind === 'inline-labeled') {
        let output = sectionHeading(section, theme, style);
        for (const group of included) {
            const category = skillCategory(group.label);
            output += paragraph(
                `${run(`${layout.labels[category] ?? group.label}: `, { bold: true, color: style.textColor })}${run(group.values.join(layout.separator), { color: style.textColor })}`,
                { after: 50, keepLines: true },
            );
        }
        return output;
    }

    if (layout.kind === 'inline') {
        return sectionHeading(section, theme, style) + paragraph(
            run(included.flatMap(group => group.values).join(layout.separator), {
                color: style.textColor,
            }),
            { align: layout.center ? 'center' : 'left', after: 80, keepLines: true },
        );
    }

    if (layout.kind === 'bullet-grid') {
        return sectionHeading(section, theme, style) + bulletGridXml(
            included.flatMap(group => group.values),
            layout.columns,
            theme,
            style,
        );
    }

    if (layout.kind === 'code') {
        return developerSkillsXml(included, theme, style);
    }

    const values = included.flatMap(group => group.values);
    if (layout.box) {
        return skillBoxXml(section, layout, values, theme, style);
    }
    const heading = layout.showHeading
        ? sectionHeading(section, theme, style, layout.heading ?? section.heading)
        : '';
    return `${heading}${mainChipsXml(values, layout.chip, theme)}`;
}

function summaryXml(
    section: ResumeDocumentSection,
    theme: DocxTheme,
    style: SectionStyle,
): string {
    const text = section.paragraphs?.join(' ') ?? '';
    const box = summaryBoxFor(theme.base, theme.accent);
    const hasVisibleBox = Boolean(box && (box.background || box.border || box.leftBar));
    if (!box || !hasVisibleBox) {
        return paragraph(run(text, {
            color: style.textColor,
            italic: theme.base === 'elegant' || theme.base === 'academic',
        }), {
            align: theme.centerBody ? 'center' : undefined,
            after: 100,
        });
    }

    const heading = box.headingInside && section.heading
        ? paragraph(run(section.heading, {
            bold: true,
            color: box.headingColor,
            size: theme.smallSize + 1,
            caps: theme.uppercaseHeadings,
        }), { after: 60, keepNext: true })
        : '';
    return boxedTableXml(
        `${heading}${paragraph(run(text, { color: style.textColor }), { after: 0 })}`,
        style.width,
        {
            shading: box.background,
            border: box.border,
            leftBar: box.leftBar,
            paddingX: box.paddingX,
            paddingY: box.paddingY,
        },
    );
}

function skillsXml(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    const groups = section.skillGroups ?? [];
    if (!style.sidebar) {
        return mainSkillsXml(section, theme, style);
    }

    if (style.variant === 'infographic') {
        return infographicSkillsXml(groups, theme, style);
    }

    const pieces: string[] = [];
    for (const group of groups) {
        const label = group.label.toLowerCase();
        const isSoft = label.includes('soft');
        const isTools = label.startsWith('tool');
        const variant = style.variant;
        const displayLabel = variant === 'modern' && isTools
            ? 'Tools & Frameworks'
            : variant === 'creative' && !isSoft && !isTools
                ? 'Skills'
                : group.label;
        pieces.push(skillGroupLabelXml(displayLabel, theme, style));

        if (variant === 'creative') {
            if (isTools) {
                pieces.push(sidebarSkillChipsXml(group.values, theme));
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
            pieces.push(sidebarSkillChipsXml(group.values, theme));
        }
    }
    return pieces.join('');
}

function sectionXml(section: ResumeDocumentSection, theme: DocxTheme, style: SectionStyle): string {
    if (section.kind === 'skills') {
        // skillsXml owns the heading because several templates rename or hide
        // it, and the executive box places it inside the competency panel.
        return skillsXml(section, theme, style);
    }
    if (section.kind === 'summary') {
        const box = summaryBoxFor(theme.base, theme.accent);
        const suppressHeading = Boolean(box && (box.headingInside || box.hideHeading));
        return `${suppressHeading ? '' : sectionHeading(section, theme, style)}${summaryXml(section, theme, style)}`;
    }

    const heading = sectionHeading(section, theme, style);
    switch (section.kind) {
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
    const name = theme.uppercaseName ? model.name.toUpperCase() : model.name;
    const headline = theme.uppercaseHeadline ? model.headline.toUpperCase() : model.headline;
    const pieces: string[] = [
        paragraph(run(name, {
            bold: true,
            color: theme.nameColor,
            size: theme.nameSize,
            spacing: theme.nameSpacing,
        }), {
            align: theme.headerAlign,
            after: 20,
            keepNext: true,
        }),
    ];
    if (model.headline && theme.showHeadline !== false) {
        pieces.push(paragraph(run(headline, {
            color: theme.headlineColor,
            size: theme.smallSize + 2,
            italic: theme.headlineItalic,
            spacing: theme.headlineSpacing,
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
        iconVariant: theme.iconVariant ?? 'dark',
        imageRel: helpers.imageRel,
        nextDrawingId: helpers.nextDrawingId,
    }));
    if (theme.headerRule) {
        pieces.push(paragraph('', {
            after: 120,
            rightIndent: theme.headerRuleWidth
                ? Math.max(0, CONTENT_WIDTH - theme.headerRuleWidth)
                : undefined,
            borderBottom: { color: theme.accent, size: 18 },
        }));
    }
    return pieces.join('');
}

function avatarBadge(
    model: ResumeDocumentModel,
    avatar: NonNullable<DocxTheme['avatar']>,
): string {
    const initial = (model.name || 'U').charAt(0).toUpperCase();
    return table(
        avatar.size,
        0,
        [avatar.size],
        tableRow(cell(
            paragraph(run(initial, {
                bold: true,
                color: avatar.color,
                size: avatar.fontSize,
            }), { align: 'center', after: 0 }),
            {
                width: avatar.size,
                shading: avatar.background,
                vAlign: 'center',
            },
        ), { height: avatar.size, cantSplit: true }),
    ) + tinyParagraph();
}

function headerBandRows(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const band = theme.band!;
    const width = PAGE_WIDTH;
    const name = theme.uppercaseName ? model.name.toUpperCase() : model.name;
    const avatar = theme.avatar;
    const location = theme.base === 'fresh'
        ? model.contacts.find(contact => contact.kind === 'location')
        : undefined;
    // The fresh header folds the location into the headline and keeps it out
    // of the contact row, exactly like the browser template and the PDF.
    const headline = [model.headline, location?.label]
        .filter(Boolean)
        .join(' · ');
    const headlineText = theme.uppercaseHeadline ? headline.toUpperCase() : headline;
    const bandContacts = location
        ? model.contacts.filter(contact => contact.kind !== 'location')
        : model.contacts;
    const bandRelIds = location
        ? (() => {
            const remapped = new Map<number, string>();
            bandContacts.forEach((contact, index) => {
                const relId = helpers.relIds.get(model.contacts.indexOf(contact));
                if (relId) remapped.set(index, relId);
            });
            return remapped;
        })()
        : helpers.relIds;
    const onDark = band.contactsInBand && cleanHex(band.text) === 'FFFFFF';
    const title = [
        paragraph(run(name, {
            bold: true,
            color: band.text,
            size: theme.nameSize,
            spacing: theme.nameSpacing,
        }), { after: 20, keepNext: true }),
    ];
    if (headlineText && theme.showHeadline !== false) {
        title.push(paragraph(run(headlineText, {
            color: band.muted,
            size: theme.smallSize + 2,
            italic: theme.headlineItalic,
            spacing: theme.headlineSpacing,
        }), { after: band.contactsInBand ? 80 : 100, keepNext: band.contactsInBand }));
    }
    if (band.contactsInBand) {
        title.push(contactsInlineRows(bandContacts, bandRelIds, theme, {
            align: 'left',
            textColor: band.contactText ?? band.text,
            mutedColor: band.contactMuted ?? band.muted,
            iconVariant: onDark ? 'light' : 'dark',
            imageRel: helpers.imageRel,
            nextDrawingId: helpers.nextDrawingId,
            after: 40,
        }, 6));
    }
    const contacts = band.contactsInBand
        ? ''
        : contactsInlineRows(bandContacts, bandRelIds, theme, {
            align: 'left',
            textColor: band.contactText ?? '4B5563',
            mutedColor: band.contactMuted ?? '9CA3AF',
            iconVariant: 'dark',
            imageRel: helpers.imageRel,
            nextDrawingId: helpers.nextDrawingId,
            after: 60,
        }, 7);

    const avatarCell = avatar
        ? cell(avatarBadge(model, avatar), {
            width: theme.margins.left + avatar.size,
            shading: band.background,
            marginTop: 780,
            marginBottom: 0,
            marginLeft: theme.margins.left,
            marginRight: 0,
        })
        : '';
    const titleCell = cell(title.join(''), {
        width: avatar ? width - (theme.margins.left + avatar.size) : width,
        gridSpan: avatar ? undefined : 2,
        shading: band.background,
        borders: band.ruleColor && band.ruleSize
            ? { bottom: { color: band.ruleColor, size: band.ruleSize } }
            : undefined,
        // 780 = the old 360-twip page margin + the original 420-twip
        // cell inset. This keeps the name at the same vertical position
        // while letting the band colour reach the top paper edge.
        marginTop: 780,
        marginBottom: 300,
        marginLeft: avatar ? 320 : theme.margins.left,
        marginRight: theme.margins.right,
    });
    const rows = [
        tableRow(avatarCell + titleCell, avatar ? { cantSplit: true } : {}),
    ];
    if (!band.contactsInBand) {
        rows.push(tableRow(cell(contacts || emptyParagraph(), {
            width,
            gridSpan: 2,
            shading: band.stripBackground,
            marginTop: 100,
            marginBottom: 80,
            marginLeft: theme.margins.left,
            marginRight: theme.margins.right,
        })));
    }
    return rows.join('');
}

function headerSplitRows(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const leftWidth = Math.round(PAGE_WIDTH * 0.6);
    const rightWidth = PAGE_WIDTH - leftWidth;
    const name = theme.uppercaseName ? model.name.toUpperCase() : model.name;
    const headline = theme.uppercaseHeadline ? model.headline.toUpperCase() : model.headline;
    const left = [
        paragraph(run(name, {
            bold: true,
            color: theme.nameColor,
            size: theme.nameSize,
            spacing: theme.nameSpacing,
        }), { after: 20, keepNext: true }),
    ];
    if (model.headline && theme.showHeadline !== false) {
        left.push(paragraph(run(headline, {
            color: theme.headlineColor,
            size: theme.smallSize + 2,
            italic: theme.headlineItalic,
            spacing: theme.headlineSpacing,
        }), { after: 0, keepNext: true }));
    }
    const right = contactsStacked(model.contacts, helpers.relIds, theme, {
        align: 'left',
        textColor: theme.contactColor,
        mutedColor: theme.contactMuted,
        iconVariant: theme.iconVariant ?? 'dark',
        imageRel: helpers.imageRel,
        nextDrawingId: helpers.nextDrawingId,
        after: 20,
    });
    const shading = mixHex(theme.accent, '#FFFFFF', 0.04);
    const border = { bottom: { color: theme.accent, size: 20 } };
    return tableRow([
        cell(left.join(''), {
            width: leftWidth,
            shading,
            borders: border,
            marginTop: 480,
            marginBottom: 360,
            marginLeft: theme.margins.left,
            marginRight: 240,
        }),
        cell(right || emptyParagraph(), {
            width: rightWidth,
            shading,
            borders: border,
            marginTop: 560,
            marginBottom: 360,
            marginLeft: 120,
            marginRight: theme.margins.right,
        }),
    ].join(''), { cantSplit: true });
}

function headerSidebar(
    model: ResumeDocumentModel,
    theme: DocxTheme,
    helpers: HeaderHelpers,
): string {
    const name = theme.uppercaseName ? model.name.toUpperCase() : model.name;
    const headline = theme.uppercaseHeadline ? model.headline.toUpperCase() : model.headline;
    const pieces: string[] = [
        theme.avatar ? avatarBadge(model, theme.avatar) : '',
        paragraph(run(name, {
            bold: true,
            color: theme.nameColor,
            size: theme.nameSize,
            spacing: theme.nameSpacing,
        }), { after: 20, keepNext: true }),
    ];
    if (model.headline && theme.showHeadline !== false) {
        pieces.push(paragraph(run(headline, {
            color: theme.headlineColor,
            size: theme.smallSize + 2,
            italic: theme.headlineItalic,
            spacing: theme.headlineSpacing,
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

    // With the header outside the table (modern/creative), the sidebar
    // background should stop where the content ends, exactly like the browser
    // template. Only when the header lives inside the sidebar cell do we need
    // an explicit full-page row height. A tall `atLeast` row after an external
    // header otherwise pushes the whole two-column row onto page two.
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
        sidebar.headerInSidebar ? { height: 15900 } : undefined,
    );

    return table(
        PAGE_WIDTH,
        0,
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

    const header = theme.sidebar
        ? ''
        : theme.header === 'band'
            ? table(
                PAGE_WIDTH,
                0,
                theme.avatar
                    ? [theme.margins.left + theme.avatar.size, PAGE_WIDTH - (theme.margins.left + theme.avatar.size)]
                    : [Math.round(PAGE_WIDTH / 2), PAGE_WIDTH - Math.round(PAGE_WIDTH / 2)],
                headerBandRows(model, theme, helpers),
            ) + tinyParagraph()
            : theme.header === 'split'
                ? table(
                    PAGE_WIDTH,
                    0,
                    [Math.round(PAGE_WIDTH * 0.6), PAGE_WIDTH - Math.round(PAGE_WIDTH * 0.6)],
                    headerSplitRows(model, theme, helpers),
                ) + tinyParagraph()
                : headerPlain(model, theme, helpers);

    const body = theme.sidebar
        ? sidebarDocument(model, theme, helpers)
        : model.sections
            .map(section => sectionXml(section, theme, mainStyle(theme)))
            .join('');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}" xmlns:wp="${DRAWING_NS}" xmlns:a="${ART_NS}" xmlns:pic="${PICTURE_NS}">
  ${theme.pageBackground ? `<w:background w:color="${cleanHex(theme.pageBackground)}"/>` : ''}
  <w:body>
    ${header}
    ${body}
    <w:sectPr>
      <w:pgSz w:w="${PAGE_WIDTH}" w:h="${PAGE_HEIGHT}"/>
      <w:pgMar w:top="${theme.margins.top}" w:right="${theme.margins.right}" w:bottom="${theme.margins.bottom}" w:left="${theme.margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
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
        'word/settings.xml': strToU8(settingsXml(theme)),
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
