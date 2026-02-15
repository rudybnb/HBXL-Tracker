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
import { rooms, roomElements, payableItems, extractedElements, jobFiles, jobs, InsertRoom, InsertRoomElement, InsertPayableItem } from '@shared/schema';
import { eq, like, and, inArray } from 'drizzle-orm';
import * as WebIFC from 'web-ifc';
import fs from 'fs/promises';

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
    /**
     * DYNAMIC CLASSIFICATION: Reads uploaded IFC model to identify physical products.
     * Overrides CSV 'Labour' classification if the item matches a physical IFC entity.
     * Prevents hardcoding/duplicating CSV data in code.
     */
    async classifyItemsFromValidationModel(jobId: string): Promise<void> {
        console.log(`🏗️ Starting IFC-based item classification for Job ${jobId}...`);

        const files = await db.select().from(jobFiles).where(eq(jobFiles.jobId, jobId));
        const ifcFile = files.find(f => f.filename.endsWith('.ifc') || f.fileType?.includes('ifc'));

        if (!ifcFile || !ifcFile.filePath) {
            console.log(`⚠️ No IFC file found. Skipping advanced classification.`);
            return;
        }

        try {
            const content = await fs.readFile(ifcFile.filePath, 'utf-8');
            const upper = content.toUpperCase();

            const materialKeywords = new Set<string>();

            // Dynamic Mapping from IFC Entities to Material Keywords
            // If the IFC contains these entities, we treat matching items as Material (not Labour)
            if (upper.includes('IFCCABLESEGMENT')) { materialKeywords.add('cable'); materialKeywords.add('wire'); }
            if (upper.includes('IFCCABLECARRIERSEGMENT')) { materialKeywords.add('tray'); materialKeywords.add('trunking'); materialKeywords.add('basket'); }
            if (upper.includes('IFCJUNCTIONBOX')) { materialKeywords.add('box'); materialKeywords.add('patress'); }
            if (upper.includes('IFCFASTENER') || upper.includes('IFCMECHANICALFASTENER')) {
                materialKeywords.add('clip'); materialKeywords.add('screw'); materialKeywords.add('plug'); materialKeywords.add('nail'); materialKeywords.add('strap'); materialKeywords.add('band');
            }
            if (upper.includes('IFCOUTLET') || upper.includes('IFCDISTRIBUTIONELEMENT') || upper.includes('IFCSWITCHINGDEVICE')) {
                materialKeywords.add('socket'); materialKeywords.add('switch'); materialKeywords.add('plate'); materialKeywords.add('module'); materialKeywords.add('outlet');
            }
            if (upper.includes('IFCFLOWSEGMENT')) { materialKeywords.add('pipe'); materialKeywords.add('duct'); }

            if (materialKeywords.size === 0) {
                console.log('ℹ️ No specific MEP entities found in IFC. Skipping reclassification.');
                return;
            }

            console.log(`✅ IFC Analysis found entities matching: ${Array.from(materialKeywords).join(', ')}`);

            // Apply to existing items
            const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));
            let updatedCount = 0;

            for (const room of jobRooms) {
                const elements = await db.select().from(roomElements).where(eq(roomElements.roomId, room.id));
                for (const el of elements) {
                    const items = await db.select().from(payableItems).where(eq(payableItems.elementId, el.id));

                    for (const item of items) {
                        const desc = item.description.toLowerCase();
                        // Only reclassify if currently LABOUR (or unknown) and matches a confirmed material
                        // We don't touch PLANT
                        if (item.itemType === 'PLANT') continue;

                        const isMatch = Array.from(materialKeywords).some(kw => desc.includes(kw));

                        if (isMatch && item.itemType !== 'MATERIAL') {
                            await db.update(payableItems)
                                .set({ itemType: 'MATERIAL' })
                                .where(eq(payableItems.id, item.id));
                            updatedCount++;
                        }
                    }
                }
            }
            console.log(`✅ Reclassified ${updatedCount} items as MATERIAL based on IFC evidence.`);

            // 4. Update phaseTaskData (JSON Blob) to ensure Tender Documents are also correct
            // (QSCalculator reads from this blob, not the payableItems table)
            const jobRecord = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
            if (jobRecord[0] && jobRecord[0].phaseTaskData) {
                try {
                    const phaseData = JSON.parse(jobRecord[0].phaseTaskData);
                    const phases = phaseData.phases || phaseData;
                    let jsonChanged = false;

                    for (const [pName, pItems] of Object.entries(phases) as [string, any[]][]) {
                        for (const item of pItems) {
                            const desc = (item.description || item.task || "").toLowerCase();
                            if (item.resourceType === 'PLANT') continue;

                            if (Array.from(materialKeywords).some(kw => desc.includes(kw))) {
                                if (item.resourceType !== 'MATERIAL') {
                                    item.resourceType = 'MATERIAL';
                                    if (item.category) item.category = 'MATERIAL';
                                    jsonChanged = true;
                                }
                            }
                        }
                    }

                    if (jsonChanged) {
                        await db.update(jobs)
                            .set({ phaseTaskData: JSON.stringify(phaseData) })
                            .where(eq(jobs.id, jobId));
                        console.log(`✅ Sync: Updated phaseTaskData JSON blob to reflect IFC classifications.`);
                    }
                } catch (e) {
                    console.warn("Could not sync phaseTaskData JSON", e);
                }
            }

        } catch (err) {
            console.error('Error classifying from IFC:', err);
        }
    }

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
     * Helper to compute geometric metrics for a room
     */
    private calculateRoomGeometryMetrics(room: any) {
        const area = parseFloat(room.area || '0');
        let perimeter = 0;

        // Calculate perimeter from geometry if available
        if (room.geometry) {
            try {
                const geom = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
                if (Array.isArray(geom) && geom.length >= 3) {
                    for (let i = 0; i < geom.length; i++) {
                        const j = (i + 1) % geom.length;
                        const dx = (geom[j].x || geom[j][0]) - (geom[i].x || geom[i][0]);
                        const dy = (geom[j].y || geom[j][1]) - (geom[i].y || geom[i][1]);
                        perimeter += Math.sqrt(dx * dx + dy * dy);
                    }
                    // Normalize: if coords in mm (very large), convert to m
                    if (perimeter > 200) perimeter /= 1000;
                }
            } catch (e) { /* ignore */ }
        }

        // Fallback: estimate perimeter from area (assume square room)
        if (perimeter === 0 && area > 0) {
            perimeter = 4 * Math.sqrt(area);
        }

        const CEILING_HEIGHT = 2.4; // Standard UK residential

        return {
            floorArea: area,
            wallPerimeter: perimeter,
            wallArea: perimeter * CEILING_HEIGHT,
            ceilingArea: area
        };
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
                        assignedContractorName: item.assignedContractorName || undefined,
                        itemType: item.itemType || "MATERIAL",
                        hbxlSourcePhase: item.hbxlSourcePhase || undefined
                    }))
                });
            }

            const metrics = this.calculateRoomGeometryMetrics(room);

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
                area: room.area || undefined,
                metrics: metrics
            });
        }

        return roomData;
    }

    async getRoomPackagesForJob(jobId: string): Promise<any> {
        const roomsList = await this.getRoomDataForJob(jobId);
        const extracted = await db.select().from(extractedElements).where(eq(extractedElements.jobId, jobId));

        // Global Elements Categorization
        const globalItems = extracted.filter(e => e.roomName === 'Global');

        const categorizeGlobal = (items: any[]) => {
            const cats: Record<string, any[]> = {
                'Foundations / Concrete': [],
                'Ground Floor / Slab': [],
                'External Walls / Brickwork': [],
                'Roof Structure': [],
                'Roof Covering': [],
                'Other Global Items': []
            };

            items.forEach(i => {
                const t = (i.elementType || '').toLowerCase();
                const n = (i.name || '').toLowerCase();

                if (t.includes('footing') || t.includes('foundation') || n.includes('concrete')) cats['Foundations / Concrete'].push(i);
                else if (t.includes('slab') || t.includes('floor')) cats['Ground Floor / Slab'].push(i);
                else if (t.includes('wall') || t.includes('brick')) cats['External Walls / Brickwork'].push(i);
                else if (t.includes('roof') || t.includes('truss') || t.includes('rafte')) cats['Roof Structure'].push(i);
                else if (t.includes('cover') || t.includes('tile') || t.includes('felt')) cats['Roof Covering'].push(i);
                else cats['Other Global Items'].push(i);
            });

            // Remove empty categories
            Object.keys(cats).forEach(k => {
                if (cats[k].length === 0) delete cats[k];
            });

            return cats;
        };

        return {
            jobId,
            projectName: "Unknown Client",
            globalElements: categorizeGlobal(globalItems),
            rooms: roomsList.map(r => {
                // 1. Elements
                const roomExtracted = extracted.filter(e => e.roomName === r.name);

                // 2. Work Packages
                // Flatten all items from all elements
                const allItems = r.elements.flatMap(e => e.items.map(i => ({ ...i, elementName: e.name })));

                const firstFix = allItems.filter(i =>
                    (i.hbxlSourcePhase && i.hbxlSourcePhase.includes('1st Fix')) ||
                    (i.elementName.includes('First Fix')) ||
                    (i.elementName.includes('Structure')) ||
                    (i.elementName.includes('Foundations')) ||
                    (i.elementName.includes('Wall Construction'))
                );

                const secondFix = allItems.filter(i =>
                    (i.hbxlSourcePhase && i.hbxlSourcePhase.includes('2nd Fix')) ||
                    (i.elementName.includes('Second Fix')) ||
                    (i.elementName.includes('Decoration')) ||
                    (i.elementName.includes('Plastering')) ||
                    (i.elementName.includes('Finishes')) ||
                    (i.elementName.includes('Fixtures'))
                );

                const completion = allItems.filter(i =>
                    i.elementName.includes('Snagging') || i.elementName.includes('Completion')
                );

                // Derived Quantities
                const metrics = r.metrics || { floorArea: 0, wallPerimeter: 0, wallArea: 0, ceilingArea: 0 };

                // Subtract openings from wall area / perimeter
                // Helper to normalize dimensions (mm -> m)
                const parseDim = (val: string | null, defaultM: number) => {
                    let v = parseFloat(val || '0');
                    if (v === 0) return defaultM;
                    if (v > 50) return v / 1000;
                    return v;
                };

                const doorWidths = roomExtracted.filter(e => e.elementType === 'door')
                    .reduce((sum, d) => sum + parseDim(d.dimensions, 0.8), 0);

                const doorAreas = roomExtracted.filter(e => e.elementType === 'door')
                    .reduce((sum, d) => sum + (parseDim(d.dimensions, 0.8) * 2.0), 0); // Assume 2.0m height

                const windowAreas = roomExtracted.filter(e => e.elementType === 'window')
                    .reduce((sum, w) => sum + (parseDim(w.dimensions, 1.2) * 1.2), 0); // Assume 1.2m height

                const netWallArea = Math.max(0, metrics.wallArea - doorAreas - windowAreas);
                const netSkirting = Math.max(0, metrics.wallPerimeter - doorWidths);

                return {
                    roomId: r.id,
                    name: r.name,
                    areaM2: parseFloat(r.area || '0'),
                    geometry: {
                        perimeterLm: metrics.wallPerimeter,
                        netWallAreaM2: netWallArea,
                        ceilingAreaM2: metrics.ceilingArea,
                        floorAreaM2: metrics.floorArea
                    },
                    elements: {
                        doors: roomExtracted.filter(e => e.elementType === 'door'),
                        windows: roomExtracted.filter(e => e.elementType === 'window'),
                        electrical: roomExtracted.filter(e => ['socket', 'switch', 'light'].includes(e.elementType)),
                        plumbing: roomExtracted.filter(e => ['sanitary', 'radiator'].includes(e.elementType))
                    },
                    derivedQuantities: {
                        floorFinishAreaM2: metrics.floorArea,
                        ceilingPaintAreaM2: metrics.ceilingArea,
                        skirtingLengthLm: netSkirting,
                        wallPaintAreaM2: netWallArea
                    },
                    workPackage: {
                        firstFix,
                        secondFix,
                        completion
                    }
                };
                // Keep original return logic...
                // ...
            })
        };
    }

    /**
     * Transforms room packages into strict Tender JSON format
     */
    async getTenderDataForJob(jobId: string): Promise<any> {
        const pkgData = await this.getRoomPackagesForJob(jobId);

        // Helper to map global items (extractedElements) to Tender Items
        const mapGlobalItem = (i: any, globalIdx: number) => {
            let qty = 1;
            let unit = 'nr';

            // Extract quantity from properties
            // IfcWall -> Area
            const t = (i.elementType || '').toLowerCase();
            if (t.includes('wall') || t.includes('slab') || t.includes('roof') || t.includes('floor')) {
                unit = 'm2';
                qty = parseFloat(String(i.properties?.Area || i.properties?.NetArea || i.properties?.GrossArea || i.properties?.NetSideArea || 0));
            } else if (t.includes('footing') || t.includes('foundation')) {
                unit = 'm3';
                qty = parseFloat(String(i.properties?.NetVolume || i.properties?.Volume || 0));
            }

            if (qty === 0 && i.dimensions) {
                // Try dimensions string? Often unreliable without parser.
                // Fallback to 1 nr
                unit = 'nr';
                qty = 1;
            }

            return {
                itemId: i.id || `g_${globalIdx}`,
                description: `${i.name || i.type} (${i.elementType || 'Global'})`,
                unit,
                quantity: qty || 0,
                quantityLocked: true,
                rateInputByContractor: true,
                rate: null,
                lineTotal: null,
                completion: { status: "NOT_STARTED", completedAtIso: null },
                source: { basis: "IFC", ifcRef: i.globalId || null, notes: null }
            };
        };

        // Helper to map room package items (payableItems) to Tender Items
        const mapPackageItem = (i: any) => ({
            itemId: i.id,
            description: i.description,
            unit: i.unit,
            quantity: parseFloat(String(i.quantity || 0)),
            quantityLocked: true,
            rateInputByContractor: true,
            rate: parseFloat(i.rate) > 0 ? parseFloat(i.rate) : null,
            lineTotal: parseFloat(i.total) > 0 ? parseFloat(i.total) : null,
            completion: { status: "NOT_STARTED", completedAtIso: null },
            source: { basis: "IFC", ifcRef: null, notes: null }
        });

        return {
            schemaVersion: "1.0.0",
            tender: {
                tenderId: `tndr_${jobId.substring(0, 8)}`,
                projectName: pkgData.projectName || "Project",
                currency: "GBP",
                tenderType: "LABOUR_ONLY",
                paymentBasis: "ITEM_COMPLETE",
                quantitiesBasis: "IFC_DERIVED_LOCKED",
                deadlineIso: new Date(Date.now() + 12096e5).toISOString() // +2 weeks
            },
            globalElements: Object.entries(pkgData.globalElements || {}).map(([key, items]: [string, any[]], idx) => ({
                sectionId: `global_${key.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
                title: key,
                items: items.map((item, iIdx) => mapGlobalItem(item, iIdx))
            })),
            rooms: pkgData.rooms.map((r: any) => ({
                roomId: r.roomId,
                name: r.name,
                areaM2: r.areaM2 || 0,
                packages: [
                    {
                        packageId: `${r.roomId}_first_fix`,
                        label: "FIRST_FIX",
                        items: r.workPackage.firstFix.map(mapPackageItem)
                    },
                    {
                        packageId: `${r.roomId}_second_fix`,
                        label: "SECOND_FIX",
                        items: r.workPackage.secondFix.map(mapPackageItem)
                    },
                    {
                        packageId: `${r.roomId}_completion`,
                        label: "COMPLETION",
                        items: r.workPackage.completion.map(mapPackageItem)
                    }
                ].filter((p: any) => p.items && p.items.length > 0)
            }))
        };
    }

    async getTenderDataForJobStrict(jobId: string): Promise<any> {
        const pkgData = await this.getRoomPackagesForJob(jobId);

        // Define Labour Filter (Strict)
        const isLabour = (i: any) => {
            const d = (i.description || '').toLowerCase();
            if (d.includes('undefined') || d.length < 4) return false;
            if (i.itemType === 'MATERIAL') return false;
            if (i.itemType === 'LABOUR') return true;

            // Extra keyword checks if itemType is missing/ambiguous
            // Exclude common materials by name if not explicit labour
            if (d.includes('brick') && !d.includes('lay') && !d.includes('construct') && !d.includes('work')) return false;
            if (d.includes('cement') || d.includes('sand') || d.includes('ply') || d.includes('insulation')) return false;

            // Include explicit labour logic
            if (d.includes('(labour)') || d.includes('(labor)')) return true;
            if (d.includes('install') || d.includes('fix') || d.includes('fit') || d.includes('paint') || d.includes('lay')) return true;
            if (d.includes('wiring') || d.includes('plumbing') || d.includes('carpentry') || d.includes('joinery')) return true;
            if (d.includes('socket') || d.includes('switch') || d.includes('light')) return true;
            if (d.includes('first fix') || d.includes('second fix') || d.includes('final fix')) return true;

            return false;
        };

        // Helper to map global items (extractedElements) to Tender Items
        // Force them to be Labour Tasks
        const mapGlobalItem = (i: any, globalIdx: number) => {
            let qty = 1;
            let unit = 'nr';

            // Extract quantity from properties
            const t = (i.elementType || '').toLowerCase();
            if (t.includes('wall') || t.includes('slab') || t.includes('roof') || t.includes('floor')) {
                unit = 'm2';
                qty = parseFloat(String(i.properties?.Area || i.properties?.NetArea || i.properties?.GrossArea || i.properties?.NetSideArea || 0));
            } else if (t.includes('footing') || t.includes('foundation')) {
                unit = 'm3';
                qty = parseFloat(String(i.properties?.NetVolume || i.properties?.Volume || 0));
            }

            if (qty === 0 && i.dimensions) {
                unit = 'nr';
                qty = 1;
            }

            // Generate Labour Description
            let description = `Construct ${i.name || i.elementType} (Labour)`;
            if (t.includes('wall')) description = `Construct External Walls (Labour)`;
            if (t.includes('slab')) description = `Pour Slab / Floor (Labour)`;
            if (t.includes('footing')) description = `Excavate & Pour Foundation (Labour)`;
            if (t.includes('roof')) description = `Construct Roof Structure (Labour)`;
            // Improve window/door descriptions
            if (t.includes('window')) description = `Install Windows (Labour)`;
            if (t.includes('door')) description = `Install Doors (Labour)`;

            return {
                itemId: i.id || `g_${globalIdx}`,
                itemType: "LABOUR",
                description: description,
                unit,
                quantity: qty || 0,
                quantityLocked: true,
                rateInputByContractor: true,
                rate: null, // STRICT NULL
                completion: { status: "NOT_STARTED" },
                source: { basis: "IFC", ifcRef: i.globalId || null, notes: null }
            };
        };

        // Helper to map room package items (payableItems) to Tender Items
        const mapPackageItem = (i: any) => ({
            itemId: i.id,
            itemType: "LABOUR",
            description: i.description,
            unit: i.unit,
            quantity: parseFloat(String(i.quantity || 0)),
            quantityLocked: true,
            rateInputByContractor: true,
            rate: null, // STRICT NULL
            completion: { status: "NOT_STARTED" },
            source: { basis: "ESTIMATE", ifcRef: null, notes: null }
        });

        // Filter out "Building / Global" from rooms list
        const filteredRooms = pkgData.rooms.filter((r: any) => r.name !== 'Building / Global');

        return {
            schemaVersion: "1.0.0",
            tender: {
                tenderId: `tndr_${jobId.substring(0, 8)}`,
                projectName: pkgData.projectName || "Complete Extraction – Labour Only",
                currency: "GBP",
                tenderType: "LABOUR_ONLY",
                materialsExcluded: true,
                plantExcluded: true,
                paymentBasis: "ITEM_COMPLETE",
                quantitiesBasis: "IFC_DERIVED_LOCKED",
                deadlineIso: new Date(Date.now() + 12096e5).toISOString() // +2 weeks
            },
            globalElements: Object.entries(pkgData.globalElements || {}).map(([key, items]: [string, any[]], idx) => ({
                sectionId: `global_${key.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
                title: `${key} (Labour)`,
                items: items.map((item, iIdx) => mapGlobalItem(item, iIdx))
            })),
            rooms: filteredRooms.map((r: any) => ({
                roomId: r.roomId,
                name: r.name,
                areaM2: r.areaM2 || 0,
                packages: [
                    {
                        packageId: `${r.roomId}_first_fix`,
                        label: "FIRST_FIX",
                        items: (r.workPackage.firstFix || []).filter(isLabour).map(mapPackageItem)
                    },
                    {
                        packageId: `${r.roomId}_second_fix`,
                        label: "SECOND_FIX",
                        items: (r.workPackage.secondFix || []).filter(isLabour).map(mapPackageItem)
                    },
                    {
                        packageId: `${r.roomId}_completion`,
                        label: "COMPLETION",
                        items: (r.workPackage.completion || []).filter(isLabour).map(mapPackageItem)
                    }
                ].filter((p: any) => p.items && p.items.length > 0)
            }))
        };
    }

    /**
     * GENERATES LABOUR TENDER ITEMS FROM IFC QUANTITIES
     * 
     * Creates specific installation items based on room geometry and element counts.
     * Enforces the "First Fix" / "Second Fix" / "Finishes" structure.
     */
    async generateTenderItems(jobId: string): Promise<void> {
        console.log(`👷 Generating Labour Tender Items for Job ${jobId}...`);

        // 1. Get Rooms
        const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));
        const physicalRooms = jobRooms.filter(r => r.name !== 'Building / Global');

        // 2. Get Extracted Elements for counts
        const allElements = await db.select().from(extractedElements).where(eq(extractedElements.jobId, jobId));

        // 3. Mark existing LABOUR items as 'LABOUR_ESTIMATE' to hide them from Tender but keep for budget
        await db.update(payableItems)
            .set({ itemType: 'LABOUR_ESTIMATE' })
            .where(and(
                like(payableItems.itemType, 'LABOUR'),
                eq(payableItems.hbxlOriginalQty, '1')
            ));

        for (const room of physicalRooms) {
            // Recalculate measurements
            const area = parseFloat(room.area || '0');
            let perimeter = parseFloat(room.perimeter || '0');

            // Simplified perimeter calc (fallback)
            if (perimeter <= 0 && area > 0) perimeter = 4 * Math.sqrt(area);

            // Recalculate counts
            const roomEls = allElements.filter(el => el.roomName === room.name);
            const socketCount = roomEls.filter(el => el.elementType === 'socket' || el.elementType === 'outlet').length;
            const switchCount = roomEls.filter(el => el.elementType === 'switch').length;
            const lightCount = roomEls.filter(el => el.elementType === 'light').length;
            const doorCount = roomEls.filter(el => el.elementType === 'door').length;

            const wallArea = perimeter * 2.4; // 2.4m ceiling
            const ceilingArea = area;
            const floorArea = area;

            // --- CLEAR EXISTING GENERATED ITEMS ---
            const existingElIds = (await db.select().from(roomElements).where(eq(roomElements.roomId, room.id))).map(e => e.id);
            if (existingElIds.length > 0) {
                await db.delete(payableItems).where(
                    and(
                        inArray(payableItems.elementId, existingElIds),
                        eq(payableItems.hbxlOriginalQty, 'GENERATED')
                    )
                );
            }

            // --- DEFINE ITEMS TO GENERATE ---
            const newItems: { element: string, desc: string, unit: string, qty: number }[] = [];

            // ELECTRICAL FIRST FIX
            const firstFixPoints = socketCount + switchCount;
            if (firstFixPoints > 0) {
                newItems.push({ element: 'Electrical – First Fix', desc: 'First fix electrical points', unit: 'point', qty: firstFixPoints });
            }

            // CARPENTRY FIRST FIX
            if (perimeter > 0) {
                newItems.push({ element: 'Carpentry – First Fix', desc: 'First fix framing / backing', unit: 'lm', qty: parseFloat((perimeter * 0.8).toFixed(2)) });
            }

            // ELECTRICAL SECOND FIX
            if (socketCount > 0) newItems.push({ element: 'Electrical – Second Fix', desc: 'Double socket installation', unit: 'nr', qty: socketCount });
            if (switchCount > 0) newItems.push({ element: 'Electrical – Second Fix', desc: 'Switch (1-way) installation', unit: 'nr', qty: switchCount });
            if (lightCount > 0) newItems.push({ element: 'Electrical – Second Fix', desc: 'Light fitting installation', unit: 'nr', qty: lightCount });

            // CARPENTRY SECOND FIX
            if (doorCount > 0) newItems.push({ element: 'Carpentry – Second Fix', desc: 'Internal door fitting', unit: 'nr', qty: doorCount });
            if (perimeter > 0) newItems.push({ element: 'Carpentry – Second Fix', desc: 'Skirting installation', unit: 'lm', qty: parseFloat(perimeter.toFixed(2)) });

            // DECORATION / FINISHES
            if (wallArea > 0) newItems.push({ element: 'Decoration', desc: 'Wall painting', unit: 'm2', qty: parseFloat(wallArea.toFixed(2)) });
            if (ceilingArea > 0) newItems.push({ element: 'Decoration', desc: 'Ceiling painting', unit: 'm2', qty: parseFloat(ceilingArea.toFixed(2)) });

            // FLOORING
            if (floorArea > 0) newItems.push({ element: 'Flooring', desc: 'Floor finish installation', unit: 'm2', qty: parseFloat(floorArea.toFixed(2)) });


            // --- INSERT ITEMS ---
            for (const item of newItems) {
                // Find or create element
                let [element] = await db.select().from(roomElements).where(and(eq(roomElements.roomId, room.id), eq(roomElements.name, item.element)));
                if (!element) {
                    [element] = await db.insert(roomElements).values({
                        roomId: room.id,
                        name: item.element,
                        subtotal: '0'
                    }).returning();
                }

                // Insert Payable Item
                await db.insert(payableItems).values({
                    elementId: element.id,
                    description: item.desc,
                    quantity: String(item.qty),
                    unit: item.unit,
                    rate: '0',
                    total: '0',
                    itemType: 'LABOUR', // Explicitly LABOUR for Tender
                    hbxlOriginalQty: 'GENERATED' // Marker
                });
            }
        }
        console.log(`✅ Generated Labour Tender Items for ${physicalRooms.length} rooms.`);
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
    metrics?: {
        floorArea: number;
        wallPerimeter: number;
        wallArea: number;
        ceilingArea: number;
    };
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
    hbxlSourcePhase?: string;
}

export const roomMapper = new RoomMapper();

