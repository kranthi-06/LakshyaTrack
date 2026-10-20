import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { saveAs } from 'file-saver';
import type { BaseTemplate } from '../templates/templateCatalog';
import type { SectionZone } from '../sectionModel';
import type {
    ResumeDocumentContact,
    ResumeDocumentModel,
    ResumeDocumentSection,
    ResumeDocumentSkillGroup,
} from './resumeDocument';

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

type FontFamily = 'sans' | 'serif' | 'mono';
type HeaderKind = 'left' | 'center' | 'band' | 'split' | 'hero' | 'sidebar' | 'fresh' | 'code';
type HeadingStyle = 'plain' | 'underline' | 'center' | 'bar' | 'band' | 'leftbar' | 'code';
type SkillsStyle = 'chips' | 'inline' | 'lines' | 'bars';
type Zone = SectionZone;

interface ColumnTheme {
    widthPct: number;
    background: string;
    text: string;
    muted: string;
    heading: string;
    chipBackground: string;
    chipText: string;
    headerInSidebar: boolean;
    padding: number;
}

interface PdfTheme {
    font: FontFamily;
    header: HeaderKind;
    nameSize: number;
    headlineSize: number;
    contactSize: number;
    bodySize: number;
    smallSize: number;
    headingSize: number;
    lineHeight: number;
    text: string;
    muted: string;
    nameColor: string;
    headlineColor: string;
    contactColor: string;
    headingColor: string;
    headingStyle: HeadingStyle;
    uppercaseName?: boolean;
    uppercaseHeadings?: boolean;
    nameLetterSpacing?: number;
    headlineLetterSpacing?: number;
    headingLetterSpacing?: number;
    margin: number;
    bottomMargin: number;
    sectionGap: number;
    entryGap: number;
    bulletGap: number;
    headerRule?: number;
    headerRuleColor?: string;
    headerShortRule?: boolean;
    headerBandHeight?: number;
    headerBandText?: string;
    headerBandMuted?: string;
    contactStrip?: string;
    columns?: ColumnTheme;
    skills: SkillsStyle;
    chipBorder?: string;
    summaryItalic?: boolean;
    centerBody?: boolean;
    timeline?: boolean;
    entryBar?: boolean;
    entryDivider?: boolean;
    projectBadges?: boolean;
    summaryBox?: boolean;
    avatar?: boolean;
    background?: string;
    dark?: boolean;
    pageNumber?: boolean;
}

const WHITE = '#FFFFFF';
const INK = '#111827';
const MUTED = '#4B5563';
const LIGHT_MUTED = '#6B7280';
const BORDER = '#E5E7EB';

function normalizeHex(value: string | undefined, fallback = INK): string {
    if (!value) return fallback;
    const match = value.trim().match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (!match) return fallback;
    return `#${match[1].toUpperCase()}`;
}

function hexToRgb(hex: string): RGB {
    const clean = normalizeHex(hex).slice(1);
    return rgb(
        parseInt(clean.slice(0, 2), 16) / 255,
        parseInt(clean.slice(2, 4), 16) / 255,
        parseInt(clean.slice(4, 6), 16) / 255,
    );
}

/** Blend a colour towards white; `amount` is the 0–1 strength of the colour. */
function tint(hex: string, amount: number): string {
    const clean = normalizeHex(hex).slice(1);
    const channels = [0, 2, 4].map(offset => parseInt(clean.slice(offset, offset + 2), 16));
    return `#${channels
        .map(channel => Math.round(255 - (255 - channel) * amount).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
}

function themeFor(base: BaseTemplate, accent: string): PdfTheme {
    const color = normalizeHex(accent, '#5C52D2');

    switch (base) {
        case 'classic':
            return {
                font: 'serif', header: 'center', nameSize: 20, headlineSize: 9, contactSize: 8.2,
                bodySize: 8.9, smallSize: 8, headingSize: 8.4, lineHeight: 1.5,
                text: '#1F2937', muted: '#4B5563', nameColor: INK, headlineColor: LIGHT_MUTED,
                contactColor: '#4B5563', headingColor: INK, headingStyle: 'underline',
                uppercaseName: true, uppercaseHeadings: true, nameLetterSpacing: 2, headingLetterSpacing: 1.4,
                margin: 46, bottomMargin: 42, sectionGap: 13, entryGap: 8, bulletGap: 2.5,
                headerRule: 1.5, headerRuleColor: color, skills: 'inline',
            };
        case 'creative':
            return {
                font: 'sans', header: 'band', nameSize: 22, headlineSize: 9.4, contactSize: 8,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8, lineHeight: 1.42,
                text: '#374151', muted: LIGHT_MUTED, nameColor: WHITE, headlineColor: WHITE,
                contactColor: '#4B5563', headingColor: color, headingStyle: 'bar',
                uppercaseHeadings: true, headingLetterSpacing: 1, margin: 30, bottomMargin: 32,
                sectionGap: 12, entryGap: 7, bulletGap: 2.5, headerBandHeight: 104,
                headerBandText: WHITE, headerBandMuted: WHITE, contactStrip: '#F9FAFB',
                columns: {
                    widthPct: 0.35, background: '#F9FAFB', text: '#374151', muted: LIGHT_MUTED,
                    heading: color, chipBackground: tint(color, 0.85), chipText: color,
                    headerInSidebar: false, padding: 20,
                },
                skills: 'chips', chipBorder: color,
            };
        case 'developer':
            return {
                font: 'mono', header: 'code', nameSize: 17, headlineSize: 9, contactSize: 8,
                bodySize: 8.2, smallSize: 7.4, headingSize: 8.8, lineHeight: 1.5,
                text: '#D1D5DB', muted: '#8B949E', nameColor: color, headlineColor: '#E5E7EB',
                contactColor: '#FBBF24', headingColor: color, headingStyle: 'code',
                margin: 30, bottomMargin: 30, sectionGap: 12, entryGap: 7, bulletGap: 2.5,
                skills: 'inline', background: '#0D1117', dark: true,
            };
        case 'minimal-ats':
            return {
                font: 'sans', header: 'center', nameSize: 18, headlineSize: 9, contactSize: 8,
                bodySize: 8.7, smallSize: 7.8, headingSize: 8.2, lineHeight: 1.45,
                text: '#1F2937', muted: MUTED, nameColor: color, headlineColor: MUTED,
                contactColor: '#4B5563', headingColor: color, headingStyle: 'underline',
                uppercaseName: true, uppercaseHeadings: true, nameLetterSpacing: 1.2, headingLetterSpacing: 1,
                margin: 45, bottomMargin: 42, sectionGap: 11, entryGap: 7, bulletGap: 2.2,
                headerRule: 1.8, headerRuleColor: color, skills: 'inline',
            };
        case 'academic':
            return {
                font: 'serif', header: 'center', nameSize: 20, headlineSize: 9.4, contactSize: 8,
                bodySize: 8.8, smallSize: 8, headingSize: 8.5, lineHeight: 1.5,
                text: '#1F2937', muted: MUTED, nameColor: color, headlineColor: LIGHT_MUTED,
                contactColor: '#4B5563', headingColor: color, headingStyle: 'underline',
                uppercaseHeadings: true, headingLetterSpacing: 1, margin: 45, bottomMargin: 42,
                sectionGap: 12, entryGap: 7, bulletGap: 2.4, headerRule: 1.2, headerRuleColor: color,
                skills: 'inline', summaryItalic: true,
            };
        case 'executive':
            return {
                font: 'serif', header: 'band', nameSize: 22, headlineSize: 9, contactSize: 8,
                bodySize: 8.9, smallSize: 7.9, headingSize: 8.3, lineHeight: 1.55,
                text: '#1E293B', muted: '#6B7280', nameColor: WHITE, headlineColor: WHITE,
                contactColor: WHITE, headingColor: '#6B7280', headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1.3, margin: 46, bottomMargin: 44,
                sectionGap: 14, entryGap: 9, bulletGap: 2.6, headerBandHeight: 108,
                headerBandText: WHITE, headerBandMuted: WHITE, headerRule: 3,
                headerRuleColor: '#B8860B', skills: 'chips', chipBorder: color,
                entryDivider: true,
            };
        case 'two-column':
            return {
                font: 'sans', header: 'sidebar', nameSize: 19, headlineSize: 8.6, contactSize: 7.8,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8, lineHeight: 1.45,
                text: '#1F2937', muted: MUTED, nameColor: WHITE, headlineColor: WHITE,
                contactColor: WHITE, headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1, margin: 24, bottomMargin: 30,
                sectionGap: 11, entryGap: 7, bulletGap: 2.3, skills: 'bars',
                columns: {
                    widthPct: 0.38, background: color, text: WHITE, muted: '#FFFFFFCC',
                    heading: WHITE, chipBackground: '#FFFFFF33', chipText: WHITE,
                    headerInSidebar: true, padding: 22,
                },
                headerRule: 1, headerRuleColor: '#FFFFFF66',
            };
        case 'portfolio':
            return {
                font: 'sans', header: 'hero', nameSize: 22, headlineSize: 9.4, contactSize: 8,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8.2, lineHeight: 1.45,
                text: '#374151', muted: LIGHT_MUTED, nameColor: WHITE, headlineColor: WHITE,
                contactColor: '#6B7280', headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1.1, margin: 42, bottomMargin: 38,
                sectionGap: 13, entryGap: 8, bulletGap: 2.5, headerBandHeight: 104,
                headerBandText: WHITE, headerBandMuted: WHITE, contactStrip: '#F9FAFB',
                skills: 'chips', chipBorder: color, summaryBox: true, projectBadges: true,
                avatar: true,
            };
        case 'compact':
            return {
                font: 'sans', header: 'center', nameSize: 15, headlineSize: 8, contactSize: 7.2,
                bodySize: 7.8, smallSize: 6.9, headingSize: 7.3, lineHeight: 1.34,
                text: '#1F2937', muted: MUTED, nameColor: color, headlineColor: MUTED,
                contactColor: '#4B5563', headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, margin: 32, bottomMargin: 26, sectionGap: 4,
                entryGap: 2.5, bulletGap: 1.2, headerRule: 1.2, headerRuleColor: color,
                skills: 'inline',
            };
        case 'timeline':
            return {
                font: 'sans', header: 'center', nameSize: 21, headlineSize: 9, contactSize: 8,
                bodySize: 8.6, smallSize: 7.7, headingSize: 8.4, lineHeight: 1.45,
                text: '#374151', muted: MUTED, nameColor: INK, headlineColor: color,
                contactColor: '#4B5563', headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1, margin: 42, bottomMargin: 38,
                sectionGap: 13, entryGap: 8, bulletGap: 2.4, headerRule: 1, headerRuleColor: color,
                skills: 'chips', chipBorder: color, timeline: true,
            };
        case 'elegant':
            return {
                font: 'serif', header: 'center', nameSize: 17, headlineSize: 8.2, contactSize: 7.8,
                bodySize: 8.6, smallSize: 7.7, headingSize: 7.8, lineHeight: 1.65,
                text: '#57534E', muted: '#78716C', nameColor: color, headlineColor: '#A8A29E',
                contactColor: '#A8A29E', headingColor: color, headingStyle: 'center',
                uppercaseName: true, uppercaseHeadings: true, nameLetterSpacing: 3.2,
                headingLetterSpacing: 2.2, margin: 52, bottomMargin: 46, sectionGap: 16,
                entryGap: 9, bulletGap: 2, skills: 'inline', summaryItalic: true,
                centerBody: true,
            };
        case 'bold-header':
            return {
                font: 'sans', header: 'left', nameSize: 32, headlineSize: 11, contactSize: 8,
                bodySize: 8.8, smallSize: 7.8, headingSize: 9.4, lineHeight: 1.45,
                text: '#374151', muted: LIGHT_MUTED, nameColor: color, headlineColor: '#9CA3AF',
                contactColor: '#6B7280', headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, margin: 42, bottomMargin: 38, sectionGap: 13,
                entryGap: 8, bulletGap: 2.4, headerRule: 4, headerRuleColor: color,
                headerShortRule: true, skills: 'chips', chipBorder: color, entryBar: true,
            };
        case 'infographic':
            return {
                font: 'sans', header: 'sidebar', nameSize: 17, headlineSize: 8.2, contactSize: 7.5,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8.2, lineHeight: 1.45,
                text: '#1F2937', muted: MUTED, nameColor: WHITE, headlineColor: WHITE,
                contactColor: WHITE, headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1, margin: 26, bottomMargin: 30,
                sectionGap: 12, entryGap: 7, bulletGap: 2.4, skills: 'bars', avatar: true,
                columns: {
                    widthPct: 0.35, background: color, text: WHITE, muted: '#FFFFFFCC',
                    heading: WHITE, chipBackground: '#FFFFFF33', chipText: WHITE,
                    headerInSidebar: true, padding: 20,
                },
                headerRule: 1, headerRuleColor: '#FFFFFF66',
            };
        case 'corporate':
            return {
                font: 'sans', header: 'split', nameSize: 20, headlineSize: 8.6, contactSize: 7.6,
                bodySize: 8.9, smallSize: 7.9, headingSize: 8.7, lineHeight: 1.45,
                text: '#1E293B', muted: '#64748B', nameColor: color, headlineColor: '#64748B',
                contactColor: '#64748B', headingColor: color, headingStyle: 'underline',
                uppercaseHeadings: true, margin: 42, bottomMargin: 38, sectionGap: 12,
                entryGap: 7, bulletGap: 2.4, headerRule: 2.5, headerRuleColor: color,
                skills: 'chips', chipBorder: color, summaryBox: true,
            };
        case 'fresh':
            return {
                font: 'sans', header: 'fresh', nameSize: 20, headlineSize: 8.5, contactSize: 7.7,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8.3, lineHeight: 1.45,
                text: '#374151', muted: LIGHT_MUTED, nameColor: color, headlineColor: '#9CA3AF',
                contactColor: '#6B7280', headingColor: color, headingStyle: 'bar',
                uppercaseHeadings: true, headingLetterSpacing: 0.8, margin: 42,
                bottomMargin: 38, sectionGap: 12, entryGap: 7, bulletGap: 2.4,
                headerBandHeight: 112, headerBandText: WHITE, headerBandMuted: WHITE,
                skills: 'chips', chipBorder: color, summaryBox: true, avatar: true,
            };
        case 'modern':
        default:
            return {
                font: 'sans', header: 'left', nameSize: 22, headlineSize: 9.4, contactSize: 8,
                bodySize: 8.8, smallSize: 7.8, headingSize: 8.1, lineHeight: 1.42,
                text: '#374151', muted: LIGHT_MUTED, nameColor: INK, headlineColor: color,
                contactColor: '#6B7280', headingColor: color, headingStyle: 'plain',
                uppercaseHeadings: true, headingLetterSpacing: 1.1, margin: 30, bottomMargin: 32,
                sectionGap: 12, entryGap: 8, bulletGap: 2.4, headerRule: 2.2,
                headerRuleColor: color, skills: 'chips', chipBorder: tint(color, 0.25),
                columns: {
                    widthPct: 0.32, background: tint(color, 0.045), text: '#374151',
                    muted: LIGHT_MUTED, heading: color, chipBackground: WHITE,
                    chipText: '#374151', headerInSidebar: false, padding: 18,
                },
            };
    }
}

interface Area {
    zone: Zone;
    x: number;
    width: number;
}

interface PageState {
    page: PDFPage;
    yMain: number;
    ySide: number;
    index: number;
}

interface InlineContactOptions {
    x: number;
    yTop: number;
    width: number;
    size: number;
    color: string;
    align?: 'left' | 'center' | 'right';
    separator?: string;
    short?: boolean;
    after?: number;
}

interface InlineContactToken {
    text: string;
    href: string | null;
    width: number;
    first: boolean;
}

interface InlineContactPlacement {
    index: number;
    x: number;
    width: number;
    sep: boolean;
}

const SAFE_CHAR_MAP: Record<string, string> = {
    '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
    '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"',
    '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
    '\u2022': '-', '\u25AA': '-', '\u25CF': '-', '\u00B7': '-',
    '\u2026': '...', '\u20B9': 'Rs.', '\u2192': '->', '\u2190': '<-',
    '\u00A0': ' ', '\u2009': ' ', '\u202F': ' ',
};

/** Keep standard-font text encodable (WinAnsi) and stable across viewers. */
export function sanitizePdfText(text: string): string {
    return Array.from((text ?? '').normalize('NFC'))
        .map(char => {
            if (char === '\n' || char === '\t') return char;
            const code = char.codePointAt(0) ?? 0;
            if (code >= 0x20 && code <= 0x7E) return char;
            if (code >= 0xA0 && code <= 0xFF) return char;
            return SAFE_CHAR_MAP[char] ?? '';
        })
        .join('');
}

export function slugifyFilename(name: string, fallback = 'resume'): string {
    const safe = (name || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return safe || fallback;
}

class PdfWriter {
    readonly doc: PDFDocument;
    readonly theme: PdfTheme;
    private readonly pages: PageState[] = [];
    private currentIndex = 0;
    private current!: PageState;
    private readonly fonts: Record<'regular' | 'bold' | 'italic' | 'boldItalic', PDFFont>;

    constructor(doc: PDFDocument, theme: PdfTheme, fonts: PdfWriter['fonts']) {
        this.doc = doc;
        this.theme = theme;
        this.fonts = fonts;
        this.newPage();
    }

    get pageCount(): number {
        return this.pages.length;
    }

    get pageIndex(): number {
        return this.currentIndex;
    }

    get sideColumnWidth(): number {
        return this.theme.columns ? A4_WIDTH_PT * this.theme.columns.widthPct : 0;
    }

    get mainArea(): Area {
        const columns = this.theme.columns;
        if (!columns) {
            return { zone: 'main', x: this.theme.margin, width: A4_WIDTH_PT - this.theme.margin * 2 };
        }
        const x = this.sideColumnWidth + this.theme.margin;
        return { zone: 'main', x, width: A4_WIDTH_PT - x - this.theme.margin };
    }

    get sideArea(): Area {
        const columns = this.theme.columns;
        if (!columns) return this.mainArea;
        return {
            zone: 'sidebar',
            x: columns.padding,
            width: this.sideColumnWidth - columns.padding * 2,
        };
    }

    get currentY(): number {
        return this.current.yMain;
    }

    get activePage(): PDFPage {
        return this.current.page;
    }

    newPage(): void {
        const page = this.doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
        const index = this.pages.length;
        const state: PageState = {
            page,
            yMain: this.theme.margin,
            ySide: this.theme.margin,
            index,
        };
        this.pages.push(state);
        this.currentIndex = index;
        this.current = state;

        if (this.theme.background) {
            page.drawRectangle({
                x: 0,
                y: 0,
                width: A4_WIDTH_PT,
                height: A4_HEIGHT_PT,
                color: hexToRgb(this.theme.background),
            });
        }

        // Later pages have no header, so a full-height sidebar is correct.
        if (index > 0 && this.theme.columns) {
            this.drawSidebarBackground(page, 0);
        }
    }

    /**
     * Move to the next page. If the other column already created it while
     * flowing its own content, reuse that page instead of appending a new one.
     */
    private advancePage(): void {
        const next = this.currentIndex + 1;
        if (next < this.pages.length) {
            this.currentIndex = next;
            this.current = this.pages[next];
        } else {
            this.newPage();
        }
        this.current.yMain = this.theme.margin;
        this.current.ySide = this.theme.margin;
    }

    /** Position a column on a page. Used to render the sidebar before the main column. */
    startZone(zone: Zone, yTop: number, pageIndex = 0): void {
        const index = Math.max(0, Math.min(pageIndex, this.pages.length - 1));
        this.currentIndex = index;
        this.current = this.pages[index];
        this.setY(zone, yTop);
    }

    beginColumns(headerBottom: number): void {
        const columns = this.theme.columns;
        if (!columns) return;

        if (columns.headerInSidebar) {
            // The header itself lives in the sidebar, so the colour starts at
            // y=0. Its background was painted by drawHeader *before* the
            // header text, and drawHeader already advanced ySide below the
            // contacts — keep that cursor instead of resetting it.
            this.current.yMain = this.theme.margin;
        } else {
            this.current.yMain = headerBottom + 12;
            this.current.ySide = headerBottom + 12;
            this.drawSidebarBackground(this.current.page, headerBottom);
        }
    }

    private drawSidebarBackground(page: PDFPage, fromTop: number): void {
        const columns = this.theme.columns;
        if (!columns) return;
        page.drawRectangle({
            x: 0,
            y: 0,
            width: this.sideColumnWidth,
            height: A4_HEIGHT_PT - fromTop,
            color: hexToRgb(columns.background),
        });
    }

    private y(zone: Zone): number {
        return zone === 'sidebar' ? this.current.ySide : this.current.yMain;
    }

    private setY(zone: Zone, value: number): void {
        if (zone === 'sidebar') this.current.ySide = value;
        else this.current.yMain = value;
    }

    currentYFor(zone: Zone): number {
        return this.y(zone);
    }

    advance(zone: Zone, height: number): void {
        this.setY(zone, this.y(zone) + height);
    }

    ensure(zone: Zone, height: number): void {
        if (this.y(zone) + height > A4_HEIGHT_PT - this.theme.bottomMargin) {
            this.advancePage();
        }
    }

    font(weight: 'regular' | 'bold' | 'italic' | 'boldItalic' = 'regular'): PDFFont {
        return this.fonts[weight];
    }

    fontSizeFor(weight: 'regular' | 'bold' | 'italic' | 'boldItalic'): PDFFont {
        return this.fonts[weight];
    }

    wrap(text: string, font: PDFFont, size: number, width: number): string[] {
        const safe = sanitizePdfText(text).replace(/\r/g, '');
        const lines: string[] = [];
        for (const rawLine of safe.split('\n')) {
            if (!rawLine.trim()) {
                lines.push('');
                continue;
            }
            const words = rawLine.split(/\s+/).filter(Boolean);
            let line = '';
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= width) {
                    line = candidate;
                    continue;
                }
                if (line) lines.push(line);
                if (font.widthOfTextAtSize(word, size) <= width) {
                    line = word;
                    continue;
                }
                // Long URL / token: split by character so it never overflows.
                let chunk = '';
                for (const char of word) {
                    if (font.widthOfTextAtSize(chunk + char, size) > width && chunk) {
                        lines.push(chunk);
                        chunk = char;
                    } else {
                        chunk += char;
                    }
                }
                line = chunk;
            }
            if (line || words.length === 0) lines.push(line);
        }
        return lines.length > 0 ? lines : [''];
    }

    drawText(
        text: string,
        x: number,
        yTop: number,
        font: PDFFont,
        size: number,
        color: string,
        options: { letterSpacing?: number; align?: 'left' | 'center' | 'right'; width?: number } = {},
    ): number {
        const safe = sanitizePdfText(text);
        if (!safe) return 0;
        const letterSpacing = options.letterSpacing ?? 0;
        const measured = font.widthOfTextAtSize(safe, size) + letterSpacing * Math.max(0, safe.length - 1);
        let drawX = x;
        if (options.align === 'center' && options.width) drawX = x + (options.width - measured) / 2;
        if (options.align === 'right' && options.width) drawX = x + options.width - measured;
        const baselineY = A4_HEIGHT_PT - yTop - size;
        const textColor = hexToRgb(color);
        if (letterSpacing > 0) {
            let cursor = drawX;
            for (const char of safe) {
                this.current.page.drawText(char, {
                    x: cursor,
                    y: baselineY,
                    font,
                    size,
                    color: textColor,
                });
                cursor += font.widthOfTextAtSize(char, size) + letterSpacing;
            }
        } else {
            this.current.page.drawText(safe, {
                x: drawX,
                y: baselineY,
                font,
                size,
                color: textColor,
            });
        }
        return measured;
    }

    line(x1: number, yTop: number, x2: number, thickness: number, color: string): void {
        this.current.page.drawLine({
            start: { x: x1, y: A4_HEIGHT_PT - yTop },
            end: { x: x2, y: A4_HEIGHT_PT - yTop },
            thickness,
            color: hexToRgb(color),
        });
    }

    rect(x: number, yTop: number, width: number, height: number, color: string): void {
        this.current.page.drawRectangle({
            x,
            y: A4_HEIGHT_PT - yTop - height,
            width,
            height,
            color: hexToRgb(color),
            borderWidth: 0,
        });
    }

    vline(x: number, yTopStart: number, yTopEnd: number, thickness: number, color: string): void {
        this.current.page.drawLine({
            start: { x, y: A4_HEIGHT_PT - yTopStart },
            end: { x, y: A4_HEIGHT_PT - yTopEnd },
            thickness,
            color: hexToRgb(color),
        });
    }

    circle(
        x: number,
        yTop: number,
        size: number,
        color: string,
        options: { borderColor?: string; borderWidth?: number } = {},
    ): void {
        this.current.page.drawCircle({
            x,
            y: A4_HEIGHT_PT - yTop,
            size,
            color: hexToRgb(color),
            borderColor: options.borderColor ? hexToRgb(options.borderColor) : undefined,
            borderWidth: options.borderWidth ?? 0,
        });
    }

    addLink(x: number, yTop: number, width: number, height: number, href: string): void {
        if (!href) return;
        const y = A4_HEIGHT_PT - yTop - height;
        const annotation = this.doc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [x, y, x + width, y + height],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
        });
        this.current.page.node.addAnnot(this.doc.context.register(annotation));
    }

    paragraph(
        area: Area,
        text: string,
        options: {
            size?: number;
            color?: string;
            weight?: 'regular' | 'bold' | 'italic' | 'boldItalic';
            lineHeight?: number;
            align?: 'left' | 'center' | 'right';
            after?: number;
            width?: number;
            xOffset?: number;
        } = {},
    ): void {
        const size = options.size ?? this.theme.bodySize;
        const font = this.font(options.weight ?? 'regular');
        const color = options.color ?? this.theme.text;
        const lineHeight = size * (options.lineHeight ?? this.theme.lineHeight);
        const width = options.width ?? area.width;
        const x = area.x + (options.xOffset ?? 0);

        for (const line of this.wrap(text, font, size, width)) {
            this.ensure(area.zone, lineHeight);
            if (line) {
                this.drawText(line, x, this.y(area.zone), font, size, color, {
                    align: options.align,
                    width,
                });
            }
            this.setY(area.zone, this.y(area.zone) + lineHeight);
        }
        this.setY(area.zone, this.y(area.zone) + (options.after ?? 0));
    }

    bullet(area: Area, text: string, color: string, indent = 11): void {
        const size = this.theme.bodySize;
        const lineHeight = size * this.theme.lineHeight;
        const font = this.font();
        const width = area.width - indent;
        const columns = area.zone === 'sidebar' ? this.theme.columns : undefined;
        const textColor = columns?.text ?? this.theme.text;
        const lines = this.wrap(text, font, size, width).filter(line => line !== '');
        // Avoid leaving a single bullet line stranded at the top of a page.
        if (lines.length > 1) this.ensure(area.zone, lineHeight * 2);
        for (let i = 0; i < lines.length; i++) {
            this.ensure(area.zone, lineHeight);
            const y = this.y(area.zone);
            if (i === 0) {
                this.current.page.drawCircle({
                    x: area.x + 2.6,
                    y: A4_HEIGHT_PT - y - size * 0.62,
                    size: 1.1,
                    color: hexToRgb(color),
                });
            }
            this.drawText(lines[i], area.x + indent, y, font, size, textColor);
            this.setY(area.zone, y + lineHeight);
        }
    }

    chips(
        area: Area,
        values: string[],
        colors: { background: string; text: string; border?: string; opacity?: number },
    ): void {
        const size = this.theme.smallSize;
        const font = this.font('bold');
        const padX = 4.5;
        const padY = 2.6;
        const lineHeight = size + padY * 2 + 2;
        let x = area.x;
        let y = this.y(area.zone);

        // A single long skill must not draw past the column: split it into
        // additional chips rather than clipping or shrinking the text.
        const chipValues = values.flatMap(value => {
            const chunks = this.wrap(value, font, size, Math.max(24, area.width - padX * 2)).filter(Boolean);
            return chunks.length > 0 ? chunks : [value];
        });

        for (const value of chipValues) {
            const text = sanitizePdfText(value);
            const width = Math.min(area.width, font.widthOfTextAtSize(text, size) + padX * 2);
            if (x + width > area.x + area.width && x > area.x) {
                x = area.x;
                y += lineHeight;
            }
            const yBeforePageCheck = this.y(area.zone);
            this.ensure(area.zone, lineHeight);
            if (this.y(area.zone) !== yBeforePageCheck) {
                // The chip wrapped onto a new page: restart at its top margin.
                y = this.y(area.zone);
                x = area.x;
            }
            this.current.page.drawRectangle({
                x,
                y: A4_HEIGHT_PT - y - lineHeight + 2,
                width,
                height: lineHeight - 2,
                color: hexToRgb(colors.background),
                opacity: colors.opacity ?? 1,
                borderColor: colors.border ? hexToRgb(colors.border) : undefined,
                borderWidth: colors.border ? 0.5 : 0,
            });
            this.current.page.drawText(text, {
                x: x + padX,
                y: A4_HEIGHT_PT - y - lineHeight + 2 + padY + 1,
                font,
                size,
                color: hexToRgb(colors.text),
            });
            x += width + 4;
        }
        this.setY(area.zone, y + lineHeight + 2);
    }

    private inlineContactLayout(
        contacts: ResumeDocumentContact[],
        options: InlineContactOptions,
    ): {
        lines: InlineContactPlacement[][];
        lineHeight: number;
        tokens: InlineContactToken[];
        separatorWidth: number;
        gap: number;
    } {
        const font = this.font();
        const separator = options.separator ?? '';
        const size = options.size;
        const gap = separator ? 5 : 10;
        const lineHeight = size * 1.55;

        // Split over-long values (long e-mail addresses, URLs) so a single
        // contact can never draw outside the column.
        const tokens: InlineContactToken[] = [];
        for (const contact of contacts) {
            const text = sanitizePdfText(options.short ? contact.shortLabel : contact.label);
            const chunks = this.wrap(text, font, size, options.width);
            chunks.forEach((chunk, index) => {
                tokens.push({
                    text: chunk,
                    href: contact.href,
                    width: font.widthOfTextAtSize(chunk, size),
                    first: index === 0,
                });
            });
        }
        const separatorWidth = separator ? font.widthOfTextAtSize(separator, size) : 0;

        const lines: InlineContactPlacement[][] = [];
        let line: InlineContactPlacement[] = [];
        let lineWidth = 0;
        tokens.forEach((token, index) => {
            const leadsWithSeparator = line.length > 0 && token.first;
            const added = (leadsWithSeparator ? gap + separatorWidth : line.length > 0 ? gap : 0) + token.width;
            if (line.length > 0 && lineWidth + added > options.width) {
                lines.push(line);
                line = [];
                lineWidth = 0;
            }
            const sep = line.length > 0 && token.first;
            const x = lineWidth + (line.length > 0 ? gap : 0);
            line.push({ index, x: x + (sep ? separatorWidth : 0), width: token.width, sep });
            lineWidth = x + (sep ? separatorWidth : 0) + token.width;
        });
        if (line.length > 0) lines.push(line);

        return { lines, lineHeight, tokens, separatorWidth, gap };
    }

    contactsInlineHeight(contacts: ResumeDocumentContact[], options: InlineContactOptions): number {
        const { lines, lineHeight } = this.inlineContactLayout(contacts, options);
        return lines.length * lineHeight + (options.after ?? 0);
    }

    contactsInline(contacts: ResumeDocumentContact[], options: InlineContactOptions): number {
        const font = this.font();
        const { lines, lineHeight, tokens, separatorWidth, gap } = this.inlineContactLayout(contacts, options);
        const separator = options.separator ?? '';
        const size = options.size;

        let y = options.yTop;
        let pageIndex = this.pageIndex;
        for (const currentLine of lines) {
            this.ensure('main', lineHeight);
            if (this.pageIndex !== pageIndex) {
                pageIndex = this.pageIndex;
                y = this.y('main');
            }
            const totalWidth = currentLine.length > 0
                ? currentLine[currentLine.length - 1].x + currentLine[currentLine.length - 1].width
                : 0;
            let offset = 0;
            if (options.align === 'center') offset = (options.width - totalWidth) / 2;
            if (options.align === 'right') offset = options.width - totalWidth;
            let cursor = options.x + offset;
            for (const item of currentLine) {
                if (item.sep && separator) {
                    this.current.page.drawText(separator, {
                        x: cursor,
                        y: A4_HEIGHT_PT - y - size,
                        font,
                        size,
                        color: hexToRgb(this.theme.dark ? '#6B7280' : '#9CA3AF'),
                    });
                    cursor += separatorWidth + gap;
                }
                const token = tokens[item.index];
                this.current.page.drawText(token.text, {
                    x: cursor,
                    y: A4_HEIGHT_PT - y - size,
                    font,
                    size,
                    color: hexToRgb(options.color),
                });
                if (token.href) this.addLink(cursor, y, item.width, lineHeight, token.href);
                cursor += item.width + gap;
            }
            y += lineHeight;
        }
        return y - options.yTop + (options.after ?? 0);
    }

    contactsStack(
        contacts: ResumeDocumentContact[],
        options: { x: number; yTop: number; width: number; size: number; color: string; gap?: number; short?: boolean; zone?: Zone },
    ): number {
        const font = this.font();
        const lineHeight = options.size * 1.55;
        const gap = options.gap ?? 1;
        const zone = options.zone ?? 'sidebar';
        let y = options.yTop;
        let pageIndex = this.pageIndex;
        for (const contact of contacts) {
            const text = sanitizePdfText(options.short ? contact.shortLabel : contact.label);
            const lines = this.wrap(text, font, options.size, options.width).filter(Boolean);
            for (const line of lines.length > 0 ? lines : [text]) {
                this.ensure(zone, lineHeight);
                if (this.pageIndex !== pageIndex) {
                    pageIndex = this.pageIndex;
                    y = this.y(zone);
                }
                const width = font.widthOfTextAtSize(line, options.size);
                this.current.page.drawText(line, {
                    x: options.x,
                    y: A4_HEIGHT_PT - y - options.size,
                    font,
                    size: options.size,
                    color: hexToRgb(options.color),
                });
                if (contact.href) this.addLink(options.x, y, Math.min(width, options.width), lineHeight, contact.href);
                y += lineHeight;
            }
            y += gap;
        }
        return y - options.yTop;
    }

    contactsStackHeight(
        contacts: ResumeDocumentContact[],
        options: { width: number; size: number; gap?: number; short?: boolean },
    ): number {
        const font = this.font();
        const lineHeight = options.size * 1.55;
        const gap = options.gap ?? 1;
        let height = 0;
        for (const contact of contacts) {
            const text = sanitizePdfText(options.short ? contact.shortLabel : contact.label);
            const lines = this.wrap(text, font, options.size, options.width).filter(Boolean);
            height += Math.max(1, lines.length) * lineHeight + gap;
        }
        return height;
    }
}

/* ────────────────────────────── Header ────────────────────────────── */

function drawHeader(writer: PdfWriter, model: ResumeDocumentModel): number {
    const theme = writer.theme;
    const page = writer.activePage;
    const accent = theme.columns?.background && theme.header === 'sidebar'
        ? theme.columns.background
        : theme.headerRuleColor || model.accentColor;
    const contacts = model.contacts;
    const top = theme.margin;

    const drawName = (x: number, y: number, color: string, width: number, align?: 'left' | 'center' | 'right') => {
        const lines = writer.wrap(model.name, writer.font('bold'), theme.nameSize, width);
        lines.forEach((line, index) => {
            writer.drawText(line, x, y + index * theme.nameSize * 1.15, writer.font('bold'), theme.nameSize, color, {
                letterSpacing: theme.nameLetterSpacing ?? 0,
                align,
                width,
            });
        });
        return y + lines.length * theme.nameSize * 1.15;
    };

    const drawHeadline = (
        x: number,
        y: number,
        width: number,
        color: string,
        align?: 'left' | 'center' | 'right',
        letterSpacing = 0,
        text: string = model.headline,
    ) => {
        if (!text) return y;
        const lines = writer.wrap(text, writer.font(), theme.headlineSize, width);
        lines.forEach((line, index) => {
            writer.drawText(line, x, y + index * theme.headlineSize * 1.4, writer.font(), theme.headlineSize, color, {
                letterSpacing,
                align,
                width,
            });
        });
        return y + lines.length * theme.headlineSize * 1.4;
    };

    if (theme.header === 'band' || theme.header === 'hero') {
        let textX = theme.margin;
        if (theme.header === 'hero' && theme.avatar) textX += 46 + 16;

        const textWidth = A4_WIDTH_PT - textX - theme.margin;
        const contactsInBand = !theme.contactStrip;
        const bandContactHeight = contactsInBand
            ? writer.contactsInlineHeight(contacts, {
                x: textX,
                yTop: 0,
                width: textWidth,
                size: theme.contactSize,
                color: theme.headerBandMuted ?? WHITE,
                separator: '•',
                short: true,
            })
            : 0;
        const stripContactHeight = theme.contactStrip
            ? writer.contactsInlineHeight(contacts, {
                x: theme.margin,
                yTop: 0,
                width: A4_WIDTH_PT - theme.margin * 2,
                size: theme.contactSize,
                color: '#6B7280',
                separator: '•',
                short: true,
            })
            : 0;
        const stripHeight = theme.contactStrip ? Math.max(26, stripContactHeight + 12) : 0;
        const nameLineCount = Math.max(
            1,
            writer.wrap(model.name || ' ', writer.font('bold'), theme.nameSize, textWidth).length,
        );
        const headlineLineCount = model.headline
            ? writer.wrap(model.headline, writer.font(), theme.headlineSize, textWidth).length
            : 0;
        const headlineBlock = model.headline ? 1 + headlineLineCount * theme.headlineSize * 1.4 : 0;
        const contentHeight = top + 2 + nameLineCount * theme.nameSize * 1.15 + headlineBlock + 7
            + (contactsInBand ? bandContactHeight + 4 : 0);
        const height = Math.max(theme.headerBandHeight ?? 106, contentHeight);
        // A band with a body sidebar (Creative) still uses the accent colour;
        // only a header that actually lives inside the sidebar uses its tint.
        const bandColor = theme.columns?.headerInSidebar ? theme.columns.background : accent;

        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - height,
            width: A4_WIDTH_PT,
            height,
            color: hexToRgb(bandColor),
        });
        // Soft second band gives the flat PDF a hint of the template gradient.
        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - height,
            width: A4_WIDTH_PT,
            height: 5,
            color: hexToRgb(tint(bandColor, 0.7)),
        });

        if (theme.header === 'hero' && theme.avatar) {
            const avatar = 46;
            page.drawRectangle({
                x: theme.margin,
                y: A4_HEIGHT_PT - top - avatar,
                width: avatar,
                height: avatar,
                color: hexToRgb(WHITE),
                borderColor: hexToRgb('#FFFFFFAA'),
                borderWidth: 1,
            });
            writer.drawText(
                (model.name || 'U').charAt(0).toUpperCase(),
                theme.margin,
                top + 10,
                writer.font('bold'),
                22,
                accent,
                { align: 'center', width: avatar },
            );
        }

        let y = top + 2;
        y = drawName(textX, y, theme.headerBandText ?? WHITE, textWidth);
        y = drawHeadline(
            textX,
            y + 1,
            textWidth,
            theme.headerBandMuted ?? WHITE,
            undefined,
            theme.headlineLetterSpacing ?? 0,
        );
        if (contactsInBand && contacts.length > 0) {
            writer.contactsInline(contacts, {
                x: textX,
                yTop: y + 5,
                width: textWidth,
                size: theme.contactSize,
                color: theme.headerBandMuted ?? WHITE,
                separator: '•',
                short: true,
            });
        }
        y = height;

        if (theme.headerRule) {
            writer.rect(0, y, A4_WIDTH_PT, theme.headerRule, theme.headerRuleColor ?? '#B8860B');
            y += theme.headerRule;
        }

        if (theme.contactStrip && contacts.length > 0) {
            page.drawRectangle({
                x: 0,
                y: A4_HEIGHT_PT - y - stripHeight,
                width: A4_WIDTH_PT,
                height: stripHeight,
                color: hexToRgb(theme.contactStrip),
            });
            writer.contactsInline(contacts, {
                x: theme.margin,
                yTop: y + 6,
                width: A4_WIDTH_PT - theme.margin * 2,
                size: theme.contactSize,
                color: '#6B7280',
                separator: '•',
                short: true,
            });
            y += stripHeight;
        }

        return y;
    }

    if (theme.header === 'split') {
        const rightWidth = A4_WIDTH_PT * 0.38;
        const rightX = A4_WIDTH_PT - theme.margin - rightWidth;
        const leftWidth = rightX - theme.margin - 16;
        const nameLineCount = Math.max(
            1,
            writer.wrap(model.name || ' ', writer.font('bold'), theme.nameSize, leftWidth).length,
        );
        const headlineLineCount = model.headline
            ? writer.wrap(model.headline, writer.font(), theme.headlineSize, leftWidth).length
            : 0;
        const leftHeight = top + nameLineCount * theme.nameSize * 1.15
            + (model.headline ? 1 + headlineLineCount * theme.headlineSize * 1.4 : 0);
        const contactHeight = writer.contactsStackHeight(contacts, {
            width: rightWidth,
            size: theme.contactSize,
            short: true,
        });
        const height = Math.max(74, leftHeight + 4, contactHeight + top * 2 + 6);
        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - height,
            width: A4_WIDTH_PT,
            height,
            color: hexToRgb(tint(accent, 0.04)),
        });
        if (theme.headerRule) {
            page.drawRectangle({
                x: 0,
                y: A4_HEIGHT_PT - height,
                width: A4_WIDTH_PT,
                height: theme.headerRule,
                color: hexToRgb(theme.headerRuleColor ?? accent),
            });
        }
        let y = top;
        y = drawName(theme.margin, y, theme.nameColor, leftWidth);
        y = drawHeadline(theme.margin, y + 1, leftWidth, theme.headlineColor);
        writer.contactsStack(contacts, {
            x: rightX,
            yTop: top + 2,
            width: rightWidth,
            size: theme.contactSize,
            color: theme.contactColor,
            short: true,
            zone: 'main',
        });
        return Math.max(y, height) + 2;
    }

    if (theme.header === 'sidebar') {
        // Paint the coloured column before the text so the header remains
        // visible (beginColumns no longer paints over it).
        page.drawRectangle({
            x: 0,
            y: 0,
            width: writer.sideColumnWidth,
            height: A4_HEIGHT_PT,
            color: hexToRgb(theme.columns!.background),
        });
        let y = top;
        if (theme.avatar) {
            const avatar = 48;
            page.drawCircle({
                x: theme.columns!.padding + avatar / 2,
                y: A4_HEIGHT_PT - top - avatar / 2,
                size: avatar / 2,
                color: hexToRgb(WHITE),
                borderColor: hexToRgb('#FFFFFFAA'),
                borderWidth: 1,
            });
            writer.drawText(
                (model.name || 'U').charAt(0).toUpperCase(),
                theme.columns!.padding,
                top + 12,
                writer.font('bold'),
                21,
                accent,
                { align: 'center', width: avatar },
            );
            y += avatar + 14;
        }
        y = drawName(theme.columns!.padding, y, theme.nameColor, writer.sideArea.width);
        y = drawHeadline(theme.columns!.padding, y + 1, writer.sideArea.width, theme.headlineColor);
        y += 6;
        y += writer.contactsStack(contacts, {
            x: theme.columns!.padding,
            yTop: y,
            width: writer.sideArea.width,
            size: theme.contactSize,
            color: theme.contactColor,
            short: true,
        });
        if (theme.headerRule) {
            writer.line(theme.columns!.padding, y + 8, writer.sideColumnWidth - theme.columns!.padding, theme.headerRule, theme.headerRuleColor ?? '#FFFFFF66');
            y += theme.headerRule + 10;
        }
        writer.startZone('sidebar', y + 8, writer.pageIndex);
        return y;
    }

    if (theme.header === 'fresh') {
        const avatar = 40;
        const nameWidth = A4_WIDTH_PT - theme.margin * 2 - avatar - 14;
        const location = contacts.find(contact => contact.kind === 'location');
        const headline = [model.headline, location?.label].filter(Boolean).join(' · ');
        const inlineContacts = contacts.filter(contact => contact.kind !== 'location');
        const contactHeight = writer.contactsInlineHeight(inlineContacts, {
            x: theme.margin,
            yTop: 0,
            width: A4_WIDTH_PT - theme.margin * 2,
            size: theme.contactSize,
            color: theme.contactColor,
            separator: '•',
            short: true,
        });
        const nameLineCount = Math.max(
            1,
            writer.wrap(model.name || ' ', writer.font('bold'), theme.nameSize, nameWidth).length,
        );
        const headlineLineCount = headline
            ? writer.wrap(headline, writer.font(), theme.headlineSize, nameWidth).length
            : 0;
        const textBlock = top + 1 + nameLineCount * theme.nameSize * 1.15
            + (headline ? 1 + headlineLineCount * theme.headlineSize * 1.4 : 0);
        const contentHeight = Math.max(textBlock, top + avatar + 8, theme.margin)
            + 6 + contactHeight + 8;
        const height = Math.max(theme.headerBandHeight ?? 112, contentHeight);

        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - height,
            width: A4_WIDTH_PT,
            height,
            color: hexToRgb(tint(accent, 0.07)),
        });
        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - height,
            width: A4_WIDTH_PT,
            height: 4,
            color: hexToRgb(tint(accent, 0.55)),
        });
        page.drawRectangle({
            x: theme.margin,
            y: A4_HEIGHT_PT - top - avatar,
            width: avatar,
            height: avatar,
            color: hexToRgb(accent),
        });
        writer.drawText((model.name || 'U').charAt(0).toUpperCase(), theme.margin, top + 10, writer.font('bold'), 20, WHITE, {
            align: 'center',
            width: avatar,
        });
        let y = top + 1;
        y = drawName(theme.margin + avatar + 14, y, theme.nameColor, nameWidth);
        y = drawHeadline(
            theme.margin + avatar + 14,
            y + 1,
            nameWidth,
            theme.headlineColor,
            undefined,
            0,
            headline,
        );
        y = Math.max(y + 4, top + avatar + 8);
        writer.contactsInline(inlineContacts, {
            x: theme.margin,
            yTop: y,
            width: A4_WIDTH_PT - theme.margin * 2,
            size: theme.contactSize,
            color: theme.contactColor,
            separator: '•',
            short: true,
        });
        return height;
    }

    if (theme.header === 'code') {
        // Terminal chrome.
        const chrome = 24;
        page.drawRectangle({
            x: 0,
            y: A4_HEIGHT_PT - chrome,
            width: A4_WIDTH_PT,
            height: chrome,
            color: hexToRgb('#161B22'),
        });
        [ '#EF4444', '#F59E0B', '#22C55E' ].forEach((dot, index) => {
            page.drawCircle({
                x: theme.margin + 4 + index * 12,
                y: A4_HEIGHT_PT - chrome / 2,
                size: 3,
                color: hexToRgb(dot),
            });
        });
        writer.drawText(
            `${slugifyFilename(model.name, 'resume').toLowerCase()}_resume.ts — Terminal`,
            theme.margin + 46,
            6,
            writer.font(),
            7,
            '#8B949E',
        );

        let y = chrome + 14;
        const x = theme.margin;
        writer.drawText('const', x, y, writer.font('bold'), theme.bodySize, '#C084FC');
        writer.drawText('developer', x + 34, y, writer.font('bold'), theme.bodySize, model.accentColor);
        writer.drawText('= {', x + 94, y, writer.font(), theme.bodySize, theme.text);
        y += theme.bodySize * 1.7;

        const fields: Array<[string, string]> = [['name', model.name], ['role', model.headline]];
        for (const contact of contacts) {
            fields.push([contact.kind, contact.label]);
        }
        const codeFont = writer.font();
        const valueLineHeight = theme.bodySize * 1.45;
        for (const [key, value] of fields) {
            if (!value) continue;
            const safeKey = sanitizePdfText(key);
            const keyWidth = codeFont.widthOfTextAtSize(safeKey, theme.bodySize);
            const colonX = x + 18 + keyWidth + 4;
            const valueX = colonX + 8;
            const text = `"${sanitizePdfText(value)}",`;
            const lines = writer.wrap(text, codeFont, theme.bodySize, A4_WIDTH_PT - theme.margin - valueX);
            writer.drawText(safeKey, x + 18, y, codeFont, theme.bodySize, '#60A5FA');
            writer.drawText(':', colonX, y, codeFont, theme.bodySize, theme.text);
            const contact = contacts.find(item => item.kind === key);
            lines.forEach((line, index) => {
                const lineY = y + index * valueLineHeight;
                writer.drawText(line, valueX, lineY, codeFont, theme.bodySize, '#FCD34D');
                if (contact?.href) {
                    writer.addLink(
                        valueX,
                        lineY - 1,
                        codeFont.widthOfTextAtSize(line, theme.bodySize),
                        theme.bodySize * 1.4,
                        contact.href,
                    );
                }
            });
            y += lines.length * valueLineHeight + theme.bodySize * 0.2;
        }
        writer.drawText('};', x, y, writer.font(), theme.bodySize, theme.text);
        y += theme.bodySize * 2;
        return y;
    }

    // left / center
    const isCenter = theme.header === 'center';
    let y = top;
    y = drawName(isCenter ? theme.margin : theme.margin, y, theme.nameColor, A4_WIDTH_PT - theme.margin * 2, isCenter ? 'center' : 'left');
    y = drawHeadline(
        theme.margin,
        y + 1,
        A4_WIDTH_PT - theme.margin * 2,
        theme.headlineColor,
        isCenter ? 'center' : 'left',
        theme.headlineLetterSpacing ?? 0.4,
    );
    y += 5;
    y += writer.contactsInline(contacts, {
        x: theme.margin,
        yTop: y,
        width: A4_WIDTH_PT - theme.margin * 2,
        size: theme.contactSize,
        color: theme.contactColor,
        align: isCenter ? 'center' : 'left',
        separator: isCenter ? '•' : '•',
        short: true,
    });
    if (theme.headerRule) {
        const ruleWidth = theme.headerShortRule ? 54 : A4_WIDTH_PT - theme.margin * 2;
        writer.line(theme.margin, y + 9, theme.margin + ruleWidth, theme.headerRule, theme.headerRuleColor ?? accent);
        y += theme.headerRule + 12;
    } else {
        y += 6;
    }
    return y;
}

/* ───────────────────────────── Sections ───────────────────────────── */

function headingText(section: ResumeDocumentSection, theme: PdfTheme): string {
    if (theme.headingStyle === 'code') {
        if (section.kind === 'summary') return '/** Summary */';
        if (section.kind === 'skills') return 'const techStack = {';
        if (section.kind === 'custom') {
            return `const ${slugifyFilename(section.heading, 'custom').toLowerCase()} = {`;
        }
        return `const ${section.kind} = [`;
    }
    return theme.uppercaseHeadings ? section.heading.toUpperCase() : section.heading;
}

function drawSectionHeading(writer: PdfWriter, section: ResumeDocumentSection, area: Area): boolean {
    const theme = writer.theme;
    if (!section.heading) return false;
    const text = headingText(section, theme);
    if (!text) return false;
    const size = theme.headingSize;
    const height = size * 1.7 + 8;
    const headingColor = area.zone === 'sidebar' && theme.columns
        ? theme.columns.heading
        : theme.headingColor;
    // Keep the heading together with the first couple of body lines instead
    // of stranding it at the bottom of a page.
    writer.ensure(area.zone, height + theme.bodySize * theme.lineHeight * 1.5);

    const y = writer.currentYFor(area.zone);
    if (theme.headingStyle === 'underline') {
        writer.drawText(text, area.x, y, writer.font('bold'), size, headingColor, {
            letterSpacing: theme.headingLetterSpacing ?? 0,
        });
        writer.line(area.x, y + size + 3, area.x + area.width, 0.7, headingColor);
    } else if (theme.headingStyle === 'center') {
        writer.drawText(text, area.x, y, writer.font(), size, headingColor, {
            letterSpacing: theme.headingLetterSpacing ?? 0,
            align: 'center',
            width: area.width,
        });
        writer.line(area.x + area.width * 0.42, y + size + 4, area.x + area.width * 0.58, 0.6, headingColor);
    } else if (theme.headingStyle === 'bar') {
        writer.rect(area.x, y + size * 0.45, 16, 2, headingColor);
        writer.drawText(text, area.x + 22, y, writer.font('bold'), size, headingColor, {
            letterSpacing: theme.headingLetterSpacing ?? 0,
        });
    } else if (theme.headingStyle === 'leftbar') {
        writer.rect(area.x, y, 2.5, size * 1.15, headingColor);
        writer.drawText(text, area.x + 8, y, writer.font('bold'), size, headingColor);
    } else {
        writer.drawText(text, area.x, y, writer.font(theme.headingStyle === 'code' ? 'bold' : 'bold'), size, headingColor, {
            letterSpacing: theme.headingLetterSpacing ?? 0,
        });
    }
    writer.advance(area.zone, height);
    return true;
}

function drawSummary(writer: PdfWriter, section: ResumeDocumentSection, area: Area): void {
    const theme = writer.theme;
    const columns = area.zone === 'sidebar' ? theme.columns : undefined;
    const bodyColor = columns?.text ?? theme.text;
    if (theme.summaryBox) {
        const y = writer.currentYFor(area.zone);
        const lines = writer.wrap(section.paragraphs?.join(' ') ?? '', writer.font(), theme.bodySize, area.width - 18);
        const boxHeight = lines.length * theme.bodySize * theme.lineHeight + 14;
        writer.ensure(area.zone, boxHeight);
        const boxY = writer.currentYFor(area.zone);
        writer.rect(area.x, boxY, area.width, boxHeight, tint(theme.headingColor, 0.05));
        writer.rect(area.x, boxY, 3, boxHeight, theme.headingColor);
        writer.paragraph(area, section.paragraphs?.join('\n\n') ?? '', {
            size: theme.bodySize,
            color: bodyColor,
            weight: theme.summaryItalic ? 'italic' : 'regular',
            xOffset: 10,
            width: area.width - 20,
        });
        writer.advance(area.zone, 4);
        return;
    }
    writer.paragraph(area, section.paragraphs?.join('\n\n') ?? '', {
        size: theme.bodySize,
        color: bodyColor,
        weight: theme.summaryItalic ? 'italic' : 'regular',
        align: theme.centerBody ? 'center' : 'left',
        lineHeight: theme.centerBody ? 1.7 : theme.lineHeight,
    });
}

function drawEntry(
    writer: PdfWriter,
    entry: NonNullable<ResumeDocumentSection['entries']>[number],
    area: Area,
    options: { badge?: number; timeline?: boolean; stackedDate?: boolean } = {},
): void {
    const theme = writer.theme;
    const columns = area.zone === 'sidebar' ? theme.columns : undefined;
    const textColor = columns?.text ?? theme.text;
    const mutedColor = columns?.muted ?? theme.muted;
    const accentColor = columns?.heading ?? theme.headingColor;
    const titleSize = theme.bodySize + 0.7;
    const titleFont = writer.font('bold');
    const dateFont = writer.font('regular');
    const dateText = entry.date ? sanitizePdfText(entry.date) : '';
    const dateWidth = dateText ? dateFont.widthOfTextAtSize(dateText, theme.smallSize) : 0;
    const fullTitleWidth = titleFont.widthOfTextAtSize(sanitizePdfText(entry.title), titleSize);

    let indent = 0;
    if (options.badge !== undefined) indent += 18;
    if (options.timeline) indent += 16;
    const contentX = area.x + indent;
    const contentWidth = area.width - indent;
    const inlineDate = Boolean(dateText) && !options.stackedDate && fullTitleWidth + dateWidth + 16 <= contentWidth;

    const titleLineCount = writer.wrap(entry.title, titleFont, titleSize, contentWidth).length;
    const subtitleReserve = entry.subtitle ? (theme.smallSize + 0.4) * theme.lineHeight : 0;
    const separateDateReserve = !inlineDate && dateText ? theme.smallSize * theme.lineHeight : 0;
    // Keep a heading/title with its organisation and date rather than leaving
    // a bare title at the bottom of one page and its context on the next.
    // Reserve the first two description lines too: a one-line widow under an
    // otherwise complete entry is worse than moving the entry to a new page.
    const descriptionReserve = entry.description
        ? Math.min(2, writer.wrap(entry.description, writer.font(), theme.bodySize, contentWidth).length)
            * theme.bodySize * theme.lineHeight
        : 0;
    writer.ensure(
        area.zone,
        Math.max(titleSize * 1.5, titleLineCount * titleSize * theme.lineHeight)
        + 8 + subtitleReserve + separateDateReserve + descriptionReserve,
    );
    let y = writer.currentYFor(area.zone);

    if (options.badge !== undefined) {
        const badge = 13;
        writer.rect(contentX - 18, y + 1, badge, badge, accentColor);
        writer.drawText(String(options.badge).padStart(2, '0'), contentX - 18, y + 3.2, writer.font('bold'), 6.5, WHITE, {
            align: 'center',
            width: badge,
        });
    }

    if (theme.centerBody) {
        writer.paragraph({ ...area, x: contentX, width: contentWidth }, entry.title, {
            size: titleSize,
            weight: 'bold',
            color: theme.text,
            align: 'center',
        });
        const sub = [entry.subtitle, entry.date].filter(Boolean).join(' · ');
        if (sub) {
            writer.paragraph({ ...area, x: contentX, width: contentWidth }, sub, {
                size: theme.smallSize,
                weight: 'italic',
                color: theme.muted,
                align: 'center',
            });
        }
        if (entry.description) {
            writer.paragraph({ ...area, x: contentX, width: contentWidth }, entry.description, {
                size: theme.bodySize,
                color: theme.text,
                align: 'center',
            });
        }
        for (const bullet of entry.bullets ?? []) {
            writer.paragraph({ ...area, x: contentX, width: contentWidth }, bullet, {
                size: theme.bodySize,
                color: theme.text,
                align: 'center',
            });
        }
        writer.advance(area.zone, theme.entryGap);
        return;
    }

    if (inlineDate) {
        writer.drawText(entry.title, contentX, y, titleFont, titleSize, textColor);
        writer.drawText(dateText, area.x, y, dateFont, theme.smallSize, mutedColor, {
            align: 'right',
            width: area.width,
        });
        writer.advance(area.zone, titleSize * 1.45);
    } else {
        writer.paragraph({ ...area, x: contentX, width: contentWidth }, entry.title, {
            size: titleSize,
            weight: 'bold',
            color: textColor,
        });
        if (dateText && !options.stackedDate) {
            writer.paragraph({ ...area, x: contentX, width: contentWidth }, dateText, {
                size: theme.smallSize,
                color: mutedColor,
            });
        }
    }

    if (entry.subtitle) {
        const subtitleColor = theme.headingStyle === 'code' ? accentColor : mutedColor;
        writer.paragraph({ ...area, x: contentX, width: contentWidth }, entry.subtitle, {
            size: theme.smallSize + 0.4,
            color: subtitleColor,
            weight: theme.headingStyle === 'code' ? 'bold' : 'regular',
        });
    }
    if (options.stackedDate && dateText) {
        writer.paragraph({ ...area, x: contentX, width: contentWidth }, dateText, {
            size: theme.smallSize,
            color: mutedColor,
        });
    }
    if (entry.description) {
        writer.paragraph({ ...area, x: contentX, width: contentWidth }, entry.description, {
            size: theme.bodySize,
            color: textColor,
        });
    }
    for (const bullet of entry.bullets ?? []) {
        writer.bullet({ ...area, x: contentX, width: contentWidth }, bullet, accentColor);
        writer.advance(area.zone, theme.bulletGap);
    }

    if (theme.entryDivider) {
        const lineY = writer.currentYFor(area.zone);
        writer.line(area.x, lineY, area.x + area.width, 0.5, BORDER);
        writer.advance(area.zone, 5);
    }
    writer.advance(area.zone, theme.entryGap);
}

function drawSkillGroup(
    writer: PdfWriter,
    group: ResumeDocumentSkillGroup,
    area: Area,
    options: { sidebar?: boolean } = {},
): void {
    const theme = writer.theme;
    const columns = theme.columns;
    const sidebar = Boolean(options.sidebar);
    const labelColor = sidebar ? columns?.muted ?? theme.muted : theme.muted;
    const valueColor = sidebar ? columns?.text ?? theme.text : theme.text;

    writer.ensure(area.zone, theme.smallSize * 2.2 + 8);
    writer.paragraph(area, group.label, {
        size: theme.smallSize,
        color: labelColor,
        weight: 'bold',
        after: 2,
    });

    const groupLabel = group.label.toLowerCase();
    const isSoftSkills = groupLabel.includes('soft');
    const isTools = groupLabel.startsWith('tool');
    // Both coloured-column templates use the `sidebar` header kind; the
    // infographic variant is the one with an avatar.
    const sidebarTemplate = theme.header === 'sidebar' ? (theme.avatar ? 'infographic' : 'two-column') : null;
    if (theme.skills === 'chips'
        || (sidebar && isTools && sidebarTemplate === 'two-column')
        || (sidebar && isSoftSkills && sidebarTemplate === 'infographic')) {
        writer.chips(area, group.values, {
            background: sidebar
                ? columns?.chipBackground ?? WHITE
                : theme.chipBorder ? tint(theme.headingColor, 0.07) : '#F3F4F6',
            text: sidebar ? columns?.chipText ?? valueColor : theme.chipBorder ? theme.text : valueColor,
            border: sidebar ? undefined : theme.chipBorder,
            opacity: sidebar ? 0.22 : 1,
        });
    } else if (theme.skills === 'bars' && sidebar && !(isSoftSkills && sidebarTemplate)) {
        group.values.forEach((value, index) => {
            const pct = 70 + ((index * 7 + 11) % 30);
            writer.ensure(area.zone, 13);
            const y = writer.currentYFor(area.zone);
            writer.drawText(value, area.x, y, writer.font('bold'), theme.smallSize, valueColor);
            writer.drawText(`${pct}%`, area.x, y, writer.font(), theme.smallSize, columns?.muted ?? theme.muted, {
                align: 'right',
                width: area.width,
            });
            writer.rect(area.x, y + theme.smallSize + 3, area.width, 3, '#FFFFFF33');
            writer.rect(area.x, y + theme.smallSize + 3, area.width * pct / 100, 3, '#FFFFFFCC');
            writer.advance(area.zone, 15);
        });
    } else if (sidebar) {
        group.values.forEach(value => {
            writer.ensure(area.zone, theme.smallSize * 1.5);
            const y = writer.currentYFor(area.zone);
            writer.circle(area.x + 2, y + theme.smallSize * 0.55, 1.2, sidebar ? '#FFFFFFCC' : theme.headingColor);
            writer.drawText(value, area.x + 9, y, writer.font(), theme.bodySize, valueColor);
            writer.advance(area.zone, theme.bodySize * 1.55);
        });
    } else {
        writer.paragraph(area, group.values.join('  ·  '), {
            size: theme.bodySize,
            color: valueColor,
        });
    }
    writer.advance(area.zone, 6);
}

function drawSection(writer: PdfWriter, section: ResumeDocumentSection, area: Area): void {
    const theme = writer.theme;
    const isSkills = section.kind === 'skills';

    // Short custom sections should not leave a single orphaned line on the
    // next page. If the whole block fits on one page, move it as a unit.
    if (section.kind === 'custom') {
        const lineHeight = theme.bodySize * theme.lineHeight;
        let blockHeight = 0;
        for (const line of section.paragraphs ?? []) {
            if (!line.trim()) {
                blockHeight += theme.bodySize * 0.6;
                continue;
            }
            const isBullet = /^[-•*]\s+/.test(line);
            const text = isBullet ? line.replace(/^[-•*]\s+/, '') : line;
            const width = area.width - (isBullet ? 11 : 0);
            blockHeight += Math.max(1, writer.wrap(text, writer.font(), theme.bodySize, width).length) * lineHeight
                + (isBullet ? theme.bulletGap : 0);
        }
        const headingHeight = section.heading ? theme.headingSize * 1.7 + 8 : 0;
        const availableHeight = A4_HEIGHT_PT - theme.margin - theme.bottomMargin;
        if (blockHeight + headingHeight <= availableHeight) {
            writer.ensure(area.zone, blockHeight + headingHeight + 2);
        }
    }

    const groupedSkills = isSkills
        && (theme.skills === 'lines' || theme.skills === 'bars' || area.zone === 'sidebar');

    // Inline skill lists are short. Keep the heading and the whole list
    // together so a single trailing skill never becomes a widow.
    if (isSkills && !groupedSkills) {
        const values = (section.skillGroups ?? []).flatMap(group => group.values);
        if (values.length > 0) {
            const lines = writer.wrap(values.join('  ·  '), writer.font(), theme.bodySize, area.width);
            const headingHeight = section.heading ? theme.headingSize * 1.7 + 8 : 0;
            const blockHeight = lines.length * theme.bodySize * theme.lineHeight;
            const availableHeight = A4_HEIGHT_PT - theme.margin - theme.bottomMargin;
            if (blockHeight + headingHeight <= availableHeight) {
                writer.ensure(area.zone, blockHeight + headingHeight + 2);
            }
        }
    }

    const hadHeading = groupedSkills ? false : drawSectionHeading(writer, section, area);
    if (!hadHeading && section.kind === 'summary') {
        writer.advance(area.zone, 2);
    }

    if (section.kind === 'summary') {
        drawSummary(writer, section, area);
    } else if (isSkills) {
        if (groupedSkills) {
            for (const group of section.skillGroups ?? []) {
                drawSkillGroup(writer, group, area, { sidebar: area.zone === 'sidebar' });
            }
        } else {
            const values = (section.skillGroups ?? []).flatMap(group => group.values);
            if (values.length > 0) {
                if (theme.skills === 'chips') {
                    writer.chips(area, values, {
                        background: theme.chipBorder ? tint(theme.headingColor, 0.07) : '#F3F4F6',
                        text: theme.chipBorder ? theme.text : theme.text,
                        border: theme.chipBorder,
                    });
                } else {
                    writer.paragraph(area, values.join('  ·  '), {
                        size: theme.bodySize,
                        color: theme.text,
                    });
                }
            }
        }
    } else if (section.kind === 'custom') {
        const columns = area.zone === 'sidebar' ? theme.columns : undefined;
        const bodyColor = columns?.text ?? theme.text;
        const accentColor = columns?.heading ?? theme.headingColor;
        const lines = section.paragraphs ?? [];
        for (const line of lines) {
            if (!line.trim()) {
                writer.advance(area.zone, theme.bodySize * 0.6);
                continue;
            }
            if (/^[-•*]\s+/.test(line)) {
                writer.bullet(area, line.replace(/^[-•*]\s+/, ''), accentColor);
                writer.advance(area.zone, theme.bulletGap);
            } else {
                writer.paragraph(area, line, {
                    size: theme.bodySize,
                    color: bodyColor,
                    align: theme.centerBody ? 'center' : 'left',
                });
            }
        }
    } else {
        const entries = section.entries ?? [];
        const timelineStart = writer.currentYFor(area.zone);
        const startPage = writer.pageIndex;
        const dots: number[] = [];
        entries.forEach((entry, index) => {
            if (theme.timeline) dots.push(writer.currentYFor(area.zone) + 4);
            drawEntry(writer, entry, area, {
                badge: theme.projectBadges && section.kind === 'projects' ? index + 1 : undefined,
                timeline: theme.timeline,
                stackedDate: section.kind === 'education',
            });
        });
        // A timeline that crosses a page break cannot be drawn as one line.
        if (theme.timeline && dots.length > 0 && writer.pageIndex === startPage) {
            const lineX = area.x + 3;
            const endY = writer.currentYFor(area.zone) - 3;
            writer.vline(lineX, timelineStart + 2, endY, 1, tint(theme.headingColor, 0.35));
            for (const dotY of dots) {
                writer.circle(lineX, dotY, 2.4, theme.headingColor, {
                    borderColor: WHITE,
                    borderWidth: 0.8,
                });
            }
        }
    }

    writer.advance(area.zone, theme.sectionGap);
}

/* ─────────────────────────── Public API ─────────────────────────── */

export interface BuiltResumePdf {
    bytes: Uint8Array;
    pageCount: number;
}

export async function buildResumePdf(model: ResumeDocumentModel): Promise<BuiltResumePdf> {
    const theme = themeFor(model.base, model.accentColor);
    const doc = await PDFDocument.create();

    doc.setTitle(`${model.name} — Resume`);
    doc.setAuthor(model.name);
    doc.setSubject('Resume');
    doc.setCreator('LakshyaTrack Resume Studio');
    doc.setProducer('LakshyaTrack Resume Studio');
    doc.setLanguage('en');

    const [regular, bold, italic, boldItalic] = await Promise.all([
        doc.embedFont(StandardFonts.Helvetica),
        doc.embedFont(StandardFonts.HelveticaBold),
        doc.embedFont(StandardFonts.HelveticaOblique),
        doc.embedFont(StandardFonts.HelveticaBoldOblique),
    ]);
    let fonts: Record<'regular' | 'bold' | 'italic' | 'boldItalic', PDFFont> = {
        regular, bold, italic, boldItalic,
    };
    if (theme.font === 'serif') {
        const [serif, serifBold, serifItalic, serifBoldItalic] = await Promise.all([
            doc.embedFont(StandardFonts.TimesRoman),
            doc.embedFont(StandardFonts.TimesRomanBold),
            doc.embedFont(StandardFonts.TimesRomanItalic),
            doc.embedFont(StandardFonts.TimesRomanBoldItalic),
        ]);
        fonts = { regular: serif, bold: serifBold, italic: serifItalic, boldItalic: serifBoldItalic };
    } else if (theme.font === 'mono') {
        const [mono, monoBold, monoItalic, monoBoldItalic] = await Promise.all([
            doc.embedFont(StandardFonts.Courier),
            doc.embedFont(StandardFonts.CourierBold),
            doc.embedFont(StandardFonts.CourierOblique),
            doc.embedFont(StandardFonts.CourierBoldOblique),
        ]);
        fonts = { regular: mono, bold: monoBold, italic: monoItalic, boldItalic: monoBoldItalic };
    }

    const writer = new PdfWriter(doc, theme, fonts);
    const headerBottom = drawHeader(writer, model);

    if (theme.columns) {
        writer.beginColumns(headerBottom);
        const sideSections = model.sections.filter(section => section.zone === 'sidebar');
        const mainSections = model.sections.filter(section => section.zone !== 'sidebar');
        const sideArea = writer.sideArea;
        const mainArea = writer.mainArea;
        const mainStart = writer.currentYFor('main');

        // Flow the sidebar first; it can add pages, then the main column
        // always starts on page one and reuses those pages as it overflows.
        for (const section of sideSections) drawSection(writer, section, sideArea);
        writer.startZone('main', mainStart, 0);
        for (const section of mainSections) drawSection(writer, section, mainArea);
    } else {
        // Single-column layouts draw their header directly onto page one, so
        // the body cursor must start below it instead of at the top margin.
        writer.startZone('main', headerBottom + 2, 0);
        const area = writer.mainArea;
        for (const section of model.sections) drawSection(writer, section, area);
    }

    const bytes = await doc.save();
    return { bytes, pageCount: writer.pageCount };
}

export async function exportToPDF(model: ResumeDocumentModel, filename?: string): Promise<void> {
    const { bytes } = await buildResumePdf(model);
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    saveAs(blob, filename || `${slugifyFilename(model.name)}_Resume.pdf`);
}
