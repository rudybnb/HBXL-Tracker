
import React, { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// IFC viewers removed — not needed for room management + DXF scanning workflow
// import { ProfessionalIFCViewer } from '@/components/professional-ifc-viewer-final-2d';
// import { UploadIfc } from '@/components/upload-ifc';
// import { SimpleIFCViewer } from '@/components/simple-ifc-viewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Save, Undo, Lock, Unlock, ArrowLeft, Layers, Box, Pencil, Check, X, FileUp, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import * as THREE from 'three';  // Not needed without IFC viewer

// DB Room Interface
interface Room {
    id: string;
    name: string;
    jobId: string;
    area: string;
    perimeter: string;
    geometry: any; // Legacy
    polygon: string; // JSON string of {x,y}[]
    isLocked: boolean;
    fittings: string | null; // JSON string
    fittingsSource: string | null;
    source: string | null; // "IFC8000" | "MANUAL" | null
    floor: string | null;
    externalRoomKey: string | null;
}

export default function RoomBuilder() {
    const [match, params] = useRoute("/jobs/:jobId/room-builder");
    const jobId = params?.jobId;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeTab, setActiveTab] = useState<'architect' | 'qs' | 'tender'>('architect'); // NEW: Workflow State
    const [currentPoints, setCurrentPoints] = useState<{ x: number, y: number }[]>([]);
    const [roomName, setRoomName] = useState("");
    const [tempArea, setTempArea] = useState(0);
    const [internalSliceHeight, setInternalSliceHeight] = useState(1.2); // Slider UI
    const [committedSliceHeight, setCommittedSliceHeight] = useState(1.2);
    const [showUpload, setShowUpload] = useState(false); // NEW: Allow re-uploading
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d'); // Passed to Viewer
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const svgContainerRef = useRef<HTMLDivElement>(null);

    // SVG State
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [svgViewBox, setSvgViewBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [viewerCrashed, setViewerCrashed] = useState(false); // NEW: Crash Guard
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    // DXF Scanner State
    const [dxfFile, setDxfFile] = useState<File | null>(null);
    const [scanResult, setScanResult] = useState<any>(null);
    const [isScanning, setIsScanning] = useState(false);

    // CRASH GUARD: Listen for async 3D loop errors that ErrorBoundary misses
    useEffect(() => {
        const handleAsyncError = (event: ErrorEvent | PromiseRejectionEvent) => {
            const msg = (event instanceof ErrorEvent) ? event.message : (event.reason?.message || String(event.reason));
            if (msg && (msg.includes("toArray") || msg.includes("openbim") || msg.includes("WEBGL"))) {
                console.warn("🚨 3D Viewer Async Crash Detected:", msg);
                setViewerCrashed(true);
            }
        };

        window.addEventListener('error', handleAsyncError);
        window.addEventListener('unhandledrejection', handleAsyncError);
        return () => {
            window.removeEventListener('error', handleAsyncError);
            window.removeEventListener('unhandledrejection', handleAsyncError);
        };
    }, []);



    // Queries
    const { data: job } = useQuery({
        queryKey: [`/api/jobs/${jobId}`],
        enabled: !!jobId
    });
    // console.log("🛠️ Room Builder Job Data:", job); // DEBUG

    // INTELLIGENT FILE SELECTION: Prioritize SVG/DXF, else take newest
    const activeFile = React.useMemo(() => {
        if (!job || !job.files || job.files.length === 0) return null;

        // Sort all files by ID descending (newest first)
        const sorted = [...job.files].sort((a: any, b: any) => b.id - a.id);

        // Find the newest supported file (IFC, DXF, SVG)
        const newestSupported = sorted.find((f: any) =>
            f.fileUrl.toLowerCase().endsWith('.ifc') ||
            f.fileUrl.toLowerCase().endsWith('.dxf') ||
            f.fileUrl.toLowerCase().endsWith('.svg')
        );

        return newestSupported || sorted[0];
    }, [job]);

    const fileUrl = activeFile?.fileUrl;

    // Fetch SVG or DXF if needed
    useEffect(() => {
        if (!fileUrl) return;

        const isSvg = fileUrl.toLowerCase().endsWith('.svg');
        const isDxf = fileUrl.toLowerCase().endsWith('.dxf');

        if (isSvg || isDxf) {
            // Cache-bust to ensure fresh content
            fetch(`${fileUrl}?t=${Date.now()}`)
                .then(res => res.text())
                .then(text => {
                    if (isSvg) {
                        // Fix black background from server agent to transparent or white for UI
                        // AND invert line colors for visibility on white background
                        const cleanText = text
                            .replace(/fill="#0b0f19"/g, 'fill="#ffffff"')   // Background: Black -> White
                            .replace(/stroke="white"/g, 'stroke="#334155"') // Lines: White -> Dark Slate
                            .replace(/stroke="cyan"/g, 'stroke="#0ea5e9"')  // Polylines: Cyan -> Blue
                            .replace(/stroke="yellow"/g, 'stroke="#ea580c"')// Circles: Yellow -> Orange
                            .replace(/fill="lime"/g, 'fill="#15803d"');     // Text: Lime -> Green
                        setSvgContent(cleanText);
                        const match = text.match(/viewBox="([^"]+)"/);
                        if (match) {
                            const parts = match[1].split(' ').map(Number);
                            setSvgViewBox({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
                        }
                    } else if (isDxf) {
                        import('@/lib/dxf-converter').then(({ dxfToSvg }) => {
                            const result = dxfToSvg(text);
                            if (result) {
                                setSvgContent(result.svg);
                                setSvgViewBox(result.viewBox);
                            }
                        });
                    }
                })
                .catch(err => console.error("Failed to load Plan", err));
        }
    }, [fileUrl]);

    const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
        queryKey: [`/api/rooms`, { jobId }],
        queryFn: async () => {
            const res = await fetch(`/api/rooms?jobId=${jobId}`);
            if (!res.ok) throw new Error("Failed to fetch rooms");
            return res.json();
        },
        enabled: !!jobId
    });

    // Mutations
    const createRoomMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create room");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/rooms`, { jobId }] });
            toast({ title: "Room Created", description: `${roomName} saved successfully.` });
            resetDrawing();
        }
    });

    const deleteRoomMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete room");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/rooms`, { jobId }] });
            toast({ title: "Room Deleted" });
        }
    });

    const uploadFileMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`/api/jobs/${jobId}/files`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Upload failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            toast({ title: "Floor Plan Uploaded", description: "You can now define rooms.", variant: "default" });
            setShowUpload(false);
        },
        onError: (err: any) => {
            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        }
    });

    const updateRoomMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string, name: string }) => {
            const res = await fetch(`/api/rooms/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error("Failed to update room");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/rooms`, { jobId }] });
            toast({ title: "Room Updated", description: "Name saved." });
            setEditingRoomId(null);
        }
    });

    // DXF Scan Status
    const { data: dxfStatus } = useQuery({
        queryKey: [`/api/jobs/${jobId}/dxf-status`],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/dxf-status`);
            if (!res.ok) throw new Error("Failed to check DXF status");
            return res.json();
        },
        enabled: !!jobId
    });

    // DXF Scan Handler
    const handleDxfScan = async () => {
        if (!dxfFile || !jobId) return;
        setIsScanning(true);
        setScanResult(null);

        try {
            const formData = new FormData();
            formData.append('file', dxfFile);

            const res = await fetch(`/api/jobs/${jobId}/scan-dxf`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'DXF scan failed');
            }

            setScanResult(data);
            toast({
                title: "DXF Scan Complete",
                description: `Found ${data.total_matched} fittings, assigned ${data.total_assigned} to ${data.rooms_updated} rooms.`
            });

            // Refresh rooms and DXF status
            queryClient.invalidateQueries({ queryKey: [`/api/rooms`, { jobId }] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/dxf-status`] });
        } catch (error: any) {
            console.error("DXF Scan Error:", error);
            toast({
                title: "DXF Scan Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsScanning(false);
        }
    };

    // -------------------------------------------------------------------------
    // GEOMETRY HELPERS
    // -------------------------------------------------------------------------
    const calculateArea = (points: { x: number, y: number }[]) => {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    };

    const calculatePerimeter = (points: { x: number, y: number }[]) => {
        if (points.length < 2) return 0;
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }
        return perimeter;
    };

    // -------------------------------------------------------------------------
    // CANVAS INTERACTION
    // -------------------------------------------------------------------------

    // Convert Mouse to World (assuming Y=0 plane for now in 3D, or customized cut plane)
    // The viewer uses Y-Up. 2D Plan view usually looks down Y axis.
    const getPointOnFloor = (e: React.MouseEvent): { x: number, y: number } | null => {

        // SVG MODE - 2D MAPPING
        if (svgContent && svgViewBox && svgContainerRef.current) {
            const rect = svgContainerRef.current.getBoundingClientRect();

            // Calculate scale to maintain aspect ratio (contain)
            const scaleX = rect.width / svgViewBox.w;
            const scaleY = rect.height / svgViewBox.h;
            const scale = Math.min(scaleX, scaleY);

            // Centering offsets
            const renderW = svgViewBox.w * scale;
            const renderH = svgViewBox.h * scale;
            const offsetX = (rect.width - renderW) / 2;
            const offsetY = (rect.height - renderH) / 2;

            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;

            // Map back to SVG ViewBox coords
            const svgX = svgViewBox.x + (clientX - offsetX) / scale;
            const svgY = svgViewBox.y + (clientY - offsetY) / scale;

            return { x: svgX, y: svgY };
        }

        // 3D mode fallback (IFC viewer not available in production build)
        return null;
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const pt = getPointOnFloor(e);
        if (pt) {
            const newPoints = [...currentPoints, pt];
            setCurrentPoints(newPoints);
            setTempArea(calculateArea(newPoints));
        }
    };

    const handleUndo = () => {
        const newPoints = [...currentPoints];
        newPoints.pop();
        setCurrentPoints(newPoints);
        setTempArea(calculateArea(newPoints));
    };

    const handleSave = () => {
        if (currentPoints.length < 3) {
            toast({ title: "Invalid Room", description: "Need at least 3 points", variant: "destructive" });
            return;
        }
        if (!roomName) {
            toast({ title: "Missing Name", description: "Please name the room", variant: "destructive" });
            return;
        }

        const area = calculateArea(currentPoints).toFixed(2);
        const perimeter = calculatePerimeter(currentPoints).toFixed(2);

        // Use the new simplified columns
        createRoomMutation.mutate({
            jobId,
            name: roomName,
            area,
            perimeter,
            polygon: JSON.stringify(currentPoints),
            geometry: JSON.stringify(currentPoints), // Backwards compat for viewer
            isLocked: true // Lock by default when manually created
        });
    };

    const resetDrawing = () => {
        setIsDrawing(false);
        setCurrentPoints([]);
        setRoomName("");
        setTempArea(0);
    };

    // -------------------------------------------------------------------------
    // RENDER LOOP (Canvas Overlay)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const animate = () => {
            const canvas = canvasRef.current;

            // SVG RENDERER LOOP
            if (canvas && svgContent && svgViewBox && svgContainerRef.current) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Match dimensions
                    const rect = svgContainerRef.current.getBoundingClientRect();
                    canvas.width = rect.width;
                    canvas.height = rect.height;

                    // Calculate mapping vars
                    const scaleX = rect.width / svgViewBox.w;
                    const scaleY = rect.height / svgViewBox.h;
                    const scale = Math.min(scaleX, scaleY);

                    const renderW = svgViewBox.w * scale;
                    const renderH = svgViewBox.h * scale;
                    const offsetX = (rect.width - renderW) / 2;
                    const offsetY = (rect.height - renderH) / 2;

                    const mapX = (val: number) => (val - svgViewBox.x) * scale + offsetX;
                    const mapY = (val: number) => (val - svgViewBox.y) * scale + offsetY;

                    // Draw Existing Rooms
                    rooms.forEach(room => {
                        try {
                            const pts = JSON.parse(room.polygon || room.geometry);
                            if (pts.length > 2) {
                                ctx.beginPath();
                                ctx.fillStyle = 'rgba(245, 158, 11, 0.3)'; // Amber
                                ctx.strokeStyle = 'rgba(245, 158, 11, 1)';
                                ctx.lineWidth = 2;

                                ctx.moveTo(mapX(pts[0].x), mapY(pts[0].y));
                                for (let i = 1; i < pts.length; i++) ctx.lineTo(mapX(pts[i].x), mapY(pts[i].y));
                                ctx.closePath();
                                ctx.fill();
                                ctx.stroke();

                                // Label
                                const cx = pts.reduce((sum: number, p: any) => sum + p.x, 0) / pts.length;
                                const cy = pts.reduce((sum: number, p: any) => sum + p.y, 0) / pts.length;
                                ctx.fillStyle = 'black';
                                ctx.font = 'bold 12px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.fillText(room.name, mapX(cx), mapY(cy));
                                ctx.font = '10px sans-serif';
                                ctx.fillStyle = '#666';
                                ctx.fillText(`${room.area}m²`, mapX(cx), mapY(cy) + 14);
                            }
                        } catch (e) { }
                    });

                    // Draw Current Drawing
                    if (isDrawing && currentPoints.length > 0) {
                        ctx.beginPath();
                        ctx.strokeStyle = '#2563EB';
                        ctx.lineWidth = 3;
                        ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';

                        currentPoints.forEach((pt, i) => {
                            const x = mapX(pt.x);
                            const y = mapY(pt.y);
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);

                            // Vertex
                            ctx.fillStyle = 'white';
                            ctx.fillRect(x - 3, y - 3, 6, 6);
                            ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
                        });

                        if (currentPoints.length > 2) {
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.stroke();
                    }
                }
                // Return early for SVG mode to skip 3D loop
                requestAnimationFrame(animate);
                return;
            }

            // 3D VIEWER LOOP skipped (IFC viewer not available in production)
            requestAnimationFrame(animate);
        };
        const handle = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(handle);
    }, [isDrawing, currentPoints, svgContent, svgViewBox, rooms]);


    if (!job) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    // Handle 404 or backend errors
    if ((job as any).error) {
        return (
            <div className="p-10 flex flex-col items-center justify-center gap-4">
                <h2 className="text-xl font-bold text-red-500">Job Not Found</h2>
                <p>The job ID {jobId} does not exist or has been deleted.</p>
                <Button onClick={() => window.location.href = "/"}>Back to Dashboard</Button>
            </div>
        );
    }



    return (
        <div className="h-screen flex flex-col font-sans">
            {/* HEADER */}
            <div className="bg-white z-10 shadow-sm border-b">
                {/* TITLE BAR */}
                <div className="flex items-center px-6 py-3 justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Agent Job Workflow (v2.0 - 2D Force)</h1>
                            <span className="text-xs text-muted-foreground uppercase tracking-widest">{job.title}</span>
                        </div>
                    </div>
                </div>

                {/* AGENT TABS - MAIN NAVIGATION */}
                <div className="flex px-6 gap-8 text-sm font-medium border-t pt-2">
                    <button onClick={() => setActiveTab('architect')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'architect' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold">1</div>
                        Upload & Define Rooms
                    </button>
                    <button onClick={() => setActiveTab('qs')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'qs' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold">2</div>
                        Scan Fittings (DXF)
                    </button>
                    <button onClick={() => setActiveTab('tender')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tender' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold">3</div>
                        Review Tender
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 relative flex overflow-hidden">

                {/* DYNAMIC SIDEBAR (LEFT) */}
                <div className="w-96 border-r bg-white flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.05)]">

                    {/* ARCHITECT TAB CONTENT */}
                    {activeTab === 'architect' && (
                        <div className="flex flex-col h-full animate-in slide-in-from-left-4 fade-in duration-300">
                            {/* STEP 1: UPLOAD REFERENCE */}
                            <div className="p-4 border-b bg-white">
                                <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs">1</div>
                                    Floor Plan Reference
                                </h3>

                                {!activeFile ? (
                                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-100 transition-colors">
                                        <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-xs text-slate-600 font-medium mb-3">Upload DXF/SVG to start</p>
                                        <label className={`cursor-pointer inline-block ${uploadFileMutation.isLoading || uploadFileMutation.status === 'pending' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <div className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded shadow-sm transition-all flex items-center gap-2">
                                                {(uploadFileMutation.isLoading || uploadFileMutation.status === 'pending') ? (
                                                    <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                                                ) : (
                                                    "Select File"
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".dxf,.svg,.ifc"
                                                disabled={uploadFileMutation.isLoading || uploadFileMutation.status === 'pending'}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) uploadFileMutation.mutate(f);
                                                }}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded border border-slate-200 shadow-sm">
                                        <div className="w-8 h-8 bg-white rounded border flex items-center justify-center text-slate-600 shadow-sm">
                                            <Layers className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold truncate text-slate-800">{activeFile.originalName || activeFile.fileUrl.split('/').pop()}</div>
                                            <div className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                Active Reference
                                            </div>
                                        </div>
                                        <label className={`cursor-pointer p-1.5 hover:bg-white rounded transition-colors text-slate-400 hover:text-blue-600 flex items-center gap-1 ${uploadFileMutation.isLoading || uploadFileMutation.status === 'pending' ? 'opacity-50 pointer-events-none' : ''}`} title="Change Plan">
                                            {(uploadFileMutation.isLoading || uploadFileMutation.status === 'pending') ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                            ) : (
                                                <FileUp className="w-4 h-4" />
                                            )}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".dxf,.svg,.ifc"
                                                disabled={uploadFileMutation.isLoading || uploadFileMutation.status === 'pending'}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) uploadFileMutation.mutate(f);
                                                }}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: DRAW ROOMS (Only visual if file exists) */}
                            {activeFile && (
                                <div className="p-4 border-b bg-gray-50/50">
                                    <h3 className="font-bold text-sm text-blue-900 mb-2 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs">2</div>
                                        Define Rooms
                                    </h3>

                                    <div className="space-y-4">
                                        {/* Cut Plane Control (For IFC/3D context, though we focus on 2D now) */}
                                        {/* <div className="bg-white p-3 rounded border shadow-sm">...</div> */}
                                        {/* Hiding Cut Plane for simplicity unless needed */}

                                        {isDrawing ? (
                                            <div className="bg-blue-50 p-3 rounded border border-blue-200 shadow-sm animate-in zoom-in-95">
                                                <Input
                                                    placeholder="Name (e.g. Kitchen)"
                                                    value={roomName}
                                                    onChange={e => setRoomName(e.target.value)}
                                                    className="mb-2 bg-white h-8 text-xs"
                                                    autoFocus
                                                />
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] text-blue-700 font-mono font-medium">Area: {tempArea.toFixed(2)}m²</span>
                                                    <Button variant="ghost" size="sm" onClick={handleUndo} className="h-6 text-[10px] hover:bg-blue-100 px-2"><Undo className="w-3 h-3 mr-1" /> Undo</Button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={handleSave} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs">Save</Button>
                                                    <Button variant="secondary" size="sm" onClick={resetDrawing} className="h-8 text-xs">Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button onClick={() => setIsDrawing(true)} className="w-full bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-sm h-9 text-xs font-semibold">
                                                <Plus className="w-3.5 h-3.5 mr-2" /> Draw New Room
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-auto p-2 space-y-2 bg-slate-50">
                                {rooms.length === 0 && (
                                    <div className="text-center p-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg m-2">
                                        No rooms defined yet.<br />Click "Add New Room" to start.
                                    </div>
                                )}
                                {rooms.map((room) => (
                                    <div key={room.id} className="group flex items-center justify-between p-3 rounded bg-white border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                                        {editingRoomId === room.id ? (
                                            <div className="flex-1 mr-2 flex gap-1 items-center">
                                                <Input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="h-8 text-sm bg-white"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') updateRoomMutation.mutate({ id: room.id, name: editName });
                                                        if (e.key === 'Escape') setEditingRoomId(null);
                                                    }}
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateRoomMutation.mutate({ id: room.id, name: editName })}>
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setEditingRoomId(null)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-sm text-slate-700">{room.name}</div>
                                                    <button onClick={() => { setEditingRoomId(room.id); setEditName(room.name); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity" title="Rename Room">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                                                    <span>{room.area} m²</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{room.perimeter} m</span>
                                                </div>
                                            </div>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRoomMutation.mutate(room.id)}>
                                            <span className="text-lg leading-none">×</span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* QS TAB CONTENT — DXF FITTINGS SCANNER */}
                    {activeTab === 'qs' && (
                        <div className="flex flex-col h-full animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="p-4 border-b bg-amber-50/40">
                                <h3 className="font-bold text-sm text-amber-900 mb-1">DXF Fittings Scanner</h3>
                                <p className="text-xs text-gray-500 mb-3">Upload a DXF drawing to auto-detect electrical & plumbing fittings per room.</p>

                                {/* DXF Active Banner */}
                                {dxfStatus?.has_dxf && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                        <span className="text-xs text-green-800 font-medium">
                                            DXF Active — {dxfStatus.dxf_room_count}/{dxfStatus.total_rooms} rooms have fittings
                                        </span>
                                    </div>
                                )}

                                {/* File Picker */}
                                <div className="bg-white p-3 rounded-lg border shadow-sm">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                            <FileUp className="w-5 h-5 text-amber-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-slate-700">
                                                {dxfFile ? dxfFile.name : 'Choose DXF File'}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {dxfFile ? `${(dxfFile.size / 1024).toFixed(1)} KB` : 'Electrical & plumbing symbols'}
                                            </div>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".dxf"
                                            onChange={(e) => setDxfFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {/* Room Count Warning */}
                                {rooms.length === 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2 flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                                        <span className="text-[10px] text-yellow-800">
                                            Define rooms in the Architect tab first — fittings need room polygons for spatial matching.
                                        </span>
                                    </div>
                                )}

                                {/* Scan Button */}
                                <Button
                                    onClick={handleDxfScan}
                                    disabled={!dxfFile || rooms.length === 0 || isScanning}
                                    className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                >
                                    {isScanning ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                                    ) : (
                                        <><Zap className="w-4 h-4 mr-2" /> Scan DXF for Fittings</>
                                    )}
                                </Button>
                            </div>

                            {/* SCAN RESULTS */}
                            <div className="flex-1 overflow-auto p-3 space-y-2 bg-slate-50">
                                {scanResult && (
                                    <>
                                        {/* Summary Card */}
                                        <div className="bg-white rounded-lg border p-3 shadow-sm">
                                            <h4 className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Scan Summary</h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-50 rounded p-2 text-center">
                                                    <div className="text-lg font-bold text-blue-700">{scanResult.total_inserts}</div>
                                                    <div className="text-[9px] text-blue-500 uppercase">Total Blocks</div>
                                                </div>
                                                <div className="bg-green-50 rounded p-2 text-center">
                                                    <div className="text-lg font-bold text-green-700">{scanResult.total_matched}</div>
                                                    <div className="text-[9px] text-green-500 uppercase">Matched</div>
                                                </div>
                                                <div className="bg-amber-50 rounded p-2 text-center">
                                                    <div className="text-lg font-bold text-amber-700">{scanResult.total_assigned}</div>
                                                    <div className="text-[9px] text-amber-500 uppercase">Assigned</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Per-Room Results */}
                                        {Object.entries(scanResult.per_room || {}).map(([roomId, roomData]: [string, any]) => {
                                            const fittings = roomData.fittings || {};
                                            const elecItems = ['lights', 'sockets', 'switches', 'extractor_fans', 'smoke_alarms', 'data_points', 'tv_points'].filter(k => fittings[k] > 0);
                                            const plumbItems = ['hot_points', 'cold_points', 'waste_points', 'radiators'].filter(k => fittings[k] > 0);

                                            return (
                                                <div key={roomId} className="bg-white rounded-lg border p-3 shadow-sm">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-sm text-slate-700">{roomData.room_name}</span>
                                                        {roomData.has_fittings ? (
                                                            <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">DXF</span>
                                                        ) : (
                                                            <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">No Fittings</span>
                                                        )}
                                                    </div>

                                                    {elecItems.length > 0 && (
                                                        <div className="mb-1.5">
                                                            <div className="text-[9px] text-blue-600 font-semibold uppercase mb-1">⚡ Electrical</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {elecItems.map(k => (
                                                                    <span key={k} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                                        {k.replace(/_/g, ' ')}: <strong>{fittings[k]}</strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {plumbItems.length > 0 && (
                                                        <div>
                                                            <div className="text-[9px] text-rose-600 font-semibold uppercase mb-1">🔧 Plumbing</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {plumbItems.map(k => (
                                                                    <span key={k} className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">
                                                                        {k.replace(/_/g, ' ')}: <strong>{fittings[k]}</strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!roomData.has_fittings && (
                                                        <div className="text-xs text-slate-400 italic">No fittings detected inside this room.</div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Unmatched Blocks */}
                                        {scanResult.unmatched_blocks?.length > 0 && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                <h4 className="text-xs font-bold text-yellow-800 mb-1">Unrecognized Blocks ({scanResult.unmatched_blocks.length})</h4>
                                                <div className="flex flex-wrap gap-1">
                                                    {scanResult.unmatched_blocks.slice(0, 15).map((name: string) => (
                                                        <span key={name} className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-mono">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Previously Scanned Rooms (from DB, not live scan) */}
                                {!scanResult && dxfStatus?.has_dxf && dxfStatus.rooms.map((r: any) => {
                                    const fittings = r.fittings || {};
                                    const nonZero = Object.entries(fittings).filter(([_, v]) => (v as number) > 0);
                                    return (
                                        <div key={r.id} className="bg-white rounded-lg border p-3 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-sm text-slate-700">{r.name}</span>
                                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">DXF</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {nonZero.map(([k, v]) => (
                                                    <span key={k} className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border">
                                                        {(k as string).replace(/_/g, ' ')}: <strong>{v as number}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Empty State */}
                                {!scanResult && !dxfStatus?.has_dxf && (
                                    <div className="text-center p-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                                        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📐</div>
                                        Upload a DXF file above to detect fittings.
                                        <br /><span className="text-xs text-slate-300">Supports electrical symbols, plumbing fixtures, radiators, and more.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TENDER TAB CONTENT */}
                    {activeTab === 'tender' && (
                        <div className="flex flex-col h-full animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="p-4 overflow-auto flex-1">
                                <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2">
                                    <span className="text-2xl">📋</span> Tender Summary
                                </h3>

                                {rooms.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10">No rooms defined to tender.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {rooms.map(r => {
                                            const fittings = r.fittings ? JSON.parse(typeof r.fittings === 'string' ? r.fittings : JSON.stringify(r.fittings)) : {};
                                            const fittingCount = Object.values(fittings).reduce((a: any, b: any) => a + b, 0);
                                            return (
                                                <div key={r.id} className="bg-white p-3 rounded border shadow-sm">
                                                    <div className="flex justify-between font-bold text-sm">
                                                        <span>{r.name}</span>
                                                        <span>{r.area}m²</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 flex gap-4">
                                                        <span>Perimeter: {r.perimeter}m</span>
                                                        <span>Fittings: {fittingCount}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t bg-slate-50">
                                <Button
                                    onClick={() => window.location.href = '/'}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Finish & Return to Dashboard
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* VIEWER AREA (RIGHT) */}
                <div className="flex-1 relative bg-slate-100 transition-all duration-500 border-l border-slate-200 shadow-inner flex flex-col">
                    {(!fileUrl || showUpload) ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                            {showUpload && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowUpload(false)}
                                    className="absolute top-4 right-4 text-slate-500"
                                >
                                    Cancel
                                </Button>
                            )}
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📁</div>
                                <h3 className="font-bold text-lg text-slate-700 mb-2">Upload a Drawing</h3>
                                <p className="text-sm text-slate-500 mb-4">Upload a DXF or SVG file to get started</p>
                                <p className="text-xs text-slate-400">Use the QS tab to scan DXF files for fittings</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* CANVAS OVERLAY - ONLY IN ARCHITECT MODE */}
                            <canvas
                                ref={canvasRef}
                                className={`absolute top-0 left-0 w-full h-full z-20 transition-opacity duration-300 ${activeTab === 'architect' ? ((isDrawing || svgContent) ? 'cursor-crosshair opacity-100' : 'pointer-events-none opacity-60') : 'pointer-events-none opacity-0'}`}
                                onClick={handleCanvasClick}
                            />

                            {/* CONDITIONAL VIEWER: SVG vs 3D */}
                            {svgContent ? (
                                <div
                                    ref={svgContainerRef}
                                    className="w-full h-full bg-slate-100 flex items-center justify-center overflow-hidden relative z-10"
                                >
                                    {/* Inline SVG rendering for maximum fidelity */}
                                    <div
                                        className="w-full h-full flex items-center justify-center p-4"
                                        dangerouslySetInnerHTML={{ __html: svgContent }}
                                    />

                                    {/* 2D Mode Badge */}
                                    <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded shadow text-xs font-bold text-slate-600 border border-slate-200">
                                        Active Mode: 2D Plan (DXF)
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl">🏗️</div>
                                    <span className="text-sm font-medium text-slate-500">No floor plan loaded</span>
                                    <span className="text-xs text-slate-400">Upload a DXF/SVG drawing to view it here</span>
                                    <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
                                        <FileUp className="w-4 h-4 mr-2" /> Upload Drawing
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
