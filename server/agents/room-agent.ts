/**
 * Room Recognition Expert Agent
 * Specialized AI for identifying ROOMS and their PERIMETER BOUNDARIES.
 * This agent provides the "Master Map" for all other elements.
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { DOMMatrix } from '../dom-matrix-polyfill';

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
Identify every Room, Space, or Zone in the drawing and define its APPROXIMATE BOUNDARY.

TASK:
- Identify all rooms based on text labels (e.g. "Living Room", "Bed 1", "Office", "Void") OR obvious functional zones (e.g. four large rectangles in a grid).
- If text labels are missing, use generic names like "Room 1", "Room 2" based on position.
- Create a bounding box that broadly covers the room area.
- Be generous with the box - it's better to capture too much than too little.

CRITICAL COORDINATE SYSTEM:
- Return NORMALIZED COORDINATES (0-1000).
- [0,0] = Top Left of the IMAGE.
- [1000,1000] = Bottom Right of the IMAGE.
- Do NOT use typical CAD coordinates. Scale everything to 0-1000 relative to the image size.

OUTPUT FORMAT (JSON ONLY):
{
  "rooms": [
    { "name": "Living Room", "bbox": [100, 100, 500, 500] },
    { "name": "Room 1", "bbox": [600, 100, 900, 400] }
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
                // Polyfill DOMMatrix
                if (!global.DOMMatrix) {
                    // @ts-ignore
                    global.DOMMatrix = DOMMatrix;
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
