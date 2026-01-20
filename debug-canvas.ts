
import { createCanvas } from 'canvas';
import fs from 'fs';

console.log("1. Importing Canvas...");
try {
    const canvas = createCanvas(200, 200);
    console.log("2. Canvas created.");

    console.log("3. Importing PDFJS (Standard)...");

    // Timeout race
    const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 5000));

    const testImport = async () => {
        try {
            console.log("   - Attempting import...");
            const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
            console.log("   - Import sucessful.");

            console.log("4. Loading Document...");
            // Create a dummy PDF (minimal valid PDF)
            // This is a minimal valid PDF 1.0
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
            const task = pdfjsLib.getDocument({ data });
            const doc = await task.promise;
            console.log(`   - Document Loaded! Pages: ${doc.numPages}`);
            console.log("✅ PDFJS Working!");
        } catch (err) {
            console.error("❌ PDFJS Error:", err);
        }
    };

    Promise.race([testImport(), timeout]).catch(e => console.error("❌ TIMEOUT:", e));

} catch (e) {
    console.error("❌ Canvas Failed:", e);
}
