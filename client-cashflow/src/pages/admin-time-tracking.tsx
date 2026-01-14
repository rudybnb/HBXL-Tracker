import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ContractorEarnings {
  contractorName: string;
  sessions: any[];
  totalHours: number;
  hoursWorked: number;
  hourlyRate: number;
  grossEarnings: number;
  cisDeduction: number;
  netEarnings: number;
  cisRate: number;
  gpsVerified: boolean;
}

interface JobEarnings {
  jobId: string;
  jobTitle: string;
  location: string;
  weekEnding: string;
  totalHours: number;
  totalGrossEarnings: number;
  totalCisDeduction: number;
  totalNetEarnings: number;
  contractors: ContractorEarnings[];
  gpsVerified: boolean;
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

export default function AdminTimeTracking() {
  // Calculate the current week ending (most recent Friday that includes today)
  const getCurrentFridayWeekEnding = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    
    // If today is Saturday (6) or Sunday (0), we want last Friday
    // If today is Monday-Friday (1-5), we want this Friday
    let daysToFriday;
    if (currentDay === 0) { // Sunday
      daysToFriday = -2; // Go back 2 days to Friday
    } else if (currentDay === 6) { // Saturday  
      daysToFriday = -1; // Go back 1 day to Friday
    } else { // Monday-Friday
      daysToFriday = 5 - currentDay; // Go forward to this Friday
    }
    
    const weekEndingFriday = new Date(now.getTime() + (daysToFriday * 24 * 60 * 60 * 1000));
    return weekEndingFriday.toISOString().split('T')[0];
  };
  
  const [selectedWeek, setSelectedWeek] = useState(getCurrentFridayWeekEnding()); // Current week ending Friday
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const { toast } = useToast();

  // Fetch real time tracking data from backend
  const { data: timeTrackingData, isLoading } = useQuery<{
    weekEnding: string;
    weekStart: string;
    weekEnd: string;
    contractors: ContractorEarnings[];
    totals: {
      totalHours: number;
      totalGrossEarnings: number;
      totalCisDeduction: number;
      totalNetEarnings: number;
      contractors: number;
    };
    sessionsCount: number;
  }>({
    queryKey: ['/api/admin/time-tracking', selectedWeek],
    queryFn: async () => {
      const response = await fetch(`/api/admin/time-tracking?weekEnding=${selectedWeek}`);
      if (!response.ok) {
        throw new Error('Failed to fetch time tracking data');
      }
      return response.json();
    },
    enabled: !!selectedWeek
  });

  // Calculate totals from real data
  const totalWeeklySpend = timeTrackingData?.totals.totalGrossEarnings || 0;
  const totalWeeklyHours = timeTrackingData?.totals.totalHours || 0;
  const totalCisDeductions = timeTrackingData?.totals.totalCisDeduction || 0;
  const totalNetPayout = timeTrackingData?.totals.totalNetEarnings || 0;
  const contractors = timeTrackingData?.contractors || [];
  const sessionsCount = timeTrackingData?.sessionsCount || 0;

  // Generate week options for the last 12 weeks - ALWAYS ending on Friday
  const getWeekOptions = () => {
    const weeks = [];
    const now = new Date();
    
    // Find the most recent Friday (or today if it's Friday)
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const daysToFriday = currentDay <= 5 ? (5 - currentDay) : (7 - currentDay + 5);
    const mostRecentFriday = new Date(now.getTime() + (daysToFriday * 24 * 60 * 60 * 1000));
    
    for (let i = 0; i < 12; i++) {
      const weekEndingFriday = new Date(mostRecentFriday.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnding = weekEndingFriday.toISOString().split('T')[0];
      const weekLabel = `Week ending ${weekEndingFriday.toLocaleDateString('en-UK', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      })} (Fri)`;
      weeks.push({ value: weekEnding, label: weekLabel });
    }
    return weeks;
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
            <div className="text-xs text-slate-400">Time Tracking Dashboard</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-500">Online</span>
          <i className="fas fa-sun text-yellow-400 ml-2"></i>
          <div className="relative">
            <button 
              onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
              className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center ml-4 hover:bg-yellow-700 transition-colors"
            >
              <span className="text-white font-bold text-sm">{(localStorage.getItem('adminName') || 'Admin').split(' ').map(n => n[0]).join('').slice(0,2)}</span>
            </button>
            <i className="fas fa-chevron-down text-slate-400 text-xs ml-1"></i>
            
            {/* Avatar Dropdown */}
            {showAvatarDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg shadow-xl border border-slate-600 z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-slate-600">
                  <div className="font-medium text-white">{localStorage.getItem('adminName') || 'Admin'}</div>
                  <div className="text-sm text-slate-400">{localStorage.getItem('adminEmail') || 'admin@erbuildanddesign.co.uk'}</div>
                  <div className="flex items-center mt-2">
                    <i className="fas fa-clock text-blue-400 mr-2"></i>
                    <span className="text-blue-400 text-sm">Time Tracking Admin</span>
                  </div>
                </div>
                
                <div className="py-2">
                  <button 
                    onClick={() => window.location.href = '/admin'}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                  >
                    <i className="fas fa-tachometer-alt mr-3 w-4"></i>
                    Admin Dashboard
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = '/live-clock-monitor'}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                  >
                    <i className="fas fa-broadcast-tower mr-3 w-4"></i>
                    Live Clock Monitor
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = '/job-assignments'}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                  >
                    <i className="fas fa-tasks mr-3 w-4"></i>
                    Job Assignments
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = '/admin-applications'}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center text-white"
                  >
                    <i className="fas fa-users mr-3 w-4"></i>
                    Applications
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Time Tracking Badge */}
      <div className="bg-blue-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <i className="fas fa-clock text-white mr-2"></i>
            <div>
              <span className="text-white font-medium text-sm">Time Tracking Dashboard</span>
              <div className="text-blue-100 text-xs">Monitor contractor earnings by job</div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-48 bg-blue-700 text-white border-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getWeekOptions().map(week => (
                  <SelectItem key={week.value} value={week.value}>
                    {week.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button 
              onClick={() => {
                if (selectedWeek) {
                  window.open(`/api/admin/time-tracking/export?weekEnding=${selectedWeek}`, '_blank');
                  toast({ title: "Export Data", description: "Time tracking data exported successfully!" });
                } else {
                  toast({ title: "Export Error", description: "Please select a week to export", variant: "destructive" });
                }
              }}
              className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors"
            >
              <i className="fas fa-download mr-1"></i>
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Weekly Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Spend</p>
                  <p className="text-2xl font-bold text-green-400">£{totalWeeklySpend.toFixed(2)}</p>
                </div>
                <i className="fas fa-pound-sign text-green-400 text-xl"></i>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Hours</p>
                  <p className="text-2xl font-bold text-blue-400">{totalWeeklyHours.toFixed(1)}h</p>
                </div>
                <i className="fas fa-clock text-blue-400 text-xl"></i>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">CIS Deductions</p>
                  <p className="text-2xl font-bold text-orange-400">£{totalCisDeductions.toFixed(2)}</p>
                </div>
                <i className="fas fa-percentage text-orange-400 text-xl"></i>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Net Payout</p>
                  <p className="text-2xl font-bold text-yellow-400">£{totalNetPayout.toFixed(2)}</p>
                </div>
                <i className="fas fa-hand-holding-usd text-yellow-400 text-xl"></i>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Earnings Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Contractor Earnings Breakdown</h3>
            <Badge variant="outline" className="text-slate-400 border-slate-600">
              {contractors.length} Contractors
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-slate-400">Loading contractor earnings...</div>
            </div>
          ) : contractors.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <i className="fas fa-clock text-slate-500 text-4xl mb-4"></i>
                <h4 className="text-lg font-medium text-slate-400 mb-2">No Time Tracking Data</h4>
                <p className="text-slate-500 text-sm mb-4">
                  No contractor time tracking data available for the selected week.
                </p>
                <div className="text-slate-500 text-xs">
                  Time tracking data will appear here once contractors start working and logging hours through the GPS system.
                </div>
              </CardContent>
            </Card>
          ) : (
            contractors.map((contractor: ContractorEarnings, index: number) => (
              <Card key={contractor.contractorName} className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {contractor.contractorName.split(' ').map((n: string) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg">{contractor.contractorName}</CardTitle>
                        <CardDescription className="text-slate-400">
                          <i className="fas fa-clock mr-1"></i>
                          {contractor.hoursWorked.toFixed(2)}h worked this week
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-400">£{contractor.grossEarnings.toFixed(2)}</div>
                      <div className="text-sm text-slate-400">£{contractor.hourlyRate.toFixed(2)}/hour</div>
                      <Badge className="bg-green-900 text-green-300 mt-1">
                        <i className="fas fa-map-marker-alt mr-1"></i>GPS Verified
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Earnings breakdown */}
                    <div className="bg-slate-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400 text-sm">Earnings Breakdown</span>
                        <span className="text-slate-400 text-xs">{contractor.sessions.length} sessions</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Gross Earnings:</span>
                          <span className="text-white font-medium">£{contractor.grossEarnings.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">CIS Deduction ({(contractor.cisRate * 100).toFixed(0)}%):</span>
                          <span className="text-orange-400">-£{contractor.cisDeduction.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-slate-600 pt-2 flex justify-between">
                          <span className="text-slate-300 font-medium">Net Payout:</span>
                          <span className="text-green-400 font-bold">£{contractor.netEarnings.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-600">
        <div className="flex justify-around">
          <button 
            onClick={() => window.location.href = '/admin'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-tachometer-alt block mb-1"></i>
            <span className="text-xs">Dashboard</span>
          </button>
          <button 
            onClick={() => window.location.href = '/job-assignments'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-tasks block mb-1"></i>
            <span className="text-xs">Jobs</span>
          </button>
          <button className="py-3 px-4 text-blue-400">
            <i className="fas fa-clock block mb-1"></i>
            <span className="text-xs">Time Tracking</span>
          </button>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-upload block mb-1"></i>
            <span className="text-xs">Upload Job</span>
          </button>
        </div>
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}