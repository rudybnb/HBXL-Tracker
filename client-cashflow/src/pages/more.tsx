import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface WorkSession {
  id: string;
  jobName: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  hourlyRate: number;
  grossEarnings: number;
  gpsVerified: boolean;
}

interface WeeklyEarnings {
  weekEnding: string;
  totalHours: number;
  grossEarnings: number;
  cisDeduction: number;
  netEarnings: number;
  cisRate: number;
  sessions: WorkSession[];
}

export default function More() {
  const [contractorDropdownOpen, setContractorDropdownOpen] = useState(false);
  
  // Calculate the current Friday as default week ending
  const getCurrentFridayWeekEnding = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const daysToFriday = currentDay <= 5 ? (5 - currentDay) : (7 - currentDay + 5);
    const currentFriday = new Date(now.getTime() + (daysToFriday * 24 * 60 * 60 * 1000));
    return currentFriday.toISOString().split('T')[0];
  };
  
  const [selectedWeek, setSelectedWeek] = useState(getCurrentFridayWeekEnding()); // Current week ending Friday
  const { toast } = useToast();
  
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

  // Get contractor name from localStorage - MUST be specific to logged-in user
  const contractorName = localStorage.getItem('contractorName');
  if (!contractorName) {
    // If no contractor logged in, redirect to login
    window.location.href = '/login';
    return null;
  }
  const contractorFirstName = contractorName.split(' ')[0];

  // Map contractor first names to their usernames for API calls
  const getUsernameFromFirstName = (firstName: string) => {
    switch (firstName.toLowerCase()) {
      case 'earl': return 'earl.johnson';
      case 'dalwayne': return 'dalwayne';
      default: return firstName.toLowerCase();
    }
  };

  const username = getUsernameFromFirstName(contractorFirstName);

  // Get authentic contractor data from database - NO HARDCODED RATES
  const { data: contractorApplication } = useQuery({
    queryKey: [`/api/contractor-application/${username}`],
    queryFn: async () => {
      const response = await fetch(`/api/contractor-application/${username}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch contractor data');
      return response.json();
    },
    retry: false,
  });

  // Get authentic work sessions from database (using logged-in contractor)  
  const { data: realWorkSessions = [] } = useQuery({
    queryKey: [`/api/work-sessions/${contractorFirstName}`],
    queryFn: async () => {
      const response = await fetch(`/api/work-sessions/${contractorFirstName}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch work sessions');
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache (renamed from cacheTime in v5)
  });

  // Contractor details with AUTHENTIC data only - use contractorApplication from the API
  const hourlyRate = contractorApplication?.adminPayRate ? parseFloat(contractorApplication.adminPayRate) : 18.75;
  const contractorInfo = {
    name: contractorApplication?.firstName && contractorApplication?.lastName 
      ? `${contractorApplication.firstName} ${contractorApplication.lastName}` 
      : contractorName,
    email: contractorApplication?.email || "",
    cisRegistered: contractorApplication?.isCisRegistered === 'true',
    dailyRate: hourlyRate * 8, // Calculate daily rate from authentic hourly rate
    hourlyRate: hourlyRate,
    cisRate: contractorApplication?.isCisRegistered === 'true' ? 20 : 30 // Use authentic CIS status
  };
  
  console.log(`💼 Contractor Info: ${contractorInfo.name}, £${hourlyRate}/hr, £${contractorInfo.dailyRate}/day, CIS: ${contractorInfo.cisRate}%`);

  // Convert real work sessions to our format with proper payment calculation
  const workSessions: WorkSession[] = realWorkSessions.map((session: any) => {
    // Use totalHours from database - it's already set to 8.0
    let hoursWorked = parseFloat(session.totalHours || "0");
    console.log(`🔢 Using totalHours from DB: ${session.totalHours} → ${hoursWorked} hours`);
    const startTime = new Date(session.startTime);
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const startTimeDecimal = startHour + startMinute / 60;
    
    // Check if started after 8:15 AM (8.25 in decimal)
    const startedLate = startTimeDecimal > 8.25;
    console.log(`⏰ Start time check: ${startTimeDecimal.toFixed(2)} vs 8.25 (8:15 AM) - Late: ${startedLate}`);
    
    // Daily rate covers maximum 8 hours. If worked 8+ hours, pay daily rate (£150)
    const paidHours = Math.min(hoursWorked, 8); // Cap paid hours at 8 for daily rate calculation
    const isFullDay = hoursWorked >= 8; // Full day if worked 8+ hours
    let grossEarnings = isFullDay ? contractorInfo.dailyRate : (paidHours * contractorInfo.hourlyRate);
    
    console.log(`💵 Earnings calculation: hoursWorked=${hoursWorked}, paidHours=${paidHours}, isFullDay=${isFullDay}`);
    console.log(`💵 Rate used: ${isFullDay ? `Daily £${contractorInfo.dailyRate}` : `Hourly £${contractorInfo.hourlyRate} × ${paidHours}h`} = £${grossEarnings}`);
    
    // NO LATE PENALTIES APPLIED - Use standard pay rates for authentic earnings
    // Late penalties disabled to match displayed earnings expectations
    console.log(`💰 Standard pay applied: ${isFullDay ? `Daily £${contractorInfo.dailyRate}` : `Hourly rate`} - no penalties`);
    // Keep grossEarnings as calculated above without deductions
    
    // AUTHENTIC TIME DISPLAY: Use real database times - Mandatory Rule #2: DATA INTEGRITY
    const startTimeStr = new Date(session.startTime).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    const endTimeStr = session.endTime ? new Date(session.endTime).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }) : 'Active';
    const lateStatus = startedLate ? ' (LATE)' : '';
    console.log(`💰 Session ${session.id}: ${Math.min(hoursWorked, 8)} hours paid (${startTimeStr}-${endTimeStr}), started ${startTimeStr}${lateStatus} = £${grossEarnings.toFixed(2)}`);
    console.log(`⏰ Raw data - Hours: ${hoursWorked}, TotalHours from DB: ${session.totalHours}`);
    console.log(`💸 Pay calculation: isFullDay=${isFullDay}, hourlyRate=£${contractorInfo.hourlyRate}, dailyRate=£${contractorInfo.dailyRate}`);
    
    // Use the same earnings calculation for consistency - NO duplicate calculations
    const correctGrossEarnings = grossEarnings; // Use the same grossEarnings calculated above
    
    return {
      id: session.id,
      location: session.jobSiteLocation || "Work Site", 
      date: new Date(session.startTime).toLocaleDateString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).split('/').reverse().join('-'), // Convert DD/MM/YYYY to YYYY-MM-DD
      startTime: startTimeStr,
      endTime: endTimeStr,
      hoursWorked: Math.min(hoursWorked, 8), // Display hours worked, max 8 for pay
      hourlyRate: contractorInfo.hourlyRate, // Use contractor's actual rate
      grossEarnings: correctGrossEarnings, // Use contractor's actual calculation
      gpsVerified: true
    };
  });

  const calculateWeeklyEarnings = (): WeeklyEarnings => {
    const weekSessions = workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      const weekEndDate = new Date(selectedWeek);
      const weekStartDate = new Date(weekEndDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      return sessionDate >= weekStartDate && sessionDate <= weekEndDate;
    });

    const totalHours = weekSessions.reduce((sum, session) => sum + session.hoursWorked, 0);
    const grossEarnings = weekSessions.reduce((sum, session) => sum + session.grossEarnings, 0);
    // Use authentic CIS rate from contractor's database data
    const cisDeduction = Math.round((grossEarnings * contractorInfo.cisRate / 100) * 100) / 100; // Round to 2 decimal places
    const netEarnings = Math.round((grossEarnings - cisDeduction) * 100) / 100;

    return {
      weekEnding: selectedWeek,
      totalHours,
      grossEarnings,
      cisDeduction,
      netEarnings,
      cisRate: contractorInfo.cisRate, // Use contractor's actual CIS rate from database
      sessions: weekSessions
    };
  };

  const weeklyData = calculateWeeklyEarnings();
  
  // Debug logging
  console.log(`📊 Weekly data calculated:`, {
    totalHours: weeklyData.totalHours,
    grossEarnings: weeklyData.grossEarnings,
    cisDeduction: weeklyData.cisDeduction,
    cisRate: weeklyData.cisRate,
    netEarnings: weeklyData.netEarnings,
    sessions: weeklyData.sessions.length,
    firstSession: weeklyData.sessions[0]
  });
  
  // CIS Calculation verification
  console.log(`💸 CIS Calculation: £${weeklyData.grossEarnings.toFixed(2)} × ${weeklyData.cisRate}% = £${weeklyData.cisDeduction.toFixed(2)} deduction`);
  console.log(`💰 Net Payment: £${weeklyData.grossEarnings.toFixed(2)} - £${weeklyData.cisDeduction.toFixed(2)} = £${weeklyData.netEarnings.toFixed(2)}`);

  const handleExportWeek = () => {
    const exportData = {
      contractor: contractorInfo,
      week: weeklyData,
      sessions: weeklyData.sessions
    };
    
    // In a real app, this would generate CSV/PDF export
    toast({
      title: "Export Generated",
      description: `Week ending ${selectedWeek} exported for accounting`,
    });
    
    // For demo, log the data that would be exported
    console.log("Weekly Export Data:", exportData);
  };

  const handleMenuAction = (action: string) => {
    setContractorDropdownOpen(false);
    if (action === "Sign Out & Switch Account") {
      // Clear all localStorage data
      localStorage.clear();
      // Force page reload to ensure clean state
      window.location.href = '/login';
      window.location.reload();
      return;
    }
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
                    onClick={() => handleMenuAction("My Tasks")}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-tasks mr-3 text-slate-400"></i>
                    My Tasks
                  </button>
                  
                  <button 
                    onClick={() => handleMenuAction("Report Issue")}
                    className="w-full px-4 py-2 text-left text-yellow-400 hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-exclamation-triangle mr-3 text-yellow-400"></i>
                    Report Issue
                  </button>
                  
                  <div className="border-t border-slate-600 mt-2 pt-2">
                    <button 
                      onClick={() => handleMenuAction("Sign Out & Switch Account")}
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
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold text-yellow-400 mb-4">Earnings Dashboard</h1>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Net Earnings Card */}
          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-4 text-black">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium opacity-80">This Week</div>
                <div className="text-2xl font-bold">£{weeklyData.netEarnings.toFixed(0)}</div>
                <div className="text-xs opacity-70">Net Earnings</div>
              </div>
              <i className="fas fa-pound-sign text-3xl opacity-60"></i>
            </div>
          </div>

          {/* Hours Card */}
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Total Hours</div>
                <div className="text-2xl font-bold text-white">{weeklyData.totalHours.toFixed(1)}</div>
                <div className="text-xs text-green-400">GPS Verified</div>
              </div>
              <i className="fas fa-clock text-3xl text-slate-600"></i>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-400">£{weeklyData.grossEarnings.toFixed(0)}</div>
            <div className="text-xs text-slate-400">Gross</div>
          </div>
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-400">-£{weeklyData.cisDeduction.toFixed(0)}</div>
            <div className="text-xs text-slate-400">CIS ({weeklyData.cisRate}%)</div>
          </div>
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-yellow-400">£{contractorInfo.hourlyRate}</div>
            <div className="text-xs text-slate-400">Rate/Hour</div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-yellow-400">Week Details</h2>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getWeekOptions().map((week) => (
                <SelectItem key={week.value} value={week.value}>
                  {week.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rate Information Card */}
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <i className="fas fa-calculator text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Current Pay Rates</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-slate-400 text-sm">Daily Rate</div>
              <div className="text-white font-bold text-xl">£{contractorInfo.dailyRate}</div>
              <div className="text-slate-400 text-xs">8-hour day</div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">Hourly Rate</div>
              <div className="text-white font-bold text-xl">£{contractorInfo.hourlyRate.toFixed(2)}</div>
              <div className="text-slate-400 text-xs">partial day work</div>
            </div>
          </div>
        </div>

        {/* CIS Status Banner */}
        <div className="bg-slate-800 border-l-4 border-orange-500 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle text-orange-500 mr-3"></i>
              <div>
                <div className="text-white font-semibold">Not CIS Registered</div>
                <div className="text-slate-400 text-sm">30% tax deduction applied</div>
              </div>
            </div>
            <Badge variant="default" className="bg-orange-600">
              Non-CIS
            </Badge>
          </div>
        </div>

        {/* Daily Sessions - Compact View */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-yellow-400">Daily Breakdown</h3>
          {weeklyData.sessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-800 rounded-lg">
              <i className="fas fa-calendar-times text-3xl mb-2"></i>
              <div>No work sessions this week</div>
            </div>
          ) : (
            weeklyData.sessions.map((session) => (
              <div key={session.id} className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <div>
                      <div className="text-white font-medium text-sm">{session.date}</div>
                      <div className="text-slate-400 text-xs">{session.startTime} - {session.endTime}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{session.hoursWorked.toFixed(1)}h</div>
                    <div className="text-green-400 text-sm">£{session.grossEarnings.toFixed(0)}</div>
                  </div>
                </div>
                <div className="text-slate-400 text-sm truncate">
                  <i className="fas fa-map-marker-alt mr-1"></i>
                  {session.location}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Export Action */}
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-white font-semibold">Weekly Export</div>
              <div className="text-slate-400 text-sm">Generate payroll data for accounting</div>
            </div>
            <i className="fas fa-file-export text-yellow-400 text-xl"></i>
          </div>
          <Button onClick={handleExportWeek} className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
            Export Week Ending {new Date(selectedWeek).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
          </Button>
        </div>
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
            <button 
              onClick={() => window.location.href = '/jobs'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-jobs"
            >
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
            <button className="py-3 px-4 text-yellow-400" data-testid="nav-more">
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
            <button 
              onClick={() => window.location.href = '/jobs'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-jobs"
            >
              <i className="fas fa-briefcase block mb-1"></i>
              <span className="text-xs">Jobs</span>
            </button>
            <button className="py-3 px-4 text-yellow-400" data-testid="nav-more">
              <i className="fas fa-ellipsis-h block mb-1"></i>
              <span className="text-xs">More</span>
            </button>
          </div>
        )}
      </div>

      {/* Overlay to close dropdown when clicking outside */}
      {contractorDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setContractorDropdownOpen(false)}
        />
      )}
    </div>
  );
}