import { Job, JobAssignment } from "@shared/schema";

// QS Pricing Model Constants & Rules
const CONSTANTS = {
    // HARDCODED DIMENSIONS FROM PROMPT
    EXTERNAL_WALL_LENGTH: 6.685, // meters
    EXTERNAL_WALL_COUNT: 4,
    EXTERNAL_WALL_HEIGHT: 2.4, // Assumed standard height (not in prompt, but required for Area)

    // RATES FROM PROMPT
    RATES: {
        BRICKWORK_SQM: 55.00,
        BRICK_LAYING_EACH: 0.55,
        CAVITY_INSULATION_SQM: 5.00,
        BLOCKWORK_LAYING_EACH: 1.00,
    }
};

// Interface for the Structured Tender Document
export interface QSTenderDocument {
    projectId: string; // Job ID
    projectName: string;
    generatedAt: string;
    grandTotal: number;
    sections: QSSection[];
}

export interface QSSection {
    id: string; // e.g. "1", "2"
    title: string; // e.g. "FOUNDATIONS"
    description?: string;
    total: number;
    items: QSItem[];
}

export interface QSItem {
    element: string; // e.g. "Excavation"
    description: string;
    quantity: number;
    unit: string; // m3, sqm, nr, lm
    rate: number;
    total: number;
    isCalculated: boolean; // True if derived from Rules, False if from CSV
}

export class QSCalculator {

    /**
     * Generates the Full QS Tender Document for a Job
     */
    static calculate(job: Job): QSTenderDocument {
        // 1. Parse CSV Data (Phase Task Data)
        // The previous import logic stores it as a JSON string in phaseTaskData or similar field
        // We need to robustly parse it.
        let resourceData: any = {};
        try {
            if (typeof job.phaseTaskData === 'string') {
                resourceData = JSON.parse(job.phaseTaskData);
            } else {
                resourceData = job.phaseTaskData || {};
            }
        } catch (e) {
            console.error("Failed to parse job phase data", e);
        }

        // Check if this is Materials Used format (Job 49 style)
        // These have financials with totalLabour, totalMaterial, etc.
        if (resourceData.financials && resourceData.financials.grandTotal) {
            console.log("📊 Using MATERIALS USED format for QS Tender");

            const sections: QSSection[] = [];
            let grandTotal = 0;

            // Add financial summary section first
            const financials = resourceData.financials;
            sections.push({
                id: 'financial-summary',
                title: 'FINANCIAL SUMMARY',
                description: 'Cost breakdown by category',
                total: (financials.grandTotal || 0) / 100,
                items: [
                    { element: 'LABOUR', description: 'All labour costs', quantity: 1, unit: 'Sum', rate: 0, total: (financials.totalLabour || 0) / 100, isCalculated: false },
                    { element: 'MATERIAL', description: 'All material costs', quantity: 1, unit: 'Sum', rate: 0, total: (financials.totalMaterial || 0) / 100, isCalculated: false },
                    { element: 'PLANT', description: 'Plant and equipment', quantity: 1, unit: 'Sum', rate: 0, total: (financials.totalPlant || 0) / 100, isCalculated: false },
                    { element: 'SUBCONTRACTOR', description: 'Subcontractor costs', quantity: 1, unit: 'Sum', rate: 0, total: (financials.totalSubcontractor || 0) / 100, isCalculated: false }
                ]
            });

            // Group items by work phase from the phases object
            const phases = resourceData.phases || {};

            for (const [phaseName, items] of Object.entries(phases) as [string, any[]][]) {
                const sectionItems: QSItem[] = [];
                let sectionTotal = 0;

                for (const item of items) {
                    const itemTotal = (item.total || 0) / 100; // Convert from pence to pounds
                    sectionTotal += itemTotal;

                    sectionItems.push({
                        element: item.category || 'MATERIAL',
                        description: item.description || 'Unknown',
                        quantity: item.quantity || 1,
                        unit: item.unit || 'Each',
                        rate: (item.rate || 0) / 100, // Convert from pence
                        total: itemTotal,
                        isCalculated: false // This is actual data, not estimated
                    });
                }

                sections.push({
                    id: `section-${phaseName.toLowerCase().replace(/\s+/g, '-')}`,
                    title: phaseName.toUpperCase(),
                    description: `${sectionItems.length} items`,
                    total: sectionTotal,
                    items: sectionItems
                });

                grandTotal += sectionTotal;
            }

            return {
                projectId: job.id.toString(),
                projectName: job.title || "Project " + job.id,
                generatedAt: new Date().toISOString(),
                grandTotal: (financials.grandTotal || 0) / 100,
                sections
            };
        }

        // Helper to find resources by Phase Name
        // The "enhanced" import stores phases in `phases` object
        // usage: getItems("Footings")
        const getItems = (phaseName: string): any[] => {
            // Handle different data structures from the CSV import evolution
            if (resourceData.phases && resourceData.phases[phaseName]) {
                return resourceData.phases[phaseName];
            }
            // Fallback for flat structure
            if (resourceData[phaseName]) {
                return resourceData[phaseName];
            }
            return [];
        };

        const sections: QSSection[] = [];
        let grandTotal = 0;

        // --- 1. FOUNDATIONS ---
        const foundations = this.calculateFoundations(getItems("Foundations"), getItems("Footings"));
        sections.push(foundations);
        grandTotal += foundations.total;

        // --- 2. CONCRETE FLOOR ---
        const floor = this.calculateConcreteFloor(getItems("Oversite and Slabbing"));
        sections.push(floor);
        grandTotal += floor.total;

        // --- 3. SCREED ---
        const screed = this.calculateScreed(getItems("Plastering")); // Screed often under plastering/floor
        sections.push(screed);
        grandTotal += screed.total;

        // --- 4. EXTERNAL WALLS ---
        // This uses the SPECIAL RULE: 6.685m x 4
        const walls = this.calculateExternalWalls(getItems("Masonry Shell"));
        sections.push(walls);
        grandTotal += walls.total;

        // --- 5. INTERNAL WALLS ---
        const internalWalls = this.calculateInternalWalls(getItems("Masonry Shell"), getItems("Joinery 1st Fix"));
        sections.push(internalWalls);
        grandTotal += internalWalls.total;

        // --- 6. BATHROOM ---
        const bathroom = this.calculateRoomItems("Bathroom", getItems("Joinery 2nd Fix"), getItems("Plastering"), getItems("Electrical 2nd Fix"));
        sections.push(bathroom);
        grandTotal += bathroom.total;

        // --- 7. LOUNGE ---
        const lounge = this.calculateRoomItems("Lounge", getItems("Joinery 2nd Fix"), getItems("Electrical 2nd Fix"), getItems("Internal Decoration"));
        sections.push(lounge);
        grandTotal += lounge.total;

        // --- 8. ROOF ---
        const roof = this.calculateRoof(getItems("Roof Structure"), getItems("Roof Tiling"));
        sections.push(roof);
        grandTotal += roof.total;

        return {
            projectId: job.id.toString(),
            projectName: job.title || "Project " + job.id,
            generatedAt: new Date().toISOString(),
            grandTotal,
            sections
        };
    }

    // --- INDIVIDUAL CALCULATORS ---

    private static calculateFoundations(items1: any[], items2: any[]): QSSection {
        const section: QSSection = {
            id: "1",
            title: "FOUNDATIONS",
            description: "Foundations to external walls and load-bearing internal walls",
            total: 0,
            items: []
        };

        // Combine items
        const allItems = [...(items1 || []), ...(items2 || [])];

        // Attempt to extract Real Costs from CSV
        let concreteVol = 0;
        let concreteCost = 0;

        allItems.forEach(item => {
            // Check for Concrete
            if (item.description.toLowerCase().includes("concrete") && item.unit === "m³") {
                concreteVol += item.quantity;
                concreteCost += item.totalCost || 0;
            }
        });

        // Add mapped items
        if (concreteVol > 0) {
            section.items.push({
                element: "Concrete to strip foundations",
                description: "Ready Mix Concrete from CSV",
                quantity: concreteVol,
                unit: "m³",
                rate: concreteCost / concreteVol,
                total: concreteCost,
                isCalculated: false
            });
        }

        // Add PLACEHOLDER items if missing (as per prompt rules)
        if (section.items.length === 0) {
            // Theoretical calculation based on wall length?
            // For now, we add a "Not Found" item or estimate
            const estimatedVol = (CONSTANTS.EXTERNAL_WALL_LENGTH * CONSTANTS.EXTERNAL_WALL_COUNT) * 0.6 * 1.0; // Length * Width * Depth
            section.items.push({
                element: "Excavation (Estimate)",
                description: "Theoretical Excavation based on Perimter",
                quantity: parseFloat(estimatedVol.toFixed(2)),
                unit: "m³",
                rate: 25.00, // Hardcoded estimate
                total: parseFloat((estimatedVol * 25).toFixed(2)),
                isCalculated: true
            });
        }

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateConcreteFloor(items: any[]): QSSection {
        const section: QSSection = {
            id: "2",
            title: "CONCRETE FLOOR BUILD-UP",
            description: "Ground Floor Slab",
            total: 0,
            items: []
        };

        // Logic: Look for "Polythene", "Concrete", "Insulation" in this phase
        (items || []).forEach(item => {
            if (item.totalCost > 0) {
                section.items.push({
                    element: "Material",
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    rate: item.unitPrice || 0,
                    total: item.totalCost,
                    isCalculated: false
                });
            }
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateScreed(items: any[]): QSSection {
        const section: QSSection = {
            id: "3",
            title: "SCREED",
            description: "Screed applied over structural slab",
            total: 0,
            items: []
        };

        // Look for "Screed"
        let found = false;
        (items || []).forEach(item => {
            if (item.description.toLowerCase().includes("screed")) {
                section.items.push(this.mapItemToQS(item, "Screed"));
                found = true;
            }
        });

        if (!found) {
            // Estimate based on Floor Area (approx internal of 6.685 sq?)
            const area = (CONSTANTS.EXTERNAL_WALL_LENGTH - 0.6) * (CONSTANTS.EXTERNAL_WALL_LENGTH - 0.6); // Simple box
            section.items.push({
                element: "Screed Area (Estimate)",
                description: "Estimated area",
                quantity: parseFloat(area.toFixed(2)),
                unit: "sqm",
                rate: 15.00,
                total: parseFloat((area * 15).toFixed(2)),
                isCalculated: true
            });
        }

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateExternalWalls(items: any[]): QSSection {
        const section: QSSection = {
            id: "4",
            title: "EXTERNAL WALLS",
            description: `Four external elevations, each measuring ${CONSTANTS.EXTERNAL_WALL_LENGTH}m length`,
            total: 0,
            items: []
        };

        // 1. CALCULATE WALL AREA (RULE)
        // Area = Length * Height * 4 walls
        const totalArea = CONSTANTS.EXTERNAL_WALL_LENGTH * CONSTANTS.EXTERNAL_WALL_HEIGHT * 4;

        // 2. PRICING OPTION A: BRICKWORK (Area Based)
        const brickCost = totalArea * CONSTANTS.RATES.BRICKWORK_SQM;

        section.items.push({
            element: "A. Outer Leaf - Facing Brickwork",
            description: `Measured Area (${CONSTANTS.EXTERNAL_WALL_LENGTH}m x ${CONSTANTS.EXTERNAL_WALL_HEIGHT}m x 4)`,
            quantity: parseFloat(totalArea.toFixed(2)),
            unit: "sqm",
            rate: CONSTANTS.RATES.BRICKWORK_SQM,
            total: parseFloat(brickCost.toFixed(2)),
            isCalculated: true
        });

        // 3. CAVITY INSULATION
        const insCost = totalArea * CONSTANTS.RATES.CAVITY_INSULATION_SQM;
        section.items.push({
            element: "B. Cavity Insulation",
            description: "Measured Area (matches wall area)",
            quantity: parseFloat(totalArea.toFixed(2)),
            unit: "sqm",
            rate: CONSTANTS.RATES.CAVITY_INSULATION_SQM,
            total: parseFloat(insCost.toFixed(2)),
            isCalculated: true
        });

        // 4. INNER LEAF BLOCKS
        // Rate is £1.00 per block. Standard block is 10/m2.
        const blockCount = totalArea * 10;
        const blockCost = blockCount * CONSTANTS.RATES.BLOCKWORK_LAYING_EACH;
        section.items.push({
            element: "C. Inner Leaf - Blockwork",
            description: "Standard 10 blocks/m2",
            quantity: parseFloat(blockCount.toFixed(0)),
            unit: "nr",
            rate: CONSTANTS.RATES.BLOCKWORK_LAYING_EACH,
            total: parseFloat(blockCost.toFixed(2)),
            isCalculated: true
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateInternalWalls(masonry: any[], joinery: any[]): QSSection {
        const section: QSSection = {
            id: "5",
            title: "INTERNAL WALLS",
            description: "Blockwork & Stud Walls",
            total: 0,
            items: []
        };

        // Look for "Block" in Masonry that isn't external?
        // Hard to distinguish without specific codes.
        // We will list CSV items that match "Block" or "Stud" or "Timber"

        (masonry || []).forEach(item => {
            if (item.description.toLowerCase().includes("block") && !item.description.toLowerCase().includes("facing")) {
                section.items.push(this.mapItemToQS(item, "Blockwork Internal"));
            }
        });

        (joinery || []).forEach(item => {
            if (item.description.toLowerCase().includes("stud") || item.description.toLowerCase().includes("carcass")) {
                section.items.push(this.mapItemToQS(item, "Stud Wall Material"));
            }
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateRoomItems(roomName: string, ...phases: any[][]): QSSection {
        const section: QSSection = {
            id: roomName === "Bathroom" ? "6" : "7",
            title: roomName.toUpperCase(),
            description: `${roomName}-based element pricing`,
            total: 0,
            items: []
        };

        // Flatten phases
        const allItems = phases.flat().filter(i => i);

        // Filter logic:
        // If CSV has "Location" or "Room" column, we use it. 
        // Freddy Jackson CSV DOES NOT have a Room column.
        // Strategy: We must search for keywords in Description.

        const keywords = roomName === "Bathroom"
            ? ["Shower", "Bath", "Basin", "WC", "Toilet", "Tiling", "Extractor"]
            : ["TV", "Socket", "Radiator", "Window", "Laminate"];

        allItems.forEach(item => {
            if (keywords.some(k => item.description.toLowerCase().includes(k.toLowerCase()))) {
                section.items.push(this.mapItemToQS(item, "Room Item"));
            }
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateRoof(structure: any[], tiling: any[]): QSSection {
        const section: QSSection = {
            id: "8",
            title: "ROOF",
            description: "Structural & Covering",
            total: 0,
            items: []
        };

        const allItems = [...(structure || []), ...(tiling || [])];

        // Group into A (Structural), B (Covering), C (Rainwater)

        allItems.forEach(item => {
            const desc = item.description.toLowerCase();
            let cat = "Other";
            if (desc.includes("truss") || desc.includes("timber") || desc.includes("batten")) cat = "A. Structural";
            else if (desc.includes("tile") || desc.includes("slate") || desc.includes("ridge")) cat = "B. Roof Covering";
            else if (desc.includes("gutter") || desc.includes("fascia") || desc.includes("soffit")) cat = "C. Rainwater Goods";

            section.items.push(this.mapItemToQS(item, cat));
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    // --- HELPER ---
    private static mapItemToQS(csvItem: any, elementCategory: string): QSItem {
        return {
            element: elementCategory,
            description: csvItem.description,
            quantity: csvItem.quantity,
            unit: csvItem.unit || "nr",
            rate: csvItem.unitPrice || 0,
            total: csvItem.totalCost || 0,
            isCalculated: false
        };
    }
}
