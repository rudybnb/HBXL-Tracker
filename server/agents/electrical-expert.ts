/**
 * Electrical Expert Agent
 * Specialized AI for identifying electrical symbols (Lights, Sockets, Switches, Data)
 * with extreme precision, ignoring structural elements.
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// Lazy initialization to handle missing API key gracefully
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set.');
        }
        openai = new OpenAI({
            apiKey,
            timeout: 120000,
            maxRetries: 2
        });
    }
    return openai;
}

export type BoundingBox = [number, number, number, number];

export interface ElectricalElement {
    type: 'light' | 'socket' | 'switch' | 'data' | 'other';
    name: string;
    bbox: BoundingBox;
    page: number;
}

export interface ElectricalExtractionResult {
    success: boolean;
    elements: ElectricalElement[];
    error?: string;
}

const ELECTRICAL_PROMPT = `You are an ELECTRICAL SYMBOL EXPERT AGENT.

Your SOLE Purpose:
Count and locate electrical symbols on architectural drawings with 100% accuracy.
You do NOT care about walls, rooms, dimensions, or furniture.

STRATEGY: MENTAL GRID SCAN
- Divide the image into a 4x4 GRID (16 sectors).
- Scan each sector individually for symbols.
- Combine the results.

SYMBOLS TO FIND (AND COUNT):
1. LIGHTS ("light"):
   - Visual: Circle with a Cross (X or +).
   - Visual: Circle with a single line (Pendant).
   - Visual: Recessed spotlights (small clean circles in grid).
   - RULE: If you see a grid of lights, count EVERY SINGLE ONE.

2. SOCKETS ("socket"):
   - Visual: Small square/rectangle attached to wall.
   - Single Socket = 1 box.
   - Double Socket = 1 box with 2 switch lines (or just count as 1 "Double Socket").
   - Floor Sockets: Square with corners.

3. SWITCHES ("switch"):
   - Visual: Small circle or triangle near door swing.
   - Visual: Arc connecting switch to light.

4. DATA/COMMS ("data"):
   - Visual: Triangle, often with 'T' or 'D'.
   - Visual: Square with 'TV'.

COORDINATE SYSTEM:
- Return NORMALIZED COORDINATES (0-1000).
- 0,0 = Top Left of IMAGE. 1000,1000 = Bottom Right of IMAGE.
- Include WHITE MARGINS in your scale. Do NOT crop.

OUTPUT FORMAT (JSON ONLY):
{
  "elements": [
    { "type": "light", "name": "Ceiling Light", "bbox": [100, 100, 150, 150], "page": 1 },
    { "type": "socket", "name": "Double Socket", "bbox": [900, 900, 950, 950], "page": 1 }
  ]
}
`;

export async function extractElectrical(imagePath: string): Promise<ElectricalExtractionResult> {
    try {
        const absolutePath = path.isAbsolute(imagePath)
            ? imagePath
            : path.join(process.cwd(), imagePath.replace(/^\//, ''));

        if (!fs.existsSync(absolutePath)) {
            return { success: false, elements: [], error: `File not found: ${absolutePath}` };
        }

        const ext = path.extname(absolutePath).toLowerCase();
        let base64Image = '';
        let mimeType = '';

        // Handle PDF files (Convert to JPEG for AI)
        if (ext === '.pdf') {
            try {
                // Polyfill DOMMatrix BEFORE import
                if (!global.DOMMatrix) {
                    // @ts-ignore
                    global.DOMMatrix = class DOMMatrix { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } }
                }

                const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const { createCanvas } = await import('canvas');

                // Enable Worker with File URL
                const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
                // @ts-ignore
                pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

                const fileBuffer = fs.readFileSync(absolutePath);

                // standardFontDataUrl with forward slashes
                let standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');
                standardFontDataUrl = standardFontDataUrl.split(path.sep).join('/');
                if (!standardFontDataUrl.endsWith('/')) {
                    standardFontDataUrl += '/';
                }

                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(fileBuffer),
                    verbosity: 0,
                    standardFontDataUrl
                });
                const doc = await loadingTask.promise;

                // Process Page 1 ONLY for Electrical Mapping (Simplification)
                const page = await doc.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // Force White Background (Opaque)
                context.fillStyle = '#FFFFFF';
                context.fillRect(0, 0, viewport.width, viewport.height);

                await page.render({ canvasContext: context as any, viewport }).promise;

                const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
                base64Image = jpegBuffer.toString('base64');
                mimeType = 'image/jpeg';

                console.log(`⚡ Electrical Agent converted PDF Page 1 to JPEG.`);

            } catch (pdfErr: any) {
                console.error("⚡ Electrical Agent PDF Conversion Failed:", pdfErr);
                return { success: false, elements: [], error: "PDF Conversion Failed: " + pdfErr.message };
            }

        } else {
            // Regular Image
            const imageBuffer = fs.readFileSync(absolutePath);
            base64Image = imageBuffer.toString('base64');
            mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        }

        console.log(`⚡ Electrical Agent scanning: ${path.basename(absolutePath)}`);

        const response = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: ELECTRICAL_PROMPT },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType}; base64, ${base64Image}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0.1, // Low temp for precision
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0].message.content;
        if (!raw) throw new Error("Empty response from AI");

        const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson(raw));

        // Post-processing to ensure bbox format
        const cleanElements = (parsed.elements || []).map((el: any) => ({
            ...el,
            page: 1, // Default to page 1 for single image
            bbox: el.bbox?.map((n: number) => Math.round(n)) // Ensure integers
        }));

        console.log(`⚡ Electrical Agent found ${cleanElements.length} symbols.`);
        return {
            success: true,
            elements: cleanElements
        };

    } catch (error: any) {
        console.error("⚡ Electrical Agent failed:", error);
        return { success: false, elements: [], error: error.message };
    }
}
