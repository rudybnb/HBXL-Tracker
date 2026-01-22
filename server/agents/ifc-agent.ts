
import * as WebIFC from "web-ifc";
import * as fs from "fs";
import * as path from "path";

// Geometry Helpers
interface Point3D { x: number; y: number; z: number; }
interface Point { x: number; y: number; }

function getDistance(p1: Point, p2: Point) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function extractWallCenterline(points3D: Point3D[]): { start: Point; end: Point } | null {
    if (points3D.length < 2) return null;
    const minZ = Math.min(...points3D.map(p => p.z));
    // Filter floor-level points (approximate)
    const floorPoints = points3D.filter(p => Math.abs(p.z - minZ) < 0.1);

    if (floorPoints.length < 2) return null;

    // Convert to 2D
    const points2D = floorPoints.map(p => ({ x: p.x, y: p.y }));

    // Find furthest pair (wall endpoints)
    let maxDist = 0;
    let start = points2D[0];
    let end = points2D[0];

    for (let i = 0; i < points2D.length; i++) {
        for (let j = i + 1; j < points2D.length; j++) {
            const dx = points2D[j].x - points2D[i].x;
            const dy = points2D[j].y - points2D[i].y;
            const dist = dx * dx + dy * dy;
            if (dist > maxDist) {
                maxDist = dist;
                start = points2D[i];
                end = points2D[j];
            }
        }
    }
    return { start, end };
}

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

            // 0. Pre-load Property Sets (Optimization)
            const propertyMap = new Map<number, any[]>();
            try {
                const rels = this.ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
                for (let i = 0; i < rels.size(); i++) {
                    const relID = rels.get(i);
                    const rel = this.ifcApi.GetLine(modelID, relID);
                    if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects) && rel.RelatingPropertyDefinition) {
                        const psetID = rel.RelatingPropertyDefinition.value;
                        const pset = this.ifcApi.GetLine(modelID, psetID);
                        for (const objRef of rel.RelatedObjects) {
                            const objID = objRef.value;
                            if (!propertyMap.has(objID)) propertyMap.set(objID, []);
                            propertyMap.get(objID)?.push(pset);
                        }
                    }
                }
            } catch (e) {
                console.warn("Could not load properties:", e);
            }

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
                { type: WebIFC.IFCELECTRICALELEMENT, label: 'electrical' }, // Generic
                { type: WebIFC.IFCBEAM, label: 'structure' },
                { type: WebIFC.IFCCOLUMN, label: 'structure' },
                { type: WebIFC.IFCMEMBER, label: 'structure' },
                { type: WebIFC.IFCSTAIR, label: 'stair' },
                { type: WebIFC.IFCRAILING, label: 'railing' },
                { type: WebIFC.IFCBUILDINGELEMENTPROXY, label: 'generic' }
            ];

            for (const t of types) {
                const ids = this.ifcApi.GetLineIDsWithType(modelID, t.type);
                for (let i = 0; i < ids.size(); i++) {
                    const id = ids.get(i);
                    const el = this.ifcApi.GetLine(modelID, id);
                    let name = el.Name ? el.Name.value : (el.ObjectType ? el.ObjectType.value : t.label);

                    // Extract Properties to Description
                    const props = propertyMap.get(id) || [];
                    let details: string[] = [];
                    for (const pset of props) {
                        if (pset.HasProperties && Array.isArray(pset.HasProperties)) {
                            for (const pRef of pset.HasProperties) {
                                try {
                                    const prop = this.ifcApi.GetLine(modelID, pRef.value);
                                    if (prop.Name && prop.NominalValue) {
                                        const pName = prop.Name.value;
                                        const pVal = prop.NominalValue.value;
                                        // Filter for useful dimensions
                                        if (["Width", "Height", "Length", "Area", "Volume", "Thickness"].includes(pName)) {
                                            let val = typeof pVal === 'number' ? Number(pVal).toFixed(2) : pVal;
                                            details.push(`${pName}: ${val}`);
                                        }
                                    }
                                } catch (err) { }
                            }
                        }
                    }

                    if (details.length > 0) name += ` (${details.join(", ")})`;

                    // Extract Geometry if Wall
                    let geometry = null;
                    if (t.label === 'wall') {
                        const localPoints = this.getLocalPoints(modelID, id);
                        const centerline = extractWallCenterline(localPoints);
                        if (centerline) {
                            geometry = centerline;
                            // Optional: Visualize length in name
                            // const len = getDistance(centerline.start, centerline.end);
                            // name += ` [L:${len.toFixed(2)}]`; 
                            console.log(`Debug Extracted Wall: ${name} (Points: ${localPoints.length})`);
                        }
                    }

                    elements.push({
                        type: t.label,
                        name: name,
                        id: id,
                        geometry
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

    private getLocalPoints(modelID: number, elementID: number): Point3D[] {
        const points: Point3D[] = [];
        const visited = new Set<number>();

        const visit = (id: number) => {
            if (visited.has(id)) return;
            visited.add(id);

            try {
                const type = this.ifcApi.GetType(modelID, id);
                if (type === WebIFC.IFCCARTESIANPOINT) {
                    const line = this.ifcApi.GetLine(modelID, id);
                    if (line.Coordinates) {
                        const c = line.Coordinates;
                        // Ensure valid numbers
                        const x = typeof c[0] === 'number' ? c[0] : (c[0]?.value || 0);
                        const y = typeof c[1] === 'number' ? c[1] : (c[1]?.value || 0);
                        const z = c[2] ? (typeof c[2] === 'number' ? c[2] : (c[2].value || 0)) : 0;

                        points.push({ x, y, z });
                    }
                    return;
                }

                // Traversal logic
                const line = this.ifcApi.GetLine(modelID, id);
                const structFields = ['Representation', 'Representations', 'Items', 'OuterCurve', 'Points', 'Polygon', 'SweptArea'];
                for (const f of structFields) {
                    const val = line[f];
                    if (val) {
                        if (Array.isArray(val)) {
                            // Helper to recurse handles
                            val.forEach(v => {
                                if (v.value) visit(v.value);
                            });
                        } else if (val.value) {
                            visit(val.value);
                        }
                    }
                }
            } catch (e) { }
        };

        const el = this.ifcApi.GetLine(modelID, elementID);
        if (el.Representation && el.Representation.value) {
            visit(el.Representation.value);
        }
        return points;
    }
}
