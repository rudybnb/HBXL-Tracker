import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, X, AlertTriangle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface JobData {
  name: string;
  address: string;
  postcode: string;
  projectType: string;
  buildPhases: string[];
}

interface FileProcessResult {
  filename: string;
  jobs: JobData[];
  error?: string;
  status: 'success' | 'error' | 'processing';
}

interface BulkUploadResponse {
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;
  totalJobsCreated: number;
  results: Array<{
    filename: string;
    success: boolean;
    jobsCreated: number;
    error?: string;
  }>;
}

export default function BulkCsvUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileResults, setFileResults] = useState<FileProcessResult[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkUploadMutation = useMutation<BulkUploadResponse, Error, File[]>({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`csvFiles`, file);
      });
      
      const response = await fetch('/api/bulk-upload-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Bulk upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Upload Complete",
        description: `${data.successfulUploads}/${data.totalFiles} files processed successfully. Created ${data.totalJobsCreated} jobs total.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csv-uploads'] });
      handleClear();
    },
    onError: (error) => {
      toast({
        title: "Bulk Upload Failed",
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
    
    // Handle both formats
    const isOriginalFormat = lines.some(line => line.startsWith('Name,') && !line.includes('Address,Postcode'));
    
    if (isOriginalFormat) {
      // Original format parsing
      let jobName = "Data Missing from CSV";
      let jobAddress = "Data Missing from CSV";
      let jobPostcode = "Data Missing from CSV";
      let jobType = "Data Missing from CSV";
      let phases: string[] = [];

      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        const parts = line.split(',');
        
        if (parts[0] === 'Name' && parts.length > 1) {
          jobName = parts.slice(1).join(',').trim();
        } else if (parts[0].trim() === 'Address' && parts.length > 1) {
          jobAddress = parts.slice(1).join(',').trim();
        } else if (parts[0] === 'Post code' && parts.length > 1) {
          jobPostcode = parts.slice(1).join(',').trim().toUpperCase();
        } else if (parts[0] === 'Project Type' && parts.length > 1) {
          jobType = parts.slice(1).join(',').trim();
        }
      }

      // Parse build phases from data section
      const dataHeaderIndex = lines.findIndex(line => 
        line.includes('Order Date') && line.includes('Build Phase')
      );
      
      if (dataHeaderIndex >= 0) {
        const headers = lines[dataHeaderIndex].split(',').map(h => h.trim());
        const phaseColumnIndex = headers.indexOf('Build Phase');
        
        if (phaseColumnIndex >= 0) {
          for (let i = dataHeaderIndex + 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const phase = values[phaseColumnIndex];
            if (phase && phase !== '' && !phases.includes(phase)) {
              phases.push(phase);
            }
          }
        }
      }

      jobs.push({
        name: jobName,
        address: jobAddress,
        postcode: jobPostcode,
        projectType: jobType,
        buildPhases: phases.length > 0 ? phases : ["No phases specified"]
      });
    } else {
      // Table format: Name,Address,Postcode,ProjectType,BuildPhases
      for (let i = 1; i < lines.length && i <= 10; i++) {
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
    }
    
    return jobs;
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setProcessProgress(0);
    const results: FileProcessResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessProgress((i / files.length) * 100);

      try {
        const jobs = await parseCSV(file);
        results.push({
          filename: file.name,
          jobs,
          status: 'success'
        });
      } catch (error) {
        results.push({
          filename: file.name,
          jobs: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error'
        });
      }
    }

    setProcessProgress(100);
    setFileResults(results);
    setIsProcessing(false);
    setShowPreview(true);

    const successCount = results.filter(r => r.status === 'success').length;
    const totalJobs = results.reduce((sum, r) => sum + r.jobs.length, 0);
    
    toast({
      title: "Files Processed",
      description: `${successCount}/${files.length} files processed successfully. Found ${totalJobs} jobs total.`,
    });
  };

  const handleFileSelect = async (files: FileList) => {
    const csvFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      toast({
        title: "No CSV Files",
        description: "Please select CSV files only",
        variant: "destructive",
      });
      return;
    }

    if (csvFiles.length > 50) {
      toast({
        title: "Too Many Files",
        description: "Maximum 50 files allowed per upload",
        variant: "destructive",
      });
      return;
    }

    const oversizedFiles = csvFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Files Too Large",
        description: `${oversizedFiles.length} files exceed 10MB limit`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(csvFiles);
    await processFiles(csvFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setFileResults([]);
    setShowPreview(false);
    setProcessProgress(0);
  };

  const handleBulkUpload = () => {
    const successfulFiles = selectedFiles.filter((file, index) => 
      fileResults[index]?.status === 'success'
    );
    
    if (successfulFiles.length > 0) {
      bulkUploadMutation.mutate(successfulFiles);
    }
  };

  const totalJobs = fileResults.reduce((sum, result) => sum + result.jobs.length, 0);
  const successfulFiles = fileResults.filter(r => r.status === 'success').length;

  return (
    <div className="space-y-6">
      {/* Bulk File Upload Area */}
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
        <FolderOpen className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Upload Multiple CSV Files
          </p>
          <p className="text-sm text-slate-500">
            Support up to 50 files at once. Supports both original and table formats.
          </p>
          <div className="flex justify-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                className="hidden"
              />
              <Button variant="outline" className="mt-2">
                Choose Files
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="h-5 w-5 animate-pulse" />
            <span className="font-medium">Processing files...</span>
          </div>
          <Progress value={processProgress} className="h-2" />
          <p className="text-sm text-slate-500 mt-2">
            {Math.round(processProgress)}% complete
          </p>
        </div>
      )}

      {/* Results Preview */}
      {showPreview && fileResults.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bulk Upload Results ({successfulFiles}/{fileResults.length} files, {totalJobs} jobs)
            </h3>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {successfulFiles}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Successful</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {fileResults.length - successfulFiles}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Failed</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {totalJobs}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Jobs</div>
            </div>
          </div>
          
          {/* File Details */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {fileResults.map((result, index) => (
              <div key={index} className={`border rounded-lg p-4 ${
                result.status === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{result.filename}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {result.status === 'success' ? `${result.jobs.length} jobs` : 'Error'}
                  </span>
                </div>
                {result.error && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                )}
                {result.status === 'success' && result.jobs.length > 0 && (
                  <div className="mt-2 text-sm text-slate-600">
                    Sample: {result.jobs[0].name} - {result.jobs[0].address} ({result.jobs[0].postcode})
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              onClick={handleBulkUpload} 
              disabled={bulkUploadMutation.isPending || successfulFiles === 0}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {bulkUploadMutation.isPending ? "Uploading..." : `Create ${totalJobs} Jobs`}
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