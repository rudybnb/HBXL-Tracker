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



const EXTRACTION_PROMPT = `You are an expert construction QS analyzing a construction blueprint/floor plan.
Perform a comprehensive 4-stage extraction:

=== STAGE 1: ROOMS & LAYOUT ===
- Identify ALL rooms with their names (Lounge, Kitchen, Bathroom, Bedroom, etc.)
- Extract dimensions if shown (in mm or m)
- Calculate floor area from dimensions
- Note which floor level (Ground, First, Second, etc.)

=== STAGE 2: INSTRUCTIONS & NOTES ===
- Extract ALL text notes, specifications, and annotations visible on the drawing
- Identify material callouts (e.g., "100mm concrete slab", "12.5mm plasterboard")
- Read any legend or key information
- Note any special requirements or tolerances

=== STAGE 3: ELEMENTS & ITEMS ===
For each room, identify:
- Doors with codes (D01, D02, D03...) - note size if shown
- Windows with codes (W01, W02...) - note size if shown
- Sanitaryware: WC, Basin, Shower, Bath
- Electrical: Sockets, Switches, Light points
- Kitchen fittings: Units, Worktop, Appliances
- Heating: Radiators, UFH zones

=== STAGE 4: WORK FLOW ANALYSIS ===
Based on the elements identified, suggest:
- Construction sequence (what gets built first)
- Trades required (Electrician, Plumber, Carpenter, etc.)
- Dependencies (e.g., "First fix electrical before plastering")

**IMPORTANT:**
- Do NOT invent costs or prices
- Only extract what you can see in the drawing
- If something is unclear, mark as "unclear" or omit

Respond with valid JSON ONLY:
{
  "rooms": [
    {
      "name": "Room Name",
      "floor": "Ground",
      "dimensions": "4850mm x 3600mm",
      "area": 17.46,
      "elements": ["D01", "W01", "Radiator"]
    }
  ],
  "instructions": [
    {
      "type": "note/specification/material",
      "text": "The actual text from drawing",
      "location": "Where on drawing (optional)"
    }
  ],
  "elements": [
    {
      "code": "D01",
      "type": "door",
      "description": "Internal door 762mm",
      "room": "Lounge",
      "size": "762 x 1981mm"
    },
    {
      "code": "W01",
      "type": "window",
      "description": "Double glazed window",
      "room": "Lounge",
      "size": "1200 x 1050mm"
    }
  ],
  "workFlow": {
    "sequence": ["Substructure", "Superstructure", "First Fix Electrical", "First Fix Plumbing", "Plastering", "Second Fix"],
    "trades": ["Groundworker", "Bricklayer", "Electrician", "Plumber", "Plasterer", "Joiner"],
    "notes": ["Any construction sequence notes"]
  }
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
                error: `File not found: ${absolutePath}`
            };
        }

        const ext = path.extname(imagePath).toLowerCase();
        let base64Image: string;
        let mimeType: string;

        // Handle PDF files by converting to image using pdfjs-dist
        if (ext === '.pdf') {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            console.log(`📄 PDF detected, converting to image using native poppler-utils (pdftocairo)...`);

            try {
                const os = await import('os');

                // Use system temp directory to avoid permission issues
                // tempOutputPrefix will be like /tmp/extract_123456789
                const tempDir = os.tmpdir();
                const tempOutputPrefix = path.join(tempDir, `extract_${Date.now()}_${Math.random().toString(36).substring(7)}`);

                // Command to convert first page of PDF to PNG
                // -png: Output PNG format
                // -singlefile: Output only the first page
                const command = `pdftocairo -png -singlefile -r 300 "${absolutePath}" "${tempOutputPrefix}"`;

                console.log(`🐳 PDF Conversion Details:`);
                console.log(`   Source: ${absolutePath} (Exists: ${fs.existsSync(absolutePath)})`);
                console.log(`   Target Prefix: ${tempOutputPrefix}`);
                console.log(`   Command: ${command}`);

                const { stdout, stderr } = await execAsync(command);
                if (stdout) console.log('   stdout:', stdout);
                if (stderr) console.log('   stderr:', stderr);

                // pdftocairo adds .png extension automatically
                const expectedOutputFile = `${tempOutputPrefix}.png`;

                if (fs.existsSync(expectedOutputFile)) {
                    // Read the generated PNG
                    const pngBuffer = fs.readFileSync(expectedOutputFile);
                    base64Image = pngBuffer.toString('base64');
                    mimeType = 'image/png';

                    console.log(`✅ PDF converted to image successfully via pdftocairo (${pngBuffer.length} bytes)`);

                    // Clean up temp file
                    fs.unlinkSync(expectedOutputFile);
                } else {
                    throw new Error(`Output file not created: ${expectedOutputFile}`);
                }

            } catch (pdfError: any) {
                console.error(`❌ PDF conversion error (pdftocairo):`, pdfError);
                return {
                    success: false,
                    rooms: [],
                    instructions: [],
                    detailedElements: [],
                    elements: [],
                    rawResponse: '',
                    error: `PDF conversion failed: ${pdfError.message}. Please upload a JPG/PNG image instead.`
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
            if (parsed.elements && Array.isArray(parsed.elements)) {
                for (const elem of parsed.elements) {
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

            console.log(`✅ Comprehensive extraction complete:`);
            console.log(`   📍 Rooms: ${rooms.length}`);
            console.log(`   📝 Instructions: ${instructions.length}`);
            console.log(`   🚪 Elements: ${detailedElements.length}`);
            console.log(`   🔧 Work Flow: ${workFlow ? 'Yes' : 'No'}`);

            for (const room of rooms) {
                console.log(`   📍 ${room.name}: ${room.dimensions || 'no dimensions'}, ${room.area ? room.area + ' sqm' : 'no area'}`);
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
                error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
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
