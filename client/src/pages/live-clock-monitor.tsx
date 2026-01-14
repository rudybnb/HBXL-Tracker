import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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
        <button
          onClick={handleLogout}
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default function LiveClockMonitor() {
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  // Fetch active work sessions
  const { data: activeSessions = [], isLoading: activeLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/active-sessions'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });



  // Fetch contractor locations for live GPS tracking
  const [contractorLocations, setContractorLocations] = useState<Record<string, any>>({});

  useEffect(() => {
    if (activeSessions.length > 0) {
      const fetchLocations = async () => {
        const locations: Record<string, any> = {};
        
        for (const session of activeSessions) {
          try {
            const response = await fetch(`/api/contractor-location/${encodeURIComponent(session.contractorName)}`);
            if (response.ok) {
              const locationData = await response.json();
              locations[session.contractorName] = locationData;
            }
          } catch (error) {
            console.log(`No GPS location for ${session.contractorName}`);
          }
        }
        
        setContractorLocations(locations);
      };

      fetchLocations();
      const locationInterval = setInterval(fetchLocations, 30000); // Update every 30 seconds

      return () => clearInterval(locationInterval);
    }
  }, [activeSessions]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <LogoutButton />
      
      {/* Header with Navigation */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <i className="fas fa-clock text-white text-sm"></i>
          </div>
          <div>
            <div className="text-sm font-medium">Live Monitor</div>
            <div className="text-xs text-slate-400">Real-time contractor tracking</div>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
            className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center hover:bg-yellow-700 transition-colors"
          >
            <span className="text-white font-bold text-sm">
              {(localStorage.getItem('adminName') || 'Admin').split(' ').map(n => n[0]).join('').slice(0,2)}
            </span>
          </button>
          
          {showAvatarDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-600 z-50">
              <div className="py-2">
                <button 
                  onClick={() => window.location.href = '/admin'}
                  className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                >
                  <i className="fas fa-tachometer-alt mr-3 w-4"></i>
                  Admin Dashboard
                </button>
                
                <button 
                  onClick={() => window.location.href = '/payroll-overview'}
                  className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                >
                  <i className="fas fa-clock mr-3 w-4"></i>
                  Time Tracking
                </button>
                
                <button 
                  onClick={() => window.location.href = '/job-assignments'}
                  className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                >
                  <i className="fas fa-tasks mr-3 w-4"></i>
                  Job Assignments
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simple Live Monitor Layout */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-green-500 text-lg font-semibold">Live Clock Monitoring</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-500 text-sm">Live</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="text-white text-base font-medium">Active Workers ({activeSessions.length})</h4>
          
          {activeLoading ? (
            <div className="text-slate-400">Loading...</div>
          ) : activeSessions.length > 0 ? (
            <div className="space-y-4">
              {activeSessions.map((session: any) => {
                const location = contractorLocations[session.contractorName];
                const hasLocation = location && location.latitude && location.longitude;
                
                return (
                  <div key={session.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${hasLocation ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-white font-medium">{session.contractorName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-white text-xs px-2 py-1 bg-green-700 rounded">Active</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Start Time</span>
                        <span className="text-slate-300 text-sm">
                          {session.startTime ? new Date(session.startTime).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : 'Unknown'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Location</span>
                        <span className={`text-xs px-2 py-1 rounded ${hasLocation ? 'bg-green-700 text-white' : 'bg-yellow-700 text-white'}`}>
                          {hasLocation ? 'GPS Tracked' : 'No GPS Signal'}
                        </span>
                      </div>
                      
                      {hasLocation && (
                        <div className="text-xs text-slate-400 mt-2">
                          Last GPS: {new Date(location.lastUpdate).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Job Site</span>
                        <span className="text-slate-300 text-sm">
                          {session.jobSiteLocation || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-center py-8">No workers currently active</div>
          )}
          

        </div>
      </div>
    </div>
  );
}