
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContextualTooltip from "./contextual-tooltip";
import ExtractedElementsPanel from "./extracted-elements-panel";
import { IfcPlanViewer } from "./ifc-plan-viewer";

interface JobFile {
    id: string;
    filename: string;
    originalName: string;
    fileUrl: string;
    fileType: string;
    extractionStatus: string | null;
    extractionError: string | null;
    createdAt: string;
}

interface DrawingViewerProps {
    file: JobFile;
    jobId: string;
    smartElements?: any[];
    dbElements?: any[];
    dbRooms?: any[];
    onNavigateToElements?: () => void;
}

interface DrawingViewerComponentProps {
    fileUrl: string;
    fileType: string;
    smartElements?: any[];
    dbElements?: any[];  // Raw extracted elements from server
    dbRooms?: any[];     // Raw rooms from server (with geometry)
    onElementClick?: (element: any) => void;
    onRoomRename?: (id: string, name: string) => void;
    fileId?: string;
    onNavigateToElements?: () => void;
}

// ...

function DrawingViewerComponent({ fileUrl, fileType, smartElements = [], dbElements = [], dbRooms = [], onElementClick, onRoomRename, fileId, onNavigateToElements }: DrawingViewerComponentProps) {
    // ... (keep consts)
    const safeFileType = fileType || '';
    const safeFileUrl = fileUrl || '';
    const isImage = safeFileType.startsWith('image/') || safeFileUrl.toLowerCase().endsWith('.svg');
    const isPDF = safeFileType === 'application/pdf';
    const isIFC = safeFileUrl.toLowerCase().endsWith('.ifc');
    const isSVG = safeFileUrl.toLowerCase().endsWith('.svg');

    const [selectedElement, setSelectedElement] = useState<string | null>(null);

    // IFC: Use lightweight SVG plan viewer with server-extracted data
    // No WebGL, no Three.js, no browser freezing
    if (isIFC) {
        // Build room list from dbRooms (from rooms table, includes geometry polygons)
        const viewerRooms = (dbRooms || []).map((r: any, i: number) => {
            let geometry = r.geometry;
            let bbox = r.bbox;
            try { if (typeof geometry === 'string') geometry = JSON.parse(geometry); } catch { geometry = null; }
            try { if (typeof bbox === 'string') bbox = JSON.parse(bbox); } catch { bbox = null; }
            return {
                id: r.id || `room-${i}`,
                name: r.name || `Room ${i + 1}`,
                area: r.area || r.totalValue || '0',
                geometry,
                bbox
            };
        });

        // Build elements from dbElements (from extractedElements table)
        const viewerElements = (dbElements || []).map((el: any) => {
            let bbox = el.bbox;
            let geometry = el.geometry;
            try { if (typeof bbox === 'string') bbox = JSON.parse(bbox); } catch { bbox = null; }
            try { if (typeof geometry === 'string') geometry = JSON.parse(geometry); } catch { geometry = null; }
            return {
                ...el,
                bbox,
                geometry
            };
        });

        return (
            <div className="flex-1 h-full min-h-[500px] flex flex-col bg-white border rounded-lg overflow-hidden shadow-sm">
                <div className="p-2 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex justify-between items-center px-4 shrink-0 h-12">
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm text-slate-700">Architectural Plan View</span>
                        <span className="text-[10px] text-slate-500">Server-Side IFC Intelligence • SVG Renderer</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ Extracted
                        </span>
                    </div>
                </div>

                <div className="flex-1 relative overflow-hidden">
                    <IfcPlanViewer
                        elements={viewerElements}
                        rooms={viewerRooms}
                        onElementClick={onElementClick}
                        onRoomRename={onRoomRename}
                    />
                </div>
            </div>
        );
    }


    // Filter elements by page (if applicable) - for IFC assume page 1
    const currentPage = 1;
    const pageElements = smartElements.filter(el => el.page === currentPage || (!el.page && currentPage === 1));

    // DEBUG: Log elements received
    console.log(`[DrawingViewer] Received ${smartElements.length} elements. Displaying ${pageElements.length} on page 1.`);
    if (pageElements.length > 0) {
        console.log('[DrawingViewer] Sample Element:', pageElements[0]);
    }

    // Prepare Elements with Safe Parsing
    const parsedElements = pageElements.map(el => {
        let bbox = el.bbox;
        if (typeof bbox === 'string') {
            try { bbox = JSON.parse(bbox); } catch (e) { bbox = null; }
        }
        let geometry = el.geometry;
        if (typeof geometry === 'string') {
            try { geometry = JSON.parse(geometry); } catch (e) { geometry = null; }
        }
        return { ...el, bbox, geometry };
    });

    // Calculate Global Bounds for Normalization
    let globalMinX = Infinity, globalMinY = Infinity, globalMaxX = -Infinity, globalMaxY = -Infinity;
    parsedElements.forEach(el => {
        if (el.bbox && Array.isArray(el.bbox) && el.bbox.length === 4) {
            const [minX, minY, maxX, maxY] = el.bbox;
            if (minX < globalMinX) globalMinX = minX;
            if (minY < globalMinY) globalMinY = minY;
            if (maxX > globalMaxX) globalMaxX = maxX;
            if (maxY > globalMaxY) globalMaxY = maxY;
        }
    });

    // Add padding (5%)
    const width = globalMaxX - globalMinX;
    const height = globalMaxY - globalMinY;
    const paddingX = width * 0.05;
    const paddingY = height * 0.05;

    globalMinX -= paddingX;
    globalMinY -= paddingY;
    globalMaxX += paddingX;
    globalMaxY += paddingY;

    const totalW = globalMaxX - globalMinX;
    const totalH = globalMaxY - globalMinY;

    const getOverlayStyle = (bbox: number[], geometry: any[]) => {
        if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
            return {
                left: '50%', top: '50%', width: '10px', height: '10px'
            };
        }
        const [minX, minY, maxX, maxY] = bbox;

        // Position Logic (Global)
        let left = ((minX - globalMinX) / totalW) * 100;
        // FLIP Y-AXIS Logic: Top of div corresponds to MaxY of element
        let top = 100 - (((maxY - globalMinY) / totalH) * 100);
        let w = ((maxX - minX) / totalW) * 100;
        let h = ((maxY - minY) / totalH) * 100;

        // Safety
        if (!Number.isFinite(left)) left = 0;
        if (!Number.isFinite(top)) top = 0;
        if (!Number.isFinite(w) || w === 0) w = 1;
        if (!Number.isFinite(h) || h === 0) h = 1;

        // Clip-Path Logic (Local Shape)
        let clipPath = undefined;
        if (geometry && Array.isArray(geometry) && geometry.length > 2) {
            const points = geometry.map((p: any) => {
                // Local X %: (x - minX) / width
                const px = ((p.x - minX) / (maxX - minX)) * 100;
                // Local Y %: Top is 0% (maxY), Bottom is 100% (minY)
                // So (maxY - y) / height
                const py = ((maxY - p.y) / (maxY - minY)) * 100;
                return `${px.toFixed(1)}% ${py.toFixed(1)}%`;
            }).join(', ');
            clipPath = `polygon(${points})`;
        }

        return {
            left: `${left}%`,
            top: `${top}%`,
            width: `${w}%`,
            height: `${h}%`,
            clipPath: clipPath,
            zIndex: 10
        };
    };

    // Helper to determine element style and tooltip content based on Prompt Rules
    const getElementProps = (el: any) => {
        let type = (el.type || el.elementType || '').toLowerCase();
        let label = el.label || el.description || '';
        let colorClass = "border-slate-500 bg-slate-500/10";

        // 2. External Walls (Hatched - Pattern applied in render loop)
        if (type.includes('wall') && (label.toLowerCase().includes('external') || el.isGlobal)) {
            // High contrast white fill with black border (pattern overlay added in render)
            colorClass = "bg-white border-2 border-black opacity-100 z-20";
            label = "External Cavity Wall";
        }
        // 3. Internal Partition Walls (Solid Black)
        else if (type.includes('wall')) {
            colorClass = "bg-black border border-black opacity-100 z-20";
            label = "Internal Partition Wall";
        }
        // 4. Windows (Clean Blue Box)
        else if (type.includes('window')) {
            colorClass = "bg-blue-50 border-2 border-blue-600 z-30";
            label = `Window (${el.width || 'Standard'})`;
        }
        // 5. Doors (Simple Outline)
        else if (type.includes('door')) {
            colorClass = "border border-black bg-transparent z-30";
            label = `Door (${el.width || 'Standard'})`;
        }
        // 1. Rooms (Transparent + Text)
        else if (type === 'room') {
            // Make transparent so grid shows through, just outline
            colorClass = "bg-transparent border border-gray-200 hover:border-gray-400 cursor-pointer z-10";
        }

        return { colorClass, label };
    };

    const renderTooltipContent = (el: any) => {
        const type = (el.type || el.elementType || '').toLowerCase();
        const label = el.label || el.description;

        // 2. External Walls Spec
        if (type.includes('wall') && label.toLowerCase().includes('external')) {
            return (
                <div className="p-3 space-y-2 min-w-[200px]">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                        <span className="font-bold text-sm">External Cavity Wall</span>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                        <div className="flex justify-between"><span>Ext. Leaf:</span> <span className="text-foreground">102mm Brick</span></div>
                        <div className="flex justify-between"><span>Cavity:</span> <span className="text-foreground">140mm Insul.</span></div>
                        <div className="flex justify-between"><span>Int. Leaf:</span> <span className="text-foreground">100mm Block</span></div>
                        <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>Total:</span> <span className="text-foreground">342mm</span></div>
                    </div>
                </div>
            );
        }
        // 3. Internal Walls Spec
        if (type.includes('wall')) {
            return (
                <div className="p-3 space-y-2 min-w-[180px]">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        <span className="font-bold text-sm">Internal Partition</span>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                        <div className="flex justify-between"><span>Constr:</span> <span className="text-foreground">75mm Stud</span></div>
                        <div className="flex justify-between"><span>Board:</span> <span className="text-foreground">12.5mm Plaster</span></div>
                        <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>Total:</span> <span className="text-foreground">100mm</span></div>
                    </div>
                </div>
            );
        }
        // 1. Room Spec
        if (type === 'room') {
            // Automatic MEP & Finish Calculations
            let perimeter = 0;
            let wallArea = 0;
            let skirting = 0;

            if (el.geometry && Array.isArray(el.geometry) && el.geometry.length > 2) {
                const pts = el.geometry;
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i];
                    const p2 = pts[(i + 1) % pts.length];
                    perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
                }
                // Unit Detection: If perimeter is huge (>200), it's likely MM. Convert to M.
                if (perimeter > 200) perimeter /= 1000;

                skirting = perimeter;
                wallArea = perimeter * 2.4; // 2.4m Ceiling Height
            }

            return (
                <div className="p-3 space-y-2 min-w-[220px]">
                    <div className="font-bold text-lg text-amber-500 uppercase tracking-widest text-center border-b border-amber-500/30 pb-2">{label}</div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs py-1">
                        <div className="text-muted-foreground text-right">Floor Area:</div>
                        <div className="font-bold text-foreground">{parseFloat(String(el.quantity || "0")).toFixed(1)} m²</div>

                        <div className="text-muted-foreground text-right">Perimeter:</div>
                        <div className="font-mono">{perimeter.toFixed(1)} m</div>

                        <div className="text-muted-foreground text-right">Est. Skirting:</div>
                        <div className="font-mono text-emerald-600 font-bold">{skirting.toFixed(1)} m</div>

                        <div className="text-muted-foreground text-right">Est. Wall Paint:</div>
                        <div className="font-mono text-blue-600 font-bold">{wallArea.toFixed(1)} m²</div>
                    </div>

                    <div className="text-[10px] text-center text-muted-foreground bg-secondary/50 rounded px-2 py-1 mt-1 border border-secondary uppercase tracking-wider font-semibold hover:bg-secondary cursor-pointer hover:text-foreground transition-colors">
                        Click to Rename
                    </div>
                </div>
            );
        }

        // Generic Fallback
        return (
            <div className="p-2 space-y-1">
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground capitalize">{type}</p>
                {el.quantity && <p className="text-xs">Qty: {el.quantity}</p>}
            </div>
        );
    };

    if (isIFC || isSVG) {
        return (
            <div className="relative w-full h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex flex-col">
                <div className="absolute top-4 left-4 z-10 bg-slate-900/90 p-3 rounded-lg backdrop-blur-md shadow-xl border border-slate-700 w-64">
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4" />
                        Architect Plan View
                    </h3>
                    <div className="text-[10px] text-amber-500 mb-2 font-mono border-b border-slate-700 pb-2">
                        {smartElements.length} Elements | Net Area: {parsedElements.filter(e => e.type === 'room').reduce((acc, r) => acc + (parseFloat(r.quantity) || 0), 0).toFixed(1)} m²
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="flex items-center gap-1.5 text-stone-300"><div className="w-3 h-3 bg-stone-300 border border-stone-800"></div> Ext. Wall</div>
                        <div className="flex items-center gap-1.5 text-stone-300"><div className="w-3 h-3 bg-stone-500 border border-stone-700"></div> Int. Wall</div>
                        <div className="flex items-center gap-1.5 text-stone-300"><div className="w-3 h-3 bg-cyan-200/40 border border-cyan-400"></div> Window</div>
                        <div className="flex items-center gap-1.5 text-stone-300"><div className="w-3 h-3 bg-transparent border-2 border-dashed border-amber-500/50"></div> Room</div>
                    </div>
                </div>

                <div className="flex-1 relative bg-white p-8 overflow-hidden flex items-center justify-center">
                    {/* Placeholder for real IFC Viewer */}
                    {isIFC && (
                        <div
                            className="relative shadow-xl border-2 border-slate-900 bg-white"
                            style={{
                                width: '90%',
                                aspectRatio: `${totalW} / ${totalH}`,
                                maxHeight: '90%'
                            }}
                        >
                            {/* Paper Grid (Subtle) */}
                            <div className="absolute inset-0 opacity-20" style={{
                                backgroundImage: `linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)`,
                                backgroundSize: '20px 20px'
                            }}></div>

                            {/* Render Elements */}
                            {parsedElements.map((el: any, idx: number) => {
                                const style = getOverlayStyle(el.bbox, el.geometry);
                                const { colorClass, label } = getElementProps(el);

                                // Specific render for Patterned Walls
                                const isExternal = label.includes('External');
                                const customStyle = isExternal ? {
                                    backgroundImage: `repeating-linear-gradient(45deg, #ddd, #ddd 2px, transparent 2px, transparent 6px)`
                                } : {};

                                return (
                                    <div
                                        key={el.id}
                                        className={`absolute transition-all duration-200 flex items-center justify-center`}
                                        style={{ ...style, ...customStyle }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onElementClick) onElementClick(el);
                                        }}
                                    >
                                        <ContextualTooltip content={renderTooltipContent(el)} className="w-full h-full block">
                                            <div className={`w-full h-full ${colorClass}`}>

                                                {/* Room Labels - Only show if room */}
                                                {el.type === 'room' && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                                                        <span className="text-[12px] font-bold text-black uppercase tracking-widest">{el.label}</span>
                                                        <span className="text-[10px] text-gray-600 font-mono mt-0.5">{parseFloat(String(el.quantity || "0")).toFixed(1)} m²</span>
                                                    </div>
                                                )}

                                            </div>
                                        </ContextualTooltip>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // PDF / Image View (Untouched Logic mostly, just enhanced styling)
    return (
        <div className="relative w-full h-[600px] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            {isImage ? (
                <img src={fileUrl} alt="Drawing" className="w-full h-full object-contain" />
            ) : (
                <iframe src={fileUrl} className="w-full h-full" title="PDF Viewer" />
            )}

            {pageElements.map((el, idx) => {
                const { colorClass } = getElementProps(el);
                let className = `absolute border-2 transition-all cursor-pointer ${colorClass} `;
                if (selectedElement === el.id) className += "ring-2 ring-offset-2 ring-blue-600 z-20 ";

                return (
                    <ContextualTooltip key={el.id} content={renderTooltipContent(el)}>
                        <div
                            key={`${el.id}-${idx}`}
                            className={className}
                            style={getOverlayStyle(el.bbox)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElement(el.id);
                                if (onElementClick) onElementClick(el);
                            }}
                        />
                    </ContextualTooltip>
                );
            })}
        </div>
    );
}

function BoxIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22v-9" />
        </svg>
    )
}

export default function DrawingViewer(props: DrawingViewerProps) {
    const { file, jobId, smartElements, dbElements, dbRooms, onNavigateToElements } = props;
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const handleRoomClick = async (el: any) => {
        // Only handle rooms
        const isRoom = typeof el.id === 'string' && el.id.startsWith('room-') ||
            (el.type && el.type.includes('room')) ||
            (el.elementType && el.elementType.includes('room'));

        if (!isRoom) return;

        let realId = el.id.toString();
        if (realId.startsWith('room-')) {
            realId = realId.replace('room-', '');
        }

        const currentName = el.name || el.label || el.description || "Room";
        const newName = window.prompt("Enter new room name:", currentName);

        if (newName && newName !== currentName) {
            handleDirectRename(realId, newName);
        }
    };

    // NEW: Direct Rename (Bypasses Prompt)
    const handleDirectRename = async (realId: string, newName: string) => {
        console.log(`Renaming Room ID: "${realId}" to "${newName}"`);

        // Encode ID to handle IFC GlobalIds which contain special chars like '$'
        const safeId = encodeURIComponent(realId);
        let successCount = 0;
        let errors: string[] = [];

        try {
            // 1. Try Extracted Elements Table
            try {
                const res1 = await fetch(`/api/extracted-elements/${safeId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: newName, roomName: newName })
                });
                if (res1.ok) successCount++;
                else errors.push(`Element: ${res1.status}`);
            } catch (e) {
                console.warn("Element update failed:", e);
                errors.push("Element: Network Error");
            }

            // 2. Try Rooms Table
            try {
                const res2 = await fetch(`/api/rooms/${safeId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
                if (res2.ok) successCount++;
                else errors.push(`Room: ${res2.status}`);
            } catch (e) {
                console.warn("Room update failed:", e);
                errors.push("Room: Network Error");
            }

            // Evaluation
            if (successCount > 0) {
                queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/rooms`] });
                queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/elements`] });
                toast({ title: "Renamed", description: `Updated to ${newName}` });
            } else {
                console.error("Rename failed completely", errors);
                alert(`Failed to rename. Server Errors: ${errors.join(", ")}`);
            }
        } catch (e: any) {
            console.error("Critical error renaming room", e);
            alert(`Error renaming room: ${e.message}`);
        }
    }

    return (
        <DrawingViewerComponent
            fileUrl={file.fileUrl}
            fileType={file.fileType}
            smartElements={smartElements}
            dbElements={dbElements}
            dbRooms={dbRooms}
            onElementClick={handleRoomClick}
            onRoomRename={handleDirectRename}
            fileId={file.id}
            onNavigateToElements={onNavigateToElements}
        />
    );
}
