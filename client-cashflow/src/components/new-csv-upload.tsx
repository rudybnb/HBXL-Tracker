import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface JobData {
  name: string;
  address: string;
  postcode: string;
  projectType: string;
  buildPhases: string[];
}

interface CSVUploadResponse {
  upload: {
    id: string;
    filename: string;
    status: string;
    jobsCount: string;
  };
  jobsCreated: number;
}

export default function NewCsvUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewJobs, setPreviewJobs] = useState<JobData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation<CSVUploadResponse, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Created ${data.jobsCreated} job(s) from ${data.upload.filename}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csv-uploads'] });
      handleClear();
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const parseCSV = async (file: File): Promise<JobData[]> => {
    const content = await file.text();
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
      throw new Error('CSV must have headers and at least one data row');
    }

    const jobs: JobData[] = [];
    
    // Simple table format: Name,Address,Postcode,ProjectType,BuildPhases
    for (let i = 1; i < lines.length && i <= 10; i++) { // Max 10 jobs
      const parts = lines[i].split(',');
      if (parts.length >= 4) {
        const buildPhasesStr = parts[4]?.replace(/"/g, '').trim() || "";
        const buildPhases = buildPhasesStr ? buildPhasesStr.split(',').map(p => p.trim()).filter(p => p) : [];
        
        jobs.push({
          name: parts[0]?.trim() || "Missing Name",
          address: parts[1]?.trim() || "Missing Address", 
          postcode: parts[2]?.trim()?.toUpperCase() || "Missing Postcode",
          projectType: parts[3]?.trim() || "Missing Project Type",
          buildPhases: buildPhases.length > 0 ? buildPhases : ["No phases specified"]
        });
      }
    }
    
    return jobs;
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large", 
        description: "File must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setSelectedFile(file);
      const jobs = await parseCSV(file);
      setPreviewJobs(jobs);
      setShowPreview(true);
      
      toast({
        title: "File Processed",
        description: `Found ${jobs.length} job(s) ready to upload`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to process CSV",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewJobs([]);
    setShowPreview(false);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          dragActive 
            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' 
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDrag}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
      >
        <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Upload CSV File
          </p>
          <p className="text-sm text-slate-500">
            Format: Name,Address,Postcode,ProjectType,BuildPhases
          </p>
          <div className="flex justify-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              <Button variant="outline" className="mt-2">
                Choose File
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
          Required CSV Format
        </h3>
        <div className="bg-white dark:bg-slate-900 p-3 rounded border font-mono text-sm">
          <div>Name,Address,Postcode,ProjectType,BuildPhases</div>
          <div>Xavier jones,Erith,DA7 6HJ,New Build,"Masonry Shell,Joinery 1st Fix"</div>
          <div>John Smith,London,SE1 2AB,Renovation,"Foundation,Ground Floor"</div>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && previewJobs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Preview ({previewJobs.length} job{previewJobs.length !== 1 ? 's' : ''})
            </h3>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {previewJobs.map((job, index) => (
              <div key={index} className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Name:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{job.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Postcode:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{job.postcode}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Address:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{job.address}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Type:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{job.projectType}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Build Phases:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {job.buildPhases.map((phase, phaseIndex) => (
                      <span
                        key={phaseIndex}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {phase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              onClick={handleUpload} 
              disabled={uploadMutation.isPending}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {uploadMutation.isPending ? "Uploading..." : "Create Jobs"}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}