import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { DOMMatrix } from '../dom-matrix-polyfill';

let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set.');
        openai = new OpenAI({ apiKey, timeout: 120000, maxRetries: 2 });
    }
    return openai;
}

const SYSTEM_PROMPT = `### ROLE
You are the **Finishes & Decoration Agent**.
Your job is to identify all finishes.

### YOU MUST DO
Per room:
* Identify wall finishes
* Identify floor finishes
* Identify ceiling finishes

### RULES
* Do not infer finish type
* Use drawing annotations only

### OUTPUT FORMAT
\`\`\`
Room: Bedroom
Walls: Paint
Floor: Carpet
Ceiling: Paint
\`\`\`
`;

export async function runFinishesAgent(imagePath: string): Promise<string> {
    const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);

    let base64Image = '';
    let mimeType = '';
    const ext = path.extname(absolutePath).toLowerCase();

    if (ext === '.pdf') {
        if (!global.DOMMatrix) { // @ts-ignore
            global.DOMMatrix = DOMMatrix;
        }
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { createCanvas } = await import('canvas');
        const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
        // @ts-ignore
        pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

        const fileBuffer = fs.readFileSync(absolutePath);
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(fileBuffer),
            verbosity: 0,
            standardFontDataUrl: path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')
        });
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: context as any, viewport }).promise;
        base64Image = canvas.toBuffer('image/jpeg', { quality: 0.95 }).toString('base64');
        mimeType = 'image/jpeg';
    } else {
        const imageBuffer = fs.readFileSync(absolutePath);
        base64Image = imageBuffer.toString('base64');
        mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    }

    const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: "Analyze this drawing and identify finishes per room using text annotations." },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
            }
        ],
        max_tokens: 2000,
        temperature: 0.1
    });

    return response.choices[0].message.content || "No output";
}
