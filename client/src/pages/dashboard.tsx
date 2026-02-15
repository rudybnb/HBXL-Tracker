import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StatsCards from "@/components/stats-cards";
import UploadCsv from "@/components/upload-csv";
import JobsTable from "@/components/jobs-table";
import ContractorsOverview from "@/components/contractors-overview";
import JobAssignmentModal from "@/components/job-assignment-modal";
import type { JobWithContractor, Contractor } from "@shared/schema";

export default function Dashboard() {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithContractor | null>(null);

  const { data: stats } = useQuery<{
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    activeContractors: number;
  }>({
    queryKey: ['/api/stats'],
  });

  const { data: contractors } = useQuery<Contractor[]>({
    queryKey: ['/api/contractors'],
  });

  const handleAssignJob = (job?: JobWithContractor) => {
    setSelectedJob(job || null);
    setIsAssignModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAssignModalOpen(false);
    setSelectedJob(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-700">
                  <i className="fas fa-tasks mr-2"></i>ERdesignandbuild
                </h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <span className="bg-primary-50 text-primary-700 px-3 py-2 rounded-md text-sm font-medium">Dashboard</span>
                  <span className="text-slate-600 px-3 py-2 rounded-md text-sm font-medium">Jobs</span>
                  <span className="text-slate-600 px-3 py-2 rounded-md text-sm font-medium">Contractors</span>
                  <span className="text-slate-600 px-3 py-2 rounded-md text-sm font-medium">Reports</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-slate-500 hover:text-slate-700">
                <i className="fas fa-bell text-lg"></i>
              </button>
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h2>
          <p className="text-slate-600">Manage your job assignments and track contractor progress</p>
        </div>

        {/* Stats Cards */}
        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File Upload Section */}
          <div className="lg:col-span-1">
            <UploadCsv />
          </div>

          {/* Jobs Table */}
          <div className="lg:col-span-2">
            <JobsTable onAssignJob={handleAssignJob} />
          </div>
        </div>

        {/* Contractor Management Section */}
        <ContractorsOverview onAssignJob={handleAssignJob} />
      </div>

      {/* Job Assignment Modal */}
      <JobAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={handleCloseModal}
        selectedJob={selectedJob}
        contractors={contractors || []}
      />
    </div>
  );
}
