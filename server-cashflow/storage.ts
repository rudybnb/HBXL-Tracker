import type { 
  Contractor, InsertContractor, 
  Job, InsertJob, JobWithContractor,
  CsvUpload, InsertCsvUpload,
  ContractorApplication, InsertContractorApplication,
  WorkSession, InsertWorkSession,
  AdminSetting, InsertAdminSetting,
  ContractorReport, InsertContractorReport,
  AdminInspection, InsertAdminInspection,
  TaskInspectionResult, InsertTaskInspectionResult,
  ContractorAssignment, InsertContractorAssignment
} from "@shared/schema";

export interface JobAssignment {
  jobId: string;
  contractorId: string;
  dueDate?: Date;
  notes?: string;
}

export interface IStorage {
  // Contractors
  getContractors(): Promise<Contractor[]>;
  getContractor(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, contractor: Partial<Contractor>): Promise<Contractor | undefined>;
  
  // Jobs
  getJobs(): Promise<JobWithContractor[]>;
  getJob(id: string): Promise<JobWithContractor | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job | undefined>;
  createJobsFromCsv(jobs: InsertJob[], uploadId: string): Promise<Job[]>;
  
  // CSV Uploads
  getCsvUploads(): Promise<CsvUpload[]>;
  createCsvUpload(upload: InsertCsvUpload): Promise<CsvUpload>;
  updateCsvUpload(id: string, upload: Partial<CsvUpload>): Promise<CsvUpload | undefined>;
  deleteCsvUpload(id: string): Promise<void>;
  
  // Job Assignment
  assignJob(assignment: JobAssignment): Promise<Job | undefined>;
  
  // Contractor Applications
  getContractorApplications(): Promise<ContractorApplication[]>;
  getContractorApplication(id: string): Promise<ContractorApplication | undefined>;
  createContractorApplication(application: InsertContractorApplication): Promise<ContractorApplication>;
  updateContractorApplication(id: string, application: Partial<ContractorApplication>): Promise<ContractorApplication | undefined>;
  
  // Work Sessions
  getWorkSessions(contractorName?: string): Promise<WorkSession[]>;
  getActiveWorkSession(contractorName: string): Promise<WorkSession | undefined>;
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  updateWorkSession(id: string, session: Partial<WorkSession>): Promise<WorkSession | undefined>;
  getAllActiveSessions(): Promise<WorkSession[]>;
  
  // Admin Settings
  getAdminSetting(key: string): Promise<AdminSetting | undefined>;
  setAdminSetting(setting: InsertAdminSetting): Promise<AdminSetting>;
  
  // Reports
  getContractorReports(): Promise<ContractorReport[]>;
  createContractorReport(report: InsertContractorReport): Promise<ContractorReport>;
  updateContractorReport(id: string, report: Partial<ContractorReport>): Promise<ContractorReport | undefined>;
  
  // Admin Inspections
  getAdminInspections(): Promise<AdminInspection[]>;
  createAdminInspection(inspection: InsertAdminInspection): Promise<AdminInspection>;
  updateAdminInspection(id: string, inspection: Partial<AdminInspection>): Promise<AdminInspection | undefined>;
  
  // Task Inspection Results
  getTaskInspectionResults(contractorName?: string): Promise<TaskInspectionResult[]>;
  createTaskInspectionResult(result: InsertTaskInspectionResult): Promise<TaskInspectionResult>;
  updateTaskInspectionResult(id: string, result: Partial<TaskInspectionResult>): Promise<TaskInspectionResult | undefined>;
  
  // Temporary Departures
  getActiveDeparture(contractorName: string, sessionId: string): Promise<any>;
  createTemporaryDeparture(departure: any): Promise<any>;
  updateTemporaryDeparture(id: string, departure: any): Promise<any>;
  
  // Contractor Assignments
  getContractorAssignments(contractorName?: string): Promise<ContractorAssignment[]>;
  createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment>;
  
  // Stats
  getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    activeContractors: number;
  }>;
  
  // Cleanup
  clearAllData(): Promise<void>;
}

// Use the actual database storage implementation
import { DatabaseStorage } from './database-storage';

export { DatabaseStorage } from './database-storage';
export const storage = new DatabaseStorage();