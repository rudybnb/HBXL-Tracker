import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ContractorAssignment {
  id: string;
  contractorName: string;
  workLocation: string;
  hbxlJob: string;
  buildPhases: string[];
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  specialInstructions?: string;
}

export default function Jobs() {
  // Get contractor assignments using logged-in contractor name
  const contractorName = localStorage.getItem('contractorName') || 'Dalwayne Diedericks';
  const contractorFirstName = contractorName.split(' ')[0];
  
  const { data: assignments = [], isLoading } = useQuery<ContractorAssignment[]>({
    queryKey: [`/api/contractor-assignments/${contractorFirstName}`],
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Direct Job Assignments</h1>
            <p className="text-slate-400 text-sm">Jobs are assigned to you directly</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {assignments.length === 0 ? (
          /* Empty State */
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 text-slate-500">
              <i className="fas fa-briefcase text-6xl"></i>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Assignments</h3>
            <p className="text-slate-400 mb-6">You don't have any job assignments yet.</p>
          </div>
        ) : (
          /* Compact Assignments List */
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      assignment.status === 'assigned' ? 'bg-yellow-500' : 'bg-blue-600'
                    }`}>
                      <i className={`fas fa-briefcase text-sm ${
                        assignment.status === 'assigned' ? 'text-black' : 'text-white'
                      }`}></i>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-yellow-400">{assignment.hbxlJob || 'Untitled Job'}</h3>
                      <p className="text-slate-400 text-xs">{assignment.workLocation || 'Location not set'}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs px-2 py-0.5 ${
                    assignment.status === 'assigned' 
                      ? 'bg-yellow-500 text-black' 
                      : assignment.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-500 text-white'
                  }`}>
                    {assignment.status}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-xs mb-2">
                  <div className="flex items-center text-slate-300">
                    <i className="fas fa-clock text-slate-400 mr-1 w-3"></i>
                    <span>{assignment.startDate} → {assignment.endDate}</span>
                  </div>
                  {assignment.buildPhases && assignment.buildPhases.length > 0 && (
                    <div className="flex items-start text-slate-300">
                      <i className="fas fa-tasks text-slate-400 mr-1 w-3 mt-0.5"></i>
                      <div className="flex flex-wrap gap-1">
                        {assignment.buildPhases.slice(0, 2).map((phase: string, idx: number) => (
                          <span 
                            key={idx}
                            className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded"
                          >
                            {phase}
                          </span>
                        ))}
                        {assignment.buildPhases.length > 2 && (
                          <span className="text-slate-400 text-xs">
                            +{assignment.buildPhases.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {assignment.specialInstructions && (
                    <div className="flex items-start text-slate-300 mt-1">
                      <i className="fas fa-sticky-note text-yellow-400 mr-1 w-3 mt-0.5"></i>
                      <div className="bg-yellow-900/30 border border-yellow-700 rounded px-2 py-1 text-xs">
                        <span className="text-yellow-400 font-medium">Note: </span>
                        <span>{assignment.specialInstructions}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1 h-7 flex-1"
                    onClick={() => {
                      window.location.href = `/assignment/${assignment.id}`;
                    }}
                  >
                    <i className="fas fa-comment mr-1"></i>
                    Quick Report
                  </Button>
                  
                  <Button
                    size="sm"
                    className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs px-3 py-1 h-7"
                    onClick={() => window.location.href = '/task-progress'}
                  >
                    <i className="fas fa-tasks mr-1"></i>
                    Tasks
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        {/* Show foreman tab only for Dalwayne */}
        {contractorName && (contractorName.toLowerCase().includes('dalwayne') || contractorName.toLowerCase().includes('diedericks')) ? (
          <div className="grid grid-cols-4 text-center">
            <button 
              onClick={() => window.location.href = '/'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-dashboard"
            >
              <i className="fas fa-home block mb-1"></i>
              <span className="text-xs">Dashboard</span>
            </button>
            <button className="py-3 px-4 text-yellow-400" data-testid="nav-jobs">
              <i className="fas fa-briefcase block mb-1"></i>
              <span className="text-xs">Jobs</span>
            </button>
            <button 
              onClick={() => window.location.href = '/foreman'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-foreman"
            >
              <i className="fas fa-users block mb-1"></i>
              <span className="text-xs">Jobs Assigned</span>
            </button>
            <button 
              onClick={() => window.location.href = '/more'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-more"
            >
              <i className="fas fa-ellipsis-h block mb-1"></i>
              <span className="text-xs">More</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 text-center">
            <button 
              onClick={() => window.location.href = '/'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-dashboard"
            >
              <i className="fas fa-home block mb-1"></i>
              <span className="text-xs">Dashboard</span>
            </button>
            <button className="py-3 px-4 text-yellow-400" data-testid="nav-jobs">
              <i className="fas fa-briefcase block mb-1"></i>
              <span className="text-xs">Jobs</span>
            </button>
            <button 
              onClick={() => window.location.href = '/more'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-more"
            >
              <i className="fas fa-ellipsis-h block mb-1"></i>
              <span className="text-xs">More</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}