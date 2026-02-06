import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Layers, RefreshCw, AlertCircle, CheckCircle2, Clock, Home, Box, Pencil, Edit, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Room extracted from drawing (costs come from CSV)
interface ExtractedRoom {
    id: string;
    name: string;
    floor: string;
    status: string;
    createdAt: string;
}

interface ExtractedElement {
    id: string;
    elementType: string;
    description: string;
    quantity: string;
    unit: string;
    roomName: string;
    fileId: string;
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

function RoomCard({ room, queryClient }: { room: ExtractedRoom; queryClient: any }) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(room.name);

    const renameMutation = useMutation({
        mutationFn: async (args: { id: string; name: string }) => {
            const response = await fetch(`/api/rooms/${args.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: args.name }),
            });
            if (!response.ok) throw new Error('Failed to rename room');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs`] }); // Invalidate general job data
            // We need to invalidate the specific room query passed from parent, but simpler to rely on general invalidation or optimistic updates
            toast({ title: "Room Renamed", description: "The room name has been updated." });
            setIsEditing(false);
            // Force reload of this specific panel's data
            // This is a bit hacky but ensures the list updates immediately
            setTimeout(() => {
                window.dispatchEvent(new Event('room-renamed'));
            }, 100);
        },
        onError: () => {
            toast({ title: "Update Failed", description: "Could not rename the room.", variant: "destructive" });
        }
    });

    const handleSave = () => {
        if (newName.trim()) {
            renameMutation.mutate({ id: room.id, name: newName });
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-amber-500/30 transition-colors group">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 mr-2">
                    {isEditing ? (
                        <div className="flex items-center space-x-2">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-400" onClick={handleSave}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400" onClick={() => setIsEditing(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center group/title">
                            <h4 className="text-lg font-medium text-amber-400 mr-2">{room.name}</h4>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    <p className="text-sm text-slate-400">{room.floor} Floor</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${room.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                    room.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                    }`}>
                    {room.status === 'not_started' ? 'Not Started' : room.status}
                </span>
            </div>
        </div>
    );
}

export default function ExtractedElementsPanel({ jobId, files }: ExtractedElementsPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Check if any file is still processing
    const hasProcessing = (files || []).some(f => f.extractionStatus === 'processing');
    // Count completed files to detect when extraction finishes
    const completedCount = (files || []).filter(f => f.extractionStatus === 'completed').length;

    // API returns { rooms: [...] } so we need to select the rooms array
    interface RoomsResponse {
        rooms: ExtractedRoom[];
    }

    // Fetch ROOMS from drawing extraction (not fake elements)
    const { data: roomsData, isLoading } = useQuery<RoomsResponse>({
        queryKey: [`/api/jobs/${jobId}/extracted-rooms`, { completedCount }],
        staleTime: 0,
        refetchInterval: hasProcessing ? 3000 : false,
    });

    const rooms = roomsData?.rooms || [];

    // Fetch ELEMENTS from drawing extraction
    const { data: elementsData } = useQuery<ExtractedElement[]>({
        queryKey: [`/api/jobs/${jobId}/elements`],
        enabled: !!jobId,
    });

    const elements = elementsData || [];

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
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/extracted-rooms`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
            toast({
                title: data.success ? "Extraction Complete" : "Extraction Issue",
                description: data.success
                    ? `Identified ${data.roomsIdentified || 0} rooms`
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

    // Get ALL processable files (Images, PDFs, IFCs)
    const sourceFiles = (files || []).filter(f =>
        f.fileType.startsWith('image/') ||
        f.fileType === 'application/pdf' ||
        f.filename.toLowerCase().endsWith('.ifc')
    );

    // Listen for manual rename events to refresh list
    useEffect(() => {
        const handleRefresh = () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/extracted-rooms`] });
        };
        window.addEventListener('room-renamed', handleRefresh);
        return () => window.removeEventListener('room-renamed', handleRefresh);
    }, [queryClient, jobId]);

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
            {/* Debug: Show all source files */}
            {sourceFiles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sourceFiles.map(file => {
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

            {/* Rooms Identified from Drawing */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
            ) : (rooms && rooms.length > 0) || (elements && elements.length > 0) ? (
                <div className="space-y-8">
                    {/* Rooms Section */}
                    {rooms.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                                <Home className="h-5 w-5 mr-2 text-amber-500" />
                                Rooms Identified ({rooms.length})
                            </h3>
                            <p className="text-sm text-slate-400">
                                These rooms were detected from the uploaded drawing. HBXL costs will be allocated to these rooms.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rooms.map(room => (
                                    <RoomCard key={room.id} room={room} queryClient={queryClient} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Detailed Elements Section */}
                    {elements.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                                <Box className="h-5 w-5 mr-2 text-blue-500" />
                                Detailed Elements ({elements.length})
                            </h3>
                            <p className="text-sm text-slate-400">
                                Individual building elements extracted from the model / drawing.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {elements.map((el, idx) => (
                                    <div
                                        key={el.id || idx}
                                        className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-blue-500/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-slate-200">{el.description || el.elementType}</h4>
                                                <p className="text-xs text-slate-400 mt-1 capitalize">{el.elementType}</p>
                                            </div>
                                            <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                                                Qty: {el.quantity}
                                            </span>
                                        </div>
                                        {el.roomName && (
                                            <div className="mt-2 text-xs text-slate-500 flex items-center">
                                                <Home className="h-3 w-3 mr-1" />
                                                {el.roomName}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <Home className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-2">No rooms or elements identified yet</p>
                    <p className="text-sm text-slate-500">
                        Upload a construction drawing or BIM model to identify data.
                    </p>
                </div>
            )}
        </div>
    );
}

