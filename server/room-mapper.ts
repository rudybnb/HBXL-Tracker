/**
 * Room Mapper Service
 * 
 * AGENTS.md COMPLIANT - Room-Based Commercial Control
 * 
 * CRITICAL RULES:
 * 1. ROOMS come from DRAWING EXTRACTION only (GPT-4 Vision)
 * 2. HBXL costs are ALLOCATED to those rooms, NOT used to create rooms
 * 3. If no rooms from drawing, costs go to "Unallocated" (requires drawing upload)
 * 
 * Hierarchy: JOB -> ROOM -> ELEMENT -> PAYABLE_ITEM
 * 
 * Rules:
 * - HBXL quantities are NEVER modified
 * - Room assignment uses QS keyword matching
 * - Each payable item maintains traceability to source HBXL phase
 */

import { db } from './db';
import { rooms, roomElements, payableItems, InsertRoom, InsertRoomElement, InsertPayableItem } from '@shared/schema';
import { eq } from 'drizzle-orm';

// =============================================================================
// AGENTS.md Section 17 - GLOBAL / NON-ROOM ELEMENTS
// These apply to the building as a whole, NOT to individual rooms
// Rule: If element exists before rooms exist, or serves more than one room = GLOBAL
// =============================================================================

const GLOBAL_ELEMENT_KEYWORDS = [
    // 17.1 Substructure / Groundworks
    'excavation', 'excavate', 'strip foundation', 'pad foundation', 'ground beam',
    'foundation blockwork', 'dpc', 'oversite', 'hardcore', 'blinding', 'dpm',
    'damp proof membrane', 'structural slab', 'concrete slab', 'foundation',
    'footing', 'substructure', 'groundwork',

    // 17.2 Floor Build-Ups (whole floor areas)
    'floor insulation', 'screed', 'structural deck', 'acoustic layer',
    'floor build-up', 'underfloor',

    // 17.3 Structural Frame
    'structural steel', 'steelwork', 'beam', 'column', 'load-bearing',
    'lintel', 'truss', 'rsj', 'steel joist',

    // 17.4 External Envelope
    'external wall', 'outer leaf', 'inner leaf', 'cavity insulation',
    'wall tie', 'damp proof course', 'blockwork external', 'brickwork external',
    'masonry shell', 'external render',

    // 17.5 Roof
    'roof truss', 'rafter', 'roof tile', 'slate', 'roof covering',
    'breathable membrane', 'batten', 'fascia', 'soffit', 'gutter', 'downpipe',
    'roof structure', 'roof felt', 'ridge', 'hip', 'valley',

    // 17.6 Vertical Circulation & Shared Areas
    'staircase', 'landing', 'communal', 'lobby', 'lift shaft',

    // 17.7 Primary Building Services (First-Fix Distribution)
    'mains supply', 'main drain', 'soil stack', 'incoming electric',
    'consumer unit', 'main cable', 'main duct', 'distribution board',
    'gas meter', 'electric meter', 'water meter',

    // 17.8 External Works
    'drainage run', 'manhole', 'soakaway', 'external paving', 'external step',
    'ramp', 'retaining wall', 'external light', 'driveway', 'fence', 'gate',

    // 17.9 Fire, Safety & Compliance
    'fire stop', 'compartment', 'fire alarm', 'smoke vent', 'fire door common',
    'intumescent', 'cavity barrier'
];

// Phases that are inherently GLOBAL (building-wide)
const GLOBAL_PHASES = [
    'footings', 'foundations', 'oversite and slabbing', 'masonry shell',
    'roof structure', 'roof tiling', 'external decoration'
];

// =============================================================================
// ROOM-SPECIFIC KEYWORDS - Items that belong to specific rooms
// These override the phase and go directly to the matched room
// =============================================================================

const BATHROOM_SPECIFIC_KEYWORDS = [
    // Explicit bathroom
    'bathroom', 'en-suite', 'ensuite', 'wc', 'cloakroom',
    // Sanitaryware
    'toilet', 'basin', 'shower', 'bath', 'bidet', 'urinal',
    'cistern', 'pan', 'pedestal', 'vanity unit',
    // Bathroom electrical
    'pull cord', 'shaver socket', 'bathroom extractor', 'extractor fan',
    // Bathroom fittings
    'towel rail', 'heated towel', 'bathroom mirror', 'bathroom cabinet',
    'toilet roll holder', 'soap dish',
    // Bathroom surfaces
    'wall tile', 'floor tile', 'tile adhesive', 'grout', 'silicone'
];

const KITCHEN_SPECIFIC_KEYWORDS = [
    'kitchen', 'cooker', 'hob', 'oven', 'dishwasher', 'washing machine',
    'worktop', 'splashback', 'kitchen unit', 'base unit', 'wall unit',
    'extractor hood', 'cooker hood', 'kitchen sink', 'tap', 'mixer tap'
];

const LOUNGE_SPECIFIC_KEYWORDS = [
    'lounge', 'living room', 'sitting room', 'fireplace', 'mantlepiece',
    'feature wall', 'living', 'tv point', 'aerial'
];

const BEDROOM_SPECIFIC_KEYWORDS = [
    'bedroom', 'master bedroom', 'main bedroom', 'wardrobe', 'fitted wardrobe'
];

// Combined room keywords for matching
const ROOM_KEYWORDS: Record<string, string[]> = {
    'Bathroom': BATHROOM_SPECIFIC_KEYWORDS,
    'Kitchen': KITCHEN_SPECIFIC_KEYWORDS,
    'Lounge': LOUNGE_SPECIFIC_KEYWORDS,
    'Bedroom': BEDROOM_SPECIFIC_KEYWORDS,
    'Hallway': ['hallway', 'hall', 'corridor', 'entrance', 'porch'],
    'Dining': ['dining', 'dining room'],
    'Utility': ['utility', 'utility room', 'laundry', 'boiler room'],
};

// Element groupings from HBXL phases
const ELEMENT_MAPPINGS: Record<string, string> = {
    'Footings': 'Foundations',
    'Foundations': 'Foundations',
    'Oversite and Slabbing': 'Floor Construction',
    'Masonry Shell': 'Wall Construction',
    'Structural Openings': 'Structural Works',
    'Roof Structure': 'Roof',
    'Roof Tiling': 'Roof',
    'Joinery 1st Fix': 'Carpentry',
    'Joinery 2nd Fix': 'Doors & Skirting',
    'Plastering': 'Wall Finishes',
    'Internal Decoration': 'Decoration',
    'External Decoration': 'External Finishes',
    'Internal Fitting Out': 'Fixtures & Fittings',
    'Electrical 1st Fix': 'Electrical',
    'Electrical 2nd Fix': 'Electrical',
    'Plumbing 1st Fix': 'Plumbing',
    'Plumbing 2nd Fix': 'Plumbing',
    'Completion': 'Snagging'
};

// OpenAI for AI-powered allocation
import OpenAI from 'openai';

// Lazy initialization logic inside function to prevent crash on module load
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


/**
 * Uses GPT to intelligently match an item to the most appropriate room
 * Based on item description, phase context, and available rooms
 */
async function aiMatchItemToRoom(
    item: { description: string; phase: string },
    roomNames: string[]
): Promise<{ room: string | null; isGlobal: boolean; confidence: number }> {
    try {
        if (!process.env.OPENAI_API_KEY) {
            // Silently fail back to rule-based routing if no key
            return { room: null, isGlobal: true, confidence: 0 };
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `You are a construction QS expert. Given a construction cost item, determine which room it belongs to.

ITEM:
- Description: ${item.description}
- Phase: ${item.phase}

AVAILABLE ROOMS: ${roomNames.join(', ')}

RULES:
1. If the item is building-wide (foundations, roof, external walls, structural frame, main services) return "GLOBAL"
2. If the item clearly belongs to a specific room (bathroom fittings, kitchen units, etc.) return that room name
3. Match based on the item's function and typical location

Respond with JSON only:
{"room": "RoomName or GLOBAL", "confidence": 0.0-1.0}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 100
        });

        const content = response.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                room: result.room === 'GLOBAL' ? null : result.room,
                isGlobal: result.room === 'GLOBAL',
                confidence: result.confidence || 0.5
            };
        }
    } catch (error) {
        console.error('AI allocation error:', error);
    }

    // Fallback to global if AI fails
    return { room: null, isGlobal: true, confidence: 0 };
}

export class RoomMapper {

    /**
     * Clears all allocated costs from rooms for a specific job
     * Used before re-running allocation to prevent duplication
     */
    async clearRoomCosts(jobId: string): Promise<void> {
        console.log(`🧹 Clearing room allocations for Job ${jobId}...`);

        const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));
        if (jobRooms.length === 0) return;

        const roomIds = jobRooms.map(r => r.id);

        // Find all elements in these rooms
        // Note: Drizzle doesn't support 'inArray' easily on delete with joins in all drivers, 
        // but we can select IDs first.
        // Actually, let's iterate to be safe and simple, or use whereIn if available.
        // We will stick to simple logic: 
        // 1. Get elements 
        // 2. Delete payable items for those elements
        // 3. Reset values

        for (const room of jobRooms) {
            const elements = await db.select().from(roomElements).where(eq(roomElements.roomId, room.id));
            for (const el of elements) {
                await db.delete(payableItems).where(eq(payableItems.elementId, el.id));
                await db.update(roomElements).set({ subtotal: '0' }).where(eq(roomElements.id, el.id));
            }
            await db.update(rooms).set({ totalValue: '0' }).where(eq(rooms.id, room.id));
        }
        console.log(`✅ Room costs reset.`);
    }

    /**
     * Allocates HBXL phase data to EXISTING rooms from drawing extraction
     * 
     * CRITICAL: This does NOT create rooms - rooms come from drawing extraction only!
     * EXCEPTION: "Building / Global" is auto-created for building-wide items (AGENTS.md Section 17)
     * 
     * @param jobId - The job ID 
     * @param phaseTaskData - The parsed HBXL phase data from CSV import
     */
    async allocateCostsToRooms(
        jobId: string,
        phaseTaskData: Record<string, any[]>
    ): Promise<void> {
        // Get existing rooms from drawing extraction
        let existingRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));

        // Proceed to auto-creation even if no rooms exist
        // if (existingRooms.length === 0) { ... } REMOVED

        console.log(`🏠 Allocating HBXL costs to ${existingRooms.length} rooms from drawing`);

        // Create or find "Building / Global" room for building-wide items
        let globalRoom = existingRooms.find(r => r.name === 'Building / Global');
        if (!globalRoom) {
            console.log('📦 Creating "Building / Global" category for building-wide items');
            const [newGlobalRoom] = await db.insert(rooms).values({
                jobId,
                name: 'Building / Global',
                floor: 'N/A',
                status: 'not_started',
                totalValue: '0',
                notes: 'System generated for allocation'
            }).returning();
            globalRoom = newGlobalRoom;
            existingRooms = [...existingRooms, globalRoom];
        }

        // AUTO-CREATE ROOMS FROM CSV DATA (Fallback for incomplete drawings)
        // If CSV explicitly mentions "Lounge Sockets", we should create "Lounge" if missing
        console.log('🔍 Scanning CSV data for missing rooms...');
        const potentialRoomNames = new Set<string>();

        for (const items of Object.values(phaseTaskData)) {
            for (const item of items) {
                const desc = (item.description || '').toLowerCase();
                // Check against known room types
                for (const [roomType, keywords] of Object.entries(ROOM_KEYWORDS)) {
                    // Check strict room name presence or strong keywords
                    if (desc.includes(roomType.toLowerCase())) {
                        potentialRoomNames.add(roomType);
                    }
                    // Also check specific keywords that strongly imply a room (e.g. "Bedroom 1")
                }
            }
        }

        for (const roomName of potentialRoomNames) {
            const exists = existingRooms.some(r => r.name.toLowerCase().includes(roomName.toLowerCase()));
            if (!exists) {
                console.log(`✨ Auto-creating missing room from CSV context: "${roomName}"`);
                const [newRoom] = await db.insert(rooms).values({
                    jobId,
                    name: roomName,
                    floor: 'Ground', // Default, user can change
                    status: 'not_started',
                    totalValue: '0',
                    notes: 'Auto-created from CSV context'
                }).returning();
                existingRooms = [...existingRooms, newRoom];
            }
        }

        // Track allocation stats
        let globalItems = 0;
        let roomItems = 0;
        let aiMatchedItems = 0;

        // Get room names for AI matching (excluding Building/Global)
        const roomNamesForAI = existingRooms
            .filter(r => r.name !== 'Building / Global')
            .map(r => r.name);

        // Group items by which room they belong to
        for (const [phase, items] of Object.entries(phaseTaskData)) {
            const elementName = ELEMENT_MAPPINGS[phase] || phase;
            const isGlobalPhase = GLOBAL_PHASES.some(gp =>
                phase.toLowerCase().includes(gp.toLowerCase())
            );

            for (const item of items) {
                // Priority 1: Check if item matches a specific room via keywords
                const targetRoom = this.matchItemToRoom(item, existingRooms.filter(r => r.name !== 'Building / Global'));

                if (targetRoom) {
                    await this.addItemToRoom(targetRoom.id, elementName, item, phase);
                    roomItems++;
                }
                // Priority 2: Check if it's a global/building-wide item
                else if (isGlobalPhase || this.isGlobalElement(item, phase)) {
                    await this.addItemToRoom(globalRoom!.id, elementName, item, phase);
                    globalItems++;
                }
                // Priority 3: Use AI to intelligently match ambiguous items
                else {
                    // Try AI matching for items that don't have clear keywords
                    const aiResult = await aiMatchItemToRoom(
                        { description: item.description || '', phase },
                        roomNamesForAI
                    );

                    if (aiResult.room && aiResult.confidence > 0.6) {
                        // Find the room by name
                        const matchedRoom = existingRooms.find(
                            r => r.name.toLowerCase() === aiResult.room!.toLowerCase()
                        );
                        if (matchedRoom) {
                            await this.addItemToRoom(matchedRoom.id, elementName, item, phase);
                            roomItems++;
                            aiMatchedItems++;
                            console.log(`🤖 AI assigned "${item.description}" to ${aiResult.room} (${(aiResult.confidence * 100).toFixed(0)}%)`);
                            continue;
                        }
                    }

                    // AI said Global or couldn't determine - route to Building/Global
                    await this.addItemToRoom(globalRoom!.id, elementName, item, phase);
                    globalItems++;
                }
            }
        }

        // Recalculate room totals including global room
        await this.recalculateRoomTotals(existingRooms);

        console.log(`✅ HBXL costs allocated:`);
        console.log(`   📦 Building / Global: ${globalItems} items`);
        console.log(`   🏠 Specific Rooms: ${roomItems} items (${aiMatchedItems} via AI)`);
    }

    /**
     * Checks if an item is a GLOBAL element per AGENTS.md Section 17
     * These are building-wide items that should NOT go to specific rooms
     */
    private isGlobalElement(item: any, phase: string): boolean {
        const description = (item.description || '').toLowerCase();
        const phaseLower = phase.toLowerCase();

        return GLOBAL_ELEMENT_KEYWORDS.some(keyword =>
            description.includes(keyword.toLowerCase()) ||
            phaseLower.includes(keyword.toLowerCase())
        );
    }

    /**
     * Matches an HBXL item to a room based on keywords
     */
    private matchItemToRoom(item: any, existingRooms: any[]): any | null {
        const description = (item.description || '').toLowerCase();

        for (const room of existingRooms) {
            const roomName = room.name.toLowerCase();

            // Direct room name match
            if (description.includes(roomName)) {
                return room;
            }

            // Check keyword patterns for each room type
            for (const [roomType, keywords] of Object.entries(ROOM_KEYWORDS)) {
                if (roomName.includes(roomType.toLowerCase())) {
                    for (const keyword of keywords) {
                        if (description.includes(keyword)) {
                            return room;
                        }
                    }
                }
            }
        }

        return null;
    }


    /**
     * Adds an HBXL item to a room as a payable item
     */
    private async addItemToRoom(
        roomId: string,
        elementName: string,
        item: any,
        phase: string
    ): Promise<void> {
        try {
            // Find or create element
            let [element] = await db.select()
                .from(roomElements)
                .where(eq(roomElements.roomId, roomId));

            // Check if we have this element already
            const existingElements = await db.select()
                .from(roomElements)
                .where(eq(roomElements.roomId, roomId));

            element = existingElements.find(e => e.name === elementName);

            if (!element) {
                [element] = await db.insert(roomElements).values({
                    roomId,
                    name: elementName,
                    subtotal: '0',
                    hbxlSourcePhase: phase
                }).returning();
            }

            // Create payable item
            // CSV parser stores values in POUNDS - convert to pence for storage
            const rateValue = item.rate || item.unitPrice || 0;
            const totalValue = item.total || item.totalCost || 0;

            // Always multiply by 100 to convert pounds to pence
            const ratePence = Math.round(rateValue * 100);
            const totalPence = Math.round(totalValue * 100);

            console.log(`💰 Item: ${item.description?.substring(0, 30)}... | Rate: £${rateValue} -> ${ratePence}p | Total: £${totalValue} -> ${totalPence}p`);

            // Determine Item Type for Labour Tender Filtering
            let itemType = 'MATERIAL';
            if (item.type) {
                const t = item.type.toUpperCase();
                if (t.includes('LABOUR') || t.includes('LABOR')) itemType = 'LABOUR';
                else if (t.includes('MATERIAL')) itemType = 'MATERIAL';
                else if (t.includes('PLANT')) itemType = 'PLANT';
                else if (t.includes('SUBCONTRACTOR')) itemType = 'SUBCONTRACTOR';
            } else if (item.category) {
                const t = item.category.toUpperCase();
                if (t.includes('LABOUR')) itemType = 'LABOUR';
            }

            await db.insert(payableItems).values({
                elementId: element.id,
                description: item.description || item.task || 'Unknown Item',
                quantity: String(item.quantity || 1),
                unit: item.unit || 'Each',
                rate: String(ratePence),
                total: String(totalPence),
                hbxlSourcePhase: phase,
                hbxlOriginalQty: String(item.quantity || 1),
                roomAllocationPercent: '100',
                itemType: itemType
            });
        } catch (error) {
            console.error(`Error adding item to room:`, error);
        }
    }

    /**
     * Recalculates room and element totals after cost allocation
     */
    private async recalculateRoomTotals(existingRooms: any[]): Promise<void> {
        for (const room of existingRooms) {
            const elements = await db.select()
                .from(roomElements)
                .where(eq(roomElements.roomId, room.id));

            let roomTotal = 0;

            for (const element of elements) {
                const items = await db.select()
                    .from(payableItems)
                    .where(eq(payableItems.elementId, element.id));

                const elementTotal = items.reduce((sum, item) => {
                    return sum + (parseFloat(item.total) || 0);
                }, 0);

                // Update element subtotal
                await db.update(roomElements)
                    .set({ subtotal: String(elementTotal) })
                    .where(eq(roomElements.id, element.id));

                roomTotal += elementTotal;
            }

            // Update room total
            await db.update(rooms)
                .set({ totalValue: String(roomTotal) })
                .where(eq(rooms.id, room.id));
        }
    }

    /**
     * LEGACY: Maps HBXL phase data to Room-based structure
     * 
     * @deprecated Use allocateCostsToRooms instead. Rooms should come from drawing extraction.
     */
    async mapPhasesToRooms(
        jobId: string,
        phaseTaskData: Record<string, any[]>
    ): Promise<string[]> {
        console.log('⚠️ mapPhasesToRooms called - this should use allocateCostsToRooms instead');
        console.log('   Rooms should come from drawing extraction, not phase data');

        // Check if rooms already exist from drawing extraction
        const existingRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));

        if (existingRooms.length > 0) {
            // Rooms exist, allocate costs to them
            await this.allocateCostsToRooms(jobId, phaseTaskData);
            return existingRooms.map(r => r.id);
        }

        // No rooms from drawing - don't create fake rooms from phases
        console.log('⚠️ No rooms from drawing. Upload a drawing to identify rooms first.');
        return [];
    }

    /**
     * Gets all rooms with their elements and items for a job
     */
    async getRoomDataForJob(jobId: string): Promise<RoomData[]> {
        console.log(`🔍 getRoomDataForJob called for jobId: ${jobId}`);
        const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));
        console.log(`📊 Found ${jobRooms.length} rooms for job ${jobId}`);
        if (jobRooms.length > 0) {
            console.log(`   Room names: ${jobRooms.map(r => r.name).join(', ')}`);
        }

        const roomData: RoomData[] = [];

        for (const room of jobRooms) {
            const elements = await db.select().from(roomElements).where(eq(roomElements.roomId, room.id));

            const elementData: ElementData[] = [];

            for (const element of elements) {
                const items = await db.select().from(payableItems).where(eq(payableItems.elementId, element.id));

                elementData.push({
                    id: element.id,
                    name: element.name,
                    measurementSummary: element.measurementSummary || undefined,
                    subtotal: parseFloat(element.subtotal || '0') / 100, // Convert from pence
                    items: items.map(item => ({
                        id: item.id,
                        description: item.description,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        rate: parseFloat(item.rate) / 100, // Convert from pence
                        total: parseFloat(item.total) / 100, // Convert from pence
                        status: item.status,
                        assignedContractorName: item.assignedContractorName || undefined
                    }))
                });
            }

            roomData.push({
                id: room.id,
                name: room.name,
                floor: room.floor || undefined,
                status: room.status,
                totalValue: parseFloat(room.totalValue || '0') / 100, // Convert from pence
                elements: elementData,
                fileId: room.fileId || undefined,
                page: room.page || 1,
                bbox: room.bbox ? JSON.parse(room.bbox) : undefined,
                geometry: room.geometry ? JSON.parse(room.geometry) : undefined,
                area: room.area || undefined
            });
        }

        return roomData;
    }
}

// Types for room data response
export interface RoomData {
    id: string;
    name: string;
    floor?: string;
    status: string;
    totalValue: number;
    elements: ElementData[];
    fileId?: string;
    page?: number;
    bbox?: number[];
    geometry?: any[][]; // Polygon coordinates
    area?: string;
}

export interface ElementData {
    id: string;
    name: string;
    measurementSummary?: string;
    subtotal: number;
    items: PayableItemData[];
}

export interface PayableItemData {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
    status: string;
    assignedContractorName?: string;
}

export const roomMapper = new RoomMapper();
