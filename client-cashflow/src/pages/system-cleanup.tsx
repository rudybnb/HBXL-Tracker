import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SystemCleanup } from "@/utils/cleanup";
import { useToast } from "@/hooks/use-toast";

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

export default function SystemCleanupPage() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFullCleanup = async () => {
    setIsCleaningUp(true);
    
    try {
      // Check current data before cleanup
      const beforeCleanup = SystemCleanup.checkForRemainingData();
      
      // Perform cleanup
      SystemCleanup.performFullCleanup();
      
      // Check data after cleanup
      setTimeout(() => {
        const afterCleanup = SystemCleanup.checkForRemainingData();
        setCleanupResult({
          before: beforeCleanup,
          after: afterCleanup
        });
        
        toast({
          title: "System Cleaned",
          description: "All temporary data and caches have been cleared",
        });
        
        setIsCleaningUp(false);
      }, 500);
      
    } catch (error) {
      toast({
        title: "Cleanup Error",
        description: "Error during system cleanup",
        variant: "destructive"
      });
      setIsCleaningUp(false);
    }
  };

  const handleQuickCleanup = () => {
    SystemCleanup.clearLocalStorage();
    SystemCleanup.clearSessionStorage();
    
    toast({
      title: "Quick Cleanup Complete",
      description: "Storage data cleared without page reload",
    });
  };

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
          <h1 className="text-3xl font-bold text-yellow-400">System Cleanup</h1>
        </div>

        {/* Cleanup Actions */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center mb-4">
            <i className="fas fa-broom text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Data Cleanup Actions</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button 
                onClick={handleFullCleanup}
                disabled={isCleaningUp}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
              >
                {isCleaningUp ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Cleaning...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash-alt mr-2"></i>
                    Full System Cleanup
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleQuickCleanup}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2"
              >
                <i className="fas fa-eraser mr-2"></i>
                Quick Storage Clear
              </Button>
            </div>
            
            <div className="text-sm text-slate-400">
              <p><strong>Full System Cleanup:</strong> Clears all localStorage, sessionStorage, browser cache, and reloads the page for a completely fresh start.</p>
              <p><strong>Quick Storage Clear:</strong> Clears only localStorage and sessionStorage without page reload.</p>
            </div>
          </div>
        </div>

        {/* Cleanup Results */}
        {cleanupResult && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center mb-4">
              <i className="fas fa-chart-bar text-green-400 mr-2"></i>
              <h3 className="text-lg font-semibold text-green-400">Cleanup Results</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-yellow-400 font-medium mb-2">Before Cleanup</h4>
                <div className="text-sm text-slate-300">
                  <p>LocalStorage keys: {cleanupResult.before.localStorage.length}</p>
                  <p>SessionStorage keys: {cleanupResult.before.sessionStorage.length}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-green-400 font-medium mb-2">After Cleanup</h4>
                <div className="text-sm text-slate-300">
                  <p>LocalStorage keys: {cleanupResult.after.localStorage.length}</p>
                  <p>SessionStorage keys: {cleanupResult.after.sessionStorage.length}</p>
                </div>
              </div>
            </div>
            
            {cleanupResult.after.localStorage.length === 0 && cleanupResult.after.sessionStorage.length === 0 && (
              <div className="mt-4 p-3 bg-green-900 border border-green-600 rounded-lg">
                <div className="flex items-center">
                  <i className="fas fa-check-circle text-green-400 mr-2"></i>
                  <span className="text-green-300 font-medium">System is completely clean!</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Data Status */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center mb-4">
            <i className="fas fa-info-circle text-blue-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-blue-400">System Status</h3>
          </div>
          
          <div className="text-sm text-slate-300 space-y-2">
            <p>• All temporary test data removed from memory storage</p>
            <p>• CSV upload caches cleared</p>
            <p>• Job assignment data reset</p>
            <p>• Component states refreshed</p>
            <p>• Browser cache cleared</p>
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
          <button 
            onClick={() => window.location.href = '/job-assignments'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
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