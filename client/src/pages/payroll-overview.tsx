import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import * as XLSX from 'xlsx';

interface ContractorEarnings {
  contractorName: string;
  sessions: any[];
  totalHours: number;
  hourlyRate: number;
  grossEarnings: number;
  cisDeduction: number;
  netEarnings: number;
  cisRate: number;
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
  
  const [selectedWeek, setSelectedWeek] = useState(getCurrentFridayWeekEnding());

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

  // AUTHENTIC DATA ONLY - Fetch from database
  const { data: timeTrackingData, isLoading, error } = useQuery<{
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
  }>({
    queryKey: ['/api/admin/time-tracking', selectedWeek],
    queryFn: async () => {
      const response = await fetch(`/api/admin/time-tracking?weekEnding=${selectedWeek}`);
      if (!response.ok) throw new Error('Failed to fetch time tracking data');
      return response.json();
    },
    enabled: !!selectedWeek
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading time tracking data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400">Error loading data: {error.message}</div>
      </div>
    );
  }

  const totals = timeTrackingData?.totals || {
    totalHours: 0,
    totalGrossEarnings: 0,
    totalCisDeduction: 0,
    totalNetEarnings: 0,
    contractors: 0
  };

  const contractors = timeTrackingData?.contractors || [];

  const exportToExcel = () => {
    if (!timeTrackingData) return;
    
    // Create summary sheet data
    const summaryData = [
      ['Weekly Payroll Report - Accounting Export'],
      [`Week ending: ${new Date(weekEnding).toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })}`],
      [''],
      ['Summary'],
      ['Total Hours', totals.totalHours.toFixed(1)],
      ['Gross Pay', `£${totals.totalGrossEarnings.toFixed(2)}`],
      ['CIS Deductions', `£${totals.totalCisDeduction.toFixed(2)}`],
      ['Net Payout', `£${totals.totalNetEarnings.toFixed(2)}`],
      ['Number of Contractors', totals.contractors],
      ['']
    ];

    // Create detailed daily breakdown for accounting
    const dailyBreakdownData = [
      ['Daily Breakdown for Accounting'],
      [''],
      ['Contractor', 'Date', 'Day', 'Location', 'Hours', 'Hourly Rate', 'Daily Gross', 'CIS Deduction', 'Daily Net', 'Start Time', 'End Time']
    ];

    contractors.forEach(contractor => {
      contractor.sessions.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        const dailyHours = parseFloat(session.totalHours);
        const dailyGross = dailyHours * contractor.hourlyRate;
        const dailyCIS = dailyGross * contractor.cisRate;
        const dailyNet = dailyGross - dailyCIS;

        dailyBreakdownData.push([
          contractor.contractorName,
          startDate.toLocaleDateString('en-GB'),
          startDate.toLocaleDateString('en-GB', { weekday: 'long' }),
          session.jobSiteLocation || 'Location data missing',
          dailyHours.toFixed(1),
          `£${contractor.hourlyRate.toFixed(2)}`,
          `£${dailyGross.toFixed(2)}`,
          `£${dailyCIS.toFixed(2)}`,
          `£${dailyNet.toFixed(2)}`,
          startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        ]);
      });
    });

    // Create contractor totals for accounting
    const contractorTotalsData = [
      ['Contractor Totals for Accounting'],
      [''],
      ['Contractor Name', 'Total Days Worked', 'Total Hours', 'Hourly Rate', 'Gross Earnings', 'CIS Deduction (30%)', 'Net Pay', 'Primary Location']
    ];

    contractors.forEach(contractor => {
      // Find most common location
      const locationCounts = {};
      contractor.sessions.forEach(session => {
        const location = session.jobSiteLocation || 'Unknown';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      });
      const primaryLocation = Object.keys(locationCounts).reduce((a, b) => 
        locationCounts[a] > locationCounts[b] ? a : b, 'Unknown'
      );

      contractorTotalsData.push([
        contractor.contractorName,
        contractor.sessions.length,
        contractor.totalHours.toFixed(1),
        `£${contractor.hourlyRate.toFixed(2)}`,
        `£${contractor.grossEarnings.toFixed(2)}`,
        `£${contractor.cisDeduction.toFixed(2)}`,
        `£${contractor.netEarnings.toFixed(2)}`,
        primaryLocation
      ]);
    });

    // Create detailed sessions data with rates
    const sessionsData = [
      ['Detailed Work Sessions'],
      [''],
      ['Contractor', 'Date', 'Location', 'Hours', 'Rate/Hour', 'Daily Earnings', 'Start Time', 'End Time', 'Session ID']
    ];

    contractors.forEach(contractor => {
      contractor.sessions.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        const dailyEarnings = parseFloat(session.totalHours) * contractor.hourlyRate;
        
        sessionsData.push([
          contractor.contractorName,
          startDate.toLocaleDateString('en-GB'),
          session.jobSiteLocation || 'Location data missing',
          parseFloat(session.totalHours).toFixed(1),
          `£${contractor.hourlyRate.toFixed(2)}`,
          `£${dailyEarnings.toFixed(2)}`,
          startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          session.id
        ]);
      });
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add summary sheet
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Add daily breakdown sheet (most important for accounting)
    const dailyWs = XLSX.utils.aoa_to_sheet(dailyBreakdownData);
    XLSX.utils.book_append_sheet(wb, dailyWs, 'Daily Breakdown');

    // Add contractor totals sheet
    const contractorWs = XLSX.utils.aoa_to_sheet(contractorTotalsData);
    XLSX.utils.book_append_sheet(wb, contractorWs, 'Contractor Totals');

    // Add detailed sessions sheet
    const sessionsWs = XLSX.utils.aoa_to_sheet(sessionsData);
    XLSX.utils.book_append_sheet(wb, sessionsWs, 'Detailed Sessions');

    // Generate filename with selected week date
    const filename = `payroll_accounting_${selectedWeek.replace(/-/g, '_')}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <LogoutButton />
      
      {/* Header with Week Selector and Export Button */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-600">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Weekly Payroll Report
            </h1>
            <p className="text-slate-300">
              Week ending {new Date(selectedWeek).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-56 bg-slate-700 text-white border-slate-600">
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
            <Button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              data-testid="button-export-excel"
            >
              <Download size={16} />
              Export to Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Weekly Totals - AUTHENTIC DATA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {totals.totalHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Gross Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                £{totals.totalGrossEarnings.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">CIS Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-400">
                £{totals.totalCisDeduction.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">Net Payout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                £{totals.totalNetEarnings.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contractor Details - AUTHENTIC DATABASE DATA ONLY */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Contractor Breakdown ({totals.contractors} contractors)
          </h2>

          {contractors.map((contractor, index) => (
            <Card key={index} className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-white">
                      {contractor.contractorName}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      £{contractor.hourlyRate.toFixed(2)}/hour • {contractor.totalHours.toFixed(1)} hours
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-slate-300 border-slate-600">
                    {contractor.sessions.length} sessions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Gross Earnings</div>
                    <div className="text-lg font-semibold text-green-400">
                      £{contractor.grossEarnings.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">CIS ({(contractor.cisRate * 100).toFixed(0)}%)</div>
                    <div className="text-lg font-semibold text-orange-400">
                      -£{contractor.cisDeduction.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Net Pay</div>
                    <div className="text-lg font-semibold text-blue-400">
                      £{contractor.netEarnings.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Session Details */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Work Sessions</h4>
                  <div className="space-y-2">
                    {contractor.sessions.map((session, sessionIndex) => (
                      <div key={sessionIndex} className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">
                          {new Date(session.startTime).toLocaleDateString('en-GB')} - 
                          {session.jobSiteLocation || 'Location data missing'}
                        </span>
                        <span className="text-slate-300">
                          {parseFloat(session.totalHours).toFixed(1)}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {contractors.length === 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="text-center py-12">
              <div className="text-slate-400">
                No contractor data found for this week
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}