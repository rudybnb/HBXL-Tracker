
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
                            {pageElements.map((el, idx) => (
                                <div
                                    key={`${el.id}-${idx}`}
                                    className={`absolute border-2 transition-all duration-200 cursor-pointer pointer-events-auto group
                                        ${el.type === 'room' ? getRoomColor(el.label) : getElementColor(el.label, el.details?.type)}
                                    `}
                                    style={getOverlayStyle(el.bbox)}
                                    onClick={() => onElementClick?.(el)}
                                >
                                    {/* Tooltip label on hover */}
                                    <div className="hidden group-hover:block absolute -top-8 left-0 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 border border-slate-700">
                                        <span className="font-bold text-amber-400">{el.type.toUpperCase()}: </span>
                                        {el.label}
                                    </div>
                                </div>
                            ))}
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
