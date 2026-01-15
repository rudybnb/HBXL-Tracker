import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Layers, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ExtractedElement {
    id: string;
    elementType: string;
    elementCode: string | null;
    description: string;
    dimensions: string | null;
    quantity: string;
    location: string | null;
    material: string | null;
    notes: string | null;
    createdAt: string;
}

interface JobFile {
    id: string;
    filename: string;
    originalName: string;
    fileUrl: string;
    fileType: string;
    extractionStatus: string | null;
    extractionError: string | null;
}

interface ExtractedElementsPanelProps {
    jobId: string;
    files?: JobFile[];
}

const ELEMENT_TYPE_COLORS: Record<string, string> = {
    door: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    window: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    wall: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    floor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ceiling: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    roof: "bg-red-500/20 text-red-400 border-red-500/30",
    structural: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    electrical: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    plumbing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    fixture: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    finish: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function ExtractedElementsPanel({ jobId, files }: ExtractedElementsPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Check if any file is still processing
    const hasProcessing = (files || []).some(f => f.extractionStatus === 'processing');

    const { data: elements, isLoading } = useQuery<ExtractedElement[]>({
        queryKey: [`/api/jobs/${jobId}/elements`],
        // Refetch elements every 3 seconds while files are processing
        refetchInterval: hasProcessing ? 3000 : false,
    });

    const extractMutation = useMutation({
        mutationFn: async (fileId: string) => {
            const response = await fetch(`/api/files/${fileId}/extract`, {
                method: 'POST',
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Extraction failed');
            }
            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/elements`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
            toast({
                title: data.success ? "Extraction Complete" : "Extraction Issue",
                description: data.success
                    ? `Found ${data.elementsExtracted} elements`
                    : data.error,
                variant: data.success ? "default" : "destructive",
            });
        },
        onError: (error) => {
            toast({
                title: "Extraction Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Group elements by type
    const groupedElements = (elements || []).reduce((acc, el) => {
        const type = el.elementType || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(el);
        return acc;
    }, {} as Record<string, ExtractedElement[]>);

    // Get ALL image files - never hide any
    const imageFiles = (files || []).filter(f => f.fileType.startsWith('image/'));

    // Check if mutation is currently running
    const activelyProcessing = extractMutation.isPending;

    // Get status badge color and text
    const getStatusInfo = (status: string | null) => {
        switch (status) {
            case 'completed':
                return { bg: 'bg-green-900/20 border-green-500/30', icon: <CheckCircle2 className="h-5 w-5 text-green-400" />, text: 'Extracted', showBtn: false };
            case 'processing':
                return { bg: 'bg-amber-900/20 border-amber-500/30', icon: <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />, text: 'Processing...', showBtn: true };
            case 'failed':
                return { bg: 'bg-red-900/20 border-red-500/30', icon: <AlertCircle className="h-5 w-5 text-red-400" />, text: 'Failed - Retry', showBtn: true };
            default:
                return { bg: 'bg-slate-800 border-slate-700', icon: <Clock className="h-5 w-5 text-slate-400" />, text: `Ready (${status || 'null'})`, showBtn: true };
        }
    };

    return (
        <div className="space-y-6">
            {/* Debug: Show all image files */}
            {imageFiles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {imageFiles.map(file => {
                        const statusInfo = getStatusInfo(file.extractionStatus);
                        return (
                            <div key={file.id} className={`border rounded-lg p-4 flex items-center justify-between ${statusInfo.bg}`}>
                                <div className="flex items-center space-x-3">
                                    {statusInfo.icon}
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">{file.originalName}</p>
                                        <p className="text-xs text-slate-400">
                                            {file.extractionStatus === 'failed'
                                                ? file.extractionError || statusInfo.text
                                                : statusInfo.text}
                                        </p>
                                    </div>
                                </div>
                                {statusInfo.showBtn && (
                                    <Button
                                        size="sm"
                                        variant={file.extractionStatus === 'processing' ? 'default' : 'outline'}
                                        className={file.extractionStatus === 'processing'
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'border-slate-600'}
                                        onClick={() => extractMutation.mutate(file.id)}
                                        disabled={activelyProcessing}
                                    >
                                        {activelyProcessing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        <span className="ml-2">
                                            {file.extractionStatus === 'failed' ? 'Retry' : 'Extract'}
                                        </span>
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Elements Display */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
            ) : elements && elements.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                            <Layers className="h-5 w-5 mr-2 text-amber-500" />
                            Extracted Elements ({elements.length})
                        </h3>
                    </div>

                    {Object.entries(groupedElements).map(([type, typeElements]) => (
                        <div key={type} className="space-y-3">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide flex items-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mr-2 border ${ELEMENT_TYPE_COLORS[type] || ELEMENT_TYPE_COLORS.other}`}>
                                    {type}
                                </span>
                                <span className="text-slate-500">({typeElements.length})</span>
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {typeElements.map(element => (
                                    <div
                                        key={element.id}
                                        className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                {element.elementCode && (
                                                    <span className="text-xs font-mono bg-slate-700 text-amber-400 px-1.5 py-0.5 rounded mr-2">
                                                        {element.elementCode}
                                                    </span>
                                                )}
                                                <span className="text-sm font-medium text-slate-200">
                                                    {element.description}
                                                </span>
                                            </div>
                                            {parseInt(element.quantity) > 1 && (
                                                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                                    ×{element.quantity}
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1 text-xs text-slate-400">
                                            {element.dimensions && (
                                                <p><span className="text-slate-500">Size:</span> {element.dimensions}</p>
                                            )}
                                            {element.location && (
                                                <p><span className="text-slate-500">Location:</span> {element.location}</p>
                                            )}
                                            {element.material && (
                                                <p><span className="text-slate-500">Material:</span> {element.material}</p>
                                            )}
                                            {element.notes && (
                                                <p className="text-slate-500 italic">{element.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <Layers className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-2">No elements extracted yet</p>
                    <p className="text-sm text-slate-500">
                        Upload a construction drawing (image) to automatically extract elements
                    </p>
                </div>
            )}
        </div>
    );
}
