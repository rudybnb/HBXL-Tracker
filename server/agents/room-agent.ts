/**
 * Room Recognition Expert Agent
 * Specialized AI for identifying ROOMS and their PERIMETER BOUNDARIES.
 * This agent provides the "Master Map" for all other elements.
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

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

export interface ExtractedRoom {
    name: string;             // "Living Room", "Bedroom 1"
    bbox: BoundingBox;        // [xmin, ymin, xmax, ymax]
    page: number;
}

export interface RoomExtractionResult {
    success: boolean;
    rooms: ExtractedRoom[];
    error?: string;
}

const ROOM_PROMPT = `You are a ROOM RECOGNITION EXPERT AGENT.

Your SOLE Purpose:
Identify every Room/Space in the drawing and define its EXACT PERIMETER BOUNDARY.

TASK:
- Identify all rooms based on their text labels (e.g. "Living Room", "Kitchen", "Bed 1").
- Create a bounding box that covers the ENTIRE room area, up to the surrounding walls.
- Include the walls in the bounding box if possible.

COORDINATE SYSTEM:
- Return NORMALIZED COORDINATES (0-1000).
- 0,0 = Top Left of IMAGE CANVAS. 1000,1000 = Bottom Right of IMAGE CANVAS.
- Include WHITE MARGINS in your scale. Do NOT crop.

OUTPUT FORMAT (JSON ONLY):
{
  "rooms": [
    { "name": "Living Room", "bbox": [100, 100, 500, 500] },
    { "name": "Kitchen", "bbox": [600, 100, 900, 400] }
  ]
}
`;

export async function extractRooms(imagePath: string): Promise<RoomExtractionResult> {
    try {
        const absolutePath = path.isAbsolute(imagePath)
            ? imagePath
            : path.join(process.cwd(), imagePath.replace(/^\//, ''));

        if (!fs.existsSync(absolutePath)) {
            return { success: false, rooms: [], error: `File not found: ${absolutePath}` };
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

                // @ts-ignore
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';

                const fileBuffer = fs.readFileSync(absolutePath);
                const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer), verbosity: 0 });
                const doc = await loadingTask.promise;

                // Process Page 1 ONLY for Room Map (Multi-page room mapping is complex, starting with p1)
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

                console.log(`🏠 Room Agent converted PDF Page 1 to JPEG.`);

            } catch (pdfErr: any) {
                console.error("🏠 Room Agent PDF Conversion Failed:", pdfErr);
                return { success: false, rooms: [], error: "PDF Conversion Failed: " + pdfErr.message };
            }

        } else {
            // Regular Image
            const imageBuffer = fs.readFileSync(absolutePath);
            base64Image = imageBuffer.toString('base64');
            mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        }

        console.log(`🏠 Room Agent scanning: ${path.basename(absolutePath)}`);

        const response = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: ROOM_PROMPT },
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
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0].message.content;
        if (!raw) throw new Error("Empty response from AI");

        const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson(raw));

        // Post-processing to ensure bbox format
        const cleanRooms = (parsed.rooms || []).map((el: any) => ({
            name: el.name || "Unknown Room",
            page: 1,
            bbox: el.bbox?.map((n: number) => Math.round(n)) // Ensure integers
        }));

        console.log(`🏠 Room Agent found ${cleanRooms.length} rooms.`);
        return {
            success: true,
            rooms: cleanRooms
        };

    } catch (error: any) {
        console.error("🏠 Room Agent failed:", error);
        return { success: false, rooms: [], error: error.message };
    }
}
