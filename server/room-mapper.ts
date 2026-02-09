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
import { rooms, roomElements, payableItems, extractedElements, InsertRoom, InsertRoomElement, InsertPayableItem } from '@shared/schema';
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
// GOLDEN RULE: First Fix / Second Fix are LABELS, not payment stages.
// They help subcontractors understand sequence and help programme planning.
// They must NOT control payment — payment is always per individual item.
const ELEMENT_MAPPINGS: Record<string, string> = {
    // Global phases
    'Footings': 'Foundations',
    'Foundations': 'Foundations',
    'Oversite and Slabbing': 'Floor Construction',
    'Masonry Shell': 'Wall Construction',
    'Structural Openings': 'Structural Works',
    'Roof Structure': 'Roof',
    'Roof Tiling': 'Roof',

    // Carpentry — First Fix / Second Fix labels preserved
    'Joinery 1st Fix': 'Carpentry – First Fix',
    'Joinery 2nd Fix': 'Carpentry – Second Fix',

    // Finishes (mostly second fix only)
    'Plastering': 'Plastering',
    'Internal Decoration': 'Decoration',
    'External Decoration': 'External Finishes',
    'Internal Fitting Out': 'Fixtures & Fittings',

    // Electrical — First Fix / Second Fix labels preserved
    'Electrical 1st Fix': 'Electrical – First Fix',
    'Electrical 2nd Fix': 'Electrical – Second Fix',

    // Plumbing — First Fix / Second Fix labels preserved
    'Plumbing 1st Fix': 'Plumbing – First Fix',
    'Plumbing 2nd Fix': 'Plumbing – Second Fix',

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
     * AGENTS_SPEC.md COMPLIANT - Measurement-Based Cost Allocation
     * 
     * HOW IT WORKS:
     * 1. GLOBAL phases (Foundations, Roof, etc.) → Building / Global
     * 2. ROOM-SPECIFIC items (bathroom fixtures, kitchen units) → Direct to matched room
     * 3. DISTRIBUTABLE phases (Plastering, Decoration, Electrical, etc.) → Split proportionally
     *    by IFC-extracted measurement: floor area, wall perimeter, or element count
     * 
     * This is the QS-approved approach: Drawing tells us WHAT + HOW MUCH,
     * CSV tells us the RATE, Total = Room's share of quantity × rate
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

        // =====================================================================
        // STEP 1: Compute IFC-extracted quantities per room
        // These measurements drive the proportional allocation
        // =====================================================================
        const physicalRooms = existingRooms.filter(r => r.name !== 'Building / Global');

        // Get extracted elements for this job to count per-room items
        const allElements = await db.select().from(extractedElements).where(eq(extractedElements.jobId, jobId));

        interface RoomMeasurements {
            id: string;
            name: string;
            floorArea: number;      // m² from IFC/room polygon
            wallPerimeter: number;  // lm from room polygon perimeter
            wallArea: number;       // m² (perimeter × 2.4m ceiling height)
            ceilingArea: number;    // m² (same as floor area)
            doorCount: number;      // nr of doors in/adjacent to room
            windowCount: number;    // nr of windows in/adjacent to room
            socketCount: number;    // nr of sockets
            lightCount: number;     // nr of lights
            switchCount: number;    // nr of switches
            sanitaryCount: number;  // nr of sanitary items
            radiatorCount: number;  // nr of radiators/plumbing items
        }

        const roomMeasurements: RoomMeasurements[] = physicalRooms.map(room => {
            const area = parseFloat(room.area || '0');

            // Calculate perimeter from geometry if available
            let perimeter = 0;
            if (room.geometry) {
                try {
                    const geom = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
                    if (Array.isArray(geom) && geom.length >= 3) {
                        for (let i = 0; i < geom.length; i++) {
                            const j = (i + 1) % geom.length;
                            const dx = geom[j].x - geom[i].x;
                            const dy = geom[j].y - geom[i].y;
                            perimeter += Math.sqrt(dx * dx + dy * dy);
                        }
                        // Normalize: if coords in mm, convert to m
                        if (perimeter > 200) perimeter /= 1000;
                    }
                } catch (e) { /* ignore */ }
            }
            // Fallback: estimate perimeter from area (assume square room)
            if (perimeter === 0 && area > 0) {
                perimeter = 4 * Math.sqrt(area);
            }

            // Count elements assigned to this room
            const roomElements = allElements.filter(el => el.roomName === room.name);
            const doorCount = roomElements.filter(el => el.elementType === 'door').length;
            const windowCount = roomElements.filter(el => el.elementType === 'window').length;
            const socketCount = roomElements.filter(el => el.elementType === 'socket' || el.elementType === 'outlet').length;
            const lightCount = roomElements.filter(el => el.elementType === 'light').length;
            const switchCount = roomElements.filter(el => el.elementType === 'switch').length;
            const sanitaryCount = roomElements.filter(el => el.elementType === 'sanitary').length;
            const radiatorCount = roomElements.filter(el => el.elementType === 'plumbing' || el.elementType === 'radiator').length;

            const CEILING_HEIGHT = 2.4; // Standard UK residential

            return {
                id: room.id,
                name: room.name,
                floorArea: area,
                wallPerimeter: perimeter,
                wallArea: perimeter * CEILING_HEIGHT,
                ceilingArea: area,
                doorCount,
                windowCount,
                socketCount,
                lightCount,
                switchCount,
                sanitaryCount,
                radiatorCount
            };
        });

        // Compute totals for proportional split
        const totals = {
            floorArea: roomMeasurements.reduce((s, r) => s + r.floorArea, 0),
            wallArea: roomMeasurements.reduce((s, r) => s + r.wallArea, 0),
            wallPerimeter: roomMeasurements.reduce((s, r) => s + r.wallPerimeter, 0),
            ceilingArea: roomMeasurements.reduce((s, r) => s + r.ceilingArea, 0),
            doorCount: roomMeasurements.reduce((s, r) => s + r.doorCount, 0),
            windowCount: roomMeasurements.reduce((s, r) => s + r.windowCount, 0),
            socketCount: roomMeasurements.reduce((s, r) => s + r.socketCount, 0),
            lightCount: roomMeasurements.reduce((s, r) => s + r.lightCount, 0),
            switchCount: roomMeasurements.reduce((s, r) => s + r.switchCount, 0),
            sanitaryCount: roomMeasurements.reduce((s, r) => s + r.sanitaryCount, 0),
            radiatorCount: roomMeasurements.reduce((s, r) => s + r.radiatorCount, 0),
        };

        console.log('📐 Room Measurements for allocation:');
        roomMeasurements.forEach(r => {
            console.log(`   ${r.name}: ${r.floorArea.toFixed(1)}m² floor, ${r.wallPerimeter.toFixed(1)}lm perimeter, ${r.doorCount}D ${r.windowCount}W ${r.socketCount}S ${r.lightCount}L`);
        });

        // =====================================================================
        // STEP 2: Define which measurement drives each phase's allocation
        // =====================================================================
        type MeasurementBasis = 'floorArea' | 'wallArea' | 'wallPerimeter' | 'ceilingArea' |
            'doorCount' | 'windowCount' | 'socketCount' | 'lightCount' |
            'switchCount' | 'sanitaryCount' | 'radiatorCount';

        const PHASE_MEASUREMENT_BASIS: Record<string, MeasurementBasis> = {
            // Area-based phases
            'Plastering': 'wallArea',
            'Internal Decoration': 'wallArea',
            'Internal Fitting Out': 'floorArea',

            // Perimeter-based phases (skirting, dado, picture rails)
            'Joinery 2nd Fix': 'wallPerimeter',

            // Element count phases
            'Structural Openings': 'doorCount',     // Lintels over openings
            'Joinery 1st Fix': 'doorCount',          // Door linings, frames
            'Electrical 1st Fix': 'socketCount',     // Cabling to sockets
            'Electrical 2nd Fix': 'socketCount',     // Socket/switch faceplates
            'Plumbing 1st Fix': 'sanitaryCount',     // Pipe runs
            'Plumbing 2nd Fix': 'sanitaryCount',     // Sanitary fittings
        };

        // Track allocation stats
        let globalItems = 0;
        let roomSpecificItems = 0;
        let distributedItems = 0;

        // =====================================================================
        // STEP 3: Allocate each phase
        // =====================================================================
        for (const [phase, items] of Object.entries(phaseTaskData)) {
            const elementName = ELEMENT_MAPPINGS[phase] || phase;
            const isGlobalPhase = GLOBAL_PHASES.some(gp =>
                phase.toLowerCase().includes(gp.toLowerCase())
            );

            // RULE 1: Global phases → Building / Global
            if (isGlobalPhase) {
                for (const item of items) {
                    await this.addItemToRoom(globalRoom!.id, elementName, item, phase);
                    globalItems++;
                }
                console.log(`📦 ${phase}: ${items.length} items → Building / Global`);
                continue;
            }

            // RULE 2: Check each item for room-specific keywords first
            const measurementBasis = PHASE_MEASUREMENT_BASIS[phase];
            const unmatched: any[] = [];

            for (const item of items) {
                // Check for global element keywords
                if (this.isGlobalElement(item, phase)) {
                    await this.addItemToRoom(globalRoom!.id, elementName, item, phase);
                    globalItems++;
                    continue;
                }

                // Check for room-specific keywords (e.g., "bathroom basin", "kitchen sink")
                const targetRoom = this.matchItemToRoom(item, physicalRooms);
                if (targetRoom) {
                    await this.addItemToRoom(targetRoom.id, elementName, item, phase);
                    roomSpecificItems++;
                    continue;
                }

                // No keyword match — collect for proportional distribution
                unmatched.push(item);
            }

            // RULE 3: Distribute unmatched items proportionally by measurement
            if (unmatched.length > 0 && measurementBasis && physicalRooms.length > 0) {
                // Get the total measurement for the relevant basis
                const totalMeasurement = totals[measurementBasis];

                if (totalMeasurement > 0) {
                    console.log(`📐 ${phase}: Distributing ${unmatched.length} items by ${measurementBasis} (total: ${totalMeasurement.toFixed(1)})`);

                    for (const item of unmatched) {
                        const itemTotal = item.total || item.totalCost || 0;
                        const itemRate = item.rate || item.unitPrice || 0;

                        // Split this item across rooms proportionally
                        for (const rm of roomMeasurements) {
                            const roomMeasure = rm[measurementBasis];
                            if (roomMeasure <= 0) continue;

                            const proportion = roomMeasure / totalMeasurement;
                            const roomTotal = itemTotal * proportion;
                            const roomQty = (item.quantity || 1) * proportion;

                            // Create a proportional copy of the item
                            const proportionalItem = {
                                ...item,
                                quantity: parseFloat(roomQty.toFixed(2)),
                                total: parseFloat(roomTotal.toFixed(2)),
                                rate: itemRate, // Rate stays the same
                                description: `${item.description || 'Item'} (${(proportion * 100).toFixed(0)}% of total)`
                            };

                            await this.addItemToRoom(rm.id, elementName, proportionalItem, phase);
                        }
                        distributedItems++;
                    }
                } else {
                    // No measurement data — fall back to equal split
                    console.log(`⚖️ ${phase}: Equal split for ${unmatched.length} items (no ${measurementBasis} data)`);
                    const proportion = 1 / physicalRooms.length;

                    for (const item of unmatched) {
                        const itemTotal = item.total || item.totalCost || 0;

                        for (const room of physicalRooms) {
                            const roomTotal = itemTotal * proportion;
                            const roomQty = (item.quantity || 1) * proportion;

                            const proportionalItem = {
                                ...item,
                                quantity: parseFloat(roomQty.toFixed(2)),
                                total: parseFloat(roomTotal.toFixed(2)),
                                description: `${item.description || 'Item'} (equal split ${physicalRooms.length} rooms)`
                            };

                            await this.addItemToRoom(room.id, elementName, proportionalItem, phase);
                        }
                        distributedItems++;
                    }
                }
            } else if (unmatched.length > 0) {
                // No measurement basis defined for this phase — distribute by floor area (safest default)
                const totalArea = totals.floorArea;

                if (totalArea > 0 && physicalRooms.length > 0) {
                    console.log(`📐 ${phase}: Distributing ${unmatched.length} items by floor area (default)`);

                    for (const item of unmatched) {
                        const itemTotal = item.total || item.totalCost || 0;

                        for (const rm of roomMeasurements) {
                            if (rm.floorArea <= 0) continue;
                            const proportion = rm.floorArea / totalArea;
                            const roomTotal = itemTotal * proportion;
                            const roomQty = (item.quantity || 1) * proportion;

                            const proportionalItem = {
                                ...item,
                                quantity: parseFloat(roomQty.toFixed(2)),
                                total: parseFloat(roomTotal.toFixed(2)),
                                description: `${item.description || 'Item'} (${(proportion * 100).toFixed(0)}% by area)`
                            };

                            await this.addItemToRoom(rm.id, elementName, proportionalItem, phase);
                        }
                        distributedItems++;
                    }
                } else {
                    // Absolute fallback: no rooms or no areas — everything to global
                    for (const item of unmatched) {
                        await this.addItemToRoom(globalRoom!.id, elementName, item, phase);
                        globalItems++;
                    }
                }
            }
        }

        // Recalculate room totals including global room
        await this.recalculateRoomTotals(existingRooms);

        console.log(`✅ AGENTS_SPEC.md Measurement-Based Allocation Complete:`);
        console.log(`   📦 Building / Global: ${globalItems} items`);
        console.log(`   🏷️ Room-Specific (keyword): ${roomSpecificItems} items`);
        console.log(`   📐 Distributed by measurement: ${distributedItems} items across ${physicalRooms.length} rooms`);
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
        const allJobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));
        console.log(`📊 Found ${allJobRooms.length} total rooms for job ${jobId}`);

        // AGENTS_SPEC: Only show physical rooms (from IFC drawing) + Building / Global
        // Phase-named rooms (Masonry Shell, Foundations, etc.) from old CSV imports are excluded
        const jobRooms = allJobRooms.filter(r => {
            const isGlobal = r.name === 'Building / Global';
            const hasGeometry = r.geometry && r.geometry !== 'null' && r.geometry !== '[]';
            return isGlobal || hasGeometry;
        });

        console.log(`🏠 Showing ${jobRooms.length} rooms (filtered from ${allJobRooms.length})`);
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
                        status: item.status,
                        assignedContractorName: item.assignedContractorName || undefined,
                        itemType: item.itemType || "MATERIAL"
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
    itemType?: string;
}

export const roomMapper = new RoomMapper();
