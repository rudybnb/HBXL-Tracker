
import * as WebIFC from "web-ifc";
import * as fs from "fs";
import * as path from "path";
import { GeometricRoomDetector } from "./geometric-room-detector";
import { GridRoomDetector } from "./grid-room-detector";

const ARCHITECT_PROMPT = `### ROLE (MOST CRITICAL)
You are the **Architectural Drawing Intelligence Agent**.
Your job is to read IFC data exported from PlanXpress and correctly interpret **what exists in the building**.
You are the **foundation of all downstream logic**. If you are wrong, everything else fails.

### YOU MUST DO
* Read IFC files
* Identify **rooms (not spaces)**
* Identify all **architectural and building elements** inside each room
* Identify **global (non-room) elements**
* Provide accurate object context (location, internal/external)

You do **not** price.
You do **not** estimate.
You do **not** guess.

### YOU MUST IDENTIFY
Per room:
* Doors
* Windows
* Skirting
* Walls
* Ceilings
* Floor finishes
* Wall finishes

Global:
* Foundations
* Floors
* External walls
* Roof

### RULES
* Drawings define **existence only**
* Symbols and IFC object types take priority
* If information is missing → flag it
* Never infer fire ratings unless tagged

### OUTPUT FORMAT
\`\`\`
Room: Bathroom
Objects:
- Internal door (1)
- Window (1)
- Wall finish: tile
- Floor finish: tile
\`\`\`
`;

interface Point3D { x: number; y: number; z: number; }
interface Point { x: number; y: number; }

function extractWallCenterline(points3D: Point3D[]): { start: Point; end: Point } | null {
    if (points3D.length < 2) return null;
    const minZ = Math.min(...points3D.map(p => p.z));
    const floorPoints = points3D.filter(p => Math.abs(p.z - minZ) < 0.1);

    // Fallback: Use all points if planar (2D)
    const pointsToUse = floorPoints.length >= 2 ? floorPoints : points3D;

    if (pointsToUse.length < 2) return null;
    const points2D = pointsToUse.map(p => ({ x: p.x, y: p.y }));

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

function isPointInPolygon(p: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
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
        // const wasmPath = path.join(process.cwd(), "node_modules", "web-ifc") + "/";
        // this.ifcApi.SetWasmPath(wasmPath, true);
    }

    public async process(ifcPath: string): Promise<IfcExtractionResult> {
        const logFile = path.join(path.dirname(ifcPath), "ifc-agent.log");
        const log = (msg: string) => {
            try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch (e) { }
            console.log(`[ARCHITECT] ${msg}`);
        };

        try {
            log(`Starting extraction for ${ifcPath}`);
            await this.ifcApi.Init();
            const fileData = fs.readFileSync(ifcPath);
            const modelID = this.ifcApi.OpenModel(new Uint8Array(fileData));
            log(`Model Loaded ID: ${modelID}`);

            // Pre-load Properties
            const propertyMap = new Map<number, any[]>();
            try {
                const rels = this.ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
                for (let i = 0; i < rels.size(); i++) {
                    const rel = this.ifcApi.GetLine(modelID, rels.get(i));
                    if (rel.RelatedObjects && rel.RelatingPropertyDefinition) {
                        const pset = this.ifcApi.GetLine(modelID, rel.RelatingPropertyDefinition.value);
                        for (const objRef of rel.RelatedObjects) {
                            const objID = objRef.value;
                            if (!propertyMap.has(objID)) propertyMap.set(objID, []);
                            propertyMap.get(objID)?.push(pset);
                        }
                    }
                }
            } catch (e) { }

            // GEOMETRY PRE-CALCULATION
            const idToBBox = new Map<number, number[]>();
            try {
                log("Loading All Geometry...");
                this.ifcApi.LoadAllGeometry(modelID);
                this.ifcApi.StreamAllMeshes(modelID, (mesh: any) => {
                    const id = mesh.expressID;
                    const geom = mesh.geometries;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let i = 0; i < geom.size(); i++) {
                        const geomID = geom.get(i);
                        const geomData = this.ifcApi.GetGeometry(modelID, geomID);
                        if (geomData) {
                            const verts = this.ifcApi.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());
                            for (let k = 0; k < verts.length; k += 6) {
                                const x = verts[k], y = verts[k + 1];
                                if (x < minX) minX = x; if (y < minY) minY = y;
                                if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (minX !== Infinity) idToBBox.set(id, [minX, minY, maxX, maxY]);
                });
            } catch (e: any) {
                log(`Geometry Stream/Load Error: ${e.message}`);
            }

            // Extract Elements
            const elements: any[] = [];
            const allTypes = [
                { type: WebIFC.IFCWALL, label: 'wall' }, { type: WebIFC.IFCWALLSTANDARDCASE, label: 'wall' },
                { type: WebIFC.IFCWINDOW, label: 'window' }, { type: WebIFC.IFCDOOR, label: 'door' },
                { type: WebIFC.IFCSLAB, label: 'slab' }, { type: WebIFC.IFCCOVERING, label: 'finish' },
                { type: WebIFC.IFCFURNISHINGELEMENT, label: 'furniture' },
                // MEP Elements
                { type: WebIFC.IFCLIGHTFIXTURE, label: 'light' },
                { type: WebIFC.IFCOUTLET, label: 'socket' },
                { type: WebIFC.IFCSWITCHINGDEVICE, label: 'switch' },
                { type: WebIFC.IFCSANITARYTERMINAL, label: 'sanitary' },
                { type: WebIFC.IFCFLOWTERMINAL, label: 'plumbing' }, // Fallback/Other
                { type: WebIFC.IFCELECTRICALELEMENT, label: 'electrical' }, // Fallback/Other

                { type: WebIFC.IFCBEAM, label: 'structure' },
                { type: WebIFC.IFCCOLUMN, label: 'structure' }, { type: WebIFC.IFCMEMBER, label: 'structure' },
                { type: WebIFC.IFCSTAIR, label: 'stair' }, { type: WebIFC.IFCRAILING, label: 'railing' },
                { type: WebIFC.IFCBUILDINGELEMENTPROXY, label: 'generic' }, { type: WebIFC.IFCROOF, label: 'roof' },
                { type: WebIFC.IFCSPACE, label: 'room' }
            ];

            for (const t of allTypes) {
                const ids = this.ifcApi.GetLineIDsWithType(modelID, t.type);
                for (let i = 0; i < ids.size(); i++) {
                    const id = ids.get(i);
                    const el = this.ifcApi.GetLine(modelID, id);
                    let name = el.Name ? el.Name.value : (el.ObjectType ? el.ObjectType.value : t.label);

                    let geometry: any = null;
                    let bbox = idToBBox.get(id) || null;

                    // FORCE Geometry Extraction for Walls (to handle rotation correctly)
                    // WebIFC 'bbox' is Axis-Aligned, which makes rotated walls look fat/distorted.
                    const forceGeometry = t.label === 'wall';

                    // Fallback Placement Logic if no bbox OR if we identify it's a wall (needs precision)
                    if (!bbox || forceGeometry) {
                        try {
                            const polylineGeom = this.getPolylineGeometry(modelID, id);
                            if (polylineGeom) {
                                bbox = polylineGeom.bbox;
                                geometry = polylineGeom.geometry;
                                // ... (width/height calc)
                                const width = Math.abs(bbox[2] - bbox[0]);
                                const height = Math.abs(bbox[3] - bbox[1]);
                                (el as any).width = Math.max(width, height).toFixed(0) + 'mm';
                            } else {
                                // Last resort: Local Points (existing)
                                let localPoints = this.getLocalPoints(modelID, id);
                                const place = this.getPlacement(modelID, id);
                                if (localPoints.length > 0) {
                                    // Adjust for placement (Translation + Rotation)
                                    // Make sure we apply this if placement exists
                                    if (place.x !== 0 || place.y !== 0 || place.rotation !== 0) {
                                        localPoints = this.applyTransform(localPoints, place);
                                    }
                                }
                                if (localPoints.length > 0) {
                                    // 1. Calculate BBox from points
                                    const minX = Math.min(...localPoints.map(p => p.x));
                                    const minY = Math.min(...localPoints.map(p => p.y));
                                    const maxX = Math.max(...localPoints.map(p => p.x));
                                    const maxY = Math.max(...localPoints.map(p => p.y));
                                    bbox = [minX, minY, maxX, maxY];

                                    const width = maxX - minX;
                                    const height = maxY - minY;

                                    // 2. FORCE Polygon Geometry for Walls
                                    // We cannot rely on BBox for walls because any rotation (e.g. 45 deg)
                                    // makes the AABB (Axis Aligned Bounding Box) a giant square, ruining the drawing.
                                    // We must use the exact footprint polygon.
                                    if (t.label === 'wall') {
                                        geometry = this.getFootprint(localPoints);
                                    } else {
                                        // For other items, center point is often enough, or use footprint if needed
                                        geometry = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
                                    }

                                    (el as any).width = Math.max(width, height).toFixed(0) + 'mm';
                                }
                            }
                        } catch (e) { console.error('Fallback Geom Error', e); }
                    }

                    // If we still have no geometry but have a BBox (non-walls or failed extraction), use BBox
                    if (!geometry && bbox) {
                        // Geometry from BBox
                        const [minX, minY, maxX, maxY] = bbox;
                        const width = Math.abs(maxX - minX);
                        const height = Math.abs(maxY - minY);

                        // Define center point for labels
                        geometry = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

                        // Capture Dimensions for detailed report (e.g. Window 1200mm)
                        if (t.label === 'window' || t.label === 'door') {
                            // Store largest dimension as "width" for display
                            (el as any).width = Math.max(width, height).toFixed(0) + 'mm';
                        }
                    }

                    // Check IsExternal
                    let isExternal = false;
                    const psets = propertyMap.get(id);
                    if (psets) {
                        for (const pset of psets) {
                            if (pset.Name && pset.Name.value === 'Pset_WallCommon') {
                                if (pset.HasProperties) {
                                    for (const propRef of pset.HasProperties) {
                                        const prop = this.ifcApi.GetLine(modelID, propRef.value);
                                        if (prop.Name && prop.Name.value === 'IsExternal') {
                                            if (prop.NominalValue &&
                                                (prop.NominalValue.value === true || prop.NominalValue.value === 'T')) {
                                                isExternal = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Fallback: If Wall Thickness > 220mm, assume External
                    // Note: This matches standard UK Cavity walls (102 brick + 100 block + cavity ~ 300mm)
                    // Internal partitions are mostly 75mm stud / 100mm block
                    if (t.label === 'wall' && bbox) {
                        const w = Math.abs(bbox[2] - bbox[0]);
                        const h = Math.abs(bbox[3] - bbox[1]);
                        const thickness = Math.min(w, h); // This assumes logic: shortest side is thickness

                        // Debug log to file so we can see what's happening
                        if (elements.length < 20) {
                            log(`DEBUG WALL ${id}: External=${isExternal}, Thick=${thickness.toFixed(2)} (w=${w.toFixed(2)}, h=${h.toFixed(2)})`);
                        }

                        if (!isExternal) {

                            // Check if units are likely mm (>100) or m (<1)
                            if (thickness > 220) isExternal = true; // mm
                            else if (thickness > 0.22 && thickness < 2) isExternal = true; // meters
                        }
                    }
                    // Refine Label/Context
                    if (t.label === 'wall') {
                        name = isExternal ? "External Wall" : "Internal Partition";
                    }
                    if (t.label === 'roof') isExternal = true;
                    if (t.label === 'slab') isExternal = true; // Simplified assumption for base slabs

                    // Determine center point for spatial queries
                    let center = null;
                    if (bbox) {
                        center = { x: (bbox[0] + bbox[2]) / 2, y: (bbox[1] + bbox[3]) / 2 };
                    } else if (geometry && geometry.x) {
                        center = geometry;
                    }

                    elements.push({
                        type: t.label,
                        name,
                        id,
                        geometry,
                        bbox,
                        isGlobal: isExternal, // Start with explicit external flag
                        center,
                        roomName: "Unassigned" // Default
                    });
                }
            }
            log(`Extracted ${elements.length} raw elements.`);

            // 1. Explicit IFCRoom extraction
            const rooms: any[] = [];

            // 2. Geometric Room Detection (Fallback/Enhancement)
            if (rooms.length === 0) {
                log("Processing Geometric Detection...");

                // Extract "Line Segments" from Wall Polygons
                // The detector expects { start, end }, but we have Polygons i.e. [{x,y}, {x,y}...]
                const wallPolygons = elements
                    .filter(e => (e.type === 'wall' || e.type.includes('wall')) && e.geometry && Array.isArray(e.geometry))
                    .map(e => e.geometry as { x: number, y: number }[]);

                if (wallPolygons.length > 0) {
                    // SWAPPED TO GRID DETECTOR
                    // Auto-detect units for Grid
                    let maxCoord = 0;
                    wallPolygons.forEach(p => p.forEach(v => {
                        maxCoord = Math.max(maxCoord, Math.abs(v.x), Math.abs(v.y));
                    }));

                    const isMeters = maxCoord < 2000;
                    // GridRoomDetector logic: size = arg / 1000.
                    // If Meters (0.05 targets): arg=50 -> 0.05
                    // If MM (50 targets): arg=50000 -> 50
                    const gridSizeArg = isMeters ? 50 : 50000;
                    log(`Detected MaxCoord: ${maxCoord.toFixed(0)}. Units: ${isMeters ? 'm' : 'mm'}. Using GridSizeArg: ${gridSizeArg}`);

                    const detector = new GridRoomDetector(gridSizeArg);
                    const detected = detector.detectRooms(wallPolygons);
                    log(`Detected ${detected.length} rooms via Grid processing.`);

                    detected.forEach((r, i) => {
                        let calculatedArea = parseFloat(String(r.area));
                        // Unit normalization
                        if (calculatedArea > 1000) calculatedArea = calculatedArea / 1000000;

                        // Filter Noise
                        if (calculatedArea < 0.5) return;

                        rooms.push({
                            name: `Room ${rooms.length + 1}`, // Temporary name
                            id: `geom_room_${i}`,
                            bbox: r.bbox,
                            area: calculatedArea.toFixed(2),
                            perimeter: r.perimeter,
                            geometry: r.polygon,
                            properties: { composition: "Calculated Room" }
                        });
                    });
                }
            }

            // 3. ANNOTATION / TEXT Extraction for Naming
            const annotations = this.getTextAnnotations(modelID);
            if (rooms.length > 0 && annotations.length > 0) {
                let matches = 0;
                rooms.forEach(room => {
                    if (room.geometry) {
                        // Find text insde the room polygon
                        const match = annotations.find(a => isPointInPolygon({ x: a.x, y: a.y }, room.geometry));
                        if (match) {
                            room.name = match.text; // "Bathroom", "Lounge"
                            matches++;
                        }
                    }
                });
                log(`Assigned text names to ${matches} rooms.`);
            }

            // 4. SPATIAL ASSIGNMENT: Elements -> Rooms
            log("Running Spatial Assignment (Architect Rules)...");
            for (const el of elements) {
                // Skip Global items
                // Auto-Classify Global Items into "Work Packages"
                if (el.isGlobal) {
                    if (el.type === 'roof') el.roomName = "Roof Structure";
                    else if (el.type === 'slab') {
                        // Check Z height to distinguish foundations vs floor slabs
                        // Assume < 0 is footing/oversite, > 0 is upper floor?
                        // For now, simplify based on USER request terms
                        el.roomName = "Oversite and Slabbing";
                    }
                    else if (el.type === 'wall' || el.type === 'wallStandardCase') {
                        el.roomName = "Masonry Shell";
                    }
                    else if (el.type === 'covering' || el.type === 'finish') {
                        el.roomName = "External Render";
                    }
                    else if (el.type === 'beam' || el.type === 'column' || el.type === 'member') {
                        // Check Z height. If low -> Foundation/Footings?
                        // Heuristic: If Z < -0.1
                        const z = el.center?.z || 0; // Center might be 2D, check geometry props if avail
                        const bboxMinZ = (idToBBox.get(el.id) || [0, 0, 0, 0, 0, 0])[1]; // Wait, idToBBox is 4D/6D? [minX,minY,maxX,maxY] in this code. 
                        // We didn't store Z in idToBBox. 
                        // Fallback to "Structure"
                        el.roomName = "Masonry Shell";
                    }
                    else {
                        el.roomName = "Global Site Works";
                    }
                    continue;
                }

                if (el.center && rooms.length > 0) {
                    let assigned = false;
                    for (const room of rooms) {
                        if (isPointInPolygon(el.center, room.geometry)) {
                            el.roomName = room.name;
                            assigned = true;
                            break;
                        }
                    }
                    if (!assigned && !el.isGlobal) {
                        // Check if it's "close enough" (e.g. door in a wall)
                        // Or default to 'Global' if truly outside
                        el.roomName = "Global"; // Default fallback
                    }
                } else {
                    el.roomName = "Global";
                }
            }

            // 5. GENERATE ARCHITECT REPORT (Console Output)
            log("--- ARCHITECT REPORT ---");
            const reportPoints: string[] = [];

            // Loop rooms
            for (const room of rooms) {
                let roomReport = `Room: ${room.name} (${room.area}m2)\nObjects:`;
                const roomItems = elements.filter(e => e.roomName === room.name);
                if (roomItems.length === 0) {
                    roomReport += "\n- Empty Shell";
                } else {
                    const counts: Record<string, number> = {};
                    roomItems.forEach(i => {
                        const k = i.name || i.type;
                        counts[k] = (counts[k] || 0) + 1;
                    });
                    for (const [k, v] of Object.entries(counts)) {
                        roomReport += `\n- ${k} (${v})`;
                    }
                }
                reportPoints.push(roomReport);
                log(`\n${roomReport}`);
            }

            // Global Items
            const globalItems = elements.filter(e => e.roomName === 'Global');
            let globalReport = `Global Elements (${globalItems.length}):`;
            const gCounts: Record<string, number> = {};
            globalItems.forEach(i => {
                const k = i.name || i.type;
                gCounts[k] = (gCounts[k] || 0) + 1;
            });
            for (const [k, v] of Object.entries(gCounts)) {
                globalReport += `\n- ${k} (${v})`;
            }
            log(`\n${globalReport}`);
            log("------------------------");

            this.ifcApi.CloseModel(modelID);
            return { success: true, rooms, elements };
        } catch (err: any) {
            console.error("IfcAgent Error:", err);
            log(`CRITICAL FAILURE: ${err.message}`);
            return { success: false, rooms: [], elements: [], error: err.message };
        }
    }

    private getPlacement(modelID: number, elementID: number): { x: number, y: number, rotation: number } {
        // Collect transformation chain (Bottom-Up: Child -> Parent -> Grandparent)
        const placementChain: any[] = [];
        try {
            const el = this.ifcApi.GetLine(modelID, elementID);
            if (el.ObjectPlacement) {
                let placementID = el.ObjectPlacement.value;
                while (placementID) {
                    const place = this.ifcApi.GetLine(modelID, placementID);

                    // Extract local transform data for this level
                    let dx = 0, dy = 0, theta = 0;

                    if (place.RelativePlacement) {
                        const rel = this.ifcApi.GetLine(modelID, place.RelativePlacement.value);

                        // 1. Get Location (Translation)
                        if (rel.Location) {
                            const loc = this.ifcApi.GetLine(modelID, rel.Location.value);
                            if (loc.Coordinates) {
                                const c = loc.Coordinates;
                                dx = typeof c[0] === 'number' ? c[0] : (c[0]?.value || 0);
                                dy = typeof c[1] === 'number' ? c[1] : (c[1]?.value || 0);
                            }
                        }

                        // 2. Get Rotation (RefDirection)
                        if (rel.RefDirection) {
                            const ref = this.ifcApi.GetLine(modelID, rel.RefDirection.value);
                            if (ref.DirectionRatios) {
                                const dr = ref.DirectionRatios;
                                const rx = typeof dr[0] === 'number' ? dr[0] : (dr[0]?.value || 0);
                                const ry = typeof dr[1] === 'number' ? dr[1] : (dr[1]?.value || 0);
                                theta = Math.atan2(ry, rx);
                            }
                        }
                    }

                    placementChain.push({ dx, dy, theta });

                    // Move up to parent
                    if (place.PlacementRelTo) {
                        placementID = place.PlacementRelTo.value;
                    } else {
                        placementID = null;
                    }
                }
            }
        } catch (e) { }

        // Process Top-Down (Grandparent -> Parent -> Child)
        // Start at global origin
        let x = 0, y = 0, rotation = 0;

        // Iterate in reverse (Top-Down)
        for (let i = placementChain.length - 1; i >= 0; i--) {
            const p = placementChain[i];

            // Apply translation rotated by current global rotation
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);

            x += p.dx * cos - p.dy * sin;
            y += p.dx * sin + p.dy * cos;

            // Accumulate rotation
            rotation += p.theta;
        }

        return { x, y, rotation };
    }

    // Updated helper to apply transform
    private applyTransform(points: Point3D[], place: { x: number, y: number, rotation: number }): Point3D[] {
        const cos = Math.cos(place.rotation);
        const sin = Math.sin(place.rotation);
        return points.map(p => ({
            x: p.x * cos - p.y * sin + place.x,
            y: p.x * sin + p.y * cos + place.y,
            z: p.z
        }));
    }

    private getTextAnnotations(modelID: number): { text: string, x: number, y: number }[] {
        const results: { text: string, x: number, y: number }[] = [];
        try {
            const scanType = (typeID: number) => {
                const lines = this.ifcApi.GetLineIDsWithType(modelID, typeID);
                for (let i = 0; i < lines.size(); i++) {
                    const id = lines.get(i);
                    try {
                        const obj = this.ifcApi.GetLine(modelID, id);
                        let val = "";
                        if (obj.Literal) val = obj.Literal.value || obj.Literal;
                        if (!val && obj.Name) val = obj.Name.value;

                        if (val) {
                            val = String(val);
                            let x = 0, y = 0;
                            let foundPos = false;

                            if (obj.Placement) {
                                try {
                                    const place = this.ifcApi.GetLine(modelID, obj.Placement.value);
                                    if (place.Location) {
                                        const loc = this.ifcApi.GetLine(modelID, place.Location.value);
                                        if (loc.Coordinates) {
                                            x = loc.Coordinates[0]?.value || loc.Coordinates[0] || 0;
                                            y = loc.Coordinates[1]?.value || loc.Coordinates[1] || 0;
                                            foundPos = true;
                                        }
                                    }
                                } catch (e) { }
                            }
                            // Simplified text placement handling for brevity
                            if (!foundPos && obj.ObjectPlacement) {
                                const p = this.getPlacement(modelID, id);
                                if (p.x !== 0 || p.y !== 0) { x = p.x; y = p.y; foundPos = true; }
                            }

                            if (foundPos) results.push({ text: val, x, y });
                        }
                    } catch (e) { }
                }
            };
            scanType(WebIFC.IFCTEXTLITERAL);
            scanType(WebIFC.IFCTEXTLITERALWITHEXTENT);
            scanType(WebIFC.IFCANNOTATION);
        } catch (e) { }
        return results;
    }

    private getLocalPoints(modelID: number, elementID: number): Point3D[] {
        const points: Point3D[] = [];
        const visited = new Set<number>();

        const visit = (id: number) => {
            if (visited.has(id)) return;
            visited.add(id);
            try {
                const line = this.ifcApi.GetLine(modelID, id);

                // Found a Point?
                if (line.type === WebIFC.IFCCARTESIANPOINT && line.Coordinates) {
                    const c = line.Coordinates;
                    const x = typeof c[0] === 'number' ? c[0] : (c[0]?.value || 0);
                    const y = typeof c[1] === 'number' ? c[1] : (c[1]?.value || 0);
                    const z = c[2] ? (typeof c[2] === 'number' ? c[2] : (c[2].value || 0)) : 0;
                    points.push({ x, y, z });
                    return;
                }

                // Crawl Children
                // Defines paths for: Polyline, SurfaceModel, FaceSet, Face, PolyLoop, MappedItem
                const structFields = [
                    'Representation', 'Representations', 'Items',
                    'Outline', 'OuterCurve', 'Points', 'Polygon', 'Bounds', 'Bound',
                    'FbsmFaces', 'CfsFaces', 'Faces', // For FaceBasedSurfaceModel
                    'MappingSource', 'MappedRepresentation' // For MappedItem
                ];

                // Special handling for MappedItem which has a transform
                if (line.MappingSource && line.MappingTarget) {
                    // We should ideally apply the transform here, but for now just getting points is better than nothing.
                    // The transform is in MappingTarget.
                }

                for (const f of structFields) {
                    const val = line[f];
                    if (val) {
                        // Check if array of refs
                        if (Array.isArray(val)) {
                            val.forEach(v => {
                                if (v.value) visit(v.value); // Ref object { type: 5, value: 123 }
                            });
                        }
                        // Check if single ref
                        else if (val.value) {
                            visit(val.value);
                        }
                    }
                }
            } catch (e) { }
        };

        // Start crawling from the element's direct representation(s)
        const el = this.ifcApi.GetLine(modelID, elementID);
        // Only crawl if it has representation
        if (el.Representation && el.Representation.value) visit(el.Representation.value);

        return points;
    }

    // Helper to get 2D footprint from 3D points (filter lowest Z + sort CCW)
    private getFootprint(points: Point3D[]): Point[] {
        if (points.length < 3) return points.map(p => ({ x: p.x, y: p.y }));

        // 1. Filter for Lowest Z (Floor plan cut)
        const minZ = Math.min(...points.map(p => p.z));
        // Tolerance of 100mm for "roughly same floor level"
        const floorPoints = points.filter(p => Math.abs(p.z - minZ) < 100);

        // 2. Remove duplicates
        const unique: Point[] = [];
        const seen = new Set<string>();
        floorPoints.forEach(p => {
            const k = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            if (!seen.has(k)) {
                seen.add(k);
                unique.push({ x: p.x, y: p.y });
            }
        });

        if (unique.length < 3) return unique;

        // 3. Sort Counter-Clockwise around Centroid
        const center = unique.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        center.x /= unique.length;
        center.y /= unique.length;

        return unique.sort((a, b) => {
            return Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x);
        });
    }

    // Update getPolylineGeometry to use applyTransform
    private getPolylineGeometry(modelID: number, elementID: number): { bbox: number[], geometry: any } | null {
        try {
            const el = this.ifcApi.GetLine(modelID, elementID);
            if (!el.Representation || !el.Representation.value) return null;

            const rep = this.ifcApi.GetLine(modelID, el.Representation.value);
            const representations = rep.Representations ? (Array.isArray(rep.Representations) ? rep.Representations : [rep.Representations]) : [rep];

            for (const rRef of representations) {
                if (!rRef.value) continue;
                const r = this.ifcApi.GetLine(modelID, rRef.value);
                if (r.Items) {
                    const items = Array.isArray(r.Items) ? r.Items : [r.Items];
                    for (const iRef of items) {
                        const item = this.ifcApi.GetLine(modelID, iRef.value);

                        // IFCPOLYLINE Check
                        if (item.Points) {
                            const pointsRefs = Array.isArray(item.Points) ? item.Points : [item.Points];
                            const points: Point3D[] = [];
                            for (const pRef of pointsRefs) {
                                const p = this.ifcApi.GetLine(modelID, pRef.value);
                                if (p.Coordinates) {
                                    points.push({
                                        x: typeof p.Coordinates[0] === 'number' ? p.Coordinates[0] : (p.Coordinates[0]?.value || 0),
                                        y: typeof p.Coordinates[1] === 'number' ? p.Coordinates[1] : (p.Coordinates[1]?.value || 0),
                                        z: 0
                                    });
                                }
                            }

                            if (points.length >= 2) {
                                // Apply Local Placement WITH ROTATION
                                const place = this.getPlacement(modelID, elementID);
                                const finalPoints = this.applyTransform(points, place);

                                const minX = Math.min(...finalPoints.map(p => p.x));
                                const minY = Math.min(...finalPoints.map(p => p.y));
                                const maxX = Math.max(...finalPoints.map(p => p.x));
                                const maxY = Math.max(...finalPoints.map(p => p.y));

                                return {
                                    bbox: [minX, minY, maxX, maxY],
                                    geometry: finalPoints.map(p => ({ x: p.x, y: p.y }))
                                };
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Polyline Extraction Error:", e);
        }
        return null;
    }

    private getWallSegments(points: { x: number, y: number }[]): { start: { x: number, y: number }, end: { x: number, y: number } }[] {
        if (!points || points.length < 3) return [];
        const segments: { start: { x: number, y: number }, end: { x: number, y: number } }[] = [];
        for (let i = 0; i < points.length; i++) {
            segments.push({
                start: points[i],
                end: points[(i + 1) % points.length]
            });
        }
        return segments;
    }
}
