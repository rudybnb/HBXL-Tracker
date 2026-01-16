/**
 * Rule Engine - Layer 2 of Drawing Intelligence Agent
 * 
 * AGENTS.md Section 18 COMPLIANT
 * 
 * Purpose: Apply deterministic rules to resolve components from identified objects
 * The agent NEVER guesses - all rules are explicit and human-defined
 */

// =============================================================================
// RESOLVED COMPONENT TYPES
// =============================================================================

export interface ResolvedComponent {
    category: string;      // "Door", "Window", "Sanitaryware"
    subtype: string;       // "Internal standard door"
    unit: string;          // "nr", "set", "m"
    quantity: number;
    needsPricing: boolean; // True if needs CSV lookup
}

export interface ResolvedPayableItem {
    room: string;
    itemName: string;
    components: ResolvedComponent[];
    unit: string;
    quantity: number;
    totalEstimate?: number; // After CSV lookup
}

// =============================================================================
// DOOR RULES
// =============================================================================

interface DoorContext {
    objectType: 'door';
    code: string;          // "D01"
    room: string;          // "Bathroom"
    location: string;      // "internal" | "external"
    size?: string;         // "762 x 1981mm"
}

type DoorType = 'internal_standard' | 'fire_door' | 'external';

const FIRE_DOOR_RULES: Record<string, boolean> = {
    // Rooms that REQUIRE fire doors
    'kitchen': true,
    'garage': true,
    'boiler room': true,
    'utility': false,
    // Rooms that DO NOT require fire doors
    'bathroom': false,
    'toilet': false,
    'wc': false,
    'bedroom': false,
    'lounge': false,
    'living': false,
    'dining': false,
    'study': false,
    'conservatory': false,
};

/**
 * Layer 2: Resolve door type based on location and room
 */
export function resolveDoorType(context: DoorContext): DoorType {
    // External doors
    if (context.location === 'external') {
        return 'external';
    }

    // Check fire door requirement by room
    const roomLower = context.room.toLowerCase();
    for (const [roomPattern, requiresFire] of Object.entries(FIRE_DOOR_RULES)) {
        if (roomLower.includes(roomPattern)) {
            return requiresFire ? 'fire_door' : 'internal_standard';
        }
    }

    // Default to internal standard
    return 'internal_standard';
}

/**
 * Layer 2: Resolve components required for door type
 */
export function resolveDoorComponents(doorType: DoorType, room: string): ResolvedComponent[] {
    const components: ResolvedComponent[] = [];

    switch (doorType) {
        case 'internal_standard':
            components.push(
                { category: 'Door', subtype: 'Internal standard door', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Door Frame', subtype: 'Internal door frame', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'Standard hinges', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'Standard handle set', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Decoration', subtype: 'Door & frame painting', unit: 'nr', quantity: 1, needsPricing: true }
            );
            break;

        case 'fire_door':
            components.push(
                { category: 'Door', subtype: 'FD30 fire door', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Door Frame', subtype: 'Fire rated door frame', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'Fire rated hinges (3 pack)', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'Fire rated handle set', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Decoration', subtype: 'Door & frame painting', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Fire Safety', subtype: 'Intumescent strips', unit: 'set', quantity: 1, needsPricing: true }
            );
            break;

        case 'external':
            components.push(
                { category: 'Door', subtype: 'External door', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Door Frame', subtype: 'External door frame', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'External hinges', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Ironmongery', subtype: 'External handle & lock set', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Weatherproofing', subtype: 'Door threshold & seals', unit: 'set', quantity: 1, needsPricing: true }
            );
            break;
    }

    return components;
}

// =============================================================================
// SANITARYWARE RULES
// =============================================================================

interface SanitaryContext {
    objectType: 'sanitaryware';
    itemType: 'wc' | 'basin' | 'shower' | 'bath';
    room: string;
}

/**
 * Layer 2: Resolve components for sanitaryware
 */
export function resolveSanitaryComponents(context: SanitaryContext): ResolvedComponent[] {
    const components: ResolvedComponent[] = [];

    switch (context.itemType) {
        case 'wc':
            components.push(
                { category: 'Sanitaryware', subtype: 'WC pan & cistern', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'WC seat', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Plumbing', subtype: 'WC connection kit', unit: 'nr', quantity: 1, needsPricing: true }
            );
            break;

        case 'basin':
            components.push(
                { category: 'Sanitaryware', subtype: 'Wash basin', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Basin taps', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Basin waste', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Plumbing', subtype: 'Basin trap & pipework', unit: 'nr', quantity: 1, needsPricing: true }
            );
            break;

        case 'shower':
            components.push(
                { category: 'Sanitaryware', subtype: 'Shower tray', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Shower valve & riser', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Shower screen', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Plumbing', subtype: 'Shower waste', unit: 'nr', quantity: 1, needsPricing: true }
            );
            break;

        case 'bath':
            components.push(
                { category: 'Sanitaryware', subtype: 'Standard bath', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Bath taps', unit: 'set', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Bath waste & overflow', unit: 'nr', quantity: 1, needsPricing: true },
                { category: 'Sanitaryware', subtype: 'Bath panel', unit: 'set', quantity: 1, needsPricing: true }
            );
            break;
    }

    return components;
}

// =============================================================================
// MAIN RESOLVER - Process extracted elements through rules
// =============================================================================

interface ExtractedObject {
    code: string;
    type: string;
    room: string;
    description?: string;
    size?: string;
}

/**
 * Main entry point - resolve extracted objects to payable items
 * This is Layer 2 of the Drawing Intelligence Agent
 */
export function resolveToPayableItems(
    room: string,
    extractedObjects: ExtractedObject[]
): ResolvedPayableItem[] {
    const payableItems: ResolvedPayableItem[] = [];

    for (const obj of extractedObjects) {
        const typeLower = obj.type.toLowerCase();

        // Process doors
        if (typeLower === 'door' || typeLower.includes('door')) {
            const doorContext: DoorContext = {
                objectType: 'door',
                code: obj.code,
                room: obj.room || room,
                location: typeLower.includes('external') ? 'external' : 'internal',
                size: obj.size
            };

            const doorType = resolveDoorType(doorContext);
            const components = resolveDoorComponents(doorType, doorContext.room);

            payableItems.push({
                room: doorContext.room,
                itemName: `${doorContext.room} door (${obj.code})`,
                components,
                unit: 'nr',
                quantity: 1
            });
        }

        // Process sanitaryware
        else if (['wc', 'basin', 'shower', 'bath', 'toilet'].includes(typeLower)) {
            let itemType: 'wc' | 'basin' | 'shower' | 'bath';
            if (typeLower === 'toilet' || typeLower === 'wc') itemType = 'wc';
            else if (typeLower === 'basin') itemType = 'basin';
            else if (typeLower === 'shower') itemType = 'shower';
            else itemType = 'bath';

            const sanitaryContext: SanitaryContext = {
                objectType: 'sanitaryware',
                itemType,
                room: obj.room || room
            };

            const components = resolveSanitaryComponents(sanitaryContext);

            payableItems.push({
                room: sanitaryContext.room,
                itemName: `${sanitaryContext.room} ${itemType}`,
                components,
                unit: 'nr',
                quantity: 1
            });
        }

        // TODO: Add window rules, radiator rules, electrical rules
    }

    return payableItems;
}

console.log('✅ Rule Engine loaded - Layer 2 of Drawing Intelligence Agent');
