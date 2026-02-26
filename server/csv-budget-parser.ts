/**
 * HBXL CSV Budget Ledger Parser
 * Parses HBXL scope CSV files and produces a structured budget ledger
 * with Labour/Material/Plant totals per build phase.
 * 
 * CSV columns (row 6, 0-indexed):
 * 0: Order Date, 1: Date Required, 2: Build Phase, 3: Type of Resource,
 * 4: Resource Type, 5: Supplier, 6: Product Code,
 * 7: Resource Description (with price), 8: Resource Description Without Price,
 * 9: Order Quantity
 */

export interface BudgetLine {
    buildPhase: string;
    resourceType: string;      // "Labour" | "Material" | "Plant"
    resourceSubType: string;   // e.g. "Bricklayer", "Bricks", "Light plant"
    description: string;       // Clean description without price
    descriptionWithPrice: string; // Original with price
    unit: string;              // Extracted from description: "Each", "Hours", "m", "m²", etc.
    qty: number;
    rate: number;              // Extracted £ value
    lineTotal: number;         // qty × rate
    supplier: string;
    productCode: string;
    isAllowance?: boolean;
    matchedKeywords?: string[];
}

export interface PhaseSummary {
    phase: string;
    labour: number;
    material: number;
    plant: number;
    total: number;
    lineCount: number;
}

export interface BudgetLedger {
    clientName: string;
    clientAddress: string;
    clientPostcode: string;
    projectType: string;
    lines: BudgetLine[];
    phaseSummaries: PhaseSummary[];
    totals: {
        labour: number;
        material: number;
        plant: number;
        grand: number;
    };
    parsedAt: string;
    lineCount: number;
    errorCount: number;
    errors: string[];
}

/**
 * Extract £ price from HBXL description string.
 * Handles formats like:
 *  - "£1.68/Each"
 *  - "£140.00/m³"
 *  - "£88.00/Hours"
 *  - "£1,200.00/Each"
 *  - "£0.00/Unit"
 */
function extractRate(desc: string): number {
    // Match the LAST £ value followed by /unit (this is the rate, not an allowance)
    // Pattern: £<number>/unit at end of string
    const rateMatch = desc.match(/£([\d,]+\.?\d*)\s*\/\s*\w+\s*$/);
    if (rateMatch) {
        return parseFloat(rateMatch[1].replace(/,/g, ''));
    }
    // Fallback: find any £ value
    const fallback = desc.match(/£([\d,]+\.?\d*)/g);
    if (fallback && fallback.length > 0) {
        // Use the last £ value (typically the rate, not an allowance)
        const last = fallback[fallback.length - 1];
        const val = last.replace('£', '').replace(/,/g, '');
        return parseFloat(val);
    }
    return 0;
}

const ALLOWANCE_KEYWORDS = [
    "allowance", "provisional", "prov sum", "pc sum", "prime cost",
    "tbc", "to be confirmed", "estimate"
];

function detectAllowance(desc: string): { isAllowance: boolean; matchedKeywords: string[] } {
    const matched: string[] = [];
    const lowerDesc = desc.toLowerCase();

    for (const kw of ALLOWANCE_KEYWORDS) {
        if (lowerDesc.includes(kw)) {
            matched.push(kw);
        }
    }

    return {
        isAllowance: matched.length > 0,
        matchedKeywords: matched
    };
}

/**
 * Extract unit from the clean description (without price).
 * Format is usually: "Description (Unit)" — e.g. "Bricklayer (Hours)"
 */
function extractUnit(cleanDesc: string): string {
    const match = cleanDesc.match(/\(([^)]+)\)\s*$/);
    if (match) return match[1].trim();
    return '';
}

/**
 * Parse a CSV line handling quoted fields with commas inside.
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // Handle doubled quotes inside quoted fields
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Parse HBXL CSV content into a BudgetLedger
 */
export function parseHBXLCSV(csvContent: string): BudgetLedger {
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    const errors: string[] = [];

    // Extract header info (rows 0-3)
    let clientName = '', clientAddress = '', clientPostcode = '', projectType = '';
    if (lines.length >= 4) {
        const r0 = parseCSVLine(lines[0]);
        const r1 = parseCSVLine(lines[1]);
        const r2 = parseCSVLine(lines[2]);
        const r3 = parseCSVLine(lines[3]);
        clientName = r0[1] || '';
        clientAddress = r1[1] || '';
        clientPostcode = r2[1] || '';
        projectType = r3[1] || '';
    }

    // Data rows start at row 6 (0-indexed), after header row at 5
    const budgetLines: BudgetLine[] = [];

    for (let i = 6; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 10) {
            errors.push(`Row ${i + 1}: insufficient columns (${row.length})`);
            continue;
        }

        const buildPhase = row[2] || '';
        const typeOfResource = row[3] || ''; // "Material", "Labour", "Plant"
        const resourceType = row[4] || '';   // "Bricklayer", "Bricks", etc.
        const supplier = row[5] || '';
        const productCode = row[6] || '';
        const descWithPrice = row[7] || '';
        const descClean = row[8] || '';
        const qtyStr = row[9] || '0';

        if (!buildPhase || !typeOfResource) {
            errors.push(`Row ${i + 1}: missing build phase or resource type`);
            continue;
        }

        const qty = parseFloat(qtyStr) || 0;
        const rate = extractRate(descWithPrice);
        const unit = extractUnit(descClean);
        const lineTotal = Math.round(qty * rate * 100) / 100; // Round to 2dp

        const allowanceInfo = detectAllowance(descClean);

        budgetLines.push({
            buildPhase,
            resourceType: typeOfResource,
            resourceSubType: resourceType,
            description: descClean,
            descriptionWithPrice: descWithPrice,
            unit,
            qty,
            rate,
            lineTotal,
            supplier,
            productCode,
            ...allowanceInfo
        });
    }

    // Build phase summaries
    const phaseMap = new Map<string, PhaseSummary>();
    budgetLines.forEach(line => {
        if (!phaseMap.has(line.buildPhase)) {
            phaseMap.set(line.buildPhase, {
                phase: line.buildPhase,
                labour: 0,
                material: 0,
                plant: 0,
                total: 0,
                lineCount: 0
            });
        }
        const ps = phaseMap.get(line.buildPhase)!;
        ps.lineCount++;
        const type = line.resourceType.toLowerCase();
        if (type === 'labour') ps.labour += line.lineTotal;
        else if (type === 'plant') ps.plant += line.lineTotal;
        else ps.material += line.lineTotal; // Material or unknown
        ps.total += line.lineTotal;
    });

    // Round phase summaries
    phaseMap.forEach(ps => {
        ps.labour = Math.round(ps.labour * 100) / 100;
        ps.material = Math.round(ps.material * 100) / 100;
        ps.plant = Math.round(ps.plant * 100) / 100;
        ps.total = Math.round(ps.total * 100) / 100;
    });

    const phaseSummaries = Array.from(phaseMap.values());

    // Grand totals
    const totals = {
        labour: Math.round(budgetLines.filter(l => l.resourceType.toLowerCase() === 'labour').reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
        material: Math.round(budgetLines.filter(l => l.resourceType.toLowerCase() === 'material').reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
        plant: Math.round(budgetLines.filter(l => l.resourceType.toLowerCase() === 'plant').reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
        grand: 0
    };
    totals.grand = Math.round((totals.labour + totals.material + totals.plant) * 100) / 100;

    return {
        clientName,
        clientAddress,
        clientPostcode,
        projectType,
        lines: budgetLines,
        phaseSummaries,
        totals,
        parsedAt: new Date().toISOString(),
        lineCount: budgetLines.length,
        errorCount: errors.length,
        errors
    };
}
