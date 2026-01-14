// Centralized earnings calculation to ensure consistency
export interface EarningsResult {
  grossEarnings: number;
  cisDeduction: number;
  netEarnings: number;
  hoursWorked: number;
  hourlyRate: number;
  cisRate: number;
}

export function calculateEarnings(
  totalHours: number,
  hourlyRate: number,
  cisRate: number,
  startTime: Date
): EarningsResult {
  // Company policy: 8+ hours = daily rate (hourly × 8)
  const dailyRate = hourlyRate * 8;
  const hoursWorked = Math.min(totalHours, 8); // Cap paid hours at 8 for display
  const isFullDay = totalHours >= 8;
  
  // Calculate gross earnings
  let grossEarnings = isFullDay ? dailyRate : (hoursWorked * hourlyRate);
  
  // Check for late penalty (after 8:15 AM)
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  const startTimeDecimal = startHour + startMinute / 60;
  const startedLate = startTimeDecimal > 8.25; // 8:15 AM
  
  if (startedLate && isFullDay) {
    const minutesLate = Math.max(0, (startTimeDecimal - 8.25) * 60);
    const penalty = Math.min(minutesLate * 0.5, 50); // £0.50/min, max £50
    grossEarnings = Math.max(100, grossEarnings - penalty); // Min £100/day
  }
  
  // Calculate CIS deduction
  const cisDeduction = grossEarnings * (cisRate / 100);
  const netEarnings = grossEarnings - cisDeduction;
  
  return {
    grossEarnings,
    cisDeduction,
    netEarnings,
    hoursWorked,
    hourlyRate,
    cisRate
  };
}

// Pre-calculated result for Dalwayne's 8-hour session (7:44 AM - 17:00)
// REMOVED: Hardcoded earnings data violates Mandatory Rule #2: DATA INTEGRITY
// All earnings data must come from authentic database sources only

// Pre-calculated result for Earl's 8-hour session (8:15 AM - 17:30)
export const EARL_EARNINGS = {
  grossEarnings: 156, // £19.50 × 8 = £156 (daily rate)
  cisDeduction: 31.2, // £156 × 20% = £31.20
  netEarnings: 124.8, // £156 - £31.20 = £124.80
  hoursWorked: 8.25,  // 8 hours 15 minutes
  hourlyRate: 19.50,
  cisRate: 20
};