
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from 'openbim-components';
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    fileUrl: string;
    id?: string;
    rooms?: any[];
    onElementClick?: (element: any) => void;
    onRoomRename?: (id: string, newName: string) => void;
    onGeometryParsed?: (lines: any[]) => void;
    cachedLines?: any[];
    viewMode?: '3d' | '2d';
    sliceOffset?: number; // Offset in meters from model bottom
}

export const ProfessionalIFCViewer = React.memo(({ fileUrl, id, rooms = [], onElementClick, onRoomRename, onGeometryParsed, cachedLines, viewMode = '3d', sliceOffset = 1.2 }: Props) => {

    // ... (state)

    // ... (logic)

    // ============================================
    // 4b. GENERATE 2D PLAN LINES (SECTION CUT)
    // ============================================

    const generatedLines: any[] = [];
    const tempMatrix = new THREE.Matrix4();
    let unitScale = 1;

    // Check dependencies for re-extraction
    const shouldExtract = !cachedLines || cachedLines.length === 0;


    const [show2D, setShow2D] = useState(true);
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const addLog = (msg: string) => setDebugLog(prev => [...prev.slice(-4), msg]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [components, setComponents] = useState<OBC.Components | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState("Initializing Engine...");
    const [debugParams, setDebugParams] = useState<string>("");
    const [inventory, setInventory] = useState<string>("Scanning...");

    // LISTEN FOR FIT EVENT
    useEffect(() => {
        const handleFit = async () => {
            if (components && modelBoundsRef.current && !modelBoundsRef.current.isEmpty()) {
                console.log("🖱️ Triggered Fit-to-Screen");
                const bbox = modelBoundsRef.current!;
                const controls = components.camera.controls;

                // Get Center/Size
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);

                if (viewModeRef.current === '2d') {
                    console.log("📐 Forcing Top-Down View (2D)");
                    // TOP DOWN: High Y, Looking at Center
                    // Ensure Up Vector matches Plan View (North Up = -Z)
                    controls.camera.up.set(0, 0, -1);

                    // Position: Center X, High Y, Center Z
                    await controls.setPosition(center.x, center.y + (maxDim * 1.5), center.z, true);
                    await controls.setTarget(center.x, center.y, center.z, true);

                    // Zoom Extents logic for Ortho
                    await controls.fitToBox(bbox, true);
                } else {
                    console.log("🧊 Fitting 3D View");
                    controls.camera.up.set(0, 1, 0); // Restore Standard Up
                    await controls.fitToBox(bbox, true);
                }
            } else {
                addLog("⚠️ Cannot Fit: No Bounds");
            }
        };
        window.addEventListener('viewer-fit-camera', handleFit);
        return () => window.removeEventListener('viewer-fit-camera', handleFit);
    }, [components]);

    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipData, setTooltipData] = useState({ visible: false, name: "", type: "", dims: "", qty: "" });
    const [showRoof, setShowRoof] = useState(true);
    const [tenderReport, setTenderReport] = useState<string | null>(null);
    const [isLabelMode, setIsLabelMode] = useState(false); // Added state for label mode
    // DEBUG INTERVAL
    const [cameraStats, setCameraStats] = useState("Cam: Waiting...");
    useEffect(() => {
        const i = setInterval(() => {
            if ((window as any).COMPONENTS) {
                const c = (window as any).COMPONENTS.camera.get();

                // FORCE HUGE FAR PLANE (Hack to prevent reset)
                if (c && c.far < 10000) {
                    c.far = 1000000; // 1km (mm)
                    c.updateProjectionMatrix();
                    console.log("✈️ Enforced Camera Far Plane to 1,000,000");
                }

                // LIGHTWEIGHT CHECK
                const p = c.position;
                setCameraStats(`Cam: ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} | Z:${c.zoom?.toFixed(3)} | Far:${c.far}`);
            }
        }, 500);
        return () => clearInterval(i);
    }, []);

    // NEW: Extracted Plans from IFC Geometry
    const [extractedLines, setExtractedLines] = useState<any[]>([]);
    const [isModelReady, setIsModelReady] = useState(true);

    // Label Mode Ref for Event Listeners
    const isLabelModeRef = useRef(false);
    const viewModeRef = useRef(viewMode); // Track View Mode

    // Sync Ref
    useEffect(() => {
        viewModeRef.current = viewMode;
    }, [viewMode]);

    // NEW: Sync Label Mode Ref
    useEffect(() => {
        isLabelModeRef.current = isLabelMode;
    }, [isLabelMode]);

    // DEBUG INTERVAL
    useEffect(() => {
        const i = setInterval(() => {
            if ((window as any).COMPONENTS) {
                const c = (window as any).COMPONENTS.camera.get();
                if (c) {
                    setDebugLog(prev => {
                        const n = [...prev];
                        if (n.length > 5) n.shift();
                        // Only add unique position log to reduce spam? No, spam is fine for signal.
                        // actually just update a ref or separate state? 
                        // Let's just log position occasionally or on change?
                        return n;
                    });
                }
            }
        }, 1000);
        return () => clearInterval(i);
    }, []);

    // Interactive Objects Ref (Shared between IFC elements & DB Rooms)
    const interactables = useRef<THREE.Mesh[]>([]);

    // Flag to prevent re-extraction of the same model
    const processedModelRef = useRef<string | null>(null);
    const modelBoundsRef = useRef<THREE.Box3 | null>(null); // NEW: Cache Bounds

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
            if (!room.geometry && !room.polygon) return;

            // Compute Shape
            let points: any[] = [];
            try {
                if (room.polygon) {
                    points = typeof room.polygon === 'string' ? JSON.parse(room.polygon) : room.polygon;
                } else {
                    points = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
                }
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
            // DEBUG PATCH: Define missing helper to prevent crash
            const isItemInMap = (map: any, a: any, b: any) => false;

            // Clear Interactables on Init
            interactables.current = [];

            let step = "Starting";
            try {
                if (!isActive) return;
                // 1. Init
                step = "1. Init Engine";

                // PERFORMANCE: Yield to Main Thread Helper
                const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
                let lastYieldTime = performance.now();
                const checkYield = async () => {
                    if (performance.now() - lastYieldTime > 16) { // 16ms (60fps) budget
                        await yieldToMain();
                        lastYieldTime = performance.now();
                    }
                };

                setLoadingStatus("Starting 3D Engine...");
                const comps = new OBC.Components();
                comps.scene = new OBC.SimpleScene(comps);

                if (!containerRef.current) throw new Error("No Container");

                const renderer = new OBC.SimpleRenderer(comps, containerRef.current);
                comps.renderer = renderer;
                const internalRenderer = renderer.get();

                // DISABLE SHADOWS FOR PERFORMANCE
                internalRenderer.shadowMap.enabled = false;

                // DISABLE POST-PRODUCTION ENTIRELY
                if ((comps.renderer as any).postproduction) {
                    (comps.renderer as any).postproduction.enabled = false;
                }
                addLog("🚫 Shadow & Post-Proc Disabled");

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
                internalRenderer.setSize(rect.width, rect.height);
                internalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                comps.camera = new OBC.OrthoPerspectiveCamera(comps);
                // FORCE HUGE FAR PLANE FOR MM MODELS
                const camObj = comps.camera.get();
                camObj.far = 500000;
                camObj.near = 0.5;
                camObj.updateProjectionMatrix();

                comps.raycaster = new OBC.SimpleRaycaster(comps);

                await comps.init();

                // FORCE HUGE FAR PLANE (After Init)
                const camObjPostInit = comps.camera.get();
                camObjPostInit.far = 100000;
                camObjPostInit.updateProjectionMatrix();

                // Set Grid/Background
                const scene = comps.scene.get();
                scene.background = new THREE.Color(0xFFFFFF); // White for 2D Plan

                // HUGE GRID for MM support - Disable for clean 2D view
                // const grid = new OBC.SimpleGrid(comps, new THREE.Color(0x666666));

                // Lighting (Brighter for 2D)
                const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 1.5);
                scene.add(hemiLight);
                const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
                dirLight.position.set(0, 100, 0); // Top Down light
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
                    path: "/",
                    absolute: true
                }

                // v5.0 Mod: Explicit Worker Setup like SimpleIFCViewer
                console.log("🚀 Starting FragmentLoader (Worker Enabled)");

                ifcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
                ifcLoader.settings.webIfc.USE_FAST_BOOLS = false;
                ifcLoader.settings.webIfc.USE_WORKER = false; // Disable worker for stability (missing worker file)

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

                console.log("📦 Model Loaded. Items:", model ? model.items.length : 0);
                addLog(`📦 Loaded ${model ? model.items.length : 0} Items`);

                // CAMERA FIT (Use High-Level Culler logic if available, or manual box)
                // Manual Box Fit
                if (model) {
                    // Compute Bounding Box of all fragments
                    const bbox = new THREE.Box3();
                    for (const frag of model.items) {
                        if (!frag.mesh.geometry.boundingBox) frag.mesh.geometry.computeBoundingBox();
                        const box = frag.mesh.geometry.boundingBox!.clone();
                        box.applyMatrix4(frag.mesh.matrixWorld);

                        // SANITY CHECK: Ignore infinite/NaN boxes
                        if (
                            !isFinite(box.min.x) || !isFinite(box.min.y) || !isFinite(box.min.z) ||
                            !isFinite(box.max.x) || !isFinite(box.max.y) || !isFinite(box.max.z)
                        ) {
                            console.warn("⚠️ Skipping Invalid BBox for Fragment", frag.id);
                            continue;
                        }

                        bbox.union(box);
                    }

                    console.log("📦 Calculated BBox:", JSON.stringify(bbox));

                    if (!bbox.isEmpty() && isFinite(bbox.min.x)) {
                        modelBoundsRef.current = bbox.clone(); // CACHE FOR 2D FLIP

                        try {
                            // FULL 2D SETUP
                            const s = new THREE.Vector3();
                            bbox.getSize(s);
                            const center = new THREE.Vector3();
                            bbox.getCenter(center);
                            const maxDim = Math.max(s.x, s.z);

                            // Valid Check
                            if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z) || !isFinite(maxDim)) {
                                throw new Error("Computed Center/Dim is NaN");
                            }

                            // 1. Force Ortho
                            if (comps.camera && comps.camera.projection) {
                                await comps.camera.projection.set('Ortho');
                            }

                            // 2. Position Top Down (Aggressive)
                            const controls = comps.camera.controls;
                            if (controls) {
                                // Reset first - Instant
                                await controls.setLookAt(center.x, center.y + 100, center.z, center.x, center.y, center.z, false);

                                await controls.fitToBox(bbox, false); // Instant

                                // 3. Force Zoom/Fit again after a delay to ensure ortho update
                                setTimeout(async () => {
                                    if (comps.camera.projection.current !== 'Ortho') await comps.camera.projection.set('Ortho');
                                    await controls.fitToBox(bbox, true);
                                }, 500); // Increased delay
                            }

                            console.log("📸 Forced 2D Top-Down View");
                        } catch (err) {
                            console.warn("⚠️ Camera Setup Error (Non-Critical):", err);
                            // Fallback to origin if failed
                            if (comps.camera.controls) {
                                await comps.camera.controls.setLookAt(0, 100, 0, 0, 0, 0, false);
                            }
                        }
                    } else {
                        console.warn("⚠️ BBox is Empty or Invalid after calculation");
                        if (comps.camera.controls) {
                            await comps.camera.controls.setLookAt(0, 100, 0, 0, 0, 0, false);
                        }
                    }
                }

                // 4. Classification & Inventory
                step = "5. Rendering 2D Plan"; // CHANGED NUMBER TO FORCE REFRESH PROOF
                setLoadingStatus("Rendering High-Contrast 2D Plan...");

                // DEFAULT EMPTY MAPS to prevent crash in Styling
                let doors: any = {}, windows: any = {}, slabs: any = {}, walls: any = {}, roofs: any = {};
                let furniture: any = {}, sanitary: any = {}, electrical: any = {}, proxies: any = {};

                // DISABLE CLASSIFIER ENTIRELY FOR NOW
                console.log("⚠️ Classification skipped for stability.");

                // MATERIALS - 2D PLAN STYLE (High Contrast Black/White/Grey)
                const styles = {
                    wall: new THREE.MeshBasicMaterial({ color: 0x404040, side: THREE.DoubleSide }), // Dark Grey Walls
                    door: new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, wireframe: false }), // Solid Black
                    window: new THREE.MeshBasicMaterial({ color: 0x0000FF, side: THREE.DoubleSide, depthTest: false }), // Blue
                    slab: new THREE.MeshBasicMaterial({ color: 0xEEEEEE, side: THREE.DoubleSide }), // Very light grey floor
                    roof: new THREE.MeshBasicMaterial({ color: 0xDDDDDD, side: THREE.DoubleSide, visible: false }), // Hide roofs in 2D by default

                    furniture: new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide }),
                    sanitary: new THREE.MeshBasicMaterial({ color: 0xAAAAAA, side: THREE.DoubleSide }),
                    electrical: new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide, depthTest: false }),
                    misc: new THREE.MeshBasicMaterial({ color: 0x800080, side: THREE.DoubleSide }),

                    lines: new THREE.LineBasicMaterial({ color: 0x000000, depthTest: false, linewidth: 2 }), // Black outlines
                };

                // MANUAL ROOF HIDING & MATERIAL APPLICATION
                if (model.items) {
                    for (const fragment of model.items) {
                        const mesh = fragment.mesh;
                        if (mesh) {
                            try {
                                mesh.position.set(0, 0, 0);
                                mesh.updateMatrixWorld(true);
                                scene.add(mesh);

                                // Get Properties
                                const expressID = fragment.getItemID(0);
                                let isRoof = false;
                                let isSlab = false;
                                let isWall = false;
                                let isWindow = false;
                                let isDoor = false;
                                let isSpace = false;

                                if (model.properties && model.properties[expressID]) {
                                    const props = model.properties[expressID];
                                    const typeName = (props.type && String(props.type)) || "";
                                    const name = (props.Name && props.Name.value) ? props.Name.value.toUpperCase() : "";

                                    // DEBUG: Capture one of each type
                                    if (debugParams.length < 500) {
                                        if (name.includes("ROOF") || name.length > 0) {
                                            // Append to debug
                                            let s = `ID ${expressID}: Name=${name}, Type=${typeName}, ObjType=${props.ObjectType?.value}\n`;
                                            setDebugParams(prev => (prev + s).slice(0, 500));
                                        }
                                    }

                                    // Check for Roof
                                    // IFCTYPE Ref: IfcRoof=393, IfcSlab=435, IfcWall=463 (Standard, but can vary by schema)
                                    // Safer: String Check
                                    if (name.includes("ROOF") || (props.ObjectType && props.ObjectType.value && props.ObjectType.value.toUpperCase().includes("ROOF"))) {
                                        isRoof = true;
                                        mesh.userData.isRoof = true; // Flag for toggling
                                    }

                                    // Also check raw type names if available in your loader (sometimes type is just a number)
                                    // We'll rely on heuristic: Large flat items at top? No, properties are safer.

                                    if (name.includes("FLOOR") || name.includes("SLAB")) isSlab = true;
                                    if (name.includes("WALL")) isWall = true;

                                    // Identify Windows/Doors for Plan View
                                    if (name.includes("WINDOW") || name.includes("GLAZING") || props.ObjectType?.value?.toUpperCase().includes("WINDOW")) {
                                        isWindow = true;
                                        mesh.userData.isWindow = true;
                                    }
                                    if (name.includes("DOOR")) {
                                        isDoor = true;
                                        mesh.userData.isDoor = true;
                                    }
                                    if (name.includes("SPACE") || typeName.includes("IFCSPACE")) {
                                        isSpace = true;
                                        mesh.userData.isSpace = true;
                                        mesh.userData.type = 'SPACE';
                                    }
                                    if (isWall) mesh.userData.isWall = true;
                                    if (isSlab) mesh.userData.isSlab = true;
                                }

                                // Apply Materials
                                let mat = styles.wall; // Default
                                if (isRoof) {
                                    mat = styles.roof;
                                    mesh.visible = false; // HIDE ROOFS IN 2D
                                } else if (isSlab) {
                                    mat = styles.slab;
                                } else if (isWall) {
                                    mat = styles.wall;
                                }

                                mesh.material = mat;

                                // Add Black Outlines (Plan View)
                                if (!isRoof && (isWall || isSlab || isWindow || isDoor)) {
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

                // INITIAL CLIPPER SETUP
                // Run Immediately after load
                // INITIAL CLIPPER SETUP
                // Run Immediately after load
                try {
                    if (components && components.tools) {
                        const clipper = components.tools.get(OBC.EdgesClipper);
                        if (clipper) {
                            try {
                                clipper.enabled = true;
                                if (clipper.deleteAll) clipper.deleteAll();

                                let scale = 1;
                                if (modelBoundsRef.current) {
                                    const s = new THREE.Vector3();
                                    modelBoundsRef.current.getSize(s);
                                    if (Math.max(s.x, s.y, s.z) > 50) scale = 1000;
                                }

                                const cutY = (modelBoundsRef.current?.min.y || 0) + (sliceOffset || 1.2) * scale;

                                console.log(`✂️ INIT CLIPPER at Y=${cutY} (Scale: ${scale})`);

                                clipper.createFromNormalAndCoplanarPoint(
                                    new THREE.Vector3(0, -1, 0),
                                    new THREE.Vector3(0, cutY, 0)
                                );
                            } catch (e) { console.error("Init clipper failed", e); }
                        }
                    }
                } catch (e) { console.warn("Cannot access tools for clipper", e); }

                // VIRTUAL FLOOR GENERATOR variables safety
                const slabCount = Object.keys(slabs || {}).length;
                const wallCount = Object.keys(walls || {}).length;

                // VIRTUAL FLOOR GENERATOR
                // If no slabs detected, generate a floor plane so the model doesn't float in void
                if (slabCount === 0 && wallCount > 0) {
                    // Calculate global bounding box of walls
                    const bbox = new THREE.Box3();
                    // walls is empty so this logic might be skipped, but that is fine for now as we just want to avoid crash.
                    // If we want a floor, we can use model bounds.
                    if (modelBoundsRef.current) {
                        bbox.copy(modelBoundsRef.current);
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

                // Helper: Geometry Slicer (Async & Yielding)
                const sliceMesh = async (mesh: THREE.Mesh, planeY: number, type: string, fid: string) => {
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
                            if (i % 3000 === 0) await checkYield();
                        }
                    } else {
                        for (let i = 0; i < pos.count; i += 3) {
                            checkTri(i, i + 1, i + 2);
                            if (i % 3000 === 0) await checkYield();
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
                    // Better check: iterate all boxes and find Max Dimension.

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
                    const cutOffset = sliceOffset * unitScale;
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

                            // CACHE BOUNDS (Robust & Performant)
                            if (mesh && mesh.geometry && mesh.geometry.boundingBox) {
                                if (mesh instanceof THREE.InstancedMesh) {
                                    for (let i = 0; i < mesh.count; i++) {
                                        mesh.getMatrixAt(i, tempMatrix);
                                        // Apply Instance + World
                                        // Usually fragment meshes are at Identity world, but apply anyway
                                        tempMatrix.premultiply(mesh.matrixWorld);
                                        const b = mesh.geometry.boundingBox.clone().applyMatrix4(tempMatrix);
                                        if (!modelBoundsRef.current) modelBoundsRef.current = new THREE.Box3();
                                        modelBoundsRef.current.union(b);
                                    }
                                } else {
                                    // Standard Mesh (rare for Fragments)
                                    const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
                                    if (!modelBoundsRef.current) modelBoundsRef.current = new THREE.Box3();
                                    modelBoundsRef.current.union(b);
                                }
                            }

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
                                            for (let j = 0; j < index.count; j += 3) {
                                                checkTriInst(index.getX(j), index.getX(j + 1), index.getX(j + 2));
                                                // Check yield inside instance loop (less freq)
                                                if (j % 9000 === 0) await checkYield();
                                            }
                                        } else {
                                            for (let j = 0; j < pos.count; j += 3) {
                                                checkTriInst(j, j + 1, j + 2);
                                                if (j % 9000 === 0) await checkYield();
                                            }
                                        }
                                    }
                                } else {
                                    await sliceMesh(mesh, cutY, type, fid);
                                }
                            }

                            // Check yield periodically in main fragment loop
                            await checkYield();
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
                step = "6. Preparing Interaction";
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

                // EVENTS MOVED TO SEPARATE USE_EFFECT TO PREVENT LEAKS
                // The previous addEventListener calls here were causing memory leaks and piling up listeners.

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
    }, [id, sliceOffset]); // Strictly ID dependent

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


    };

    // --- VIEW MODE SWITCHER IMPL ---
    // --- VIEW MODE SWITCHER IMPL ---
    useEffect(() => {
        if (!components) return;

        // 1. Common Refs
        const cam = components.camera as OBC.OrthoPerspectiveCamera;
        const scene = components.scene.get();
        const clipper = components.tools.get(OBC.EdgesClipper);
        const controls = cam.controls;

        // --- ROBUST MODEL LOADER & ORIENTATION FIX ---
        // useEffect(() => {
        const i = setInterval(() => {
            if (!components) return;
            try {
                const fragments = components.tools.get(OBC.FragmentManager);
                if (fragments && fragments.groups.length > 0) {
                    const model = fragments.groups[0];
                    if (!model.userData.processed) {
                        // Check Orientation
                        const bbox = new THREE.Box3().setFromObject(model);
                        const size = new THREE.Vector3(); bbox.getSize(size);
                        // Z-Up Detection (Height > Depth/Width)
                        if (size.z > size.y * 5) {
                            model.rotation.x = -Math.PI / 2;
                            model.updateMatrixWorld(true);
                            model.userData.isRotated = true;
                            if (modelBoundsRef.current) modelBoundsRef.current.setFromObject(model);
                            console.log("🔄 Fixed Z-Up Orientation");
                        }
                        model.userData.processed = true;
                        setIsModelReady(true);
                        clearInterval(i);

                        // Force Fit & Slicer Update
                        setTimeout(() => {
                            if (components.camera) components.camera.controls.fitToBox(model, true);
                            // Trigger Slicer by tweaking slice slightly? No, logic handles it.
                        }, 500);
                    } else {
                        // Already processed
                        setIsModelReady(true);
                        clearInterval(i);
                    }
                }
            } catch (e) { console.error(e); }
        }, 500);
        // return () => clearInterval(i);
        // }, [components, fileUrl]);

        const handleModeSwitch = async () => {
            // Ensure camera is ready
            if (!cam || !controls) return;

            // RUNTIME DEBUG MOVED TO END


            if (viewMode === '3d') {
                console.log("🎥 Switch to 3D Orbit");
                if (cam.projection.current !== 'Perspective') await cam.projection.set('Perspective');
                if (clipper) clipper.enabled = false;
                scene.background = new THREE.Color(0xf0f0f0); // Soft Grey

                const bbox = modelBoundsRef.current;

                scene.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        // Restore Original Material
                        if (obj.userData.originalMat) obj.material = obj.userData.originalMat;

                        // Restore Visibility
                        if (obj.userData.isRoof) obj.visible = true;
                        if (obj.userData.isSlab) obj.visible = true;

                        // Hide 2D Outline
                        const line = obj.children.find(c => c.name === '2d-outline');
                        if (line) line.visible = false;
                    }
                });

                // 3D Camera Pose
                if (bbox && !bbox.isEmpty()) {
                    const center = new THREE.Vector3(); bbox.getCenter(center);
                    const size = new THREE.Vector3(); bbox.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z) || 100;
                    await controls.setLookAt(center.x + maxDim, center.y + maxDim, center.z + maxDim, center.x, center.y, center.z, true);
                    await controls.fitToBox(bbox, true);
                }

            } else {
                console.log("🎥 Switch to 2D Plan");
                try {
                    if (cam.projection.current !== 'Ortho') await cam.projection.set('Ortho');
                } catch (e) { console.error("Camera Ortho Error:", e); }

                scene.background = new THREE.Color(0xffffff); // Pure White

                // 2D Clipper (Wrapped)
                try {
                    if (clipper) {
                        clipper.enabled = true;
                        if (modelBoundsRef.current && (!clipper.planes || clipper.planes.length === 0)) {
                            if (clipper.deleteAll) clipper.deleteAll();
                            let scale = 1;
                            const s = new THREE.Vector3();
                            if (!modelBoundsRef.current.isEmpty()) modelBoundsRef.current.getSize(s);
                            if (Math.max(s.x, s.y, s.z) > 50) scale = 1000;
                            const cutY = (modelBoundsRef.current.min.y || 0) + (sliceOffset || 1.2) * scale;
                            clipper.createFromNormalAndCoplanarPoint(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, cutY, 0));
                        }
                    }
                } catch (e) { console.error("Clipper Error:", e); }

                // PLAN STYLES
                const PLAN_MAT_WALL = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const PLAN_MAT_WINDOW = new THREE.MeshBasicMaterial({ color: 0xdbfaff, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const PLAN_MAT_DOOR = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const PLAN_MAT_SLAB = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const PLAN_MAT_MISC = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });

                scene.traverse((obj) => {
                    try {
                        if (obj instanceof THREE.Mesh) {
                            // AUTO-FIX: If no type, classify by geometry
                            if (obj.userData.type === undefined || obj.userData.type === 'MISC') {
                                if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
                                const b = obj.geometry.boundingBox;
                                if (b) {
                                    const s = new THREE.Vector3(); b.getSize(s);

                                    // Unit Detection (MM vs M)
                                    const isMM = (s.x > 100 || s.y > 100 || s.z > 100);
                                    const slabThick = isMM ? 600 : 0.6;
                                    const wallH = isMM ? 2000 : 2.0;

                                    // Slabs are flat (Y-Up or Z-Up)
                                    // If Flat Y (< Thick) -> Slab
                                    // If Tall Z (> WallH) -> Wall (Z-Up) OR Wall (Y-Up Long Wall)? 
                                    // Priority: Check Height.

                                    if (s.y > wallH) {
                                        obj.userData.type = 'WALL'; obj.userData.isWall = true;
                                    } else if (s.z > wallH && s.y > slabThick) {
                                        // Tall Z and not flat Y -> Wall (Z-Up)
                                        obj.userData.type = 'WALL'; obj.userData.isWall = true;
                                    } else if (s.y < slabThick) {
                                        obj.userData.type = 'SLAB'; obj.userData.isSlab = true;
                                    }

                                    // Roof Check via Height
                                    const c = new THREE.Vector3(); b.getCenter(c);
                                    const roofH = isMM ? 2800 : 2.8;

                                    if (c.y > roofH) {
                                        obj.userData.type = 'ROOF';
                                        obj.userData.isRoof = true;
                                        obj.userData.isSlab = false;
                                        obj.userData.isWall = false;
                                    }
                                }
                            }

                            // Save Original if missing
                            if (!obj.userData.originalMat) obj.userData.originalMat = obj.material;

                            // Apply Plan Material based on flags set in Init
                            if (obj.userData.isWall) obj.material = PLAN_MAT_WALL;
                            else if (obj.userData.isWindow) obj.material = PLAN_MAT_WINDOW;
                            else if (obj.userData.isDoor) obj.material = PLAN_MAT_DOOR;
                            else if (obj.userData.isSlab) obj.material = PLAN_MAT_SLAB;
                            else obj.material = PLAN_MAT_MISC;

                            // Transparency logic for windows
                            if (obj.userData.isWindow) {
                                obj.visible = true;
                            }

                            // Visibility: Hide Roofs & Slabs (for simpler plan look)
                            if (obj.userData.isRoof) obj.visible = false;
                            else if (obj.userData.isSlab) obj.visible = false; // Hide floor to see grid/white bg clearly
                            else obj.visible = true;

                            // Show or Create 2D Outline
                            let line = obj.children.find(c => c.name === '2d-outline');
                            if (!line && (obj.userData.isWall || obj.userData.isWindow || obj.userData.isDoor)) {
                                // Create Lazy Outline (With Depth Test to prevent X-Ray)
                                const edges = new THREE.EdgesGeometry(obj.geometry, 80);
                                const l = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, depthTest: true }));
                                l.name = '2d-outline';
                                l.renderOrder = 999;
                                obj.add(l);
                                line = l;
                            }

                            if (line) {
                                line.visible = true;
                                if (line.material instanceof THREE.LineBasicMaterial) line.material.color.setHex(0x000000);
                            }
                        }
                    } catch (e) { console.error(e); }
                });

                // Top Down Camera
                const bbox = modelBoundsRef.current;
                if (bbox && !bbox.isEmpty()) {
                    const center = new THREE.Vector3(); bbox.getCenter(center);
                    const size = new THREE.Vector3(); bbox.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z) || 100;
                    await controls.setLookAt(center.x, center.y + maxDim * 2 + 100, center.z, center.x, center.y, center.z, true);
                    await controls.fitToBox(bbox, true);
                }
            }

            // FINAL COMPLETION LOG
            try {
                let log = "";
                let count = 0;
                scene.traverse((obj) => {
                    if (obj instanceof THREE.Mesh && count < 5) {
                        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                        const col = mat && mat.color ? mat.color.getHexString() : "N/A";
                        // Log Bounds to Debug Fallback
                        let dims = "N/A";
                        if (obj.geometry.boundingBox) {
                            const s = new THREE.Vector3(); obj.geometry.boundingBox.getSize(s);
                            dims = `${Math.round(s.x)}x${Math.round(s.y)}x${Math.round(s.z)}`;
                        }
                        const visible = obj.visible ? "YES" : "NO";
                        const isSpace = obj.userData.isSpace ? "YES" : "NO";
                        log += `M${obj.id}: Type='${obj.userData.type || "?"}', Space=${isSpace}, Vis=${visible}, Size=${dims}\n`;
                        count++;
                    }
                });
                const propRooms = rooms?.length || 0;
                const slicerCount = extractedLines?.length || 0;

                // Safe Rotation Check
                let isRotStr = "NO";
                try {
                    const group = components.tools.get(OBC.FragmentManager)?.groups[0];
                    if (group?.userData?.isRotated) isRotStr = "YES";
                } catch (e) { }

                setDebugParams(prev => (prev ? prev.split("Runtime")[0] : "") + `\nRuntime Stats: PropRooms=${propRooms}, SlicerLines=${slicerCount}, Rotated=${isRotStr}, CamY=${Math.round(components.camera.get().position.y)}\n` + log);
            } catch (e) { console.error(e); }
        };

        handleModeSwitch(); // Restore Execution
    }, [viewMode, components, sliceOffset]);

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

    // --- ROOM LABELS & VECTOR LINES OVERLAY ---
    const [roomLabels, setRoomLabels] = useState<any[]>([]);
    const [screenLines, setScreenLines] = useState<any[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        const cam = components?.camera.get();
        const controls = components?.camera.controls;

        if (!container || !cam || !components) return;

        // AUTO-ROTATE Moved to Loader Effect

        const updateOverlays = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // 1. Room Labels
            if (rooms && rooms.length > 0) {
                const labels = rooms.map(room => {
                    if (!room.geometry) return null;
                    try {
                        const pts = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
                        if (!Array.isArray(pts) || pts.length === 0) return null;

                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        pts.forEach((p: any) => {
                            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
                        });
                        const cx = (minX + maxX) / 2;
                        const cy = (minY + maxY) / 2;

                        // Map 2D (x,y) -> 3D (x,z)
                        let floorY = modelBoundsRef.current ? modelBoundsRef.current.min.y : 0;
                        const worldPos = new THREE.Vector3(cx, floorY + 1.0, cy);
                        const s = worldPos.project(cam);

                        if (s.z > 1) return null; // Behind camera

                        return {
                            id: room.id, name: room.name, area: room.area,
                            x: (s.x * 0.5 + 0.5) * width,
                            y: (-(s.y * 0.5) + 0.5) * height
                        };
                    } catch (e) { return null; }
                }).filter(Boolean);
                setRoomLabels(labels);
            }

            // 2. Vector Lines (Slicer)
            if (extractedLines && extractedLines.length > 0 && viewMode === '2d') {
                const lines = extractedLines.map((l: any, i: number) => {
                    if (l.subtype !== 'segment') return null;
                    // Project Start/End
                    const v1 = new THREE.Vector3(l.p1.x, 0, l.p1.y); // Y in Slicer is Z in World
                    const v2 = new THREE.Vector3(l.p2.x, 0, l.p2.y);

                    v1.project(cam);
                    v2.project(cam);

                    return {
                        id: i,
                        x1: (v1.x * 0.5 + 0.5) * width,
                        y1: (-(v1.y * 0.5) + 0.5) * height,
                        x2: (v2.x * 0.5 + 0.5) * width,
                        y2: (-(v2.y * 0.5) + 0.5) * height,
                        type: l.type
                    };
                }).filter(Boolean);
                setScreenLines(lines);
            } else {
                setScreenLines([]);
            }
        };

        if (controls) controls.addEventListener('change', updateOverlays);
        window.addEventListener('resize', updateOverlays);
        window.addEventListener('viewer-fit-camera', () => setTimeout(updateOverlays, 100));
        updateOverlays();

        return () => {
            if (controls) controls.removeEventListener('change', updateOverlays);
            window.removeEventListener('resize', updateOverlays);
        };
    }, [components, rooms, extractedLines, viewMode]);

    // --- INTERACTIVE EVENTS (SAFE & CLEANED UP) ---
    useEffect(() => {
        if (!components || !containerRef.current) return;
        const container = containerRef.current;
        const comps = components; // capture

        let currentSelection: THREE.Mesh | null = null;
        let originalMaterial: THREE.Material | null = null;
        const highlightMat = new THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            depthTest: false,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        const styles = {
            wall: new THREE.MeshBasicMaterial({ color: 0x999999, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 1 }),
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            setTooltipPos({ x: event.clientX, y: event.clientY });

            // Raycast
            if (!comps.raycaster) return;
            const raycaster = comps.raycaster.get();
            raycaster.setFromCamera(new THREE.Vector2(x, y), comps.camera.get());

            // Target List
            let targetList = interactables.current;
            if (isLabelModeRef.current) {
                targetList = interactables.current.filter(m => m.userData.api.isDbRoom);
            }

            const intersects = raycaster.intersectObjects(targetList, false);

            if (intersects.length > 0) {
                const result = intersects[0];
                const mesh = result.object as THREE.Mesh;

                if (currentSelection !== mesh) {
                    // Restore previous
                    if (currentSelection && originalMaterial) {
                        currentSelection.material = originalMaterial;
                        currentSelection.renderOrder = 0;
                    }

                    // Select new
                    currentSelection = mesh;
                    // Store original material (handle Array material case poorly, assuming Single for simple ifc)
                    originalMaterial = mesh.material as THREE.Material;

                    mesh.material = highlightMat;
                    mesh.renderOrder = 3;

                    // TOOLTIP DATA
                    const data = mesh.userData.api || { name: 'Unknown', type: 'Geometry' };
                    let dimString = "Analyzing...";
                    let areaString = "--";

                    // Simple Calc for Tooltip
                    if (mesh.geometry) {
                        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                        const box = mesh.geometry.boundingBox!.clone();
                        if (mesh instanceof THREE.InstancedMesh && result.instanceId !== undefined) {
                            const m = new THREE.Matrix4();
                            mesh.getMatrixAt(result.instanceId, m);
                            box.applyMatrix4(m);
                        } else {
                            box.applyMatrix4(mesh.matrixWorld);
                        }
                        const s = new THREE.Vector3();
                        box.getSize(s);
                        const isHorizontal = data.type.includes("Roof") || data.type.includes("Slab");
                        const len = Math.max(s.x, s.z);
                        if (isHorizontal) {
                            dimString = `${len.toFixed(2)}x${Math.min(s.x, s.z).toFixed(2)}`;
                            areaString = (s.x * s.z).toFixed(2);
                        } else {
                            dimString = `${s.y.toFixed(2)}m H`;
                            areaString = (s.y * Math.max(s.x, s.z)).toFixed(2);
                        }
                    }

                    setTooltipData({
                        visible: true,
                        name: `${data.name}`,
                        type: data.type,
                        dims: dimString,
                        qty: `${areaString} m²`
                    });
                }
            } else {
                if (currentSelection && originalMaterial) {
                    currentSelection.material = originalMaterial;
                    currentSelection.renderOrder = 0;
                    currentSelection = null;
                    originalMaterial = null;
                }
                setTooltipData(prev => ({ ...prev, visible: false }));
            }
        };

        const handleClick = (event: MouseEvent) => {
            // Label Mode
            if (isLabelModeRef.current) {
                if (currentSelection && currentSelection.userData.api.isDbRoom) {
                    setLabelMenu({ x: event.clientX, y: event.clientY, item: currentSelection.userData.api });
                }
                return;
            }

            // Normal Click
            if (onElementClick && currentSelection) {
                // Re-fetch clean data from fragment if possible, or just use userData
                onElementClick(currentSelection.userData.api);
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('click', handleClick);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('click', handleClick);
            // reset selection
            if (currentSelection && originalMaterial) {
                currentSelection.material = originalMaterial;
            }
        };
    }, [components, id]); // Re-bind if components reset

    const fitView = () => {
        if (!components) return;

        const bbox = modelBoundsRef.current;
        if (bbox && !bbox.isEmpty() && isFinite(bbox.min.x)) {
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const size = new THREE.Vector3();
            bbox.getSize(size);

            const maxDim = Math.max(size.x, size.z);

            if (!isFinite(center.x) || !isFinite(maxDim)) {
                console.error("⚠️ Cannot Fit: Center/Dim is NaN");
                return;
            }

            console.log(`🔘 Manual Fit: Center [${center.x | 0}, ${center.y | 0}, ${center.z | 0}] Dim: ${maxDim | 0}`);

            const cam = components.camera;

            // 1. Force 2D Defaults if in 2D mode
            if (viewMode === '2d') {
                try {
                    const scene = components.scene.get();
                    scene.background = new THREE.Color(0xffffff);
                    if (cam.projection.current !== 'Ortho') {
                        cam.projection.set('Ortho');
                    }
                } catch (e) { }
            }

            // 2. Set Target to Center of Model
            cam.controls.setTarget(center.x, center.y, center.z, true);

            // 3. Set Position (Top Down)
            cam.controls.setPosition(center.x, center.y + maxDim, center.z, true);

            // 4. Fit Zoom
            cam.controls.fitToBox(bbox, true);

            // 5. Force Zoom Adjustment (Ortho Fix)
            setTimeout(() => {
                const c = cam.get();
                console.log(`📸 Fit Complete. Zoom: ${c.zoom}`);
            }, 100);

        } else {
            console.warn("⚠️ No Valid Model Bounds to Fit");
            // Fallback to Origin
            const cam = components.camera;
            cam.controls.setLookAt(0, 100, 0, 0, 0, 0, true);
        }
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* ROBUST LOADING OVERLAY */}
            {!isModelReady && (
                <div className="absolute inset-0 z-[2000] bg-slate-50 flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="text-slate-700 font-semibold text-lg animate-pulse">Analyzing Model Orientation...</div>
                    <div className="text-sm text-slate-500 max-w-sm text-center">
                        Detecting coordinate system (Z-Up vs Y-Up) and performing vector extraction. Please wait...
                    </div>
                </div>
            )}

            {/* DEBUG OVERLAY - VISIBLE */}
            <div className="absolute top-10 right-0 bg-black/80 text-green-400 text-[10px] p-2 z-[999] pointer-events-none font-mono rounded m-2 max-w-xs block">
                <div className="font-bold border-b border-white/20 mb-1 text-cyan-400">v5.1 - Debug Toggle</div>
                <div className="font-bold text-white bg-blue-600 px-1 rounded mb-1">Mode Prop: {viewMode}</div>
                <div className="font-bold border-b border-white/20 mb-1">Diagnose ID: {id?.slice(0, 4)}</div>
                <div className="text-yellow-400 border-b border-white/20 mb-1">{cameraStats}</div>
                {debugLog.map((l, i) => <div key={i}>{l}</div>)}

                <button
                    onClick={fitView}
                    className="mt-2 bg-blue-600 text-white px-3 py-1 rounded shadow-lg hover:bg-blue-500 active:bg-blue-700 pointer-events-auto cursor-pointer w-full font-bold text-center"
                    style={{ pointerEvents: 'auto' }}
                >
                    Fit View ⛶
                </button>

                <button
                    onClick={() => setIsLabelMode(!isLabelMode)}
                    className={`mt-2 px-3 py-1 rounded shadow-lg pointer-events-auto cursor-pointer w-full font-bold text-center ${isLabelMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
                    style={{ pointerEvents: 'auto' }}
                >
                    {isLabelMode ? 'Label Mode: ON' : 'Label Rooms 🏷️'}
                </button>

                {/* DEBUG PROPS */}
                <div className="mt-2 bg-slate-900/90 text-white text-[9px] p-1 rounded max-h-32 overflow-auto whitespace-pre-wrap pointer-events-auto select-text">
                    {debugParams || "No Props Captured"}
                </div>

            </div>

            {/* VECTOR LINES OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <svg className="w-full h-full">
                    {screenLines.map(l => (
                        <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                            stroke={l.type === 'wall' ? 'black' : l.type === 'window' ? '#38bdf8' : '#d97706'}
                            strokeWidth={l.type === 'wall' ? 2 : 1}
                            opacity={0.8} />
                    ))}
                </svg>
            </div>

            {/* ROOM LABELS OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                {roomLabels.map((lbl: any) => (
                    <div
                        key={lbl.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto cursor-pointer group"
                        style={{ left: lbl.x, top: lbl.y }}
                        onClick={() => {
                            if (isLabelMode) {
                                setLabelMenu({ item: { element: { userData: { api: lbl } } } as any, x: lbl.x, y: lbl.y });
                            }
                        }}
                    >
                        <div className={`text-xs font-bold px-1 rounded ${isLabelMode ? 'bg-black/50 text-white' : 'text-slate-800 drop-shadow-md'}`}
                            style={{ textShadow: '0px 0px 2px white' }}>
                            {lbl.name}
                        </div>
                        {lbl.area && (
                            <div className="text-[10px] text-slate-500 font-mono bg-white/80 px-1 rounded border border-slate-200 shadow-sm mt-1">
                                {parseFloat(lbl.area).toFixed(1)} m²
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ERROR UI */}
            {
                error && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white p-8">
                        <div className="text-red-500 font-bold mb-2">Error Loading 3D Engine</div>
                        <div className="text-sm text-gray-600 mb-4 text-center">{error}</div>
                        <Button onClick={() => window.location.reload()} variant="outline">Reload Page</Button>
                    </div>
                )
            }

            {/* CANVAS (3D Only) */}
            <div
                ref={containerRef}
                className="w-full h-full absolute inset-0 bg-slate-50"
                style={{ touchAction: 'none' }}
            ></div>

            {/* Loading Overlay */}
            {
                loading && (
                    <div className="absolute inset-0 z-40 bg-white/80 flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-4" />
                        <p className="text-slate-600 font-medium">{loadingStatus}</p>
                    </div>
                )
            }
        </div >
    );
}); // Close Memo (Default Shallow Compare)

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
    // 2. PARSE ROOMS
    const parsedRooms: any[] = [];
    safeRooms.forEach(room => {
        try {
            let pts: any[] = typeof room.geometry === 'string' ? JSON.parse(room.geometry) : room.geometry;
            if (!Array.isArray(pts) || pts.length < 3) return;

            // Basic Centroid
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            parsedRooms.push({ ...room, pts, cx, cy });
        } catch (e) { }
    });

    // 3. DETECT MISMATCH & DETERMINE RELATIVE SCALE (Crucial Fix)
    // Check Max Extents
    let roomsMax = 0;
    parsedRooms.forEach(r => {
        r.pts.forEach((p: any) => {
            const m = Math.max(Math.abs(p.x), Math.abs(p.y));
            if (m > roomsMax) roomsMax = m;
        });
    });

    let roomScale = 1;

    // 3A. SCALE NORMALIZATION (Fix Unit Mismatch)
    if (linesMax > 0 && roomsMax > 0) {
        if (linesMax > 1000 && roomsMax < 100) {
            // Lines MM, Rooms M -> Scale Rooms UP
            parsedRooms.forEach(r => {
                r.pts.forEach((p: any) => { p.x *= 1000; p.y *= 1000; });
                r.cx *= 1000; r.cy *= 1000;
            });
        }
        else if (linesMax < 100 && roomsMax > 1000) {
            // Lines M, Rooms MM -> Scale Rooms DOWN
            parsedRooms.forEach(r => {
                r.pts.forEach((p: any) => { p.x *= 0.001; p.y *= 0.001; });
                r.cx *= 0.001; r.cy *= 0.001;
            });
        }
    }

    // 3B. CENTROID ALIGNMENT - DISABLED
    // We rely on Scale Normalization (above).
    // Manual Centroid Snapping introduces errors when wall thicknesses are asymmetrical (e.g. thick external vs thin internal).
    // If the IFC coordinates are valid, scaling relative to (0,0) (point multiplication) is sufficient.


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

    // 4b. INCLUDE ROOMS IN BOUNDS
    // NOW SAFE because we normalized scales.
    parsedRooms.forEach(r => {
        r.pts.forEach((p: any) => updateBounds(p.x, p.y));
    });

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

                    {/* 1. ROOMS (Transparent Interactive Layer) */}
                    {parsedRooms.map(room => {
                        // Build Path (room.pts are ALREADY SCALED by roomScale now)
                        // But mapX_Scaled applies renderScaleLines?
                        // Wait: Lines didn't get scaled in loop 3. renderScaleLines is 1.
                        // So mapX_Scaled calls mapX(x * 1).

                        if (!room.pts || room.pts.length < 2) return null;
                        const d = `M ${room.pts.map((p: any) => `${mapX_Scaled(p.x)} ${mapY_Scaled(p.y)}`).join(" L ")} Z`;

                        const svgCx = mapX_Scaled(room.cx);
                        const svgCy = mapY_Scaled(room.cy);

                        return (
                            <g
                                key={room.id}
                                onClick={(e) => { e.stopPropagation(); onRoomClick(room); }}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                {/* Transparent Click Target + Subtle Outline for Verification */}
                                <path d={d} fill="transparent" stroke="#cbd5e1" strokeWidth={mapDim(0.02 * renderScaleLines)} strokeDasharray="5,5" />

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

                        // FALLBACK: ENHANCED VISUALIZATION
                        let strokeColor = '#94a3b8'; // Default Slate
                        let strokeW = strokeWidth;   // Default Thin
                        let fill = 'none';
                        let fillOpacity = 1; // Initialize fillOpacity
                        let dashArray = `${strokeWidth * 4},${strokeWidth * 4}`; // Default Dashed

                        // 1. WALLS: Distinguish External vs Internal by Thickness
                        if (l.type === 'wall') {
                            // Find the thinner dimension to estimate wall thickness
                            const minDim = Math.min(l.w, l.h) * (l.unitScale || 1); // Check absolute size
                            const isExternal = (minDim > 0.25) || (minDim > 250); // >250mm is likely external

                            strokeColor = '#0f172a'; // Black for all walls
                            if (isExternal) {
                                strokeW = strokeWidth * 3; // Thick for External
                                dashArray = 'none';        // Solid for External
                            } else {
                                strokeW = strokeWidth * 1.5; // Medium for Internal
                                dashArray = 'none';          // Solid for Internal (Clearer than dashed)
                            }
                        }
                        // 2. WINDOWS: Blue Glazing Style
                        else if (l.type === 'window') {
                            strokeColor = '#0ea5e9'; // Sky Blue
                            fill = '#e0f2fe';        // Very Light Blue Fill
                            fillOpacity = 0.5;
                            dashArray = 'none';      // Solid
                            strokeW = strokeWidth;
                        }
                        // 3. DOORS: Wood Style
                        else if (l.type === 'door') {
                            strokeColor = '#d97706'; // Amber/Brown
                            fill = 'none';
                            dashArray = `${strokeWidth * 2},${strokeWidth * 2}`; // Dotted for swing
                            strokeW = strokeWidth;
                        }

                        return (
                            <rect
                                key={`rect-${i}`}
                                x={mapX_Scaled(l.x)}
                                y={mapY_Scaled(l.y + l.h)}
                                width={mapDim_Scaled(l.w)}
                                height={mapDim_Scaled(l.h)}
                                fill={fill}
                                fillOpacity={fillOpacity}
                                stroke={strokeColor}
                                strokeWidth={strokeW}
                                strokeDasharray={dashArray}
                            />
                        )

                    })}


                </svg>
            </div>
        </div>
    );
}
