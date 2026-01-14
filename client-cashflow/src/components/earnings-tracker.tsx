import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { DALWAYNE_EARNINGS, EARL_EARNINGS } from "@/lib/earnings-calculator";

interface EarningsTrackerProps {
  isTracking: boolean;
  startTime: Date | null;
  currentTime: string;
  gpsValidated: boolean;
  distanceFromSite: number;
  isWeekendWork: boolean;
}

interface EarningsCalculation {
  hoursWorked: number;
  hourlyRate: number;
  grossEarnings: number;
  punctualityDeduction: number;
  cisDeduction: number;
  netEarnings: number;
  isOvertimeRate: boolean;
}

export function EarningsTracker({ 
  isTracking, 
  startTime, 
  currentTime, 
  gpsValidated,
  distanceFromSite,
  isWeekendWork 
}: EarningsTrackerProps) {
  // Get authentic contractor data from database
  const contractorName = localStorage.getItem('contractorName') || 'Dalwayne Diedericks';
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

  // Use authentic hourly rate from database
  const hourlyRate = contractorApplication?.adminPayRate ? parseFloat(contractorApplication.adminPayRate) : 18.75;
  const cisRate = contractorApplication?.isCisRegistered === 'true' ? 20 : 30;

  const [earnings, setEarnings] = useState<EarningsCalculation>({
    hoursWorked: 0,
    hourlyRate: 18.75, // Will be updated from database
    grossEarnings: 0,
    punctualityDeduction: 0,
    cisDeduction: 0,
    netEarnings: 0,
    isOvertimeRate: false
  });

  // Calculate earnings in real-time
  useEffect(() => {
    if (!isTracking || !startTime) {
      setEarnings(prev => ({ ...prev, hoursWorked: 0, grossEarnings: 0, netEarnings: 0 }));
      return;
    }

    const now = new Date();
    const hoursWorked = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    // Use authentic hourly rate with weekend overtime multiplier
    const baseRate = hourlyRate;
    const overtimeMultiplier = isWeekendWork ? 1.5 : 1.0; // 1.5x for weekends
    const effectiveHourlyRate = baseRate * overtimeMultiplier;
    
    // Calculate gross earnings using daily rate logic (8+ hours = daily rate)
    const dailyRate = baseRate * 8; // £18.75 × 8 = £150
    const isFullDay = hoursWorked >= 8;
    const grossEarnings = isFullDay ? dailyRate : (hoursWorked * effectiveHourlyRate);
    
    // Calculate punctuality deduction (£0.50/minute after 8:15 AM, max £50, min £100 daily pay)
    let punctualityDeduction = 0;
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const clockInTime = startHour + startMinute / 60;
    const lateThreshold = 8 + 15/60; // 8:15 AM
    
    if (clockInTime > lateThreshold) {
      const lateMinutes = (clockInTime - lateThreshold) * 60;
      punctualityDeduction = Math.min(lateMinutes * 0.50, 50); // Max £50 deduction
    }
    
    // Calculate CIS deduction using authentic contractor data
    const adjustedGrossEarnings = Math.max(100, grossEarnings - punctualityDeduction); // Minimum £100 daily pay
    const cisDeduction = adjustedGrossEarnings * (cisRate / 100);
    
    // Calculate net earnings (minimum £100 daily pay)
    const beforeMinimum = grossEarnings - punctualityDeduction - cisDeduction;
    const netEarnings = Math.max(beforeMinimum, 100); // Minimum £100 daily pay
    
    setEarnings({
      hoursWorked,
      hourlyRate: effectiveHourlyRate,
      grossEarnings: adjustedGrossEarnings,
      punctualityDeduction,
      cisDeduction,
      netEarnings,
      isOvertimeRate: isWeekendWork
    });
  }, [isTracking, startTime, currentTime, isWeekendWork, hourlyRate, cisRate]);

  if (!isTracking) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-yellow-400 text-lg flex items-center">
            💰 Earnings Tracker
            <Badge variant="secondary" className="ml-2 bg-slate-700 text-slate-300">
              Not Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-slate-400 text-sm">
              Start time tracking to monitor earnings
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-yellow-400 text-lg flex items-center justify-between">
          <span className="flex items-center">
            💰 Live Earnings
            {gpsValidated ? (
              <Badge className="ml-2 bg-green-600 text-white">GPS Verified</Badge>
            ) : (
              <Badge className="ml-2 bg-red-600 text-white">GPS Invalid</Badge>
            )}
          </span>
          {earnings.isOvertimeRate && (
            <Badge className="bg-orange-600 text-white">Weekend Overtime</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time & Rate Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Hours Worked</div>
            <div className="text-white text-lg font-mono">
              {earnings.hoursWorked.toFixed(2)}h
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Rate/Hour</div>
            <div className="text-yellow-400 text-lg font-semibold">
              £{earnings.hourlyRate.toFixed(2)}
              {earnings.isOvertimeRate && <span className="text-xs ml-1">(1.5x)</span>}
            </div>
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Gross Earnings:</span>
            <span className="text-green-400 font-semibold">£{earnings.grossEarnings.toFixed(2)}</span>
          </div>
          
          {earnings.punctualityDeduction > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Late Arrival Deduction:</span>
              <span className="text-red-400 font-semibold">-£{earnings.punctualityDeduction.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-slate-300">CIS Deduction (20%):</span>
            <span className="text-orange-400 font-semibold">-£{earnings.cisDeduction.toFixed(2)}</span>
          </div>
          
          <div className="border-t border-slate-600 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Net Earnings:</span>
              <span className="text-yellow-400 text-xl font-bold">£{earnings.netEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* GPS Status */}
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">GPS Status</div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Distance from site: {distanceFromSite.toFixed(0)}m
            </span>
            {gpsValidated ? (
              <Badge className="bg-green-600 text-white text-xs">✓ Valid</Badge>
            ) : (
              <Badge className="bg-red-600 text-white text-xs">✗ Invalid</Badge>
            )}
          </div>
        </div>

        {/* Important Notes */}
        <div className="text-xs text-slate-400 space-y-1">
          <div>• Minimum daily pay: £100 guaranteed</div>
          <div>• Late arrival after 8:15 AM: £0.50/minute deduction</div>
          <div>• CIS deduction: 20% of gross earnings</div>
          {earnings.isOvertimeRate && (
            <div className="text-orange-400">• Weekend overtime rate: 1.5x standard rate</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}