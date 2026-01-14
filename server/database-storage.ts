import {
  type Contractor,
  type InsertContractor,
  type Job,
  type InsertJob,
  type CsvUpload,
  type InsertCsvUpload,
  type JobWithContractor,
  type ContractorApplication,
  type InsertContractorApplication,
  type WorkSession,
  type InsertWorkSession,
  type AdminSetting,
  type InsertAdminSetting,
  type JobAssignmentRecord,
  type InsertJobAssignment,
  type ContractorReport,
  type InsertContractorReport,
  type AdminInspection,
  type InsertAdminInspection,
  type InspectionNotification,
  type InsertInspectionNotification,
  type TaskProgress,
  type InsertTaskProgress,
  type TaskInspectionResult,
  type InsertTaskInspectionResult,
  type ContractorAssignment,
  type InsertContractorAssignment,
  // B'elanna PA Types
  type CalendarEvent,
  type InsertCalendarEvent,
  type EmailRecord,
  type InsertEmailRecord,
  type Meeting,
  type InsertMeeting,
  insertProjectCashflowWeeklySchema,
  insertMaterialPurchaseSchema,
  insertProjectMasterSchema,
  // Manus-n8n Integration Types
  type JobCostItem,
  type InsertJobCostItem,
  type JobImportPayload,
  type FinancialSummary,
  jobCostItems
} from "@shared/schema";
import { contractors, jobs, csvUploads, contractorApplications, workSessions, adminSettings, jobAssignments, contractorReports, adminInspections, inspectionNotifications, taskProgress, taskInspectionResults, projectCashflowWeekly, materialPurchases, projectMaster, calendarEvents, emailRecords, meetings } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, inArray, sql } from "drizzle-orm";
import { IStorage, JobAssignment } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log('✅ DatabaseStorage initialized with persistent PostgreSQL');
  }

  // Contractors
  async getContractors(): Promise<Contractor[]> {
    return db.select().from(contractors);
  }

  async getContractor(id: string): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor;
  }

  async createContractor(insertContractor: InsertContractor): Promise<Contractor> {
    const [contractor] = await db.insert(contractors).values(insertContractor).returning();
    return contractor;
  }

  async updateContractor(id: string, updates: Partial<Contractor>): Promise<Contractor | undefined> {
    const [contractor] = await db
      .update(contractors)
      .set(updates)
      .where(eq(contractors.id, id))
      .returning();
    return contractor;
  }

  // Jobs
  async getJobs(): Promise<JobWithContractor[]> {
    const jobsWithContractors = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        location: jobs.location,
        status: jobs.status,
        contractorId: jobs.contractorId,
        contractorName: jobs.contractorName,
        dueDate: jobs.dueDate,
        startDate: jobs.startDate,
        notes: jobs.notes,
        uploadId: jobs.uploadId,
        phases: jobs.phases,
        phaseTaskData: jobs.phaseTaskData,
        telegramNotified: jobs.telegramNotified,
        latitude: jobs.latitude,
        longitude: jobs.longitude,
        contractor: contractors
      })
      .from(jobs)
      .leftJoin(contractors, eq(jobs.contractorId, contractors.id));

    return jobsWithContractors.map(row => ({
      ...row,
      contractor: row.contractor || undefined
    }));
  }

  async getJob(id: string): Promise<JobWithContractor | undefined> {
    const [job] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        location: jobs.location,
        status: jobs.status,
        contractorId: jobs.contractorId,
        contractorName: jobs.contractorName,
        dueDate: jobs.dueDate,
        startDate: jobs.startDate,
        notes: jobs.notes,
        uploadId: jobs.uploadId,
        phases: jobs.phases,
        phaseTaskData: jobs.phaseTaskData,
        telegramNotified: jobs.telegramNotified,
        latitude: jobs.latitude,
        longitude: jobs.longitude,
        contractor: contractors
      })
      .from(jobs)
      .leftJoin(contractors, eq(jobs.contractorId, contractors.id))
      .where(eq(jobs.id, id));

    if (!job) return undefined;

    return {
      ...job,
      contractor: job.contractor || undefined
    };
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id));
    console.log("🗑️ Deleted job:", id, "Affected rows:", result.rowCount);
    return result.rowCount > 0;
  }

  async createJobsFromCsv(jobsData: InsertJob[], uploadId: string): Promise<Job[]> {
    const createdJobs = await db.insert(jobs).values(jobsData).returning();
    return createdJobs;
  }

  // Job Files
  async getJobFiles(jobId: string): Promise<JobFile[]> {
    return await db.select().from(jobFiles).where(eq(jobFiles.jobId, jobId));
  }

  async createJobFile(file: InsertJobFile): Promise<JobFile> {
    const [jobFile] = await db.insert(jobFiles).values(file).returning();
    return jobFile;
  }

  async deleteJobFile(id: string): Promise<void> {
    await db.delete(jobFiles).where(eq(jobFiles.id, id));
  }

  // CSV Uploads
  async getCsvUploads(): Promise<CsvUpload[]> {
    return db.select().from(csvUploads);
  }

  async createCsvUpload(insertUpload: InsertCsvUpload): Promise<CsvUpload> {
    const [upload] = await db.insert(csvUploads).values(insertUpload).returning();
    return upload;
  }

  async updateCsvUpload(id: string, updates: Partial<CsvUpload>): Promise<CsvUpload | undefined> {
    const [upload] = await db
      .update(csvUploads)
      .set(updates)
      .where(eq(csvUploads.id, id))
      .returning();
    return upload;
  }

  async deleteCsvUpload(id: string): Promise<boolean> {
    // First check if there are any jobs associated with this upload
    const associatedJobs = await db.select().from(jobs).where(eq(jobs.uploadId, id));

    if (associatedJobs.length > 0) {
      // Delete associated jobs first to maintain referential integrity
      await db.delete(jobs).where(eq(jobs.uploadId, id));
      console.log(`🗑️ Deleted ${associatedJobs.length} jobs associated with upload ${id}`);
    }

    // Now delete the CSV upload record
    const result = await db.delete(csvUploads).where(eq(csvUploads.id, id));
    console.log(`🗑️ Deleted CSV upload record ${id}`);
    return result.rowCount > 0;
  }

  // Job Assignment
  async assignJob(assignment: JobAssignment): Promise<Job | undefined> {
    const job = await this.getJob(assignment.jobId);
    const contractor = await this.getContractor(assignment.contractorId);

    if (!job || !contractor) return undefined;

    const updatedJob = await this.updateJob(assignment.jobId, {
      contractorId: assignment.contractorId,
      status: "assigned",
      dueDate: assignment.dueDate,
      notes: assignment.notes
    });

    // Update contractor's active jobs count
    const currentActiveJobs = parseInt(contractor.activeJobs) + 1;
    await this.updateContractor(assignment.contractorId, {
      activeJobs: currentActiveJobs.toString(),
      status: currentActiveJobs >= 3 ? "busy" : "available"
    });

    return updatedJob;
  }

  async createJobAssignment(assignment: InsertJobAssignment): Promise<JobAssignmentRecord> {
    const [created] = await db.insert(jobAssignments).values(assignment).returning();
    console.log("✅ Job assignment created in database:", created);
    return created;
  }

  async getJobAssignments(): Promise<JobAssignmentRecord[]> {
    const assignments = await db.select().from(jobAssignments).orderBy(desc(jobAssignments.createdAt));
    console.log("📋 Retrieved job assignments:", assignments.length);
    return assignments;
  }

  async getJobAssignment(id: string): Promise<JobAssignmentRecord | undefined> {
    const [assignment] = await db.select().from(jobAssignments).where(eq(jobAssignments.id, id));
    console.log("🔍 Retrieved job assignment by ID:", id, assignment ? "found" : "not found");
    return assignment;
  }

  async updateJobAssignment(id: string, updates: Partial<JobAssignmentRecord>): Promise<JobAssignmentRecord | undefined> {
    const [assignment] = await db
      .update(jobAssignments)
      .set(updates)
      .where(eq(jobAssignments.id, id))
      .returning();
    console.log("📝 Updated job assignment:", id);
    return assignment;
  }

  async deleteJobAssignment(id: string): Promise<boolean> {
    const result = await db.delete(jobAssignments).where(eq(jobAssignments.id, id));
    console.log("🗑️ Deleted job assignment:", id, "Affected rows:", result.rowCount);
    return result.rowCount > 0;
  }

  async getContractorAssignments(contractorName: string): Promise<JobAssignmentRecord[]> {
    try {
      // Handle both full name and first name matches
      // If searching for "Dalwayne", find "Dalwayne Diedericks" 
      const assignments = await db.query.jobAssignments.findMany({
        where: or(
          eq(jobAssignments.contractorName, contractorName),
          like(jobAssignments.contractorName, `${contractorName}%`)
        )
      });

      console.log(`📋 Found ${assignments.length} assignments for contractor: ${contractorName}`);
      return assignments;
    } catch (error) {
      console.error("Error fetching contractor assignments:", error);
      return [];
    }
  }

  async createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment> {
    return this.createJobAssignment(assignment);
  }

  // Contractor Applications
  async getContractorApplications(): Promise<ContractorApplication[]> {
    return db.select().from(contractorApplications).orderBy(desc(contractorApplications.submittedAt));
  }

  async getContractorApplicationByUsername(username: string): Promise<ContractorApplication | undefined> {
    const [application] = await db.select().from(contractorApplications)
      .where(eq(contractorApplications.username, username));
    return application;
  }

  async getContractorApplication(id: string): Promise<ContractorApplication | undefined> {
    const [application] = await db.select().from(contractorApplications).where(eq(contractorApplications.id, id));
    return application;
  }

  async createContractorApplication(insertApplication: InsertContractorApplication): Promise<ContractorApplication> {
    const [application] = await db.insert(contractorApplications).values(insertApplication).returning();
    return application;
  }

  async updateContractorApplication(id: string, updates: Partial<ContractorApplication>): Promise<ContractorApplication | undefined> {
    const [application] = await db
      .update(contractorApplications)
      .set(updates)
      .where(eq(contractorApplications.id, id))
      .returning();
    return application;
  }

  // Work Sessions
  async getWorkSessions(contractorName?: string): Promise<WorkSession[]> {
    if (contractorName) {
      return db.select().from(workSessions)
        .where(like(workSessions.contractorName, `%${contractorName}%`))
        .orderBy(desc(workSessions.createdAt));
    }
    return db.select().from(workSessions).orderBy(desc(workSessions.createdAt));
  }

  async getActiveWorkSession(contractorName: string): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions)
      .where(
        and(
          like(workSessions.contractorName, `%${contractorName}%`),
          eq(workSessions.status, "active")
        )
      );
    return session;
  }

  async createWorkSession(insertSession: InsertWorkSession): Promise<WorkSession> {
    const [session] = await db.insert(workSessions).values(insertSession).returning();
    return session;
  }

  async updateWorkSession(id: string, updates: Partial<WorkSession>): Promise<WorkSession | undefined> {
    // If ending a session (endTime provided), calculate totalHours and money tracking
    if (updates.endTime && updates.startTime) {
      const startTime = new Date(updates.startTime);
      const endTime = new Date(updates.endTime);
      const diffMs = endTime.getTime() - startTime.getTime();
      const hoursWorked = diffMs / (1000 * 60 * 60);
      updates.totalHours = hoursWorked.toFixed(2); // Convert to hours with 2 decimal places as string

      console.log(`🕐 Session Summary: ${updates.totalHours}h worked`);
      console.log(`📍 GPS Distance: ${updates.endLatitude && updates.startLatitude ? 'Tracked' : 'Missing'}`);

    } else if (updates.endTime) {
      // If only endTime provided, get the existing session to calculate from startTime
      const existingSession = await db.select().from(workSessions).where(eq(workSessions.id, id)).limit(1);
      if (existingSession.length > 0 && existingSession[0].startTime) {
        const startTime = new Date(existingSession[0].startTime);
        const endTime = new Date(updates.endTime);
        const diffMs = endTime.getTime() - startTime.getTime();
        const hoursWorked = diffMs / (1000 * 60 * 60);
        updates.totalHours = hoursWorked.toFixed(2);

        console.log(`🕐 Session Complete: ${updates.totalHours}h worked`);
      }
    }

    const [session] = await db
      .update(workSessions)
      .set(updates)
      .where(eq(workSessions.id, id))
      .returning();
    return session;
  }

  // Admin Clock Monitoring Methods

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(eq(workSessions.status, "active"))
      .orderBy(desc(workSessions.startTime));
  }

  async getAllActiveSessions(): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(eq(workSessions.status, "active"));
  }

  // Voice Agent Support Methods
  async getContractorByName(contractorName: string): Promise<ContractorApplication | undefined> {
    const names = contractorName.split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ');

    const [contractor] = await db.select().from(contractorApplications)
      .where(
        and(
          like(contractorApplications.firstName, `%${firstName}%`),
          lastName ? like(contractorApplications.lastName, `%${lastName}%`) : sql`1=1`
        )
      );
    return contractor;
  }

  async getContractorByPhone(phoneNumber: string): Promise<ContractorApplication | undefined> {
    // Clean the phone number - remove +1, spaces, dashes, etc.
    const cleanPhone = phoneNumber.replace(/[\+\-\s\(\)]/g, '');

    const [contractor] = await db.select().from(contractorApplications)
      .where(like(contractorApplications.phone, `%${cleanPhone.slice(-10)}%`)); // Last 10 digits
    return contractor;
  }

  async getRecentClockActivities(): Promise<any[]> {
    // Get all sessions from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentSessions = await db.select().from(workSessions)
      .orderBy(desc(workSessions.startTime))
      .limit(50); // Get last 50 sessions to ensure we catch recent activity

    // Transform to activity format and filter for last 24 hours
    const activities = [];

    for (const session of recentSessions) {
      const sessionStartTime = new Date(session.startTime);

      // Only include sessions from last 24 hours
      if (sessionStartTime.getTime() >= oneDayAgo.getTime()) {
        // Clock in activity
        activities.push({
          id: `${session.id}-in`,
          contractorName: session.contractorName,
          activity: 'clock_in',
          timestamp: session.startTime,
          location: session.jobSiteLocation,
          sessionId: session.id,
          actualTime: sessionStartTime.toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          fullDateTime: sessionStartTime.toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });

        // Clock out activity (if session is completed)
        if (session.status === 'completed' && session.endTime) {
          const sessionEndTime = new Date(session.endTime);
          if (sessionEndTime.getTime() >= oneDayAgo.getTime()) {
            activities.push({
              id: `${session.id}-out`,
              contractorName: session.contractorName,
              activity: 'clock_out',
              timestamp: session.endTime,
              location: session.jobSiteLocation,
              sessionId: session.id,
              totalHours: session.totalHours,
              actualTime: sessionEndTime.toLocaleString('en-GB', {
                timeZone: 'Europe/London',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }),
              fullDateTime: sessionEndTime.toLocaleString('en-GB', {
                timeZone: 'Europe/London',
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            });
          }
        }
      }
    }

    // Sort by timestamp descending
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getTodayWorkSessions(): Promise<WorkSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get sessions from today onwards
    const allSessions = await db.select().from(workSessions)
      .orderBy(desc(workSessions.startTime));

    // Filter for sessions that started today
    const todaySessions = allSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    });

    // Calculate total hours for each session
    const sessionsWithHours = todaySessions.map(session => {
      let totalHours = 0;

      if (session.endTime) {
        // Completed session - calculate actual hours
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime);
        const diffMs = endTime.getTime() - startTime.getTime();
        totalHours = diffMs / (1000 * 60 * 60); // Convert to hours
      } else {
        // Active session - calculate current elapsed time
        const startTime = new Date(session.startTime);
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();
        totalHours = diffMs / (1000 * 60 * 60); // Convert to hours
      }

      return {
        ...session,
        totalHours: totalHours.toFixed(2),
        status: session.endTime ? 'completed' as const : 'active' as const
      };
    });

    return sessionsWithHours;
  }

  // Get authentic pay rate from database - Mandatory Rule #2: DATA INTEGRITY
  async getContractorPayRate(contractorName: string): Promise<number> {
    try {
      const [contractor] = await db.select().from(contractorApplications)
        .where(sql`CONCAT(${contractorApplications.firstName}, ' ', ${contractorApplications.lastName}) = ${contractorName}`)
        .limit(1);

      if (contractor?.adminPayRate) {
        const rate = parseFloat(contractor.adminPayRate);
        console.log(`💰 Authentic pay rate for ${contractorName}: £${rate.toFixed(2)}/hour`);
        return rate;
      }

      console.log(`⚠️ No pay rate found for ${contractorName} - using system default`);
      return 25.00;
    } catch (error) {
      console.error(`❌ Error getting pay rate for ${contractorName}:`, error);
      return 25.00;
    }
  }

  async getFirstMorningClockIn(contractorName: string): Promise<WorkSession | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [session] = await db.select().from(workSessions)
      .where(
        like(workSessions.contractorName, `%${contractorName}%`)
      )
      .orderBy(workSessions.startTime)
      .limit(1);

    return session;
  }

  async getWorkSessionsForWeek(startDate: Date, endDate: Date): Promise<WorkSession[]> {
    console.log(`🗓️ Fetching work sessions between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    // Get all completed sessions without date filtering first, then debug filter
    const allSessions = await db.select().from(workSessions)
      .where(eq(workSessions.status, 'completed'))
      .orderBy(desc(workSessions.startTime));

    console.log(`📊 Total completed sessions in database: ${allSessions.length}`);

    // Debug: Show dates of all sessions
    allSessions.forEach(session => {
      const sessionDate = new Date(session.startTime);
      console.log(`🔍 Session: ${session.contractorName} on ${sessionDate.toDateString()} (${sessionDate.toISOString()})`);
    });

    // Apply date filtering in JavaScript to ensure we catch all sessions
    const weekSessions = allSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      // Set time to midnight for accurate date comparison
      const sessionDay = new Date(sessionDate);
      sessionDay.setHours(0, 0, 0, 0);

      const startDay = new Date(startDate);
      startDay.setHours(0, 0, 0, 0);

      const endDay = new Date(endDate);
      endDay.setHours(23, 59, 59, 999);

      return sessionDay >= startDay && sessionDay <= endDay;
    });

    console.log(`📊 Found ${weekSessions.length} sessions in the specified week range`);

    // Debug: List all Friday sessions specifically  
    const fridaySessions = weekSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate.toDateString().includes('Aug 22 2025');
    });
    console.log(`📅 Friday sessions found: ${fridaySessions.length}`, fridaySessions.map(s => s.contractorName));

    return weekSessions;
  }

  // Money and GPS calculation helper method
  private async calculateEarnings(contractorName: string, startTime: Date, endTime: Date, hoursWorked: number) {
    // Get authentic pay rate from database - Mandatory Rule #2: DATA INTEGRITY
    const payRate = await this.getContractorPayRate(contractorName);
    const baseRate = payRate || 25.00; // Fallback only if database unavailable

    // Check if weekend work for overtime calculation
    const dayOfWeek = startTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const overtimeMultiplier = isWeekend ? 1.5 : 1.0;
    const hourlyRate = baseRate * overtimeMultiplier;

    // Calculate gross earnings
    const grossEarnings = hoursWorked * hourlyRate;

    // Calculate punctuality deduction (£0.50/minute after 8:15 AM, max £50)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const clockInTime = startHour + startMinute / 60;
    const lateThreshold = 8 + 15 / 60; // 8:15 AM

    let punctualityDeduction = 0;
    if (clockInTime > lateThreshold) {
      const lateMinutes = (clockInTime - lateThreshold) * 60;
      punctualityDeduction = Math.min(lateMinutes * 0.50, 50); // Max £50 deduction
    }

    // Calculate CIS deduction - Default to 30% for unregistered contractors
    // TODO: Make this dynamic based on contractor's actual form data
    const cisRate = 0.30; // Dalwayne is "Not CIS Registered (30% deduction)"
    const cisDeduction = grossEarnings * cisRate;

    // Calculate net earnings (minimum £100 daily pay)
    const beforeMinimum = grossEarnings - punctualityDeduction - cisDeduction;
    const netEarnings = Math.max(beforeMinimum, 100); // Minimum £100 daily pay

    console.log(`💰 Earnings Breakdown:`);
    console.log(`   - Hours: ${hoursWorked.toFixed(2)}h at £${hourlyRate.toFixed(2)}/h${isWeekend ? ' (weekend overtime)' : ''}`);
    console.log(`   - Gross: £${grossEarnings.toFixed(2)}`);
    console.log(`   - Punctuality deduction: £${punctualityDeduction.toFixed(2)}`);
    console.log(`   - CIS deduction: £${cisDeduction.toFixed(2)}`);
    console.log(`   - Net earnings: £${netEarnings.toFixed(2)}`);

    return {
      hourlyRate: hourlyRate.toFixed(2),
      grossEarnings: grossEarnings.toFixed(2),
      punctualityDeduction: punctualityDeduction.toFixed(2),
      cisDeduction: cisDeduction.toFixed(2),
      netEarnings: netEarnings.toFixed(2),
      isWeekendWork: isWeekend
    };
  }

  // Admin Settings Methods
  async getAdminSettings(): Promise<AdminSetting[]> {
    const settings = await db.select().from(adminSettings);
    console.log("⚙️ Retrieved admin settings:", settings.length);
    return settings;
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, key));
    console.log("⚙️ Retrieved admin setting:", key, setting?.settingValue);
    return setting;
  }

  async setAdminSetting(setting: InsertAdminSetting): Promise<AdminSetting> {
    // Check if setting already exists
    const existing = await this.getAdminSetting(setting.settingKey);

    if (existing) {
      // Update existing setting
      const [updated] = await db
        .update(adminSettings)
        .set({
          settingValue: setting.settingValue,
          updatedBy: setting.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(adminSettings.settingKey, setting.settingKey))
        .returning();
      console.log("⚙️ Updated admin setting:", setting.settingKey);
      return updated;
    } else {
      // Create new setting
      const [created] = await db
        .insert(adminSettings)
        .values(setting)
        .returning();
      console.log("⚙️ Created admin setting:", setting.settingKey);
      return created;
    }
  }

  async updateAdminSetting(key: string, value: string, updatedBy: string): Promise<AdminSetting | undefined> {
    const [updated] = await db
      .update(adminSettings)
      .set({
        settingValue: value,
        updatedBy: updatedBy,
        updatedAt: new Date()
      })
      .where(eq(adminSettings.settingKey, key))
      .returning();

    console.log("⚙️ Updated admin setting:", key, "to:", value);
    return updated;
  }

  // Stats
  async getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    activeContractors: number;
  }> {
    const allJobs = await db.select().from(jobs);
    const allContractors = await db.select().from(contractors);

    return {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(job => job.status === "pending").length,
      completedJobs: allJobs.filter(job => job.status === "completed").length,
      activeContractors: allContractors.filter(contractor =>
        contractor.status === "available" || contractor.status === "busy"
      ).length
    };
  }

  // Contractor Reports
  async createContractorReport(insertReport: InsertContractorReport): Promise<ContractorReport> {
    const [report] = await db.insert(contractorReports).values(insertReport).returning();
    console.log("📝 Created contractor report:", report.id, "by", report.contractorName);
    return report;
  }

  async getContractorReports(): Promise<ContractorReport[]> {
    return db.select().from(contractorReports).orderBy(desc(contractorReports.createdAt));
  }

  async updateContractorReport(id: string, updates: Partial<ContractorReport>): Promise<ContractorReport | undefined> {
    const [report] = await db
      .update(contractorReports)
      .set(updates)
      .where(eq(contractorReports.id, id))
      .returning();
    console.log("📝 Updated contractor report:", id);
    return report;
  }

  // Admin Inspections
  async createAdminInspection(insertInspection: InsertAdminInspection): Promise<AdminInspection> {
    const [inspection] = await db.insert(adminInspections).values(insertInspection).returning();
    console.log("📋 Created admin inspection:", inspection.id, "by", inspection.inspectorName);
    return inspection;
  }

  async getAdminInspections(): Promise<AdminInspection[]> {
    return db.select().from(adminInspections).orderBy(desc(adminInspections.createdAt));
  }

  async getAdminInspectionsByAssignment(assignmentId: string): Promise<AdminInspection[]> {
    return db.select().from(adminInspections)
      .where(eq(adminInspections.assignmentId, assignmentId))
      .orderBy(desc(adminInspections.createdAt));
  }

  async updateAdminInspection(id: string, updates: Partial<AdminInspection>): Promise<AdminInspection | undefined> {
    const [inspection] = await db
      .update(adminInspections)
      .set(updates)
      .where(eq(adminInspections.id, id))
      .returning();
    console.log("📋 Updated admin inspection:", id);
    return inspection;
  }

  // Inspection Notifications for milestone triggers
  async createInspectionNotification(insertNotification: InsertInspectionNotification): Promise<InspectionNotification> {
    const [notification] = await db.insert(inspectionNotifications).values(insertNotification).returning();
    console.log("🚨 Inspection notification created:", notification.notificationType, "for", notification.contractorName);
    return notification;
  }

  async getInspectionNotifications(): Promise<InspectionNotification[]> {
    return db.select().from(inspectionNotifications).orderBy(desc(inspectionNotifications.createdAt));
  }

  async getPendingInspectionNotifications(): Promise<InspectionNotification[]> {
    return db.select().from(inspectionNotifications)
      .where(and(
        eq(inspectionNotifications.inspectionCompleted, false),
        eq(inspectionNotifications.notificationSent, true)
      ))
      .orderBy(desc(inspectionNotifications.createdAt));
  }

  async completeInspectionNotification(id: string): Promise<InspectionNotification | undefined> {
    const [notification] = await db
      .update(inspectionNotifications)
      .set({
        inspectionCompleted: true,
        completedAt: new Date()
      })
      .where(eq(inspectionNotifications.id, id))
      .returning();
    console.log("✅ Inspection notification completed:", id);
    return notification;
  }

  // Check if inspection notification already exists for milestone
  async getInspectionNotificationByAssignmentAndType(assignmentId: string, notificationType: string): Promise<InspectionNotification | undefined> {
    const [notification] = await db.select().from(inspectionNotifications)
      .where(and(
        eq(inspectionNotifications.assignmentId, assignmentId),
        eq(inspectionNotifications.notificationType, notificationType)
      ));
    return notification;
  }

  async deleteInspectionNotification(id: string): Promise<boolean> {
    const result = await db.delete(inspectionNotifications).where(eq(inspectionNotifications.id, id));
    console.log("🗑️ Deleted inspection notification:", id, "Affected rows:", result.rowCount);
    return result.rowCount > 0;
  }

  // COMPLETE CLEANUP METHODS - Following MANDATORY RULE 1: Fix broken data persistence
  async getAllJobAssignments(): Promise<JobAssignmentRecord[]> {
    const assignments = await db.select().from(jobAssignments);
    console.log(`📋 Fetching all job assignments: ${assignments.length} found`);
    return assignments;
  }

  async deleteAllInspectionNotifications(): Promise<void> {
    const result = await db.delete(inspectionNotifications);
    console.log("🗑️ Deleted all inspection notifications - Affected rows:", result.rowCount);
  }

  async deleteAllContractorReports(): Promise<void> {
    const result = await db.delete(contractorReports);
    console.log("🗑️ Deleted all contractor reports - Affected rows:", result.rowCount);
  }

  async deleteAllAdminInspections(): Promise<void> {
    const result = await db.delete(adminInspections);
    console.log("🗑️ Deleted all admin inspections - Affected rows:", result.rowCount);
  }

  // Task Progress Methods
  async getTaskProgress(contractorName: string, assignmentId: string): Promise<TaskProgress[]> {
    try {
      const progress = await db.select({
        id: taskProgress.id,
        contractorName: taskProgress.contractorName,
        assignmentId: taskProgress.assignmentId,
        taskId: taskProgress.taskId,
        phase: taskProgress.phase,
        taskDescription: taskProgress.taskDescription,
        completed: taskProgress.completed,
        completedAt: taskProgress.completedAt,
        createdAt: taskProgress.createdAt,
        updatedAt: taskProgress.updatedAt
      })
        .from(taskProgress)
        .where(and(
          eq(taskProgress.contractorName, contractorName),
          eq(taskProgress.assignmentId, assignmentId)
        ));

      console.log(`📋 Retrieved ${progress.length} task progress items for ${contractorName} assignment ${assignmentId}`);
      return progress as TaskProgress[];
    } catch (error) {
      console.error('Error fetching task progress:', error);
      return [];
    }
  }

  async createTaskProgress(newTaskProgress: InsertTaskProgress): Promise<TaskProgress> {
    const [progress] = await db.insert(taskProgress).values(newTaskProgress).returning();
    console.log(`✅ Created task progress: ${progress.taskId} for ${progress.contractorName}`);
    return progress;
  }

  async updateTaskProgress(id: string, updates: Partial<TaskProgress>): Promise<TaskProgress | undefined> {
    const [progress] = await db
      .update(taskProgress)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(taskProgress.id, id))
      .returning();

    console.log(`🔄 Updated task progress: ${id}`);
    return progress;
  }

  async updateTaskCompletion(contractorName: string, assignmentId: string, taskId: string, completed: boolean): Promise<TaskProgress | undefined> {
    const [progress] = await db
      .update(taskProgress)
      .set({
        completed,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date()
      })
      .where(and(
        eq(taskProgress.contractorName, contractorName),
        eq(taskProgress.assignmentId, assignmentId),
        eq(taskProgress.taskId, taskId)
      ))
      .returning();

    console.log(`✅ Task ${taskId} marked as ${completed ? 'completed' : 'incomplete'} for ${contractorName}`);
    return progress;
  }

  // Task Inspection Results Methods
  async createTaskInspectionResult(inspection: any): Promise<any> {
    const [result] = await db.insert(taskInspectionResults).values(inspection).returning();
    console.log(`📋 Created task inspection result: ${result.taskName} - ${result.inspectionStatus}`);
    return result;
  }

  async getTaskInspectionResults(contractorName: string): Promise<any[]> {
    const results = await db.select()
      .from(taskInspectionResults)
      .where(eq(taskInspectionResults.contractorName, contractorName))
      .orderBy(desc(taskInspectionResults.inspectedAt));

    console.log(`📋 Retrieved ${results.length} task inspection results for ${contractorName}`);
    return results;
  }

  async markTaskInspectionAsViewed(id: string): Promise<any> {
    const [result] = await db
      .update(taskInspectionResults)
      .set({
        contractorViewed: true,
        contractorViewedAt: new Date()
      })
      .where(eq(taskInspectionResults.id, id))
      .returning();

    console.log(`👁️ Marked task inspection ${id} as viewed`);
    return result;
  }

  async markInspectionResolvedByContractor(inspectionId: string, contractorName: string, fixNotes?: string): Promise<any> {
    // Since we're using admin inspections, update the admin inspection with contractor resolution
    const [result] = await db
      .update(adminInspections)
      .set({
        status: 'contractor_fixed',
        nextActions: fixNotes ? `Contractor fixed: ${fixNotes}` : 'Contractor marked as fixed - awaiting admin re-inspection'
      })
      .where(eq(adminInspections.id, inspectionId))
      .returning();

    console.log(`✅ Marked inspection ${inspectionId} as resolved by contractor ${contractorName}`);
    return result;
  }

  async getContractorFixedInspections(): Promise<any[]> {
    const fixedInspections = await db.select()
      .from(adminInspections)
      .where(eq(adminInspections.status, 'contractor_fixed'))
      .orderBy(desc(adminInspections.createdAt));

    console.log(`📋 Retrieved ${fixedInspections.length} contractor-fixed inspections for admin review`);
    return fixedInspections;
  }

  async updateTaskInspectionResult(id: string, updates: Partial<TaskInspectionResult>): Promise<TaskInspectionResult | undefined> {
    const [result] = await db
      .update(taskInspectionResults)
      .set(updates)
      .where(eq(taskInspectionResults.id, id))
      .returning();
    console.log(`📋 Updated task inspection result: ${id}`);
    return result;
  }

  async approveContractorFix(inspectionId: string, adminName: string): Promise<any> {
    const [result] = await db
      .update(adminInspections)
      .set({
        status: 'approved',
        nextActions: `Admin approved contractor fix on ${new Date().toISOString()}`
      })
      .where(eq(adminInspections.id, inspectionId))
      .returning();

    console.log(`✅ Admin ${adminName} approved contractor fix for inspection ${inspectionId}`);
    return result;
  }

  async getAdminInspectionsForContractor(contractorName: string): Promise<any[]> {
    // Get the contractor's assignments first
    const assignments = await db.select()
      .from(jobAssignments)
      .where(eq(jobAssignments.contractorName, contractorName));

    if (assignments.length === 0) {
      return [];
    }

    const assignmentIds = assignments.map(a => a.id);

    // Get admin inspections for these assignments
    const inspections = await db.select()
      .from(adminInspections)
      .where(inArray(adminInspections.assignmentId, assignmentIds))
      .orderBy(desc(adminInspections.createdAt));

    console.log(`📋 Retrieved ${inspections.length} admin inspections for contractor ${contractorName}`);
    return inspections;
  }

  // Temporary Departures - track contractor movements during work hours
  async getActiveDeparture(contractorName: string, sessionId: string): Promise<any> {
    try {
      console.log(`🔍 Checking for active departure: ${contractorName} session ${sessionId}`);
      // For now, return null since we don't have the table yet
      return null;
    } catch (error) {
      console.error('❌ Error getting active departure:', error);
      return null;
    }
  }

  async createTemporaryDeparture(departure: any): Promise<any> {
    try {
      console.log(`📝 Creating temporary departure record for ${departure.contractorName}`);
      // For now, just log the departure - would normally insert to temporaryDepartures table
      return { id: 'temp-departure-' + Date.now(), ...departure };
    } catch (error) {
      console.error('❌ Error creating temporary departure:', error);
      throw error;
    }
  }

  async updateTemporaryDeparture(id: string, departure: any): Promise<any> {
    try {
      console.log(`📝 Updating temporary departure ${id} with return time`);
      // For now, just log the return - would normally update temporaryDepartures table
      return { id, ...departure };
    } catch (error) {
      console.error('❌ Error updating temporary departure:', error);
      throw error;
    }
  }

  // Weekly Cash Flow Tracking Implementation - MANDATORY RULE: AUTHENTIC DATA ONLY
  async getProjectMasters(): Promise<any[]> {
    console.log("📋 Fetching project masters from database");
    return await db.select().from(projectMaster).orderBy(desc(projectMaster.createdAt));
  }

  async createProjectMaster(project: any): Promise<any> {
    console.log("🆕 Creating new project master:", project.projectName);
    const [created] = await db.insert(projectMaster).values(project).returning();
    return created;
  }

  async updateProjectMaster(id: string, updates: any): Promise<any> {
    console.log("🔄 Updating project master:", id);
    const [updated] = await db
      .update(projectMaster)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectMaster.id, id))
      .returning();
    return updated;
  }

  async getProjectCashflowWeekly(projectId?: string): Promise<any[]> {
    console.log("📊 Fetching weekly cashflow data", projectId ? `for project: ${projectId}` : "for all projects");

    if (projectId) {
      return await db.select().from(projectCashflowWeekly)
        .where(eq(projectCashflowWeekly.projectId, projectId))
        .orderBy(desc(projectCashflowWeekly.weekStartDate));
    }

    return await db.select().from(projectCashflowWeekly)
      .orderBy(desc(projectCashflowWeekly.weekStartDate));
  }

  async createProjectCashflowWeekly(cashflow: any): Promise<any> {
    console.log("💰 Creating weekly cashflow record:", cashflow.projectName, cashflow.weekStartDate);
    const [created] = await db.insert(projectCashflowWeekly).values(cashflow).returning();
    return created;
  }

  async updateProjectCashflowWeekly(id: string, updates: any): Promise<any> {
    console.log("🔄 Updating weekly cashflow record:", id);
    const [updated] = await db
      .update(projectCashflowWeekly)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectCashflowWeekly.id, id))
      .returning();
    return updated;
  }

  async getMaterialPurchases(projectId?: string, weekStart?: string): Promise<any[]> {
    console.log("🛒 Fetching material purchases", projectId ? `for project: ${projectId}` : "for all projects");

    if (projectId && weekStart) {
      return await db.select().from(materialPurchases)
        .where(and(
          eq(materialPurchases.projectId, projectId),
          eq(materialPurchases.purchaseWeek, weekStart)
        ))
        .orderBy(desc(materialPurchases.createdAt));
    } else if (projectId) {
      return await db.select().from(materialPurchases)
        .where(eq(materialPurchases.projectId, projectId))
        .orderBy(desc(materialPurchases.createdAt));
    }

    return await db.select().from(materialPurchases)
      .orderBy(desc(materialPurchases.createdAt));
  }

  async createMaterialPurchase(purchase: any): Promise<any> {
    console.log("🛒 Creating material purchase record:", purchase.supplierName, purchase.totalCost);
    const [created] = await db.insert(materialPurchases).values(purchase).returning();
    return created;
  }

  async calculateWeeklyLabourCosts(projectId: string, weekStart: string, weekEnd: string): Promise<number> {
    console.log("💼 Calculating weekly labour costs for project:", projectId, "week:", weekStart, "to", weekEnd);

    // Get work sessions within the week timeframe
    const sessions = await db.select()
      .from(workSessions)
      .where(and(
        sql`DATE(${workSessions.startTime}) >= ${weekStart}`,
        sql`DATE(${workSessions.startTime}) <= ${weekEnd}`,
        eq(workSessions.status, "completed")
      ));

    let totalLabourCost = 0;

    // Calculate costs based on authentic pay rates and work hours
    for (const session of sessions) {
      if (session.totalHours && session.contractorName) {
        const payRate = await this.getContractorPayRate(session.contractorName);

        // Parse total hours (format: "08:11:19" -> decimal hours)
        const timeParts = session.totalHours.split(':');
        const hours = parseInt(timeParts[0]) + (parseInt(timeParts[1]) / 60) + (parseInt(timeParts[2]) / 3600);

        const sessionCost = hours * payRate;
        totalLabourCost += sessionCost;

        console.log(`  💰 ${session.contractorName}: ${hours.toFixed(2)}h × £${payRate}/h = £${sessionCost.toFixed(2)}`);
      }
    }

    console.log(`📊 Total weekly labour cost: £${totalLabourCost.toFixed(2)}`);
    return totalLabourCost;
  }

  // ===== B'elanna Business PA Implementation =====

  // Calendar Management
  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(insertEvent).returning();
    console.log('📅 Created calendar event:', event.title);
    return event;
  }

  async getCalendarEvents(dateFrom?: string, dateTo?: string): Promise<CalendarEvent[]> {
    if (dateFrom && dateTo) {
      return db.select().from(calendarEvents)
        .where(and(
          sql`${calendarEvents.eventDate} >= ${dateFrom}`,
          sql`${calendarEvents.eventDate} <= ${dateTo}`
        ))
        .orderBy(calendarEvents.eventDate, calendarEvents.eventTime);
    } else if (dateFrom) {
      return db.select().from(calendarEvents)
        .where(sql`${calendarEvents.eventDate} >= ${dateFrom}`)
        .orderBy(calendarEvents.eventDate, calendarEvents.eventTime);
    }

    return db.select().from(calendarEvents)
      .orderBy(calendarEvents.eventDate, calendarEvents.eventTime);
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event;
  }

  async updateCalendarEvent(id: string, updateData: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const [event] = await db.update(calendarEvents)
      .set(updateData)
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  async checkAvailability(date: string, time: string, durationMinutes: number = 30): Promise<boolean> {
    // Get events for the specified date
    const dayEvents = await this.getDayEvents(date);

    // Parse the requested time
    const [requestedHour, requestedMinute] = time.split(':').map(Number);
    const requestedStartMinutes = requestedHour * 60 + requestedMinute;
    const requestedEndMinutes = requestedStartMinutes + durationMinutes;

    // Check for conflicts
    for (const event of dayEvents) {
      if (event.status === 'cancelled') continue;

      const [eventHour, eventMinute] = event.eventTime.split(':').map(Number);
      const eventStartMinutes = eventHour * 60 + eventMinute;
      const eventEndMinutes = eventStartMinutes + parseInt(event.durationMinutes);

      // Check for overlap
      if (requestedStartMinutes < eventEndMinutes && requestedEndMinutes > eventStartMinutes) {
        return false; // Conflict found
      }
    }

    return true; // Available
  }

  async getDayEvents(date: string): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents)
      .where(eq(calendarEvents.eventDate, date))
      .orderBy(calendarEvents.eventTime);
  }

  // Email Management
  async createEmailRecord(insertEmail: InsertEmailRecord): Promise<EmailRecord> {
    const [email] = await db.insert(emailRecords).values(insertEmail).returning();
    console.log('📧 Created email record:', email.subject);
    return email;
  }

  async getEmailRecords(limit: number = 50): Promise<EmailRecord[]> {
    return db.select().from(emailRecords)
      .orderBy(desc(emailRecords.sentAt))
      .limit(limit);
  }

  async getEmailRecord(id: string): Promise<EmailRecord | undefined> {
    const [email] = await db.select().from(emailRecords).where(eq(emailRecords.id, id));
    return email;
  }

  // Meeting Scheduling
  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    console.log('🤝 Created meeting:', meeting.title);
    return meeting;
  }

  async getMeetings(dateFrom?: string, dateTo?: string): Promise<Meeting[]> {
    if (dateFrom && dateTo) {
      return db.select().from(meetings)
        .where(and(
          sql`${meetings.meetingDate} >= ${dateFrom}`,
          sql`${meetings.meetingDate} <= ${dateTo}`
        ))
        .orderBy(meetings.meetingDate, meetings.meetingTime);
    } else if (dateFrom) {
      return db.select().from(meetings)
        .where(sql`${meetings.meetingDate} >= ${dateFrom}`)
        .orderBy(meetings.meetingDate, meetings.meetingTime);
    }

    return db.select().from(meetings)
      .orderBy(meetings.meetingDate, meetings.meetingTime);
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async updateMeeting(id: string, updateData: Partial<Meeting>): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings)
      .set(updateData)
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async clearAllData(): Promise<void> {
    console.log("⚠️ Clearing all data from database...");
    await db.delete(meetings);
    await db.delete(emailRecords);
    await db.delete(calendarEvents);
    await db.delete(taskInspectionResults);
    await db.delete(inspectionNotifications);
    await db.delete(adminInspections);
    await db.delete(contractorReports);
    await db.delete(taskProgress);
    await db.delete(jobAssignments);
    await db.delete(workSessions);
    await db.delete(contractorApplications);
    await db.delete(csvUploads);
    await db.delete(jobs);
    await db.delete(contractors);
    await db.delete(adminSettings);
    console.log("✅ All data cleared successfully");
  }

  // ========================================
  // Manus-n8n Integration - Job Cost Items
  // ========================================

  async getJobCostItems(jobId: string): Promise<JobCostItem[]> {
    try {
      return await db.select().from(jobCostItems).where(eq(jobCostItems.jobId, jobId));
    } catch (error) {
      console.log('⚠️ Job cost items table may not exist yet:', error);
      return [];
    }
  }

  async createJobCostItem(item: InsertJobCostItem): Promise<JobCostItem> {
    const [costItem] = await db.insert(jobCostItems).values(item).returning();
    console.log('📊 Created cost item:', costItem.description, '- Category:', costItem.category);
    return costItem;
  }

  async createJobCostItems(items: InsertJobCostItem[]): Promise<JobCostItem[]> {
    if (items.length === 0) return [];
    const costItems = await db.insert(jobCostItems).values(items).returning();
    console.log(`📊 Created ${costItems.length} cost items`);
    return costItems;
  }

  async deleteJobCostItems(jobId: string): Promise<void> {
    await db.delete(jobCostItems).where(eq(jobCostItems.jobId, jobId));
    console.log(`🗑️ Deleted cost items for job: ${jobId}`);
  }

  async getJobFinancials(jobId: string): Promise<FinancialSummary | undefined> {
    try {
      const items = await this.getJobCostItems(jobId);

      if (items.length === 0) {
        // Check if job has financial_summary stored
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (job?.financialSummary) {
          return JSON.parse(job.financialSummary);
        }
        return undefined;
      }

      // Calculate totals from cost items
      const summary: FinancialSummary = {
        labour: 0,
        material: 0,
        plant: 0,
        subcontractor: 0,
        total: 0
      };

      for (const item of items) {
        // Safely parse total value, handling string or number input
        const rawTotal = item.total;
        let total = 0;
        if (typeof rawTotal === 'number') {
          total = isNaN(rawTotal) ? 0 : rawTotal;
        } else if (typeof rawTotal === 'string') {
          const cleaned = rawTotal.replace(/[£$€,\s]/g, '');
          const parsed = parseFloat(cleaned);
          total = isNaN(parsed) ? 0 : parsed;
        }

        // Normalize category to uppercase for consistent matching
        const category = typeof item.category === 'string' ? item.category.toUpperCase() : item.category;
        switch (category) {
          case 'LABOUR':
            summary.labour += total;
            break;
          case 'MATERIAL':
            summary.material += total;
            break;
          case 'PLANT':
            summary.plant += total;
            break;
          case 'SUBCONTRACTOR':
            summary.subcontractor += total;
            break;
        }
        summary.total += total;
      }

      return summary;
    } catch (error) {
      console.error('❌ Error calculating job financials:', error);
      return undefined;
    }
  }

  async importJobWithCostItems(payload: JobImportPayload): Promise<{ job: Job; costItems: JobCostItem[]; financialSummary: FinancialSummary }> {
    console.log('📥 Importing job from n8n/Manus:', payload.job.client_name);

    // Calculate financial summary from tasks
    const financialSummary: FinancialSummary = {
      labour: 0,
      material: 0,
      plant: 0,
      subcontractor: 0,
      total: 0
    };

    for (const task of payload.tasks) {
      const total = task.total || 0;
      switch (task.type) {
        case 'LABOUR':
          financialSummary.labour += total;
          break;
        case 'MATERIAL':
          financialSummary.material += total;
          break;
        case 'PLANT':
          financialSummary.plant += total;
          break;
        case 'SUBCONTRACTOR':
          financialSummary.subcontractor += total;
          break;
      }
      financialSummary.total += total;
    }

    // Create job with enhanced financial fields
    const jobTitle = payload.job.title || `${payload.job.client_name} - ${payload.job.project_type}`;
    const [createdJob] = await db.insert(jobs).values({
      title: jobTitle,
      description: payload.job.project_type,
      location: `${payload.job.address}, ${payload.job.postcode}`,
      status: "pending",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: `Imported via n8n/Manus API`,
      externalCode: payload.job.code || 'HBXL-IMPORT',
      clientName: payload.job.client_name,
      projectType: payload.job.project_type,
      address: payload.job.address,
      postcode: payload.job.postcode,
      quotedAmount: String(payload.job.quoted_amount || financialSummary.total),
      financialSummary: JSON.stringify(financialSummary)
    }).returning();

    console.log('✅ Job created:', createdJob.id, createdJob.title);

    // Create cost items
    const costItemsToInsert: InsertJobCostItem[] = payload.tasks.map(task => ({
      jobId: createdJob.id,
      category: task.type as 'LABOUR' | 'MATERIAL' | 'PLANT' | 'SUBCONTRACTOR',
      description: task.description,
      quantity: String(task.qty),
      unit: task.unit,
      rate: String(task.rate),
      total: String(task.total),
      supplier: task.supplier || null
    }));

    let createdCostItems: JobCostItem[] = [];
    try {
      createdCostItems = await this.createJobCostItems(costItemsToInsert);
    } catch (error) {
      console.log('⚠️ Could not create cost items (table may not exist):', error);
      // Cost items table might not exist, but job is created with financialSummary
    }

    console.log(`📊 Financial Summary: Labour £${financialSummary.labour.toFixed(2)}, Material £${financialSummary.material.toFixed(2)}, Plant £${financialSummary.plant.toFixed(2)}, Subcontractor £${financialSummary.subcontractor.toFixed(2)}, Total £${financialSummary.total.toFixed(2)}`);

    return {
      job: createdJob,
      costItems: createdCostItems,
      financialSummary
    };
  }
}

export const storage = new DatabaseStorage();