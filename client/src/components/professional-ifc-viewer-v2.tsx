
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from 'openbim-components';
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    fileUrl: string;
    id?: string; // Stable ID to prevent re-loading on URL signature refresh
    rooms?: any[]; // AGENTS.md: Rooms from Database
    onElementClick?: (element: any) => void;
    onRoomRename?: (id: string, newName: string) => void;
    onGeometryParsed?: (lines: any[]) => void; // NEW PROP
    cachedLines?: any[]; // PERSISTENCE PROP
}

const ProfessionalIFCViewer = React.memo(({ fileUrl, id, rooms = [], onElementClick, onRoomRename, onGeometryParsed, cachedLines }: Props) => {

    const [show2D, setShow2D] = useState(true);
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const addLog = (msg: string) => setDebugLog(prev => [...prev.slice(-4), msg]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [components, setComponents] = useState<OBC.Components | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState("Initializing Engine...");
    const [inventory, setInventory] = useState<string>("Scanning...");

    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipData, setTooltipData] = useState({ visible: false, name: "", type: "", dims: "", qty: "" });
    const [showRoof, setShowRoof] = useState(true);
    const [tenderReport, setTenderReport] = useState<string | null>(null);
    const [isLabelMode, setIsLabelMode] = useState(false); // Added state for label mode
    const [labelMenu, setLabelMenu] = useState<{ x: number, y: number, item: any } | null>(null); // Added state for label menu

    // NEW: Extracted Plans from IFC Geometry
    const [extractedLines, setExtractedLines] = useState<any[]>([]);

    // Label Mode Ref for Event Listeners
    const isLabelModeRef = useRef(false);

    // Interactive Objects Ref (Shared between IFC elements & DB Rooms)
    const interactables = useRef<THREE.Mesh[]>([]);

    // Flag to prevent re-extraction of the same model
    const processedModelRef = useRef<string | null>(null);

    // ... (Keep existing Init/Effect)

    // NEW: Render Database Rooms Overlay
    useEffect(() => {
        if (!components || !rooms.length) return;

        const scene = components.scene.get();
        const roomMeshes: THREE.Mesh[] = [];

        // Material for DB Rooms (Transparent Amber)
        const roomMat = new THREE.MeshBasicMaterial({
            color: 0xF59E0B, // Amber-500
            transparent: true,
            opacity: 0.4, // Increased visibility
            side: THREE.DoubleSide,
            depthTest: false // Always visible on top
        });

        const borderMat = new THREE.LineBasicMaterial({
            color: 0xF59E0B,
            depthTest: false
        });

        rooms.forEach((room) => {
            if (!room.geometry) return;

            // Compute Shape
            let points: any[] = [];
            try {
                points = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
            } catch (e) { return; }

            if (!Array.isArray(points) || points.length < 3) return;

            const shape = new THREE.Shape();
            // Assuming points are [x, z] or [x, y]? 
            // DB Geometry from GeometricRoomDetector is usually [x, y] (2D).
            // In 3D World, Y is Up. So we map 2D y -> 3D z.

            // Check coordinate scale. GeometricRoomDetector uses Millimeters usually? Or scaled?
            // Detector outputs "Normalized"? No, ifc-agent outputs world coords.
            // Let's assume World Coords.

            shape.moveTo(points[0].x || points[0][0], points[0].y || points[0][1]);
            for (let i = 1; i < points.length; i++) {
                shape.lineTo(points[i].x || points[i][0], points[i].y || points[i][1]);
            }
            shape.closePath();

            const geom = new THREE.ShapeGeometry(shape);
            // Rotate to lie on XZ plane (Floor)
            geom.rotateX(Math.PI / 2);
            // Check if we need to flip Y? 
            // In Three.js, Y is Up. 2D [x,y] -> 3D [x,0,y] usually works if we rotate X -90?
            // `geom.rotateX(Math.PI / 2)` rotates +Y to +Z ?
            // Let's try. Initial simple Geometry is XY plane.
            // shape (x, y) -> mesh (x, y, 0).
            // Rotate X -90deg (-PI/2) -> (x, 0, y).
            // Wait, standard rotation direction...

            // Correction: Rotate X -90 deg
            geom.rotateX(-Math.PI / 2);

            // Lift slightly to avoid z-fighting with floor
            geom.translate(0, 0.05, 0);

            const mesh = new THREE.Mesh(geom, roomMat);
            mesh.userData.api = {
                id: room.id, // DB UUID!
                name: room.name,
                type: 'Database Room',
                isSpace: true, // Treat as space for logic
                isDbRoom: true // Flag
            };

            // Add Border
            const edges = new THREE.EdgesGeometry(geom);
            const line = new THREE.LineSegments(edges, borderMat);
            mesh.add(line);

            scene.add(mesh);
            roomMeshes.push(mesh);

            // REGISTER INTERACTIVITY
            interactables.current.push(mesh);
        });

        console.log(`🏠 Rendered ${roomMeshes.length} Database Rooms in 3D`);

        return () => {
            roomMeshes.forEach(m => {
                scene.remove(m);
                if (m.geometry) m.geometry.dispose();

                // UNREGISTER INTERACTIVITY
                const idx = interactables.current.indexOf(m);
                if (idx > -1) interactables.current.splice(idx, 1);
            });
        };
    }, [components, rooms]);


    // Update Label Menu to Handle DB Rooms
    // ...

    // (Returning to existing View Code)
    // ...


    // 🔴 3D Engine Initialization Fix
    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup old
        if (components) {
            components.dispose();
            setComponents(null);
        }

        let isActive = true;

        const init = async () => {
            if (!isActive) return;
            console.log("🏁 Init Start: " + fileUrl);

            // Clear Interactables on Init
            interactables.current = [];

            let step = "Starting";
            try {
                if (!isActive) return;
                // 1. Init
                step = "1. Init Engine";
                setLoadingStatus("Starting 3D Engine...");
                const comps = new OBC.Components();
                comps.scene = new OBC.SimpleScene(comps);

                if (!containerRef.current) throw new Error("No Container");

                const renderer = new OBC.SimpleRenderer(comps, containerRef.current);
                comps.renderer = renderer;

                // Handle Resize Explicitly
                const resizeObserver = new ResizeObserver(() => {
                    if (containerRef.current) {
                        const { width, height } = containerRef.current.getBoundingClientRect();
                        // Ignore invalid/collapsed dimensions
                        if (width > 0 && height > 0) {
                            renderer.get().setSize(width, height);
                            comps.camera.updateAspect();
                        }
                    }
                });
                resizeObserver.observe(containerRef.current);

                const rect = containerRef.current.getBoundingClientRect();
                const internalRenderer = renderer.get();
                internalRenderer.setSize(rect.width, rect.height);
                internalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                comps.camera = new OBC.OrthoPerspectiveCamera(comps);
                comps.raycaster = new OBC.SimpleRaycaster(comps);

                await comps.init();

                // Set Grid/Background
                const scene = comps.scene.get();
                scene.background = new THREE.Color(0xf0f2f5); // Light Gray background
                const grid = new OBC.SimpleGrid(comps, new THREE.Color(0x666666));

                // Lighting
                const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
                scene.add(hemiLight);
                const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
                dirLight.position.set(50, 100, 50);
                scene.add(dirLight);

                // EXPOSE
                (window as any).COMPONENTS = comps;
                (window as any).RENDERER = internalRenderer;
                (window as any).SCENE = scene;

                // 2. Loader
                step = "2. Config Loader";
                const fragments = new OBC.FragmentManager(comps);
                const ifcLoader = new OBC.FragmentIfcLoader(comps);

                // ... (Keep existing Loader Settings) ...
                ifcLoader.settings.wasm = {
                    path: "https://unpkg.com/web-ifc@0.0.53/",
                    absolute: true
                }
                ifcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
                // ifcLoader.settings.webIfc.OPTIMIZE_PROFILES = true; // CAUSES CRASH ON RENDER

                // Load
                step = "3. Downloading Model";
                setLoadingStatus("Downloading File...");
                setLoading(true);
                const fileResponse = await fetch(fileUrl);
                const data = await fileResponse.arrayBuffer();
                const buffer = new Uint8Array(data);

                step = "3b. Parsing IFC";
                setLoadingStatus("Parsing Geometry...");
                const model = await ifcLoader.load(buffer);

                // CAMERA FIT (Use High-Level Culler logic if available, or manual box)
                // Manual Box Fit
                if (model) {
                    // const highlighter = new OBC.FragmentHighlighter(comps);
                    // highlighter.update();

                    // Compute Bounding Box of all fragments
                    const bbox = new THREE.Box3();
                    for (const frag of model.items) {
                        if (!frag.mesh.geometry.boundingBox) frag.mesh.geometry.computeBoundingBox();
                        const box = frag.mesh.geometry.boundingBox!.clone();
                        box.applyMatrix4(frag.mesh.matrixWorld);
                        bbox.union(box);
                    }

                    if (!bbox.isEmpty()) {
                        comps.camera.controls.fitToBox(bbox, true);
                        console.log("📸 Fits camera to model");
                    }
                }

                // 4. Classification & Inventory
                step = "4. Classifying";
                setLoadingStatus("Analyzing Model...");

                const classifier = new OBC.FragmentClassifier(comps);
                try {
                    await classifier.byEntity(model);
                } catch (e) { console.warn(e); }

                // LOGIC: Find Standard Elements
                const doors = classifier.find({ entities: ["IFCDOOR"] });
                const windows = classifier.find({ entities: ["IFCWINDOW"] });
                const slabs = classifier.find({ entities: ["IFCSLAB"] });
                const walls = classifier.find({ entities: ["IFCWALL", "IFCWALLSTANDARDCASE"] });
                const roofs = classifier.find({ entities: ["IFCROOF"] });

                // LOGIC: Find MEP & Furnishings
                const furniture = classifier.find({ entities: ["IFCFURNISHINGELEMENT"] });
                // Sanitary: WC, Showers, Sinks usually fall under IfcFlowTerminal
                const sanitary = classifier.find({ entities: ["IFCFLOWTERMINAL"] });
                // Electrical: Lights, Sockets, Switches + General MEP
                const electrical = classifier.find({ entities: ["IFCLIGHTFIXTURE", "IFCOUTLET", "IFCFLOWCONTROLLER", "IFCELECTRICDISTRIBUTIONPOINT", "IFCDISTRIBUTIONELEMENT", "IFCFLOWSEGMENT", "IFCFLOWFITTING"] });
                // Proxies: Generic 3D Symbols or Assemblies
                // Added IFCFOOTING and IFCCIVILELEMENT for foundations
                const proxies = classifier.find({ entities: ["IFCBUILDINGELEMENTPROXY", "IFCVIRTUALELEMENT", "IFCELEMENTASSEMBLY", "IFCFOOTING", "IFCCIVILELEMENT", "IFCPILE"] });

                // ACCURATE COUNTING (Fixing Double Count)
                const countUniqueItems = (map: any) => {
                    if (!map) return 0;
                    const uniqueIDs = new Set<string>();
                    for (const fragID in map) {
                        const ids = map[fragID];
                        ids.forEach((id: string) => uniqueIDs.add(id));
                    }
                    return uniqueIDs.size;
                };

                // Counts
                let doorCount = countUniqueItems(doors);
                let winCount = countUniqueItems(windows);
                let wallCount = countUniqueItems(walls);
                let roofCount = countUniqueItems(roofs);
                let slabCount = countUniqueItems(slabs);

                let furnCount = countUniqueItems(furniture);
                let sanCount = countUniqueItems(sanitary);
                let elecCount = countUniqueItems(electrical);
                let miscCount = countUniqueItems(proxies);

                setInventory(
                    `Doors: ${doorCount} | Windows: ${winCount} \n` +
                    `Walls: ${wallCount} | Roofs: ${roofCount} | Floors: ${slabCount} \n` +
                    `Furn: ${furnCount} | Sanitary: ${sanCount} | Elec: ${elecCount} \n` +
                    `Misc: ${miscCount} `
                );

                // Helper to check precise item existence
                const isItemInMap = (map: any, fragID: string, expressID: string) => {
                    if (!map) return false;
                    const ids = map[fragID];
                    if (!ids) return false;
                    if (ids.has) return ids.has(expressID);
                    if (Array.isArray(ids)) return ids.includes(expressID);
                    return false;
                };

                // MATERIALS - FORCE VISIBILITY (X-RAY MODE FOR MEP)
                const styles = {
                    wall: new THREE.MeshBasicMaterial({ color: 0x999999, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 1 }),
                    door: new THREE.MeshBasicMaterial({ color: 0xA0522D, side: THREE.DoubleSide, depthTest: false }),
                    window: new THREE.MeshBasicMaterial({ color: 0x00BFFF, side: THREE.DoubleSide, depthTest: false }),
                    slab: new THREE.MeshBasicMaterial({ color: 0xCCCCCC, side: THREE.DoubleSide }),
                    roof: new THREE.MeshBasicMaterial({ color: 0x2F4F4F, side: THREE.DoubleSide }),

                    furniture: new THREE.MeshBasicMaterial({ color: 0x8B4513, side: THREE.DoubleSide }), // SaddleBrown
                    sanitary: new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide }), // White

                    // X-RAY STYLES (Always Visible) - RED for Electrical to stand out against highlighting
                    electrical: new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide, depthTest: false }), // Red
                    misc: new THREE.MeshBasicMaterial({ color: 0x800080, side: THREE.DoubleSide, depthTest: false }), // Purple

                    lines: new THREE.LineBasicMaterial({ color: 0x000000, depthTest: false }),
                };

                // Highlight Material - CYAN to avoid conflict with Electrical
                const highlightMat = new THREE.MeshBasicMaterial({
                    color: 0x00FFFF, // Cyan
                    depthTest: false,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.5
                });

                if (model.items) {
                    for (const fragment of model.items) {
                        const mesh = fragment.mesh;
                        if (mesh) {
                            try {
                                mesh.position.set(0, 0, 0);
                                mesh.updateMatrixWorld(true);
                                scene.add(mesh);

                                // Default to WALL style
                                let mat = styles.wall;

                                const fid = fragment.id;

                                // 1. Check Keywords (Name-Based Override)
                                // We need to peek at properties inside this loop slightly inefficiently but necessary for styling
                                // However, styling happens before we iterate properties.
                                // To solve this: simpler Map check first, then update 'pType' in the next loop.
                                // Actually, we can check Maps here.

                                if (doors && doors[fid]) mat = styles.door;
                                else if (windows && windows[fid]) mat = styles.window;
                                else if (slabs && slabs[fid]) mat = styles.slab;
                                else if (roofs && roofs[fid]) mat = styles.roof;
                                else if (furniture && furniture[fid]) mat = styles.furniture;
                                else if (sanitary && sanitary[fid]) mat = styles.sanitary;
                                else if (electrical && electrical[fid]) mat = styles.electrical;
                                else if (proxies && proxies[fid]) mat = styles.misc;

                                // Special Render Order
                                if (mat === styles.door || mat === styles.window || mat === styles.electrical || mat === styles.misc) {
                                    mesh.renderOrder = 10; // High Priority
                                }

                                mesh.material = mat;

                                if (mat === styles.wall || mat === styles.slab) {
                                    if (!(mesh instanceof THREE.InstancedMesh)) {
                                        mesh.children = mesh.children.filter(c => !(c instanceof THREE.LineSegments));
                                        const edges = new THREE.EdgesGeometry(mesh.geometry, 80);
                                        const line = new THREE.LineSegments(edges, styles.lines);
                                        line.renderOrder = 1;
                                        mesh.add(line);
                                    }
                                }
                            } catch (e) { }
                        }
                    }
                }

                // VIRTUAL FLOOR GENERATOR
                // If no slabs detected, generate a floor plane so the model doesn't float in void
                if (slabCount === 0 && wallCount > 0) {
                    // Calculate global bounding box of walls
                    const bbox = new THREE.Box3();
                    const wallIds = new Set(Object.values(walls || {}).flat()); // Approximate

                    if (model.items) {
                        for (const frag of model.items) {
                            if (frag.mesh) {
                                if (!frag.mesh.geometry.boundingBox) frag.mesh.geometry.computeBoundingBox();
                                const box = frag.mesh.geometry.boundingBox!.clone();
                                box.applyMatrix4(frag.mesh.matrixWorld);
                                bbox.union(box);
                            }
                        }
                    }

                    if (!bbox.isEmpty()) {
                        const width = bbox.max.x - bbox.min.x;
                        const depth = bbox.max.z - bbox.min.z;
                        const centerX = (bbox.max.x + bbox.min.x) / 2;
                        const centerZ = (bbox.max.z + bbox.min.z) / 2;

                        // Expand floor slightly
                        const pad = 1.0;
                        const geom = new THREE.PlaneGeometry(width + pad * 2, depth + pad * 2);
                        const mat = new THREE.MeshBasicMaterial({ color: 0xE0E0E0, side: THREE.DoubleSide });
                        const floorMesh = new THREE.Mesh(geom, mat);

                        // Position at bottom (Y-up)
                        floorMesh.rotation.x = -Math.PI / 2;
                        floorMesh.position.set(centerX, bbox.min.y - 0.05, centerZ); // Slightly below

                        scene.add(floorMesh);
                        console.log("🟦 Virtual Floor Generated");
                    }
                }

                // ============================================
                // 4b. GENERATE 2D PLAN LINES (SECTION CUT AT 1.2m)
                // ============================================

                const generatedLines: any[] = [];
                const tempMatrix = new THREE.Matrix4();
                let unitScale = 1; // DEFINE HERE (Top Scope)

                // DECISION: Use Query Cache OR Extract Fresh
                const shouldExtract = !cachedLines || cachedLines.length === 0;

                if (shouldExtract) {
                    console.log("🔪 Starting Fresh 2D Extraction...");
                } else {
                    console.log("🧠 Skipping 2D Extraction (Using Cache)");
                }

                // Helper: Geometry Slicer
                const sliceMesh = (mesh: THREE.Mesh, planeY: number, type: string, fid: string) => {
                    const geometry = mesh.geometry;
                    if (!geometry) return;

                    const index = geometry.index;
                    const pos = geometry.attributes.position;
                    // Pre-allocate check vars
                    const v1 = new THREE.Vector3();
                    const v2 = new THREE.Vector3();
                    const v3 = new THREE.Vector3();

                    // World Matrix for this instance
                    const matrix = mesh.matrixWorld;

                    const checkTri = (a: number, b: number, c: number) => {
                        v1.fromBufferAttribute(pos, a).applyMatrix4(matrix);
                        v2.fromBufferAttribute(pos, b).applyMatrix4(matrix);
                        v3.fromBufferAttribute(pos, c).applyMatrix4(matrix);

                        // Check Plane Intersection (Y plane)
                        const d1 = v1.y - planeY;
                        const d2 = v2.y - planeY;
                        const d3 = v3.y - planeY;

                        // Identify edge crossings: Signs differ
                        // Naive approach: count positives
                        const posCount = (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0) + (d3 > 0 ? 1 : 0);
                        if (posCount === 0 || posCount === 3) return; // No intersection

                        // Find the two intersection points
                        const points: THREE.Vector3[] = [];

                        // Edge 1-2
                        if ((d1 > 0) !== (d2 > 0)) {
                            const t = d1 / (d1 - d2); // Linear interp
                            points.push(new THREE.Vector3().lerpVectors(v1, v2, t));
                        }
                        // Edge 2-3
                        if ((d2 > 0) !== (d3 > 0)) {
                            const t = d2 / (d2 - d3);
                            points.push(new THREE.Vector3().lerpVectors(v2, v3, t));
                        }
                        // Edge 3-1
                        if ((d3 > 0) !== (d1 > 0)) {
                            const t = d3 / (d3 - d1);
                            points.push(new THREE.Vector3().lerpVectors(v3, v1, t));
                        }

                        if (points.length >= 2) {
                            generatedLines.push({
                                id: fid,
                                type: type, // 'wall', 'window', 'door'
                                subtype: 'segment',
                                p1: { x: points[0].x, y: points[0].z }, // Top-down (XZ)
                                p2: { x: points[1].x, y: points[1].z }
                            });
                        }
                    };

                    if (index) {
                        for (let i = 0; i < index.count; i += 3) {
                            checkTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
                        }
                    } else {
                        for (let i = 0; i < pos.count; i += 3) {
                            checkTri(i, i + 1, i + 2);
                        }
                    }
                };

                // ONLY RUN EXTRACTION LOOP IF NEEDED
                if (shouldExtract) {
                    // Determine Cut Height (Base + 1.2m)
                    let lowestY = Infinity;
                    if (model.items) {
                        for (const frag of model.items) {
                            if (frag.mesh && frag.mesh.geometry.boundingBox) {
                                const box = frag.mesh.geometry.boundingBox.clone();
                                box.applyMatrix4(frag.mesh.matrixWorld);
                                if (box.min.y < lowestY) lowestY = box.min.y;
                            }
                        }
                    }
                    if (lowestY === Infinity) lowestY = 0;

                    // DETECT UNITS (Heuristic)
                    // If the bounding box is HUGE (e.g. > 100 on Y or overall), it's likely Millimeters.
                    // Standard House is ~3-10m high. In MM that's 3000-10000.
                    // (unitScale is already defined in top scope)

                    // Check if likely MM
                    // We can't rely just on lowestY position (could be far from origin).
                    // Let's check the size of the first frag?
                    if (Math.abs(lowestY) > 500) {
                        // Suspiciously large offset? Or just far from origin.
                        // Better check: iterate all boxes and find Max Dimension.
                    }

                    // Better Heuristic: Check typical wall height? 
                    // Let's default to Meters unless we see huge numbers.
                    // If lowestY is > 1000, probably MM? Not necessarily.
                    // Let's assume user screenshot (coordinates ~6000) implies MM.
                    // Let's force check average coord size?

                    // Let's use a simpler check: If cutY calculation at 1.2 yields 'nothing', we might need 1200.
                    // But we need to know BEFORE slicing.

                    // Let's assume if the model bounds width/height > 500, it is MM.
                    let maxDim = 0;
                    if (model.items) {
                        for (const frag of model.items) {
                            if (frag.mesh && frag.mesh.geometry.boundingBox) {
                                const b = frag.mesh.geometry.boundingBox;
                                maxDim = Math.max(maxDim, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
                            }
                        }
                    }

                    // If max dimension of a single fragment (like a wall) is > 100, it's definitely MM.
                    if (maxDim > 50) {
                        unitScale = 1000;
                        console.log("📏 Detected Millimeters (Fragment Dim > 50). Scale Factor: 1000");
                    } else {
                        console.log("📏 Detected Meters. Scale Factor: 1");
                    }

                    // Cut Plane
                    const cutOffset = 1.2 * unitScale;
                    const cutY = lowestY + cutOffset;
                    console.log(`🔪 Slicing Model at Y=${cutY.toFixed(2)} (Base: ${lowestY.toFixed(2)} + Offset: ${cutOffset})`);

                    if (model.items) {
                        for (const frag of model.items) {
                            const mesh = frag.mesh;
                            const fid = frag.id;

                            // TYPE CHECK
                            let type = null;
                            if (walls && walls[fid]) type = 'wall';
                            else if (doors && doors[fid]) type = 'door';
                            else if (windows && windows[fid]) type = 'window';
                            else if (proxies && proxies[fid]) type = 'structure';

                            // SLICE
                            if (type) {
                                if (mesh instanceof THREE.InstancedMesh) {
                                    const count = mesh.count;
                                    for (let i = 0; i < count; i++) {
                                        mesh.getMatrixAt(i, tempMatrix);
                                        tempMatrix.premultiply(mesh.matrixWorld); // Combined

                                        // Re-impl Slicer for Instance
                                        const geometry = mesh.geometry;
                                        const index = geometry.index;
                                        const pos = geometry.attributes.position;
                                        const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
                                        const checkTriInst = (a: number, b: number, c: number) => {
                                            v1.fromBufferAttribute(pos, a).applyMatrix4(tempMatrix);
                                            v2.fromBufferAttribute(pos, b).applyMatrix4(tempMatrix);
                                            v3.fromBufferAttribute(pos, c).applyMatrix4(tempMatrix);

                                            const d1 = v1.y - cutY;
                                            const d2 = v2.y - cutY;
                                            const d3 = v3.y - cutY;

                                            const posCount = (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0) + (d3 > 0 ? 1 : 0);
                                            if (posCount === 0 || posCount === 3) return;

                                            const points = [];
                                            if ((d1 > 0) !== (d2 > 0)) points.push(new THREE.Vector3().lerpVectors(v1, v2, d1 / (d1 - d2)));
                                            if ((d2 > 0) !== (d3 > 0)) points.push(new THREE.Vector3().lerpVectors(v2, v3, d2 / (d2 - d3)));
                                            if ((d3 > 0) !== (d1 > 0)) points.push(new THREE.Vector3().lerpVectors(v3, v1, d3 / (d3 - d1)));

                                            if (points.length >= 2) {
                                                generatedLines.push({
                                                    id: `${fid}-${i}`, type: type!, subtype: 'segment',
                                                    p1: { x: points[0].x, y: points[0].z },
                                                    p2: { x: points[1].x, y: points[1].z },
                                                    unitScale: unitScale // Pass scale to renderer
                                                });
                                            }
                                        };

                                        if (index) {
                                            for (let j = 0; j < index.count; j += 3) checkTriInst(index.getX(j), index.getX(j + 1), index.getX(j + 2));
                                        } else {
                                            for (let j = 0; j < pos.count; j += 3) checkTriInst(j, j + 1, j + 2);
                                        }
                                    }
                                } else {
                                    sliceMesh(mesh, cutY, type, fid);
                                }
                            }
                        }
                    }
                }

                if (shouldExtract && generatedLines.length === 0) {
                    console.warn("⚠️ Slicer returned 0 lines. Falling back to Bounding Box method.");
                    // FALLBACK: Bounding Box Logic
                    if (model.items) {
                        for (const frag of model.items) {
                            const mesh = frag.mesh;
                            const fid = frag.id;

                            let type = null;
                            if (walls && walls[fid]) type = 'wall';
                            else if (doors && doors[fid]) type = 'door';
                            else if (windows && windows[fid]) type = 'window';
                            else if (proxies && proxies[fid]) type = 'structure';

                            if (type) {
                                if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                                const baseBox = mesh.geometry.boundingBox!;

                                if (mesh instanceof THREE.InstancedMesh) {
                                    const count = mesh.count;
                                    for (let i = 0; i < count; i++) {
                                        mesh.getMatrixAt(i, tempMatrix);
                                        const box = baseBox.clone();
                                        box.applyMatrix4(tempMatrix);
                                        box.applyMatrix4(mesh.matrixWorld);

                                        generatedLines.push({
                                            id: `${fid}-${i}`, type: type, subtype: 'bbox',
                                            x: box.min.x, y: box.min.z,
                                            w: box.max.x - box.min.x, h: box.max.z - box.min.z,
                                            unitScale: unitScale
                                        });
                                    }
                                } else {
                                    const box = baseBox.clone();
                                    box.applyMatrix4(mesh.matrixWorld);
                                    generatedLines.push({
                                        id: fid, type: type, subtype: 'bbox',
                                        x: box.min.x, y: box.min.z,
                                        w: box.max.x - box.min.x, h: box.max.z - box.min.z,
                                        unitScale: unitScale
                                    });
                                }
                            }
                        }
                    }
                }

                if (isActive && shouldExtract) {
                    console.log(`✅ Extracted ${generatedLines.length} Plan Lines. UnitScale: ${unitScale}`);
                    setExtractedLines(generatedLines);
                    if (onGeometryParsed) onGeometryParsed(generatedLines);
                }

                // ============================================
                // 5. PRE-COMPUTE DATA (Optimization)
                // ============================================
                step = "5. Pre-Computing";
                setLoadingStatus("Linking Data...");

                const raycastMeshes: THREE.Mesh[] = [];

                if (model.items) {
                    for (const frag of model.items) {
                        const mesh = frag.mesh;
                        const fid = frag.id;

                        // 1. Get ID
                        // Assumption: 1 fragment = 1 item (Standard for this loader config)
                        const expressID = frag.getItemID(0);

                        // 2. Get Props & KEYWORD OVERRIDE
                        let pName = "Unnamed";
                        let pType = "Element";

                        if (model.properties && model.properties[expressID]) {
                            const p = model.properties[expressID];
                            if (p.Name && p.Name.value) pName = p.Name.value;
                            if (p.type) pType = String(p.type);
                        }

                        const nLower = pName.toLowerCase();

                        // KEYWORD OVERRIDE: Force Electrical Classification based on Name
                        if (nLower.includes("socket") || nLower.includes("switch") || nLower.includes("power") || nLower.includes("gang") || nLower.includes("outlet") || nLower.includes("sensor")) {
                            pType = "IFC Electrical (Keyword)";
                            pName = pName || "Electrical Component";
                            // Force Style Update
                            mesh.material = styles.electrical;
                            mesh.renderOrder = 10;
                        }
                        else if (nLower.includes("light") || nLower.includes("lamp")) {
                            pType = "IFC Lighting (Keyword)";
                            mesh.material = styles.electrical;
                            mesh.renderOrder = 10;
                        }
                        // Force Floor Detection
                        else if (nLower.includes("floor") || nLower.includes("slab")) {
                            pType = "IFC Slab (Keyword)";
                            pName = pName || "Floor Slab";
                            mesh.material = styles.slab;
                            // Ensure render order is normal for floors
                            mesh.renderOrder = 0;
                        }

                        // 3. Fallback Classification
                        if (pName === "Unnamed" || pType === "Element") {
                            if (isItemInMap(doors, fid, expressID)) { pType = "IFC Door"; pName = "Door"; }
                            else if (isItemInMap(windows, fid, expressID)) { pType = "IFC Window"; pName = "Window"; }
                            else if (isItemInMap(walls, fid, expressID)) { pType = "IFC Wall"; pName = "Wall"; }
                            else if (isItemInMap(slabs, fid, expressID)) { pType = "IFC Slab"; pName = "Slab"; }
                            else if (isItemInMap(roofs, fid, expressID)) { pType = "IFC Roof"; pName = "Roof"; }
                            else if (isItemInMap(furniture, fid, expressID)) { pType = "IFC Furniture"; pName = "Furniture"; }
                            else if (isItemInMap(sanitary, fid, expressID)) { pType = "IFC Sanitary Terminal"; pName = "Sanitary"; }
                            else if (isItemInMap(electrical, fid, expressID)) { pType = "IFC Electrical"; pName = "Electrical"; }
                            else if (isItemInMap(proxies, fid, expressID)) { pType = "IFC Proxy/Misc"; pName = "Misc Object"; }
                        }

                        // 4. Store in UserData
                        mesh.userData.api = {
                            id: expressID,
                            name: pName,
                            type: pType,
                            isSpace: pType.toUpperCase().includes("SPACE"),
                            element: mesh // Ref to itself for labeling
                        };

                        // 5. Filter Raycast List
                        // Dont raycast invisible spaces
                        if (!mesh.userData.api.isSpace) {
                            raycastMeshes.push(mesh);
                            // ADD TO SHARED INTRACTABLES
                            interactables.current.push(mesh);
                        }
                    }
                }

                // ============================================
                // 6. QUANTITY SURVEYOR: Hover & Measure
                // ============================================

                let currentSelection: THREE.Mesh | null = null;
                const originalMaterials = new Map<string, THREE.Material>();
                // Removed local highlightMat definition to use global Cyan one

                containerRef.current.addEventListener('mousemove', (event) => {
                    const rect = containerRef.current!.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                    setTooltipPos({ x: event.clientX, y: event.clientY });

                    const raycaster = comps.raycaster.get();
                    raycaster.setFromCamera(new THREE.Vector2(x, y), comps.camera.get());

                    // USE OPTIMIZED MESH LIST (Shared Ref)
                    // In Label Mode, ONLY target Database Rooms to avoid clicking Walls
                    let targetList = interactables.current;
                    if (isLabelModeRef.current) {
                        targetList = interactables.current.filter(m => m.userData.api.isDbRoom);
                    }

                    const intersects = raycaster.intersectObjects(targetList, false);

                    if (intersects.length > 0) {
                        const result = intersects[0];
                        const mesh = result.object as THREE.Mesh;

                        // HIGHLIGHT LOGIC
                        if (currentSelection !== mesh) {
                            if (currentSelection) {
                                currentSelection.material = originalMaterials.get(currentSelection.uuid) || styles.wall;
                                currentSelection.renderOrder = 0;
                            }

                            currentSelection = mesh;
                            if (!originalMaterials.has(mesh.uuid)) {
                                originalMaterials.set(mesh.uuid, mesh.material as THREE.Material);
                            }
                            mesh.material = highlightMat;
                            mesh.renderOrder = 3;

                            // DATA LOGIC - READ PRE-COMPUTED
                            const data = mesh.userData.api || { name: 'Unknown', type: 'Geometry' };

                            // Metrics (Real-time World Dimensions)
                            let dimString = "Analyzing...";
                            let areaString = "--";

                            if (mesh.geometry) {
                                // 1. Get Base Box
                                if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                                const box = mesh.geometry.boundingBox!.clone();

                                // 2. Apply Instance Matrix if needed
                                // This converts Local Geometry Box -> World Space Box (fixing rotation/scale)
                                if (mesh instanceof THREE.InstancedMesh && result.instanceId !== undefined) {
                                    const instMat = new THREE.Matrix4();
                                    mesh.getMatrixAt(result.instanceId, instMat);
                                    box.applyMatrix4(instMat);
                                } else {
                                    // Regular Mesh - apply world matrix
                                    box.applyMatrix4(mesh.matrixWorld);
                                }

                                // 3. Measure World Axis-Aligned Size
                                const size = new THREE.Vector3();
                                box.getSize(size);

                                // Standard: Y is Height in World Space
                                const height = size.y;
                                const widthX = size.x;
                                const widthZ = size.z;

                                // Logic: Vertical vs Horizontal Elements
                                const isHorizontal = data.type.includes("Roof") || data.type.includes("Slab") || data.type.includes("Floor");

                                if (isHorizontal) {
                                    // For Roofs/Floors: Use X and Z (Footprint)
                                    const len = Math.max(widthX, widthZ);
                                    const wid = Math.min(widthX, widthZ);
                                    dimString = `${len.toFixed(2)} m(L) x ${wid.toFixed(2)} m(W)`;
                                    areaString = (len * wid).toFixed(2);
                                } else {
                                    // For Walls/Doors/Verticals: Use Y (Height) and Max(X,Z) (Length)
                                    const len = Math.max(widthX, widthZ);
                                    dimString = `${height.toFixed(2)} m(H) x ${len.toFixed(2)} m(W)`;
                                    areaString = (height * len).toFixed(2);
                                }
                            }

                            // FORCE UPDATE TOOLTIP
                            setTooltipData({
                                visible: true,
                                name: `${data.name} #${data.id} `,
                                type: data.type,
                                dims: dimString,
                                qty: `${areaString} m²`
                            });
                        }
                    } else {
                        // NO INTERSECTION
                        if (currentSelection) {
                            currentSelection.material = originalMaterials.get(currentSelection.uuid) || styles.wall;
                            currentSelection.renderOrder = 0;
                            currentSelection = null;
                        }
                        // Hide tooltip
                        setTooltipData(prev => ({ ...prev, visible: false }));
                    }
                });

                // 6. INTERACTIVE: Click (Optimized with Fallback)
                containerRef.current.addEventListener('click', (event) => {
                    // --- LABEL MODE INTERCEPT ---
                    if (isLabelModeRef.current) {
                        if (currentSelection && currentSelection.userData.api.isDbRoom) { // Extra check
                            console.log("🖱️ Label Click on:", currentSelection.userData.api);
                            setLabelMenu({
                                x: event.clientX,
                                y: event.clientY,
                                item: currentSelection.userData.api
                            });
                        }
                        return; // Stop standard click
                    }

                    // --- STANDARD CLICK ---
                    if (onElementClick && currentSelection) {
                        const found = comps.raycaster.castRay(model.items);
                        if (found && found[0]) {
                            const result = found[0];
                            const mesh = result.object as THREE.Mesh;
                            const frag = comps.fragments.list[mesh.uuid];
                            if (frag) {
                                const instID = result.instanceId ?? 0;
                                const expressID = frag.getItemID(instID);

                                let p = model.properties ? model.properties[expressID] : null;

                                // Fallback Name
                                let finalName = p?.Name?.value || "Unnamed";
                                let finalType = p?.type ? String(p.type) : "Element";

                                if (finalName === "Unnamed") {
                                    if (isItemInMap(doors, frag.id, expressID)) finalName = "Detected Door";
                                    else if (isItemInMap(windows, frag.id, expressID)) finalName = "Detected Window";
                                    else if (isItemInMap(walls, frag.id, expressID)) finalName = "Detected Wall";
                                }

                                onElementClick({
                                    id: expressID,
                                    globalId: p?.GlobalId?.value || "N/A",
                                    type: finalType,
                                    name: finalName,
                                    raw: p
                                });
                            }
                        }
                    }
                });

                setComponents(comps);
                setLoading(false);
                addLog("✅ Init Complete");

            } catch (err: any) {
                console.error(err);
                setError(`Failed at ${step}: ${err.message} `);
                addLog(`❌ Error: ${err.message}`);
                setLoading(false);
            }
        };

        init();

        return () => {
            console.log("🛑 Cleanup/Dispose Run");
            addLog("🛑 Cleanup Triggered");
            isActive = false;
            // if (components) components.dispose(); // Commented out to see if premature disposal is the cause? 
            // NO, we must dispose to prevent memory leaks, but maybe delay it?
            if (components) components.dispose();
        };
    }, [id]); // Strictly ID dependent

    // Sync Ref
    useEffect(() => {
        isLabelModeRef.current = isLabelMode;
    }, [isLabelMode]);



    // Toggle Roof Handlers
    const toggleRoof = () => {
        if (!components) return;

        const nextState = !showRoof;
        setShowRoof(nextState);

        console.log(`Toggling Roofs to: ${nextState} `);

        // Traverse the OBC Scene (Safest)
        const scene = components.scene.get();
        // Fallback to traverse everything in scene if needed
        scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.userData.api) {
                const type = obj.userData.api.type || "";
                if (type.includes("Roof")) {
                    obj.visible = nextState;
                }
            }
        });
    };

    // --- TENDER GENERATION LOGIC ---
    const generateTenderReport = async () => {
        if (!components) return;
        setLoadingStatus("Scanning Rooms...");

        const scene = components.scene.get();
        const roomMap: Record<string, { walls: number, floor: number, elec: number, misc: number, items: string[] }> = {};

        // 1. Find Rooms (Spaces)
        // We need to find meshes that are "Spaces"
        const roomBoxes: { name: string, box: THREE.Box3, element: THREE.Object3D }[] = [];

        scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.userData.api) {
                if (obj.userData.api.isSpace) {
                    // Calculate World Box for this space
                    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
                    const box = obj.geometry.boundingBox!.clone();
                    box.applyMatrix4(obj.matrixWorld);

                    // Helper: Expand box slightly to catch wall-mounted items
                    box.expandByScalar(0.2);

                    roomBoxes.push({
                        name: obj.userData.api.name || "Unnamed Room",
                        box: box,
                        element: obj
                    });
                }
            }
        });

        // FALLBACK: If no explicit IfcSpace found, try to use Floor Slabs as Room Proxies
        if (roomBoxes.length === 0) {
            // Debug Collection
            const debugTypes: string[] = [];

            scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh && obj.userData.api) {
                    const type = (obj.userData.api.type || "UNKNOWN").toUpperCase();
                    const name = (obj.userData.api.name || "Unnamed").toUpperCase();

                    // Calc World Box & Size
                    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
                    const box = obj.geometry.boundingBox!.clone();
                    box.applyMatrix4(obj.matrixWorld);

                    const size = new THREE.Vector3();
                    box.getSize(size);

                    // Debug string with Scale info (Critical for verifying Units)
                    const debugStr = `${type.toLowerCase()} [${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}]`;
                    if (debugTypes.length < 15 && !debugTypes.includes(debugStr)) debugTypes.push(debugStr);

                    // 1. Explicit Floor Type
                    const isExplicitFloor = type === 'IFCSLAB' || type.includes("FLOOR") || name.includes("FLOOR");

                    // 2. Geometric Floor Check (Unit Agnostic via Aspect Ratio)
                    // If Width & Depth are significantly larger than Height, it's a flat plate (Floor/Slab)
                    // Ratio: Minimum Dimension (X or Z) / Height (Y)
                    const minWidth = Math.min(size.x, size.z);
                    const aspectRatio = size.y > 0 ? minWidth / size.y : 0;

                    // Logic A: Meters (Flat < 1m, Wide > 1.5m)
                    const isFlatMeters = size.y < 1.0 && minWidth > 1.5;

                    // Logic B: Millimeters (Flat < 1000mm, Wide > 1500mm)
                    const isFlatMM = size.y > 10 && size.y < 1000 && minWidth > 1500;

                    // Logic C: Aspect Ratio (Plate-like shape) - Width is at least 4x Thickness
                    const isPlateShape = aspectRatio > 4.0 && minWidth > (size.y * 2);

                    const isGeometricFloor = (isFlatMeters || isFlatMM || isPlateShape);

                    // Exclude Walls/Roofs
                    const isNotRoof = !type.includes("ROOF");
                    const isNotWall = !type.includes("WALL");
                    const isCandidateType = isExplicitFloor || type.includes("PROXY") || type.includes("MISC") || type.includes("PLATE");

                    if ((isExplicitFloor) || (isCandidateType && isGeometricFloor && isNotRoof && isNotWall)) {
                        const roomBox = box.clone();
                        // Extrude upwards (Relative to scale)
                        // If units are mm (height > 100), extrude 3000. If meters, extrude 3.0
                        const extrudeHeight = size.y > 100 ? 3000.0 : 3.0; // Simple heuristic

                        roomBox.max.y += extrudeHeight;
                        roomBox.expandByScalar(size.y > 100 ? 100 : 0.1);

                        roomBoxes.push({
                            name: obj.userData.api.name || `Detected Room(${type})`,
                            box: roomBox,
                            element: obj
                        });
                    }
                }
            });

            if (roomBoxes.length === 0) {
                console.warn("Still no rooms found. Types seen:", debugTypes);
            }
        }

        // 2. Scan All Visible Items
        // FALLBACK: If no rooms found, use a single "Whole Building" bucket
        const useGlobalBucket = (roomBoxes.length === 0);
        if (useGlobalBucket) {
            roomMap["Whole Building (No Rooms Detected)"] = { walls: 0, floor: 0, elec: 0, misc: 0, items: [] };
        }

        // 3. Format Report: PRO TENDER BUDGET
        // Rates Database (Placeholder)
        const RATES = {
            'WALL': { rate: 65.0, unit: 'm2' },
            'ROOF': { rate: 120.0, unit: 'm2' },
            'FLOOR': { rate: 85.0, unit: 'm2' },
            'DOOR': { rate: 450.0, unit: 'no' },
            'WINDOW': { rate: 600.0, unit: 'no' },
            'ELECTRICAL': { rate: 55.0, unit: 'pt' },
            'MISC': { rate: 1.0, unit: 'sum' }
        };

        // Budget Aggregation
        const budgetItems: Record<string, { qty: number, count: number }> = {
            'WALL': { qty: 0, count: 0 },
            'ROOF': { qty: 0, count: 0 },
            'FLOOR': { qty: 0, count: 0 },
            'DOOR': { qty: 0, count: 0 },
            'WINDOW': { qty: 0, count: 0 },
            'ELECTRICAL': { qty: 0, count: 0 },
            'MISC': { qty: 0, count: 0 }
        };

        // Scan and Measure
        scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.visible && obj.userData.api) {
                const typeRaw = (obj.userData.api.type || "MISC").toUpperCase();

                // Determine Category
                let cat = 'MISC';
                if (typeRaw.includes("WALL")) cat = 'WALL';
                else if (typeRaw.includes("ROOF")) cat = 'ROOF';
                else if (typeRaw.includes("SLAB") || typeRaw.includes("FLOOR") || typeRaw.includes("FOOTING")) cat = 'FLOOR';
                else if (typeRaw.includes("DOOR")) cat = 'DOOR';
                else if (typeRaw.includes("WINDOW")) cat = 'WINDOW';
                else if (typeRaw.includes("ELECTRICAL") || typeRaw.includes("FIXTURE")) cat = 'ELECTRICAL';

                // Measure Dimensions
                if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
                const box = obj.geometry.boundingBox!.clone();
                box.applyMatrix4(obj.matrixWorld);
                const s = new THREE.Vector3();
                box.getSize(s);

                // Auto-Detect Units (if dim > 50, assume mm, convert to m)
                const isMM = (s.x > 50 || s.y > 50 || s.z > 50);
                const scale = isMM ? 0.001 : 1.0;
                const sx = s.x * scale;
                const sy = s.y * scale;
                const sz = s.z * scale;

                // Calculate Quantity based on Category logic
                let itemQty = 0;
                if (cat === 'WALL') {
                    const dims = [sx, sy, sz].sort((a, b) => b - a);
                    itemQty = (sx > sz ? sx : sz) * sy;
                } else if (cat === 'ROOF' || cat === 'FLOOR') {
                    itemQty = sx * sz;
                } else {
                    itemQty = 1;
                }

                budgetItems[cat].qty += itemQty;
                budgetItems[cat].count++;
            }
        });

        // 3. Format Report (Identification Phase)
        let reportHtml = `< div class="p-2 space-y-4" > `;

        let totalProjectCost = 0;
        reportHtml += `
    < div class="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider" > Tender Budget Estimate</div >
            <table class="w-full text-[10px] border-collapse">
                <thead>
                    <tr class="bg-gray-100 text-left border-b border-gray-300">
                        <th class="p-1">Element</th>
                        <th class="p-1">Qty</th>
                        <th class="p-1">Unit</th>
                        <th class="p-1 text-right">Rate (£)</th>
                        <th class="p-1 text-right">Total (£)</th>
                    </tr>
                </thead>
                <tbody>`;

        // Generate Rows
        for (const [cat, data] of Object.entries(budgetItems)) {
            if (data.count === 0) continue;

            const rateInfo = RATES[cat as keyof typeof RATES] || RATES['MISC'];
            const quantity = (rateInfo.unit === 'no' || rateInfo.unit === 'pt') ? data.count : data.qty;
            const lineTotal = quantity * rateInfo.rate;
            totalProjectCost += lineTotal;

            reportHtml += `
                <tr class="border-b border-gray-100 hover:bg-purple-50">
                    <td class="p-1 font-medium text-gray-700">${cat} <span class="text-[8px] text-gray-400">(${data.count} items)</span></td>
                    <td class="p-1 text-gray-600">${quantity.toFixed(1)}</td>
                    <td class="p-1 text-gray-400 text-[9px]">${rateInfo.unit}</td>
                    <td class="p-1 text-right text-gray-600">${rateInfo.rate.toFixed(2)}</td>
                    <td class="p-1 text-right font-bold text-gray-800">${lineTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        reportHtml += `
                <tr class="bg-gray-50 border-t-2 border-gray-300">
                    <td class="p-1 font-bold text-gray-900" colspan="3">ESTIMATED TOTAL</td>
                    <td class="p-1 text-right font-bold text-gray-900" colspan="2">£${totalProjectCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                </tbody>
            </table>
            
            <div class="mt-4 p-2 bg-blue-50 border border-blue-200 rounded text-[9px] text-blue-800">
                <strong>Budget Tracking:</strong> Estimated based on geometry. Usage: Tender / QTO.
            </div>
        </div > `;

        console.log(roomMap);
        setTenderReport(reportHtml);
    };

    const ROOM_NAMES = [
        "Lounge", "Kitchen", "Dining Room", "Bedroom 1", "Bedroom 2", "Bedroom 3",
        "Bathroom", "Ensuite", "Hallway", "Landing", "Garage", "Utility", "Study", "WC"
    ];

    const handleRoomLabel = (name: string) => {
        if (!labelMenu || !labelMenu.item) return;

        // Update the item's custom name in UserData
        const mesh = labelMenu.item.element as THREE.Mesh;
        if (mesh && mesh.userData.api) {
            mesh.userData.api.name = name; // Override name
            console.log(`🏷️ Labelled Room[${labelMenu.item.id}]as: ${name} `);

            // NEW: Persist to DB via Parent Prop
            if (onRoomRename && mesh.userData.api.id) {
                onRoomRename(mesh.userData.api.id, name);
            }

            // Visual Update (Flash Green)
            const oldMat = mesh.material;
            mesh.material = new THREE.MeshBasicMaterial({ color: 0x00FF00, side: THREE.DoubleSide });
            setTimeout(() => {
                mesh.material = oldMat;
            }, 500);
        }
        setLabelMenu(null);
        setIsLabelMode(false);
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* DEBUG OVERLAY */}
            <div className="absolute top-10 right-0 bg-black/80 text-green-400 text-[10px] p-2 z-[999] pointer-events-none font-mono rounded m-2 max-w-xs">
                <div className="font-bold border-b border-white/20 mb-1">Diagnose ID: {id?.slice(0, 4)}</div>
                {debugLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>

            {/* ERROR UI */}
            {error && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white p-8">
                    <div className="text-red-500 font-bold mb-2">Error Loading 3D Engine</div>
                    <div className="text-sm text-gray-600 mb-4 text-center">{error}</div>
                    <Button onClick={() => window.location.reload()} variant="outline">Reload Page</Button>
                </div>
            )}

            {/* CANVAS (3D Only) */}
            <div
                ref={containerRef}
                className="w-full h-full absolute inset-0 bg-slate-50"
                style={{ touchAction: 'none' }}
            ></div>

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 z-40 bg-white/80 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">{loadingStatus}</p>
                </div>
            )}
        </div>
    );
}); // Close Memo (Default Shallow Compare)

export { ProfessionalIFCViewer };

// --- HELPER: 2D ROOM PLAN RENDERER (Native SVG Coords) ---
export function RoomPlan2DFinal({ rooms, lines = [], onRoomClick }: { rooms: any[], lines?: any[], onRoomClick: (r: any) => void }) {
    if ((!rooms || rooms.length === 0) && (!lines || lines.length === 0)) return <div className="text-xs text-gray-400 p-4">No data detected yet.</div>;

    // 1. Calculate World Bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const updateBounds = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    };

    // 1. ANALYZE SCALES FIRST
    let linesMax = 0;
    lines.forEach(l => {
        // rough max check
        const mx = (l.subtype === 'segment') ? Math.max(Math.abs(l.p1.x), Math.abs(l.p2.x)) : Math.max(Math.abs(l.x + l.w));
        if (mx > linesMax) linesMax = mx;
    });

    // 2. PARSE ROOMS & ANALYZE SCALE
    const safeRooms = rooms?.filter(r => r && r.geometry) || [];
    // 2. PARSE ROOMS & ANALYZE SCALE (SKIPPED FOR CLEANUP)
    // User requested to remove "the properter drawing circle" (Room Polygons).
    // We will kept the parse logic if needed later but NOT include in bounds.

    // 3. DETECT MISMATCH & DETERMINE RENDER SCALE
    // If Lines are Meters (<500), we must SCALE LINES UP to MM default?
    // Actually, if we remove rooms, we don't have a mismatch reference.
    // But we still want to render lines nicely. 
    // If linesMax < 500 (Meters), let's render them as Meters (scale 1).
    // But wait, previous fix forced them to 1000 if mismatch.
    // If we remove rooms, we rely on lines. 
    // If lines are Meters, they will be small (0-10) but mapDim will handle it.
    // UNLESS autoScale forces them to be huge.

    let renderScaleLines = 1;
    // If we have NO rooms, check if lines are small.
    // If linesMax < 500, it's Meters.
    // If linesMax > 500, it's Millimeters.

    // We just render as is. Mappers handle min/max.
    if (linesMax > 0 && linesMax < 500) {
        // It is meters.
        // renderScaleLines = 1; 
    }

    // 4. COMPUTE BOUNDS (With Scale Applied)
    lines.forEach(l => {
        if (l.subtype === 'segment') {
            updateBounds(l.p1.x * renderScaleLines, l.p1.y * renderScaleLines);
            updateBounds(l.p2.x * renderScaleLines, l.p2.y * renderScaleLines);
        } else {
            // Fallback Rect
            updateBounds(l.x * renderScaleLines, l.y * renderScaleLines);
            updateBounds((l.x + l.w) * renderScaleLines, (l.y + l.h) * renderScaleLines);
        }
    });

    // SKIP ROOM BOUNDS
    /*
    parsedRooms.forEach(r => {
        r.pts.forEach((p: any) => updateBounds(p.x, p.y));
    });
    */

    if (minX === Infinity) return <div className="p-4">Empty Geometry</div>;

    // 2. Normalize & Scale
    // Determine strict scaling if units mismatch (e.g. lines in meters, rooms in mm)
    // For now, we assume they are roughly same space or handled by the parser.
    // (The previous "auto-align" logic was risky, let's assume raw coords are correct from previous fixes)

    const geomW = maxX - minX;
    const geomH = maxY - minY;

    // Add 10% padding
    const padding = Math.max(geomW, geomH) * 0.1;

    // Coordinate Mappers
    // SVG X = (worldX - minX) + padding
    // SVG Y = (maxY - worldY) + padding  <-- FLIP Y HERE (Standard CAD to SVG)

    const mapX = (x: number) => (x - minX) + padding;
    const mapY = (y: number) => (maxY - y) + padding;
    const mapDim = (d: number) => d; // Dimensions preserve scale

    // ADJUST MAPPER FOR RENDER SCALE
    const mapX_Scaled = (x: number) => mapX(x * renderScaleLines);
    const mapY_Scaled = (y: number) => mapY(y * renderScaleLines);
    const mapDim_Scaled = (d: number) => mapDim(d * renderScaleLines);

    const svgW = geomW + (padding * 2);
    const svgH = geomH + (padding * 2);
    const vb = `0 0 ${svgW} ${svgH}`;

    // --- INTERACTION LOGIC ---
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation(); e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.1, Math.min(transform.k * (1 + scaleAmount), 20));
        setTransform(prev => ({ ...prev, k: newScale }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    };
    const handleMouseUp = () => setIsDragging(false);

    // Zoom Controls
    const zoomIn = () => setTransform(prev => ({ ...prev, k: Math.min(prev.k * 1.2, 20) }));
    const zoomOut = () => setTransform(prev => ({ ...prev, k: Math.max(prev.k / 1.2, 0.1) }));
    const reset = () => setTransform({ x: 0, y: 0, k: 1 });

    const fontSize = (Math.max(geomW, geomH) * 0.03) / transform.k;
    const strokeWidth = (Math.max(geomW, geomH) * 0.002) / transform.k;

    // AUTO-DETECT VISUAL SCALE IF MISSING
    // If scene is HUGE (> 500 units), we assume MM.
    // If lines/scale aren't provided, stroke will be tiny (0.25).
    // so we default autoScale to 1000 if scene is large.
    const autoScale = (Math.max(geomW, geomH) > 500) ? 1000 : 1;

    return (
        <div className="relative w-full h-full overflow-hidden bg-white select-none">
            {/* CONTROLS */}
            <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 bg-white border rounded shadow p-1">
                <button onClick={zoomIn} className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold text-xs" title="Zoom In">+</button>
                <button onClick={zoomOut} className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold text-xs" title="Zoom Out">-</button>
                <button onClick={reset} className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold text-xs" title="Reset">R</button>
            </div>

            <div className="absolute top-2 left-2 z-30 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                Scroll to Zoom • Drag to Pan
            </div>

            {/* TRANSFORM CONTAINER */}
            <div
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <svg viewBox={vb} className="w-full h-full">

                    {/* 1. ROOMS (Background) - DISABLED BY USER REQUEST */}
                    {/* 
                    parsedRooms.map(room => { ... }) 
                    */}

                    {/*
                     return (
                    <g
                        key={room.id}
                        onClick={(e) => { e.stopPropagation(); onRoomClick(room); }}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        
                        <path d={d} fill="#f1f5f9" fillOpacity="1" stroke="#cbd5e1" strokeWidth={strokeWidth} />

                        <text
                            x={svgCx} y={svgCy}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={fontSize}
                            fontWeight="bold" fill="#0f172a"
                            style={{ fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', pointerEvents: 'none' }}
                        >
                            {room.name}
                        </text>
                        <text
                            x={svgCx} y={svgCy + fontSize * 1.2}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={fontSize * 0.7}
                            fill="#64748b"
                            style={{ fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}
                        >
                            {room.area ? `${parseFloat(room.area).toFixed(1)} m²` : ''}
                        </text>
                    </g>
                    )
                    })}
                    */}

                    {/* 2. STRUCTURE / LINES (Foreground) */}
                    {/* 2. STRUCTURE / LINES (Foreground) */}
                    {lines.map((l, i) => {
                        // NEW: Handle Segments (Vectors)
                        // NEW: Handle Segments (Vectors)
                        if (l.subtype === 'segment') {
                            // PHYSICAL SIZES (in Meters)
                            // AUTO-DETECT SCALE if unitScale missing
                            // Use l.unitScale if present, else trigger Auto logic depending on scene size?
                            // Safest: Use l.unitScale OR fallback to autoScale.
                            const scale = l.unitScale || autoScale;
                            let physicalWidth = 0.05 * scale;
                            let stroke = '#1e293b';

                            // Wall = 0.25m -> 250mm
                            if (l.type === 'wall') { stroke = '#0f172a'; physicalWidth = 0.25 * scale; }
                            // Window = 0.05m -> 50mm
                            else if (l.type === 'window') { stroke = '#38bdf8'; physicalWidth = 0.1 * scale; }
                            else if (l.type === 'door') { stroke = '#d97706'; physicalWidth = 0.05 * scale; }
                            else if (l.type === 'structure') { stroke = '#475569'; physicalWidth = 0.3 * scale; }

                            return (
                                <line
                                    key={`seg-${i}`}
                                    x1={mapX_Scaled(l.p1.x)}
                                    y1={mapY_Scaled(l.p1.y)}
                                    x2={mapX_Scaled(l.p2.x)}
                                    y2={mapY_Scaled(l.p2.y)}
                                    stroke={stroke}
                                    strokeWidth={mapDim(physicalWidth)}
                                    strokeLinecap="square"
                                    opacity={0.9}
                                />
                            )
                        }

                        // FALLBACK: Old Rectangle Logic
                        // Use OUTLINE ONLY for fallback to prevent "Blue Box" hiding everything.
                        let fill = 'none';
                        let opacity = 0;
                        let strokeColor = '#94a3b8'; // Lighter Slate
                        // Use autoScale here too!
                        const scale = l.unitScale || autoScale;

                        if (l.type === 'wall') { strokeColor = '#0f172a'; }
                        else if (l.type === 'window') { strokeColor = '#0ea5e9'; }
                        else if (l.type === 'door') { strokeColor = '#d97706'; }

                        return (
                            <rect
                                key={`rect-${i}`}
                                x={mapX_Scaled(l.x)}
                                y={mapY_Scaled(l.y + l.h)}
                                width={mapDim_Scaled(l.w)}
                                height={mapDim_Scaled(l.h)}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={mapDim(0.02 * scale)} // Thinner line
                                strokeDasharray={`${0.1 * scale},${0.1 * scale}`} // Dashed
                            />
                        )
                    })}

                </svg>
            </div>
        </div>
    );
}
