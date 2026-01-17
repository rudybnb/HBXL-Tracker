/**
 * Pricing Library - Layer 3 of Drawing Intelligence Agent
 * 
 * AGENTS.md Section 18 COMPLIANT
 * 
 * Purpose: Lookup pricing from approved CSV libraries
 * Rules:
 * - CSV is the single pricing authority
 * - No hard-coded prices in agent logic (except defaults)
 * - All items must be commercially traceable
 */

import { ResolvedComponent, ResolvedPayableItem } from './rule-engine';

// =============================================================================
// PRICING LIBRARY TYPES
// =============================================================================

export interface PricingEntry {
    category: string;
    subtype: string;
    unit: string;
    rate: number;        // In pounds
    supplier?: string;
    lastUpdated?: string;
}

export interface PricedComponent extends ResolvedComponent {
    rate: number;
    total: number;
    source: 'csv' | 'default';
}

export interface PricedPayableItem extends Omit<ResolvedPayableItem, 'components'> {
    components: PricedComponent[];
    totalAmount: number;
}

// =============================================================================
// DEFAULT PRICING LIBRARY (Fallback when no CSV available)
// These are indicative rates - actual rates come from CSV
// =============================================================================

const DEFAULT_PRICING_LIBRARY: PricingEntry[] = [
    // Doors
    { category: 'Door', subtype: 'Internal standard door', unit: 'nr', rate: 75.00 },
    { category: 'Door', subtype: 'FD30 fire door', unit: 'nr', rate: 145.00 },
    { category: 'Door', subtype: 'External door', unit: 'nr', rate: 295.00 },
    { category: 'Door Frame', subtype: 'Internal door frame', unit: 'nr', rate: 35.00 },
    { category: 'Door Frame', subtype: 'Fire rated door frame', unit: 'nr', rate: 65.00 },
    { category: 'Door Frame', subtype: 'External door frame', unit: 'nr', rate: 85.00 },

    // Ironmongery
    { category: 'Ironmongery', subtype: 'Standard hinges', unit: 'set', rate: 8.50 },
    { category: 'Ironmongery', subtype: 'Fire rated hinges (3 pack)', unit: 'set', rate: 18.00 },
    { category: 'Ironmongery', subtype: 'External hinges', unit: 'set', rate: 15.00 },
    { category: 'Ironmongery', subtype: 'Standard handle set', unit: 'set', rate: 22.00 },
    { category: 'Ironmongery', subtype: 'Fire rated handle set', unit: 'set', rate: 38.00 },
    { category: 'Ironmongery', subtype: 'External handle & lock set', unit: 'set', rate: 85.00 },

    // Fire Safety
    { category: 'Fire Safety', subtype: 'Intumescent strips', unit: 'set', rate: 12.00 },

    // Weatherproofing
    { category: 'Weatherproofing', subtype: 'Door threshold & seals', unit: 'set', rate: 35.00 },

    // Decoration
    { category: 'Decoration', subtype: 'Door & frame painting', unit: 'nr', rate: 45.00 },

    // Sanitaryware
    { category: 'Sanitaryware', subtype: 'WC pan & cistern', unit: 'nr', rate: 185.00 },
    { category: 'Sanitaryware', subtype: 'WC seat', unit: 'nr', rate: 28.00 },
    { category: 'Sanitaryware', subtype: 'Wash basin', unit: 'nr', rate: 95.00 },
    { category: 'Sanitaryware', subtype: 'Basin taps', unit: 'set', rate: 65.00 },
    { category: 'Sanitaryware', subtype: 'Basin waste', unit: 'nr', rate: 12.00 },
    { category: 'Sanitaryware', subtype: 'Shower tray', unit: 'nr', rate: 145.00 },
    { category: 'Sanitaryware', subtype: 'Shower valve & riser', unit: 'set', rate: 185.00 },
    { category: 'Sanitaryware', subtype: 'Shower screen', unit: 'nr', rate: 195.00 },
    { category: 'Sanitaryware', subtype: 'Standard bath', unit: 'nr', rate: 165.00 },
    { category: 'Sanitaryware', subtype: 'Bath taps', unit: 'set', rate: 85.00 },
    { category: 'Sanitaryware', subtype: 'Bath waste & overflow', unit: 'nr', rate: 28.00 },
    { category: 'Sanitaryware', subtype: 'Bath panel', unit: 'set', rate: 45.00 },

    // Plumbing
    { category: 'Plumbing', subtype: 'WC connection kit', unit: 'nr', rate: 18.00 },
    { category: 'Plumbing', subtype: 'Basin trap & pipework', unit: 'nr', rate: 22.00 },
    { category: 'Plumbing', subtype: 'Shower waste', unit: 'nr', rate: 25.00 },
];

// In-memory pricing library (loaded from CSV or defaults)
let pricingLibrary: PricingEntry[] = [...DEFAULT_PRICING_LIBRARY];

// =============================================================================
// PRICING LIBRARY MANAGEMENT
// =============================================================================

/**
 * Load pricing library from CSV content
 */
export function loadPricingFromCSV(csvContent: string): void {
    const lines = csvContent.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;

    const newEntries: PricingEntry[] = [];

    // Parse header to find columns
    const header = lines[0].toLowerCase();
    const headers = header.split(',').map(h => h.trim());

    const categoryIdx = headers.findIndex(h => h.includes('category'));
    const subtypeIdx = headers.findIndex(h => h.includes('subtype') || h.includes('description'));
    const unitIdx = headers.findIndex(h => h.includes('unit'));
    const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price') || h.includes('cost'));

    if (categoryIdx === -1 || rateIdx === -1) {
        console.log('⚠️ CSV pricing format not recognized, using defaults');
        return;
    }

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length < Math.max(categoryIdx, subtypeIdx, unitIdx, rateIdx) + 1) continue;

        const rateStr = parts[rateIdx].replace(/[£,]/g, '');
        const rate = parseFloat(rateStr);

        if (!isNaN(rate)) {
            newEntries.push({
                category: parts[categoryIdx] || 'General',
                subtype: parts[subtypeIdx] || parts[categoryIdx],
                unit: parts[unitIdx] || 'nr',
                rate: rate,
                lastUpdated: new Date().toISOString()
            });
        }
    }

    if (newEntries.length > 0) {
        pricingLibrary = newEntries;
        console.log(`📊 Loaded ${newEntries.length} pricing entries from CSV`);
    }
}

/**
 * Get current pricing library
 */
export function getPricingLibrary(): PricingEntry[] {
    return pricingLibrary;
}

/**
 * Reset to default pricing
 */
export function resetToDefaultPricing(): void {
    pricingLibrary = [...DEFAULT_PRICING_LIBRARY];
    console.log('📊 Reset to default pricing library');
}

// =============================================================================
// LAYER 3 - COMMERCIAL RESOLUTION
// =============================================================================

/**
 * Look up price for a component
 */
export function lookupPrice(component: ResolvedComponent, customLibrary?: PricingEntry[]): { rate: number; source: 'csv' | 'default' } {
    // Determine which library to use (Custom/DB or Memory/Default)
    const activeLibrary = customLibrary && customLibrary.length > 0 ? customLibrary : pricingLibrary;

    // Try exact match first
    const exactMatch = activeLibrary.find(
        p => p.category.toLowerCase() === component.category.toLowerCase() &&
            p.subtype.toLowerCase() === component.subtype.toLowerCase()
    );

    if (exactMatch) {
        return { rate: exactMatch.rate, source: 'csv' };
    }

    // Try partial match on subtype (Bidirectional)
    const partialMatch = activeLibrary.find(
        p => component.subtype.toLowerCase().includes(p.subtype.toLowerCase()) ||
            p.subtype.toLowerCase().includes(component.subtype.toLowerCase())
    );

    if (partialMatch) {
        return { rate: partialMatch.rate, source: 'csv' };
    }

    // Default fallback rate
    console.log(`⚠️ No pricing found in ${customLibrary ? 'JOB CSV' : 'DEFAULT LIB'} for: ${component.category} - ${component.subtype}, using default`);
    return { rate: 50.00, source: 'default' };
}

/**
 * Layer 3: Price all components in a payable item
 */
export function pricePayableItem(item: ResolvedPayableItem): PricedPayableItem {
    const pricedComponents: PricedComponent[] = item.components.map(component => {
        const { rate, source } = lookupPrice(component);
        const total = rate * component.quantity;

        return {
            ...component,
            rate,
            total,
            source
        };
    });

    const totalAmount = pricedComponents.reduce((sum, c) => sum + c.total, 0);

    return {
        room: item.room,
        itemName: item.itemName,
        components: pricedComponents,
        unit: item.unit,
        quantity: item.quantity,
        totalAmount
    };
}

/**
 * Layer 3: Price all payable items from a room
 */
export function priceAllItems(items: ResolvedPayableItem[]): PricedPayableItem[] {
    return items.map(item => pricePayableItem(item));
}

/**
 * Generate commercial summary for a room
 */
export function generateRoomSummary(room: string, pricedItems: PricedPayableItem[]): string {
    let summary = `ROOM: ${room}\n\n`;

    for (const item of pricedItems) {
        summary += `Payable Item: ${item.itemName}\n`;
        summary += `Includes:\n`;

        for (const comp of item.components) {
            summary += `- ${comp.subtype} (${comp.quantity} ${comp.unit} @ £${comp.rate.toFixed(2)}) = £${comp.total.toFixed(2)}\n`;
        }

        summary += `\nUnit: ${item.unit}\n`;
        summary += `Quantity: ${item.quantity}\n`;
        summary += `Total: £${item.totalAmount.toFixed(2)}\n`;
        summary += `\n---\n\n`;
    }

    const grandTotal = pricedItems.reduce((sum, i) => sum + i.totalAmount, 0);
    summary += `ROOM TOTAL: £${grandTotal.toFixed(2)}\n`;

    return summary;
}

console.log('✅ Pricing Library loaded - Layer 3 of Drawing Intelligence Agent');
console.log(`   📊 ${pricingLibrary.length} pricing entries available`);
