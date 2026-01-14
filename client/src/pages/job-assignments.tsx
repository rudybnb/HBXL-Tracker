import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [inspectionStatus, setInspectionStatus] = useState<Record<string, 'approved' | 'issues'>>({});
  const [inspectionNotes, setInspectionNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

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
          <Button 
            onClick={() => window.location.href = '/create-assignment'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
          >
            <i className="fas fa-plus mr-2"></i>
            Create Assignment
          </Button>
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
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Status</div>
                          <div className="text-green-400 font-medium text-sm">
                            {assignment.status || 'Assigned'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-slate-400">Phases</div>
                          <div className="text-blue-400 font-medium text-sm">
                            {assignment.buildPhases?.length || 0}
                          </div>
                        </div>
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
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => toggleInspectionView(assignment.id)}
                            className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                          >
                            {expandedAssignment === assignment.id ? 'Hide' : 'Show'} Task Inspection
                          </button>
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
                                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                                            inspectionStatus[task.taskId] === 'approved'
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
                                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                                            inspectionStatus[task.taskId] === 'issues'
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
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}