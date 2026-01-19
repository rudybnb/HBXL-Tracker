import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ContextualTooltip from "./contextual-tooltip";
import { useWorkflowHelp, WORKFLOW_CONFIGS } from "@/hooks/use-workflow-help";

interface CsvUpload {
  id: string;
  filename: string;
  status: "processing" | "processed" | "failed";
  jobsCount: string;
  createdAt: string;
}

interface UploadSuccessData {
  upload: CsvUpload;
  jobsCreated: number;
  jobId?: string; // We need the BE to return the first Job ID to link to it
}

interface UploadResponse {
  upload: CsvUpload;
  jobsCreated: number;
}

interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  rawData: {
    headers: string[];
    rows: string[][];
  };
  jobPreview: Array<{
    name: string;
    address: string;
    postcode: string;
    projectType: string;
    buildPhases: string[];
  }>;
}

export default function UploadCsv() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize workflow help for CSV upload process
  const workflowHelp = useWorkflowHelp(WORKFLOW_CONFIGS.csvUpload);
  const [lastUploadJobId, setLastUploadJobId] = useState<string | null>(null);

  const uploadMutation = useMutation<UploadSuccessData, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Upload failed with status ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Mark workflow steps as completed
      workflowHelp.markStepCompleted('file-selection');
      workflowHelp.markStepCompleted('file-validation');
      workflowHelp.markStepCompleted('data-processing');
      workflowHelp.markStepCompleted('job-creation');

      toast({
        title: "File Upload Successful",
        description: `Created ${data.jobsCreated} job(s) from ${data.upload.filename}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/csv-uploads'] });

      // Clear all form data after successful upload
      handleClearData();

      // Store the last job ID if available (needs backend update or multiple jobs link)
      // For now, if jobsCreated > 0, we can show a general link or try to get the ID.
      // Since the backend returns `jobsCreated`, we might need to fetch the latest job or assume.
      // Ideally, the BE response should include the Job IDs.
      // Let's assume for this "QS Demo" that we want to jump to the dashboard or similar.
      // But actually, the prompt asked for "Tender Document".
      // I will add a button "View Computed Tenders" or similar.
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
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





  const validateFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file (.csv) or Excel file (.xlsx)",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const parseCSVPreview = async (file: File): Promise<CSVPreviewData | null> => {
    try {
      const csvContent = await file.text();
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

      if (lines.length < 4) {
        throw new Error('CSV must contain Name, Address, Post code, and Project Type headers');
      }

      // SUPPORT BOTH FORMATS - MANDATORY RULE: NEVER REWRITE WORKING CODE
      let jobName = "Data Missing from CSV";
      let jobAddress = "Data Missing from CSV";
      let jobPostcode = "Data Missing from CSV";
      let jobType = "Data Missing from CSV";
      let phases: string[] = [];

      // Enhanced parsing for the new accounting CSV format
      const enhancedFormatIndex = lines.findIndex(line =>
        line.includes('Order Date') && line.includes('Build Phase') && (line.includes('Resource Description') || line.includes('Type of Resource'))
      );

      if (enhancedFormatIndex !== -1) {
        // ENHANCED FORMAT PARSING - for accounting integration
        console.log('🎯 Using ENHANCED CSV parsing for frontend preview');

        // Extract header information (first 4 lines)
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
          const line = lines[i];

          if (line.startsWith('Name ,') || line.startsWith('Name,') || line.startsWith('name,')) {
            const extracted = line.substring(line.indexOf(',') + 1).replace(/,+$/, '').trim();
            jobName = extracted || "Data Missing from CSV";
          } else if (line.startsWith('Address,') || line.startsWith('Address ,')) {
            const extracted = line.substring(line.indexOf(',') + 1).replace(/,+$/, '').trim();
            jobAddress = extracted || "Data Missing from CSV";
          } else if (line.startsWith('Post Code ,') || line.startsWith('Post code,')) {
            const colonIndex = line.indexOf(',');
            const extracted = line.substring(colonIndex + 1).replace(/,+$/, '').trim().toUpperCase();
            jobPostcode = extracted || "Data Missing from CSV";
          } else if (line.startsWith('Project Type,')) {
            const extracted = line.substring(13).replace(/,+$/, '').trim();
            jobType = extracted || "Data Missing from CSV";
          }
        }

        // Parse phases/rooms from enhanced CSV data - find Build Phase OR Room column dynamically
        const headerLine = lines[enhancedFormatIndex];
        const enhancedHeaders = headerLine.split(',').map(h => h.trim().toLowerCase());
        const phaseSet = new Set<string>();

        let targetColumnIndex = enhancedHeaders.findIndex(h =>
          h.includes('room') || h.includes('location') || h.includes('area')
        );

        const isRoom = targetColumnIndex >= 0;

        if (!isRoom) {
          targetColumnIndex = enhancedHeaders.findIndex(h =>
            h.includes('build phase') || h.includes('phase')
          );
        }

        console.log('🔍 Grouping column detection:', {
          headerLine,
          isRoom,
          targetColumnIndex,
          foundHeader: enhancedHeaders[targetColumnIndex]
        });

        if (targetColumnIndex >= 0) {
          for (let i = enhancedFormatIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trim() === '') continue;

            const parts = line.split(',').map(p => p.trim());
            if (parts.length <= targetColumnIndex) continue;

            const value = parts[targetColumnIndex] || '';
            if (value && value.trim() !== '' && value.toLowerCase() !== 'material' && value.toLowerCase() !== 'labour') {
              phaseSet.add(value);
              console.log(`✅ Found ${isRoom ? 'room' : 'phase'}:`, value);
            }
          }
        }
        phases = Array.from(phaseSet);

      } else {
        // Check if it's the original format (Name,Xavier jones or name,Flat1)
        const isOriginalFormat = lines.some(line =>
          (line.startsWith('Name,') || line.startsWith('name,')) && !line.includes('Address,Postcode')
        );

        if (isOriginalFormat) {
          // LOCKED DOWN PARSING LOGIC - NEVER CHANGE THIS SECTION
          for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];

            if (line.startsWith('Name,') || line.startsWith('name,')) {
              // Extract everything after "Name," or "name," and remove trailing commas
              const extracted = line.substring(line.indexOf(',') + 1).replace(/,+$/, '').trim();
              jobName = extracted || "Data Missing from CSV";
            } else if (line.startsWith('Address,') || line.startsWith('Address ,')) {
              // Extract everything after first comma and remove trailing commas  
              const extracted = line.substring(line.indexOf(',') + 1).replace(/,+$/, '').trim();
              jobAddress = extracted || "Data Missing from CSV";
            } else if (line.startsWith('Post code,')) {
              // Extract everything after "Post code," and remove trailing commas
              const extracted = line.substring(10).replace(/,+$/, '').trim().toUpperCase();
              jobPostcode = extracted || "Data Missing from CSV";
            } else if (line.startsWith('Project Type,')) {
              // Extract everything after "Project Type," and remove trailing commas
              const extracted = line.substring(13).replace(/,+$/, '').trim();
              jobType = extracted || "Data Missing from CSV";
            }
          }

          // Parse data section for build phases
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
        } else {
          // NEW TABLE FORMAT: Name,Address,Postcode,ProjectType,BuildPhases
          if (lines.length >= 2) {
            const firstDataLine = lines[1];
            const dataParts = firstDataLine.split(',');

            jobName = dataParts[0]?.trim() || "Data Missing";
            jobAddress = dataParts[1]?.trim() || "Data Missing";
            jobPostcode = dataParts[2]?.trim()?.toUpperCase() || "Data Missing";
            jobType = dataParts[3]?.trim() || "Data Missing";
            const buildPhasesStr = dataParts[4]?.trim().replace(/"/g, '') || "";

            phases = buildPhasesStr ? buildPhasesStr.split(',').map(p => p.trim()).filter(p => p) : [];
          }
        }
      }

      console.log('✅ CSV PARSING DEBUG:', {
        enhancedFormat: enhancedFormatIndex !== -1,
        rawLines: lines.slice(0, 5),
        extracted: { jobName, jobAddress, jobPostcode, jobType, phases }
      });

      // Create raw data preview
      const rawData = {
        headers: ['Name', 'Address', 'Postcode', 'Project Type', 'Build Phases'],
        rows: [[jobName, jobAddress, jobPostcode, jobType, phases.join(', ')]]
      };

      const jobPreview = [{
        name: jobName,
        address: jobAddress,
        postcode: jobPostcode,
        projectType: jobType,
        buildPhases: phases.length > 0 ? phases : ["No phases specified"]
      }];

      return {
        headers: rawData.headers,
        rows: rawData.rows,
        rawData: rawData,
        jobPreview: jobPreview
      };
    } catch (error) {
      toast({
        title: "CSV Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse CSV file",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        const preview = await parseCSVPreview(file);
        setCsvPreview(preview);
        if (preview) {
          setShowPreview(true);
          workflowHelp.markStepCompleted('file-selection');
          workflowHelp.markStepCompleted('file-validation');
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        const preview = await parseCSVPreview(file);
        setCsvPreview(preview);
        if (preview) {
          setShowPreview(true);
          workflowHelp.markStepCompleted('file-selection');
          workflowHelp.markStepCompleted('file-validation');
        }
      }
    }
  };

  const handleClearData = () => {
    setSelectedFile(null);
    setCsvPreview(null);
    setShowPreview(false);
    // Clear the file input
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    toast({
      title: "Data Cleared",
      description: "Selected file and preview data have been cleared",
    });
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
      <div className="flex flex-col items-center justify-center space-y-4 p-8 opacity-50">
        <Upload className="h-12 w-12 text-slate-500" />
        <h3 className="text-xl font-semibold text-slate-300">CSV Import Disabled</h3>
        <p className="text-slate-400 max-w-md">
          Job creation via CSV is temporarily disabled to focus on Drawing Extraction features.
          Please use existing jobs.
        </p>
      </div>
    </div>
  );
}