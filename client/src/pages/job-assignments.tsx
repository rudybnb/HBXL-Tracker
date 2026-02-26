import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function LogoutButton() {
  const handleLogout = () => {
    // Clear all localStorage data
    localStorage.clear();
    // Force page reload to ensure clean state
    window.location.href = '/login';
    window.location.reload();
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-slate-800 rounded-lg p-2 border border-slate-600 shadow-lg">
      <div className="flex items-center space-x-2">
        <span className="text-yellow-400 text-sm font-medium">Admin</span>
        <Button
          onClick={handleLogout}
          size="sm"
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function JobAssignments() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [inspectionStatus, setInspectionStatus] = useState<Record<string, 'approved' | 'issues'>>({});
  const [inspectionNotes, setInspectionNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // ── Tender lifecycle helpers ──
  const TENDER_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    DRAFT: { label: "Draft", bg: "bg-slate-600", text: "text-slate-200" },
    SENT_FOR_PRICING: { label: "Sent for Pricing", bg: "bg-amber-600", text: "text-white" },
    SUBMITTED: { label: "Submitted", bg: "bg-blue-600", text: "text-white" },
    APPROVED: { label: "Approved", bg: "bg-green-600", text: "text-white" },
  };

  const handleSendForPricing = async (assignmentId: string) => {
    if (!confirm("Send this tender to the contractor for pricing? They will be able to enter unit prices.")) return;
    try {
      const res = await fetch(`/api/job-assignments/${assignmentId}/send-for-pricing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast({ title: "Tender Sent", description: "Contractor can now price the tender." });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleApproveTender = async (assignmentId: string) => {
    if (!confirm("Approve this tender? Pricing will be locked as the baseline.")) return;
    try {
      const res = await fetch(`/api/job-assignments/${assignmentId}/approve-tender`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast({ title: "Tender Approved", description: "Pricing is now locked as the approved baseline." });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ── Tender request state ──
  const [showTenderDialog, setShowTenderDialog] = useState(false);
  const [tenderJobId, setTenderJobId] = useState<string>('');
  const [tenderJobTitle, setTenderJobTitle] = useState<string>('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);
  const [jobPackages, setJobPackages] = useState<any[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [creatingTender, setCreatingTender] = useState(false);

  // Fetch job assignments from the database
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/job-assignments'],
    queryFn: async () => {
      const response = await fetch('/api/job-assignments');
      if (!response.ok) {
        throw new Error('Failed to fetch job assignments');
      }
      return response.json();
    }
  });

  // Fetch all jobs to show unassigned ones
  const { data: allJobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const response = await fetch('/api/jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      return response.json();
    }
  });

  // Fetch approved contractors
  const { data: allContractors = [] } = useQuery({
    queryKey: ['/api/contractor-applications'],
    queryFn: async () => {
      const response = await fetch('/api/contractor-applications');
      return response.ok ? response.json() : [];
    }
  });
  const approvedContractors = allContractors.filter((c: any) => c.status === 'approved');

  // Fetch tender requests
  const { data: tenderRequests = [], refetch: refetchTenders } = useQuery({
    queryKey: ['/api/tenders'],
    queryFn: async () => {
      const response = await fetch('/api/tenders');
      return response.ok ? response.json() : [];
    }
  });

  // Open tender creation dialog
  const openTenderDialog = async (jobId: string, jobTitle: string) => {
    setTenderJobId(jobId);
    setTenderJobTitle(jobTitle);
    setSelectedPackageIds([]);
    setSelectedContractorIds([]);
    setShowTenderDialog(true);
    setLoadingPkgs(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/packages`);
      const pkgs = res.ok ? await res.json() : [];
      // Show ALL packages, but separate ROOM_QTO from IFC
      setJobPackages(pkgs);
      // Pre-select ROOM packages by default
      const tenderablePkgs = pkgs.filter((p: any) =>
        p.source === 'ROOM_QTO' ||
        p.source === 'ROOM_SCOPE_LABOUR_V1' ||
        (p.type === 'ROOM' && p.source === 'AG_8000_ROOM_QTO')
      );
      setSelectedPackageIds(tenderablePkgs.map((p: any) => p.id));
    } catch {
      setJobPackages([]);
    }
    setLoadingPkgs(false);
  };

  // Create tender request
  const [createdTenderLinks, setCreatedTenderLinks] = useState<{ contractorName: string; submissionId: string; link: string; telegram?: boolean }[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleCreateTender = async () => {
    if (selectedPackageIds.length === 0) {
      toast({ title: 'Error', description: 'Select at least one package', variant: 'destructive' });
      return;
    }
    if (selectedContractorIds.length === 0) {
      toast({ title: 'Error', description: 'Select at least one contractor', variant: 'destructive' });
      return;
    }
    setCreatingTender(true);
    setCreatedTenderLinks([]);
    try {
      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: tenderJobId, packageIds: selectedPackageIds, contractorIds: selectedContractorIds }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || d.error || 'Failed');

      // Auto-send
      const sendRes = await fetch(`/api/tenders/${d.tenderRequestId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const sendData = await sendRes.json();

      // Build links with full URL for copying
      const baseUrl = window.location.origin;
      const links = (d.contractors || []).map((c: any) => {
        const notif = (sendData.notifications || []).find((n: any) => n.contractorName === c.contractorName);
        return {
          contractorName: c.contractorName,
          submissionId: c.submissionId,
          link: `${baseUrl}/contractor-tender-new/${c.submissionId}`,
          telegram: notif?.telegram || false,
        };
      });
      setCreatedTenderLinks(links);

      toast({ title: 'Tender Created & Sent', description: `${d.contractors.length} contractor(s) invited. ${d.itemCount} items to price.` });
      refetchTenders();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setCreatingTender(false);
  };

  const handleCopyLink = (link: string, submissionId: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLinkId(submissionId);
      toast({ title: 'Copied!', description: 'Tender link copied — paste into WhatsApp, email, etc.' });
      setTimeout(() => setCopiedLinkId(null), 3000);
    });
  };

  // Approve tender submission
  const handleApproveTenderSubmission = async (tenderRequestId: string, submissionId: string) => {
    if (!confirm('Approve this submission? An Assignment will be created from the approved pricing.')) return;
    try {
      const res = await fetch(`/api/tenders/${tenderRequestId}/submissions/${submissionId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast({ title: 'Tender Approved', description: `Assignment ${d.assignmentId.substring(0, 8)}... created. Grand total: £${d.grandTotal}` });
      refetchTenders();
      refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const unassignedJobs = allJobs.filter((job: any) => job.status === 'pending');
  const filteredUnassignedJobs = unassignedJobs.filter((job: any) =>
    job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete job');
      }

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });

      toast({
        title: "Job Deleted",
        description: "Job has been removed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/job-assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete assignment');
      }

      // Refresh the assignments list
      refetch();

      toast({
        title: "Assignment Deleted",
        description: "Job assignment has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleInspectionView = async (assignmentId: string) => {
    if (expandedAssignment === assignmentId) {
      setExpandedAssignment(null);
      setCompletedTasks([]);
      return;
    }

    setExpandedAssignment(assignmentId);

    // Load completed tasks for this assignment
    try {
      const assignment = assignments.find((a: any) => a.id === assignmentId);
      if (!assignment) return;

      // Get task progress
      const taskResponse = await fetch(`/api/task-progress/${encodeURIComponent(assignment.contractorName)}/${assignmentId}`);
      const taskProgress = await taskResponse.json();

      // Find completed tasks
      const completed: any[] = [];
      taskProgress.forEach((progressItem: any) => {
        if (progressItem.completed === true) {
          completed.push({
            taskId: progressItem.taskId,
            phase: progressItem.phase,
            taskName: progressItem.taskDescription,
            description: progressItem.taskDescription,
            progress: 100,
            completed: true,
            inspectionStatus: 'pending',
            notes: '',
            photos: []
          });
        }
      });

      setCompletedTasks(completed);
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      setCompletedTasks([]);
    }
  };

  const submitInspection = async () => {
    if (!expandedAssignment) return;

    try {
      const assignment = assignments.find((a: any) => a.id === expandedAssignment);
      if (!assignment) return;

      const inspections = completedTasks.map(task => ({
        assignmentId: expandedAssignment,
        contractorName: assignment.contractorName,
        taskId: task.taskId,
        phase: task.phase,
        taskName: task.taskName,
        inspectionStatus: inspectionStatus[task.taskId] || 'pending',
        notes: inspectionNotes[task.taskId] || '',
        inspectedBy: localStorage.getItem('adminName') || 'Admin',
        inspectedAt: new Date().toISOString(),
      }));

      const response = await fetch('/api/admin-inspections/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspections })
      });

      if (!response.ok) throw new Error('Failed to submit inspection');

      toast({
        title: "Inspection Submitted",
        description: "Task inspection completed successfully",
      });

      setExpandedAssignment(null);
      setCompletedTasks([]);
      setInspectionStatus({});
      setInspectionNotes({});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit inspection",
        variant: "destructive",
      });
    }
  };

  // Filter assignments based on search term
  const filteredAssignments = assignments.filter((assignment: any) =>
    assignment?.contractorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment?.hbxlJob?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment?.workLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <LogoutButton />

      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">Pro</span>
          </div>
          <div>
            <div className="text-sm font-medium">Pro</div>
            <div className="text-xs text-slate-400">Simple Time Tracking</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-500">Online</span>
          <i className="fas fa-sun text-yellow-400 ml-2"></i>
          <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center ml-4">
            <span className="text-white font-bold text-sm">RD</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-yellow-400">Job Assignments</h1>
          <div className="flex gap-4">
            <Button
              onClick={async () => {
                try {
                  // Trigger scan
                  const res = await fetch('/api/jobs/scan-from-8000', { method: "POST" });
                  const d = await res.json();
                  if (d.success) {
                    const details = (d.results || []).map((r: any) =>
                      `  ${r.project_id}: ${r.success ? `✅ ${r.packages || 0} packages` : `❌ ${r.error}`}`
                    ).join('\n');
                    alert(`${d.message}\n\n${details || 'No projects found on Port 8000.'}`);
                    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/job-assignments'] });
                  } else {
                    alert(d.error || "Scan failed");
                  }
                } catch (e: any) { alert(`Cannot connect to Port 8000: ${e.message}`); }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center"
            >
              <i className="fas fa-sync mr-2"></i>
              Sync from Port 8000
            </Button>
            <Button
              onClick={() => window.location.href = '/upload'}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center"
            >
              <i className="fas fa-file-upload mr-2"></i>
              Upload Job
            </Button>
            <Button
              onClick={() => window.location.href = '/create-assignment'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              Create Assignment
            </Button>
          </div>
        </div>

        {/* Current Assignments Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-yellow-400">Current Assignments</h2>
          </div>

          <div className="p-4">
            {/* Search Box */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
            </div>

            {/* Unassigned Jobs Section */}
            {filteredUnassignedJobs.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Jobs Awaiting Assignment
                </h3>
                <div className="space-y-4">
                  {filteredUnassignedJobs.map((job: any) => (
                    <div key={job.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                            <i className="fas fa-drafting-compass text-slate-300"></i>
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{job.title}</h4>
                            <div className="text-sm text-slate-400">{job.location}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-900/20 text-green-400 border-green-500/50 hover:bg-green-900/40"
                            onClick={async () => {
                              if (!confirm(`Refresh job #${job.id} from Port 8000 shared data? This will overwrite rooms.`)) return;
                              try {
                                const res = await fetch(`/api/jobs/${job.id}/sync-packages`, { method: "POST" });
                                const d = await res.json();
                                if (d.success) {
                                  if (d.packages === 0) {
                                    alert(
                                      `Synced 0 packages.\n\n` +
                                      `Job Key: ${d.jobKey || 'N/A'}\n` +
                                      `Job ID: ${d.jobId || 'N/A'}\n\n` +
                                      `Upload a CSV with scope data on Port 8000 to generate packages.`
                                    );
                                  } else {
                                    alert(`Synced ${d.packages} packages successfully for ${d.jobKey}.`);
                                    window.location.reload();
                                  }
                                } else {
                                  alert(d.error || "Failed");
                                }
                              } catch (e: any) { alert(`Sync Failed: ${e.message}\n\nEnsure the HBXL Sync Service (Python) is running on port 8000.`); }
                            }}
                            title="Refresh from Shared Folder"
                          >
                            <i className="fas fa-sync mr-2"></i>
                            Refresh
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-purple-900/20 text-purple-400 border-purple-500/50 hover:bg-purple-900/40"
                            onClick={() => window.location.href = `/jobs/${job.id}/room-builder`}
                          >
                            <i className="fas fa-robot mr-2"></i>
                            Agent Workflow (Room Builder)
                          </Button>
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => openTenderDialog(job.id, job.title)}
                          >
                            <i className="fas fa-file-invoice mr-2"></i>
                            Create Tender
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => window.location.href = `/create-assignment?jobId=${job.id}`}
                            title="Manual assignment (skip tender)"
                          >
                            Assign Directly
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleDeleteJob(job.id)}
                            title="Delete Job"
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignment Cards - Show only actual assignments to contractors */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-slate-400">Loading assignments...</div>
              </div>
            ) : filteredAssignments && filteredAssignments.length > 0 ? (
              <div className="space-y-4">
                {filteredAssignments.map((assignment: any, index: number) => (
                  <div
                    key={index}
                    className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-briefcase text-white text-lg"></i>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {assignment.title || 'Job Assignment'}
                          </h3>
                          <p className="text-sm text-slate-400">
                            Assigned to: {assignment.contractorName || 'Unknown'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Location: {assignment.workLocation || 'No location specified'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Job: {assignment.hbxlJob || 'No job specified'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        {/* Tender Status Badge */}
                        <div className="text-center">
                          <div className="text-xs text-slate-400 mb-1">Tender</div>
                          {(() => {
                            const ts = assignment.tenderStatus || 'DRAFT';
                            const style = TENDER_STATUS_STYLES[ts] || TENDER_STATUS_STYLES.DRAFT;
                            return (
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                                {style.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Status</div>
                          <div className="text-green-400 font-medium text-sm">
                            {assignment.status || 'Assigned'}
                          </div>
                        </div>
                        <button
                          onClick={() => window.open(`/task-progress/${assignment.id}`, '_blank')}
                          className="p-3 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors border border-blue-800 hover:border-blue-600"
                          title="Preview Contractor View"
                        >
                          <i className="fas fa-eye text-lg"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="p-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors border border-red-800 hover:border-red-600"
                          title="Delete Assignment"
                        >
                          <i className="fas fa-trash text-lg"></i>
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400">Start Date</div>
                        <div className="text-white">{assignment.startDate || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Due Date</div>
                        <div className="text-white">{assignment.dueDate || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Telegram</div>
                        <div className="text-white">
                          {assignment.telegramNotified === 'true' ? '✓ Sent' : 'Not sent'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Actions</div>
                        <div className="flex flex-col gap-2 items-start">
                          {/* ── TENDER ACTIONS ── */}
                          {(assignment.tenderStatus || 'DRAFT') === 'DRAFT' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white w-full justify-start"
                              onClick={() => handleSendForPricing(assignment.id)}
                            >
                              <i className="fas fa-paper-plane mr-2"></i>
                              Send for Pricing
                            </Button>
                          )}
                          {(assignment.tenderStatus || 'DRAFT') === 'SUBMITTED' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white w-full justify-start"
                              onClick={() => handleApproveTender(assignment.id)}
                            >
                              <i className="fas fa-check-circle mr-2"></i>
                              Approve Tender
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-cyan-500 text-cyan-400 hover:bg-cyan-900/20 w-full justify-start"
                            onClick={() => window.open(`/contractor-tender/${assignment.id}`, '_blank')}
                          >
                            <i className="fas fa-file-invoice-dollar mr-2"></i>
                            View Tender
                          </Button>

                          <button
                            onClick={() => toggleInspectionView(assignment.id)}
                            className="text-yellow-400 hover:text-yellow-300 text-sm underline text-left"
                          >
                            {expandedAssignment === assignment.id ? 'Hide' : 'Show'} Task Inspection
                          </button>

                          {/* Agent Workflow Button */}
                          {assignment.jobId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-purple-500 text-purple-400 hover:bg-purple-900/20 w-full justify-start"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/jobs/${assignment.jobId}/external-link`);
                                  const d = await res.json();
                                  if (d.url) window.open(d.url, '_blank');
                                  else alert("No external link found (Job might be local-only)");
                                } catch (e) { alert("Failed to open Agent Workflow"); }
                              }}
                            >
                              <i className="fas fa-robot mr-2"></i>
                              Agent Workflow
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Professional Task Inspection Interface */}
                    {expandedAssignment === assignment.id && (
                      <div className="mt-6 border-t border-slate-600 pt-6">
                        {/* Inspection Header */}
                        <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-amber-500/20">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h3 className="text-lg sm:text-xl font-semibold text-amber-400 flex items-center gap-2">
                                <i className="fas fa-clipboard-check text-sm sm:text-base"></i>
                                <span className="hidden sm:inline">Site Inspection Dashboard</span>
                                <span className="sm:hidden">Inspection</span>
                              </h3>
                              <p className="text-slate-300 mt-1 text-sm">Quality assessment and task verification</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="text-sm text-slate-400">Inspector</div>
                              <div className="text-amber-400 font-medium">
                                {localStorage.getItem('adminName') || 'Admin'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date().toLocaleDateString('en-GB')}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Assignment Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                            <div className="text-slate-400 text-xs sm:text-sm">Contractor</div>
                            <div className="text-white font-medium text-sm sm:text-base">{assignment.contractorName}</div>
                          </div>
                          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                            <div className="text-slate-400 text-xs sm:text-sm">Location</div>
                            <div className="text-white font-medium text-sm sm:text-base">{assignment.workLocation}</div>
                          </div>
                          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                            <div className="text-slate-400 text-xs sm:text-sm">Job Reference</div>
                            <div className="text-white font-medium text-sm sm:text-base">{assignment.hbxlJob}</div>
                          </div>
                        </div>

                        {completedTasks.length > 0 ? (
                          <div className="space-y-6">
                            {/* Tasks Summary */}
                            <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 sm:p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <i className="fas fa-check text-white text-sm sm:text-lg"></i>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-green-400 font-semibold text-base sm:text-lg">
                                    {completedTasks.length} Task{completedTasks.length !== 1 ? 's' : ''} Ready
                                  </h4>
                                  <p className="text-slate-300 text-xs sm:text-sm">Complete - awaiting quality review</p>
                                </div>
                              </div>
                            </div>

                            {/* Task Inspection Cards */}
                            <div className="space-y-3 sm:space-y-4">
                              {completedTasks.map((task: any) => (
                                <div key={task.taskId} className="bg-slate-800/80 rounded-lg sm:rounded-xl border border-slate-600 overflow-hidden">
                                  {/* Task Header */}
                                  <div className="bg-slate-700/50 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-600">
                                    <div className="flex items-start sm:items-center justify-between gap-3">
                                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                          <i className="fas fa-tasks text-white text-sm sm:text-base"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h5 className="text-white font-semibold text-sm sm:text-lg leading-tight">{task.taskName}</h5>
                                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                            <span className="text-slate-400 text-xs sm:text-sm">Phase: {task.phase}</span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 border border-green-700/50 rounded-full text-green-400 text-xs font-medium w-fit">
                                              <i className="fas fa-check-circle"></i>
                                              Complete
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <div className="text-lg sm:text-2xl font-bold text-green-400">100%</div>
                                        <div className="text-xs text-slate-400">Progress</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Inspection Controls */}
                                  <div className="p-3 sm:p-6">
                                    {/* Action Buttons */}
                                    <div className="mb-4">
                                      <label className="block text-slate-300 font-medium mb-2 sm:mb-3 text-sm sm:text-base">Quality Assessment</label>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                        <button
                                          onClick={() => setInspectionStatus(prev => ({ ...prev, [task.taskId]: 'approved' }))}
                                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${inspectionStatus[task.taskId] === 'approved'
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/25 border-2 border-green-500'
                                            : 'bg-slate-700 text-slate-300 hover:bg-green-700 hover:text-white border-2 border-slate-600'
                                            }`}
                                        >
                                          <i className="fas fa-check-circle mr-2"></i>
                                          <span className="hidden sm:inline">Approve Work</span>
                                          <span className="sm:hidden">Approve</span>
                                        </button>
                                        <button
                                          onClick={() => setInspectionStatus(prev => ({ ...prev, [task.taskId]: 'issues' }))}
                                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${inspectionStatus[task.taskId] === 'issues'
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/25 border-2 border-red-500'
                                            : 'bg-slate-700 text-slate-300 hover:bg-red-700 hover:text-white border-2 border-slate-600'
                                            }`}
                                        >
                                          <i className="fas fa-exclamation-triangle mr-2"></i>
                                          <span className="hidden sm:inline">Requires Attention</span>
                                          <span className="sm:hidden">Issues</span>
                                        </button>
                                        <button className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 border-2 border-blue-500 text-sm sm:text-base">
                                          <i className="fas fa-camera mr-2"></i>
                                          <span className="hidden sm:inline">Add Photo</span>
                                          <span className="sm:hidden">Photo</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Notes Section */}
                                    <div>
                                      <label className="block text-slate-300 font-medium mb-2 text-sm sm:text-base">Inspection Notes</label>
                                      <textarea
                                        placeholder="Record quality observations, measurements, compliance notes..."
                                        value={inspectionNotes[task.taskId] || ''}
                                        onChange={(e) => setInspectionNotes(prev => ({ ...prev, [task.taskId]: e.target.value }))}
                                        className="w-full bg-slate-700/80 border border-slate-500 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm sm:text-base"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Submit Section */}
                            <div className="bg-slate-800/60 rounded-lg sm:rounded-xl border border-slate-600 p-3 sm:p-6">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                  <h4 className="text-white font-semibold text-base sm:text-lg">Complete Inspection</h4>
                                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                    Review all assessments before submitting final report
                                  </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                  <button
                                    onClick={() => {
                                      setExpandedAssignment(null);
                                      setCompletedTasks([]);
                                      setInspectionStatus({});
                                      setInspectionNotes({});
                                    }}
                                    className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors text-sm sm:text-base order-2 sm:order-1"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={submitInspection}
                                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium shadow-lg shadow-green-600/25 transition-all duration-200 text-sm sm:text-base order-1 sm:order-2"
                                  >
                                    <i className="fas fa-clipboard-check mr-2"></i>
                                    <span className="hidden sm:inline">Submit Inspection Report</span>
                                    <span className="sm:hidden">Submit Inspection</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 sm:py-12 bg-slate-800/50 rounded-lg sm:rounded-xl border border-slate-600">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                              <i className="fas fa-clipboard-list text-slate-400 text-lg sm:text-xl"></i>
                            </div>
                            <h4 className="text-white text-base sm:text-lg font-medium mb-2">No Tasks Ready for Inspection</h4>
                            <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto px-4">
                              Completed tasks will appear here automatically once contractors mark them as 100% finished.
                              Check back later or contact the contractor for status updates.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-slate-400 text-lg mb-2">
                  No job assignments found.
                </div>
                <div className="text-slate-500 text-sm">
                  Use "Create Assignment" to assign jobs to contractors.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="grid grid-cols-4 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-home block mb-1"></i>
            <span className="text-xs">Dashboard</span>
          </button>
          <button className="py-3 px-4 text-yellow-400">
            <i className="fas fa-briefcase block mb-1"></i>
            <span className="text-xs">Jobs</span>
          </button>
          <button
            onClick={() => window.location.href = '/admin-task-monitor'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-user-cog block mb-1"></i>
            <span className="text-xs">Admin</span>
          </button>
          <button
            onClick={() => window.location.href = '/upload'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-upload block mb-1"></i>
            <span className="text-xs">Upload</span>
          </button>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════ */}
      {/*  TENDER REQUESTS SECTION                               */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-4 mt-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <i className="fas fa-file-invoice text-amber-400"></i>
          Tender Requests
          <span className="text-sm font-normal text-slate-400">({tenderRequests.length})</span>
        </h2>

        {tenderRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No tender requests yet. Click "Create Tender" on a job above to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {tenderRequests.map((tr: any) => (
              <div key={tr.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{tr.title}</h3>
                    <p className="text-sm text-slate-400">Job: {tr.jobTitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tr.status === 'DRAFT' ? 'bg-slate-600 text-slate-200' :
                      tr.status === 'SENT' ? 'bg-amber-600 text-white' :
                        tr.status === 'CLOSED' ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-200'
                      }`}>
                      {tr.status}
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 w-7 p-0 bg-red-600 hover:bg-red-700"
                      onClick={async () => {
                        if (!confirm(`Delete tender "${tr.title}"? This will remove all submissions and pricing data.`)) return;
                        try {
                          const res = await fetch(`/api/tenders/${tr.id}`, { method: 'DELETE' });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.error || 'Failed');
                          toast({ title: 'Deleted', description: 'Tender request removed.' });
                          refetchTenders();
                        } catch (e: any) {
                          toast({ title: 'Error', description: e.message, variant: 'destructive' });
                        }
                      }}
                      title="Delete tender request"
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </Button>
                  </div>
                </div>

                {/* Submissions */}
                <div className="space-y-2">
                  {(tr.submissions || []).map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between bg-slate-800/50 rounded p-3 border border-slate-600/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {sub.contractorName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{sub.contractorName}</div>
                          <div className="text-xs text-slate-400">
                            {sub.status === 'SUBMITTED' && sub.submittedAt && `Submitted ${new Date(sub.submittedAt).toLocaleDateString()}`}
                            {sub.status === 'DRAFT' && 'Awaiting pricing...'}
                            {sub.status === 'APPROVED' && '✓ Approved'}
                            {sub.status === 'REJECTED' && '✗ Rejected'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${sub.status === 'DRAFT' ? 'bg-slate-600 text-slate-300' :
                          sub.status === 'SUBMITTED' ? 'bg-blue-600 text-white' :
                            sub.status === 'APPROVED' ? 'bg-green-600 text-white' :
                              'bg-red-600 text-white'
                          }`}>
                          {sub.status}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-cyan-500 text-cyan-400"
                          onClick={() => window.open(`/contractor-tender-new/${sub.id}`, '_blank')}
                        >
                          <i className="fas fa-eye mr-1"></i> View
                        </Button>
                        {sub.status === 'SUBMITTED' && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApproveTenderSubmission(tr.id, sub.id)}
                          >
                            <i className="fas fa-check-circle mr-1"></i> Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/*  TENDER CREATION DIALOG (Modal)                       */}
      {/* ══════════════════════════════════════════════════════ */}
      {showTenderDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTenderDialog(false)}>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-1">Create Tender Request</h2>
            <p className="text-sm text-slate-400 mb-4">Job: {tenderJobTitle}</p>

            {/* Package selection */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Select Packages</h3>
              {loadingPkgs ? (
                <div className="text-slate-400 text-sm">Loading packages...</div>
              ) : jobPackages.length === 0 ? (
                <div className="text-amber-400 text-sm">No packages found. Sync from Port 8000 first.</div>
              ) : (
                <div className="space-y-3">
                  {/* ROOM_QTO packages */}
                  {(() => {
                    const roomQtoPkgs = jobPackages.filter((p: any) =>
                      p.source === 'ROOM_QTO' ||
                      p.source === 'ROOM_SCOPE_LABOUR_V1' ||
                      (p.type === 'ROOM' && p.source === 'AG_8000_ROOM_QTO')
                    );
                    const baselinePkgs = jobPackages.filter((p: any) =>
                      p.source === 'CSV_BOQ' ||
                      p.type === 'IFC_PACKAGE'
                    );
                    return (
                      <>
                        {roomQtoPkgs.length > 0 && (
                          <div className="mb-4">
                            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <i className="fas fa-ruler-combined"></i>
                              Tenderable Room Scopes (QTO & Lab-Only V1)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {roomQtoPkgs.map((pkg: any) => (
                                <label key={pkg.id} className="flex items-center gap-3 text-sm text-white cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30">
                                  <input
                                    type="checkbox"
                                    checked={selectedPackageIds.includes(pkg.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedPackageIds(prev => [...prev, pkg.id]);
                                      else setSelectedPackageIds(prev => prev.filter(id => id !== pkg.id));
                                    }}
                                    className="rounded border-slate-500 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="flex-1">{pkg.name}</span>
                                  {pkg.source === 'ROOM_SCOPE_LABOUR_V1' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/40 text-purple-400 border border-purple-700/50">LAB-V1</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">QTO</span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {baselinePkgs.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 mt-4 flex items-center gap-2">
                              <i className="fas fa-database"></i>
                              Build Packages (CSV_BOQ — Budget Baseline)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {baselinePkgs.map((pkg: any) => (
                                <label key={pkg.id} className="flex items-center gap-3 text-sm text-slate-300 p-2 rounded-lg border border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={selectedPackageIds.includes(pkg.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedPackageIds(prev => [...prev, pkg.id]);
                                      else setSelectedPackageIds(prev => prev.filter(id => id !== pkg.id));
                                    }}
                                    className="rounded border-slate-500 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="flex-1">{pkg.name}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-400 border border-slate-600">BASELINE</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {/* Quick select buttons */}
                  <div className="flex gap-4 pt-3 border-t border-slate-700 mt-4">
                    <button
                      onClick={() => setSelectedPackageIds(jobPackages.filter((p: any) =>
                        p.source === 'ROOM_QTO' ||
                        p.source === 'ROOM_SCOPE_LABOUR_V1' ||
                        (p.type === 'ROOM' && p.source === 'AG_8000_ROOM_QTO')
                      ).map((p: any) => p.id))}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <i className="fas fa-check-double mr-1"></i>
                      Select All Rooms
                    </button>
                    <button onClick={() => setSelectedPackageIds(jobPackages.map((p: any) => p.id))} className="text-xs text-yellow-400 hover:text-yellow-300">Select All</button>
                    <button onClick={() => setSelectedPackageIds([])} className="text-xs text-slate-400 hover:text-white">Clear</button>
                  </div>
                </div>
              )}
            </div>

            {/* Contractor selection */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Select Contractors to Invite</h3>
              {approvedContractors.length === 0 ? (
                <div className="text-amber-400 text-sm">No approved contractors found. Approve contractor applications first.</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {approvedContractors.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-white cursor-pointer hover:bg-slate-700/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedContractorIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedContractorIds(prev => [...prev, c.id]);
                          else setSelectedContractorIds(prev => prev.filter(id => id !== c.id));
                        }}
                        className="rounded"
                        disabled={createdTenderLinks.length > 0}
                      />
                      <span>{c.firstName} {c.lastName}</span>
                      <span className="text-xs text-slate-400">({c.primaryTrade})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ── TENDER LINKS (shown after creation) ── */}
            {createdTenderLinks.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border-2 border-green-600/40 bg-green-900/20">
                <h3 className="text-sm font-bold text-green-400 mb-3">✅ Tender Created — Contractor Links</h3>
                <p className="text-xs text-slate-400 mb-3">Copy the link and share via WhatsApp, SMS, email, or any messaging app.</p>
                <div className="space-y-3">
                  {createdTenderLinks.map((item) => (
                    <div key={item.submissionId} className="p-3 rounded-md bg-slate-800/80 border border-slate-600">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium text-white text-sm">👷 {item.contractorName}</div>
                        <div className="flex items-center gap-2">
                          {item.telegram ? (
                            <span className="text-xs text-green-400">✅ Telegram sent</span>
                          ) : (
                            <span className="text-xs text-amber-400">⚠️ Telegram failed</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={item.link}
                          className="flex-1 bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded border border-slate-600 font-mono"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          size="sm"
                          className={copiedLinkId === item.submissionId
                            ? "bg-green-600 hover:bg-green-600 text-white min-w-[80px]"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                          }
                          onClick={() => handleCopyLink(item.link, item.submissionId)}
                        >
                          {copiedLinkId === item.submissionId ? '✓ Copied!' : '📋 Copy'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowTenderDialog(false); setCreatedTenderLinks([]); }} className="text-slate-300 border-slate-500">
                {createdTenderLinks.length > 0 ? 'Done' : 'Cancel'}
              </Button>
              {createdTenderLinks.length === 0 && (
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleCreateTender}
                  disabled={creatingTender || selectedPackageIds.length === 0 || selectedContractorIds.length === 0}
                >
                  {creatingTender ? 'Creating...' : `Create & Send Tender (${selectedPackageIds.length} pkgs, ${selectedContractorIds.length} contractors)`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div >
  );
}