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
    rooms: ExtractedRoom[];      // New: rooms from AI
    elements: ExtractedElement[]; // Legacy: kept for compatibility
    rawResponse: string;
    error?: string;
}


const EXTRACTION_PROMPT = `You are analyzing a construction floor plan drawing.
Your job is to IDENTIFY ROOMS and their DIMENSIONS only.

**DO NOT:**
- Generate costs or rates
- Make up prices
- Estimate quantities

**DO:**
- Identify all room names visible in the drawing (e.g., "Lounge", "Bathroom", "Kitchen", "Bedroom")
- Extract room dimensions if shown (in mm or m)
- Calculate approximate floor area from dimensions
- Note any visible element codes (D01, W01, etc.) and which room they belong to

**Look for:**
- Room labels/names written on the drawing
- Dimension text (e.g., "4850", "3600mm", "2.4m")
- Door and window symbols with codes
- Bathroom fixtures (WC, basin, shower symbols)

Respond ONLY with valid JSON:
{
  "rooms": [
    {
      "name": "Lounge",
      "floor": "Ground",
      "dimensions": "4850mm x 3600mm",
      "area": 17.46,
      "elements": ["D01", "W01"]
    },
    {
      "name": "Bathroom", 
      "floor": "Ground",
      "dimensions": "2980mm x 2485mm",
      "area": 7.41,
      "elements": ["D02", "WC", "Basin", "Shower"]
    }
  ]
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
            const rooms: ExtractedRoom[] = [];

            // Parse rooms from AI response (room-only format, no costs)
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

            console.log(`✅ Identified ${rooms.length} rooms from drawing`);
            for (const room of rooms) {
                console.log(`   📍 ${room.name}: ${room.dimensions || 'no dimensions'}, ${room.area ? room.area + ' sqm' : 'no area'}`);
            }

            return {
                success: true,
                rooms,
                elements: [], // Legacy: empty - costs come from CSV now
                rawResponse: content
            };

        } catch (parseError) {
            console.error('❌ Failed to parse extraction response:', parseError);
            return {
                success: false,
                rooms: [],
                elements: [],
                rawResponse: content,
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            };
        }

    } catch (error) {
        console.error('❌ Extraction error:', error);
        return {
            success: false,
            rooms: [],
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
