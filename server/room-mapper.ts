/**
 * Room Mapper Service
 * 
 * Converts HBXL phase-based data to Room-based structure per AGENTS.md
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

// Room definitions with keyword matching patterns
const ROOM_PATTERNS: Record<string, { keywords: string[], floor?: string }> = {
    'Bathroom': {
        keywords: ['bathroom', 'shower', 'basin', 'wc', 'toilet', 'bath', 'sanitaryware', 'extractor fan'],
        floor: 'First Floor'
    },
    'Kitchen': {
        keywords: ['kitchen', 'cooker', 'hob', 'oven', 'dishwasher', 'extraction', 'splashback'],
        floor: 'Ground Floor'
    },
    'Lounge': {
        keywords: ['lounge', 'living room', 'sitting room', 'fireplace', 'mantlepiece'],
        floor: 'Ground Floor'
    },
    'Bedroom 1': {
        keywords: ['bedroom 1', 'master bedroom', 'main bedroom'],
        floor: 'First Floor'
    },
    'Bedroom 2': {
        keywords: ['bedroom 2', 'second bedroom'],
        floor: 'First Floor'
    },
    'Hallway': {
        keywords: ['hallway', 'hall', 'corridor', 'landing', 'stairs', 'staircase'],
    },
    'External': {
        keywords: ['external', 'roof', 'gutter', 'fascia', 'soffit', 'brickwork', 'masonry shell',
            'foundation', 'footing', 'drainage', 'oversite', 'damp proof'],
    },
    'Utility': {
        keywords: ['utility', 'boiler', 'heating', 'plumbing 1st fix', 'plumbing 2nd fix'],
    }
};

// Element groupings from HBXL phases
const ELEMENT_MAPPINGS: Record<string, string> = {
    // Structural
    'Footings': 'Foundations',
    'Foundations': 'Foundations',
    'Oversite and Slabbing': 'Floor Construction',
    'Masonry Shell': 'Wall Construction',
    'Structural Openings': 'Structural Works',

    // Roof
    'Roof Structure': 'Roof',
    'Roof Tiling': 'Roof',

    // Internal fitout
    'Joinery 1st Fix': 'Carpentry',
    'Joinery 2nd Fix': 'Doors & Skirting',
    'Plastering': 'Wall Finishes',
    'Internal Decoration': 'Decoration',
    'External Decoration': 'External Finishes',
    'Internal Fitting Out': 'Fixtures & Fittings',

    // Electrics & Plumbing
    'Electrical 1st Fix': 'Electrical',
    'Electrical 2nd Fix': 'Electrical',
    'Plumbing 1st Fix': 'Plumbing',
    'Plumbing 2nd Fix': 'Plumbing',

    // Completion
    'Completion': 'Snagging'
};

export class RoomMapper {

    /**
     * Maps HBXL phase data to Room-based structure and saves to database
     * 
     * @param jobId - The job ID to create rooms for
     * @param phaseTaskData - The parsed HBXL phase data from CSV import
     * @returns Created room IDs
     */
    async mapPhasesToRooms(
        jobId: string,
        phaseTaskData: Record<string, any[]>
    ): Promise<string[]> {
        const createdRoomIds: string[] = [];

        // Group items by detected room
        const roomGroups = this.groupItemsByRoom(phaseTaskData);

        console.log('🏠 Room mapping results:', Object.keys(roomGroups).map(r =>
            `${r}: ${roomGroups[r].length} items`
        ));

        // Create rooms in database
        for (const [roomName, items] of Object.entries(roomGroups)) {
            const roomId = await this.createRoomWithItems(jobId, roomName, items);
            if (roomId) {
                createdRoomIds.push(roomId);
            }
        }

        return createdRoomIds;
    }

    /**
     * Groups items from phases into rooms using keyword matching
     */
    private groupItemsByRoom(
        phaseTaskData: Record<string, any[]>
    ): Record<string, Array<{ item: any; phase: string; element: string }>> {
        const roomGroups: Record<string, Array<{ item: any; phase: string; element: string }>> = {};

        for (const [phase, items] of Object.entries(phaseTaskData)) {
            const elementName = ELEMENT_MAPPINGS[phase] || phase;

            for (const item of items) {
                const roomName = this.detectRoom(phase, item);

                if (!roomGroups[roomName]) {
                    roomGroups[roomName] = [];
                }

                roomGroups[roomName].push({
                    item,
                    phase,
                    element: elementName
                });
            }
        }

        return roomGroups;
    }

    /**
     * Detects which room an item belongs to based on keywords
     */
    private detectRoom(phase: string, item: any): string {
        const description = (item.description || '').toLowerCase();
        const phaseLower = phase.toLowerCase();

        // Check each room's keywords
        for (const [roomName, config] of Object.entries(ROOM_PATTERNS)) {
            for (const keyword of config.keywords) {
                if (description.includes(keyword) || phaseLower.includes(keyword)) {
                    return roomName;
                }
            }
        }

        // Default room based on phase type
        if (phaseLower.includes('roof') || phaseLower.includes('foundation') ||
            phaseLower.includes('footing') || phaseLower.includes('masonry')) {
            return 'External';
        }

        if (phaseLower.includes('electrical') || phaseLower.includes('plumbing')) {
            return 'Utility';
        }

        // Fallback: create a room from the phase name
        return 'General Works';
    }

    /**
     * Creates a room with its elements and payable items
     */
    private async createRoomWithItems(
        jobId: string,
        roomName: string,
        items: Array<{ item: any; phase: string; element: string }>
    ): Promise<string | null> {
        try {
            // Calculate room total
            const roomTotal = items.reduce((sum, { item }) => {
                const total = typeof item.total === 'number' ? item.total : parseFloat(item.total) || 0;
                return sum + total;
            }, 0);

            // Get floor from room patterns
            const floor = ROOM_PATTERNS[roomName]?.floor;

            // Create room
            const [room] = await db.insert(rooms).values({
                jobId,
                name: roomName,
                floor,
                totalValue: String(Math.round(roomTotal))
            }).returning();

            // Group items by element
            const elementGroups: Record<string, any[]> = {};
            for (const { item, phase, element } of items) {
                if (!elementGroups[element]) {
                    elementGroups[element] = [];
                }
                elementGroups[element].push({ item, phase });
            }

            // Create elements and payable items
            for (const [elementName, elementItems] of Object.entries(elementGroups)) {
                const elementTotal = elementItems.reduce((sum, { item }) => {
                    const total = typeof item.total === 'number' ? item.total : parseFloat(item.total) || 0;
                    return sum + total;
                }, 0);

                // Get source phase for traceability
                const sourcePhase = elementItems[0]?.phase || 'Unknown';

                const [element] = await db.insert(roomElements).values({
                    roomId: room.id,
                    name: elementName,
                    subtotal: String(Math.round(elementTotal)),
                    hbxlSourcePhase: sourcePhase
                }).returning();

                // Create payable items
                for (const { item, phase } of elementItems) {
                    await db.insert(payableItems).values({
                        elementId: element.id,
                        description: item.description || 'Unknown Item',
                        quantity: String(item.quantity || 1),
                        unit: item.unit || 'Each',
                        rate: String(item.rate || 0),
                        total: String(item.total || 0),
                        hbxlSourcePhase: phase,
                        hbxlOriginalQty: String(item.quantity || 1),
                        roomAllocationPercent: '100'
                    });
                }
            }

            return room.id;
        } catch (error) {
            console.error(`Error creating room ${roomName}:`, error);
            return null;
        }
    }

    /**
     * Gets all rooms with their elements and items for a job
     */
    async getRoomDataForJob(jobId: string): Promise<RoomData[]> {
        const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));

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
                elements: elementData
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
