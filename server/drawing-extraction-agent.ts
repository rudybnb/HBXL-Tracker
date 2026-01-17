/**
 * Drawing Extraction Agent
 * Uses GPT-4 Vision to analyze construction drawings and extract element data
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
            throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your Render environment variables.');
        }
        openai = new OpenAI({
            apiKey,
            timeout: 60000,  // 60 second timeout to prevent infinite hangs
            maxRetries: 2    // Retry failed requests up to 2 times
        });
    }
    return openai;
}

// Room extracted from drawing (no costs - costs come from HBXL CSV)
export interface ExtractedRoom {
    name: string;             // "Lounge", "Bathroom", "Kitchen"
    floor: string;            // "Ground", "First", "Second"
    dimensions: string | null; // "4850mm x 3600mm"
    area: number | null;      // 17.46 sqm
    elements: string[];       // ["D01", "W01", "WC", "Basin"]
}

// Instruction/note extracted from drawing
export interface ExtractedInstruction {
    type: string;             // "note", "specification", "material"
    text: string;             // The actual text content
    location?: string;        // Where on drawing (optional)
}

// Detailed element with code (doors, windows, fixtures)
export interface ExtractedDetailedElement {
    code: string;             // "D01", "W01"
    type: string;             // "door", "window", "fixture"
    description: string;      // "Internal door 762mm"
    room: string;             // Which room it belongs to
    size?: string;            // "762 x 1981mm"
}

// Work flow analysis
export interface ExtractedWorkFlow {
    sequence: string[];       // Construction sequence
    trades: string[];         // Required trades
    notes: string[];          // Additional notes
}

// Legacy interface kept for backward compatibility
export interface ExtractedElement {
    elementType: string;
    elementCode: string | null;
    description: string;
    dimensions: string | null;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
    location: string | null;
    roomName: string;
    material: string | null;
    notes: string | null;
}

export interface ExtractionResult {
    success: boolean;
    rooms: ExtractedRoom[];                    // Stage 1: Rooms
    instructions: ExtractedInstruction[];       // Stage 2: Instructions/Notes
    detailedElements: ExtractedDetailedElement[]; // Stage 3: Elements with codes
    workFlow?: ExtractedWorkFlow;              // Stage 4: Work flow
    elements: ExtractedElement[];              // Legacy: kept for compatibility
    rawResponse: string;
    error?: string;
}



const EXTRACTION_PROMPT = `You are the QS MANDATORY CHECKLIST AGENT.
Your instructions are to performing a "pre-flight" quantity survey on this drawing.
You must not skip steps. You must work sequentially.

---
MASTER SEQUENCE (LOCKED ORDER)
1. Foundations (Excavation, Concrete, Blockwork)
2. Foundation Build-Up (Hardcore, Blinding)
3. Damp Proof Course (DPC)
4. Ground Floor Build-Up (Insulation, DPM)
5. Concrete Slab
6. Screed
7. External Walls / Brickwork (Perimeter, Inner/Outer Leaf)
8. Roof (Trusses, Tiles, Fascias, Gutters)
9. Internal Rooms (Sequentially)
---

INSTRUCTIONS:
For Steps 1-8 (GLOBAL ELEMENTS):
- Look for these specific items on the plan.
- If found, list them with a QUANTITY (e.g., "120 sqm", "45 lm", "1 item").
- If not explicitly dimensioned, ESTIMATE based on scale or Count items (e.g. "1 Roof").
- Group these under "globalElements".

For Step 9 (INTERNAL ROOMS):
- Identify every room.
- For EACH room, run this sub-checklist:
   - Electrical: Sockets (Count), Lights (Count), Switches (Count)
   - Plumbing: Radiators, Sanitaryware (WC, Basin, Shower)
   - Doors: Internal doors
   - Finishes: Floor/Wall type (if labeled)
- Group these under "rooms".

---
FORMAT:
Return ONLY purely valid JSON. No markdown.
{
  "success": true,
  "globalElements": [
    { "category": "Foundations", "item": "Strip Foundation", "quantity": "45 lm", "description": "Standard strip foundation" },
    { "category": "External Walls", "item": "Brickwork Outer Leaf", "quantity": "120 sqm", "description": "Facing brick" }
  ],
  "rooms": [
    {
      "name": "Lounge",
      "floor": "Ground",
      "elements": [
         { "category": "Electrical", "item": "Double Socket", "quantity": "4", "description": "White plastic double socket" },
         { "category": "Doors", "item": "Internal Door", "quantity": "1", "description": "Standard door leaf" }
      ]
    }
  ]
}`;



/**
 * Extract elements from an image or PDF file using GPT-4 Vision
 */
export async function extractFromImage(imagePath: string): Promise<ExtractionResult> {
    try {
        // Read image and convert to base64
        const absolutePath = path.isAbsolute(imagePath)
            ? imagePath
            : path.join(process.cwd(), imagePath.replace(/^\//, ''));

        if (!fs.existsSync(absolutePath)) {
            return {
                success: false,
                rooms: [],
                elements: [],
                rawResponse: '',
                error: `File not found: ${absolutePath} `
            };
        }

        const ext = path.extname(imagePath).toLowerCase();
        let base64Image: string;
        let mimeType: string;

        // Handle PDF files by converting to image using pdfjs-dist + canvas (Node.js compatiable)
        if (ext === '.pdf') {
            console.log(`📄 PDF detected, converting to image using pdfjs-dist & canvas...`);

            try {
                // Dynamic imports to ensure they are available
                const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const { createCanvas } = await import('canvas');

                // Polyfill DOMMatrix if missing (needed for pdfjs-dist legacy in Node)
                if (!global.DOMMatrix) {
                    // @ts-ignore
                    global.DOMMatrix = class DOMMatrix {
                        constructor() {
                            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
                        }
                    }
                }

                // Read file buffer
                const fileBuffer = fs.readFileSync(absolutePath);
                const data = new Uint8Array(fileBuffer);

                // Load PDF document
                // Note: In Node environments, we might need to set workerSrc or disable worker
                // For simplified usage, we'll try standard loading which works given the dependencies are present
                const loadingTask = pdfjsLib.getDocument({
                    data,
                    // Disable font face rules which can cause issues in Node canvas
                    disableFontFace: true,
                    // Legacy build verbosity control to avoid warning spam
                    verbosity: 0
                });

                const doc = await loadingTask.promise;
                console.log(`   PDF Loaded. Pages: ${doc.numPages}`);

                // Get first page
                const page = await doc.getPage(1);

                // Set scale for good resolution (2.0 = 200% size, good for text extraction)
                const scale = 2.0;
                const viewport = page.getViewport({ scale });

                console.log(`   Rendering Page 1 (Size: ${viewport.width}x${viewport.height})...`);

                // Create Node Canvas
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // Render PDF page to canvas
                await page.render({
                    canvasContext: context as any,
                    viewport: viewport
                }).promise;

                // Convert to PNG buffer
                base64Image = canvas.toBuffer('image/png').toString('base64');
                mimeType = 'image/png';

                console.log(`✅ PDF converted to image successfully via pdfjs-dist`);

            } catch (pdfError: any) {
                console.error(`❌ PDF conversion error (pdfjs-dist):`, pdfError);
                return {
                    success: false,
                    rooms: [],
                    instructions: [],
                    detailedElements: [],
                    elements: [],
                    rawResponse: '',
                    error: `PDF conversion failed: ${pdfError.message}. Please upload a JPG/PNG image.`
                };
            }
        } else {
            // Regular image file
            const imageBuffer = fs.readFileSync(absolutePath);
            base64Image = imageBuffer.toString('base64');

            // Determine MIME type from extension
            mimeType = ext === '.png' ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                    : ext === '.gif' ? 'image/gif'
                        : ext === '.webp' ? 'image/webp'
                            : 'image/png'; // default
        }

        console.log(`🔍 Analyzing drawing: ${path.basename(imagePath)} `);

        const response = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o', // GPT-4 with vision
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: EXTRACTION_PROMPT },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType}; base64, ${base64Image} `,
                                detail: 'high' // High detail for construction drawings
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0.1 // Low temperature for consistent extraction
        });

        const content = response.choices[0]?.message?.content || '';
        console.log(`📊 GPT - 4 Vision response received(${content.length} chars)`);

        // Parse JSON response
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const rooms: ExtractedRoom[] = [];
            const instructions: ExtractedInstruction[] = [];
            const detailedElements: ExtractedDetailedElement[] = [];
            let workFlow: ExtractedWorkFlow | undefined;

            // Stage 1: Parse rooms from AI response
            if (parsed.rooms && Array.isArray(parsed.rooms)) {
                for (const r of parsed.rooms) {
                    rooms.push({
                        name: r.name || r.roomName || 'Unknown Room',
                        floor: r.floor || 'Ground',
                        dimensions: r.dimensions || null,
                        area: typeof r.area === 'number' ? r.area : (typeof r.roomArea === 'number' ? r.roomArea : null),
                        elements: Array.isArray(r.elements) ? r.elements : []
                    });
                }
            }

            // Stage 2: Parse instructions/notes
            if (parsed.instructions && Array.isArray(parsed.instructions)) {
                for (const inst of parsed.instructions) {
                    instructions.push({
                        type: inst.type || 'note',
                        text: inst.text || '',
                        location: inst.location
                    });
                }
            }

            // Stage 3: Parse detailed elements (doors, windows, fixtures)
            // Handle both "detailedElements" (new prompt) and "elements" (legacy/hallucinated)
            const aiElements = parsed.detailedElements || parsed.elements;
            if (aiElements && Array.isArray(aiElements)) {
                for (const elem of aiElements) {
                    detailedElements.push({
                        code: elem.code || 'Unknown',
                        type: elem.type || 'unknown',
                        description: elem.description || '',
                        room: elem.room || 'Unknown',
                        size: elem.size
                    });
                }
            }

            // Stage 4: Parse work flow
            if (parsed.workFlow) {
                workFlow = {
                    sequence: Array.isArray(parsed.workFlow.sequence) ? parsed.workFlow.sequence : [],
                    trades: Array.isArray(parsed.workFlow.trades) ? parsed.workFlow.trades : [],
                    notes: Array.isArray(parsed.workFlow.notes) ? parsed.workFlow.notes : []
                };
            }

            console.log(`✅ Comprehensive extraction complete: `);
            console.log(`   📍 Rooms: ${rooms.length} `);
            console.log(`   📝 Instructions: ${instructions.length} `);
            console.log(`   🚪 Elements: ${detailedElements.length} `);
            console.log(`   🔧 Work Flow: ${workFlow ? 'Yes' : 'No'} `);

            for (const room of rooms) {
                console.log(`   📍 ${room.name}: ${room.dimensions || 'no dimensions'}, ${room.area ? room.area + ' sqm' : 'no area'} `);
            }

            return {
                success: true,
                rooms,
                instructions,
                detailedElements,
                workFlow,
                elements: [], // Legacy: empty - costs come from CSV now
                rawResponse: content
            };

        } catch (parseError) {
            console.error('❌ Failed to parse extraction response:', parseError);
            return {
                success: false,
                rooms: [],
                instructions: [],
                detailedElements: [],
                elements: [],
                rawResponse: content,
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)} `
            };
        }

    } catch (error) {
        console.error('❌ Extraction error:', error);
        return {
            success: false,
            rooms: [],
            instructions: [],
            detailedElements: [],
            elements: [],
            rawResponse: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract elements from a URL (for cloud-hosted images)
 */
export async function extractFromUrl(imageUrl: string): Promise<ExtractionResult> {
    try {
        console.log(`🔍 Analyzing drawing from URL: ${imageUrl} `);

        const response = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: EXTRACTION_PROMPT },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0.1
        });

        const content = response.choices[0]?.message?.content || '';

        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const elements: ExtractedElement[] = (parsed.elements || []).map((e: any) => ({
                elementType: e.elementType || 'other',
                elementCode: e.elementCode || null,
                description: e.description || 'Unknown element',
                dimensions: e.dimensions || null,
                quantity: typeof e.quantity === 'number' ? e.quantity : 1,
                location: e.location || null,
                material: e.material || null,
                notes: e.notes || null
            }));

            console.log(`✅ Extracted ${elements.length} elements from URL`);

            return {
                success: true,
                elements,
                rawResponse: content
            };

        } catch (parseError) {
            return {
                success: false,
                elements: [],
                rawResponse: content,
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)} `
            };
        }

    } catch (error) {
        console.error('❌ URL extraction error:', error);
        return {
            success: false,
            elements: [],
            rawResponse: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

export default {
    extractFromImage,
    extractFromUrl
};
