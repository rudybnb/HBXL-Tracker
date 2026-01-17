
import fs from 'fs';
import path from 'path';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

// Polyfill DOMMatrix if missing (needed for pdfjs-dist legacy in Node)
if (!global.DOMMatrix) {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    }
}

// Hardcoded path to the PDF we found
const RELATIVE_PATH = 'uploads/1768504822967-957990009.pdf';

async function testPdf() {
    const absolutePath = path.resolve(process.cwd(), RELATIVE_PATH);
    console.log('Testing PDF:', absolutePath);

    if (!fs.existsSync(absolutePath)) {
        console.error('File does not exist!');
        return;
    }

    try {
        const buffer = fs.readFileSync(absolutePath);
        const data = new Uint8Array(buffer);

        console.log('Buffer read. Size:', buffer.length);
        console.log('Attempting to load document with pdfjs-dist...');

        const loadingTask = pdfjsLib.getDocument({
            data,
            disableFontFace: true
        });

        const doc = await loadingTask.promise;
        console.log('✅ Document loaded. Pages:', doc.numPages);

        const page = await doc.getPage(1);
        console.log('✅ Page 1 loaded.');

        const viewport = page.getViewport({ scale: 1.0 });
        console.log('   Viewport:', viewport.width, 'x', viewport.height);

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        console.log('   Rendering to canvas...');
        await page.render({
            canvasContext: context as any,
            viewport
        }).promise;

        console.log('✅ Render success!');

    } catch (err) {
        console.error('❌ FAILED:', err);
    }
}

testPdf();
