import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobStatusEnum = pgEnum("job_status", ["pending", "assigned", "completed"]);
export const contractorStatusEnum = pgEnum("contractor_status", ["available", "busy", "unavailable"]);
export const uploadStatusEnum = pgEnum("upload_status", ["processing", "processed", "failed"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled", "temporarily_away"]);

export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  specialty: text("specialty").notNull(),
  status: contractorStatusEnum("status").notNull().default("available"),
  rating: text("rating").notNull().default("0"),
  activeJobs: text("active_jobs").notNull().default("0"),
  completedJobs: text("completed_jobs").notNull().default("0"),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  contractorId: varchar("contractor_id").references(() => contractors.id),
  contractorName: text("contractor_name"),
  dueDate: text("due_date").notNull(),
  startDate: text("start_date"),
  notes: text("notes"),
  uploadId: varchar("upload_id").references(() => csvUploads.id),
  phases: text("phases"), // JSON string of selected phases
  phaseTaskData: text("phase_task_data"), // JSON string of detailed task data from CSV
  telegramNotified: text("telegram_notified").default("false"),
  latitude: text("latitude"), // GPS latitude for work site
  longitude: text("longitude"), // GPS longitude for work site
  // Cash flow specific fields
  estimatedBudget: decimal("estimated_budget", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default("0.00"),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("0.00"),
  clientPaymentStatus: text("client_payment_status").default("pending"), // pending, partial, paid
  clientPaymentAmount: decimal("client_payment_amount", { precision: 10, scale: 2 }).default("0.00"),
});

export const csvUploads = pgTable("csv_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  status: uploadStatusEnum("status").notNull().default("processing"),
  jobsCount: text("jobs_count").notNull().default("0"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const contractorApplications = pgTable("contractor_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Personal Information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  telegramId: text("telegram_id"),
  fullAddress: text("full_address").notNull(),
  city: text("city").notNull(),
  postcode: text("postcode").notNull(),
  
  // Right to Work & Documentation
  hasRightToWork: text("has_right_to_work").notNull().default("false"),
  passportNumber: text("passport_number").notNull(),
  passportPhotoUploaded: text("passport_photo_uploaded").notNull().default("false"),
  hasPublicLiability: text("has_public_liability").notNull().default("false"),
  
  // CIS & Tax Information
  cisStatus: text("cis_status").notNull(),
  utrNumberDetails: text("utr_number_details").notNull(),
  isCisRegistered: text("is_cis_registered").notNull().default("false"),
  hasValidCscs: text("has_valid_cscs").notNull().default("false"),
  
  // Banking Details
  bankName: text("bank_name").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  sortCode: text("sort_code").notNull(),
  accountNumber: text("account_number").notNull(),
  
  // Emergency Contact
  emergencyName: text("emergency_name").notNull(),
  emergencyPhone: text("emergency_phone").notNull(),
  relationship: text("relationship").notNull(),
  
  // Trade & Tools
  primaryTrade: text("primary_trade").notNull(),
  yearsExperience: text("years_experience").notNull(),
  hasOwnTools: text("has_own_tools").notNull().default("false"),
  toolsList: text("tools_list"),
  
  // Admin-only fields
  adminCisVerification: text("admin_cis_verification"), // Admin fills CIS verification details
  adminPayRate: text("admin_pay_rate"), // Admin sets pay rate
  adminNotes: text("admin_notes"), // Admin internal notes
  
  // Login credentials (set by admin when approving contractor)
  username: text("username"), // Unique login username
  password: text("password"), // Hashed password
  
  // Metadata
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const workSessions = pgTable("work_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  jobSiteLocation: text("job_site_location").notNull(), // e.g., "ME5 9GX"
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  totalHours: text("total_hours"), // e.g., "08:11:19"
  startLatitude: text("start_latitude"),
  startLongitude: text("start_longitude"),
  endLatitude: text("end_latitude"), 
  endLongitude: text("end_longitude"),
  status: sessionStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  // Cash flow specific fields
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }),
  cisDeduction: decimal("cis_deduction", { precision: 10, scale: 2 }),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }),
  jobId: varchar("job_id").references(() => jobs.id),
});

// Temporary departure tracking for contractors during work hours
export const temporaryDepartures = pgTable("temporary_departures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  workSessionId: varchar("work_session_id").references(() => workSessions.id),
  departureTime: timestamp("departure_time").notNull(),
  returnTime: timestamp("return_time"),
  reason: text("reason"),
  distanceFromSite: text("distance_from_site"), // Distance in meters
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NEW CASH FLOW TABLES

// Project Cash Flow Tracking
export const projectCashFlow = pgTable("project_cash_flow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  weekEnding: text("week_ending").notNull(), // Format: "2025-08-15"
  
  // Income
  clientPayments: decimal("client_payments", { precision: 12, scale: 2 }).default("0.00"),
  retentionReleased: decimal("retention_released", { precision: 12, scale: 2 }).default("0.00"),
  variationOrders: decimal("variation_orders", { precision: 12, scale: 2 }).default("0.00"),
  
  // Expenses
  laborCosts: decimal("labor_costs", { precision: 12, scale: 2 }).default("0.00"),
  materialCosts: decimal("material_costs", { precision: 12, scale: 2 }).default("0.00"),
  equipmentCosts: decimal("equipment_costs", { precision: 12, scale: 2 }).default("0.00"),
  subcontractorCosts: decimal("subcontractor_costs", { precision: 12, scale: 2 }).default("0.00"),
  overheadCosts: decimal("overhead_costs", { precision: 12, scale: 2 }).default("0.00"),
  
  // Calculated fields
  totalIncome: decimal("total_income", { precision: 12, scale: 2 }).default("0.00"),
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).default("0.00"),
  netCashFlow: decimal("net_cash_flow", { precision: 12, scale: 2 }).default("0.00"),
  cumulativeCashFlow: decimal("cumulative_cash_flow", { precision: 12, scale: 2 }).default("0.00"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly Cash Flow Forecasts
export const cashFlowForecasts = pgTable("cash_flow_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  forecastWeek: text("forecast_week").notNull(), // Format: "2025-08-22"
  
  // Forecasted Income
  expectedClientPayments: decimal("expected_client_payments", { precision: 12, scale: 2 }).default("0.00"),
  expectedRetention: decimal("expected_retention", { precision: 12, scale: 2 }).default("0.00"),
  
  // Forecasted Expenses
  projectedLaborCosts: decimal("projected_labor_costs", { precision: 12, scale: 2 }).default("0.00"),
  projectedMaterialCosts: decimal("projected_material_costs", { precision: 12, scale: 2 }).default("0.00"),
  projectedEquipmentCosts: decimal("projected_equipment_costs", { precision: 12, scale: 2 }).default("0.00"),
  
  // Calculated projections
  forecastedNetFlow: decimal("forecasted_net_flow", { precision: 12, scale: 2 }).default("0.00"),
  projectedCumulative: decimal("projected_cumulative", { precision: 12, scale: 2 }).default("0.00"),
  
  confidenceLevel: text("confidence_level").default("medium"), // low, medium, high
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cash Flow Alerts and Notifications
export const cashFlowAlerts = pgTable("cash_flow_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  alertType: text("alert_type").notNull(), // negative_flow, payment_overdue, budget_exceeded
  severity: text("severity").notNull(), // low, medium, high, critical
  message: text("message").notNull(),
  threshold: decimal("threshold", { precision: 12, scale: 2 }),
  currentValue: decimal("current_value", { precision: 12, scale: 2 }),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Material and Equipment Cost Tracking
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  expenseType: text("expense_type").notNull(), // material, equipment, subcontractor, overhead
  category: text("category").notNull(), // cement, steel, rental, transport, etc.
  description: text("description").notNull(),
  supplier: text("supplier"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  invoiceNumber: text("invoice_number"),
  dateIncurred: timestamp("date_incurred").notNull(),
  paymentStatus: text("payment_status").default("pending"), // pending, paid, overdue
  paymentDate: timestamp("payment_date"),
  approvedBy: text("approved_by"),
  receiptUploaded: boolean("receipt_uploaded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Payment Tracking
export const clientPayments = pgTable("client_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  paymentType: text("payment_type").notNull(), // interim, final, retention, variation
  invoiceNumber: text("invoice_number").notNull(),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }).notNull(),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).default("0.00"),
  retentionAmount: decimal("retention_amount", { precision: 12, scale: 2 }).default("0.00"),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paymentDate: timestamp("payment_date"),
  paymentStatus: text("payment_status").default("pending"), // pending, partial, paid, overdue
  daysPastDue: text("days_past_due").default("0"),
  clientNotes: text("client_notes"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Additional tables for enhanced functionality...

// Job Assignments with enhanced cash flow tracking
export const jobAssignments = pgTable("job_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id).notNull(),
  contractorName: text("contractor_name").notNull(),
  assignedDate: timestamp("assigned_date").defaultNow(),
  status: text("status").default("active"), // active, completed, paused
  estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 6, scale: 2 }).default("0.00"),
  budgetedCost: decimal("budgeted_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
});

// Contractor Reports (existing functionality)
export const contractorReports = pgTable("contractor_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  jobLocation: text("job_location").notNull(),
  taskDescription: text("task_description").notNull(),
  workDate: text("work_date").notNull(),
  hoursWorked: text("hours_worked").notNull(),
  materialsUsed: text("materials_used"),
  progressNotes: text("progress_notes"),
  issuesEncountered: text("issues_encountered"),
  nextDayPlan: text("next_day_plan"),
  weatherConditions: text("weather_conditions"),
  photoUrls: text("photo_urls"), // JSON array of photo URLs
  safetyNotes: text("safety_notes"),
  qualityRating: text("quality_rating"), // 1-5 scale
  submittedAt: timestamp("submitted_at").defaultNow(),
  status: text("status").default("submitted"), // submitted, reviewed, approved
});

// Admin Inspections (existing functionality)
export const adminInspections = pgTable("admin_inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  contractorName: text("contractor_name").notNull(),
  inspectionDate: text("inspection_date").notNull(),
  progressPercentage: text("progress_percentage").notNull(),
  qualityRating: text("quality_rating").notNull(), // 1-5 scale
  workmanshipNotes: text("workmanship_notes"),
  materialsQuality: text("materials_quality"), // excellent, good, fair, poor
  safetyCompliance: text("safety_compliance"), // compliant, minor_issues, major_issues
  issuesIdentified: text("issues_identified"),
  correctiveActions: text("corrective_actions"),
  nextInspectionDate: text("next_inspection_date"),
  overallSatisfaction: text("overall_satisfaction"), // very_satisfied, satisfied, neutral, dissatisfied
  additionalNotes: text("additional_notes"),
  photoUrls: text("photo_urls"), // JSON array of photo URLs
  weatherConditions: text("weather_conditions"),
  adminName: text("admin_name").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  contractorNotified: text("contractor_notified").default("false"),
  status: text("status").default("pending"), // pending, acknowledged, resolved
});

// Task Inspection Results (existing functionality)
export const taskInspectionResults = pgTable("task_inspection_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  contractorName: text("contractor_name").notNull(),
  taskName: text("task_name").notNull(),
  inspectionDate: text("inspection_date").notNull(),
  status: text("status").notNull(), // passed, failed, requires_rework
  qualityScore: text("quality_score"), // 1-10 scale
  notes: text("notes"),
  issuesFound: text("issues_found"), // JSON array of issues
  photoUrls: text("photo_urls"), // JSON array of photo URLs
  adminName: text("admin_name").notNull(),
  reworkRequired: text("rework_required").default("false"),
  reworkNotes: text("rework_notes"),
  reworkCompleted: text("rework_completed").default("false"),
  contractorResponse: text("contractor_response"),
  resolvedAt: timestamp("resolved_at"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// Export types
export type Job = typeof jobs.$inferSelect;
export type JobWithContractor = Job & { contractor: typeof contractors.$inferSelect | null };
export type WorkSession = typeof workSessions.$inferSelect;
export type ProjectCashFlow = typeof projectCashFlow.$inferSelect;
export type CashFlowForecast = typeof cashFlowForecasts.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ClientPayment = typeof clientPayments.$inferSelect;

// Insert schemas
export const insertJobSchema = createInsertSchema(jobs);
export const insertContractorSchema = createInsertSchema(contractors);
export const insertWorkSessionSchema = createInsertSchema(workSessions);
export const insertContractorApplicationSchema = createInsertSchema(contractorApplications);
export const insertAdminSettingSchema = createInsertSchema(adminSettings);
export const insertProjectCashFlowSchema = createInsertSchema(projectCashFlow);
export const insertExpenseSchema = createInsertSchema(expenses);
export const insertClientPaymentSchema = createInsertSchema(clientPayments);

// Job assignment schemas
export const jobAssignmentSchema = z.object({
  jobId: z.string(),
  contractorId: z.string(),
  contractorName: z.string(),
  estimatedHours: z.number().optional(),
  budgetedCost: z.number().optional(),
  notes: z.string().optional(),
});

export const insertJobAssignmentSchema = createInsertSchema(jobAssignments);

// Insert types
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertContractorApplication = z.infer<typeof insertContractorApplicationSchema>;
export type InsertProjectCashFlow = z.infer<typeof insertProjectCashFlowSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertClientPayment = z.infer<typeof insertClientPaymentSchema>;