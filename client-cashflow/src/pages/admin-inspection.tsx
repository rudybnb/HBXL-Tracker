import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Camera, FileText, CheckCircle, XCircle, MapPin, Calendar, User, Building } from "lucide-react";
import { TaskProgressManager } from "@/lib/task-progress-manager";

interface AssignmentDetails {
  id: string;
  contractorName: string;
  email: string;
  phone: string;
  workLocation: string;
  hbxlJob: string;
  buildPhases: string[];
  startDate: string;
  endDate: string;
  specialInstructions: string | null;
  status: string;
  sendTelegramNotification: boolean;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskInspection {
  taskId: string;
  phase: string;
  taskName: string;
  description: string;
  progress: number;
  completed: boolean;
  inspectionStatus: 'pending' | 'approved' | 'issues';
  notes?: string;
  photos?: string[];
}

export default function AdminInspection() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [completedTasks, setCompletedTasks] = useState<TaskInspection[]>([]);
  const [inspectionNotes, setInspectionNotes] = useState<Record<string, string>>({});
  const [inspectionStatus, setInspectionStatus] = useState<Record<string, 'pending' | 'approved' | 'issues'>>({});
  const queryClient = useQueryClient();

  // Fetch assignment details
  const { data: assignment, isLoading: assignmentLoading } = useQuery<AssignmentDetails>({
    queryKey: [`/api/job-assignments/${id}`],
    enabled: !!id,
  });

  // Load completed tasks for inspection
  useEffect(() => {
    const loadCompletedTasks = async () => {
      if (!assignment) return;

      try {
        const taskProgressManager = new TaskProgressManager(assignment.contractorName, assignment.id);
        
        // Get task progress from database
        const response = await fetch(`/api/task-progress/${encodeURIComponent(assignment.contractorName)}/${assignment.id}`);
        const taskProgress = await response.json();

        // Get job tasks from uploaded jobs
        const jobsResponse = await fetch('/api/uploaded-jobs');
        const uploadedJobs = await jobsResponse.json();
        
        // Find matching job using same logic as task-progress
        const matchingJob = uploadedJobs.find((job: any) => {
          if (job.name === assignment.hbxlJob) return true;
          
          // Handle job name matching
          if (job.name && assignment.hbxlJob) {
            const jobNameClean = job.name.toLowerCase().replace(/\s+/g, '');
            const assignmentNameClean = assignment.hbxlJob.toLowerCase().replace(/\s+/g, '');
            if (jobNameClean.includes('flat') && assignmentNameClean.includes('flat')) {
              return true;
            }
          }
          
          // Postcode matching
          if (job.postcode && assignment.workLocation) {
            const jobPostcodePrefix = job.postcode.split(' ')[0];
            const assignmentLocationPrefix = assignment.workLocation.split(' ')[0];
            if (jobPostcodePrefix === assignmentLocationPrefix) {
              return true;
            }
          }
          
          return false;
        });

        if (!matchingJob || !matchingJob.phaseTaskDataValue) {
          console.log('No matching job found or no task data available');
          return;
        }

        // Parse phase task data
        const phaseData = JSON.parse(matchingJob.phaseTaskDataValue);
        const completed: TaskInspection[] = [];

        // Extract completed tasks - check all task progress regardless of phase matching
        // Some tasks might have "Unknown Phase" but still belong to assigned phases
        taskProgress.forEach((progressItem: any) => {
          if (progressItem.completed === true) {
            // Find the corresponding task in CSV data by taskId
            const taskIdParts = progressItem.taskId.split('-');
            const expectedPhase = taskIdParts[0] + (taskIdParts.length > 2 ? ' ' + taskIdParts.slice(1, -1).join(' ') : '');
            const taskIndex = parseInt(taskIdParts[taskIdParts.length - 1]);
            
            console.log(`🔍 Processing completed task:`, { 
              taskId: progressItem.taskId,
              expectedPhase,
              taskIndex,
              progressItem
            });
            
            // Check if this task belongs to assigned phases
            if (assignment.buildPhases.includes(expectedPhase) && phaseData[expectedPhase]) {
              const csvTask = phaseData[expectedPhase][taskIndex];
              if (csvTask) {
                completed.push({
                  taskId: progressItem.taskId,
                  phase: expectedPhase,
                  taskName: csvTask.task || csvTask.description,
                  description: progressItem.taskDescription || csvTask.description,
                  progress: 100,
                  completed: true,
                  inspectionStatus: 'pending',
                  notes: '',
                  photos: []
                });
              }
            } else {
              // Include completed tasks even if phase doesn't match perfectly
              // This handles tasks that may have been recorded with "Unknown Phase"
              completed.push({
                taskId: progressItem.taskId,
                phase: progressItem.phase || expectedPhase,
                taskName: progressItem.taskDescription,
                description: progressItem.taskDescription,
                progress: 100,
                completed: true,
                inspectionStatus: 'pending',
                notes: '',
                photos: []
              });
            }
          }
        });

        console.log(`📋 Found ${completed.length} tasks for inspection:`, completed);
        setCompletedTasks(completed);
      } catch (error) {
        console.error('Error loading completed tasks:', error);
        setCompletedTasks([]);
      }
    };

    loadCompletedTasks();
  }, [assignment]);

  // Submit inspection
  const submitInspectionMutation = useMutation({
    mutationFn: async () => {
      const inspections = completedTasks.map(task => ({
        assignmentId: assignment!.id,
        contractorName: assignment!.contractorName,
        taskId: task.taskId,
        phase: task.phase,
        taskName: task.taskName,
        inspectionStatus: inspectionStatus[task.taskId] || 'pending',
        notes: inspectionNotes[task.taskId] || '',
        inspectedBy: localStorage.getItem('adminName') || 'Admin',
        inspectedAt: new Date().toISOString(),
      }));

      return apiRequest('POST', '/api/admin-inspections/batch', { inspections });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin-inspections'] });
      setLocation('/admin/job-assignments');
    },
  });

  const handleInspectionStatusChange = (taskId: string, status: 'approved' | 'issues') => {
    setInspectionStatus(prev => ({ ...prev, [taskId]: status }));
  };

  const handleNotesChange = (taskId: string, notes: string) => {
    setInspectionNotes(prev => ({ ...prev, [taskId]: notes }));
  };

  if (assignmentLoading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-amber-500">Loading assignment details...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-red-400">Assignment not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 pb-20">
      {/* Header */}
      <div className="bg-slate-900 p-4 flex items-center gap-3 border-b border-slate-700">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/admin/job-assignments')}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-white">📋 Assignment Overview</h1>
          <p className="text-slate-400 text-sm">Admin Site Inspection</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Assignment Overview */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-amber-500 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assignment Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="h-4 w-4 text-amber-500" />
                <span className="text-slate-400">Contractor:</span>
                <span>{assignment.contractorName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="h-4 w-4 text-amber-500" />
                <span className="text-slate-400">Location:</span>
                <span>{assignment.workLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-slate-400">Start Date:</span>
                <span>{assignment.startDate}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Building className="h-4 w-4 text-amber-500" />
                <span className="text-slate-400">Status:</span>
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {assignment.status}
                </Badge>
                <span className="text-slate-400">Phases:</span>
                <Badge variant="outline" className="border-amber-500 text-amber-500">
                  {assignment.buildPhases.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Tasks Progress */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-amber-500 flex items-center gap-2">
              🔧 Sub-Tasks Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No completed tasks available for inspection yet.</p>
                <p className="text-sm mt-2">Tasks will appear here when contractors mark them as 100% complete.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignment.buildPhases.map((phase) => {
                  const phaseTasks = completedTasks.filter(task => task.phase === phase);
                  if (phaseTasks.length === 0) return null;

                  return (
                    <div key={phase} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-slate-200 font-medium">{phase} ({phaseTasks.length} tasks)</h3>
                      </div>
                      {phaseTasks.map((task) => (
                        <div key={task.taskId} className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-slate-200 font-medium">{task.description}</h4>
                            <Badge variant="secondary" className="bg-green-600 text-white">
                              100% Complete
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-400 mb-2">
                            Qty: 1 • Progress: 100%
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Task Reporting */}
        {completedTasks.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-amber-500 flex items-center gap-2">
                📋 Admin Task Reporting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-900/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-blue-400 font-semibold">💡 New Task-Based Reporting</div>
                </div>
                <div className="text-blue-200 text-sm space-y-1">
                  <p>Use the task-level buttons below to add quick notes and photos for each specific task.</p>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span>Note button: Add quick observations per task</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Camera className="h-3 w-3" />
                      <span>Photo button: Capture evidence per task (coming soon)</span>
                    </div>
                    <div className="text-xs text-blue-300 mt-1">• More efficient than complex forms</div>
                  </div>
                </div>
              </div>

              {/* Task Inspection Form */}
              <div className="space-y-4">
                {completedTasks.map((task) => (
                  <div key={task.taskId} className="bg-slate-800 rounded-lg p-4 border border-slate-600 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-slate-200 font-medium">{task.description}</h4>
                        <p className="text-sm text-slate-400">{task.phase} • Qty: 1</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-600 text-white">
                        Ready for Inspection
                      </Badge>
                    </div>

                    {/* Inspection Controls */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={inspectionStatus[task.taskId] === 'approved' ? 'default' : 'outline'}
                        onClick={() => handleInspectionStatusChange(task.taskId, 'approved')}
                        className={inspectionStatus[task.taskId] === 'approved' 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'border-green-600 text-green-400 hover:bg-green-600 hover:text-white'
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant={inspectionStatus[task.taskId] === 'issues' ? 'default' : 'outline'}
                        onClick={() => handleInspectionStatusChange(task.taskId, 'issues')}
                        className={inspectionStatus[task.taskId] === 'issues' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'border-red-600 text-red-400 hover:bg-red-600 hover:text-white'
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Issues Found
                      </Button>
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-400">
                        <Camera className="h-4 w-4 mr-1" />
                        Photo
                      </Button>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Inspection Notes</label>
                      <Textarea
                        placeholder="Add notes about this specific task..."
                        value={inspectionNotes[task.taskId] || ''}
                        onChange={(e) => handleNotesChange(task.taskId, e.target.value)}
                        className="bg-slate-700 border-slate-600 text-slate-200 min-h-[80px]"
                      />
                    </div>
                  </div>
                ))}

                {/* Submit Inspection */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => submitInspectionMutation.mutate()}
                    disabled={submitInspectionMutation.isPending}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {submitInspectionMutation.isPending ? 'Submitting...' : 'Complete Inspection'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/admin/job-assignments')}
                    className="border-slate-600 text-slate-400"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}