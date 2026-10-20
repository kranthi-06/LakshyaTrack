import type { ContactKind } from '../templates/contactLinkUtils';
import { HACKERRANK_PATH, KAGGLE_PATH, LEETCODE_PATH } from '../templates/brandIconPaths';

/**
 * Contact glyph geometry shared by the PDF and DOCX exporters.
 *
 * The live preview renders lucide/brand React components. Exporters cannot
 * render React, so the exact same 24×24 geometry is kept here. Generic contact
 * glyphs match the lucide marks used by the preview; LeetCode/HackerRank/Kaggle
 * use the Simple Icons paths from `brandIconPaths.ts`.
 */

export type ContactIconShape =
    | { type: 'path'; d: string }
    | { type: 'circle'; cx: number; cy: number; r: number }
    | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export interface ContactIconDefinition {
    /** `stroke` mirrors lucide; `fill` mirrors the filled brand marks. */
    style: 'stroke' | 'fill';
    shapes: ContactIconShape[];
}

const GENERIC_STROKE_WIDTH = 1.8;

export const CONTACT_ICON_DEFINITIONS: Record<ContactKind, ContactIconDefinition> = {
    email: {
        style: 'stroke',
        shapes: [
            { type: 'path', d: 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7' },
            { type: 'rect', x: 2, y: 4, width: 20, height: 16, rx: 2 },
        ],
    },
    phone: {
        style: 'stroke',
        shapes: [{
            type: 'path',
            d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
        }],
    },
    location: {
        style: 'stroke',
        shapes: [
            {
                type: 'path',
                d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
            },
            { type: 'circle', cx: 12, cy: 10, r: 3 },
        ],
    },
    linkedin: {
        style: 'stroke',
        shapes: [
            { type: 'path', d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' },
            { type: 'rect', x: 2, y: 9, width: 4, height: 12 },
            { type: 'circle', cx: 4, cy: 4, r: 2 },
        ],
    },
    github: {
        style: 'stroke',
        shapes: [
            {
                type: 'path',
                d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
            },
            { type: 'path', d: 'M9 18c-4.51 2-5-2-7-2' },
        ],
    },
    portfolio: {
        style: 'stroke',
        shapes: [
            { type: 'circle', cx: 12, cy: 12, r: 10 },
            { type: 'path', d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' },
            { type: 'path', d: 'M2 12h20' },
        ],
    },
    website: {
        style: 'stroke',
        shapes: [
            { type: 'path', d: 'M15 3h6v6' },
            { type: 'path', d: 'M10 14 21 3' },
            { type: 'path', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
        ],
    },
    leetcode: {
        style: 'fill',
        shapes: [{ type: 'path', d: LEETCODE_PATH }],
    },
    hackerrank: {
        style: 'fill',
        shapes: [{ type: 'path', d: HACKERRANK_PATH }],
    },
    kaggle: {
        style: 'fill',
        shapes: [{ type: 'path', d: KAGGLE_PATH }],
    },
};

function circlePath(cx: number, cy: number, r: number): string {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}

function rectPath(x: number, y: number, width: number, height: number, rx = 0): string {
    if (!rx) {
        return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
    }
    return [
        `M ${x + rx} ${y}`,
        `H ${x + width - rx}`,
        `A ${rx} ${rx} 0 0 1 ${x + width} ${y + rx}`,
        `V ${y + height - rx}`,
        `A ${rx} ${rx} 0 0 1 ${x + width - rx} ${y + height}`,
        `H ${x + rx}`,
        `A ${rx} ${rx} 0 0 1 ${x} ${y + height - rx}`,
        `V ${y + rx}`,
        `A ${rx} ${rx} 0 0 1 ${x + rx} ${y}`,
        'Z',
    ].join(' ');
}

/** Convert the shared shapes into a single path pdf-lib can draw. */
export function contactIconPath(kind: ContactKind): string {
    return CONTACT_ICON_DEFINITIONS[kind].shapes
        .map(shape => {
            if (shape.type === 'path') return shape.d;
            if (shape.type === 'circle') return circlePath(shape.cx, shape.cy, shape.r);
            return rectPath(shape.x, shape.y, shape.width, shape.height, shape.rx);
        })
        .join(' ');
}

/** SVG markup used to rasterize deterministic PNGs for the DOCX package. */
export function contactIconSvg(kind: ContactKind, color: string): string {
    const definition = CONTACT_ICON_DEFINITIONS[kind];
    const body = definition.shapes
        .map(shape => {
            if (shape.type === 'path') return `<path d="${shape.d}"/>`;
            if (shape.type === 'circle') {
                return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
            }
            return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"${
                shape.rx ? ` rx="${shape.rx}"` : ''
            }/>`;
        })
        .join('');
    const paint = definition.style === 'fill'
        ? `fill="${color}"`
        : `fill="none" stroke="${color}" stroke-width="${GENERIC_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" ${paint}>${body}</svg>`;
}
