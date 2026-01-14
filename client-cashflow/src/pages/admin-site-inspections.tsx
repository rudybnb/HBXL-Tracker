import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PendingInspection {
  id: string;
  assignmentId: string;
  contractorName: string;
  notificationType: string;
  jobTitle: string;
  jobLocation: string;
  createdAt: string;
  inspectionType: string;
}

function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('isLoggedIn');
    window.location.href = '/login';
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

export default function AdminSiteInspections() {
  const { toast } = useToast();

  // Fetch pending inspections
  const { data: pendingInspections = [] } = useQuery<PendingInspection[]>({
    queryKey: ["/api/pending-inspections"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch job assignments to get assignment details
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/job-assignments"],
    refetchInterval: 30000,
  });

  const completeInspectionMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("POST", `/api/complete-inspection/${notificationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-inspections"] });
      toast({
        title: "Inspection Completed",
        description: "Inspection notification marked as completed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCompleteInspection = (notificationId: string) => {
    completeInspectionMutation.mutate(notificationId);
  };

  const getInspectionTypeColor = (type: string) => {
    switch (type) {
      case '50_percent_ready':
        return 'bg-yellow-600 text-white';
      case '100_percent_ready':
        return 'bg-green-600 text-white';
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const getInspectionTypeLabel = (type: string) => {
    switch (type) {
      case '50_percent_ready':
        return '50% Milestone';
      case '100_percent_ready':
        return '100% Complete';
      default:
        return 'Inspection Required';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <LogoutButton />
      
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">🔍</span>
          </div>
          <div>
            <div className="text-sm font-medium">Admin Site Inspections</div>
            <div className="text-xs text-slate-400">Quality Control & Progress Verification</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-500">Online</span>
          <Button
            onClick={() => window.location.href = '/admin-dashboard'}
            size="sm"
            className="ml-4 text-xs px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white"
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Page Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-yellow-400 mb-2">Admin Site Inspections</h1>
          <p className="text-slate-400">Progress milestones and quality control inspections</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-400">{pendingInspections.length}</div>
                <div className="text-slate-400 text-sm">Pending Inspections</div>
              </div>
              <i className="fas fa-clock text-yellow-400 text-xl"></i>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-400">{assignments.length}</div>
                <div className="text-slate-400 text-sm">Active Projects</div>
              </div>
              <i className="fas fa-project-diagram text-green-400 text-xl"></i>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-400">100%</div>
                <div className="text-slate-400 text-sm">Quality Score</div>
              </div>
              <i className="fas fa-star text-blue-400 text-xl"></i>
            </div>
          </div>
        </div>

        {/* Pending Inspections */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <i className="fas fa-clipboard-check text-red-400 mr-3 text-xl"></i>
              <h2 className="text-xl font-semibold text-red-400">Pending Site Inspections</h2>
            </div>
            {pendingInspections.length > 0 && (
              <Badge className="bg-red-600 text-white">
                {pendingInspections.length} Pending
              </Badge>
            )}
          </div>

          {pendingInspections.length === 0 ? (
            <div className="text-center space-y-4 py-8">
              <div className="flex justify-center">
                <div className="w-20 h-20 flex items-center justify-center">
                  <i className="fas fa-check-circle text-green-400 text-5xl"></i>
                </div>
              </div>
              <div className="text-slate-400">
                No pending inspections. All projects up to date.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInspections.map((inspection) => {
                const assignment = assignments.find(a => a.id === inspection.assignmentId);
                return (
                  <div key={inspection.id} className="bg-slate-700 rounded-lg p-4 border border-red-600/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getInspectionTypeColor(inspection.inspectionType)}>
                            {getInspectionTypeLabel(inspection.inspectionType)}
                          </Badge>
                          <span className="text-slate-400 text-sm">
                            {new Date(inspection.createdAt).toLocaleDateString()} at {new Date(inspection.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-white font-medium text-lg mb-1">
                          {inspection.contractorName} - {inspection.jobTitle}
                        </div>
                        <div className="text-slate-300 text-sm mb-3">
                          📍 Location: {inspection.jobLocation}
                        </div>
                        {assignment && (
                          <div className="text-slate-400 text-sm mb-3">
                            🔧 Phase: {assignment.buildPhases?.join(', ')} • 
                            📅 Started: {new Date(assignment.startDate).toLocaleDateString()}
                          </div>
                        )}
                        <div className="text-yellow-400 text-sm font-medium">
                          🚨 Admin inspection required for quality verification
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          onClick={() => window.location.href = `/assignment-details/${inspection.assignmentId}`}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <i className="fas fa-eye mr-1"></i>
                          Inspect Site
                        </Button>
                        <Button
                          onClick={() => handleCompleteInspection(inspection.id)}
                          size="sm"
                          variant="outline"
                          className="border-green-500 text-green-400 hover:bg-green-600/10"
                          disabled={completeInspectionMutation.isPending}
                        >
                          <i className="fas fa-check mr-1"></i>
                          Mark Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => window.location.href = '/job-assignments'}
              className="bg-slate-700 hover:bg-slate-600 text-white p-4 h-auto"
            >
              <div className="flex items-center space-x-3">
                <i className="fas fa-tasks text-yellow-400 text-xl"></i>
                <div className="text-left">
                  <div className="font-medium">Manage Assignments</div>
                  <div className="text-sm text-slate-400">Create and manage job assignments</div>
                </div>
              </div>
            </Button>
            
            <Button
              onClick={() => window.location.href = '/upload'}
              className="bg-slate-700 hover:bg-slate-600 text-white p-4 h-auto"
            >
              <div className="flex items-center space-x-3">
                <i className="fas fa-upload text-blue-400 text-xl"></i>
                <div className="text-left">
                  <div className="font-medium">Upload Job Data</div>
                  <div className="text-sm text-slate-400">Upload CSV files with job details</div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}