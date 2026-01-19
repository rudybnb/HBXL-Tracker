
import { useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import AiAssistantChat from './ai-assistant-chat';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - assuming standard Vite setup
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface BoundingBox {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
}

interface SmartElement {
    id: string;
    type: 'room' | 'element' | 'instruction';
    label: string;
    bbox: number[]; // [ymin, xmin, ymax, xmax] 0-1000
    page: number;
    details?: any;
}

interface DrawingViewerProps {
    fileUrl: string;
    fileType: string;
    smartElements?: SmartElement[];
    onElementClick?: (element: SmartElement) => void;
    fileId?: string;
}

export default function DrawingViewer({ fileUrl, fileType, smartElements = [], onElementClick, fileId }: DrawingViewerProps) {
    const [scale, setScale] = useState(1.0);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);

    // Filter elements for current page
    const pageElements = smartElements.filter(el => el.page === currentPage || (!el.page && currentPage === 1));

    useEffect(() => {
        if (fileType === 'application/pdf') {
            loadPdf();
        } else {
            setIsLoading(false); // Images load naturally via <img>
        }
    }, [fileUrl, fileType, currentPage, scale]);

    const loadPdf = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Cancel any pending render
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const loadingTask = pdfjsLib.getDocument(fileUrl);
            const pdf = await loadingTask.promise;
            setNumPages(pdf.numPages);

            const page = await pdf.getPage(currentPage);
            const viewport = page.getViewport({ scale: scale * 1.5 }); // Higher quality

            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;

            await renderTask.promise;
            setIsLoading(false);

        } catch (err: any) {
            if (err.name !== 'RenderingCancelledException') {
                console.error('PDF Render Error:', err);
                setError('Failed to load PDF');
                setIsLoading(false);
            }
        }
    };

    // Calculate style for overlay based on bounding box
    // Bbox is [xmin, ymin, xmax, ymax] in 0-1000 coordinates (Standard Cartesian)
    const getOverlayStyle = (bbox: number[]) => {
        // Fallback for empty/malformed bbox
        if (!bbox || bbox.length < 4) return { display: 'none' };

        const [xmin, ymin, xmax, ymax] = bbox;
        return {
            left: `${xmin / 10}%`,
            top: `${ymin / 10}%`,
            width: `${(xmax - xmin) / 10}%`,
            height: `${(ymax - ymin) / 10}%`,
        };
    };

    // Helper to get color based on room name
    const getRoomColor = (label: string) => {
        const lower = label.toLowerCase();
        if (lower.includes('bed')) return 'border-blue-500 hover:bg-blue-500/20';
        if (lower.includes('lounge') || lower.includes('living') || lower.includes('sitting')) return 'border-orange-500 hover:bg-orange-500/20';
        if (lower.includes('bath') || lower.includes('wc') || lower.includes('ensuite') || lower.includes('toilet')) return 'border-green-500 hover:bg-green-500/20';
        if (lower.includes('kitchen') || lower.includes('utility')) return 'border-red-500 hover:bg-red-500/20';
        if (lower.includes('hall') || lower.includes('landing') || lower.includes('corridor')) return 'border-yellow-500 hover:bg-yellow-500/20';
        return 'border-purple-500 hover:bg-purple-500/20';
    };

    // Helper to get color based on element type
    const getElementColor = (label: string, type: string) => {
        const t = (type || '').toLowerCase();
        const l = (label || '').toLowerCase();

        if (t.includes('door') || l.includes('door')) return 'border-cyan-500 hover:bg-cyan-500/20';
        if (t.includes('window') || l.includes('window')) return 'border-sky-500 hover:bg-sky-500/20';
        if (t.includes('electr') || t.includes('light') || t.includes('socket') || t.includes('switch') || l.includes('light') || l.includes('socket')) return 'border-yellow-400 hover:bg-yellow-400/20';
        if (t.includes('plumb') || t.includes('bath') || t.includes('wc') || t.includes('shower') || l.includes('basin')) return 'border-indigo-500 hover:bg-indigo-500/20';

        return 'border-gray-500 hover:bg-gray-500/20';
    };

    return (
        <div className="flex h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
            {/* Main Viewer Column */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Visual Legend */}
                <div className="flex flex-wrap gap-4 px-4 py-2 bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-orange-500 bg-orange-500/20"></div> Living Space</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-blue-500 bg-blue-500/20"></div> Bedroom</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-green-500 bg-green-500/20"></div> Bath/WC</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-red-500 bg-red-500/20"></div> Kitchen</div>
                    <div className="w-px h-3 bg-slate-700 mx-2"></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-yellow-400 bg-yellow-400/20"></div> Electrical</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-cyan-500 bg-cyan-500/20"></div> Doors</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-sky-500 bg-sky-500/20"></div> Windows</div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-slate-400 w-12 text-center">{Math.round(scale * 100)}%</span>
                        <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                        {fileType === 'application/pdf' && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-slate-400">Page {currentPage} of {numPages}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                                    disabled={currentPage >= numPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        )}

                        {/* Chat Toggle */}
                        {fileId && (
                            <Button
                                variant={showChat ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setShowChat(!showChat)}
                                className={showChat ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Ask AI
                            </Button>
                        )}
                    </div>
                </div>

                {/* Viewer Area */}
                <ScrollArea className="flex-1 w-full bg-slate-950 p-4">
                    <div
                        ref={containerRef}
                        className="relative mx-auto origin-top transition-transform duration-200"
                        style={{ width: 'fit-content' }}
                    >
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-50">
                                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center justify-center p-12 text-red-400">
                                {error}
                            </div>
                        )}

                        {/* PDF Canvas or Image */}
                        {fileType === 'application/pdf' ? (
                            <canvas ref={canvasRef} className="shadow-lg block" />
                        ) : (
                            <img
                                src={fileUrl}
                                alt="Drawing"
                                className="max-w-none shadow-lg block"
                                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                                onLoad={() => setIsLoading(false)}
                            />
                        )}

                        {/* Overlay Layer */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={fileType !== 'application/pdf' ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: '100%', height: '100%' } : {}}
                        >
                            {/* We need a wrapper that matches the exact dimensions of the rendered content */}
                            {pageElements.map((el, idx) => {
                                // Dynamic Count Logic: How many of this specific item are in this specific room?
                                const countInRoom = pageElements.filter(other =>
                                    other.label === el.label &&
                                    other.details?.roomName === el.details?.roomName &&
                                    other.type === 'element'
                                ).length;

                                // Icon Logic
                                const getIcon = (type: string) => {
                                    const t = (type || '').toLowerCase();
                                    if (t.includes('light')) return <div className="text-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5a6 6 0 0 0-11 0c0 1.5.5 2.5 1.5 3.5.9.8 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></svg></div>;
                                    if (t.includes('door')) return <div className="text-cyan-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" /></svg></div>;
                                    if (t.includes('window')) return <div className="text-sky-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10v14" /><path d="M12 10a12.8 12.8 0 0 0 6 3 12.8 12.8 0 1 0-6-3" /><path d="M12 10a12.8 12.8 0 0 1-6 3 12.8 12.8 0 1 1 6-3" /></svg></div>;
                                    if (t.includes('socket') || t.includes('switch')) return <div className="text-yellow-400"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="12" x="3" y="6" rx="2" /><path d="M9 12h.01" /><path d="M15 12h.01" /></svg></div>;
                                    if (t.includes('room')) return <div className="text-blue-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8" /><path d="M12 2v14" /><path d="M17 14h-4" /><path d="M7 14h.01" /></svg></div>;
                                    return <div className="text-slate-400">●</div>;
                                };

                                // Base element style
                                let className = "absolute border-2 transition-all duration-200 cursor-pointer pointer-events-auto group ";
                                if (el.type === 'room') {
                                    // Permanent fill for rooms (opacity 10%), darker on hover
                                    if (el.label.toLowerCase().includes('living') || el.label.toLowerCase().includes('lounge')) className += "border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 ";
                                    else if (el.label.toLowerCase().includes('bed')) className += "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 ";
                                    else if (el.label.toLowerCase().includes('kitchen')) className += "border-red-500 bg-red-500/10 hover:bg-red-500/20 ";
                                    else if (el.label.toLowerCase().includes('bath') || el.label.toLowerCase().includes('wc')) className += "border-green-500 bg-green-500/10 hover:bg-green-500/20 ";
                                    else className += "border-purple-500 bg-purple-500/10 hover:bg-purple-500/20 ";
                                } else {
                                    // Elements (no fill default, fill on hover)
                                    className += getElementColor(el.label, el.details?.type);
                                }

                                return (
                                    <div
                                        key={`${el.id}-${idx}`}
                                        className={className}
                                        style={getOverlayStyle(el.bbox)}
                                        onClick={() => onElementClick?.(el)}
                                    >
                                        {/* RICH TOOLTIP CARD (Matches User Screenshot) */}
                                        <div className="hidden group-hover:block absolute z-[60] bottom-full left-0 mb-2 min-w-[180px]">
                                            <div className="bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 p-3 flex flex-col gap-1">
                                                {/* Header: Icon + Title */}
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                                                    {getIcon(el.details?.type || (el.type === 'room' ? 'room' : ''))}
                                                    <span className="font-bold text-sm leading-none">{el.label}</span>
                                                </div>

                                                {/* Details: Count & Room */}
                                                {el.type !== 'room' && (
                                                    <>
                                                        <div className="font-semibold text-xs text-slate-700">
                                                            {countInRoom} {el.label}{countInRoom !== 1 ? 's' : ''}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Room: {el.details?.roomName || "Unassigned"}
                                                        </div>
                                                    </>
                                                )}
                                                {el.type === 'room' && (
                                                    <div className="text-xs text-slate-500">
                                                        Total Area: {Math.round((el.bbox[2] - el.bbox[0]) * (el.bbox[3] - el.bbox[1]) / 1000)} m² (Est)
                                                    </div>
                                                )}
                                            </div>
                                            {/* Arrow */}
                                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white ml-4"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* No Elements Warning Overlay */}
                        {pageElements.some(e => e.type === 'room') && !pageElements.some(e => e.type !== 'room') && (
                            <div className="absolute top-4 right-4 bg-red-900/90 border border-red-500 text-white p-4 rounded-lg shadow-xl backdrop-blur-sm max-w-sm z-50 pointer-events-none">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 text-2xl">⚠️</div>
                                    <div>
                                        <h4 className="font-bold text-sm uppercase mb-1">Incomplete Extraction detected</h4>
                                        <p className="text-xs text-red-100 leading-relaxed">
                                            Room boundaries were found, but individual symbols (lights, sockets, doors) are missing.
                                        </p>
                                        <p className="text-xs font-bold text-white mt-2 border-t border-red-500/50 pt-2">
                                            Please DELETE and RE-UPLOAD this drawing to trigger a new AI analysis with the latest counting rules.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </ScrollArea>
            </div>

            {/* Chat Sidebar */}
            {fileId && showChat && (
                <AiAssistantChat fileId={fileId} open={showChat} />
            )}
        </div>
    );
}
