/**
 * Drawing Extraction Agent
 * Uses GPT-4 Vision to analyze construction drawings and extract element data
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export interface ExtractedElement {
    elementType: string;      // "door", "window", "wall", "floor", "ceiling", "roof", "structural", "electrical", "plumbing"
    elementCode: string | null; // "D01", "W03", "W-BATH-01"
    description: string;      // "Internal Fire Door Type B"
    dimensions: string | null; // "900x2100mm"
    quantity: number;         // 2
    location: string | null;  // "Bathroom" or "First Floor"
    material: string | null;  // "Softwood", "uPVC", etc.
    notes: string | null;     // Any additional notes from drawing
}

export interface ExtractionResult {
    success: boolean;
    elements: ExtractedElement[];
    rawResponse: string;
    error?: string;
}

const EXTRACTION_PROMPT = `You are a construction quantity surveyor analyzing architectural drawings. 
Examine this drawing carefully and extract ALL construction elements you can identify.

For each element found, provide:
- elementType: One of: door, window, wall, floor, ceiling, roof, structural, electrical, plumbing, fixture, finish, other
- elementCode: Any reference code visible (e.g., "D01", "W-03", "Type A")
- description: Detailed description of the element
- dimensions: Size/dimensions if visible (e.g., "900x2100mm", "2.4m x 3.6m")
- quantity: How many of this element are shown (default 1)
- location: Where in the building (e.g., "Ground Floor", "Kitchen", "Bathroom")
- material: Material type if indicated (e.g., "Softwood", "uPVC", "Brick")
- notes: Any additional specifications or notes

IMPORTANT:
- Extract EVERY distinct element you can see
- Include door schedules, window schedules, room names
- Note any specifications, fire ratings, acoustic ratings
- If you see a legend or key, use it to decode symbols
- For floor plans, identify rooms and their finishes

Respond ONLY with valid JSON in this exact format:
{
  "elements": [
    {
      "elementType": "door",
      "elementCode": "D01",
      "description": "Internal Fire Door FD30",
      "dimensions": "900x2100mm",
      "quantity": 2,
      "location": "First Floor Corridor",
      "material": "Softwood",
      "notes": "30 minute fire rated"
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

        const response = await openai.chat.completions.create({
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

        const response = await openai.chat.completions.create({
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
