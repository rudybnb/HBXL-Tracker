/**
 * Drawing Extraction Agent
 * Uses GPT-4 Vision to analyze construction drawings and extract element data
 * 
 * UPGRADED: Multi-Page Support + Bounding Box Coordinates (Caddie/BildAI Features)
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
            timeout: 120000, // Increased timeout for multi-page processing
            maxRetries: 2
        });
    }
    return openai;
}

// Bounding Box: [ymin, xmin, ymax, xmax] as 0-1000 integers (normalized)
export type BoundingBox = [number, number, number, number];

// Room extracted from drawing (no costs - costs come from HBXL CSV)
export interface ExtractedRoom {
    name: string;             // "Lounge", "Bathroom", "Kitchen"
    floor: string;            // "Ground", "First", "Second"
    dimensions: string | null; // "4850mm x 3600mm"
    area: number | null;      // 17.46 sqm
    elements: string[];       // ["D01", "W01", "WC", "Basin"]
    page: number;             // Page number (1-based)
    bbox?: BoundingBox;       // Location of room label
}

// Instruction/note extracted from drawing
export interface ExtractedInstruction {
    type: string;             // "note", "specification", "material"
    text: string;             // The actual text content
    location?: string;        // Where on drawing (optional)
    page: number;
    bbox?: BoundingBox;
}

// Detailed element with code (doors, windows, fixtures)
export interface ExtractedDetailedElement {
    code: string;             // "D01", "W01"
    type: string;             // "door", "window", "fixture"
    description: string;      // "Internal door 762mm"
    room: string;             // Which room it belongs to
    size?: string;            // "762 x 1981mm"
    page: number;
    bbox?: BoundingBox;
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
    detailedElements: ExtractedDetailedElement[]; // Stage 3: Windows/Doors/Sockets
    instructions: ExtractedInstruction[];       // Stage 2: Instructions/Notes
    // detailedElements: ExtractedDetailedElement[]; // DUPLICATE REMOVED
    workFlow?: ExtractedWorkFlow;              // Stage 4: Work flow
    elements: ExtractedElement[];              // Legacy: kept for compatibility
    rawResponse: string;
    error?: string;
    pageCount: number;
}


const EXTRACTION_PROMPT = `You are a STRUCTURAL ELEMENT EXPERT AGENT.

Your SOLE Purpose:
Identify FIXED STRUCTURAL ELEMENTS (Doors, Windows, Sanitary) with high precision.
You do NOT care about room names, labels, or electrical symbols.

CRITICAL - COORDINATE SYSTEM:
- Return NORMALIZED COORDINATES based on a 0-1000 scale.
- 0 = Top/Left, 1000 = Bottom/Right.
- Format: [xmin, ymin, xmax, ymax]
- IMPORANT: 0-1000 scale applies to the FULL IMAGE CANVAS, including any white margins or borders.
- Do NOT crop the image mentally. (0,0) is the top-left pixel of the file.

TASK: STRUCTURAL ELEMENT EXTRACTION
Identify boundaries and fixed building elements.

SYMBOLS TO FIND:
1. WINDOWS ("window"):
   - Double lines in walls, rectangular frames.
   - Bay windows, sliding doors.

2. DOORS ("door"):
   - Quarter-circle arc showing door swing.
   - Sliding doors, French doors.

3. SANITARYWARE ("sanitary"):
   - Toilets (WC), Sinks (Basins), Showers, Baths.
   - Fixed joinery.

DO NOT EXTRACT:
- Do NOT extract Room Names. (Another agent handles this).
- Do NOT extract Lights, Sockets, or Switches. (Electrical agent handles these).

OUTPUT FORMAT (JSON ONLY):
{
  "detailedElements": [
      { "type": "window", "name": "Standard Window", "bbox": [10, 10, 50, 20] },
      { "type": "sanitary", "name": "WC", "bbox": [500, 500, 550, 550] }
  ]
}
`;

/**
 * Extract elements from an image or PDF file using GPT-4 Vision
 * Supports MULTI-PAGE processing for PDFs.
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
                instructions: [],
                detailedElements: [],
                elements: [],
                rawResponse: '',
                error: `File not found: ${absolutePath}`,
                pageCount: 0
            };
        }

        const ext = path.extname(imagePath).toLowerCase();
        let imagesToProcess: { base64: string; mimeType: string, pageNumber: number }[] = [];

        // Handle PDF files (Revert to pdfjs-dist /w JPEG output + White BG to fix transparency)
        if (ext === '.pdf') {
            console.log(`📄 PDF detected. Using pdfjs-dist (Node Environment) for conversion...`);

            try {
                // Polyfill DOMMatrix BEFORE import (Critical for Node.js PDFJS)
                if (!global.DOMMatrix) {
                    // @ts-ignore
                    global.DOMMatrix = class DOMMatrix {
                        constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
                    }
                }

                // Use Standard Import for Node Environment
                const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const { createCanvas } = await import('canvas');

                // Disable Worker logic for Node to prevent external script loading issues
                // @ts-ignore
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';

                const fileBuffer = fs.readFileSync(absolutePath);
                const data = new Uint8Array(fileBuffer);

                // Fix "Standard Font" loading error in Node
                const standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');

                const loadingTask = pdfjsLib.getDocument({
                    data,
                    disableFontFace: false, // Let fonts load
                    verbosity: 0,
                    standardFontDataUrl
                });

                const doc = await loadingTask.promise;
                console.log(`   PDF Loaded. Pages: ${doc.numPages}`);

                for (let i = 1; i <= doc.numPages; i++) {
                    if (i > 5) break;

                    console.log(`   Processing Page ${i}...`);
                    const page = await doc.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });

                    const canvas = createCanvas(viewport.width, viewport.height);
                    const context = canvas.getContext('2d');

                    // FORCE WHITE BACKGROUND (Opaque JPEG)
                    context.fillStyle = '#FFFFFF';
                    context.fillRect(0, 0, viewport.width, viewport.height);

                    // Render
                    await page.render({
                        canvasContext: context as any,
                        viewport: viewport
                    }).promise;

                    // OUTPUT AS JPEG (Guarantee Opaque) and save with .png extension for frontend
                    const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

                    if (i === 1) {
                        const previewPath = absolutePath + '.png';
                        fs.writeFileSync(previewPath, jpegBuffer);
                        console.log(`🖼️ Saved Preview (JPEG) to: ${previewPath}`);
                    }

                    imagesToProcess.push({
                        base64: jpegBuffer.toString('base64'),
                        mimeType: 'image/jpeg', // Tell AI it's a JPEG
                        pageNumber: i
                    });
                }

                console.log(`✅ Conversion Success.`);

            } catch (err: any) {
                console.error("❌ PDFJS Conversion Error:", err);
                return {
                    success: false,
                    error: `PDF Error: ${err.message}`,
                    rooms: [], instructions: [], detailedElements: [], elements: [], rawResponse: '', pageCount: 0
                };
            }
        } else {
            // Regular image file (Single Page)
            const imageBuffer = fs.readFileSync(absolutePath);
            const base64Image = imageBuffer.toString('base64');

            // Determine MIME type from extension
            const mimeType = ext === '.png' ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                    : ext === '.gif' ? 'image/gif'
                        : ext === '.webp' ? 'image/webp'
                            : 'image/png'; // default

            imagesToProcess.push({ base64: base64Image, mimeType, pageNumber: 1 });
        }

        // ============================================
        // PROCESS EACH PAGE WITH GPT-4 VISION
        // ============================================

        const allRooms: ExtractedRoom[] = [];
        const allInstructions: ExtractedInstruction[] = [];
        const allDetailedElements: ExtractedDetailedElement[] = [];
        let combinedRawResponse = '';
        let lastWorkFlow: ExtractedWorkFlow | undefined;

        console.log(`🔍 Starting AI Analysis on ${imagesToProcess.length} pages...`);

        for (const pageData of imagesToProcess) {
            console.log(`   🚀 Analyzing Page ${pageData.pageNumber}...`);

            try {
                const response = await getOpenAIClient().chat.completions.create({
                    model: 'gpt-4o', // GPT-4 with vision
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: `${EXTRACTION_PROMPT}\n\nTHIS IS PAGE ${pageData.pageNumber}.` },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${pageData.mimeType}; base64, ${pageData.base64}`,
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
                console.log(`      Response received (${content.length} chars)`);
                combinedRawResponse += `\n--- PAGE ${pageData.pageNumber} ---\n${content}`;

                // Parse JSON response
                try {
                    // Extract JSON from response (in case there's extra text)
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0].replace(/```json/g, '').replace(/```/g, '')); // Robust clean

                        // Stage 1: Parse rooms
                        if (parsed.rooms && Array.isArray(parsed.rooms)) {
                            for (const r of parsed.rooms) {
                                allRooms.push({
                                    name: r.name || r.roomName || 'Unknown Room',
                                    floor: r.floor || 'Ground',
                                    dimensions: r.dimensions || null,
                                    area: typeof r.area === 'number' ? r.area : (typeof r.roomArea === 'number' ? r.roomArea : null),
                                    elements: Array.isArray(r.elements) ? r.elements : [],
                                    page: pageData.pageNumber,
                                    bbox: r.bbox // capture bounding box
                                });
                            }
                        }

                        // Stage 2: Parse instructions/notes
                        if (parsed.instructions && Array.isArray(parsed.instructions)) {
                            for (const inst of parsed.instructions) {
                                allInstructions.push({
                                    type: inst.type || 'note',
                                    text: inst.text || '',
                                    location: inst.location,
                                    page: pageData.pageNumber,
                                    bbox: inst.bbox
                                });
                            }
                        }

                        // Stage 3: Parse detailed elements
                        const aiElements = parsed.detailedElements || parsed.elements;
                        if (aiElements && Array.isArray(aiElements)) {
                            for (const elem of aiElements) {
                                allDetailedElements.push({
                                    code: elem.code || 'Unknown',
                                    type: elem.type || 'unknown',
                                    description: elem.description || '',
                                    room: elem.room || 'Unknown',
                                    size: elem.size,
                                    page: pageData.pageNumber,
                                    bbox: elem.bbox
                                });
                            }
                        }

                        // Capture workflow (usually same across pages, so just take last one found)
                        if (parsed.workFlow) {
                            lastWorkFlow = {
                                sequence: Array.isArray(parsed.workFlow.sequence) ? parsed.workFlow.sequence : [],
                                trades: Array.isArray(parsed.workFlow.trades) ? parsed.workFlow.trades : [],
                                notes: Array.isArray(parsed.workFlow.notes) ? parsed.workFlow.notes : []
                            };
                        }
                    }
                } catch (jsonErr) {
                    console.error(`      ⚠️ Failed to parse JSON for Page ${pageData.pageNumber}`, jsonErr);
                    // Continue to next page rather than failing entire batch
                }

            } catch (pageErr) {
                console.error(`      ❌ Error analyzing Page ${pageData.pageNumber}`, pageErr);
            }
        }

        console.log(`✅ All pages processed.`);
        console.log(`   📍 Total Rooms: ${allRooms.length}`);
        console.log(`   📝 Total Instructions: ${allInstructions.length}`);
        console.log(`   🚪 Total Elements: ${allDetailedElements.length}`);

        return {
            success: true,
            rooms: allRooms,
            instructions: allInstructions,
            detailedElements: allDetailedElements,
            workFlow: lastWorkFlow,
            elements: [], // Legacy: empty
            rawResponse: combinedRawResponse,
            pageCount: imagesToProcess.length
        };

    } catch (error) {
        console.error('❌ Extraction error:', error);
        return {
            success: false,
            rooms: [],
            instructions: [],
            detailedElements: [],
            elements: [],
            rawResponse: '',
            error: error instanceof Error ? error.message : String(error),
            pageCount: 0
        };
    }
}

/**
 * Extract elements from a URL (for cloud-hosted images)
 * Note: Still single-page for now as it's typically used for images not PDFs
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

            // Attempt to map to new structure as well if possible
            const rooms: ExtractedRoom[] = (parsed.rooms || []).map((r: any) => ({
                ...r,
                page: 1,
                bbox: r.bbox
            }));

            return {
                success: true,
                rooms,
                instructions: [],
                detailedElements: [],
                elements,
                rawResponse: content,
                pageCount: 1
            };

        } catch (parseError) {
            return {
                success: false,
                rooms: [],
                instructions: [],
                detailedElements: [],
                elements: [],
                rawResponse: content,
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                pageCount: 1
            };
        }

    } catch (error) {
        console.error('❌ URL extraction error:', error);
        return {
            success: false,
            rooms: [],
            instructions: [],
            detailedElements: [],
            elements: [],
            rawResponse: '',
            error: error instanceof Error ? error.message : String(error),
            pageCount: 0
        };
    }
}

export default {
    extractFromImage,
    extractFromUrl
};
