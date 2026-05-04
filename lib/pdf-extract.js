// ── PDF text extraction using pdf.js ──
// pdf.js must be loaded before this script (via <script src="lib/vendor/pdf.min.mjs">)

/**
 * Extract all text from a PDF file.
 * @param {File} file - A File object from an <input type="file">
 * @returns {Promise<string>} The concatenated text content of all pages.
 */
async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();

    // pdf.js exposes pdfjsLib on the global scope when loaded via <script>
    const pdfjsLib = globalThis.pdfjsLib;
    if (!pdfjsLib) {
        throw new Error('pdf.js not loaded. Include pdf.min.mjs before this script.');
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        pages.push(strings.join(' '));
    }

    return pages.join('\n\n');
}

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadPDF = { extractPdfText };
}
