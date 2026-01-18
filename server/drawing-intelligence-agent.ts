/**
 * Drawing Intelligence Agent - Main Orchestrator
 * 
 * AGENTS.md Section 18 COMPLIANT
 * 
 * This agent converts design drawings into commercially usable intelligence.
 * 
 * THREE-LAYER MODEL:
 * Layer 1: Object Identification (drawing-extraction-agent.ts)
 * Layer 2: Rule-based Resolution (rule-engine.ts)
 * Layer 3: Commercial Resolution (pricing-library.ts)
 * 
 * The drawing is the truth. The CSV is the knowledge. The agent connects the two.
 */

import { extractFromImage, ExtractedDetailedElement, ExtractedRoom } from './drawing-extraction-agent';
import { resolveToPayableItems, ResolvedPayableItem } from './rule-engine';
import { priceAllItems, PricedPayableItem, generateRoomSummary } from './pricing-library';

// =============================================================================
// TYPES
// =============================================================================

export interface DrawingIntelligenceResult {
    success: boolean;
    rooms: ExtractedRoom[];
    pricedItems: PricedPayableItem[];
    roomSummaries: { [room: string]: string };
    grandTotal: number;
    error?: string;
}

// =============================================================================
// MAIN AGENT FUNCTION
// =============================================================================

/**
 * Process a drawing through all three layers of the Drawing Intelligence Agent
 * 
 * @param imagePath - Path to the drawing file (image or PDF)
 * @returns Complete commercial intelligence with priced payable items
 */
export async function processDrawing(imagePath: string): Promise<DrawingIntelligenceResult> {
    console.log('='.repeat(60));
    console.log('🎯 DRAWING INTELLIGENCE AGENT');
    console.log('='.repeat(60));
    console.log(`📄 Processing: ${imagePath}`);
    console.log('');

    try {
        // =====================================================================
        // LAYER 1: Object Identification
        // =====================================================================
        console.log('📍 LAYER 1: Object Identification');
        console.log('-'.repeat(40));

        const extractionResult = await extractFromImage(imagePath);

        if (!extractionResult.success) {
            return {
                success: false,
                rooms: [],
                pricedItems: [],
                roomSummaries: {},
                grandTotal: 0,
                error: extractionResult.error
            };
        }

        console.log(`   ✅ Rooms identified: ${extractionResult.rooms.length}`);
        console.log(`   ✅ Elements identified: ${extractionResult.detailedElements?.length || 0}`);
        console.log(`   ✅ Instructions found: ${extractionResult.instructions?.length || 0}`);
        console.log('');

        // =====================================================================
        // LAYER 2: Rule-based Resolution
        // =====================================================================
        console.log('📍 LAYER 2: Rule-based Resolution');
        console.log('-'.repeat(40));

        const allResolvedItems: ResolvedPayableItem[] = [];

        // Process elements from each room
        for (const room of extractionResult.rooms) {
            // Get detailed elements for this room
            const roomElements = (extractionResult.detailedElements || [])
                .filter(e => e.room.toLowerCase() === room.name.toLowerCase());

            // Also include elements listed in the room's element codes
            const codeElements: ExtractedDetailedElement[] = room.elements.map(code => ({
                code,
                type: inferTypeFromCode(code),
                description: code,
                room: room.name,
                page: room.page // Inherit page from room
            }));

            // Combine and deduplicate
            const allRoomElements = [...roomElements, ...codeElements].filter(
                (elem, idx, arr) => arr.findIndex(e => e.code === elem.code) === idx
            );

            console.log(`   🏠 Room: ${room.name} - ${allRoomElements.length} elements`);

            // Resolve to payable items
            const resolvedItems = resolveToPayableItems(room.name, allRoomElements);
            allResolvedItems.push(...resolvedItems);

            for (const item of resolvedItems) {
                console.log(`      📦 ${item.itemName} (${item.components.length} components)`);
            }
        }

        console.log(`   ✅ Total payable items resolved: ${allResolvedItems.length}`);
        console.log('');

        // =====================================================================
        // LAYER 3: Commercial Resolution
        // =====================================================================
        console.log('📍 LAYER 3: Commercial Resolution');
        console.log('-'.repeat(40));

        const pricedItems = priceAllItems(allResolvedItems);

        // Group by room and generate summaries
        const roomSummaries: { [room: string]: string } = {};
        const itemsByRoom: { [room: string]: PricedPayableItem[] } = {};

        for (const item of pricedItems) {
            if (!itemsByRoom[item.room]) {
                itemsByRoom[item.room] = [];
            }
            itemsByRoom[item.room].push(item);
        }

        for (const [room, items] of Object.entries(itemsByRoom)) {
            roomSummaries[room] = generateRoomSummary(room, items);
            const roomTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);
            console.log(`   🏠 ${room}: £${roomTotal.toFixed(2)}`);
        }

        const grandTotal = pricedItems.reduce((sum, i) => sum + i.totalAmount, 0);
        console.log(`   ✅ Grand Total: £${grandTotal.toFixed(2)}`);
        console.log('');

        // =====================================================================
        // OUTPUT
        // =====================================================================
        console.log('='.repeat(60));
        console.log('✅ DRAWING INTELLIGENCE COMPLETE');
        console.log(`   Rooms: ${extractionResult.rooms.length}`);
        console.log(`   Payable Items: ${pricedItems.length}`);
        console.log(`   Grand Total: £${grandTotal.toFixed(2)}`);
        console.log('='.repeat(60));

        return {
            success: true,
            rooms: extractionResult.rooms,
            pricedItems,
            roomSummaries,
            grandTotal
        };

    } catch (error) {
        console.error('❌ Drawing Intelligence Agent error:', error);
        return {
            success: false,
            rooms: [],
            pricedItems: [],
            roomSummaries: {},
            grandTotal: 0,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Infer element type from code
 */
function inferTypeFromCode(code: string): string {
    const codeLower = code.toLowerCase();

    if (codeLower.startsWith('d') && /^d\d/.test(codeLower)) return 'door';
    if (codeLower.startsWith('w') && /^w\d/.test(codeLower)) return 'window';
    if (codeLower === 'wc' || codeLower === 'toilet') return 'wc';
    if (codeLower === 'basin' || codeLower === 'sink') return 'basin';
    if (codeLower === 'shower') return 'shower';
    if (codeLower === 'bath') return 'bath';
    if (codeLower === 'radiator' || codeLower === 'rad') return 'radiator';

    return 'unknown';
}

console.log('✅ Drawing Intelligence Agent ready');
