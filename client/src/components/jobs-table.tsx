import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Loader2, Upload, FileText, UserPlus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobWithContractor } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface JobsTableProps {
  onAssignJob: (job?: JobWithContractor) => void;
}

export default function JobsTable({ onAssignJob }: JobsTableProps) {
  const [_, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<JobWithContractor[]>({
    queryKey: ['/api/jobs', { status: statusFilter === 'all' ? '' : statusFilter, search: searchTerm }],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/jobs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job Created", description: "New job added successfully." });
      setIsCreateOpen(false);
    },
    onError: (error) => {
      toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job Deleted", description: "The job and all associated data have been removed." });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const data = {
      title: fd.get("title"),
      clientName: fd.get("clientName"),
      location: fd.get("location"),
      dueDate: fd.get("dueDate"),
      description: fd.get("description"),
      contractorName: "Unassigned", // Default
      status: "pending"
    };
    createMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'assigned': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      default: return 'bg-slate-700 text-slate-300 border border-slate-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getContractorInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700/50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-1">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search jobs, clients, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-primary-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {/* Import Button */}
          <div className="relative">
            <input
              id="new-job-import"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const fd = new FormData();
                  fd.append('file', file);
                  toast({ title: "Importing...", description: "Creating job from CSV..." });

                  fetch('/api/jobs/import-new-from-csv', {
                    method: 'POST',
                    body: fd
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        toast({ title: "Success", description: "Job created from CSV" });
                        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                      } else {
                        throw new Error(data.error || "Import failed");
                      }
                    })
                    .catch(err => {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    });

                  e.target.value = '';
                }
              }}
            />
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => document.getElementById('new-job-import')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
          </div>

          {/* Manual Create */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20">
                <Plus className="h-4 w-4 mr-2" /> New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 text-slate-100 border-slate-700">
              <DialogHeader>
                <DialogTitle>Create New Job</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Manually enter job details. You can import HBXL data later.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateJob} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-slate-200">Job Title</Label>
                  <Input id="title" name="title" placeholder="e.g. Extension - 12 High St" required className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="text-slate-200">Client Name</Label>
                  <Input id="clientName" name="clientName" placeholder="e.g. John Doe" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-slate-200">Location / Postcode</Label>
                  <Input id="location" name="location" placeholder="e.g. London, SW1" required className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-slate-200">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" required className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-200">Description</Label>
                  <Textarea id="description" name="description" placeholder="Optional job details..." className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Job
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700/50">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Contractor</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {jobs.length > 0 ? jobs.map((job) => {
                // Derived values for display cleanup
                const displayClient = job.clientName || (job.title.includes('-') ? job.title.split('-')[1].trim() : '-');
                const displayType = job.projectType || (job.title.includes('-') ? job.title.split('-')[0].trim() : job.title);

                return (
                  <tr key={job.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-white">{displayClient}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-400">{job.location}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-amber-400/80">
                        {displayType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {job.contractor ? (
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 mr-3">
                            <span className="text-slate-200 text-xs font-bold">
                              {getContractorInitials(job.contractor.name)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-200">{job.contractor.name}</span>
                            <span className="text-xs text-slate-500">{job.contractor.specialty}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {formatDate(job.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {job.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAssignJob(job)}
                            className="text-primary-400 hover:text-primary-300 hover:bg-primary-900/20"
                            title="Assign Contractor"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/jobs/${job.id}/tender`)}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                          title="View QS Tender"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete "${job.title}"? This will remove all associated drawings, elements, and cost data.`)) {
                              deleteMutation.mutate(job.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          title="Delete Job"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <FileText className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-slate-400">No jobs found</p>
                      <p className="text-sm">Get started by creating a new job or importing a CSV.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div >

        {/* Pagination Footer (Static for now) */}
        {
          jobs.length > 0 && (
            <div className="bg-slate-900/30 px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {jobs.length} job(s)
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled className="text-slate-500">Previous</Button>
                <Button variant="ghost" size="sm" disabled className="text-slate-500">Next</Button>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
}
