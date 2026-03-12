type PdfJsModule = typeof import('pdfjs-dist');
type TesseractModule = typeof import('tesseract.js');

let pdfJsPromise: Promise<PdfJsModule> | null = null;
let tesseractPromise: Promise<TesseractModule> | null = null;
let workerReady = false;

async function getPdfJs() {
    if (!pdfJsPromise) {
        pdfJsPromise = import('pdfjs-dist');
    }

    const pdfjsLib = await pdfJsPromise;

    if (!workerReady) {
        const { default: pdfWorker } = await import('pdfjs-dist/build/pdf.worker.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
        workerReady = true;
    }

    return pdfjsLib;
}

async function getTesseract() {
    if (!tesseractPromise) {
        tesseractPromise = import('tesseract.js');
    }
    return tesseractPromise;
}

export const extractTextFromFile = async (
    file: File,
    onProgress?: (msg: string) => void,
): Promise<string> => {
    const fileType = file.type;

    if (fileType === 'application/pdf') {
        const pdfjsLib = await getPdfJs();

        onProgress?.('Reading PDF content...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        let hasSelectableText = false;

        for (let i = 1; i <= pdf.numPages; i += 1) {
            onProgress?.(`Checking page ${i} of ${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            if (pageText.trim().length > 10) {
                hasSelectableText = true;
            }
            fullText += `${pageText}\n`;
        }

        // If very little text was found, it's likely a scan. Use OCR.
        if (!hasSelectableText || fullText.trim().length < 100) {
            onProgress?.('Scanned PDF detected. Starting OCR (this may take a moment)...');
            const Tesseract = await getTesseract();
            fullText = '';

            for (let i = 1; i <= pdf.numPages; i += 1) {
                onProgress?.(`Performing OCR on page ${i} of ${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) continue;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport, canvas }).promise;
                const imageData = canvas.toDataURL('image/png');
                const {
                    data: { text },
                } = await Tesseract.recognize(imageData, 'eng');
                fullText += `${text}\n`;
            }
        }

        return fullText;
    }

    if (fileType.startsWith('image/')) {
        onProgress?.('Extracting text from image...');
        const Tesseract = await getTesseract();
        const {
            data: { text },
        } = await Tesseract.recognize(file, 'eng');
        return text;
    }

    throw new Error('Unsupported file type. Please upload a PDF or an Image.');
};
