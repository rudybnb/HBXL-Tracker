import { useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import AiAssistantChat from './ai-assistant-chat';
import * as pdfjsLib from 'pdfjs-dist';

// Configure Worker - Explicit Version to match package.json
// @ts-ignore
// Configure Worker - Explicit Version to match package.json
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

interface DrawingViewerProps {
    fileUrl: string;
    fileType: string;
    smartElements?: any[];
    onElementClick?: (element: any) => void;
    fileId?: string;
}

export default function DrawingViewer({ fileUrl, fileType, smartElements = [], onElementClick, fileId }: DrawingViewerProps) {
    const [scale, setScale] = useState(1.0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [isPdfMode, setIsPdfMode] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Determine Display URL (Fallback for PNG)
    const displayUrl = fileUrl + '.png';

    // Filter elements for current page
    const pageElements = smartElements.filter(el => el.page === currentPage || (!el.page && currentPage === 1));

    useEffect(() => {
        if (fileType === 'application/pdf') {
            // Revert to Server-Side PNG (Stable & White Background Verified)
            // Client-Side PDFJS in Step 2041 showed blank white (rendering issue).
            // Server-Side PNG has explicit white background fill.
            setIsPdfMode(false);
            setIsLoading(false);

            // Note: If you want to debug client-side again, uncomment loadPdf()
            // setIsPdfMode(true);
            // loadPdf();
        } else {
            setIsPdfMode(false);
            setIsLoading(false);
        }
    }, [fileUrl, fileType, scale]);

    const loadPdf = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("📄 Loading PDF Client-Side:", fileUrl);
            const loadingTask = pdfjsLib.getDocument(fileUrl);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1); // Always Page 1 for preview

            const viewport = page.getViewport({ scale: scale * 1.5 });
            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // White Background for Transparent PDFs
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            setIsLoading(false);
        } catch (err: any) {
            console.error("PDF Render Error:", err);
            // Fallback to Image Mode (Server PNG)
            setIsPdfMode(false);
        }
    };

    // ... rest of component logic ...

    // Calculate style for overlay based on bounding box
    const getOverlayStyle = (bbox: number[]) => {
        if (!bbox || bbox.length < 4) return { display: 'none' };
        const [xmin, ymin, xmax, ymax] = bbox;
        const isPixelScale = Math.max(xmin, ymin, xmax, ymax) > 1000;
        if (isPixelScale) {
            return {
                left: `${xmin}px`,
                top: `${ymin}px`,
                width: `${xmax - xmin}px`,
                height: `${ymax - ymin}px`,
            };
        } else {
            return {
                left: `${xmin / 10}%`,
                top: `${ymin / 10}%`,
                width: `${(xmax - xmin) / 10}%`,
                height: `${(ymax - ymin) / 10}%`,
            };
        }
    };

    const getElementColor = (label: string, type: string) => {
        const t = (type || '').toLowerCase();
        const l = (label || '').toLowerCase();
        if (t.includes('door') || l.includes('door')) return 'border-cyan-500 hover:bg-cyan-500/20';
        if (t.includes('window') || l.includes('window')) return 'border-sky-500 hover:bg-sky-500/20';
        if (t.includes('electr') || t.includes('light') || t.includes('socket')) return 'border-yellow-400 hover:bg-yellow-400/20';
        if (t.includes('plumb') || t.includes('bath') || t.includes('wc')) return 'border-green-500 hover:bg-green-500/20';
        return 'border-gray-500 hover:bg-gray-500/20';
    };

    return (
        <div className="flex h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
            {/* Main Viewer Column */}
            <div className="flex-1 flex flex-col min-w-0">
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
                            <Button variant="secondary" size="sm" className="bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600" onClick={() => window.open(fileUrl, '_blank')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
                                Open PDF
                            </Button>
                        )}
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

                        {/* Render Mode: Client-Side PDF (Canvas) OR Server-Side (Image) */}
                        {isPdfMode ? (
                            <canvas
                                ref={canvasRef}
                                className="shadow-lg block"
                            />
                        ) : (
                            <img
                                src={displayUrl}
                                alt="Drawing"
                                className="max-w-none shadow-lg block h-auto"
                                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                                onLoad={() => setIsLoading(false)}
                                onError={() => {
                                    setIsLoading(false);
                                    if (fileType === 'application/pdf') {
                                        // If PNG fails, try force switching to PDF mode (Client Side)
                                        console.warn("PNG missing, switching to Client-Side PDF render");
                                        setIsPdfMode(true);
                                        // Trigger re-render effect?
                                    } else {
                                        setError('Failed to load image.');
                                    }
                                }}
                            />
                        )}

                        {/* Overlay Layer - adapting to mode */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={isPdfMode
                                ? { width: '100%', height: '100%' } // Canvas grows physically, overlay follows
                                : { transform: `scale(${scale})`, transformOrigin: 'top left', width: '100%', height: '100%' } // Image uses CSS zoom
                            }
                        >
                            {pageElements.map((el, idx) => {
                                let className = "absolute border-2 transition-all duration-200 cursor-pointer pointer-events-auto group ";
                                if (el.type === 'room') {
                                    if (el.label.toLowerCase().includes('living')) className += "border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 ";
                                    else if (el.label.toLowerCase().includes('bed')) className += "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 ";
                                    else if (el.label.toLowerCase().includes('kitchen')) className += "border-red-500 bg-red-500/10 hover:bg-red-500/20 ";
                                    else if (el.label.toLowerCase().includes('bath')) className += "border-green-500 bg-green-500/10 hover:bg-green-500/20 ";
                                    else className += "border-purple-500 bg-purple-500/10 hover:bg-purple-500/20 ";
                                } else {
                                    className += getElementColor(el.label, el.details?.type);
                                }

                                return (
                                    <div
                                        key={`${el.id}-${idx}`}
                                        className={className}
                                        style={getOverlayStyle(el.bbox)}
                                        onClick={() => onElementClick?.(el)}
                                    >
                                        <div className="hidden group-hover:block absolute z-[60] bottom-full left-0 mb-2 min-w-[120px] bg-white text-slate-900 rounded p-2 text-xs shadow-xl">
                                            <strong>{el.label}</strong>
                                            {el.type === 'element' && <div>In: {el.details?.roomName}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
