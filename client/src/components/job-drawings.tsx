import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContextualTooltip from "./contextual-tooltip";
import ExtractedElementsPanel from "./extracted-elements-panel";

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

interface JobDrawingsProps {
    jobId: string;
    readOnly?: boolean;
}

export default function JobDrawings({ jobId, readOnly = false }: JobDrawingsProps) {
    const [dragActive, setDragActive] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const { data: files, isLoading } = useQuery<JobFile[]>({
        queryKey: [`/api/jobs/${jobId}/files`],
        // Poll every 3 seconds if any file is being processed (to detect extraction completion)
        refetchInterval: (data) => {
            const hasProcessing = data?.state?.data?.some(f => f.extractionStatus === 'processing');
            return hasProcessing ? 3000 : false;
        },
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/jobs/${jobId}/files`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Prioritize details to show specific server error
                throw new Error(errorData.details || errorData.error || 'Upload failed');
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
            toast({
                title: "File Uploaded",
                description: "Drawing added successfully",
            });
        },
        onError: (error) => {
            console.error("Upload error details:", error);
            toast({
                title: "Upload Failed",
                description: error.message || "Could not upload the file",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/files/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
            toast({
                title: "File Deleted",
                description: "Drawing removed",
            });
        },
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            toast({
                title: "Invalid File",
                description: "Please upload an image or PDF",
                variant: "destructive",
            });
            return;
        }
        uploadMutation.mutate(file);
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="drawings" className="w-full">
                <TabsList className="bg-slate-800 border border-slate-700 mb-4">
                    <TabsTrigger value="drawings" className="data-[state=active]:bg-slate-700">
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Drawings
                    </TabsTrigger>
                    <TabsTrigger value="elements" className="data-[state=active]:bg-slate-700">
                        <Layers className="h-4 w-4 mr-2" />
                        AI Extracted Elements
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="drawings" className="mt-0">
                    {!readOnly && (
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? "border-amber-400 bg-amber-900/10" : "border-slate-600 hover:border-slate-500"
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleChange}
                                className="hidden"
                                id="drawing-upload"
                            />
                            <label
                                htmlFor="drawing-upload"
                                className="cursor-pointer flex flex-col items-center justify-center p-4"
                            >
                                {uploadMutation.isPending ? (
                                    <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-2" />
                                ) : (
                                    <Upload className="h-10 w-10 text-slate-400 mb-2" />
                                )}
                                <p className="text-lg font-medium text-slate-200">
                                    Drop drawings here or <span className="text-amber-500">click to upload</span>
                                </p>
                                <p className="text-sm text-slate-400 mt-1">Supports Images & PDF</p>
                            </label>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                        </div>
                    ) : files && files.length > 0 ? (
                        <div className="space-y-6">
                            {/* File Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                                {files.map((file) => (
                                    <div key={file.id} className="group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="aspect-square bg-slate-900 flex items-center justify-center cursor-pointer" onClick={() => setSelectedImage(file.fileUrl)}>
                                            {file.fileType.startsWith('image/') ? (
                                                <img
                                                    src={file.fileUrl}
                                                    alt={file.originalName}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'placeholder.png';
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : (
                                                <FileText className="h-12 w-12 text-slate-500" />
                                            )}
                                            <div className={`hidden absolute inset-0 flex items-center justify-center ${file.fileType.startsWith('image/') ? '' : 'flex'}`}>
                                                <FileText className="h-12 w-12 text-slate-500" />
                                            </div>

                                            {/* Smart Label Indicator */}
                                            {file.extractionStatus === 'completed' && (
                                                <div className="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm font-medium flex items-center">
                                                    <Layers className="h-3 w-3 mr-1" />
                                                    SMART
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3">
                                            <p className="text-sm font-medium text-slate-200 truncate" title={file.originalName}>
                                                {file.originalName}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(file.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {!readOnly && (
                                            <div className="absolute top-2 right-2 transition-opacity">
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full shadow-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteMutation.mutate(file.id);
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-800/50 rounded-lg border border-slate-700/50 mt-6">
                            <ImageIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No drawings uploaded yet</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="elements" className="mt-0">
                    <ExtractedElementsPanel jobId={jobId} files={files} />
                </TabsContent>
            </Tabs>

            {/* Smart Drawing Viewer Modal */}
            {selectedImage && files && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-200">
                            {files.find(f => f.fileUrl === selectedImage)?.originalName || 'Drawing Viewer'}
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="flex-1 min-h-0 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                        <SmartDrawingLoader
                            file={files.find(f => f.fileUrl === selectedImage)!}
                            jobId={jobId}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Wrapper to fetch smart data for the viewer
import DrawingViewer from "./drawing-viewer";

function SmartDrawingLoader({ file, jobId }: { file: JobFile, jobId: string }) {
    // Fetch rooms (Orange Boxes)
    const { data: roomsData } = useQuery({
        queryKey: [`/api/jobs/${jobId}/rooms`],
        enabled: !!file.id && file.extractionStatus === 'completed',
    });

    // Fetch detailed elements (Blue Boxes)
    const { data: elementsData } = useQuery({
        queryKey: [`/api/jobs/${jobId}/elements`],
        enabled: !!file.id && file.extractionStatus === 'completed',
    });

    const smartElements = [];

    // 1. Map Rooms (Orange)
    if (roomsData?.rooms) {
        roomsData.rooms.forEach((room: any) => {
            const belongsToFile = !room.fileId || room.fileId === file.id;
            if (room.bbox && belongsToFile) {
                smartElements.push({
                    id: `room-${room.id}`,
                    type: 'room', // Styling: Orange
                    label: room.name,
                    bbox: room.bbox,
                    page: room.page || 1
                });
            }
        });
    }

    // 2. Map Elements (Blue)
    if (elementsData && Array.isArray(elementsData)) {
        elementsData.forEach((el: any) => {
            // Check file ownership
            const belongsToFile = el.fileId === file.id;

            // Only show if it has a bounding box
            if (belongsToFile && el.bbox) {
                smartElements.push({
                    id: `el-${el.id}`,
                    type: 'element', // Styling: Blue
                    label: el.description || el.elementType, // e.g. "Double Socket"
                    bbox: el.bbox,
                    page: el.page || 1,
                    details: { ...el }
                });
            }
        });
    }

    return (
        <DrawingViewer
            fileUrl={file.fileUrl}
            fileType={file.fileType}
            smartElements={smartElements}
            onElementClick={(el) => console.log('Clicked:', el)}
            fileId={file.id}
        />
    );
}
