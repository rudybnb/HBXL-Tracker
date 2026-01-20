import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

console.log("1. Starting Debug...");

try {
    // 1. Polyfill DOMMatrix (Exact copy from Agent)
    if (!global.DOMMatrix) {
        // @ts-ignore
        global.DOMMatrix = class DOMMatrix {
            constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
        }
    }
    console.log("2. DOMMatrix Polyfilled.");

    const testImport = async () => {
        try {
            console.log("3. Importing PDFJS...");
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            // @ts-ignore
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            console.log("   - Import successful.");

            console.log("4. Loading Document...");
            const minimalPdf = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
223
%%EOF`;

            const data = new TextEncoder().encode(minimalPdf);

            const standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');
            console.log(`   - Font Path: ${standardFontDataUrl}`);

            const task = pdfjsLib.getDocument({
                data,
                verbosity: 0,
                standardFontDataUrl
            });

            const doc = await task.promise;
            console.log(`   - Document Loaded! Pages: ${doc.numPages}`);

            const page = await doc.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            await page.render({ canvasContext: context as any, viewport }).promise;
            console.log("   - Rendered to Canvas!");

            console.log("✅ SUCCESS: PDF Processing is Working locally.");

        } catch (err) {
            console.error("❌ PDFJS Error:", err);
        }
    };

    testImport();

} catch (e) {
    console.error("❌ Fatal Error:", e);
}
