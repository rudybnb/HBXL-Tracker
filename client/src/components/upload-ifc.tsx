
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
    jobId: string;
    onUploadComplete: () => void;
    accept?: string;
}

export function UploadIfc({ jobId, onUploadComplete, accept }: Props) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check against `accept` prop if provided, else default to .ifc or .dxf
        const allowed = accept ? accept.split(',') : ['.ifc', '.dxf'];
        const isValid = allowed.some(ext => file.name.toLowerCase().endsWith(ext.trim()));

        if (!isValid) {
            toast({ title: "Invalid File", description: `Please select a valid file (${allowed.join(', ')})`, variant: "destructive" });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/jobs/${jobId}/files`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            // Wait a moment for DB propagation
            await new Promise(r => setTimeout(r, 500));

            await queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            toast({ title: "Upload Successful", description: "Model file processed." });
            onUploadComplete();
        } catch (error) {
            console.error(error);
            toast({ title: "Upload Failed", description: "Could not upload file.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-12 bg-slate-50 border-2 border-dashed border-slate-200 m-4 rounded-xl">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                <UploadCloud className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Model</h3>
            <p className="text-slate-500 mb-8 text-center max-w-sm">
                {accept === '.dxf'
                    ? "Please upload a DXF file for a guaranteed 2D floor plan view."
                    : "To start defining rooms, please upload a valid Industry Foundation Classes (.ifc) or Drawing Exchange Format (.dxf) file."
                }
            </p>

            <label className="cursor-pointer relative">
                <input
                    type="file"
                    accept={accept || ".ifc,.dxf"}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />
                <Button size="lg" className="relative z-0 min-w-[160px]">
                    {isUploading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Uploading...</> : (accept === '.dxf' ? "Select DXF File" : "Select Model File")}
                </Button>
            </label>

            <p className="text-xs text-slate-400 mt-4">
                Supported formats: {accept === '.dxf' ? 'DXF Only' : 'IFC 2x3, IFC4, DXF'}
            </p>
        </div>
    );
}
