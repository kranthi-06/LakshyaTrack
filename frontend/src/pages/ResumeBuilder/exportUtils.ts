import { saveAs } from 'file-saver';

/**
 * Export resume as a print-ready PDF.
 *
 * Strategy: clone the rendered template into a hidden iframe that has
 * proper A4 print-CSS, then trigger window.print() inside that iframe.
 * This gives us:
 *   • Full-page, A4-sized output
 *   • Real text (not a screenshot) → ATS-safe, selectable, searchable
 *   • Correct colors and layouts
 *   • No dependency on html2canvas (which can't handle all CSS)
 */
export async function exportToPDF(elementId: string, _filename: string = 'resume.pdf'): Promise<void> {
    const source = document.getElementById(elementId);
    if (!source) throw new Error('Resume preview element not found');

    // ── 1. Collect all stylesheets from the current page ────────────
    const styleSheets: string[] = [];

    // Grab all <link rel="stylesheet"> and inline <style> tags
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        if (node instanceof HTMLLinkElement) {
            styleSheets.push(`<link rel="stylesheet" href="${node.href}" />`);
        } else if (node instanceof HTMLStyleElement) {
            styleSheets.push(`<style>${node.innerHTML}</style>`);
        }
    });

    // ── 2. Build print-specific CSS ────────────────────────────────
    const printCSS = `
        <style>
            /* Reset everything for print */
            @page {
                size: A4;
                margin: 0;
            }

            *, *::before, *::after {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            html, body {
                width: 210mm;
                min-height: 297mm;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            body {
                display: block !important;
            }

            /* The print container that holds the resume */
            .resume-print-root {
                width: 210mm;
                min-height: 297mm;
                margin: 0;
                padding: 0;
                background: white !important;
                overflow: visible;
            }

            /* Reset the resume content to fill the page */
            .resume-print-root > * {
                width: 100% !important;
                max-width: 100% !important;
                min-height: 297mm;
                margin: 0 !important;
                transform: none !important;
            }

            /* Hide scrollbars, borders, shadows in print */
            ::-webkit-scrollbar { display: none; }

            @media print {
                html, body {
                    width: 210mm;
                    height: auto;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                }

                .resume-print-root {
                    width: 210mm;
                    min-height: 297mm;
                    padding: 0;
                    margin: 0;
                    background: white !important;
                    page-break-inside: auto;
                }

                .resume-print-root > * {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    transform: none !important;
                    box-shadow: none !important;
                }
            }
        </style>
    `;

    // ── 3. Clone the resume element ────────────────────────────────
    const clone = source.cloneNode(true) as HTMLElement;

    // Strip off any inline transforms the preview applied (scaling, etc.)
    clone.style.transform = 'none';
    clone.style.width = '100%';
    clone.style.position = 'static';
    clone.removeAttribute('id');

    // ── 4. Build the iframe document ───────────────────────────────
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=210mm" />
            <title>Resume</title>
            ${styleSheets.join('\n')}
            ${printCSS}
        </head>
        <body>
            <div class="resume-print-root">
                ${clone.outerHTML}
            </div>
        </body>
        </html>
    `;

    // ── 5. Create hidden iframe and inject content ─────────────────
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
        document.body.removeChild(iframe);
        throw new Error('Could not access iframe document');
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // ── 6. Wait for stylesheets to load, then print ────────────────
    await new Promise<void>((resolve) => {
        const onReady = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow?.print();
                } catch (e) {
                    console.error('Print failed:', e);
                    // Fallback: trigger print on main window
                    window.print();
                }
                // Cleanup after a delay to let print dialog finish
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    resolve();
                }, 1000);
            }, 500); // Let CSS settle
        };

        // Wait for iframe to finish loading
        iframe.onload = onReady;

        // Fallback if onload doesn't fire
        setTimeout(onReady, 2000);
    });
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
 */
const IMPORTANT_CSS_PROPS: string[] = [
    'color', 'background-color', 'background',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
    'line-height', 'white-space',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-color', 'border-style', 'border-width',
    'border-radius',
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
            // Create a table-based layout
            const table = document.createElement('table');
            table.setAttribute('style', `width: 100%; border-collapse: collapse; ${style.replace(/display:\s*flex[^;]*;?/g, '').replace(/gap[^;]*;?/g, '').replace(/align-items[^;]*;?/g, '').replace(/justify-content[^;]*;?/g, '')}`);
            table.setAttribute('cellpadding', '0');
            table.setAttribute('cellspacing', '0');

            const tr = document.createElement('tr');

            children.forEach(child => {
                const td = document.createElement('td');
                const childStyle = child.getAttribute('style') || '';
                td.setAttribute('style', `vertical-align: top; ${childStyle}`);
                td.innerHTML = child.innerHTML;
                tr.appendChild(td);
            });

            table.appendChild(tr);

            // Replace the flex container with the table
            el.innerHTML = '';
            el.appendChild(table);

            // Remove the flex display from the parent
            el.setAttribute('style', style.replace(/display:\s*flex[^;]*;?/g, 'display: block;').replace(/gap[^;]*;?/g, ''));
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
            margin: 0.5in 0.5in 0.5in 0.5in;
            mso-page-orientation: portrait;
        }
        body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            color: #333333;
            margin: 0;
            padding: 0;
            background: white;
        }
        table {
            border-collapse: collapse;
            border: none;
        }
        td {
            vertical-align: top;
            border: none;
        }
        ul { padding-left: 20px; margin: 4px 0; }
        li { margin-bottom: 2px; }
        p { margin: 2px 0; }
        h1, h2, h3, h4, h5, h6 { margin: 4px 0; }
    </style>
</head>
<body>
    ${clone.outerHTML}
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
