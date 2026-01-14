import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface XLSXUploaderProps {
  onUploadComplete?: (data: any) => void;
  onUploadError?: (error: string) => void;
}

interface UploadResult {
  success: boolean;
  message: string;
  data?: {
    summary: {
      contractorsFound: number;
      jobsFound: number;
      workSessionsFound: number;
      materialsFound: number;
    };
    contractors: any[];
    jobs: any[];
    workSessions: any[];
    materials: any[];
  };
  fileName?: string;
  sheetsProcessed?: string[];
  error?: string;
}

export function XLSXUploader({ onUploadComplete, onUploadError }: XLSXUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      const error = 'Please upload an XLSX, XLS, or CSV file';
      setUploadResult({
        success: false,
        message: error
      });
      onUploadError?.(error);
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📁 Uploading file:', file.name, 'Size:', file.size, 'bytes');

      const response = await fetch('/api/import-xlsx', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Upload successful:', result);
        setUploadResult(result);
        onUploadComplete?.(result.data);
      } else {
        console.error('❌ Upload failed:', result);
        const errorMsg = result.error || result.details || 'Upload failed';
        setUploadResult({
          success: false,
          message: errorMsg
        });
        onUploadError?.(errorMsg);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
      setUploadResult({
        success: false,
        message: errorMsg
      });
      onUploadError?.(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Import XLSX Data</h2>
        <p className="text-slate-400">
          Upload your XLSX file and the system will automatically extract:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-slate-800 p-3 rounded-lg text-center">
            <div className="text-amber-400 text-sm font-medium">👷 Contractors</div>
            <div className="text-slate-300 text-xs">Names & pay rates</div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg text-center">
            <div className="text-blue-400 text-sm font-medium">🏗️ Jobs</div>
            <div className="text-slate-300 text-xs">Addresses & budgets</div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg text-center">
            <div className="text-green-400 text-sm font-medium">⏱️ Work Sessions</div>
            <div className="text-slate-300 text-xs">Times & dates</div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg text-center">
            <div className="text-purple-400 text-sm font-medium">🧱 Materials</div>
            <div className="text-slate-300 text-xs">Costs & descriptions</div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-amber-400 bg-amber-400/5'
            : 'border-slate-600 hover:border-slate-500'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader className="w-12 h-12 text-amber-400 animate-spin mb-4" />
            <p className="text-white font-medium">Processing XLSX file...</p>
            <p className="text-slate-400 text-sm mt-1">Extracting contractors, jobs, and financial data</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex items-center mb-4">
              <FileSpreadsheet className="w-12 h-12 text-amber-400 mr-3" />
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-white font-medium mb-2">
              Drop your XLSX file here or click to browse
            </p>
            <p className="text-slate-400 text-sm">
              Supports .xlsx, .xls, and .csv files up to 10MB
            </p>
          </div>
        )}
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`mt-6 p-6 rounded-xl ${
          uploadResult.success 
            ? 'bg-green-900/20 border border-green-800' 
            : 'bg-red-900/20 border border-red-800'
        }`}>
          <div className="flex items-start">
            {uploadResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-medium ${
                uploadResult.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {uploadResult.success ? 'Import Successful!' : 'Import Failed'}
              </h3>
              <p className="text-slate-300 mt-1">{uploadResult.message}</p>
              
              {uploadResult.success && uploadResult.data && (
                <div className="mt-4">
                  <p className="text-slate-300 font-medium mb-3">Data Extracted:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-3 rounded text-center">
                      <div className="text-2xl font-bold text-amber-400">
                        {uploadResult.data.summary.contractorsFound}
                      </div>
                      <div className="text-xs text-slate-400">Contractors</div>
                    </div>
                    <div className="bg-slate-800 p-3 rounded text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {uploadResult.data.summary.jobsFound}
                      </div>
                      <div className="text-xs text-slate-400">Jobs</div>
                    </div>
                    <div className="bg-slate-800 p-3 rounded text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {uploadResult.data.summary.workSessionsFound}
                      </div>
                      <div className="text-xs text-slate-400">Work Sessions</div>
                    </div>
                    <div className="bg-slate-800 p-3 rounded text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {uploadResult.data.summary.materialsFound}
                      </div>
                      <div className="text-xs text-slate-400">Materials</div>
                    </div>
                  </div>
                  
                  {uploadResult.fileName && (
                    <p className="text-slate-400 text-sm mt-3">
                      File: {uploadResult.fileName}
                    </p>
                  )}
                  
                  {uploadResult.sheetsProcessed && uploadResult.sheetsProcessed.length > 0 && (
                    <p className="text-slate-400 text-sm">
                      Sheets: {uploadResult.sheetsProcessed.join(', ')}
                    </p>
                  )}
                </div>
              )}
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                >
                  Upload Another File
                </button>
                {uploadResult.success && (
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                  >
                    Refresh Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}