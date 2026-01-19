/**
 * Electrical Expert Agent
 * Specialized AI for identifying electrical symbols (Lights, Sockets, Switches, Data)
 * with extreme precision, ignoring structural elements.
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

        // Read image
        const imageBuffer = fs.readFileSync(absolutePath);
        const base64Image = imageBuffer.toString('base64');
        const ext = path.extname(absolutePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

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

        const parsed = JSON.parse(raw);

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
