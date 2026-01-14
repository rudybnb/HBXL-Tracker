import React, { useState } from 'react';
import { XLSXUploader } from '../components/XLSXUploader';
import { FileText, Database, TrendingUp, Users } from 'lucide-react';

export function ImportData() {
  const [importedData, setImportedData] = useState<any>(null);

  const handleUploadComplete = (data: any) => {
    console.log('📊 Data imported successfully:', data);
    setImportedData(data);
  };

  const handleUploadError = (error: string) => {
    console.error('❌ Upload error:', error);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">Import Data</h1>
          <p className="text-slate-400 text-lg">
            Upload your XLSX file to automatically extract all project data in one step.
            The system will detect and import contractors, jobs, work sessions, and material costs.
          </p>
        </div>

        {/* Benefits Section */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center mb-4">
              <FileText className="w-8 h-8 text-amber-400 mr-3" />
              <div>
                <h3 className="text-white font-semibold">Single Upload</h3>
                <p className="text-slate-400 text-sm">One file, all data</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center mb-4">
              <Database className="w-8 h-8 text-blue-400 mr-3" />
              <div>
                <h3 className="text-white font-semibold">Auto Detection</h3>
                <p className="text-slate-400 text-sm">Smart data extraction</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center mb-4">
              <Users className="w-8 h-8 text-green-400 mr-3" />
              <div>
                <h3 className="text-white font-semibold">Complete Setup</h3>
                <p className="text-slate-400 text-sm">Ready to use instantly</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center mb-4">
              <TrendingUp className="w-8 h-8 text-purple-400 mr-3" />
              <div>
                <h3 className="text-white font-semibold">Live Tracking</h3>
                <p className="text-slate-400 text-sm">Immediate cash flow</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Component */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 mb-8">
          <XLSXUploader 
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>

        {/* Import Results */}
        {importedData && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
            <h2 className="text-xl font-bold text-white mb-6">Import Summary</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400 mb-2">
                  {importedData.summary.contractorsFound}
                </div>
                <div className="text-slate-300 font-medium">Contractors</div>
                <div className="text-slate-500 text-sm">Added to payroll system</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">
                  {importedData.summary.jobsFound}
                </div>
                <div className="text-slate-300 font-medium">Projects</div>
                <div className="text-slate-500 text-sm">Ready for assignment</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">
                  {importedData.summary.workSessionsFound}
                </div>
                <div className="text-slate-300 font-medium">Work Sessions</div>
                <div className="text-slate-500 text-sm">Time tracking data</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">
                  {importedData.summary.materialsFound}
                </div>
                <div className="text-slate-300 font-medium">Materials</div>
                <div className="text-slate-500 text-sm">Cost tracking items</div>
              </div>
            </div>

            {/* Detailed Lists */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contractors */}
              {importedData.contractors && importedData.contractors.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Imported Contractors ({importedData.contractors.length})
                  </h3>
                  <div className="space-y-3">
                    {importedData.contractors.slice(0, 5).map((contractor: any, index: number) => (
                      <div key={index} className="bg-slate-700 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-white">{contractor.name}</div>
                          <div className="text-amber-400 font-medium">£{contractor.payRate}/hour</div>
                        </div>
                        <div className="text-slate-400 text-sm mt-1">{contractor.email}</div>
                      </div>
                    ))}
                    {importedData.contractors.length > 5 && (
                      <div className="text-slate-400 text-sm text-center">
                        ... and {importedData.contractors.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Jobs */}
              {importedData.jobs && importedData.jobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Imported Projects ({importedData.jobs.length})
                  </h3>
                  <div className="space-y-3">
                    {importedData.jobs.slice(0, 5).map((job: any, index: number) => (
                      <div key={index} className="bg-slate-700 p-4 rounded-lg">
                        <div className="font-medium text-white">{job.name}</div>
                        <div className="text-slate-400 text-sm mt-1">{job.address}</div>
                        <div className="text-blue-400 text-sm font-medium mt-1">
                          Budget: £{job.budget.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {importedData.jobs.length > 5 && (
                      <div className="text-slate-400 text-sm text-center">
                        ... and {importedData.jobs.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Next Steps */}
            <div className="mt-8 p-6 bg-slate-700 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">Next Steps</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-amber-400 font-medium">1. Review Data</div>
                  <div className="text-slate-300 text-sm">Check imported information</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-medium">2. Add Job Quotes</div>
                  <div className="text-slate-300 text-sm">Set project pricing</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-medium">3. Start Tracking</div>
                  <div className="text-slate-300 text-sm">Monitor cash flow</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}