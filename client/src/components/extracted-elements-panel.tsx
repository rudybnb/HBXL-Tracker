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
    unit: string | null;
    rate: string | null;
    total: string | null;
    roomName: string | null;
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
    // Count completed files to detect when extraction finishes
    const completedCount = (files || []).filter(f => f.extractionStatus === 'completed').length;

    const { data: elements, isLoading, refetch } = useQuery<ExtractedElement[]>({
        queryKey: [`/api/jobs/${jobId}/elements`, { completedCount }],
        // Override staleTime to always refetch
        staleTime: 0,
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

    // Group elements by room (AGENTS.md compliant)
    const groupedByRoom = (elements || []).reduce((acc, el) => {
        const room = el.roomName || el.location || 'General';
        if (!acc[room]) acc[room] = [];
        acc[room].push(el);
        return acc;
    }, {} as Record<string, ExtractedElement[]>);

    // Calculate room and project totals
    const roomTotals = Object.entries(groupedByRoom).map(([room, items]) => ({
        room,
        items,
        total: items.reduce((sum, el) => sum + (parseFloat(el.total || '0') || 0), 0)
    }));
    const projectTotal = roomTotals.reduce((sum, r) => sum + r.total, 0);

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

            {/* Bill of Quantities Table (AGENTS.md Format) */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
            ) : elements && elements.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                            <Layers className="h-5 w-5 mr-2 text-amber-500" />
                            Bill of Quantities ({elements.length} items)
                        </h3>
                        <span className="text-lg font-bold text-amber-400">
                            £{projectTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-800 text-slate-300">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium">Room</th>
                                    <th className="text-left px-4 py-3 font-medium">Item</th>
                                    <th className="text-right px-4 py-3 font-medium">Qty</th>
                                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                                    <th className="text-right px-4 py-3 font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roomTotals.map(({ room, items, total: roomTotal }) => (
                                    <>
                                        {items.map((element, idx) => (
                                            <tr key={element.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                                                {idx === 0 ? (
                                                    <td className="px-4 py-3 font-medium text-amber-400" rowSpan={items.length}>
                                                        {room}
                                                    </td>
                                                ) : null}
                                                <td className="px-4 py-3 text-slate-200">
                                                    {element.elementCode && (
                                                        <span className="text-xs font-mono bg-slate-700 text-amber-400 px-1 py-0.5 rounded mr-2">
                                                            {element.elementCode}
                                                        </span>
                                                    )}
                                                    {element.description}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300">
                                                    {element.quantity} {element.unit || ''}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400">
                                                    {parseFloat(element.rate || '0') > 0 ? `£${parseFloat(element.rate || '0').toFixed(2)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-200 font-medium">
                                                    {parseFloat(element.total || '0') > 0 ? `£${parseFloat(element.total || '0').toFixed(2)}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Room Subtotal */}
                                        <tr className="bg-slate-800/50 border-t border-slate-600">
                                            <td colSpan={4} className="px-4 py-2 text-right text-slate-400 font-medium">
                                                {room} Subtotal:
                                            </td>
                                            <td className="px-4 py-2 text-right text-amber-400 font-bold">
                                                £{roomTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-800 border-t-2 border-amber-500/50">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-200">
                                        Project Total:
                                    </td>
                                    <td className="px-4 py-3 text-right text-lg font-bold text-amber-400">
                                        £{projectTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
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
