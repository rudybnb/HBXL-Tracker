import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, boolean, serial, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobStatusEnum = pgEnum("job_status", ["pending", "assigned", "completed"]);
export const contractorStatusEnum = pgEnum("contractor_status", ["available", "busy", "unavailable"]);
export const uploadStatusEnum = pgEnum("upload_status", ["processing", "processed", "failed"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled", "temporarily_away"]);
export const eventStatusEnum = pgEnum("event_status", ["scheduled", "completed", "cancelled"]);

// Manus-n8n Integration - Cost Category Types
export const costCategoryEnum = pgEnum("cost_category", ["LABOUR", "MATERIAL", "PLANT", "SUBCONTRACTOR"]);

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

  // Manus-n8n Integration - Enhanced Financial Fields
  externalCode: text("external_code"), // e.g., "HBXL-IMPORT" for n8n imports
  clientName: text("client_name"), // e.g., "Freddy Jackson"
  projectType: text("project_type"), // e.g., "Refurbishment"
  address: text("address"), // Full address (separate from location for precision)
  postcode: text("postcode"), // e.g., "DA7 4RW"
  quotedAmount: text("quoted_amount"), // Total quoted value in pence

  // Financial Summary (JSON with category totals)
  financialSummary: text("financial_summary"), // JSON: {labour: 0, material: 0, plant: 0, subcontractor: 0, total: 0}
});

// Manus-n8n Integration - Job Cost Items Table
// Stores individual cost line items for Labour, Material, Plant, Subcontractor
export const jobCostItems = pgTable("job_cost_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  category: costCategoryEnum("category").notNull(), // LABOUR, MATERIAL, PLANT, SUBCONTRACTOR
  description: text("description").notNull(),
  quantity: text("quantity").notNull().default("1"),
  unit: text("unit").notNull().default("Each"), // "Hours", "Each", "Days", etc.
  rate: text("rate").notNull().default("0"), // Unit rate in pence
  total: text("total").notNull().default("0"), // Total cost in pence (qty * rate)
  supplier: text("supplier"), // Supplier name if applicable
  sourceMetadata: text("source_metadata"), // JSON for additional HBXL data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobFiles = pgTable("job_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(), // "image/png", "application/pdf"
  uploadedBy: text("uploaded_by").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
});

// Temporary departure tracking for contractors during work hours
export const temporaryDepartures = pgTable("temporary_departures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  workSessionId: varchar("work_session_id").references(() => workSessions.id),
  departureTime: timestamp("departure_time").notNull(),
  returnTime: timestamp("return_time"),
  status: text("status").notNull().default("away"), // "away" or "returned"
  distanceFromSite: text("distance_from_site"), // Distance in meters
  nearestJobSite: text("nearest_job_site"), // Which job site they're away from
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTemporaryDepartureSchema = createInsertSchema(temporaryDepartures).omit({
  id: true,
  createdAt: true,
});

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
});

// Manus-n8n Integration - Cost Item Schema
export const insertJobCostItemSchema = createInsertSchema(jobCostItems).omit({
  id: true,
  createdAt: true,
});

// Manus-n8n Integration - Job Import Payload Schema (for /api/v1/n/import-job)
export const jobImportPayloadSchema = z.object({
  job: z.object({
    code: z.string().optional(),
    client_name: z.string(),
    project_type: z.string(),
    address: z.string(),
    postcode: z.string(),
    quoted_amount: z.number().optional(),
    title: z.string().optional(),
  }),
  tasks: z.array(z.object({
    type: z.enum(["LABOUR", "MATERIAL", "PLANT", "SUBCONTRACTOR"]),
    description: z.string(),
    qty: z.number(),
    unit: z.string(),
    rate: z.number(),
    total: z.number(),
    supplier: z.string().optional(),
  })),
});

export const insertJobFileSchema = createInsertSchema(jobFiles).omit({
  id: true,
  createdAt: true,
});

export const insertCsvUploadSchema = createInsertSchema(csvUploads).omit({
  id: true,
  uploadedAt: true,
});

export const insertContractorApplicationSchema = createInsertSchema(contractorApplications).omit({
  id: true,
  submittedAt: true,
});

export const jobAssignmentSchema = z.object({
  jobId: z.string(),
  contractorId: z.string(),
  dueDate: z.string(),
  notes: z.string().optional(),
});

// Contractor Replies tracking  
export const contractorReplies = pgTable("contractor_replies", {
  id: text("id").primaryKey(),
  contractorName: text("contractor_name").notNull(),
  contractorPhone: text("contractor_phone"),
  messageText: text("message_text").notNull(),
  contractorId: text("contractor_id").notNull(), // The generated unique ID
  telegramUserId: text("telegram_user_id"),
  receivedAt: text("received_at").notNull(),
  formSent: boolean("form_sent").default(false),
});

export const insertContractorReplySchema = createInsertSchema(contractorReplies).omit({
  id: true,
});

export const insertWorkSessionSchema = createInsertSchema(workSessions).omit({
  id: true,
  createdAt: true,
});

// Admin settings table for system configuration
export const adminSettings = pgTable("admin_settings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  updatedAt: true,
});

// Job Assignments table
export const jobAssignments = pgTable("job_assignments", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  workLocation: text("work_location").notNull(),
  hbxlJob: text("hbxl_job").notNull(),
  buildPhases: text("build_phases").array().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  specialInstructions: text("special_instructions"),
  status: text("status").notNull().default("assigned"),
  sendTelegramNotification: boolean("send_telegram_notification").default(false),
  latitude: text("latitude"), // GPS latitude for work site
  longitude: text("longitude"), // GPS longitude for work site
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Task Progress table for tracking individual task completion
export const taskProgress = pgTable("task_progress", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  assignmentId: text("assignment_id").notNull(), // Reference to job assignment
  taskId: text("task_id").notNull(), // Unique task identifier (phase-description)
  phase: text("phase").notNull(),
  taskDescription: text("task_description").notNull(),
  completed: boolean("completed").notNull().default(false),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskProgressSchema = createInsertSchema(taskProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



// Contractor Reports table for simple issue reporting
export const contractorReports = pgTable("contractor_reports", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorName: text("contractor_name").notNull(),
  assignmentId: text("assignment_id").notNull(),
  reportText: text("report_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("pending").notNull(), // pending, viewed, resolved
});

export const insertContractorReportSchema = createInsertSchema(contractorReports).omit({
  id: true,
  createdAt: true,
});

// Admin Site Inspections table for detailed admin reports with photos
export const adminInspections = pgTable("admin_inspections", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: text("assignment_id").notNull(),
  inspectorName: text("inspector_name").notNull(),
  inspectionType: text("inspection_type").notNull(), // "50_percent" or "100_percent"
  workQualityRating: text("work_quality_rating").notNull(),
  weatherConditions: text("weather_conditions").notNull(),
  progressComments: text("progress_comments").notNull(),
  safetyNotes: text("safety_notes"),
  materialsIssues: text("materials_issues"),
  nextActions: text("next_actions"),
  photoUrls: text("photo_urls").array(), // Array of photo URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("draft").notNull(), // draft, submitted, contractor_viewed
});

// Inspection notifications to track when admin visits are needed
export const inspectionNotifications = pgTable("inspection_notifications", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: text("assignment_id").notNull(),
  contractorName: text("contractor_name").notNull(),
  notificationType: text("notification_type").notNull(), // "50_percent_ready" or "100_percent_ready"
  notificationSent: boolean("notification_sent").default(false).notNull(),
  inspectionCompleted: boolean("inspection_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Task Inspection Results table - tracks admin inspection status for individual tasks
export const taskInspectionResults = pgTable("task_inspection_results", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: text("assignment_id").notNull(),
  contractorName: text("contractor_name").notNull(),
  taskId: text("task_id").notNull(),
  phase: text("phase").notNull(),
  taskName: text("task_name").notNull(),
  inspectionStatus: text("inspection_status").notNull(), // 'approved', 'issues', 'pending', 'contractor_fixed', 'admin_reapproved'
  notes: text("notes"),
  photos: text("photos").array(), // Array of photo URLs
  inspectedBy: text("inspected_by").notNull(),
  inspectedAt: timestamp("inspected_at").defaultNow().notNull(),
  contractorViewed: boolean("contractor_viewed").default(false).notNull(),
  contractorViewedAt: timestamp("contractor_viewed_at"),
  contractorMarkedDone: boolean("contractor_marked_done").default(false).notNull(),
  contractorMarkedDoneAt: timestamp("contractor_marked_done_at"),
  contractorFixNotes: text("contractor_fix_notes"),
  adminReapprovedBy: text("admin_reapproved_by"),
  adminReapprovedAt: timestamp("admin_reapproved_at"),
  adminReapprovalNotes: text("admin_reapproval_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskInspectionResultSchema = createInsertSchema(taskInspectionResults).omit({
  id: true,
  createdAt: true,
});

export const insertAdminInspectionSchema = createInsertSchema(adminInspections).omit({
  id: true,
  createdAt: true,
});

// Weekly Cash Flow Tracking System - MANDATORY RULE: AUTHENTIC DATA ONLY
export const projectCashflowWeekly = pgTable("project_cashflow_weekly", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull(), // Links to jobs table
  projectName: text("project_name").notNull(),
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD format
  weekEndDate: text("week_end_date").notNull(),
  weekNumber: text("week_number").notNull(), // Week 1, Week 2, etc.

  // Forecasted spend (entered by accountant)
  forecastedLabourCost: text("forecasted_labour_cost").default("0").notNull(),
  forecastedMaterialCost: text("forecasted_material_cost").default("0").notNull(),
  forecastedTotalSpend: text("forecasted_total_spend").default("0").notNull(),

  // Actual spend (calculated from authentic sources)
  actualLabourCost: text("actual_labour_cost").default("0").notNull(), // From work_sessions
  actualMaterialCost: text("actual_material_cost").default("0").notNull(), // From material_purchases
  actualTotalSpend: text("actual_total_spend").default("0").notNull(),

  // Budget tracking
  cumulativeSpend: text("cumulative_spend").default("0").notNull(),
  remainingBudget: text("remaining_budget").default("0").notNull(),
  projectCompletionPercent: text("project_completion_percent").default("0").notNull(),
  budgetUsedPercent: text("budget_used_percent").default("0").notNull(),

  // Variance analysis
  labourVariance: text("labour_variance").default("0").notNull(), // actual - forecasted
  materialVariance: text("material_variance").default("0").notNull(),
  totalVariance: text("total_variance").default("0").notNull(),

  // Data sources and validation
  labourDataSource: text("labour_data_source").default("work_sessions").notNull(), // "work_sessions"
  materialDataSource: text("material_data_source").default("manual").notNull(), // "uploaded_invoices", "manual", "none"
  dataValidated: boolean("data_validated").default(false).notNull(),
  validatedBy: text("validated_by"),
  validatedAt: timestamp("validated_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectCashflowWeeklySchema = createInsertSchema(projectCashflowWeekly).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// B'elanna Business PA - Calendar Events and Reminders  
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: text("event_date").notNull(), // YYYY-MM-DD
  eventTime: text("event_time").notNull(), // HH:MM format
  durationMinutes: text("duration_minutes").default("30").notNull(),
  status: eventStatusEnum("status").default("scheduled").notNull(),
  reminderSet: boolean("reminder_set").default(true).notNull(),
  eventType: text("event_type").default("reminder").notNull(), // "reminder", "meeting", "appointment"
  participants: text("participants"), // JSON array of email addresses
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// B'elanna Business PA - Email Management
export const emailRecords = pgTable("email_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toAddress: text("to_address").notNull(),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  emailType: text("email_type").default("outgoing").notNull(), // "outgoing", "incoming"
  status: text("status").default("sent").notNull(), // "sent", "failed", "draft"
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  calendarEventId: varchar("calendar_event_id").references(() => calendarEvents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// B'elanna Business PA - Meeting Scheduling
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  meetingDate: text("meeting_date").notNull(), // YYYY-MM-DD
  meetingTime: text("meeting_time").notNull(), // HH:MM format  
  durationMinutes: text("duration_minutes").default("60").notNull(),
  location: text("location"),
  participants: text("participants").notNull(), // JSON array of participant info
  organizerEmail: text("organizer_email").notNull(),
  status: eventStatusEnum("status").default("scheduled").notNull(),
  meetingType: text("meeting_type").default("business").notNull(), // "business", "project", "personal"
  calendarEventId: varchar("calendar_event_id").references(() => calendarEvents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Material Purchases Tracking - MANDATORY RULE: CSV/INVOICE DATA ONLY
export const materialPurchases = pgTable("material_purchases", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  purchaseWeek: text("purchase_week").notNull(), // YYYY-MM-DD of week start

  // Purchase details - AUTHENTIC DATA ONLY
  supplierName: text("supplier_name").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  itemDescription: text("item_description").notNull(),
  quantity: text("quantity").notNull(),
  unitCost: text("unit_cost").notNull(),
  totalCost: text("total_cost").notNull(),
  category: text("category").notNull(), // "materials", "tools", "equipment", "consumables"

  // Data source validation
  dataSource: text("data_source").notNull().default("uploaded_invoice"), // "uploaded_invoice", "csv_import", "manual_entry"
  invoiceFileUrl: text("invoice_file_url"), // URL to uploaded invoice PDF/image
  uploadedBy: text("uploaded_by").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMaterialPurchaseSchema = createInsertSchema(materialPurchases).omit({
  id: true,
  createdAt: true,
});

// B'elanna PA Zod schemas
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertEmailRecordSchema = createInsertSchema(emailRecords).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Project Master Data - Links all cash flow data
export const projectMaster = pgTable("project_master", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull().unique(),
  clientName: text("client_name").notNull(),
  projectType: text("project_type").notNull(), // "labour_only", "labour_materials", "materials_only"

  // Project timeline
  startDate: text("start_date").notNull(),
  estimatedEndDate: text("estimated_end_date").notNull(),
  actualEndDate: text("actual_end_date"),

  // Budget information - AUTHENTIC DATA ONLY
  totalBudget: text("total_budget").notNull(),
  quotedPrice: text("quoted_price").notNull(),
  labourBudget: text("labour_budget").notNull(),
  materialBudget: text("material_budget").notNull(),

  // Enhanced financial tracking from CSV uploads
  weeklyBreakdown: text("weekly_breakdown"), // JSON of weekly cash flow data
  supplierBreakdown: text("supplier_breakdown"), // JSON of supplier payment schedules
  resourceBreakdown: text("resource_breakdown"), // JSON of detailed resource tracking

  // Current status
  status: text("status").default("active").notNull(), // "planning", "active", "completed", "on_hold"
  completionPercent: text("completion_percent").default("0").notNull(),

  // Data source validation
  budgetDataSource: text("budget_data_source").notNull(), // "contract_csv", "quote_upload", "manual_entry"
  createdBy: text("created_by").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectMasterSchema = createInsertSchema(projectMaster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInspectionNotificationSchema = createInsertSchema(inspectionNotifications).omit({
  id: true,
  createdAt: true,
});

// Conversation History for Telegram Bot
export const conversationHistory = pgTable("conversation_history", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationHistorySchema = createInsertSchema(conversationHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type Contractor = typeof contractors.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertCsvUpload = z.infer<typeof insertCsvUploadSchema>;
export type CsvUpload = typeof csvUploads.$inferSelect;
export type InsertContractorApplication = z.infer<typeof insertContractorApplicationSchema>;
export type ContractorApplication = typeof contractorApplications.$inferSelect;
export type InsertContractorReply = z.infer<typeof insertContractorReplySchema>;
export type ContractorReply = typeof contractorReplies.$inferSelect;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type WorkSession = typeof workSessions.$inferSelect;
export type JobAssignment = z.infer<typeof jobAssignmentSchema>;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertJobAssignment = z.infer<typeof insertJobAssignmentSchema>;
export type JobAssignmentRecord = typeof jobAssignments.$inferSelect;
export type InsertContractorReport = z.infer<typeof insertContractorReportSchema>;
export type ContractorReport = typeof contractorReports.$inferSelect;
export type InsertAdminInspection = z.infer<typeof insertAdminInspectionSchema>;
export type AdminInspection = typeof adminInspections.$inferSelect;
export type InsertInspectionNotification = z.infer<typeof insertInspectionNotificationSchema>;
export type InspectionNotification = typeof inspectionNotifications.$inferSelect;
export type InsertTaskProgress = z.infer<typeof insertTaskProgressSchema>;
export type TaskProgress = typeof taskProgress.$inferSelect;
export type InsertTaskInspectionResult = z.infer<typeof insertTaskInspectionResultSchema>;
export type TaskInspectionResult = typeof taskInspectionResults.$inferSelect;
export type ContractorAssignment = typeof jobAssignments.$inferSelect;
export type InsertContractorAssignment = z.infer<typeof insertJobAssignmentSchema>;

// B'elanna PA Types
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertEmailRecord = z.infer<typeof insertEmailRecordSchema>;
export type EmailRecord = typeof emailRecords.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

export interface JobWithContractor extends Job {
  contractor?: Contractor;
}

// Manus-n8n Integration Types
export type InsertJobCostItem = z.infer<typeof insertJobCostItemSchema>;
export type JobCostItem = typeof jobCostItems.$inferSelect;
export type InsertJobFile = z.infer<typeof insertJobFileSchema>;
export type JobFile = typeof jobFiles.$inferSelect;
export type JobImportPayload = z.infer<typeof jobImportPayloadSchema>;

// Financial Summary Type
export interface FinancialSummary {
  labour: number;
  material: number;
  plant: number;
  subcontractor: number;
  total: number;
}

// Job with Financial Data
export interface JobWithFinancials extends Job {
  costItems?: JobCostItem[];
  financialBreakdown?: FinancialSummary;
}
