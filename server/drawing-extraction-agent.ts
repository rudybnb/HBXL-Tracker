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

export interface ExtractedElement {
    elementType: string;      // "door", "window", "wall", "floor", "ceiling", "roof", "structural", "electrical", "plumbing"
    elementCode: string | null; // "D01", "W03", "W-BATH-01"
    description: string;      // "Internal Fire Door Type B"
    dimensions: string | null; // "900x2100mm"
    quantity: number;         // 2
    unit: string;             // "sqm", "nr", "lm"
    rate: number;             // £45.00
    total: number;            // £1012.50
    location: string | null;  // "Bathroom" or "First Floor" (deprecated, use roomName)
    roomName: string;         // "Lounge", "Bathroom"
    material: string | null;  // "Softwood", "uPVC", etc.
    notes: string | null;     // Any additional notes from drawing
}


export interface ExtractionResult {
    success: boolean;
    elements: ExtractedElement[];
    rawResponse: string;
    error?: string;
}

const EXTRACTION_PROMPT = `You are a construction Quantity Surveyor analyzing architectural drawings.
Examine this drawing carefully and extract construction elements GROUPED BY ROOM.

**STEP 1: Identify all ROOMS in the drawing**
Look for room labels like "Lounge", "Bathroom", "Kitchen", "Bedroom", etc.
If no room labels visible, infer rooms from the layout.

**STEP 2: For each ROOM, list the ELEMENTS that belong to it**
Include: doors, windows, walls, floor areas, fixtures, finishes.

**STEP 3: Calculate measurements from the drawing dimensions**
- Floor area: Calculate from room dimensions (length × width) in sqm
- Doors: Width in mm (e.g., "930mm")
- Windows: Width in mm (e.g., "1200mm")
- Walls: Calculate area from dimensions if possible

**STEP 4: Apply standard QS rates**
Use these typical UK rates:
- Floor finish: £45/sqm
- Internal door supply & fit: £350/nr
- External door supply & fit: £650/nr
- Window supply & fit: £400/sqm (use width × 1.2m height estimate)
- Wall finish (paint): £18/sqm
- Wall tiling: £65/sqm
- WC install: £450/nr
- Basin install: £350/nr
- Shower install: £800/nr
- Bath install: £500/nr

IMPORTANT:
- Group ALL elements by their ROOM
- Calculate areas from dimensions shown in drawing
- Include element codes if visible (D01, W01, etc.)

Respond ONLY with valid JSON in this exact format:
{
  "rooms": [
    {
      "roomName": "Lounge",
      "floor": "Ground",
      "roomArea": 22.5,
      "elements": [
        {
          "elementType": "floor",
          "elementCode": null,
          "description": "Floor finish",
          "quantity": 22.5,
          "unit": "sqm",
          "rate": 45,
          "total": 1012.50,
          "dimensions": "5000mm x 4500mm",
          "notes": "Standard finish"
        },
        {
          "elementType": "door",
          "elementCode": "D01",
          "description": "Internal door",
          "quantity": 1,
          "unit": "nr",
          "rate": 350,
          "total": 350,
          "dimensions": "930mm wide",
          "notes": "Standard swing door"
        }
      ],
      "roomTotal": 1362.50
    },
    {
      "roomName": "Bathroom",
      "floor": "Ground",
      "roomArea": 4.5,
      "elements": [
        {
          "elementType": "fixture",
          "elementCode": "F01",
          "description": "WC install",
          "quantity": 1,
          "unit": "nr",
          "rate": 450,
          "total": 450,
          "dimensions": null,
          "notes": "Standard WC"
        }
      ],
      "roomTotal": 450
    }
  ],
  "projectTotal": 1812.50
}`;


/**
 * Extract elements from an image file using GPT-4 Vision
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
                elements: [],
                rawResponse: '',
                error: `File not found: ${absolutePath}`
            };
        }

        const imageBuffer = fs.readFileSync(absolutePath);
        const base64Image = imageBuffer.toString('base64');

        // Determine MIME type from extension
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                : ext === '.gif' ? 'image/gif'
                    : ext === '.webp' ? 'image/webp'
                        : 'image/png'; // default

        console.log(`🔍 Analyzing drawing: ${path.basename(imagePath)}`);

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
                                url: `data:${mimeType};base64,${base64Image}`,
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
        console.log(`📊 GPT-4 Vision response received (${content.length} chars)`);

        // Parse JSON response
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const elements: ExtractedElement[] = [];

            // Handle new room-based format
            if (parsed.rooms && Array.isArray(parsed.rooms)) {
                for (const room of parsed.rooms) {
                    const roomName = room.roomName || 'Unknown Room';
                    for (const e of room.elements || []) {
                        elements.push({
                            elementType: e.elementType || 'other',
                            elementCode: e.elementCode || null,
                            description: e.description || 'Unknown element',
                            dimensions: e.dimensions || null,
                            quantity: typeof e.quantity === 'number' ? e.quantity : 1,
                            unit: e.unit || 'nr',
                            rate: typeof e.rate === 'number' ? e.rate : 0,
                            total: typeof e.total === 'number' ? e.total : 0,
                            location: roomName,  // For backward compatibility
                            roomName: roomName,
                            material: e.material || null,
                            notes: e.notes || null
                        });
                    }
                }
            }
            // Fallback: Handle old flat format
            else if (parsed.elements && Array.isArray(parsed.elements)) {
                for (const e of parsed.elements) {
                    elements.push({
                        elementType: e.elementType || 'other',
                        elementCode: e.elementCode || null,
                        description: e.description || 'Unknown element',
                        dimensions: e.dimensions || null,
                        quantity: typeof e.quantity === 'number' ? e.quantity : 1,
                        unit: e.unit || 'nr',
                        rate: typeof e.rate === 'number' ? e.rate : 0,
                        total: typeof e.total === 'number' ? e.total : 0,
                        location: e.location || null,
                        roomName: e.location || 'General',
                        material: e.material || null,
                        notes: e.notes || null
                    });
                }
            }

            console.log(`✅ Extracted ${elements.length} elements from drawing`);

            return {
                success: true,
                elements,
                rawResponse: content
            };


        } catch (parseError) {
            console.error('❌ Failed to parse extraction response:', parseError);
            return {
                success: false,
                elements: [],
                rawResponse: content,
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            };
        }

    } catch (error) {
        console.error('❌ Extraction error:', error);
        return {
            success: false,
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
        console.log(`🔍 Analyzing drawing from URL: ${imageUrl}`);

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
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
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
