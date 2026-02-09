/**
 * IFC Plan Viewer - Lightweight SVG-based viewer
 * 
 * REPLACES the heavy WebGL ProfessionalIFCViewer.
 * 
 * ARCHITECTURE:
 * - Server-side: ifc-agent.ts parses IFC with web-ifc, extracts rooms, walls, doors, windows
 * - Server stores extracted data in `extractedElements` and `rooms` tables
 * - This component READS that data and renders a clean SVG floor plan
 * - No WebGL, no Three.js, no browser freezing
 * 
 * AGENTS.md COMPLIANT:
 * - Architect Agent (ifc-agent.ts) handles Object Identification (Layer 1)
 * - This viewer displays the results for human review
 */

import React, { useState, useRef, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Tag, MousePointer } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedElement {
    id: string;
    elementType: string;
    description: string;
    roomName: string;
    dimensions?: string;
    bbox?: number[] | string;
    geometry?: any;
    quantity?: string;
    rawJson?: string;
}

interface Room {
    id: string;
    name: string;
    area?: string;
    totalValue?: number; // Cost in £ (from room-mapper allocation)
    elements?: any[]; // Room elements with cost breakdowns
    geometry?: any;
    bbox?: number[] | string;
}

interface IfcPlanViewerProps {
    elements: ExtractedElement[];
    rooms: Room[];
    onElementClick?: (element: ExtractedElement) => void;
    onRoomClick?: (room: Room) => void;
    onRoomRename?: (id: string, name: string) => void;
}

interface ParsedWall {
    id: string;
    polygon: { x: number; y: number }[];
    isExternal: boolean;
    name: string;
}

interface ParsedElement {
    id: string;
    type: string;
    name: string;
    center: { x: number; y: number };
    bbox: number[];
    room: string;
}

interface ParsedRoom {
    id: string;
    name: string;
    area: string;
    totalValue?: number; // Cost in £ from room-mapper allocation
    polygon: { x: number; y: number }[];
    center: { x: number; y: number };
}

// ============================================================================
// COLOR PALETTE
// ============================================================================
const ROOM_COLORS: Record<string, string> = {
    'bathroom': '#dbeafe',
    'bath': '#dbeafe',
    'wc': '#dbeafe',
    'toilet': '#dbeafe',
    'kitchen': '#fef3c7',
    'lounge': '#dcfce7',
    'living': '#dcfce7',
    'bedroom': '#f3e8ff',
    'bed': '#f3e8ff',
    'hallway': '#f1f5f9',
    'hall': '#f1f5f9',
    'landing': '#f1f5f9',
    'utility': '#fce7f3',
    'dining': '#fff7ed',
    'study': '#ecfdf5',
    'office': '#ecfdf5',
    'en-suite': '#e0f2fe',
    'ensuite': '#e0f2fe',
};

const ELEMENT_COLORS: Record<string, string> = {
    'wall': '#1e293b',
    'door': '#d97706',
    'window': '#0ea5e9',
    'slab': '#94a3b8',
    'light': '#eab308',
    'socket': '#f97316',
    'switch': '#22c55e',
    'sanitary': '#8b5cf6',
    'plumbing': '#06b6d4',
    'electrical': '#f59e0b',
    'stair': '#78716c',
    'furniture': '#a78bfa',
    'radiator': '#ef4444',
    'structure': '#64748b',
    'roof': '#475569',
    'generic': '#94a3b8',
    'finish': '#cbd5e1',
};

const ELEMENT_ICONS: Record<string, string> = {
    'door': '🚪',
    'window': '🪟',
    'light': '💡',
    'socket': '🔌',
    'switch': '⬜',
    'sanitary': '🚿',
    'radiator': '🌡️',
    'stair': '🪜',
};

// ============================================================================
// HELPER: Parse geometry from DB strings
// ============================================================================
function parseGeometry(geom: any): { x: number; y: number }[] | null {
    if (!geom) return null;
    try {
        const parsed = typeof geom === 'string' ? JSON.parse(geom) : geom;
        if (Array.isArray(parsed) && parsed.length >= 3 && parsed[0].x !== undefined) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

function parseBbox(bbox: any): number[] | null {
    if (!bbox) return null;
    try {
        const parsed = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;
        if (Array.isArray(parsed) && parsed.length >= 4) return parsed;
        return null;
    } catch {
        return null;
    }
}

function getRoomColor(name: string): string {
    const lower = name.toLowerCase();
    for (const [key, color] of Object.entries(ROOM_COLORS)) {
        if (lower.includes(key)) return color;
    }
    // Hash-based fallback
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 30%, 94%)`;
}

function polygonArea(pts: { x: number; y: number }[]): number {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
}

function polygonCentroid(pts: { x: number; y: number }[]): { x: number; y: number } {
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p.x; cy += p.y; });
    return { x: cx / pts.length, y: cy / pts.length };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function IfcPlanViewer({ elements, rooms, onElementClick, onRoomClick, onRoomRename }: IfcPlanViewerProps) {
    // Transform state
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
    const [tooltipData, setTooltipData] = useState<{ x: number; y: number; text: string; type: string } | null>(null);
    const [labelMode, setLabelMode] = useState(false);
    const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const lastPos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // ========================================================================
    // PARSE DATA
    // ========================================================================
    const { parsedWalls, parsedElements, parsedRooms, bounds, unitScale } = useMemo(() => {
        const walls: ParsedWall[] = [];
        const elems: ParsedElement[] = [];
        const rms: ParsedRoom[] = [];

        // Detect unit scale
        let maxCoord = 0;

        // Parse elements
        for (const el of elements) {
            const bbox = parseBbox(el.bbox || el.dimensions);
            const geom = parseGeometry(el.geometry);

            if (el.elementType === 'room') continue; // Rooms handled separately

            if (el.elementType === 'wall' && geom && geom.length >= 3) {
                geom.forEach(p => {
                    maxCoord = Math.max(maxCoord, Math.abs(p.x), Math.abs(p.y));
                });
                walls.push({
                    id: el.id,
                    polygon: geom,
                    isExternal: (el.description || '').toLowerCase().includes('external'),
                    name: el.description || 'Wall'
                });
            } else if (bbox) {
                maxCoord = Math.max(maxCoord, Math.abs(bbox[0]), Math.abs(bbox[1]), Math.abs(bbox[2]), Math.abs(bbox[3]));
                elems.push({
                    id: el.id,
                    type: el.elementType,
                    name: el.description || el.elementType,
                    center: { x: (bbox[0] + bbox[2]) / 2, y: (bbox[1] + bbox[3]) / 2 },
                    bbox,
                    room: el.roomName || 'Global'
                });
            }
        }

        // Parse rooms
        for (const room of rooms) {
            const geom = parseGeometry(room.geometry);
            const bbox = parseBbox(room.bbox);

            if (geom && geom.length >= 3) {
                geom.forEach(p => {
                    maxCoord = Math.max(maxCoord, Math.abs(p.x), Math.abs(p.y));
                });
                const center = polygonCentroid(geom);
                const area = polygonArea(geom);
                rms.push({
                    id: room.id,
                    name: room.name,
                    area: room.area || (area > 1000 ? (area / 1e6).toFixed(1) : area.toFixed(1)),
                    totalValue: room.totalValue || 0,
                    polygon: geom,
                    center
                });
            } else if (bbox) {
                maxCoord = Math.max(maxCoord, Math.abs(bbox[0]), Math.abs(bbox[1]), Math.abs(bbox[2]), Math.abs(bbox[3]));
                const cx = (bbox[0] + bbox[2]) / 2;
                const cy = (bbox[1] + bbox[3]) / 2;
                const w = Math.abs(bbox[2] - bbox[0]);
                const h = Math.abs(bbox[3] - bbox[1]);
                rms.push({
                    id: room.id,
                    name: room.name,
                    area: room.area || (w * h > 1000 ? (w * h / 1e6).toFixed(1) : (w * h).toFixed(1)),
                    totalValue: room.totalValue || 0,
                    polygon: [
                        { x: bbox[0], y: bbox[1] },
                        { x: bbox[2], y: bbox[1] },
                        { x: bbox[2], y: bbox[3] },
                        { x: bbox[0], y: bbox[3] }
                    ],
                    center: { x: cx, y: cy }
                });
            }
        }

        // Determine scale: >100 = likely millimeters
        const scale = maxCoord > 100 ? 1000 : 1;

        // Compute bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const updateBounds = (x: number, y: number) => {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        };

        walls.forEach(w => w.polygon.forEach(p => updateBounds(p.x, p.y)));
        rms.forEach(r => r.polygon.forEach(p => updateBounds(p.x, p.y)));
        elems.forEach(e => { updateBounds(e.bbox[0], e.bbox[1]); updateBounds(e.bbox[2], e.bbox[3]); });

        if (minX === Infinity) {
            // No geometry at all
            return { parsedWalls: walls, parsedElements: elems, parsedRooms: rms, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, w: 100, h: 100, pad: 10 }, unitScale: 1 };
        }

        const w = maxX - minX;
        const h = maxY - minY;
        const pad = Math.max(w, h) * 0.08;

        return {
            parsedWalls: walls,
            parsedElements: elems,
            parsedRooms: rms,
            bounds: { minX, minY, maxX, maxY, w, h, pad },
            unitScale: scale
        };
    }, [elements, rooms]);

    // ========================================================================
    // COORDINATE MAPPERS
    // ========================================================================
    const mapX = useCallback((x: number) => x - bounds.minX + bounds.pad, [bounds]);
    const mapY = useCallback((y: number) => bounds.maxY - y + bounds.pad, [bounds]); // Flip Y for SVG

    const svgW = bounds.w + bounds.pad * 2;
    const svgH = bounds.h + bounds.pad * 2;

    // ========================================================================
    // INTERACTION HANDLERS
    // ========================================================================
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setTransform(prev => ({
            ...prev,
            k: Math.max(0.1, Math.min(prev.k * (1 + delta), 30))
        }));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }, [isDragging]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const resetView = useCallback(() => setTransform({ x: 0, y: 0, k: 1 }), []);
    const zoomIn = useCallback(() => setTransform(prev => ({ ...prev, k: Math.min(prev.k * 1.3, 30) })), []);
    const zoomOut = useCallback(() => setTransform(prev => ({ ...prev, k: Math.max(prev.k / 1.3, 0.1) })), []);

    // Scale-aware sizes
    const wallThickness = unitScale === 1000 ? 0.15 : 150; // External wall visual
    const internalWallThickness = unitScale === 1000 ? 0.08 : 80;
    const fontSize = Math.max(bounds.w, bounds.h) * 0.025;
    const smallFontSize = fontSize * 0.7;
    const elementSize = Math.max(bounds.w, bounds.h) * 0.012;

    // Element counts per room (for summary) — MUST be before any conditional returns
    const roomElementCounts = useMemo(() => {
        const counts: Record<string, Record<string, number>> = {};
        parsedElements.forEach(el => {
            const room = el.room;
            if (!counts[room]) counts[room] = {};
            counts[room][el.type] = (counts[room][el.type] || 0) + 1;
        });
        return counts;
    }, [parsedElements]);

    // ========================================================================
    // EMPTY STATE (all hooks must be above this point!)
    // ========================================================================
    if (parsedWalls.length === 0 && parsedRooms.length === 0 && parsedElements.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 text-slate-500">
                <div className="text-center p-8">
                    <p className="text-lg font-semibold mb-2">No Geometry Extracted</p>
                    <p className="text-sm">The IFC file has been uploaded but no spatial data was extracted.</p>
                    <p className="text-xs mt-2 text-slate-400">Check that the server-side IFC Agent processed the file successfully.</p>
                </div>
            </div>
        );
    }

    // ========================================================================
    // RENDERING HELPERS (non-hooks, safe after early return)
    // ========================================================================
    const wallPath = (polygon: { x: number; y: number }[]) => {
        if (polygon.length < 2) return '';
        return polygon.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${mapX(p.x)} ${mapY(p.y)}`
        ).join(' ') + ' Z';
    };

    // ========================================================================
    // RENDER
    // ========================================================================
    return (
        <div className="relative w-full h-full overflow-hidden bg-white select-none" ref={containerRef}>
            {/* TOOLBAR */}
            <div className="absolute top-3 right-3 z-30 flex flex-col gap-1 bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow-lg p-1.5">
                <button onClick={zoomIn} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom In">
                    <ZoomIn size={16} />
                </button>
                <button onClick={zoomOut} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom Out">
                    <ZoomOut size={16} />
                </button>
                <div className="h-px bg-slate-200" />
                <button onClick={resetView} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Reset View">
                    <Maximize size={16} />
                </button>
                {onRoomRename && (
                    <>
                        <div className="h-px bg-slate-200" />
                        <button
                            onClick={() => setLabelMode(!labelMode)}
                            className={`p-1.5 rounded transition-colors ${labelMode ? 'bg-amber-100 text-amber-700' : 'hover:bg-slate-100 text-slate-600'}`}
                            title={labelMode ? 'Exit Label Mode' : 'Enter Label Mode (click rooms to rename)'}
                        >
                            <Tag size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* INFO BAR */}
            <div className="absolute top-3 left-3 z-30 bg-black/60 text-white text-[10px] px-3 py-1.5 rounded-lg pointer-events-none flex gap-3">
                <span>🏠 {parsedRooms.length} Rooms</span>
                <span>🧱 {parsedWalls.length} Walls</span>
                <span>📦 {parsedElements.length} Elements</span>
                <span className="opacity-60">Scroll: Zoom • Drag: Pan</span>
            </div>

            {/* LABEL MODE INDICATOR */}
            {labelMode && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
                    🏷️ Label Mode — Click a room to rename it
                </div>
            )}

            {/* TOOLTIP */}
            {tooltipData && (
                <div
                    className="absolute z-40 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none"
                    style={{ left: tooltipData.x + 15, top: tooltipData.y - 10 }}
                >
                    <div className="font-semibold" style={{ whiteSpace: 'pre-line' }}>{tooltipData.text}</div>
                    <div className="text-slate-300">{tooltipData.type}</div>
                </div>
            )}

            {/* RENAME DIALOG */}
            {renameTarget && (
                <div
                    className="absolute z-50 bg-white border-2 border-amber-500 rounded-lg shadow-xl p-3"
                    style={{ left: renameTarget.x, top: renameTarget.y }}
                >
                    <div className="text-xs text-slate-500 mb-1">Rename Room</div>
                    <input
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter' && renameValue.trim()) {
                                onRoomRename?.(renameTarget.id, renameValue.trim());
                                setRenameTarget(null);
                            }
                            if (e.key === 'Escape') setRenameTarget(null);
                        }}
                    />
                    <div className="flex gap-1 mt-1.5">
                        <button
                            className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded hover:bg-amber-600"
                            onClick={() => {
                                if (renameValue.trim()) {
                                    onRoomRename?.(renameTarget.id, renameValue.trim());
                                }
                                setRenameTarget(null);
                            }}
                        >Save</button>
                        <button
                            className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-300"
                            onClick={() => setRenameTarget(null)}
                        >Cancel</button>
                    </div>
                </div>
            )}

            {/* SVG CANVAS */}
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
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                }}
            >
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">

                    {/* LAYER 1: Room Fills */}
                    {parsedRooms.map(room => {
                        const d = wallPath(room.polygon);
                        const isHovered = hoveredRoom === room.id;
                        const color = getRoomColor(room.name);

                        return (
                            <g key={`room-${room.id}`}>
                                <path
                                    d={d}
                                    fill={color}
                                    fillOpacity={isHovered ? 0.7 : 0.4}
                                    stroke={isHovered ? '#3b82f6' : '#94a3b8'}
                                    strokeWidth={isHovered ? 2 : 0.5}
                                    strokeDasharray={isHovered ? 'none' : '4,4'}
                                    className="cursor-pointer transition-all duration-150"
                                    onMouseEnter={(e) => {
                                        setHoveredRoom(room.id);
                                        const counts = roomElementCounts[room.name] || {};
                                        const summary = Object.entries(counts).map(([t, c]) => `${c} ${t}`).join(', ');
                                        setTooltipData({
                                            x: e.clientX, y: e.clientY,
                                            text: `${room.name} (${room.area} m²)`,
                                            type: summary || 'No elements detected'
                                        });
                                    }}
                                    onMouseLeave={() => { setHoveredRoom(null); setTooltipData(null); }}
                                    onClick={(e) => {
                                        if (labelMode && onRoomRename) {
                                            e.stopPropagation();
                                            setRenameTarget({ id: room.id, name: room.name, x: e.clientX, y: e.clientY });
                                            setRenameValue(room.name);
                                        } else {
                                            onRoomClick?.(rooms.find(r => r.id === room.id) as any);
                                        }
                                    }}
                                />
                            </g>
                        );
                    })}

                    {/* LAYER 2: Walls (solid fill polygons) */}
                    {parsedWalls.map(wall => {
                        const d = wallPath(wall.polygon);
                        const isHovered = hoveredElement === wall.id;

                        // Compute wall length and thickness from polygon bounds
                        let wMinX = Infinity, wMinY = Infinity, wMaxX = -Infinity, wMaxY = -Infinity;
                        wall.polygon.forEach(p => {
                            if (p.x < wMinX) wMinX = p.x;
                            if (p.y < wMinY) wMinY = p.y;
                            if (p.x > wMaxX) wMaxX = p.x;
                            if (p.y > wMaxY) wMaxY = p.y;
                        });
                        const wW = wMaxX - wMinX;
                        const wH = wMaxY - wMinY;
                        const wallLengthMm = Math.max(wW, wH);
                        const wallThickMm = Math.min(wW, wH);
                        const wallLengthM = wallLengthMm / unitScale;
                        const wallHeightM = 2.4; // Standard UK residential ceiling height

                        // UK wall composition breakdown
                        let composition = '';
                        if (wall.isExternal) {
                            // Standard UK cavity wall
                            const totalThick = Math.round(wallThickMm / (unitScale / 1000));
                            const cavityWidth = Math.max(50, totalThick - 202); // 102mm outer + 100mm inner = 202mm leaves
                            composition = `102mm brick outer leaf · ${cavityWidth}mm cavity (insulated) · 100mm block inner leaf = ${totalThick}mm total`;
                        } else {
                            const totalThick = Math.round(wallThickMm / (unitScale / 1000));
                            if (totalThick <= 100) {
                                composition = `${totalThick}mm stud partition`;
                            } else {
                                composition = `${totalThick}mm blockwork partition`;
                            }
                        }

                        return (
                            <path
                                key={`wall-${wall.id}`}
                                d={d}
                                fill={isHovered ? '#3b82f6' : (wall.isExternal ? '#1e293b' : '#475569')}
                                fillOpacity={isHovered ? 0.6 : (wall.isExternal ? 0.9 : 0.75)}
                                stroke={wall.isExternal ? '#0f172a' : '#64748b'}
                                strokeWidth={wall.isExternal ? 1.5 : 0.5}
                                className="cursor-pointer transition-colors duration-100"
                                onMouseEnter={(e) => {
                                    setHoveredElement(wall.id);
                                    setTooltipData({
                                        x: e.clientX, y: e.clientY,
                                        text: `${wall.name} — ${wallLengthM.toFixed(2)}m long × ${wallHeightM}m high\n${composition}`,
                                        type: wall.isExternal ? 'External Wall' : 'Internal Partition'
                                    });
                                }}
                                onMouseLeave={() => { setHoveredElement(null); setTooltipData(null); }}
                            />
                        );
                    })}

                    {/* LAYER 3: Elements (doors, windows, sockets, etc.) */}
                    {parsedElements.filter(el => el.type !== 'wall' && el.type !== 'slab' && el.type !== 'roof').map(el => {
                        const cx = mapX(el.center.x);
                        const cy = mapY(el.center.y);
                        const color = ELEMENT_COLORS[el.type] || '#94a3b8';
                        const icon = ELEMENT_ICONS[el.type];
                        const isHovered = hoveredElement === el.id;
                        const size = elementSize;

                        // Compute bbox dimensions in SVG units
                        const bboxW = Math.abs(el.bbox[2] - el.bbox[0]);
                        const bboxH = Math.abs(el.bbox[3] - el.bbox[1]);
                        const doorWidth = Math.max(bboxW, bboxH); // Door leaf length
                        const wallThick = Math.min(bboxW, bboxH); // Wall thickness at opening
                        const isHorizontal = bboxW > bboxH; // Door orientation

                        // Windows: architectural double-line symbol
                        if (el.type === 'window') {
                            const x1 = mapX(el.bbox[0]);
                            const y1 = mapY(el.bbox[3]); // flip Y
                            return (
                                <g key={`el-${el.id}`}>
                                    {/* Window glass - filled rect */}
                                    <rect
                                        x={x1}
                                        y={y1}
                                        width={bboxW}
                                        height={bboxH}
                                        fill="#bae6fd"
                                        fillOpacity={isHovered ? 0.8 : 0.5}
                                        stroke="#0284c7"
                                        strokeWidth={isHovered ? 3 : 1.5}
                                        className="cursor-pointer"
                                        onMouseEnter={(e) => {
                                            setHoveredElement(el.id);
                                            const widthM = (doorWidth / unitScale).toFixed(2);
                                            setTooltipData({ x: e.clientX, y: e.clientY, text: `Window ${widthM}m`, type: `${el.room}` });
                                        }}
                                        onMouseLeave={() => { setHoveredElement(null); setTooltipData(null); }}
                                    />
                                    {/* Center glass line */}
                                    {isHorizontal ? (
                                        <line x1={x1} y1={y1 + bboxH / 2} x2={x1 + bboxW} y2={y1 + bboxH / 2}
                                            stroke="#0284c7" strokeWidth={0.5} />
                                    ) : (
                                        <line x1={x1 + bboxW / 2} y1={y1} x2={x1 + bboxW / 2} y2={y1 + bboxH}
                                            stroke="#0284c7" strokeWidth={0.5} />
                                    )}
                                </g>
                            );
                        }

                        // Doors: architectural door symbol (leaf + arc swing toward building center)
                        if (el.type === 'door') {
                            const x1 = mapX(el.bbox[0]);
                            const y1 = mapY(el.bbox[3]); // SVG top-left
                            const leafLen = doorWidth * 0.9;

                            // Building center in SVG coords for swing direction
                            const bldgCx = (bounds.w / 2) + bounds.pad;
                            const bldgCy = (bounds.h / 2) + bounds.pad;
                            const widthMm = Math.round(doorWidth / (unitScale / 1000));

                            // Determine which way to swing: toward room interior (building center)
                            const doorSvgCx = x1 + bboxW / 2;
                            const doorSvgCy = y1 + bboxH / 2;

                            let doorEl: React.ReactNode = null;

                            if (isHorizontal) {
                                // Door in a horizontal wall: leaf swings up or down
                                const swingDown = doorSvgCy < bldgCy; // swing toward center
                                const hingeSide = doorSvgCx < bldgCx ? 'left' : 'right';
                                const hx = hingeSide === 'left' ? x1 : x1 + bboxW;
                                const leafEndX = hingeSide === 'left' ? x1 + leafLen : x1 + bboxW - leafLen;
                                const arcEndY = swingDown ? doorSvgCy + leafLen : doorSvgCy - leafLen;
                                const sweep = (hingeSide === 'left' && swingDown) || (hingeSide === 'right' && !swingDown) ? 1 : 0;

                                doorEl = (
                                    <>
                                        <line x1={hx} y1={doorSvgCy} x2={leafEndX} y2={doorSvgCy}
                                            stroke={isHovered ? '#b45309' : '#92400e'} strokeWidth={isHovered ? 3 : 2} />
                                        <path
                                            d={`M ${leafEndX} ${doorSvgCy} A ${leafLen} ${leafLen} 0 0 ${sweep} ${hx} ${arcEndY}`}
                                            fill="none" stroke={isHovered ? '#b45309' : '#d97706'}
                                            strokeWidth={isHovered ? 2 : 1} strokeDasharray="8,4" />
                                    </>
                                );
                            } else {
                                // Door in a vertical wall: leaf swings left or right
                                const swingRight = doorSvgCx < bldgCx; // swing toward center
                                const hingeSide = doorSvgCy < bldgCy ? 'top' : 'bottom';
                                const hy = hingeSide === 'top' ? y1 : y1 + bboxH;
                                const leafEndY = hingeSide === 'top' ? y1 + leafLen : y1 + bboxH - leafLen;
                                const arcEndX = swingRight ? doorSvgCx + leafLen : doorSvgCx - leafLen;
                                const sweep = (hingeSide === 'top' && swingRight) || (hingeSide === 'bottom' && !swingRight) ? 0 : 1;

                                doorEl = (
                                    <>
                                        <line x1={doorSvgCx} y1={hy} x2={doorSvgCx} y2={leafEndY}
                                            stroke={isHovered ? '#b45309' : '#92400e'} strokeWidth={isHovered ? 3 : 2} />
                                        <path
                                            d={`M ${doorSvgCx} ${leafEndY} A ${leafLen} ${leafLen} 0 0 ${sweep} ${arcEndX} ${hy}`}
                                            fill="none" stroke={isHovered ? '#b45309' : '#d97706'}
                                            strokeWidth={isHovered ? 2 : 1} strokeDasharray="8,4" />
                                    </>
                                );
                            }

                            return (
                                <g key={`el-${el.id}`}
                                    className="cursor-pointer"
                                    onMouseEnter={(e) => {
                                        setHoveredElement(el.id);
                                        setTooltipData({ x: e.clientX, y: e.clientY, text: `Door ${widthMm}mm wide`, type: `${el.room}` });
                                    }}
                                    onMouseLeave={() => { setHoveredElement(null); setTooltipData(null); }}
                                >
                                    {/* Door opening gap in wall */}
                                    <rect x={x1 - 5} y={y1 - 5} width={bboxW + 10} height={bboxH + 10}
                                        fill="white" stroke="none" />
                                    {doorEl}
                                </g>
                            );
                        }

                        // All other elements: draw as colored circle with icon
                        return (
                            <g key={`el-${el.id}`}
                                className="cursor-pointer"
                                onMouseEnter={(e) => {
                                    setHoveredElement(el.id);
                                    setTooltipData({ x: e.clientX, y: e.clientY, text: el.name, type: `${el.type} • ${el.room}` });
                                }}
                                onMouseLeave={() => { setHoveredElement(null); setTooltipData(null); }}
                                onClick={() => onElementClick?.(elements.find(e => e.id === el.id) as any)}
                            >
                                <circle
                                    cx={cx} cy={cy} r={size}
                                    fill={isHovered ? color : 'white'}
                                    fillOpacity={0.9}
                                    stroke={color}
                                    strokeWidth={isHovered ? 2 : 1}
                                />
                                {icon && (
                                    <text
                                        x={cx} y={cy}
                                        textAnchor="middle" dominantBaseline="central"
                                        fontSize={size * 1.2}
                                        style={{ pointerEvents: 'none' }}
                                    >{icon}</text>
                                )}
                            </g>
                        );
                    })}

                    {/* LAYER 4: Room Labels */}
                    {parsedRooms.map(room => {
                        const cx = mapX(room.center.x);
                        const cy = mapY(room.center.y);
                        const counts = roomElementCounts[room.name] || {};
                        const countStr = Object.entries(counts)
                            .filter(([t]) => ['door', 'window', 'light', 'socket', 'sanitary'].includes(t))
                            .map(([t, c]) => `${ELEMENT_ICONS[t] || t} ${c}`)
                            .join('  ');

                        const hasCost = room.totalValue && room.totalValue > 0;
                        const costStr = hasCost ? `£${room.totalValue!.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                        const lines = 1 + 1 + (hasCost ? 1 : 0) + (countStr ? 1 : 0); // name + area + cost? + elements?
                        const labelHeight = fontSize * (lines * 1.1 + 0.3);

                        return (
                            <g key={`label-${room.id}`} style={{ pointerEvents: 'none' }}>
                                {/* Background for readability */}
                                <rect
                                    x={cx - fontSize * 3.5}
                                    y={cy - fontSize * 1}
                                    width={fontSize * 7}
                                    height={labelHeight}
                                    rx={fontSize * 0.3}
                                    fill="white"
                                    fillOpacity={0.85}
                                />
                                {/* Room Name */}
                                <text
                                    x={cx} y={cy}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={fontSize}
                                    fontWeight="700"
                                    fill="#0f172a"
                                    style={{ fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >{room.name}</text>
                                {/* Area */}
                                <text
                                    x={cx} y={cy + fontSize * 1.1}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={smallFontSize}
                                    fill="#64748b"
                                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                                >{room.area} m²</text>
                                {/* Cost */}
                                {hasCost && (
                                    <text
                                        x={cx} y={cy + fontSize * 2.1}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fontSize={smallFontSize}
                                        fontWeight="600"
                                        fill="#059669"
                                        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                                    >{costStr}</text>
                                )}
                                {/* Element Summary */}
                                {countStr && (
                                    <text
                                        x={cx} y={cy + fontSize * (hasCost ? 3.0 : 2.0)}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fontSize={smallFontSize * 0.85}
                                        fill="#94a3b8"
                                        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                                    >{countStr}</text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* LEGEND */}
            <div className="absolute bottom-3 right-3 z-30 bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow-lg p-2 text-[10px] grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-800" /> External Wall</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-500" /> Internal Wall</div>
                <div className="flex items-center gap-1"><div className="w-3 h-1 rounded-sm bg-sky-500" /> Window</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-amber-500" /> Door</div>
                <div className="flex items-center gap-1">💡 Light</div>
                <div className="flex items-center gap-1">🔌 Socket</div>
            </div>
        </div>
    );
}
