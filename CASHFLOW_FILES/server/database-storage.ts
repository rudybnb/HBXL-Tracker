import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { 
  jobs, contractors, workSessions, csvUploads, adminSettings,
  type Job, type Contractor, type WorkSession 
} from '../shared/schema.js';

export class DatabaseStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
    console.log('✅ Cash Flow DatabaseStorage initialized with PostgreSQL');
  }

  // CONTRACTOR OPERATIONS
  async getContractors() {
    return await this.db.select().from(contractors).orderBy(contractors.name);
  }

  async getContractor(id: string) {
    const result = await this.db.select().from(contractors).where(eq(contractors.id, id));
    return result[0] || null;
  }

  async getContractorByName(name: string) {
    const result = await this.db.select().from(contractors).where(eq(contractors.name, name));
    return result[0] || null;
  }

  // JOB OPERATIONS
  async getJobs() {
    return await this.db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string) {
    const result = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return result[0] || null;
  }

  async getActiveJobs() {
    return await this.db.select().from(jobs).where(eq(jobs.status, 'active'));
  }

  // WORK SESSION OPERATIONS
  async getWorkSessions(contractorName?: string, startDate?: Date, endDate?: Date) {
    let query = this.db.select().from(workSessions);
    
    const conditions = [];
    if (contractorName) {
      conditions.push(eq(workSessions.contractorName, contractorName));
    }
    if (startDate) {
      conditions.push(gte(workSessions.startTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(workSessions.startTime, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(workSessions.startTime));
  }

  async getWeeklyWorkSessions(weekStart: Date, weekEnd: Date) {
    return await this.db
      .select()
      .from(workSessions)
      .where(
        and(
          gte(workSessions.startTime, weekStart),
          lte(workSessions.startTime, weekEnd)
        )
      )
      .orderBy(workSessions.contractorName, workSessions.startTime);
  }

  // CASH FLOW SPECIFIC OPERATIONS
  async getContractorEarnings(contractorName: string, startDate: Date, endDate: Date) {
    const sessions = await this.getWorkSessions(contractorName, startDate, endDate);
    const contractor = await this.getContractorByName(contractorName);
    
    if (!contractor) {
      return { sessions: [], totalHours: 0, totalEarnings: 0, hourlyRate: 0 };
    }

    const hourlyRate = parseFloat(contractor.payRate);
    let totalHours = 0;
    
    for (const session of sessions) {
      if (session.endTime) {
        const hours = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }

    return {
      sessions,
      totalHours,
      totalEarnings: totalHours * hourlyRate,
      hourlyRate
    };
  }

  async getProjectCashFlow(jobId: string, startDate?: Date, endDate?: Date) {
    const job = await this.getJob(jobId);
    if (!job) return null;

    // Get all work sessions for this job
    let query = this.db.select().from(workSessions).where(eq(workSessions.jobId, jobId));
    
    if (startDate && endDate) {
      query = query.where(
        and(
          eq(workSessions.jobId, jobId),
          gte(workSessions.startTime, startDate),
          lte(workSessions.startTime, endDate)
        )
      );
    }

    const sessions = await query.orderBy(workSessions.startTime);
    
    // Calculate labour costs by contractor
    const contractorCosts: Record<string, { hours: number; cost: number; rate: number }> = {};
    
    for (const session of sessions) {
      if (!session.endTime) continue;
      
      const contractor = await this.getContractorByName(session.contractorName);
      if (!contractor) continue;
      
      const hours = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
      const rate = parseFloat(contractor.payRate);
      const cost = hours * rate;
      
      if (!contractorCosts[session.contractorName]) {
        contractorCosts[session.contractorName] = { hours: 0, cost: 0, rate };
      }
      
      contractorCosts[session.contractorName].hours += hours;
      contractorCosts[session.contractorName].cost += cost;
    }

    const totalLabourCost = Object.values(contractorCosts).reduce((sum, c) => sum + c.cost, 0);
    const totalHours = Object.values(contractorCosts).reduce((sum, c) => sum + c.hours, 0);

    return {
      job,
      sessions,
      contractorCosts,
      totalLabourCost,
      totalHours,
      // TODO: Add material costs from CSV data
      materialCosts: 0,
      totalProjectCost: totalLabourCost
    };
  }

  // ADMIN SETTINGS
  async getAdminSetting(key: string) {
    const result = await this.db.select().from(adminSettings).where(eq(adminSettings.key, key));
    return result[0] || null;
  }
}