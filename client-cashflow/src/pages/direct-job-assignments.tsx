import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface JobAssignment {
  id: string;
  projectName: string;
  address: string;
  hbxlJob: string;
  assignedTo: string;
  startDate: string;
  endDate: string;
  status: "Available" | "In Progress" | "Completed";
}

export default function DirectJobAssignments() {
  const [assignments] = useState<JobAssignment[]>([
    {
      id: "1",
      projectName: "Unknown, SG1 1EH",
      address: "Unknown, SG1 1EH",
      hbxlJob: "Flat21Bedroom - Fitout",
      assignedTo: "James",
      startDate: "06/08/2025",
      endDate: "13/08/2025",
      status: "Available"
    }
  ]);
  
  const [contractorDropdownOpen, setContractorDropdownOpen] = useState(false);
  const { toast } = useToast();

  const handleAcceptJob = (jobId: string) => {
    toast({
      title: "Job Accepted",
      description: "Redirecting to task progress...",
    });
    // Redirect to task progress page
    setTimeout(() => {
      window.location.href = '/task-progress';
    }, 1500);
  };

  const handleMenuAction = (action: string) => {
    setContractorDropdownOpen(false);
    toast({
      title: action,
      description: `Opening ${action} interface...`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
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
          <div className="relative">
            <button 
              onClick={() => setContractorDropdownOpen(!contractorDropdownOpen)}
              className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center ml-4 hover:bg-yellow-700 transition-colors"
            >
              <span className="text-white font-bold text-sm">DD</span>
            </button>
            
            {contractorDropdownOpen && (
              <div className="absolute right-0 top-10 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50">
                <div className="px-4 py-3 border-b border-slate-600">
                  <div className="text-yellow-400 font-semibold">Dalwayne Diedericks</div>
                </div>
                
                <div className="py-2">
                  <button 
                    onClick={() => handleMenuAction("Switch Account")}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-user-circle mr-3 text-slate-400"></i>
                    Switch Account
                  </button>
                  
                  <button 
                    onClick={() => handleMenuAction("Report Issue")}
                    className="w-full px-4 py-2 text-left text-yellow-400 hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-exclamation-triangle mr-3 text-yellow-400"></i>
                    Report Issue
                  </button>
                  
                  <button 
                    onClick={() => handleMenuAction("Documents")}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-file-alt mr-3 text-slate-400"></i>
                    Documents
                  </button>
                  
                  <button 
                    onClick={() => handleMenuAction("Help & Support")}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-question-circle mr-3 text-slate-400"></i>
                    Help & Support
                  </button>
                  
                  <div className="border-t border-slate-600 mt-2 pt-2">
                    <button 
                      onClick={() => window.location.href = '/login'}
                      className="w-full px-4 py-2 text-left text-red-400 hover:bg-slate-700 flex items-center"
                    >
                      <i className="fas fa-sign-out-alt mr-3 text-red-400"></i>
                      Sign Out & Switch Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <h1 className="text-2xl font-bold text-white mb-2">Direct Job Assignments</h1>
        <p className="text-slate-400 text-sm mb-6">Jobs are assigned to you directly</p>

        {assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-building text-white"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-400">{assignment.projectName}</h3>
                      <p className="text-slate-400 text-sm">{assignment.hbxlJob}</p>
                    </div>
                  </div>
                  <Badge 
                    className={`${
                      assignment.status === 'Available' 
                        ? 'bg-green-600 text-white' 
                        : assignment.status === 'In Progress'
                        ? 'bg-yellow-600 text-black'
                        : 'bg-slate-600 text-white'
                    }`}
                  >
                    {assignment.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <i className="fas fa-user text-slate-400 mr-2 w-4"></i>
                    <span className="text-slate-400">Assigned to:</span>
                    <span className="text-white ml-1">{assignment.assignedTo}</span>
                  </div>
                  
                  <div className="flex items-center text-sm">
                    <i className="fas fa-clock text-slate-400 mr-2 w-4"></i>
                    <span className="text-slate-400">
                      {assignment.startDate} - {assignment.endDate}
                    </span>
                  </div>
                </div>

                {assignment.status === 'Available' && (
                  <Button 
                    onClick={() => handleAcceptJob(assignment.id)}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-medium py-3 rounded-lg flex items-center justify-center"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Accept & Start Work
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <i className="fas fa-briefcase text-slate-500 text-4xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Jobs Available</h3>
              <p className="text-slate-400 text-sm">
                No job assignments are available at the moment. Check back later.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="flex justify-around py-2">
          <button 
            onClick={() => window.location.href = '/'}
            className="flex flex-col items-center py-2 px-4 text-slate-400"
          >
            <i className="fas fa-home text-xl mb-1"></i>
            <span className="text-xs">Dashboard</span>
          </button>
          <button className="flex flex-col items-center py-2 px-4 text-yellow-400">
            <i className="fas fa-briefcase text-xl mb-1"></i>
            <span className="text-xs">Jobs</span>
          </button>
          <button className="flex flex-col items-center py-2 px-4 text-slate-400">
            <i className="fas fa-ellipsis-h text-xl mb-1"></i>
            <span className="text-xs">More</span>
          </button>
        </div>
      </div>
    </div>
  );
}