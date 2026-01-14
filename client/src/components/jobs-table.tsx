import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { JobWithContractor } from "@shared/schema";

interface JobsTableProps {
  onAssignJob: (job?: JobWithContractor) => void;
}

export default function JobsTable({ onAssignJob }: JobsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: jobs = [], isLoading } = useQuery<JobWithContractor[]>({
    queryKey: ['/api/jobs', { status: statusFilter === 'all' ? '' : statusFilter, search: searchTerm }],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getContractorInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Recent Jobs</h3>
            <p className="text-sm text-slate-600 mt-1">Manage and assign jobs to contractors</p>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-48"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Job Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contractor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {jobs.length > 0 ? jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{job.title}</div>
                    <div className="text-sm text-slate-500">{job.location}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {job.contractor ? (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white text-xs font-medium">
                          {getContractorInitials(job.contractor.name)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{job.contractor.name}</div>
                        <div className="text-sm text-slate-500">{job.contractor.specialty}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Unassigned</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {formatDate(job.dueDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {job.status === 'pending' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAssignJob(job)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      Assign
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      View
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    {job.status === 'completed' ? 'Report' : 'Edit'}
                  </Button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {jobs.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{Math.min(jobs.length, 10)}</span> of <span className="font-medium">{jobs.length}</span> jobs
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
