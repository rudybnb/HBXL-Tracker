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
    static calculate(job: Job): QSTenderDocument | null {
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

        // Safety check: specific to "New Job" state
        // Return empty document instead of null to allow UI to render (and show 0 items)
        if (!resourceData ||
            (Object.keys(resourceData).length === 0) ||
            (!resourceData.financials && !resourceData.rooms && !resourceData.phases)) {

            return {
                projectId: job.id,
                projectName: job.title,
                generatedAt: new Date().toISOString(),
                grandTotal: 0,
                sections: []
            };
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
                        element: item.category || item.resourceType || 'MATERIAL',
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

        // Check for NEW JobPayload format (Room-Based)
        if (resourceData.rooms && Array.isArray(resourceData.rooms)) {
            console.log("📊 Using ROOM-BASED JobPayload for QS Tender");
            const sections: QSSection[] = [];
            let grandTotal = 0;

            (resourceData.rooms as any[]).forEach((room, idx) => {
                const sectionItems: QSItem[] = room.tasks.map((t: any) => ({
                    element: t.type, // LABOUR, MATERIAL
                    description: t.description,
                    quantity: t.qty,
                    unit: t.unit,
                    rate: (t.hbxl_unit_rate_pence || 0) / 100,
                    total: (t.contractor_total_pence ?? t.hbxl_total_pence) / 100,
                    isCalculated: false
                }));

                const sectionTotal = sectionItems.reduce((acc, i) => acc + i.total, 0);
                grandTotal += sectionTotal;

                sections.push({
                    id: (idx + 1).toString(),
                    title: room.room_name,
                    description: `${sectionItems.length} items`,
                    total: sectionTotal,
                    items: sectionItems
                });
            });

            return {
                projectId: job.id.toString(),
                projectName: job.title || "Project " + job.id,
                generatedAt: new Date().toISOString(),
                grandTotal: grandTotal,
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
        // Map external wall items assigned to Masonry Shell
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

        allItems.forEach(item => {
            section.items.push(this.mapItemToQS(item, "Foundation Item"));
        });

        section.total = section.items.reduce((sum, item) => sum + item.total, 0);
        return section;
    }

    private static calculateExternalWalls(items: any[]): QSSection {
        const section: QSSection = {
            id: "4",
            title: "EXTERNAL WALLS",
            description: "External elevations masonry and blockwork",
            total: 0,
            items: []
        };

        (items || []).forEach(item => {
            section.items.push(this.mapItemToQS(item, "External Wall Item"));
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
