import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import ContextualTooltip from "./contextual-tooltip";

interface JobFile {
    id: string;
    filename: string;
    originalName: string;
    fileUrl: string;
    fileType: string;
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
                throw new Error(errorData.error || errorData.details || 'Upload failed');
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {files.map((file) => (
                        <div key={file.id} className="group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="aspect-square bg-slate-900 flex items-center justify-center cursor-pointer" onClick={() => setSelectedImage(file.fileUrl)}>
                                {file.fileType.startsWith('image/') ? (
                                    <img
                                        src={file.fileUrl}
                                        alt={file.originalName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Fallback if image fails to load
                                            (e.target as HTMLImageElement).src = 'placeholder.png'; // Or logic to show icon
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : (
                                    <FileText className="h-12 w-12 text-slate-500" />
                                )}
                                {/* Fallback Icon if image fails or for PDFs */}
                                <div className={`hidden absolute inset-0 flex items-center justify-center ${file.fileType.startsWith('image/') ? '' : 'flex'}`}>
                                    <FileText className="h-12 w-12 text-slate-500" />
                                </div>
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
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 rounded-full"
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
            ) : (
                <div className="text-center py-10 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <ImageIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No drawings uploaded yet</p>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <button
                        className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="h-8 w-8" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Preview"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                    />
                </div>
            )}
        </div>
    );
}
