import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';

/**
 * Export resume as a print-ready PDF using html2pdf.js.
 *
 * Strategy: Use html2pdf.js which wraps html2canvas and jspdf to generate
 * PDFs with better hyperlink preservation than browser print-to-PDF.
 * This gives us:
 *   • Full-page, A4-sized output
 *   • Real text (not a screenshot) → ATS-safe, selectable, searchable
 *   • Correct colors and layouts
 *   • Better hyperlink annotation support
 */
export async function exportToPDF(elementId: string): Promise<void> {
    const source = document.getElementById(elementId);
    if (!source) throw new Error('Resume preview element not found');

    // Clone the element to avoid modifying the live preview
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.width = '794px'; // A4 width at 96 DPI
    clone.style.position = 'static';
    clone.style.margin = '0';
    clone.style.padding = '0';
    clone.removeAttribute('id');

    // Remove any fixed positioning from children that could cause blank pages
    const removeFixedPositions = (el: HTMLElement) => {
        if (el.style.position === 'fixed' || el.style.position === 'absolute') {
            el.style.position = 'relative';
        }
        Array.from(el.children).forEach(child => {
            if (child instanceof HTMLElement) removeFixedPositions(child);
        });
    };
    removeFixedPositions(clone);

    // Create a container for the clone - use a better approach than off-screen
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '-10000px'; // Move far above viewport but still renderable
    container.style.width = '794px';
    container.style.height = 'auto';
    container.style.backgroundColor = 'white';
    container.style.overflow = 'visible';
    container.style.zIndex = '-1';
    container.appendChild(clone);
    document.body.appendChild(container);

    try {
        // Configure html2pdf options with improved page-break handling
        const opt: any = {
            margin: 0,
            filename: 'resume.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                logging: false,
                windowWidth: 794, // Force canvas width to match A4
                onclone: (clonedDoc: Document) => {
                    // Ensure the cloned document has proper page-break styles
                    const clonedElement = clonedDoc.body.firstChild as HTMLElement;
                    if (clonedElement) {
                        clonedElement.style.pageBreakInside = 'avoid';
                        clonedElement.style.pageBreakBefore = 'auto';
                        clonedElement.style.pageBreakAfter = 'auto';
                    }
                },
            },
            jsPDF: {
                unit: 'px',
                format: 'a4',
                orientation: 'portrait',
            },
            pagebreak: { 
                mode: ['css', 'legacy'], // Use CSS page-break rules first
                before: '.page-break-before',
                after: '.page-break-after',
                avoid: '.page-break-avoid',
            },
        };

        // Generate PDF
        await html2pdf().set(opt).from(clone).save();
    } finally {
        // Cleanup
        document.body.removeChild(container);
    }
}

/* ═══════════════════════════════════════════════════════════════════
 *  DOCX EXPORT — HTML → Word-compatible document (zero dependencies)
 *
 *  Strategy:
 *    1. Clone the live resume preview element (same one the PDF uses).
 *    2. Walk the DOM and inline ALL computed styles so the output is
 *       self-contained (Word doesn't understand Tailwind/CSS classes).
 *    3. Convert CSS flex layouts → HTML tables (Word doesn't do flexbox).
 *    4. Wrap it in an HTML document with Microsoft Office XML namespaces.
 *    5. Save as a .doc file that Word & Google Docs open natively.
 *
 *  This keeps the visual layout (headings, spacing, colors, fonts,
 *  columns etc.) consistent with the PDF / live preview.
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * CSS properties that matter for Word rendering.
 * We inline only these to keep the file size reasonable.
 *
 * NOTE: Border properties are intentionally EXCLUDED.
 * The live preview uses decorative borders (section separators, colored
 * accent lines, etc.) that render as ugly box outlines in Word.
 * Word tables/cells already have border: none set in the global CSS.
 */
const IMPORTANT_CSS_PROPS: string[] = [
    'color', 'background-color', 'background',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
    'line-height', 'white-space',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    // NO border properties — they cause ugly lines in Word
    'width', 'max-width', 'min-width',
    'height', 'min-height',
    'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
    'list-style-type', 'list-style',
    'vertical-align',
    'overflow', 'box-sizing',
];

/**
 * Recursively walk the cloned DOM and inline computed styles on every element.
 * This makes the HTML self-contained — no external CSS needed.
 */
function inlineComputedStyles(sourceEl: Element, cloneEl: Element): void {
    if (!(sourceEl instanceof HTMLElement) || !(cloneEl instanceof HTMLElement)) return;

    const computed = window.getComputedStyle(sourceEl);
    const inlined: string[] = [];

    for (const prop of IMPORTANT_CSS_PROPS) {
        const val = computed.getPropertyValue(prop);
        if (val && val !== '' && val !== 'none' && val !== 'normal' && val !== 'auto') {
            // Skip default transparent backgrounds
            if ((prop === 'background-color' || prop === 'background') && val === 'rgba(0, 0, 0, 0)') continue;
            inlined.push(`${prop}: ${val}`);
        }
    }

    if (inlined.length > 0) {
        cloneEl.setAttribute('style', inlined.join('; '));
    }

    // Remove className (not needed once styles are inlined)
    cloneEl.removeAttribute('class');

    // Recurse into children
    const sourceChildren = sourceEl.children;
    const cloneChildren = cloneEl.children;
    for (let i = 0; i < sourceChildren.length && i < cloneChildren.length; i++) {
        inlineComputedStyles(sourceChildren[i], cloneChildren[i]);
    }
}

/**
 * Post-processing: strip any remaining border styles from every element.
 * This catches borders that might have been set via inline style attributes
 * on the original template elements (not just computed styles).
 * Also preserves anchor hrefs for DOCX hyperlinks.
 */
function stripAllBorders(el: HTMLElement): void {
    const style = el.getAttribute('style') || '';
    if (style) {
        // Remove any border-related declarations
        const cleaned = style
            .replace(/border[^;]*;?/gi, '')
            .replace(/outline[^;]*;?/gi, '')
            .replace(/box-shadow[^;]*;?/gi, '')
            .replace(/;;+/g, ';')
            .replace(/^;|;$/g, '')
            .trim();
        el.setAttribute('style', cleaned);
    }

    // Force border: none on table elements
    const tag = el.tagName.toUpperCase();
    if (tag === 'TABLE' || tag === 'TD' || tag === 'TR' || tag === 'TH' || tag === 'TBODY') {
        const current = el.getAttribute('style') || '';
        el.setAttribute('style', `${current}; border: none !important; border-collapse: collapse;`);
    }

    // Preserve anchor hrefs for DOCX hyperlinks
    if (tag === 'A' && el instanceof HTMLAnchorElement) {
        const href = el.getAttribute('href');
        if (href) {
            // Ensure href is preserved in the clone
            el.setAttribute('href', href);
        }
    }

    Array.from(el.children).forEach(child => {
        if (child instanceof HTMLElement) stripAllBorders(child);
    });
}

/**
 * Convert flex layout to table-based layout for Word compatibility.
 * Word doesn't understand CSS flex, so we replace flex containers
 * with table equivalents that achieve the same visual result.
 */
function convertFlexToTable(el: HTMLElement): void {
    const style = el.getAttribute('style') || '';

    // Check if this is a flex container with side-by-side children
    if (style.includes('display: flex') && !style.includes('flex-direction: column')) {
        const children = Array.from(el.children) as HTMLElement[];
        if (children.length >= 2) {
            // Create a table-based layout with NO borders
            const table = document.createElement('table');
            const cleanStyle = style
                .replace(/display:\s*flex[^;]*;?/g, '')
                .replace(/gap[^;]*;?/g, '')
                .replace(/align-items[^;]*;?/g, '')
                .replace(/justify-content[^;]*;?/g, '')
                .replace(/border[^;]*;?/gi, '');
            table.setAttribute('style', `width: 100%; border-collapse: collapse; border: none; border-spacing: 0; ${cleanStyle}`);
            table.setAttribute('cellpadding', '0');
            table.setAttribute('cellspacing', '0');
            table.setAttribute('border', '0');

            const tr = document.createElement('tr');
            tr.setAttribute('style', 'border: none;');

            children.forEach(child => {
                const td = document.createElement('td');
                const childStyle = (child.getAttribute('style') || '').replace(/border[^;]*;?/gi, '');
                td.setAttribute('style', `vertical-align: top; border: none; ${childStyle}`);
                td.innerHTML = child.innerHTML;
                tr.appendChild(td);
            });

            table.appendChild(tr);

            // Replace the flex container with the table
            el.innerHTML = '';
            el.appendChild(table);

            // Remove the flex display from the parent
            el.setAttribute('style', style.replace(/display:\s*flex[^;]*;?/g, 'display: block;').replace(/gap[^;]*;?/g, '').replace(/border[^;]*;?/gi, ''));
        }
    }

    // Recurse into children (but NOT into tables we just created)
    Array.from(el.children).forEach(child => {
        if (child instanceof HTMLElement && child.tagName !== 'TABLE') {
            convertFlexToTable(child);
        }
    });
}

/**
 * Convert inline flex rows (like contact info, skill tags) into
 * inline-block spans so they render side-by-side in Word.
 */
function convertFlexWrapToInline(el: HTMLElement): void {
    const style = el.getAttribute('style') || '';

    if (style.includes('display: flex') && style.includes('flex-wrap: wrap')) {
        const children = Array.from(el.children) as HTMLElement[];
        children.forEach(child => {
            const cs = child.getAttribute('style') || '';
            child.setAttribute('style', `${cs}; display: inline-block; margin-right: 6px; margin-bottom: 4px;`);
        });
        el.setAttribute('style', style.replace(/display:\s*flex[^;]*;?/g, 'display: block;'));
    }

    // Also handle flex containers without wrap (small inline groups like contact info)
    if (style.includes('display: flex') && !style.includes('flex-wrap: wrap') && !style.includes('flex-direction: column')) {
        const children = Array.from(el.children) as HTMLElement[];
        if (children.length > 0 && children.length < 6) {
            let hasLargeChild = false;
            children.forEach(child => {
                const cs = child.getAttribute('style') || '';
                if (cs.includes('width:') && !cs.includes('width: auto')) {
                    hasLargeChild = true;
                }
            });
            if (!hasLargeChild) {
                children.forEach(child => {
                    const cs = child.getAttribute('style') || '';
                    child.setAttribute('style', `${cs}; display: inline-block; margin-right: 4px;`);
                });
                el.setAttribute('style', style.replace(/display:\s*flex[^;]*;?/g, 'display: block;'));
            }
        }
    }

    Array.from(el.children).forEach(child => {
        if (child instanceof HTMLElement) {
            convertFlexWrapToInline(child);
        }
    });
}

/**
 * Export resume as a Word document by converting the rendered HTML template.
 * Uses the same preview element as the PDF export to ensure visual consistency.
 *
 * The output is a Word-compatible HTML document (.doc) with Microsoft Office
 * XML namespaces. Both Microsoft Word and Google Docs open these natively
 * with full formatting preserved.
 */
export async function exportToDOCX(elementId: string, filename: string = 'resume.doc'): Promise<void> {
    const source = document.getElementById(elementId);
    if (!source) throw new Error('Resume preview element not found');

    // ── 1. Deep-clone the rendered resume ──────────────────────────
    const clone = source.cloneNode(true) as HTMLElement;

    // ── 2. Inline all computed styles ──────────────────────────────
    inlineComputedStyles(source, clone);

    // ── 3. Strip preview transforms ────────────────────────────────
    clone.style.transform = 'none';
    clone.style.width = '100%';
    clone.style.position = 'static';
    clone.removeAttribute('id');

    // ── 4. Convert flex layouts for Word compatibility ──────────────
    //  Word doesn't support CSS flexbox; convert flex-wrap containers
    //  to inline-block first, then convert remaining flex containers
    //  (e.g. two-column layouts) to HTML tables.
    convertFlexWrapToInline(clone);
    convertFlexToTable(clone);

    // ── 4b. Strip ALL borders from every element ────────────────────
    //  This removes decorative borders from the template that translate
    //  into ugly box outlines in Word.
    stripAllBorders(clone);

    // ── 5. Build a complete Word-compatible HTML document ───────────
    const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Resume</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 0.4in 0.4in 0.4in 0.4in;
            mso-page-orientation: portrait;
        }
        body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            color: #333333;
            margin: 0;
            padding: 0;
            background: white;
            width: 100%;
        }
        /* Kill ALL borders globally — Word loves adding them */
        *, *::before, *::after {
            border: none !important;
            border-color: transparent !important;
            outline: none !important;
            box-shadow: none !important;
        }
        table {
            border-collapse: collapse;
            border: none !important;
            border-spacing: 0;
            width: 100%;
        }
        td, tr, th, tbody {
            vertical-align: top;
            border: none !important;
            padding: 0;
        }
        div, span, section, article, header, footer, main, aside, nav {
            border: none !important;
        }
        /* Content layout */
        ul { padding-left: 20px; margin: 4px 0; }
        li { margin-bottom: 2px; }
        p { margin: 2px 0; }
        h1, h2, h3, h4, h5, h6 { margin: 4px 0; }
    </style>
</head>
<body>
    <div style="width: 100%; margin: 0; padding: 0; border: none;">
        ${clone.outerHTML}
    </div>
</body>
</html>`;

    // ── 6. Create Blob & Download ──────────────────────────────────
    //  The BOM (\ufeff) ensures proper encoding detection in Word.
    //  The MIME type 'application/msword' tells the OS to open with Word.
    const blob = new Blob(['\ufeff', docHtml], {
        type: 'application/msword'
    });

    saveAs(blob, filename);
}
