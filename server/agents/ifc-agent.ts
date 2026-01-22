
import * as WebIFC from "web-ifc";
import * as fs from "fs";
import * as path from "path";

export interface IfcExtractionResult {
    success: boolean;
    rooms: any[];
    elements: any[];
    error?: string;
}

export class IfcAgent {
    private ifcApi: WebIFC.IfcAPI;

    constructor() {
        this.ifcApi = new WebIFC.IfcAPI();
        // Point to the WASM file location if needed, but often not needed for node.js in memory
        // Copied to local dir for reliability
        // this.ifcApi.SetWasmPath(path.join(process.cwd(), "server/agents/"));
    }

    public async process(ifcPath: string): Promise<IfcExtractionResult> {
        try {
            await this.ifcApi.Init();

            const fileData = fs.readFileSync(ifcPath);
            // Load the model
            const modelID = this.ifcApi.OpenModel(new Uint8Array(fileData));

            console.log(`🏢 IFC Model Loaded: ID ${modelID}`);

            // 1. Extract Rooms (IfcSpace)
            const rooms: any[] = [];
            const spaces = this.ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCSPACE);

            for (let i = 0; i < spaces.size(); i++) {
                const spaceID = spaces.get(i);
                const space = this.ifcApi.GetLine(modelID, spaceID);

                // Get Name
                let name = "Unnamed Space";
                if (space.Name && space.Name.value) name = space.Name.value;
                if (space.LongName && space.LongName.value) name = space.LongName.value;

                console.log(`   found space: ${name}`);

                rooms.push({
                    name: name,
                    id: spaceID,
                    // BBox would require geometry calculation which is complex in generic web-ifc 
                    // without a geometry engine. We will skip BBox for now or default it.
                    bbox: [0, 0, 100, 100]
                });
            }

            // 2. Extract Elements (IfcWall, IfcWindow, IfcDoor, IfcSlab)
            const elements: any[] = [];

            const types = [
                { type: WebIFC.IFCWALL, label: 'wall' },
                { type: WebIFC.IFCWALLSTANDARDCASE, label: 'wall' },
                { type: WebIFC.IFCWINDOW, label: 'window' },
                { type: WebIFC.IFCDOOR, label: 'door' },
                { type: WebIFC.IFCSLAB, label: 'slab' },
                { type: WebIFC.IFCOVERING, label: 'finish' },
                { type: WebIFC.IFCFURNISHINGELEMENT, label: 'furniture' },
                { type: WebIFC.IFCFLOWTERMINAL, label: 'plumbing' }, // Sinks, toilets
                { type: WebIFC.IFCELECTRICALELEMENT, label: 'electrical' } // Generic
            ];

            for (const t of types) {
                const ids = this.ifcApi.GetLineIDsWithType(modelID, t.type);
                for (let i = 0; i < ids.size(); i++) {
                    const id = ids.get(i);
                    const el = this.ifcApi.GetLine(modelID, id);
                    const name = el.Name ? el.Name.value : (el.ObjectType ? el.ObjectType.value : t.label);

                    elements.push({
                        type: t.label,
                        name: name,
                        id: id
                    });
                }
            }

            console.log(`⚡ IFC Extraction: ${rooms.length} rooms, ${elements.length} elements.`);

            this.ifcApi.CloseModel(modelID);

            return {
                success: true,
                rooms,
                elements
            };

        } catch (err: any) {
            console.error("IFC Processing Error:", err);
            return {
                success: false,
                rooms: [],
                elements: [],
                error: err.message
            };
        }
    }
}
