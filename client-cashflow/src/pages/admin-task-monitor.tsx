import { useState } from "react";
import { Button } from "@/components/ui/button";
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

export default function AdminTaskMonitor() {
  const { toast } = useToast();

  const handleAction = (action: string) => {
    if (action === "Create Job") {
      // Navigate directly to create assignment page for job creation
      window.location.href = '/create-assignment';
    } else {
      toast({
        title: action,
        description: `${action} functionality`,
      });
    }
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

      {/* Admin Dashboard Badge */}
      <div className="bg-yellow-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <i className="fas fa-user-shield text-black mr-2"></i>
            <div>
              <span className="text-black font-medium text-sm">Admin Dashboard</span>
              <div className="text-black text-xs">Welcome {localStorage.getItem('adminName')?.split(' ')[0] || 'Admin'}</div>
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs flex items-center">
              <i className="fas fa-plus mr-1"></i>
              Job
            </div>
            <div className="bg-yellow-700 text-white px-2 py-1 rounded text-xs">
              <i className="fas fa-user"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Jobs Card */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Jobs</span>
              <i className="fas fa-briefcase text-blue-400"></i>
            </div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-slate-500 text-xs">Total</div>
          </div>

          {/* Active Card */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Active</span>
              <i className="fas fa-circle text-green-400"></i>
            </div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-slate-500 text-xs">Working</div>
          </div>

          {/* Hours Card */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Hours</span>
              <i className="fas fa-clock text-yellow-400"></i>
            </div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-slate-500 text-xs">Today</div>
          </div>

          {/* Pay Card */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Pay</span>
              <i className="fas fa-pound-sign text-yellow-400"></i>
            </div>
            <div className="text-2xl font-bold text-white">£0</div>
            <div className="text-slate-500 text-xs">Pending</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center mb-4">
            <i className="fas fa-bolt text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Quick Actions</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">

            
            <button 
              onClick={() => handleAction("Create Job")}
              className="bg-slate-700 hover:bg-slate-600 rounded-lg p-4 text-center border border-slate-600 transition-colors"
            >
              <i className="fas fa-plus text-orange-400 text-2xl mb-2 block"></i>
              <div className="text-white font-medium">Create Job</div>
              <div className="text-slate-400 text-xs">Create new assignment</div>
            </button>
            
            <button 
              onClick={() => handleAction("Time Tracking")}
              className="bg-slate-700 hover:bg-slate-600 rounded-lg p-4 text-center border border-slate-600 transition-colors"
            >
              <i className="fas fa-clock text-yellow-400 text-2xl mb-2 block"></i>
              <div className="text-white font-medium">Time Tracking</div>
              <div className="text-slate-400 text-xs">Monitor active sessions</div>
            </button>
            
            <button 
              onClick={() => window.location.href = '/job-assignments'}
              className="bg-slate-700 hover:bg-slate-600 rounded-lg p-4 text-center border border-slate-600 transition-colors"
            >
              <i className="fas fa-tasks text-blue-400 text-2xl mb-2 block"></i>
              <div className="text-white font-medium">Assignments</div>
              <div className="text-slate-400 text-xs">Manage job assignments</div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center mb-4">
            <i className="fas fa-chart-line text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Recent Activity</h3>
          </div>
          
          <div className="text-center py-8">
            <div className="text-slate-400">No recent activity</div>
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
          <button className="py-3 px-4 text-yellow-400">
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