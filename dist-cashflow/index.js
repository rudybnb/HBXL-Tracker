var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared-cashflow/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminInspections: () => adminInspections,
  adminSettings: () => adminSettings,
  cashFlowAlerts: () => cashFlowAlerts,
  cashFlowForecasts: () => cashFlowForecasts,
  clientPayments: () => clientPayments,
  contractorApplications: () => contractorApplications,
  contractorReports: () => contractorReports,
  contractorStatusEnum: () => contractorStatusEnum,
  contractors: () => contractors,
  csvUploads: () => csvUploads,
  expenses: () => expenses,
  insertAdminSettingSchema: () => insertAdminSettingSchema,
  insertClientPaymentSchema: () => insertClientPaymentSchema,
  insertContractorApplicationSchema: () => insertContractorApplicationSchema,
  insertContractorSchema: () => insertContractorSchema,
  insertExpenseSchema: () => insertExpenseSchema,
  insertInspectionNotificationSchema: () => insertInspectionNotificationSchema,
  insertJobAssignmentSchema: () => insertJobAssignmentSchema,
  insertJobSchema: () => insertJobSchema,
  insertMaterialPurchaseSchema: () => insertMaterialPurchaseSchema,
  insertProjectCashFlowSchema: () => insertProjectCashFlowSchema,
  insertProjectCashflowWeeklySchema: () => insertProjectCashflowWeeklySchema,
  insertProjectMasterSchema: () => insertProjectMasterSchema,
  insertTaskProgressSchema: () => insertTaskProgressSchema,
  insertWorkSessionSchema: () => insertWorkSessionSchema,
  inspectionNotifications: () => inspectionNotifications,
  jobAssignmentSchema: () => jobAssignmentSchema,
  jobAssignments: () => jobAssignments,
  jobStatusEnum: () => jobStatusEnum,
  jobs: () => jobs,
  materialPurchases: () => materialPurchases2,
  projectCashFlow: () => projectCashFlow,
  projectCashflowWeekly: () => projectCashflowWeekly2,
  projectMaster: () => projectMaster2,
  sessionStatusEnum: () => sessionStatusEnum,
  taskInspectionResults: () => taskInspectionResults,
  taskProgress: () => taskProgress,
  temporaryDepartures: () => temporaryDepartures,
  uploadStatusEnum: () => uploadStatusEnum,
  workSessions: () => workSessions
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var jobStatusEnum, contractorStatusEnum, uploadStatusEnum, sessionStatusEnum, contractors, jobs, csvUploads, contractorApplications, workSessions, temporaryDepartures, adminSettings, projectCashFlow, cashFlowForecasts, cashFlowAlerts, expenses, clientPayments, jobAssignments, contractorReports, adminInspections, taskInspectionResults, insertJobSchema, insertContractorSchema, insertWorkSessionSchema, insertContractorApplicationSchema, insertAdminSettingSchema, insertProjectCashFlowSchema, insertExpenseSchema, insertClientPaymentSchema, jobAssignmentSchema, insertJobAssignmentSchema, inspectionNotifications, insertInspectionNotificationSchema, taskProgress, insertTaskProgressSchema, projectCashflowWeekly2, insertProjectCashflowWeeklySchema, materialPurchases2, insertMaterialPurchaseSchema, projectMaster2, insertProjectMasterSchema;
var init_schema = __esm({
  "shared-cashflow/schema.ts"() {
    "use strict";
    jobStatusEnum = pgEnum("job_status", ["pending", "assigned", "completed"]);
    contractorStatusEnum = pgEnum("contractor_status", ["available", "busy", "unavailable"]);
    uploadStatusEnum = pgEnum("upload_status", ["processing", "processed", "failed"]);
    sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled", "temporarily_away"]);
    contractors = pgTable("contractors", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
      specialty: text("specialty").notNull(),
      status: contractorStatusEnum("status").notNull().default("available"),
      rating: text("rating").notNull().default("0"),
      activeJobs: text("active_jobs").notNull().default("0"),
      completedJobs: text("completed_jobs").notNull().default("0")
    });
    jobs = pgTable("jobs", {
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
      phases: text("phases"),
      // JSON string of selected phases
      phaseTaskData: text("phase_task_data"),
      // JSON string of detailed task data from CSV
      telegramNotified: text("telegram_notified").default("false"),
      latitude: text("latitude"),
      // GPS latitude for work site
      longitude: text("longitude"),
      // GPS longitude for work site
      // Cash flow specific fields
      estimatedBudget: decimal("estimated_budget", { precision: 10, scale: 2 }),
      actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default("0.00"),
      profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("0.00"),
      clientPaymentStatus: text("client_payment_status").default("pending"),
      // pending, partial, paid
      clientPaymentAmount: decimal("client_payment_amount", { precision: 10, scale: 2 }).default("0.00")
    });
    csvUploads = pgTable("csv_uploads", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      filename: text("filename").notNull(),
      status: uploadStatusEnum("status").notNull().default("processing"),
      jobsCount: text("jobs_count").notNull().default("0"),
      uploadedAt: timestamp("uploaded_at").defaultNow()
    });
    contractorApplications = pgTable("contractor_applications", {
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
      adminCisVerification: text("admin_cis_verification"),
      // Admin fills CIS verification details
      adminPayRate: text("admin_pay_rate"),
      // Admin sets pay rate
      adminNotes: text("admin_notes"),
      // Admin internal notes
      // Login credentials (set by admin when approving contractor)
      username: text("username"),
      // Unique login username
      password: text("password"),
      // Hashed password
      // Metadata
      status: text("status").notNull().default("pending"),
      submittedAt: timestamp("submitted_at").defaultNow()
    });
    workSessions = pgTable("work_sessions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      contractorName: text("contractor_name").notNull(),
      jobSiteLocation: text("job_site_location").notNull(),
      // e.g., "ME5 9GX"
      startTime: timestamp("start_time").notNull(),
      endTime: timestamp("end_time"),
      totalHours: text("total_hours"),
      // e.g., "08:11:19"
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
      jobId: varchar("job_id").references(() => jobs.id)
    });
    temporaryDepartures = pgTable("temporary_departures", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      contractorName: text("contractor_name").notNull(),
      workSessionId: varchar("work_session_id").references(() => workSessions.id),
      departureTime: timestamp("departure_time").notNull(),
      returnTime: timestamp("return_time"),
      reason: text("reason"),
      distanceFromSite: text("distance_from_site"),
      // Distance in meters
      createdAt: timestamp("created_at").defaultNow()
    });
    adminSettings = pgTable("admin_settings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      settingKey: text("setting_key").notNull().unique(),
      settingValue: text("setting_value").notNull(),
      description: text("description"),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    projectCashFlow = pgTable("project_cash_flow", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      weekEnding: text("week_ending").notNull(),
      // Format: "2025-08-15"
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
      updatedAt: timestamp("updated_at").defaultNow()
    });
    cashFlowForecasts = pgTable("cash_flow_forecasts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      forecastWeek: text("forecast_week").notNull(),
      // Format: "2025-08-22"
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
      confidenceLevel: text("confidence_level").default("medium"),
      // low, medium, high
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    cashFlowAlerts = pgTable("cash_flow_alerts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      alertType: text("alert_type").notNull(),
      // negative_flow, payment_overdue, budget_exceeded
      severity: text("severity").notNull(),
      // low, medium, high, critical
      message: text("message").notNull(),
      threshold: decimal("threshold", { precision: 12, scale: 2 }),
      currentValue: decimal("current_value", { precision: 12, scale: 2 }),
      isResolved: boolean("is_resolved").default(false),
      resolvedAt: timestamp("resolved_at"),
      createdAt: timestamp("created_at").defaultNow()
    });
    expenses = pgTable("expenses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      expenseType: text("expense_type").notNull(),
      // material, equipment, subcontractor, overhead
      category: text("category").notNull(),
      // cement, steel, rental, transport, etc.
      description: text("description").notNull(),
      supplier: text("supplier"),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      quantity: decimal("quantity", { precision: 10, scale: 3 }),
      unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
      invoiceNumber: text("invoice_number"),
      dateIncurred: timestamp("date_incurred").notNull(),
      paymentStatus: text("payment_status").default("pending"),
      // pending, paid, overdue
      paymentDate: timestamp("payment_date"),
      approvedBy: text("approved_by"),
      receiptUploaded: boolean("receipt_uploaded").default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    clientPayments = pgTable("client_payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      paymentType: text("payment_type").notNull(),
      // interim, final, retention, variation
      invoiceNumber: text("invoice_number").notNull(),
      invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }).notNull(),
      paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }).default("0.00"),
      retentionAmount: decimal("retention_amount", { precision: 12, scale: 2 }).default("0.00"),
      invoiceDate: timestamp("invoice_date").notNull(),
      dueDate: timestamp("due_date").notNull(),
      paymentDate: timestamp("payment_date"),
      paymentStatus: text("payment_status").default("pending"),
      // pending, partial, paid, overdue
      daysPastDue: text("days_past_due").default("0"),
      clientNotes: text("client_notes"),
      internalNotes: text("internal_notes"),
      createdAt: timestamp("created_at").defaultNow()
    });
    jobAssignments = pgTable("job_assignments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      contractorId: varchar("contractor_id").references(() => contractors.id).notNull(),
      contractorName: text("contractor_name").notNull(),
      assignedDate: timestamp("assigned_date").defaultNow(),
      status: text("status").default("active"),
      // active, completed, paused
      estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }),
      actualHours: decimal("actual_hours", { precision: 6, scale: 2 }).default("0.00"),
      budgetedCost: decimal("budgeted_cost", { precision: 10, scale: 2 }),
      actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default("0.00"),
      notes: text("notes")
    });
    contractorReports = pgTable("contractor_reports", {
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
      photoUrls: text("photo_urls"),
      // JSON array of photo URLs
      safetyNotes: text("safety_notes"),
      qualityRating: text("quality_rating"),
      // 1-5 scale
      submittedAt: timestamp("submitted_at").defaultNow(),
      status: text("status").default("submitted")
      // submitted, reviewed, approved
    });
    adminInspections = pgTable("admin_inspections", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      contractorName: text("contractor_name").notNull(),
      inspectionDate: text("inspection_date").notNull(),
      progressPercentage: text("progress_percentage").notNull(),
      qualityRating: text("quality_rating").notNull(),
      // 1-5 scale
      workmanshipNotes: text("workmanship_notes"),
      materialsQuality: text("materials_quality"),
      // excellent, good, fair, poor
      safetyCompliance: text("safety_compliance"),
      // compliant, minor_issues, major_issues
      issuesIdentified: text("issues_identified"),
      correctiveActions: text("corrective_actions"),
      nextInspectionDate: text("next_inspection_date"),
      overallSatisfaction: text("overall_satisfaction"),
      // very_satisfied, satisfied, neutral, dissatisfied
      additionalNotes: text("additional_notes"),
      photoUrls: text("photo_urls"),
      // JSON array of photo URLs
      weatherConditions: text("weather_conditions"),
      adminName: text("admin_name").notNull(),
      submittedAt: timestamp("submitted_at").defaultNow(),
      contractorNotified: text("contractor_notified").default("false"),
      status: text("status").default("pending")
      // pending, acknowledged, resolved
    });
    taskInspectionResults = pgTable("task_inspection_results", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      jobId: varchar("job_id").references(() => jobs.id).notNull(),
      contractorName: text("contractor_name").notNull(),
      taskName: text("task_name").notNull(),
      inspectionDate: text("inspection_date").notNull(),
      status: text("status").notNull(),
      // passed, failed, requires_rework
      qualityScore: text("quality_score"),
      // 1-10 scale
      notes: text("notes"),
      issuesFound: text("issues_found"),
      // JSON array of issues
      photoUrls: text("photo_urls"),
      // JSON array of photo URLs
      adminName: text("admin_name").notNull(),
      reworkRequired: text("rework_required").default("false"),
      reworkNotes: text("rework_notes"),
      reworkCompleted: text("rework_completed").default("false"),
      contractorResponse: text("contractor_response"),
      resolvedAt: timestamp("resolved_at"),
      submittedAt: timestamp("submitted_at").defaultNow()
    });
    insertJobSchema = createInsertSchema(jobs);
    insertContractorSchema = createInsertSchema(contractors);
    insertWorkSessionSchema = createInsertSchema(workSessions);
    insertContractorApplicationSchema = createInsertSchema(contractorApplications);
    insertAdminSettingSchema = createInsertSchema(adminSettings);
    insertProjectCashFlowSchema = createInsertSchema(projectCashFlow);
    insertExpenseSchema = createInsertSchema(expenses);
    insertClientPaymentSchema = createInsertSchema(clientPayments);
    jobAssignmentSchema = z.object({
      jobId: z.string(),
      contractorId: z.string(),
      contractorName: z.string(),
      estimatedHours: z.number().optional(),
      budgetedCost: z.number().optional(),
      notes: z.string().optional()
    });
    insertJobAssignmentSchema = createInsertSchema(jobAssignments);
    inspectionNotifications = pgTable("inspection_notifications", {
      id: text("id").primaryKey().default(sql`gen_random_uuid()`),
      assignmentId: text("assignment_id").notNull(),
      contractorName: text("contractor_name").notNull(),
      notificationType: text("notification_type").notNull(),
      notificationSent: boolean("notification_sent").default(false).notNull(),
      inspectionCompleted: boolean("inspection_completed").default(false).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      completedAt: timestamp("completed_at")
    });
    insertInspectionNotificationSchema = createInsertSchema(inspectionNotifications).omit({
      id: true,
      createdAt: true
    });
    taskProgress = pgTable("task_progress", {
      id: text("id").primaryKey().default(sql`gen_random_uuid()`),
      contractorName: text("contractor_name").notNull(),
      assignmentId: text("assignment_id").notNull(),
      taskId: text("task_id").notNull(),
      phase: text("phase").notNull(),
      taskDescription: text("task_description").notNull(),
      completed: boolean("completed").notNull().default(false),
      startTime: timestamp("start_time"),
      endTime: timestamp("end_time"),
      notes: text("notes"),
      completedAt: timestamp("completed_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    insertTaskProgressSchema = createInsertSchema(taskProgress).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    projectCashflowWeekly2 = pgTable("project_cashflow_weekly", {
      id: text("id").primaryKey().default(sql`gen_random_uuid()`),
      projectId: text("project_id").notNull(),
      projectName: text("project_name").notNull(),
      weekStartDate: text("week_start_date").notNull(),
      weekEndDate: text("week_end_date").notNull(),
      weekNumber: text("week_number").notNull(),
      forecastedLabourCost: text("forecasted_labour_cost").default("0").notNull(),
      forecastedMaterialCost: text("forecasted_material_cost").default("0").notNull(),
      forecastedTotalSpend: text("forecasted_total_spend").default("0").notNull(),
      actualLabourCost: text("actual_labour_cost").default("0").notNull(),
      actualMaterialCost: text("actual_material_cost").default("0").notNull(),
      actualTotalSpend: text("actual_total_spend").default("0").notNull(),
      cumulativeSpend: text("cumulative_spend").default("0").notNull(),
      remainingBudget: text("remaining_budget").default("0").notNull(),
      projectCompletionPercent: text("project_completion_percent").default("0").notNull(),
      budgetUsedPercent: text("budget_used_percent").default("0").notNull(),
      labourVariance: text("labour_variance").default("0").notNull(),
      materialVariance: text("material_variance").default("0").notNull(),
      totalVariance: text("total_variance").default("0").notNull(),
      labourDataSource: text("labour_data_source").default("work_sessions").notNull(),
      materialDataSource: text("material_data_source").default("manual").notNull(),
      dataValidated: boolean("data_validated").default(false).notNull(),
      validatedBy: text("validated_by"),
      validatedAt: timestamp("validated_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    insertProjectCashflowWeeklySchema = createInsertSchema(projectCashflowWeekly2).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    materialPurchases2 = pgTable("material_purchases", {
      id: text("id").primaryKey().default(sql`gen_random_uuid()`),
      projectId: text("project_id").notNull(),
      projectName: text("project_name").notNull(),
      purchaseWeek: text("purchase_week").notNull(),
      supplierName: text("supplier_name").notNull(),
      invoiceNumber: text("invoice_number").notNull(),
      purchaseDate: text("purchase_date").notNull(),
      itemDescription: text("item_description").notNull(),
      quantity: text("quantity").notNull(),
      unitCost: text("unit_cost").notNull(),
      totalCost: text("total_cost").notNull(),
      category: text("category").notNull(),
      dataSource: text("data_source").notNull().default("uploaded_invoice"),
      invoiceFileUrl: text("invoice_file_url"),
      uploadedBy: text("uploaded_by").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    insertMaterialPurchaseSchema = createInsertSchema(materialPurchases2).omit({
      id: true,
      createdAt: true
    });
    projectMaster2 = pgTable("project_master", {
      id: text("id").primaryKey().default(sql`gen_random_uuid()`),
      projectName: text("project_name").notNull().unique(),
      clientName: text("client_name").notNull(),
      projectType: text("project_type").notNull(),
      startDate: text("start_date").notNull(),
      estimatedEndDate: text("estimated_end_date").notNull(),
      actualEndDate: text("actual_end_date"),
      totalBudget: text("total_budget").notNull(),
      quotedPrice: text("quoted_price").notNull(),
      labourBudget: text("labour_budget").notNull(),
      materialBudget: text("material_budget").notNull(),
      weeklyBreakdown: text("weekly_breakdown"),
      supplierBreakdown: text("supplier_breakdown"),
      resourceBreakdown: text("resource_breakdown"),
      status: text("status").default("active").notNull(),
      completionPercent: text("completion_percent").default("0").notNull(),
      budgetDataSource: text("budget_data_source").notNull(),
      createdBy: text("created_by").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    insertProjectMasterSchema = createInsertSchema(projectMaster2).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server-cashflow/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var Pool, pool, db;
var init_db = __esm({
  "server-cashflow/db.ts"() {
    "use strict";
    init_schema();
    console.log("Loading db.ts...");
    console.log("Imported drizzle");
    console.log("Imported pg");
    console.log("Imported schema");
    ({ Pool } = pg);
    console.log("Creating Pool...");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log("Pool created");
    console.log("Creating drizzle instance...");
    db = drizzle(pool, { schema: schema_exports });
    console.log("Drizzle instance created");
  }
});

// server-cashflow/database-storage.ts
var database_storage_exports = {};
__export(database_storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  storage: () => storage
});
import { eq, desc, and, or, like, inArray, sql as sql2 } from "drizzle-orm";
var DatabaseStorage, storage;
var init_database_storage = __esm({
  "server-cashflow/database-storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    DatabaseStorage = class {
      constructor() {
        console.log("\u2705 DatabaseStorage initialized with persistent PostgreSQL");
      }
      // Contractors
      async getContractors() {
        return db.select().from(contractors);
      }
      async getContractor(id) {
        const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
        return contractor;
      }
      async createContractor(insertContractor) {
        const [contractor] = await db.insert(contractors).values(insertContractor).returning();
        return contractor;
      }
      async updateContractor(id, updates) {
        const [contractor] = await db.update(contractors).set(updates).where(eq(contractors.id, id)).returning();
        return contractor;
      }
      // Jobs
      async getJobs() {
        const jobsWithContractors = await db.select({
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
        }).from(jobs).leftJoin(contractors, eq(jobs.contractorId, contractors.id));
        return jobsWithContractors.map((row) => ({
          ...row,
          contractor: row.contractor || void 0
        }));
      }
      async getJob(id) {
        const [job] = await db.select({
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
        }).from(jobs).leftJoin(contractors, eq(jobs.contractorId, contractors.id)).where(eq(jobs.id, id));
        if (!job) return void 0;
        return {
          ...job,
          contractor: job.contractor || void 0
        };
      }
      async createJob(insertJob) {
        const [job] = await db.insert(jobs).values(insertJob).returning();
        return job;
      }
      async updateJob(id, updates) {
        const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
        return job;
      }
      async deleteJob(id) {
        const result = await db.delete(jobs).where(eq(jobs.id, id));
        console.log("\u{1F5D1}\uFE0F Deleted job:", id, "Affected rows:", result.rowCount);
        return result.rowCount > 0;
      }
      async createJobsFromCsv(jobsData, uploadId) {
        const createdJobs = await db.insert(jobs).values(jobsData).returning();
        return createdJobs;
      }
      // CSV Uploads
      async getCsvUploads() {
        return db.select().from(csvUploads);
      }
      async createCsvUpload(insertUpload) {
        const [upload2] = await db.insert(csvUploads).values(insertUpload).returning();
        return upload2;
      }
      async updateCsvUpload(id, updates) {
        const [upload2] = await db.update(csvUploads).set(updates).where(eq(csvUploads.id, id)).returning();
        return upload2;
      }
      async deleteCsvUpload(id) {
        const associatedJobs = await db.select().from(jobs).where(eq(jobs.uploadId, id));
        if (associatedJobs.length > 0) {
          await db.delete(jobs).where(eq(jobs.uploadId, id));
          console.log(`\u{1F5D1}\uFE0F Deleted ${associatedJobs.length} jobs associated with upload ${id}`);
        }
        const result = await db.delete(csvUploads).where(eq(csvUploads.id, id));
        console.log(`\u{1F5D1}\uFE0F Deleted CSV upload record ${id}`);
        return result.rowCount > 0;
      }
      // Job Assignment
      async assignJob(assignment) {
        const job = await this.getJob(assignment.jobId);
        const contractor = await this.getContractor(assignment.contractorId);
        if (!job || !contractor) return void 0;
        const updatedJob = await this.updateJob(assignment.jobId, {
          contractorId: assignment.contractorId,
          status: "assigned",
          dueDate: assignment.dueDate,
          notes: assignment.notes
        });
        const currentActiveJobs = parseInt(contractor.activeJobs) + 1;
        await this.updateContractor(assignment.contractorId, {
          activeJobs: currentActiveJobs.toString(),
          status: currentActiveJobs >= 3 ? "busy" : "available"
        });
        return updatedJob;
      }
      async createJobAssignment(assignment) {
        const [created] = await db.insert(jobAssignments).values(assignment).returning();
        console.log("\u2705 Job assignment created in database:", created);
        return created;
      }
      async getJobAssignments() {
        const assignments = await db.select().from(jobAssignments).orderBy(desc(jobAssignments.createdAt));
        console.log("\u{1F4CB} Retrieved job assignments:", assignments.length);
        return assignments;
      }
      async getJobAssignment(id) {
        const [assignment] = await db.select().from(jobAssignments).where(eq(jobAssignments.id, id));
        console.log("\u{1F50D} Retrieved job assignment by ID:", id, assignment ? "found" : "not found");
        return assignment;
      }
      async updateJobAssignment(id, updates) {
        const [assignment] = await db.update(jobAssignments).set(updates).where(eq(jobAssignments.id, id)).returning();
        console.log("\u{1F4DD} Updated job assignment:", id);
        return assignment;
      }
      async deleteJobAssignment(id) {
        const result = await db.delete(jobAssignments).where(eq(jobAssignments.id, id));
        console.log("\u{1F5D1}\uFE0F Deleted job assignment:", id, "Affected rows:", result.rowCount);
        return result.rowCount > 0;
      }
      async getContractorAssignments(contractorName) {
        try {
          const assignments = await db.query.jobAssignments.findMany({
            where: or(
              eq(jobAssignments.contractorName, contractorName),
              like(jobAssignments.contractorName, `${contractorName}%`)
            )
          });
          console.log(`\u{1F4CB} Found ${assignments.length} assignments for contractor: ${contractorName}`);
          return assignments;
        } catch (error) {
          console.error("Error fetching contractor assignments:", error);
          return [];
        }
      }
      // Contractor Applications
      async getContractorApplications() {
        return db.select().from(contractorApplications).orderBy(desc(contractorApplications.submittedAt));
      }
      async getContractorApplicationByUsername(username) {
        const [application] = await db.select().from(contractorApplications).where(eq(contractorApplications.username, username));
        return application;
      }
      async getContractorApplication(id) {
        const [application] = await db.select().from(contractorApplications).where(eq(contractorApplications.id, id));
        return application;
      }
      async getContractorByName(name) {
        const [firstName, lastName] = name.split(" ");
        const [contractor] = await db.select().from(contractorApplications).where(
          and(
            eq(contractorApplications.firstName, firstName),
            eq(contractorApplications.lastName, lastName || "")
          )
        );
        return contractor;
      }
      async createContractorApplication(insertApplication) {
        const [application] = await db.insert(contractorApplications).values(insertApplication).returning();
        return application;
      }
      async updateContractorApplication(id, updates) {
        const [application] = await db.update(contractorApplications).set(updates).where(eq(contractorApplications.id, id)).returning();
        return application;
      }
      // Work Sessions
      async getWorkSessions(contractorName) {
        if (contractorName) {
          return db.select().from(workSessions).where(like(workSessions.contractorName, `%${contractorName}%`)).orderBy(desc(workSessions.createdAt));
        }
        return db.select().from(workSessions).orderBy(desc(workSessions.createdAt));
      }
      async getActiveWorkSession(contractorName) {
        const [session] = await db.select().from(workSessions).where(
          and(
            like(workSessions.contractorName, `%${contractorName}%`),
            eq(workSessions.status, "active")
          )
        );
        return session;
      }
      async createWorkSession(insertSession) {
        const [session] = await db.insert(workSessions).values(insertSession).returning();
        return session;
      }
      async updateWorkSession(id, updates) {
        if (updates.endTime && updates.startTime) {
          const startTime = new Date(updates.startTime);
          const endTime = new Date(updates.endTime);
          const diffMs = endTime.getTime() - startTime.getTime();
          const hoursWorked = diffMs / (1e3 * 60 * 60);
          updates.totalHours = hoursWorked.toFixed(2);
          console.log(`\u{1F550} Session Summary: ${updates.totalHours}h worked`);
          console.log(`\u{1F4CD} GPS Distance: ${updates.endLatitude && updates.startLatitude ? "Tracked" : "Missing"}`);
        } else if (updates.endTime) {
          const existingSession = await db.select().from(workSessions).where(eq(workSessions.id, id)).limit(1);
          if (existingSession.length > 0 && existingSession[0].startTime) {
            const startTime = new Date(existingSession[0].startTime);
            const endTime = new Date(updates.endTime);
            const diffMs = endTime.getTime() - startTime.getTime();
            const hoursWorked = diffMs / (1e3 * 60 * 60);
            updates.totalHours = hoursWorked.toFixed(2);
            console.log(`\u{1F550} Session Complete: ${updates.totalHours}h worked`);
          }
        }
        const [session] = await db.update(workSessions).set(updates).where(eq(workSessions.id, id)).returning();
        return session;
      }
      // Admin Clock Monitoring Methods
      async getActiveWorkSessions() {
        return db.select().from(workSessions).where(eq(workSessions.status, "active")).orderBy(desc(workSessions.startTime));
      }
      async getAllActiveSessions() {
        return db.select().from(workSessions).where(eq(workSessions.status, "active"));
      }
      async getRecentClockActivities() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
        const recentSessions = await db.select().from(workSessions).orderBy(desc(workSessions.startTime)).limit(50);
        const activities = [];
        for (const session of recentSessions) {
          const sessionStartTime = new Date(session.startTime);
          if (sessionStartTime.getTime() >= oneDayAgo.getTime()) {
            activities.push({
              id: `${session.id}-in`,
              contractorName: session.contractorName,
              activity: "clock_in",
              timestamp: session.startTime,
              location: session.jobSiteLocation,
              sessionId: session.id,
              actualTime: sessionStartTime.toLocaleString("en-GB", {
                timeZone: "Europe/London",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              }),
              fullDateTime: sessionStartTime.toLocaleString("en-GB", {
                timeZone: "Europe/London",
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            });
            if (session.status === "completed" && session.endTime) {
              const sessionEndTime = new Date(session.endTime);
              if (sessionEndTime.getTime() >= oneDayAgo.getTime()) {
                activities.push({
                  id: `${session.id}-out`,
                  contractorName: session.contractorName,
                  activity: "clock_out",
                  timestamp: session.endTime,
                  location: session.jobSiteLocation,
                  sessionId: session.id,
                  totalHours: session.totalHours,
                  actualTime: sessionEndTime.toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  }),
                  fullDateTime: sessionEndTime.toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })
                });
              }
            }
          }
        }
        return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      async getTodayWorkSessions() {
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const allSessions = await db.select().from(workSessions).orderBy(desc(workSessions.startTime));
        const todaySessions = allSessions.filter((session) => {
          const sessionDate = new Date(session.startTime);
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate.getTime() === today.getTime();
        });
        const sessionsWithHours = todaySessions.map((session) => {
          let totalHours = 0;
          if (session.endTime) {
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            const diffMs = endTime.getTime() - startTime.getTime();
            totalHours = diffMs / (1e3 * 60 * 60);
          } else {
            const startTime = new Date(session.startTime);
            const now = /* @__PURE__ */ new Date();
            const diffMs = now.getTime() - startTime.getTime();
            totalHours = diffMs / (1e3 * 60 * 60);
          }
          return {
            ...session,
            totalHours: totalHours.toFixed(2),
            status: session.endTime ? "completed" : "active"
          };
        });
        return sessionsWithHours;
      }
      // Get authentic pay rate from database - Mandatory Rule #2: DATA INTEGRITY
      async getContractorPayRate(contractorName) {
        try {
          const [contractor] = await db.select().from(contractorApplications).where(sql2`CONCAT(${contractorApplications.firstName}, ' ', ${contractorApplications.lastName}) = ${contractorName}`).limit(1);
          if (contractor?.adminPayRate) {
            const rate = parseFloat(contractor.adminPayRate);
            console.log(`\u{1F4B0} Authentic pay rate for ${contractorName}: \xA3${rate.toFixed(2)}/hour`);
            return rate;
          }
          console.log(`\u26A0\uFE0F No pay rate found for ${contractorName} - using system default`);
          return 25;
        } catch (error) {
          console.error(`\u274C Error getting pay rate for ${contractorName}:`, error);
          return 25;
        }
      }
      async getFirstMorningClockIn(contractorName) {
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [session] = await db.select().from(workSessions).where(
          like(workSessions.contractorName, `%${contractorName}%`)
        ).orderBy(workSessions.startTime).limit(1);
        return session;
      }
      async getWorkSessionsForWeek(startDate, endDate) {
        console.log(`\u{1F5D3}\uFE0F Fetching work sessions between ${startDate.toDateString()} and ${endDate.toDateString()}`);
        const allSessions = await db.select().from(workSessions).orderBy(desc(workSessions.startTime));
        const weekSessions = allSessions.filter((session) => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= startDate && sessionDate <= endDate;
        });
        console.log(`\u{1F4CA} Found ${weekSessions.length} sessions in the specified week range`);
        return weekSessions;
      }
      // Money and GPS calculation helper method
      async calculateEarnings(contractorName, startTime, endTime, hoursWorked) {
        const payRate = await this.getContractorPayRate(contractorName);
        const baseRate = payRate || 25;
        const dayOfWeek = startTime.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const overtimeMultiplier = isWeekend ? 1.5 : 1;
        const hourlyRate = baseRate * overtimeMultiplier;
        const grossEarnings = hoursWorked * hourlyRate;
        const startHour = startTime.getHours();
        const startMinute = startTime.getMinutes();
        const clockInTime = startHour + startMinute / 60;
        const lateThreshold = 8 + 15 / 60;
        let punctualityDeduction = 0;
        if (clockInTime > lateThreshold) {
          const lateMinutes = (clockInTime - lateThreshold) * 60;
          punctualityDeduction = Math.min(lateMinutes * 0.5, 50);
        }
        const cisRate = 0.3;
        const cisDeduction = grossEarnings * cisRate;
        const beforeMinimum = grossEarnings - punctualityDeduction - cisDeduction;
        const netEarnings = Math.max(beforeMinimum, 100);
        console.log(`\u{1F4B0} Earnings Breakdown:`);
        console.log(`   - Hours: ${hoursWorked.toFixed(2)}h at \xA3${hourlyRate.toFixed(2)}/h${isWeekend ? " (weekend overtime)" : ""}`);
        console.log(`   - Gross: \xA3${grossEarnings.toFixed(2)}`);
        console.log(`   - Punctuality deduction: \xA3${punctualityDeduction.toFixed(2)}`);
        console.log(`   - CIS deduction: \xA3${cisDeduction.toFixed(2)}`);
        console.log(`   - Net earnings: \xA3${netEarnings.toFixed(2)}`);
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
      async getAdminSettings() {
        const settings = await db.select().from(adminSettings);
        console.log("\u2699\uFE0F Retrieved admin settings:", settings.length);
        return settings;
      }
      async getAdminSetting(key) {
        const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, key));
        console.log("\u2699\uFE0F Retrieved admin setting:", key, setting?.settingValue);
        return setting;
      }
      async setAdminSetting(setting) {
        const existing = await this.getAdminSetting(setting.settingKey);
        if (existing) {
          const [updated] = await db.update(adminSettings).set({
            settingValue: setting.settingValue,
            updatedBy: setting.updatedBy,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(adminSettings.settingKey, setting.settingKey)).returning();
          console.log("\u2699\uFE0F Updated admin setting:", setting.settingKey);
          return updated;
        } else {
          const [created] = await db.insert(adminSettings).values(setting).returning();
          console.log("\u2699\uFE0F Created admin setting:", setting.settingKey);
          return created;
        }
      }
      async updateAdminSetting(key, value, updatedBy) {
        const [updated] = await db.update(adminSettings).set({
          settingValue: value,
          updatedBy,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(adminSettings.settingKey, key)).returning();
        console.log("\u2699\uFE0F Updated admin setting:", key, "to:", value);
        return updated;
      }
      // Stats
      async getStats() {
        const allJobs = await db.select().from(jobs);
        const allContractors = await db.select().from(contractors);
        return {
          totalJobs: allJobs.length,
          pendingJobs: allJobs.filter((job) => job.status === "pending").length,
          completedJobs: allJobs.filter((job) => job.status === "completed").length,
          activeContractors: allContractors.filter(
            (contractor) => contractor.status === "available" || contractor.status === "busy"
          ).length
        };
      }
      // Contractor Reports
      async createContractorReport(insertReport) {
        const [report] = await db.insert(contractorReports).values(insertReport).returning();
        console.log("\u{1F4DD} Created contractor report:", report.id, "by", report.contractorName);
        return report;
      }
      async getContractorReports() {
        return db.select().from(contractorReports).orderBy(desc(contractorReports.createdAt));
      }
      // Admin Inspections
      async createAdminInspection(insertInspection) {
        const [inspection] = await db.insert(adminInspections).values(insertInspection).returning();
        console.log("\u{1F4CB} Created admin inspection:", inspection.id, "by", inspection.inspectorName);
        return inspection;
      }
      async getAdminInspections() {
        return db.select().from(adminInspections).orderBy(desc(adminInspections.createdAt));
      }
      async getAdminInspectionsByAssignment(assignmentId) {
        return db.select().from(adminInspections).where(eq(adminInspections.assignmentId, assignmentId)).orderBy(desc(adminInspections.createdAt));
      }
      async updateAdminInspection(id, updates) {
        const [inspection] = await db.update(adminInspections).set(updates).where(eq(adminInspections.id, id)).returning();
        console.log("\u{1F4CB} Updated admin inspection:", id);
        return inspection;
      }
      // Inspection Notifications for milestone triggers
      async createInspectionNotification(insertNotification) {
        const [notification] = await db.insert(inspectionNotifications).values(insertNotification).returning();
        console.log("\u{1F6A8} Inspection notification created:", notification.notificationType, "for", notification.contractorName);
        return notification;
      }
      async getInspectionNotifications() {
        return db.select().from(inspectionNotifications).orderBy(desc(inspectionNotifications.createdAt));
      }
      async getPendingInspectionNotifications() {
        return db.select().from(inspectionNotifications).where(and(
          eq(inspectionNotifications.inspectionCompleted, false),
          eq(inspectionNotifications.notificationSent, true)
        )).orderBy(desc(inspectionNotifications.createdAt));
      }
      async completeInspectionNotification(id) {
        const [notification] = await db.update(inspectionNotifications).set({
          inspectionCompleted: true,
          completedAt: /* @__PURE__ */ new Date()
        }).where(eq(inspectionNotifications.id, id)).returning();
        console.log("\u2705 Inspection notification completed:", id);
        return notification;
      }
      // Check if inspection notification already exists for milestone
      async getInspectionNotificationByAssignmentAndType(assignmentId, notificationType) {
        const [notification] = await db.select().from(inspectionNotifications).where(and(
          eq(inspectionNotifications.assignmentId, assignmentId),
          eq(inspectionNotifications.notificationType, notificationType)
        ));
        return notification;
      }
      async deleteInspectionNotification(id) {
        const result = await db.delete(inspectionNotifications).where(eq(inspectionNotifications.id, id));
        console.log("\u{1F5D1}\uFE0F Deleted inspection notification:", id, "Affected rows:", result.rowCount);
        return result.rowCount > 0;
      }
      // COMPLETE CLEANUP METHODS - Following MANDATORY RULE 1: Fix broken data persistence
      async getAllJobAssignments() {
        const assignments = await db.select().from(jobAssignments);
        console.log(`\u{1F4CB} Fetching all job assignments: ${assignments.length} found`);
        return assignments;
      }
      async deleteAllInspectionNotifications() {
        const result = await db.delete(inspectionNotifications);
        console.log("\u{1F5D1}\uFE0F Deleted all inspection notifications - Affected rows:", result.rowCount);
      }
      async deleteAllContractorReports() {
        const result = await db.delete(contractorReports);
        console.log("\u{1F5D1}\uFE0F Deleted all contractor reports - Affected rows:", result.rowCount);
      }
      async deleteAllAdminInspections() {
        const result = await db.delete(adminInspections);
        console.log("\u{1F5D1}\uFE0F Deleted all admin inspections - Affected rows:", result.rowCount);
      }
      // Task Progress Methods
      async getTaskProgress(contractorName, assignmentId) {
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
          }).from(taskProgress).where(and(
            eq(taskProgress.contractorName, contractorName),
            eq(taskProgress.assignmentId, assignmentId)
          ));
          console.log(`\u{1F4CB} Retrieved ${progress.length} task progress items for ${contractorName} assignment ${assignmentId}`);
          return progress;
        } catch (error) {
          console.error("Error fetching task progress:", error);
          return [];
        }
      }
      async createTaskProgress(newTaskProgress) {
        const [progress] = await db.insert(taskProgress).values(newTaskProgress).returning();
        console.log(`\u2705 Created task progress: ${progress.taskId} for ${progress.contractorName}`);
        return progress;
      }
      async updateTaskProgress(id, updates) {
        const [progress] = await db.update(taskProgress).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(taskProgress.id, id)).returning();
        console.log(`\u{1F504} Updated task progress: ${id}`);
        return progress;
      }
      async updateTaskCompletion(contractorName, assignmentId, taskId, completed) {
        const [progress] = await db.update(taskProgress).set({
          completed,
          completedAt: completed ? /* @__PURE__ */ new Date() : null,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(and(
          eq(taskProgress.contractorName, contractorName),
          eq(taskProgress.assignmentId, assignmentId),
          eq(taskProgress.taskId, taskId)
        )).returning();
        console.log(`\u2705 Task ${taskId} marked as ${completed ? "completed" : "incomplete"} for ${contractorName}`);
        return progress;
      }
      // Task Inspection Results Methods
      async createTaskInspectionResult(inspection) {
        const [result] = await db.insert(taskInspectionResults).values(inspection).returning();
        console.log(`\u{1F4CB} Created task inspection result: ${result.taskName} - ${result.inspectionStatus}`);
        return result;
      }
      async getTaskInspectionResults(contractorName) {
        const results = await db.select().from(taskInspectionResults).where(eq(taskInspectionResults.contractorName, contractorName)).orderBy(desc(taskInspectionResults.inspectedAt));
        console.log(`\u{1F4CB} Retrieved ${results.length} task inspection results for ${contractorName}`);
        return results;
      }
      async markTaskInspectionAsViewed(id) {
        const [result] = await db.update(taskInspectionResults).set({
          contractorViewed: true,
          contractorViewedAt: /* @__PURE__ */ new Date()
        }).where(eq(taskInspectionResults.id, id)).returning();
        console.log(`\u{1F441}\uFE0F Marked task inspection ${id} as viewed`);
        return result;
      }
      async markInspectionResolvedByContractor(inspectionId, contractorName, fixNotes) {
        const [result] = await db.update(adminInspections).set({
          status: "contractor_fixed",
          nextActions: fixNotes ? `Contractor fixed: ${fixNotes}` : "Contractor marked as fixed - awaiting admin re-inspection"
        }).where(eq(adminInspections.id, inspectionId)).returning();
        console.log(`\u2705 Marked inspection ${inspectionId} as resolved by contractor ${contractorName}`);
        return result;
      }
      async getContractorFixedInspections() {
        const fixedInspections = await db.select().from(adminInspections).where(eq(adminInspections.status, "contractor_fixed")).orderBy(desc(adminInspections.createdAt));
        console.log(`\u{1F4CB} Retrieved ${fixedInspections.length} contractor-fixed inspections for admin review`);
        return fixedInspections;
      }
      async approveContractorFix(inspectionId, adminName) {
        const [result] = await db.update(adminInspections).set({
          status: "approved",
          nextActions: `Admin approved contractor fix on ${(/* @__PURE__ */ new Date()).toISOString()}`
        }).where(eq(adminInspections.id, inspectionId)).returning();
        console.log(`\u2705 Admin ${adminName} approved contractor fix for inspection ${inspectionId}`);
        return result;
      }
      async getAdminInspectionsForContractor(contractorName) {
        const assignments = await db.select().from(jobAssignments).where(eq(jobAssignments.contractorName, contractorName));
        if (assignments.length === 0) {
          return [];
        }
        const assignmentIds = assignments.map((a) => a.id);
        const inspections = await db.select().from(adminInspections).where(inArray(adminInspections.assignmentId, assignmentIds)).orderBy(desc(adminInspections.createdAt));
        console.log(`\u{1F4CB} Retrieved ${inspections.length} admin inspections for contractor ${contractorName}`);
        return inspections;
      }
      // Temporary Departures - track contractor movements during work hours
      async getActiveDeparture(contractorName, sessionId) {
        try {
          console.log(`\u{1F50D} Checking for active departure: ${contractorName} session ${sessionId}`);
          return null;
        } catch (error) {
          console.error("\u274C Error getting active departure:", error);
          return null;
        }
      }
      async createTemporaryDeparture(departure) {
        try {
          console.log(`\u{1F4DD} Creating temporary departure record for ${departure.contractorName}`);
          return { id: "temp-departure-" + Date.now(), ...departure };
        } catch (error) {
          console.error("\u274C Error creating temporary departure:", error);
          throw error;
        }
      }
      async updateTemporaryDeparture(id, departure) {
        try {
          console.log(`\u{1F4DD} Updating temporary departure ${id} with return time`);
          return { id, ...departure };
        } catch (error) {
          console.error("\u274C Error updating temporary departure:", error);
          throw error;
        }
      }
      // Weekly Cash Flow Tracking Implementation - MANDATORY RULE: AUTHENTIC DATA ONLY
      async getProjectMasters() {
        console.log("\u{1F4CB} Fetching project masters from database");
        return await db.select().from(projectMaster).orderBy(desc(projectMaster.createdAt));
      }
      async createProjectMaster(project) {
        console.log("\u{1F195} Creating new project master:", project.projectName);
        const [created] = await db.insert(projectMaster).values(project).returning();
        return created;
      }
      async updateProjectMaster(id, updates) {
        console.log("\u{1F504} Updating project master:", id);
        const [updated] = await db.update(projectMaster).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(projectMaster.id, id)).returning();
        return updated;
      }
      async getProjectCashflowWeekly(projectId) {
        console.log("\u{1F4CA} Fetching weekly cashflow data", projectId ? `for project: ${projectId}` : "for all projects");
        let query = db.select().from(projectCashflowWeekly);
        if (projectId) {
          query = query.where(eq(projectCashflowWeekly.projectId, projectId));
        }
        return await query.orderBy(desc(projectCashflowWeekly.weekStartDate));
      }
      async createProjectCashflowWeekly(cashflow) {
        console.log("\u{1F4B0} Creating weekly cashflow record:", cashflow.projectName, cashflow.weekStartDate);
        const [created] = await db.insert(projectCashflowWeekly).values(cashflow).returning();
        return created;
      }
      async updateProjectCashflowWeekly(id, updates) {
        console.log("\u{1F504} Updating weekly cashflow record:", id);
        const [updated] = await db.update(projectCashflowWeekly).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(projectCashflowWeekly.id, id)).returning();
        return updated;
      }
      async getMaterialPurchases(projectId, weekStart) {
        console.log("\u{1F6D2} Fetching material purchases", projectId ? `for project: ${projectId}` : "for all projects");
        let query = db.select().from(materialPurchases);
        if (projectId && weekStart) {
          query = query.where(and(
            eq(materialPurchases.projectId, projectId),
            eq(materialPurchases.purchaseWeek, weekStart)
          ));
        } else if (projectId) {
          query = query.where(eq(materialPurchases.projectId, projectId));
        }
        return await query.orderBy(desc(materialPurchases.createdAt));
      }
      async createMaterialPurchase(purchase) {
        console.log("\u{1F6D2} Creating material purchase record:", purchase.supplierName, purchase.totalCost);
        const [created] = await db.insert(materialPurchases).values(purchase).returning();
        return created;
      }
      async calculateWeeklyLabourCosts(projectId, weekStart, weekEnd) {
        console.log("\u{1F4BC} Calculating weekly labour costs for project:", projectId, "week:", weekStart, "to", weekEnd);
        const sessions = await db.select().from(workSessions).where(and(
          sql2`DATE(${workSessions.startTime}) >= ${weekStart}`,
          sql2`DATE(${workSessions.startTime}) <= ${weekEnd}`,
          eq(workSessions.status, "completed")
        ));
        let totalLabourCost = 0;
        for (const session of sessions) {
          if (session.totalHours && session.contractorName) {
            const payRate = await this.getContractorPayRate(session.contractorName);
            const timeParts = session.totalHours.split(":");
            const hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600;
            const sessionCost = hours * payRate;
            totalLabourCost += sessionCost;
            console.log(`  \u{1F4B0} ${session.contractorName}: ${hours.toFixed(2)}h \xD7 \xA3${payRate}/h = \xA3${sessionCost.toFixed(2)}`);
          }
        }
        console.log(`\u{1F4CA} Total weekly labour cost: \xA3${totalLabourCost.toFixed(2)}`);
        return totalLabourCost;
      }
    };
    storage = new DatabaseStorage();
  }
});

// server-cashflow/location-tracker.ts
var location_tracker_exports = {};
__export(location_tracker_exports, {
  contractorLocations: () => contractorLocations,
  getAllContractorLocations: () => getAllContractorLocations,
  getContractorLocation: () => getContractorLocation,
  removeContractorLocation: () => removeContractorLocation,
  updateContractorLocation: () => updateContractorLocation
});
function updateContractorLocation(contractorName, latitude, longitude) {
  contractorLocations.set(contractorName, {
    latitude,
    longitude,
    lastUpdate: /* @__PURE__ */ new Date()
  });
  console.log(`\u{1F4CD} Location updated for ${contractorName}: ${latitude}, ${longitude}`);
}
function getContractorLocation(contractorName) {
  return contractorLocations.get(contractorName);
}
function getAllContractorLocations() {
  return contractorLocations;
}
function removeContractorLocation(contractorName) {
  contractorLocations.delete(contractorName);
  console.log(`\u{1F5D1}\uFE0F Location tracking removed for ${contractorName}`);
}
var contractorLocations;
var init_location_tracker = __esm({
  "server-cashflow/location-tracker.ts"() {
    "use strict";
    contractorLocations = /* @__PURE__ */ new Map();
  }
});

// server-cashflow/progress-monitor.ts
var progress_monitor_exports = {};
__export(progress_monitor_exports, {
  ProgressMonitor: () => ProgressMonitor,
  progressMonitor: () => progressMonitor
});
var storage2, ProgressMonitor, progressMonitor;
var init_progress_monitor = __esm({
  "server-cashflow/progress-monitor.ts"() {
    "use strict";
    init_database_storage();
    storage2 = new DatabaseStorage();
    ProgressMonitor = class {
      // Calculate completion percentage for a job assignment
      async calculateJobProgress(assignmentId) {
        try {
          const assignment = await storage2.getJobAssignment(assignmentId);
          if (!assignment) {
            console.log("\u26A0\uFE0F Assignment not found for progress calculation:", assignmentId);
            return 0;
          }
          const uploadedJobs = await storage2.getJobs();
          console.log(`\u{1F50D} Looking for job match for assignment: ${assignment.hbxlJob} at ${assignment.workLocation}`);
          console.log(`\u{1F50D} Available uploaded jobs:`, uploadedJobs.map((j) => ({ name: j.name, postcode: j.postcode, address: j.address })));
          const job = uploadedJobs.find((j) => {
            if (j.name === assignment.hbxlJob) return true;
            if (j.name && j.name.toLowerCase().includes("xavier") && assignment.hbxlJob && (assignment.hbxlJob.toLowerCase().includes("xavier") || assignment.hbxlJob.toLowerCase().includes("flat"))) {
              return true;
            }
            if (j.postcode && j.postcode === assignment.workLocation || j.address && assignment.workLocation && j.address.includes(assignment.workLocation)) {
              return true;
            }
            return false;
          });
          if (!job || !job.phaseTaskData) {
            console.log("\u26A0\uFE0F No task data found for job:", assignment.hbxlJob);
            return 0;
          }
          let totalTasks = 0;
          let completedTasks = 0;
          const phaseData = JSON.parse(job.phaseTaskData);
          for (const [phaseName, tasks] of Object.entries(phaseData)) {
            if (Array.isArray(tasks)) {
              for (const task of tasks) {
                totalTasks++;
                if (task.completed === true || task.progress === 100) {
                  completedTasks++;
                }
              }
            }
          }
          const progressPercentage = totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0;
          console.log(`\u{1F4CA} Job progress calculated: ${completedTasks}/${totalTasks} tasks (${progressPercentage}%)`);
          return progressPercentage;
        } catch (error) {
          console.error("\u274C Error calculating job progress:", error);
          return 0;
        }
      }
      // Check and trigger inspection notifications based on progress milestones
      async checkProgressMilestones(assignmentId) {
        try {
          const progress = await this.calculateJobProgress(assignmentId);
          const assignment = await storage2.getJobAssignment(assignmentId);
          if (!assignment) return;
          if (progress >= 50) {
            await this.triggerInspectionIfNeeded(assignmentId, assignment.contractorName, "50_percent_ready");
          }
          if (progress >= 100) {
            await this.triggerInspectionIfNeeded(assignmentId, assignment.contractorName, "100_percent_ready");
          }
        } catch (error) {
          console.error("\u274C Error checking progress milestones:", error);
        }
      }
      // Trigger inspection notification if not already exists
      async triggerInspectionIfNeeded(assignmentId, contractorName, notificationType) {
        try {
          const existingNotification = await storage2.getInspectionNotificationByAssignmentAndType(assignmentId, notificationType);
          if (existingNotification) {
            console.log(`\u2139\uFE0F Inspection notification already exists for ${notificationType}:`, assignmentId);
            return;
          }
          const notification = await storage2.createInspectionNotification({
            assignmentId,
            contractorName,
            notificationType,
            notificationSent: true,
            // Immediately mark as sent since this is an automatic trigger
            inspectionCompleted: false
          });
          console.log(`\u{1F6A8} ${notificationType.replace("_", " ")} inspection triggered for ${contractorName}`);
        } catch (error) {
          console.error("\u274C Error triggering inspection notification:", error);
        }
      }
      // Manually trigger progress check (called when task progress is updated)
      async updateTaskProgress(assignmentId, taskId, completed) {
        try {
          console.log(`\u{1F4DD} Task progress updated: ${taskId} = ${completed ? "completed" : "pending"}`);
          await this.checkProgressMilestones(assignmentId);
        } catch (error) {
          console.error("\u274C Error updating task progress:", error);
        }
      }
      // Get all pending inspections for admin dashboard - AUTHENTIC CSV DATA ONLY
      async getPendingInspections() {
        try {
          const notifications = await storage2.getPendingInspectionNotifications();
          const inspectionsWithDetails = await Promise.all(
            notifications.map(async (notification) => {
              const assignment = await storage2.getJobAssignment(notification.assignmentId);
              if (!assignment) {
                console.warn(`\u274C Assignment not found for inspection: ${notification.assignmentId}`);
                return null;
              }
              return {
                id: notification.id,
                assignmentId: notification.assignmentId,
                contractorName: notification.contractorName,
                notificationType: notification.notificationType,
                jobTitle: assignment.hbxlJob || "Data Missing from CSV",
                jobLocation: assignment.workLocation || "Data Missing from CSV",
                createdAt: notification.createdAt,
                inspectionType: notification.notificationType === "50_percent_ready" ? "50% Progress Check" : "100% Final Inspection"
              };
            })
          );
          const validInspections = inspectionsWithDetails.filter((inspection) => inspection !== null);
          console.log(`\u{1F4CB} Returning ${validInspections.length} inspections with AUTHENTIC CSV data only`);
          return validInspections;
        } catch (error) {
          console.error("\u274C Error getting pending inspections:", error);
          return [];
        }
      }
    };
    progressMonitor = new ProgressMonitor();
  }
});

// server-cashflow/storage.ts
var storage_exports = {};
__export(storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  storage: () => storage4
});
var storage4;
var init_storage = __esm({
  "server-cashflow/storage.ts"() {
    "use strict";
    init_database_storage();
    init_database_storage();
    storage4 = new DatabaseStorage();
  }
});

// server-cashflow/index.ts
import express2 from "express";

// server-cashflow/routes.ts
init_database_storage();
init_schema();
import { createServer } from "http";

// server-cashflow/telegram.ts
import fetch2 from "node-fetch";
var TelegramService = class {
  botToken;
  baseUrl;
  constructor() {
    this.botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    console.log("\u{1F916} Telegram Service initialized with token:", this.botToken ? "Available" : "Missing");
    console.log("\u{1F517} Base URL:", this.baseUrl);
  }
  // Send job assignment notification
  async sendJobAssignment(params) {
    try {
      console.log("\u{1F4F1} Sending Telegram job assignment notification...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating notification");
        return { success: true, simulated: true };
      }
      let chatId = "7617462316";
      if (params.contractorName.toLowerCase().includes("marius")) {
        chatId = "8006717361";
      } else if (params.contractorName.toLowerCase().includes("dalwayne")) {
        chatId = "8016744652";
      } else if (params.contractorName.toLowerCase().includes("earl")) {
        chatId = "6792554033";
      } else if (params.contractorName.toLowerCase().includes("muhammed") || params.contractorName.toLowerCase().includes("midou")) {
        chatId = "5209713845";
      }
      const message = this.formatJobAssignmentMessage(params);
      const url = `${this.baseUrl}/sendMessage`;
      console.log("\u{1F4F1} Telegram API URL:", url);
      console.log("\u{1F4F1} Chat ID:", chatId);
      console.log("\u{1F4F1} Message length:", message.length);
      const response = await fetch2(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Telegram API error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Telegram message sent successfully:", result);
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Telegram service error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Send welcome message for contractor onboarding
  async sendWelcomeMessage(contractorName, phone) {
    try {
      console.log("\u{1F4F1} Sending welcome Telegram message...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating welcome message");
        return { success: true, simulated: true };
      }
      const chatId = "7617462316";
      const message = `
\u{1F389} <b>Welcome to JobFlow, ${contractorName}!</b>

Your contractor account has been set up successfully.

\u{1F4F1} Phone: ${phone}
\u{1F527} You'll receive job assignments and updates through this bot.

To get started, make sure to:
\u2705 Keep notifications enabled
\u2705 Contact admin if you have any questions

Ready to receive your first job assignment!
      `.trim();
      const response = await fetch2(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Telegram welcome message error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Telegram welcome message sent:", result);
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Welcome message error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  formatJobAssignmentMessage(params) {
    const { contractorName, phone, hbxlJob, buildPhases, workLocation, startDate } = params;
    const phasesText = Array.isArray(buildPhases) && buildPhases.length > 0 ? buildPhases.map((phase) => `\u2022 ${phase}`).join("\n") : "\u2022 No phases specified";
    return `\u{1F528} JOB ASSIGNMENT - ${hbxlJob}

\u{1F464} Contractor: ${contractorName}
\u{1F4F1} Phone: ${phone}
\u{1F4CD} Location: ${workLocation}
\u{1F4C5} Start Date: ${startDate}

\u{1F3D7}\uFE0F Build Phases:
${phasesText}

Please confirm receipt and let us know if you have any questions!

Good luck with the project! \u{1F4AA}`;
  }
  // Generate unique contractor ID and send onboarding form
  async sendOnboardingForm(contractorName, contractorPhone) {
    try {
      console.log("\u{1F4F1} Sending onboarding form to contractor...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating onboarding form");
        return { success: true, simulated: true };
      }
      const contractorId = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      let chatId = "7617462316";
      if (contractorName.toLowerCase().includes("marius")) {
        chatId = "8006717361";
      } else if (contractorName.toLowerCase().includes("dalwayne")) {
        chatId = "8016744652";
      } else if (contractorName.toLowerCase().includes("earl")) {
        chatId = "6792554033";
      } else if (contractorName.toLowerCase().includes("muhammed") || contractorName.toLowerCase().includes("midou")) {
        chatId = "5209713845";
      }
      const message = `\u{1F3AF} <b>New Contractor Onboarding Required</b>

\u{1F464} Contractor: ${contractorName}
${contractorPhone ? `\u{1F4F1} Phone: ${contractorPhone}` : ""}
\u{1F194} ID: <code>${contractorId}</code>

\u{1F4CB} <b>Please complete your contractor onboarding form:</b>
\u{1F446} Click the link below to access your personalized form

\u{1F517} <a href="https://${process.env.REPLIT_DEV_DOMAIN || "replit.dev"}/contractor-onboarding?id=${contractorId}">Complete Onboarding Form</a>

\u26A0\uFE0F <b>Important:</b>
\u2022 Fill out all 6 steps completely
\u2022 Upload required documents (Passport, UTR, CIS, Insurance)
\u2022 Submit form for admin review
\u2022 You'll receive confirmation once approved

Need help? Reply to this message! \u{1F4AC}`;
      const url = `${this.baseUrl}/sendMessage`;
      console.log("\u{1F4F1} Onboarding URL:", url);
      console.log("\u{1F4F1} Chat ID:", chatId);
      console.log("\u{1F4F1} Message length:", message.length);
      const response = await fetch2(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Telegram onboarding form error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Onboarding form sent with ID:", contractorId);
      return {
        success: true,
        messageId: result.message_id,
        contractorId
      };
    } catch (error) {
      console.error("\u274C Onboarding form error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Send hello message from contractor
  async sendContractorHello(contractorName = "James Carpenter") {
    try {
      console.log("\u{1F4F1} Sending contractor hello message...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating hello message");
        return { success: true, simulated: true };
      }
      const chatId = "7617462316";
      const message = `\u{1F44B} Hello from ${contractorName}!

\u{1F527} I'm ready to start work today
\u{1F4CD} Currently at job site
\u23F0 Timer system is working perfectly
\u{1F4F1} All systems are ready for GPS tracking

Looking forward to today's assignments! \u{1F4AA}`;
      const response = await fetch2(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Telegram hello message error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Contractor hello message sent:", result);
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Hello message error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Send custom message to specific chat ID
  async sendCustomMessage(chatId, message) {
    try {
      console.log("\u{1F4F1} Sending custom Telegram message...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating message");
        return { success: true, simulated: true };
      }
      const response = await fetch2(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Telegram custom message error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Custom message sent successfully:", result);
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Custom message error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Get recent messages and auto-register new contractor Telegram IDs
  async getRecentMessages(limit = 10) {
    try {
      if (!this.botToken) {
        return { success: false, error: "No bot token provided" };
      }
      console.log("\u{1F4E5} Checking for recent messages...");
      const response = await fetch2(`${this.baseUrl}/getUpdates?limit=${limit}`);
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Failed to get updates:", response.status, errorData);
        return { success: false, error: `Failed to get updates: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Retrieved updates:", result);
      if (result.ok && result.result.length > 0) {
        const messages = result.result.map((update) => ({
          messageId: update.message?.message_id,
          from: update.message?.from,
          text: update.message?.text,
          date: new Date(update.message?.date * 1e3),
          chatId: update.message?.chat?.id
        })).filter((msg) => msg.text);
        await this.autoRegisterContractorTelegramIds(messages);
        return {
          success: true,
          messages,
          totalUpdates: result.result.length
        };
      }
      return {
        success: true,
        messages: [],
        totalUpdates: 0
      };
    } catch (error) {
      console.error("\u274C Error getting messages:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Auto-register new contractor Telegram IDs when they message the bot
  async autoRegisterContractorTelegramIds(messages) {
    try {
      const { DatabaseStorage: DatabaseStorage2 } = await Promise.resolve().then(() => (init_database_storage(), database_storage_exports));
      const storage5 = new DatabaseStorage2();
      const knownIds = ["8006717361", "8016744652", "6792554033", "5209713845"];
      for (const message of messages) {
        const chatId = message.chatId?.toString();
        const firstName = message.from?.first_name;
        if (chatId && firstName && !knownIds.includes(chatId)) {
          console.log(`\u{1F195} New contractor detected: ${firstName} (ID: ${chatId})`);
          const contractors2 = await storage5.getContractors();
          const matchingContractor = contractors2.find(
            (c) => c.name.toLowerCase().includes(firstName.toLowerCase())
          );
          if (matchingContractor) {
            console.log(`\u{1F517} Linking ${firstName} to contractor: ${matchingContractor.name}`);
            await storage5.updateContractor(matchingContractor.id, {
              telegramId: chatId
            });
            knownIds.push(chatId);
          } else {
            console.log(`\u26A0\uFE0F No matching contractor found for ${firstName}`);
          }
        }
      }
    } catch (error) {
      console.error("\u274C Error auto-registering Telegram IDs:", error);
    }
  }
  // Test bot connection
  async testConnection() {
    try {
      if (!this.botToken) {
        return { success: false, error: "No bot token provided" };
      }
      console.log("\u{1F9EA} Testing Telegram bot connection...");
      const response = await fetch2(`${this.baseUrl}/getMe`);
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Bot connection test failed:", response.status, errorData);
        return { success: false, error: `Connection test failed: ${response.status}` };
      }
      const botInfo = await response.json();
      console.log("\u2705 Bot connection successful:", botInfo.result);
      return {
        success: true,
        botInfo: botInfo.result
      };
    } catch (error) {
      console.error("\u274C Bot connection error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Send approval notification to contractor
  async sendApprovalNotification(contractorData) {
    try {
      console.log("\u{1F4F1} Sending approval notification to contractor...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating approval notification");
        return { success: true, simulated: true };
      }
      const chatId = contractorData.telegramId || "8016744652";
      const payRateInfo = contractorData.adminPayRate ? `\u{1F4B0} <b>Pay Rate:</b> \xA3${contractorData.adminPayRate}/hour` : "";
      const message = `
\u2705 <b>APPLICATION APPROVED!</b>

\u{1F389} Congratulations ${contractorData.firstName} ${contractorData.lastName}!

Your contractor application has been <b>APPROVED</b> by our team.

\u{1F464} <b>Trade:</b> ${contractorData.primaryTrade}
\u{1F4E7} <b>Email:</b> ${contractorData.email}
\u{1F4F1} <b>Phone:</b> ${contractorData.phone}
${payRateInfo}

\u{1F680} Welcome to our contractor network! You'll start receiving job assignments soon.

\u{1F4DE} If you have any questions, please contact us.
`;
      const response = await fetch2(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Approval notification error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Approval notification sent successfully");
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Approval notification error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
  // Send rejection notification to contractor
  async sendRejectionNotification(contractorData) {
    try {
      console.log("\u{1F4F1} Sending rejection notification to contractor...");
      if (!this.botToken) {
        console.log("\u26A0\uFE0F No bot token - simulating rejection notification");
        return { success: true, simulated: true };
      }
      const chatId = "7617462316";
      const reasonInfo = contractorData.rejectionReason ? `
\u{1F4CB} <b>Reason:</b> ${contractorData.rejectionReason}` : "";
      const message = `
\u274C <b>APPLICATION UPDATE</b>

Dear ${contractorData.firstName} ${contractorData.lastName},

Unfortunately, your contractor application has been <b>NOT APPROVED</b> at this time.

\u{1F464} <b>Trade:</b> ${contractorData.primaryTrade}
\u{1F4E7} <b>Email:</b> ${contractorData.email}
\u{1F4F1} <b>Phone:</b> ${contractorData.phone}${reasonInfo}

\u{1F504} You may reapply in the future when requirements change.

\u{1F4DE} If you have any questions, please contact us.

Thank you for your interest in our contractor network.
`;
      const response = await fetch2(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error("\u274C Rejection notification error:", response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }
      const result = await response.json();
      console.log("\u2705 Rejection notification sent successfully");
      return { success: true, messageId: result.message_id };
    } catch (error) {
      console.error("\u274C Rejection notification error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
};

// server-cashflow/routes.ts
import multer from "multer";
import * as XLSX from "xlsx";

// server-cashflow/enhanced-csv-parser.ts
function parseEnhancedCSV(lines) {
  const enhancedFormatIndex = lines.findIndex(
    (line) => line.includes("Order Date") && line.includes("Build Phase") && line.includes("Resource Description")
  );
  if (enhancedFormatIndex === -1) {
    return null;
  }
  const resources = [];
  let totalLabourCost = 0;
  let totalMaterialCost = 0;
  const phaseTaskData = {};
  const weeklyBreakdown = {};
  const phases = [];
  console.log("\u{1F3AF} Using ENHANCED CSV parsing for accounting format");
  for (let i = enhancedFormatIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 8) continue;
    const resource = {
      orderDate: parts[0] || "",
      requiredDate: parts[1] || "",
      buildPhase: parts[2] || "General",
      resourceType: parts[3] || "",
      supplier: parts[4] || "",
      description: parts[5] || "",
      quantity: parseInt(parts[7]) || 0
    };
    const priceMatch = resource.description.match(/£(\d+\.?\d*)/);
    const unitMatch = resource.description.match(/£\d+\.?\d*\/(\w+)/);
    if (priceMatch && resource.quantity > 0) {
      resource.unitPrice = parseFloat(priceMatch[1]);
      resource.unit = unitMatch ? unitMatch[1] : "Each";
      resource.totalCost = resource.unitPrice * resource.quantity;
      if (resource.resourceType.toLowerCase() === "labour") {
        totalLabourCost += resource.totalCost;
      } else if (resource.resourceType.toLowerCase() === "material") {
        totalMaterialCost += resource.totalCost;
      }
      if (resource.buildPhase && resource.buildPhase !== "General") {
        if (!phaseTaskData[resource.buildPhase]) {
          phaseTaskData[resource.buildPhase] = [];
        }
        phaseTaskData[resource.buildPhase].push({
          task: `${resource.resourceType}: ${resource.description}`,
          description: `${resource.quantity} \xD7 \xA3${resource.unitPrice} = \xA3${resource.totalCost.toFixed(2)}`,
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          totalCost: resource.totalCost,
          supplier: resource.supplier,
          orderDate: resource.orderDate,
          resourceType: resource.resourceType
        });
        if (!phases.includes(resource.buildPhase)) {
          phases.push(resource.buildPhase);
        }
      }
      if (resource.orderDate) {
        if (!weeklyBreakdown[resource.orderDate]) {
          weeklyBreakdown[resource.orderDate] = { labour: 0, material: 0, total: 0 };
        }
        const costType = resource.resourceType.toLowerCase();
        if (costType === "labour" || costType === "material") {
          weeklyBreakdown[resource.orderDate][costType] += resource.totalCost;
          weeklyBreakdown[resource.orderDate].total += resource.totalCost;
        }
      }
    }
    resources.push(resource);
  }
  console.log("\u{1F3AF} Enhanced parsing results:", {
    phases,
    resourceCount: resources.length,
    totalLabourCost,
    totalMaterialCost,
    grandTotal: totalLabourCost + totalMaterialCost,
    weeklyBreakdown
  });
  return {
    phases: phaseTaskData,
    financials: {
      totalLabour: totalLabourCost,
      totalMaterial: totalMaterialCost,
      grandTotal: totalLabourCost + totalMaterialCost,
      weeklyBreakdown
    },
    resources: resources.filter((r) => r.unitPrice !== void 0)
  };
}

// server-cashflow/routes.ts
var storage3 = new DatabaseStorage();
var upload = multer({ storage: multer.memoryStorage() });
async function registerRoutes(app2) {
  app2.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage3.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  app2.get("/api/jobs", async (req, res) => {
    try {
      const { status, search } = req.query;
      let jobs2 = await storage3.getJobs();
      if (status && status !== "") {
        jobs2 = jobs2.filter((job) => job.status === status);
      }
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        jobs2 = jobs2.filter(
          (job) => job.title.toLowerCase().includes(searchLower) || job.location.toLowerCase().includes(searchLower) || job.contractor?.name.toLowerCase().includes(searchLower)
        );
      }
      res.json(jobs2);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  app2.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage3.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });
  app2.post("/api/jobs", async (req, res) => {
    try {
      const validation = insertJobSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid job data", details: validation.error.errors });
      }
      const job = await storage3.createJob(validation.data);
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });
  app2.put("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage3.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  app2.get("/api/contractors", async (req, res) => {
    try {
      const contractors2 = await storage3.getContractors();
      res.json(contractors2);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });
  app2.post("/api/contractors", async (req, res) => {
    try {
      const validation = insertContractorSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid contractor data", details: validation.error.errors });
      }
      const contractor = await storage3.createContractor(validation.data);
      res.status(201).json(contractor);
    } catch (error) {
      console.error("Error creating contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
    }
  });
  app2.delete("/api/csv-uploads/:id", async (req, res) => {
    try {
      const uploadId = req.params.id;
      console.log("\u{1F5D1}\uFE0F COMPLETE CLEANUP starting for upload:", uploadId);
      const jobs2 = await storage3.getJobs();
      const jobsToDelete = jobs2.filter((job) => job.uploadId === uploadId);
      console.log(`\u{1F5D1}\uFE0F Found ${jobsToDelete.length} jobs to delete for upload: ${uploadId}`);
      for (const job of jobsToDelete) {
        console.log(`\u{1F5D1}\uFE0F Deleting job: ${job.id} (${job.title})`);
        await storage3.deleteJob(job.id);
      }
      const allAssignments = await storage3.getAllJobAssignments();
      console.log(`\u{1F5D1}\uFE0F Found ${allAssignments.length} total assignments to check`);
      for (const assignment of allAssignments) {
        console.log(`\u{1F5D1}\uFE0F Deleting assignment: ${assignment.id} for contractor: ${assignment.contractorName}`);
        await storage3.deleteJobAssignment(assignment.id);
      }
      await storage3.deleteAllInspectionNotifications();
      console.log("\u{1F5D1}\uFE0F Deleted all inspection notifications");
      await storage3.deleteAllContractorReports();
      console.log("\u{1F5D1}\uFE0F Deleted all contractor reports");
      await storage3.deleteAllAdminInspections();
      console.log("\u{1F5D1}\uFE0F Deleted all admin inspections");
      await storage3.deleteCsvUpload(uploadId);
      console.log("\u{1F5D1}\uFE0F Deleted CSV upload record");
      console.log("\u2705 COMPLETE CLEANUP finished - Only GPS coordinates and contractor rates remain");
      res.json({
        success: true,
        message: "Complete cleanup successful - all job data permanently removed",
        preserved: "GPS coordinates and contractor rates maintained"
      });
    } catch (error) {
      console.error("Error in complete cleanup:", error);
      res.status(500).json({ error: "Failed to complete cleanup" });
    }
  });
  app2.post("/api/upload-csv", upload.single("csvFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const csvUpload = await storage3.createCsvUpload({
        filename: req.file.originalname,
        status: "processing",
        jobsCount: "0"
      });
      let csvContent;
      if (req.file.originalname.toLowerCase().endsWith(".xlsx")) {
        console.log("\u{1F4CA} Processing Excel file:", req.file.originalname);
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        csvContent = XLSX.utils.sheet_to_csv(worksheet);
        console.log("\u{1F504} Converted Excel to CSV format");
      } else {
        csvContent = req.file.buffer.toString();
        console.log("\u{1F4C4} Processing CSV file:", req.file.originalname);
      }
      console.log("\u{1F50D} Raw Content:", csvContent.substring(0, 500) + "...");
      try {
        const lines = csvContent.split("\n").map((line) => line.trim()).filter((line) => line);
        console.log("\u{1F50D} CSV Lines:", lines.slice(0, 10));
        let jobsCreated = 0;
        let jobName = "Data Missing from CSV";
        let jobAddress = "Data Missing from CSV";
        let jobPostcode = "Data Missing from CSV";
        let jobType = "Data Missing from CSV";
        let phases = [];
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
          const line = lines[i];
          if (line.startsWith("Name,") || line.startsWith("name,")) {
            const extracted = line.substring(line.indexOf(",") + 1).replace(/,+$/, "").trim();
            jobName = extracted || "Data Missing from CSV";
          } else if (line.startsWith("Address,") || line.startsWith("Address ,")) {
            const extracted = line.substring(line.indexOf(",") + 1).replace(/,+$/, "").trim();
            jobAddress = extracted || "Data Missing from CSV";
          } else if (line.startsWith("Post code,")) {
            const extracted = line.substring(10).replace(/,+$/, "").trim().toUpperCase();
            jobPostcode = extracted || "Data Missing from CSV";
          } else if (line.startsWith("Project Type,")) {
            const extracted = line.substring(13).replace(/,+$/, "").trim();
            jobType = extracted || "Data Missing from CSV";
          }
        }
        const enhancedFormatIndex = lines.findIndex(
          (line) => line.includes("Order Date") && line.includes("Build Phase") && line.includes("Resource Description")
        );
        if (enhancedFormatIndex !== -1) {
          const resources = [];
          let totalLabourCost = 0;
          let totalMaterialCost = 0;
          const phaseTaskData = {};
          const weeklyBreakdown = {};
          console.log("\u{1F3AF} Using ENHANCED CSV parsing for accounting format");
          for (let i = enhancedFormatIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trim() === "") continue;
            const parts = line.split(",").map((p) => p.trim());
            if (parts.length < 8) continue;
            const resource = {
              orderDate: parts[0] || "",
              requiredDate: parts[1] || "",
              buildPhase: parts[2] || "General",
              resourceType: parts[3] || "",
              // Labour or Material
              supplier: parts[4] || "",
              description: parts[5] || "",
              quantity: parseInt(parts[7]) || 0
            };
            const priceMatch = resource.description.match(/£(\d+\.?\d*)/);
            const unitMatch = resource.description.match(/£\d+\.?\d*\/(\w+)/);
            if (priceMatch && resource.quantity > 0) {
              resource.unitPrice = parseFloat(priceMatch[1]);
              resource.unit = unitMatch ? unitMatch[1] : "Each";
              resource.totalCost = resource.unitPrice * resource.quantity;
              if (resource.resourceType.toLowerCase() === "labour") {
                totalLabourCost += resource.totalCost;
              } else if (resource.resourceType.toLowerCase() === "material") {
                totalMaterialCost += resource.totalCost;
              }
              if (resource.buildPhase && resource.buildPhase !== "General") {
                if (!phaseTaskData[resource.buildPhase]) {
                  phaseTaskData[resource.buildPhase] = [];
                }
                phaseTaskData[resource.buildPhase].push({
                  task: `${resource.resourceType}: ${resource.description}`,
                  description: `${resource.quantity} \xD7 \xA3${resource.unitPrice} = \xA3${resource.totalCost.toFixed(2)}`,
                  quantity: resource.quantity,
                  unitPrice: resource.unitPrice,
                  totalCost: resource.totalCost,
                  supplier: resource.supplier,
                  orderDate: resource.orderDate,
                  resourceType: resource.resourceType
                });
                phases.push(resource.buildPhase);
              }
              if (resource.orderDate) {
                if (!weeklyBreakdown[resource.orderDate]) {
                  weeklyBreakdown[resource.orderDate] = { labour: 0, material: 0, total: 0 };
                }
                const costType = resource.resourceType.toLowerCase();
                if (costType === "labour" || costType === "material") {
                  weeklyBreakdown[resource.orderDate][costType] += resource.totalCost;
                  weeklyBreakdown[resource.orderDate].total += resource.totalCost;
                }
              }
            }
            resources.push(resource);
          }
          console.log("\u{1F3AF} Enhanced parsing results:", {
            phases: phases.filter((p, i, arr) => arr.indexOf(p) === i),
            // Remove duplicates
            resourceCount: resources.length,
            totalLabourCost,
            totalMaterialCost,
            grandTotal: totalLabourCost + totalMaterialCost,
            weeklyBreakdown
          });
          const enhancedJobData = JSON.stringify({
            phases: phaseTaskData,
            financials: {
              totalLabour: totalLabourCost,
              totalMaterial: totalMaterialCost,
              grandTotal: totalLabourCost + totalMaterialCost,
              weeklyBreakdown
            },
            resources: resources.filter((r) => r.unitPrice)
            // Only resources with valid pricing
          });
          await storage3.createJob({
            title: jobName,
            location: `${jobAddress}, ${jobPostcode}`,
            status: "pending",
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
            uploadId: csvUpload.id,
            phaseTaskData: enhancedJobData
          });
          jobsCreated++;
        } else {
          let dataHeaderIndex = lines.findIndex(
            (line) => line.includes("Build Phase") && (line.includes("Order Quantity") || line.split(",").length >= 3)
          );
          if (dataHeaderIndex === -1) {
            dataHeaderIndex = lines.findIndex(
              (line) => line.includes("Build Phase") || line.includes("Phase") || line.includes("Order") || line.includes("Date")
            );
          }
          let phaseTaskData = {};
          if (dataHeaderIndex >= 0) {
            console.log("\u{1F3AF} Using IMPROVED CSV parsing for cleaner format");
            let currentPhase = "";
            for (let i = dataHeaderIndex + 1; i < lines.length; i++) {
              const line = lines[i];
              if (!line || line.trim() === "") continue;
              const columns = line.split(",").map((col) => col.trim());
              if (columns.length < 3) continue;
              const col1 = columns[0] || "";
              const col2 = columns[1] || "";
              const col3 = columns[2] || "";
              const col4 = columns[3] || "0";
              if (col2 && !col3 && col1 === "") {
                currentPhase = col2;
                if (!phases.includes(currentPhase)) {
                  phases.push(currentPhase);
                }
                if (!phaseTaskData[currentPhase]) {
                  phaseTaskData[currentPhase] = [];
                }
              } else if (col3 && currentPhase) {
                const taskDescription = col3.replace(/"/g, "").trim();
                const quantity = parseInt(col4) || 0;
                if (taskDescription && taskDescription !== "") {
                  phaseTaskData[currentPhase].push({
                    description: taskDescription,
                    quantity,
                    task: `Install ${taskDescription.toLowerCase()}`
                  });
                }
              }
            }
            console.log("\u{1F3AF} IMPROVED parsing results:", {
              phases,
              phaseTaskDataKeys: Object.keys(phaseTaskData),
              totalTasks: Object.values(phaseTaskData).reduce((sum, tasks) => sum + tasks.length, 0)
            });
          }
          console.log("\u{1F3AF} Extracted Phase Task Data:", Object.keys(phaseTaskData).map(
            (phase) => `${phase}: ${phaseTaskData[phase].length} tasks`
          ));
          console.log("\u{1F3AF} CSV Data Extracted:", { jobName, jobAddress, jobPostcode, jobType, phases });
          const jobs2 = [{
            title: jobName,
            description: jobType,
            location: `${jobAddress}, ${jobPostcode}`,
            status: "pending",
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
            notes: `Project Type: ${jobType}`,
            phases: phases.join(", ") || "Data Missing from CSV",
            uploadId: csvUpload.id,
            phaseTaskData: JSON.stringify(phaseTaskData)
          }];
          const createdJobs = await storage3.createJobsFromCsv(jobs2, csvUpload.id);
          await storage3.updateCsvUpload(csvUpload.id, {
            status: "processed",
            jobsCount: createdJobs.length.toString()
          });
          res.json({
            upload: await storage3.getCsvUploads().then((uploads) => uploads.find((u) => u.id === csvUpload.id)),
            jobsCreated: createdJobs.length
          });
          const enhancedData = parseEnhancedCSV(lines);
          if (enhancedData) {
            console.log("\u{1F3AF} Enhanced CSV format detected - integrating financial data");
          }
        }
      } catch (error) {
        console.error("Error processing CSV jobs:", error);
        await storage3.updateCsvUpload(csvUpload.id, { status: "failed" });
        res.status(500).json({ error: "Failed to process CSV jobs" });
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      res.status(500).json({ error: "Failed to upload CSV file" });
    }
  });
  app2.get("/api/csv-uploads", async (req, res) => {
    try {
      const uploads = await storage3.getCsvUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ error: "Failed to fetch uploads" });
    }
  });
  app2.post("/api/assign-job", async (req, res) => {
    try {
      const validation = jobAssignmentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid assignment data", details: validation.error.errors });
      }
      const job = await storage3.assignJob(validation.data);
      if (!job) {
        return res.status(404).json({ error: "Job or contractor not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error assigning job:", error);
      res.status(500).json({ error: "Failed to assign job" });
    }
  });
  app2.get("/api/contractor-assignments/:contractorName", async (req, res) => {
    try {
      const { contractorName } = req.params;
      console.log("\u{1F50D} Fetching assignments for contractor:", contractorName);
      const assignments = await storage3.getContractorAssignments(contractorName);
      const updatedAssignments = assignments.map((assignment) => {
        const coordinates = getPostcodeCoordinates(assignment.workLocation || "");
        if (coordinates) {
          console.log(`\u{1F4CD} Setting GPS coordinates for assignment ${assignment.id} at ${assignment.workLocation}: ${coordinates.latitude}, ${coordinates.longitude}`);
          return {
            ...assignment,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
          };
        }
        return assignment;
      });
      console.log("\u{1F4CB} Found assignments:", updatedAssignments.length);
      res.json(updatedAssignments);
    } catch (error) {
      console.error("Error fetching contractor assignments:", error);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });
  app2.get("/api/job-assignments", async (req, res) => {
    try {
      console.log("\u{1F4CB} Fetching all job assignments");
      const assignments = await storage3.getJobAssignments();
      console.log("\u{1F4CB} Found", assignments.length, "job assignments");
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching job assignments:", error);
      res.status(500).json({ error: "Failed to fetch job assignments" });
    }
  });
  function getPostcodeCoordinates(location) {
    if (!location || typeof location !== "string") {
      return null;
    }
    const postcodeMap = {
      "DA17 5DB": { latitude: "51.4851", longitude: "0.1540" },
      "DA17": { latitude: "51.4851", longitude: "0.1540" },
      "DA7 6HJ": { latitude: "51.4851", longitude: "0.1540" },
      // Xavier Jones location
      "DA7": { latitude: "51.4851", longitude: "0.1540" },
      "BR6 9HE": { latitude: "51.361", longitude: "0.106" },
      // Orpington site (actual location)
      "BR6": { latitude: "51.361", longitude: "0.106" },
      "BR9": { latitude: "51.4612", longitude: "0.1388" },
      "SE9": { latitude: "51.4629", longitude: "0.0789" },
      "DA8": { latitude: "51.4891", longitude: "0.2245" },
      "DA1": { latitude: "51.4417", longitude: "0.2056" },
      "SG1 1EH": { latitude: "51.8721", longitude: "-0.2015" },
      "SG1": { latitude: "51.8721", longitude: "-0.2015" },
      "ME5 9GX": { latitude: "51.335996", longitude: "0.530215" },
      // Chatham main site
      "ME5": { latitude: "51.335996", longitude: "0.530215" },
      "ME1 1AA": { latitude: "51.388000", longitude: "0.505000" },
      // Rochester site
      "ME1": { latitude: "51.388000", longitude: "0.505000" },
      "ME7 1BT": { latitude: "51.388800", longitude: "0.548900" },
      // Gillingham site
      "ME7": { latitude: "51.388800", longitude: "0.548900" }
      // Add more as needed
    };
    let cleanLocation = location.replace(/["\\\n]/g, "").trim().toUpperCase();
    console.log(`\u{1F50E} GPS lookup for "${location}": cleaned to "${cleanLocation}"`);
    const postcodePattern = /([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})/;
    const postcodeMatch = cleanLocation.match(postcodePattern);
    if (postcodeMatch) {
      const extractedPostcode = postcodeMatch[1].trim();
      console.log(`\u{1F3AF} Extracted postcode: ${extractedPostcode}`);
      if (postcodeMap[extractedPostcode]) {
        console.log(`\u2705 Found coordinates for ${extractedPostcode}`);
        return postcodeMap[extractedPostcode];
      }
      const postcodePrefix = extractedPostcode.split(" ")[0];
      if (postcodeMap[postcodePrefix]) {
        console.log(`\u2705 Found coordinates for prefix ${postcodePrefix}`);
        return postcodeMap[postcodePrefix];
      }
    }
    if (postcodeMap[cleanLocation]) {
      console.log(`\u2705 Found direct match for ${cleanLocation}`);
      return postcodeMap[cleanLocation];
    }
    console.log(`\u274C No GPS coordinates found for: ${cleanLocation}`);
    return null;
  }
  app2.post("/api/job-assignments", async (req, res) => {
    try {
      console.log("\u{1F4CB} Creating job assignment:", req.body);
      if (req.body.workLocation) {
        const coordinates = getPostcodeCoordinates(req.body.workLocation);
        if (coordinates) {
          req.body.latitude = coordinates.latitude;
          req.body.longitude = coordinates.longitude;
          console.log(`\u{1F4CD} Added GPS coordinates for ${req.body.workLocation}: ${coordinates.latitude}, ${coordinates.longitude}`);
        } else {
          console.log(`\u26A0\uFE0F No GPS coordinates found for postcode: ${req.body.workLocation}`);
        }
      }
      const validatedAssignment = insertJobAssignmentSchema.parse(req.body);
      const assignment = await storage3.createJobAssignment(validatedAssignment);
      if (req.body.sendTelegramNotification) {
        try {
          const telegramService = new TelegramService();
          await telegramService.sendJobAssignment({
            contractorName: req.body.contractorName,
            phone: req.body.phone,
            hbxlJob: req.body.hbxlJob,
            buildPhases: req.body.buildPhases,
            workLocation: req.body.workLocation,
            startDate: req.body.startDate
          });
          console.log("\u{1F4F1} Telegram notification sent for assignment");
        } catch (telegramError) {
          console.error("\u26A0\uFE0F Failed to send Telegram notification:", telegramError);
        }
      }
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating job assignment:", error);
      res.status(500).json({ error: "Failed to create job assignment" });
    }
  });
  app2.get("/api/job-assignments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log("\u{1F50D} Fetching job assignment by ID:", id);
      const assignment = await storage3.getJobAssignment(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      console.log("\u{1F4CB} Found assignment:", assignment.id, assignment.contractorName);
      res.json(assignment);
    } catch (error) {
      console.error("Error fetching job assignment:", error);
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });
  app2.put("/api/job-assignments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log("\u{1F4DD} Updating job assignment:", id, "with:", req.body);
      const updated = await storage3.updateJobAssignment(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(200).json(updated);
    } catch (error) {
      console.error("Error updating job assignment:", error);
      res.status(500).json({ error: "Failed to update job assignment" });
    }
  });
  app2.delete("/api/job-assignments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log("\u{1F5D1}\uFE0F Deleting job assignment:", id);
      await storage3.deleteJobAssignment(id);
      res.status(200).json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting job assignment:", error);
      res.status(500).json({ error: "Failed to delete job assignment" });
    }
  });
  app2.post("/api/telegram-webhook", async (req, res) => {
    try {
      console.log("\u{1F514} Telegram webhook received:", JSON.stringify(req.body, null, 2));
      const { message } = req.body;
      if (!message || !message.text) {
        return res.status(200).json({ ok: true, message: "No text message" });
      }
      const contractorName = message.from?.first_name || "Unknown Contractor";
      const contractorPhone = message.contact?.phone_number;
      const messageText = message.text.toLowerCase();
      const isContractorReply = message.from?.id !== 7617462316;
      if (isContractorReply && (messageText.includes("hello") || messageText.includes("hi") || messageText.includes("work") || messageText.includes("job") || messageText.includes("ready") || messageText.includes("start"))) {
        console.log("\u{1F3AF} Contractor reply detected from:", contractorName);
        const telegramService = new TelegramService();
        const result = await telegramService.sendOnboardingForm(contractorName, contractorPhone);
        if (result.success) {
          console.log("\u2705 Auto-sent onboarding form with ID:", result.contractorId);
          console.log("\u{1F4CB} Contractor Details Captured:");
          console.log("   Name:", contractorName);
          console.log("   Telegram ID:", message.from?.id);
          console.log("   Generated Contractor ID:", result.contractorId);
        }
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("\u274C Telegram webhook error:", error);
      res.status(200).json({ ok: true, error: String(error) });
    }
  });
  app2.post("/api/reprocess-hbxl-csv", async (req, res) => {
    try {
      console.log("\u{1F504} Re-processing authentic HBXL CSV file to extract missing electrical tasks...");
      res.status(400).json({
        error: "Original CSV content not stored. Please re-upload the complete 'Job 49 Flat2 1 Bedroom 1Smart Schedule Export.csv' file with all 21 electrical tasks.",
        suggestion: "Use the CSV upload interface to upload the complete HBXL file again."
      });
    } catch (error) {
      console.error("\u274C Error re-processing HBXL CSV:", error);
      res.status(500).json({ error: "Failed to re-process HBXL CSV file" });
    }
  });
  app2.get("/api/uploaded-jobs", async (req, res) => {
    try {
      console.log("\u{1F4CB} Extracting ONLY authentic CSV task data...");
      const storedJobs = await storage3.getJobs();
      console.log("\u{1F50D} Available jobs:", storedJobs.map((job) => ({
        id: job.id,
        title: job.title,
        uploadId: job.uploadId,
        phaseTaskDataValue: job.phaseTaskData || "NULL",
        phaseTaskDataLength: job.phaseTaskData ? job.phaseTaskData.length : 0,
        hasTaskData: !!job.phaseTaskData && job.phaseTaskData.trim() !== "{}" && job.phaseTaskData.trim() !== ""
      })));
      let csvUploadJob = storedJobs.find((job) => job.phaseTaskData && job.phaseTaskData.trim() !== "{}" && job.phaseTaskData.trim() !== "");
      if (!csvUploadJob) {
        csvUploadJob = storedJobs.find((job) => job.uploadId === "f9126100-d429-4384-865f-55df43e9e8ec");
      }
      console.log("\u{1F3AF} Selected job:", {
        id: csvUploadJob?.id,
        title: csvUploadJob?.title,
        hasTaskData: !!csvUploadJob?.phaseTaskData
      });
      if (!csvUploadJob) {
        return res.json([]);
      }
      let phaseData = {};
      if (csvUploadJob.phaseTaskData) {
        try {
          phaseData = JSON.parse(csvUploadJob.phaseTaskData);
        } catch {
          console.warn("\u26A0\uFE0F Failed to parse stored phase task data");
        }
      }
      if (Object.keys(phaseData).length === 0) {
        const phases = csvUploadJob.phases ? csvUploadJob.phases.split(", ") : [];
        phases.forEach((phase) => {
          phaseData[phase] = [{
            description: "Data Missing from CSV",
            quantity: 0,
            task: "CSV task breakdown not available - upload detailed CSV file"
          }];
        });
      }
      const uploadedJobs = [{
        id: "flat2-job",
        name: csvUploadJob.title,
        address: csvUploadJob.location,
        postcode: "SG1 1EH",
        projectType: csvUploadJob.description,
        phases: csvUploadJob.phases ? csvUploadJob.phases.split(", ") : [],
        phaseData,
        uploadId: csvUploadJob.uploadId
      }];
      console.log("\u2705 Returning authentic CSV data only - no assumptions made");
      res.json(uploadedJobs);
    } catch (error) {
      console.error("\u274C Error fetching authentic CSV data:", error);
      res.status(500).json({ error: "Failed to fetch CSV data" });
    }
  });
  app2.post("/api/send-onboarding-form", async (req, res) => {
    try {
      const { contractorName, contractorPhone } = req.body;
      console.log("\u{1F4F1} Onboarding form request for:", contractorName);
      if (!contractorName) {
        return res.status(400).json({
          success: false,
          error: "Contractor name is required"
        });
      }
      const telegramService = new TelegramService();
      const result = await telegramService.sendOnboardingForm(contractorName, contractorPhone);
      if (result.success) {
        console.log("\u2705 Onboarding form sent successfully with ID:", result.contractorId);
        res.json({
          success: true,
          message: `Onboarding form sent to ${contractorName}`,
          contractorId: result.contractorId,
          messageId: result.messageId,
          simulated: result.simulated
        });
      } else {
        console.log("\u26A0\uFE0F Onboarding form failed:", result.error);
        res.json({
          success: false,
          message: `Failed to send onboarding form: ${result.error}`,
          error: result.error
        });
      }
    } catch (error) {
      console.error("\u274C Onboarding form error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send onboarding form",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/send-contractor-hello", async (req, res) => {
    try {
      console.log("\u{1F4F1} Contractor hello message request");
      const telegramService = new TelegramService();
      const result = await telegramService.sendContractorHello("James Carpenter");
      if (result.success) {
        console.log("\u2705 Contractor hello message sent successfully");
        res.json({
          success: true,
          message: "Hello message sent from James Carpenter",
          messageId: result.messageId,
          simulated: result.simulated
        });
      } else {
        console.log("\u26A0\uFE0F Contractor hello message failed:", result.error);
        res.json({
          success: false,
          message: `Failed to send hello message: ${result.error}`,
          error: result.error
        });
      }
    } catch (error) {
      console.error("\u274C Contractor hello message error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send hello message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/send-telegram-notification", async (req, res) => {
    try {
      const { contractorName, phone, hbxlJob, buildPhases, workLocation, startDate } = req.body;
      console.log("\u{1F4F1} Telegram notification request:", {
        contractorName,
        phone,
        hbxlJob,
        buildPhases: buildPhases?.length || 0,
        workLocation,
        startDate
      });
      const telegramService = new TelegramService();
      const result = await telegramService.sendJobAssignment({
        contractorName,
        phone,
        hbxlJob,
        buildPhases,
        workLocation,
        startDate
      });
      if (result.success) {
        console.log("\u2705 Telegram notification sent successfully");
        res.json({
          success: true,
          message: `Notification sent to ${contractorName} (${phone})`,
          details: {
            job: hbxlJob,
            phases: buildPhases,
            location: workLocation,
            startDate,
            messageId: result.messageId,
            simulated: result.simulated
          }
        });
      } else {
        console.log("\u26A0\uFE0F Telegram notification failed:", result.error);
        res.json({
          success: false,
          message: `Failed to send notification: ${result.error}`,
          details: { error: result.error }
        });
      }
    } catch (error) {
      console.error("\u274C Telegram notification error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/telegram/test", async (req, res) => {
    try {
      const telegramService = new TelegramService();
      const result = await telegramService.testConnection();
      res.json(result);
    } catch (error) {
      console.error("\u274C Telegram test error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to test Telegram connection",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/telegram/send-custom", async (req, res) => {
    try {
      const { chatId, message } = req.body;
      if (!chatId || !message) {
        return res.status(400).json({
          success: false,
          error: "chatId and message are required"
        });
      }
      const telegramService = new TelegramService();
      const result = await telegramService.sendCustomMessage(chatId, message);
      res.json(result);
    } catch (error) {
      console.error("\u274C Custom message error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send custom message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/telegram/recent-messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const telegramService = new TelegramService();
      const result = await telegramService.getRecentMessages(limit);
      if (result.success) {
        const relevantMessages = result.messages?.filter((msg) => {
          const senderName = msg.from?.first_name?.toLowerCase() || "";
          const messageText = msg.text?.toLowerCase() || "";
          return senderName.includes("marius") || messageText.includes("work") || messageText.includes("job") || messageText.includes("ready") || messageText.includes("hello") || messageText.includes("hi");
        }) || [];
        res.json({
          success: true,
          messages: relevantMessages,
          totalChecked: result.messages?.length || 0,
          relevantCount: relevantMessages.length
        });
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error("\u274C Error getting recent messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get recent messages",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/telegram/messages", async (req, res) => {
    try {
      const telegramService = new TelegramService();
      const result = await telegramService.getRecentMessages();
      res.json(result);
    } catch (error) {
      console.error("\u274C Error getting messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get messages",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/contractor-login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const applications = await storage3.getContractorApplications();
      const contractor = applications.find(
        (app3) => app3.username === username && app3.password === password && app3.status === "approved"
      );
      if (contractor) {
        const { password: _, ...contractorData } = contractor;
        res.json(contractorData);
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Error during contractor login:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/contractor-applications", async (req, res) => {
    try {
      const applications = await storage3.getContractorApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching contractor applications:", error);
      res.status(500).json({ error: "Failed to fetch contractor applications" });
    }
  });
  app2.get("/api/contractor-applications/:id", async (req, res) => {
    try {
      const application = await storage3.getContractorApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error fetching contractor application:", error);
      res.status(500).json({ error: "Failed to fetch contractor application" });
    }
  });
  app2.get("/api/contractor-application/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const application = await storage3.getContractorApplicationByUsername(username);
      if (!application) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error fetching contractor application:", error);
      res.status(500).json({ error: "Failed to fetch contractor data" });
    }
  });
  app2.post("/api/contractor-applications", async (req, res) => {
    try {
      console.log("\u{1F4CB} Received contractor application submission:", req.body);
      const processedData = {
        ...req.body,
        hasRightToWork: req.body.hasRightToWork?.toString() || "false",
        passportPhotoUploaded: req.body.passportPhotoUploaded?.toString() || "false",
        hasPublicLiability: req.body.hasPublicLiability?.toString() || "false",
        isCisRegistered: req.body.isCisRegistered?.toString() || "false",
        hasValidCscs: req.body.hasValidCscs?.toString() || "false",
        hasOwnTools: req.body.hasOwnTools?.toString() || "false"
      };
      const validation = insertContractorApplicationSchema.safeParse(processedData);
      if (!validation.success) {
        console.error("\u274C Validation failed:", validation.error.errors);
        return res.status(400).json({
          error: "Invalid application data",
          details: validation.error.errors
        });
      }
      const application = await storage3.createContractorApplication(validation.data);
      console.log("\u2705 Contractor application created successfully:", application.id);
      try {
        const telegramService = new TelegramService();
        const message = `\u{1F525} **NEW CONTRACTOR APPLICATION**

\u{1F464} **${application.firstName} ${application.lastName}**
\u{1F4E7} ${application.email}
\u{1F4F1} ${application.phone}
\u{1F3D7}\uFE0F **Trade:** ${application.primaryTrade}
\u2B50 **Experience:** ${application.yearsExperience}
\u{1F4CD} ${application.city}, ${application.postcode}

\u{1F517} **View Application:** http://localhost:5000/admin/applications/${application.id}

\u23F0 Submitted: ${(/* @__PURE__ */ new Date()).toLocaleString()}`;
        await telegramService.sendCustomMessage("7617462316", message);
        console.log("\u{1F4F1} Admin notification sent successfully");
      } catch (telegramError) {
        console.error("\u26A0\uFE0F Failed to send admin notification:", telegramError);
      }
      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating contractor application:", error);
      res.status(500).json({ error: "Failed to create contractor application" });
    }
  });
  app2.patch("/api/contractor-applications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const originalApplication = await storage3.getContractorApplication(id);
      if (!originalApplication) {
        return res.status(404).json({ error: "Application not found" });
      }
      const updated = await storage3.updateContractorApplication(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (updates.status && updates.status !== originalApplication.status) {
        const telegramService = new TelegramService();
        if (updates.status === "approved") {
          console.log("\u{1F4F1} Sending approval notification for:", updated.firstName, updated.lastName);
          await telegramService.sendApprovalNotification({
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
            email: updated.email,
            primaryTrade: updated.primaryTrade,
            adminPayRate: updated.adminPayRate || void 0
          });
        } else if (updates.status === "rejected") {
          console.log("\u{1F4F1} Sending rejection notification for:", updated.firstName, updated.lastName);
          await telegramService.sendRejectionNotification({
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
            email: updated.email,
            primaryTrade: updated.primaryTrade,
            rejectionReason: updated.adminNotes || void 0
          });
        }
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating contractor application:", error);
      res.status(500).json({ error: "Failed to update contractor application" });
    }
  });
  app2.delete("/api/contractor-applications", async (req, res) => {
    try {
      storage3.contractorApplications.clear();
      console.log("\u{1F9F9} All contractor applications cleared from memory");
      res.json({ message: "All applications cleared successfully" });
    } catch (error) {
      console.error("Error clearing applications:", error);
      res.status(500).json({ error: "Failed to clear applications" });
    }
  });
  app2.post("/api/work-sessions", async (req, res) => {
    try {
      console.log("\u{1F550} Creating work session:", req.body);
      const sessionData = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : /* @__PURE__ */ new Date(),
        endTime: req.body.endTime ? new Date(req.body.endTime) : void 0
      };
      if (sessionData.jobSiteLocation && (sessionData.jobSiteLocation.includes("Work Site:") || sessionData.jobSiteLocation === "Unknown Location")) {
        const jobs2 = await storage3.getJobs();
        for (const job of jobs2) {
          if (job.contractorName === sessionData.contractorName && job.location) {
            console.log(`\u{1F4CD} Mapping GPS coordinates to job location: ${job.location}`);
            sessionData.jobSiteLocation = job.location;
            break;
          }
        }
        if (sessionData.jobSiteLocation.includes("Work Site:") || sessionData.jobSiteLocation === "Unknown Location") {
          const anyJob = jobs2.find((job) => job.location);
          if (anyJob) {
            console.log(`\u{1F4CD} Using fallback job location: ${anyJob.location}`);
            sessionData.jobSiteLocation = anyJob.location;
          }
        }
      }
      console.log("\u{1F50D} Work session data before validation:", JSON.stringify(sessionData, null, 2));
      const validationResult = insertWorkSessionSchema.safeParse(sessionData);
      if (!validationResult.success) {
        console.error("\u274C Work session validation failed:", validationResult.error.errors);
        return res.status(400).json({
          error: "Invalid work session data",
          details: validationResult.error.errors,
          receivedData: sessionData
        });
      }
      const session = await storage3.createWorkSession(validationResult.data);
      console.log("\u2705 Work session created successfully:", session.id);
      res.status(201).json(session);
    } catch (error) {
      console.error("\u274C Error creating work session:", error);
      if (error instanceof Error) {
        console.error("\u274C Error details:", error.message);
        console.error("\u274C Error stack:", error.stack);
      }
      res.status(400).json({ error: "Failed to create work session", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  app2.get("/api/work-sessions/:contractorName", async (req, res) => {
    try {
      console.log("\u{1F550} Fetching sessions for contractor:", req.params.contractorName);
      const sessions = await storage3.getWorkSessions(req.params.contractorName);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching work sessions:", error);
      res.status(500).json({ error: "Failed to fetch work sessions" });
    }
  });
  app2.get("/api/work-sessions/:contractorName/active", async (req, res) => {
    try {
      console.log("\u{1F550} Fetching active session for:", req.params.contractorName);
      let session = await storage3.getActiveWorkSession(req.params.contractorName);
      if (session && session.status === "active") {
        const now = /* @__PURE__ */ new Date();
        const currentHour = now.getHours();
        if (currentHour >= 17) {
          console.log(`\u{1F550} Auto-logout at ${currentHour}:${now.getMinutes().toString().padStart(2, "0")} - ending session for ${req.params.contractorName}`);
          const endTime = new Date(session.startTime);
          endTime.setHours(17, 0, 0, 0);
          const updateData = {
            endTime,
            status: "completed"
          };
          session = await storage3.updateWorkSession(session.id, updateData);
          console.log(`\u2705 Session auto-completed for ${req.params.contractorName}`);
        }
      }
      if (session) {
        res.json(session);
      } else {
        res.status(404).json({ error: "No active session found" });
      }
    } catch (error) {
      console.error("Error fetching active work session:", error);
      res.status(500).json({ error: "Failed to fetch active work session" });
    }
  });
  app2.put("/api/work-sessions/:id", async (req, res) => {
    try {
      console.log("\u{1F550} Updating work session with GPS tracking:", req.params.id);
      console.log("\u{1F4CD} GPS Data:", {
        startLat: req.body.startLatitude,
        startLng: req.body.startLongitude,
        endLat: req.body.endLatitude,
        endLng: req.body.endLongitude
      });
      const updateData = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : void 0,
        endTime: req.body.endTime ? new Date(req.body.endTime) : void 0
      };
      if (updateData.startLatitude && updateData.startLongitude && updateData.endLatitude && updateData.endLongitude) {
        const distance = calculateGPSDistance(
          parseFloat(updateData.startLatitude),
          parseFloat(updateData.startLongitude),
          parseFloat(updateData.endLatitude),
          parseFloat(updateData.endLongitude)
        );
        console.log(`\u{1F4CD} GPS Movement: ${distance.toFixed(0)}m during work session`);
      }
      const session = await storage3.updateWorkSession(req.params.id, updateData);
      if (session) {
        console.log("\u2705 Work session completed with GPS tracking");
        res.json(session);
      } else {
        res.status(404).json({ error: "Work session not found" });
      }
    } catch (error) {
      console.error("Error updating work session:", error);
      res.status(400).json({ error: "Failed to update work session" });
    }
  });
  function calculateGPSDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const { updateContractorLocation: updateContractorLocation2, getContractorLocation: getContractorLocation2 } = await Promise.resolve().then(() => (init_location_tracker(), location_tracker_exports));
  app2.post("/api/update-location", async (req, res) => {
    try {
      const { contractorName, latitude, longitude } = req.body;
      if (!contractorName || !latitude || !longitude) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      updateContractorLocation2(contractorName, parseFloat(latitude), parseFloat(longitude));
      res.json({ success: true, message: "Location updated successfully" });
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });
  app2.get("/api/contractor-location/:name", async (req, res) => {
    try {
      const contractorName = decodeURIComponent(req.params.name);
      const location = getContractorLocation2(contractorName);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json({
        contractorName,
        latitude: location.latitude,
        longitude: location.longitude,
        lastUpdate: location.lastUpdate
      });
    } catch (error) {
      console.error("Error getting contractor location:", error);
      res.status(500).json({ error: "Failed to get location" });
    }
  });
  app2.post("/api/check-proximity", async (req, res) => {
    try {
      const { userLatitude, userLongitude, contractorName } = req.body;
      console.log(`\u{1F50D} MULTI-SITE GPS Check for ${contractorName}:`);
      console.log(`\u{1F4CD} User Location: ${userLatitude}, ${userLongitude}`);
      if (contractorName && userLatitude && userLongitude) {
        updateContractorLocation2(contractorName, parseFloat(userLatitude), parseFloat(userLongitude));
      }
      const allJobs = await storage3.getJobs();
      console.log(`\u{1F50D} Found ${allJobs.length} total jobs in database`);
      let nearestJobSite = null;
      let nearestDistance = Infinity;
      let authorizedSites = [];
      for (const job of allJobs) {
        if (job.location) {
          console.log(`\u{1F3D7}\uFE0F Checking job: ${job.title} at ${job.location}`);
          const jobSiteCoords = getPostcodeCoordinates(job.location);
          console.log(`\u{1F50E} GPS lookup for ${job.location}:`, jobSiteCoords);
          if (jobSiteCoords) {
            console.log(`\u{1F4CD} GPS coordinates for ${job.location}: ${jobSiteCoords.latitude}, ${jobSiteCoords.longitude}`);
            const jobSiteLat = parseFloat(jobSiteCoords.latitude);
            const jobSiteLon = parseFloat(jobSiteCoords.longitude);
            const distance = calculateGPSDistance(
              parseFloat(userLatitude),
              parseFloat(userLongitude),
              jobSiteLat,
              jobSiteLon
            );
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestJobSite = {
                location: job.location,
                distance,
                jobTitle: job.title,
                jobId: job.id
              };
            }
            if (distance <= 3500) {
              authorizedSites.push({
                location: job.location,
                distance: Math.round(distance),
                jobTitle: job.title,
                jobId: job.id
              });
            }
          }
        }
      }
      const withinRange = authorizedSites.length > 0;
      if (withinRange) {
        console.log(`\u2705 AUTHORIZED: ${contractorName} can clock in at ${authorizedSites.length} site(s)`);
        authorizedSites.forEach((site) => {
          console.log(`   \u{1F4CD} ${site.location} (${site.jobTitle}) - ${site.distance}m away`);
        });
      } else {
        const nearestInfo = nearestJobSite ? `${Math.round(nearestDistance)}m from ${nearestJobSite.location}` : "no job sites found";
        console.log(`\u274C TOO FAR: ${contractorName} not within 3500m (3.5km) of any job site - ${nearestInfo}`);
      }
      res.json({
        withinRange,
        authorizedSites,
        nearestJobSite,
        allowedDistance: 3500,
        // 3.5km in meters
        message: withinRange ? `Access granted to ${authorizedSites.length} job site(s)` : `Must be within 100m of a job site to clock in`
      });
    } catch (error) {
      console.error("Error in multi-site proximity check:", error);
      res.status(500).json({
        error: "Failed to check proximity",
        withinRange: false,
        authorizedSites: []
      });
    }
  });
  app2.post("/api/contractor-reports", async (req, res) => {
    try {
      console.log("\u{1F4DD} Creating contractor report:", req.body);
      const report = await storage3.createContractorReport(req.body);
      res.json(report);
    } catch (error) {
      console.error("Error creating contractor report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });
  app2.get("/api/contractor-reports", async (req, res) => {
    try {
      const reports = await storage3.getContractorReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching contractor reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });
  app2.get("/api/admin-settings", async (req, res) => {
    try {
      console.log("\u2699\uFE0F Fetching admin settings");
      const settings = await storage3.getAdminSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ error: "Failed to fetch admin settings" });
    }
  });
  app2.get("/api/admin-settings/:key", async (req, res) => {
    try {
      console.log("\u2699\uFE0F Fetching admin setting:", req.params.key);
      const setting = await storage3.getAdminSetting(req.params.key);
      if (setting) {
        res.json(setting);
      } else {
        res.status(404).json({ error: "Setting not found" });
      }
    } catch (error) {
      console.error("Error fetching admin setting:", error);
      res.status(500).json({ error: "Failed to fetch admin setting" });
    }
  });
  app2.post("/api/admin-settings", async (req, res) => {
    try {
      console.log("\u2699\uFE0F Creating/updating admin setting:", req.body);
      const validatedSetting = insertAdminSettingSchema.parse(req.body);
      const setting = await storage3.setAdminSetting(validatedSetting);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating admin setting:", error);
      res.status(400).json({ error: "Failed to create admin setting" });
    }
  });
  app2.put("/api/admin-settings/:key", async (req, res) => {
    try {
      console.log("\u2699\uFE0F Updating admin setting:", req.params.key, req.body);
      const { value, updatedBy } = req.body;
      const setting = await storage3.updateAdminSetting(req.params.key, value, updatedBy);
      if (setting) {
        res.json(setting);
      } else {
        res.status(404).json({ error: "Setting not found" });
      }
    } catch (error) {
      console.error("Error updating admin setting:", error);
      res.status(400).json({ error: "Failed to update admin setting" });
    }
  });
  app2.post("/api/admin-inspections", async (req, res) => {
    try {
      const inspectionData = {
        assignmentId: req.body.assignmentId,
        inspectorName: req.body.inspectorName,
        inspectionType: req.body.inspectionType || "admin_inspection",
        workQualityRating: req.body.workQualityRating,
        weatherConditions: req.body.weatherConditions,
        progressComments: req.body.progressComments,
        safetyNotes: req.body.safetyNotes || "",
        materialsIssues: req.body.materialsIssues || "",
        nextActions: req.body.nextActions || "",
        photoUrls: req.body.photoUrls || [],
        status: req.body.status || "draft"
      };
      const inspection = await storage3.createAdminInspection(inspectionData);
      console.log("\u{1F4CB} Admin inspection created successfully");
      res.status(201).json(inspection);
    } catch (error) {
      console.error("Error creating admin inspection:", error);
      res.status(500).json({ error: "Failed to create admin inspection" });
    }
  });
  app2.get("/api/admin-inspections", async (req, res) => {
    try {
      const inspections = await storage3.getAdminInspections();
      res.json(inspections);
    } catch (error) {
      console.error("Error fetching admin inspections:", error);
      res.status(500).json({ error: "Failed to fetch admin inspections" });
    }
  });
  app2.get("/api/admin-inspections/assignment/:assignmentId", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const inspections = await storage3.getAdminInspectionsByAssignment(assignmentId);
      res.json(inspections);
    } catch (error) {
      console.error("Error fetching inspections for assignment:", error);
      res.status(500).json({ error: "Failed to fetch inspections for assignment" });
    }
  });
  app2.post("/api/admin-inspections/batch", async (req, res) => {
    try {
      const { inspections } = req.body;
      if (!Array.isArray(inspections)) {
        return res.status(400).json({ error: "Inspections must be an array" });
      }
      const createdInspections = [];
      for (const inspectionData of inspections) {
        const inspection = await storage3.createAdminInspection({
          assignmentId: inspectionData.assignmentId,
          inspectorName: inspectionData.inspectedBy,
          inspectionType: "task_inspection",
          workQualityRating: (inspectionData.inspectionStatus === "approved" ? 5 : 3).toString(),
          weatherConditions: "Not specified",
          progressComments: `Task: ${inspectionData.taskName} - ${inspectionData.inspectionStatus}`,
          safetyNotes: inspectionData.notes || "",
          materialsIssues: inspectionData.inspectionStatus === "issues" ? inspectionData.notes : "",
          nextActions: inspectionData.inspectionStatus === "issues" ? "Address noted issues" : "Task approved",
          photoUrls: [],
          status: "completed"
        });
        createdInspections.push(inspection);
      }
      console.log(`\u{1F4CB} Created ${createdInspections.length} task-based admin inspections`);
      res.status(201).json(createdInspections);
    } catch (error) {
      console.error("Error creating batch admin inspections:", error);
      res.status(500).json({ error: "Failed to create batch admin inspections" });
    }
  });
  app2.get("/api/pending-inspections", async (req, res) => {
    try {
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      const pendingInspections = await progressMonitor2.getPendingInspections();
      console.log("\u{1F4CB} Returning", pendingInspections.length, "inspections with AUTHENTIC CSV data only");
      res.json(pendingInspections);
    } catch (error) {
      console.error("Error fetching pending inspections:", error);
      res.status(500).json({ error: "Failed to fetch pending inspections" });
    }
  });
  app2.post("/api/progress-monitor/check-milestones", async (req, res) => {
    try {
      const { assignmentId } = req.body;
      if (!assignmentId) {
        return res.status(400).json({ error: "Assignment ID is required" });
      }
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      await progressMonitor2.checkProgressMilestones(assignmentId);
      console.log("\u2705 Progress milestones checked for assignment:", assignmentId);
      res.status(200).json({ success: true, message: "Milestones checked successfully" });
    } catch (error) {
      console.error("\u274C Error checking progress milestones:", error);
      res.status(500).json({ error: "Failed to check progress milestones" });
    }
  });
  app2.post("/api/progress-monitor/update-task", async (req, res) => {
    try {
      const { assignmentId, taskId, completed } = req.body;
      if (!assignmentId || !taskId || typeof completed !== "boolean") {
        return res.status(400).json({ error: "Assignment ID, task ID, and completion status are required" });
      }
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      await progressMonitor2.updateTaskProgress(assignmentId, taskId, completed);
      console.log("\u2705 Task progress updated:", { assignmentId, taskId, completed });
      res.status(200).json({ success: true, message: "Task progress updated" });
    } catch (error) {
      console.error("\u274C Error updating task progress:", error);
      res.status(500).json({ error: "Failed to update task progress" });
    }
  });
  app2.post("/api/check-progress/:assignmentId", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      await progressMonitor2.checkProgressMilestones(assignmentId);
      res.json({ success: true, message: "Progress milestones checked" });
    } catch (error) {
      console.error("Error checking progress milestones:", error);
      res.status(500).json({ error: "Failed to check progress milestones" });
    }
  });
  app2.post("/api/trigger-progress-check/:assignmentId", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      await progressMonitor2.checkProgressMilestones(assignmentId);
      res.json({ success: true, message: "Progress check completed" });
    } catch (error) {
      console.error("Error triggering progress check:", error);
      res.status(500).json({ error: "Failed to trigger progress check" });
    }
  });
  app2.post("/api/force-create-inspection", async (req, res) => {
    try {
      const { assignmentId, contractorName, notificationType } = req.body;
      const inspection = await storage3.createInspectionNotification({
        assignmentId: assignmentId || "test-assignment",
        contractorName: contractorName || "Test Contractor",
        notificationType: notificationType || "50_percent_ready",
        notificationSent: true,
        inspectionCompleted: false
      });
      console.log(`\u{1F6A8} FORCE CREATED inspection notification:`, inspection);
      res.json({ success: true, inspection });
    } catch (error) {
      console.error("Error force creating inspection:", error);
      res.status(500).json({ error: "Failed to create inspection" });
    }
  });
  app2.post("/api/check-progress/:assignmentId", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      await progressMonitor2.checkProgressMilestones(assignmentId);
      res.json({ success: true, message: "Progress check completed" });
    } catch (error) {
      console.error("Error triggering progress check:", error);
      res.status(500).json({ error: "Failed to trigger progress check" });
    }
  });
  app2.post("/api/complete-inspection/:notificationId", async (req, res) => {
    try {
      const { notificationId } = req.params;
      const notification = await storage3.completeInspectionNotification(notificationId);
      if (notification) {
        res.json({ success: true, notification });
      } else {
        res.status(404).json({ error: "Notification not found" });
      }
    } catch (error) {
      console.error("Error completing inspection:", error);
      res.status(500).json({ error: "Failed to complete inspection" });
    }
  });
  app2.post("/api/demo-trigger-inspection/:assignmentId/:percentage", async (req, res) => {
    try {
      const { assignmentId, percentage } = req.params;
      const assignment = await storage3.getJobAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      const progressPercentage = parseInt(percentage);
      let notificationType = "";
      if (progressPercentage >= 50 && progressPercentage < 100) {
        notificationType = "50_percent_ready";
      } else if (progressPercentage >= 100) {
        notificationType = "100_percent_ready";
      } else {
        return res.json({ message: "No inspection needed for this progress level" });
      }
      const existing = await storage3.getInspectionNotificationByAssignmentAndType(assignmentId, notificationType);
      if (existing) {
        return res.json({ message: "Inspection notification already exists", existing });
      }
      const notification = await storage3.createInspectionNotification({
        assignmentId,
        contractorName: assignment.contractorName,
        notificationType,
        notificationSent: true,
        inspectionCompleted: false
      });
      console.log(`\u{1F6A8} DEMO: ${notificationType.replace("_", " ")} inspection triggered for ${assignment.contractorName}`);
      res.json({
        success: true,
        message: `${notificationType.replace("_", " ")} inspection notification created`,
        notification
      });
    } catch (error) {
      console.error("Error in demo trigger:", error);
      res.status(500).json({ error: "Failed to trigger demo inspection" });
    }
  });
  app2.post("/api/progress-update", async (req, res) => {
    try {
      const { assignmentId, completedTasks, totalTasks, percentage } = req.body;
      console.log(`\u{1F4CA} Progress update received: ${completedTasks}/${totalTasks} tasks (${percentage}%) for assignment ${assignmentId}`);
      const { ProgressMonitor: ProgressMonitor2 } = await Promise.resolve().then(() => (init_progress_monitor(), progress_monitor_exports));
      const progressMonitor2 = new ProgressMonitor2();
      if (percentage >= 50) {
        console.log(`\u{1F3AF} 50% milestone reached (${percentage}%) - triggering inspection`);
        await progressMonitor2.checkProgressMilestones(assignmentId);
      }
      if (percentage >= 100) {
        console.log(`\u{1F3AF} 100% milestone reached (${percentage}%) - triggering inspection`);
        await progressMonitor2.checkProgressMilestones(assignmentId);
      }
      res.json({
        success: true,
        message: `Progress updated: ${percentage}%`,
        milestonesChecked: percentage >= 50
      });
    } catch (error) {
      console.error("\u274C Error updating progress:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });
  app2.get("/api/task-progress/:contractorName/:assignmentId", async (req, res) => {
    try {
      const { contractorName, assignmentId } = req.params;
      const progress = await storage3.getTaskProgress(contractorName, assignmentId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching task progress:", error);
      res.status(500).json({ error: "Failed to fetch task progress" });
    }
  });
  app2.get("/api/team-task-progress/:assignmentId", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      console.log(`\u{1F91D} Fetching team task progress for assignment: ${assignmentId}`);
      const allAssignments = await storage3.getJobAssignments();
      const currentAssignment = allAssignments.find((a) => a.id === assignmentId);
      if (!currentAssignment) {
        console.log(`\u274C Assignment ${assignmentId} not found`);
        return res.json([]);
      }
      const teamAssignments = allAssignments.filter(
        (a) => a.hbxlJob === currentAssignment.hbxlJob && a.workLocation === currentAssignment.workLocation && a.status === "assigned"
      );
      console.log(`\u{1F91D} Found ${teamAssignments.length} contractors working on job: ${currentAssignment.hbxlJob} at ${currentAssignment.workLocation}`);
      const teamProgress = [];
      for (const assignment of teamAssignments) {
        const contractorProgress = await storage3.getTaskProgress(assignment.contractorName, assignment.id);
        contractorProgress.forEach((progress) => {
          if (progress.completed) {
            teamProgress.push({
              ...progress,
              completedBy: assignment.contractorName,
              completedByFirstName: assignment.contractorName.split(" ")[0]
            });
          }
        });
      }
      console.log(`\u{1F91D} Found ${teamProgress.length} completed tasks across ${teamAssignments.length} team members`);
      res.json(teamProgress);
    } catch (error) {
      console.error("Error fetching team task progress:", error);
      res.status(500).json({ error: "Failed to fetch team task progress" });
    }
  });
  app2.post("/api/task-progress", async (req, res) => {
    try {
      const progress = await storage3.createTaskProgress(req.body);
      res.status(201).json(progress);
    } catch (error) {
      console.error("Error creating task progress:", error);
      res.status(500).json({ error: "Failed to create task progress" });
    }
  });
  app2.put("/api/task-progress/:contractorName/:assignmentId/:taskId", async (req, res) => {
    try {
      const { contractorName, assignmentId, taskId } = req.params;
      const { completed } = req.body;
      const progress = await storage3.updateTaskCompletion(contractorName, assignmentId, taskId, completed);
      if (!progress) {
        return res.status(404).json({ error: "Task progress not found" });
      }
      res.json(progress);
    } catch (error) {
      console.error("Error updating task progress:", error);
      res.status(500).json({ error: "Failed to update task progress" });
    }
  });
  app2.post("/api/task-progress/update", async (req, res) => {
    try {
      const { contractorName, assignmentId, taskId, taskDescription, phase, completed } = req.body;
      console.log(`\u{1F4DD} Processing task update: ${taskId} - ${completed ? "completed" : "incomplete"}`);
      try {
        const existing = await storage3.updateTaskCompletion(contractorName, assignmentId, taskId, completed);
        if (existing) {
          console.log(`\u{1F4C1} Updated existing task: ${taskId}`);
          return res.json({ success: true, action: "updated", data: existing });
        }
      } catch (updateError) {
        console.log(`\u{1F4DD} Task not found, creating new record: ${taskId}`);
      }
      try {
        const description = taskDescription || taskId.replace(/^phase-\d+-item-\d+-/, "").replace(/-/g, " ");
        const phaseMatch = taskId.match(/^phase-(\d+)/);
        const derivedPhase = phase || (phaseMatch ? `Phase ${phaseMatch[1]}` : "Unknown Phase");
        const newProgress = await storage3.createTaskProgress({
          contractorName,
          assignmentId,
          taskId,
          taskDescription: description,
          phase: derivedPhase,
          completed: completed || false
        });
        console.log(`\u2705 Created new task progress: ${taskId} - ${completed ? "completed" : "in progress"}`);
        res.json({ success: true, action: "created", data: newProgress });
      } catch (createError) {
        console.error("\u274C Failed to create task progress:", createError);
        res.status(500).json({ error: "Failed to create task progress record" });
      }
    } catch (error) {
      console.error("\u274C Error in task progress update:", error);
      res.status(500).json({ error: "Failed to backup task progress" });
    }
  });
  const httpServer = createServer(app2);
  app2.post("/api/admin-inspections/batch", async (req, res) => {
    try {
      const { inspections } = req.body;
      console.log("\u{1F4CB} Processing batch inspection submission:", inspections?.length || 0, "tasks");
      if (!inspections || !Array.isArray(inspections)) {
        return res.status(400).json({ error: "Invalid inspections data" });
      }
      const results = [];
      for (const inspection of inspections) {
        const result = await storage3.createTaskInspectionResult(inspection);
        results.push(result);
      }
      console.log("\u2705 Created", results.length, "task inspection results");
      res.json({ success: true, results });
    } catch (error) {
      console.error("Error creating batch inspections:", error);
      res.status(500).json({ error: "Failed to create inspections" });
    }
  });
  app2.get("/api/task-inspection-results/:contractorName", async (req, res) => {
    try {
      const { contractorName } = req.params;
      console.log("\u{1F4CB} Fetching task inspection results for contractor:", contractorName);
      const adminInspections2 = await storage3.getAdminInspectionsForContractor(contractorName);
      const taskInspectionResults2 = adminInspections2.filter(
        (inspection) => inspection.inspectionType === "task_inspection" && (inspection.progressComments?.includes("issues") || inspection.safetyNotes || inspection.materialsIssues) && inspection.status !== "contractor_fixed" && // Exclude already fixed issues
        inspection.status !== "approved"
        // Exclude admin-approved issues to prevent infinite loop
      ).map((inspection) => {
        const taskMatch = inspection.progressComments?.match(/Task: (.+?) - (approved|issues)/);
        const taskName = taskMatch ? taskMatch[1] : "Unknown Task";
        const status = taskMatch ? taskMatch[2] : "pending";
        return {
          id: inspection.id,
          assignmentId: inspection.assignmentId,
          contractorName,
          taskId: `inspection-${inspection.id}`,
          phase: "Inspection",
          taskName,
          inspectionStatus: status,
          notes: [
            inspection.safetyNotes,
            inspection.materialsIssues,
            inspection.nextActions
          ].filter(Boolean).join(" | "),
          photos: inspection.photoUrls || [],
          inspectedBy: inspection.inspectorName,
          inspectedAt: inspection.createdAt,
          contractorViewed: true,
          // Admin inspections are immediately visible
          contractorViewedAt: inspection.createdAt
        };
      });
      console.log("\u{1F4CB} Retrieved", taskInspectionResults2.length, "task inspection results for", contractorName);
      res.json(taskInspectionResults2);
    } catch (error) {
      console.error("Error fetching task inspection results:", error);
      res.status(500).json({ error: "Failed to fetch inspection results" });
    }
  });
  app2.post("/api/task-inspection-results/:inspectionId/mark-done", async (req, res) => {
    try {
      const { inspectionId } = req.params;
      const { contractorName, fixNotes } = req.body;
      console.log("\u2705 Contractor marking inspection as done:", { inspectionId, contractorName });
      const updatedInspection = await storage3.markInspectionResolvedByContractor(
        inspectionId,
        contractorName,
        fixNotes
      );
      if (!updatedInspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      res.json({
        success: true,
        message: "Issue marked as resolved. Waiting for admin approval.",
        inspection: updatedInspection
      });
    } catch (error) {
      console.error("Error marking inspection as resolved:", error);
      res.status(500).json({ error: "Failed to mark inspection as resolved" });
    }
  });
  app2.get("/api/contractor-fixed-inspections", async (req, res) => {
    try {
      console.log("\u{1F4CB} Fetching contractor-fixed inspections for admin review");
      const fixedInspections = await storage3.getContractorFixedInspections();
      res.json(fixedInspections);
    } catch (error) {
      console.error("Error fetching contractor-fixed inspections:", error);
      res.status(500).json({ error: "Failed to fetch contractor-fixed inspections" });
    }
  });
  app2.post("/api/contractor-fixed-inspections/:inspectionId/approve", async (req, res) => {
    try {
      const { inspectionId } = req.params;
      const { adminName } = req.body;
      console.log("\u2705 Admin approving contractor fix:", { inspectionId, adminName });
      const approvedInspection = await storage3.approveContractorFix(inspectionId, adminName);
      if (!approvedInspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      res.json({
        success: true,
        message: "Contractor fix approved successfully",
        inspection: approvedInspection
      });
    } catch (error) {
      console.error("Error approving contractor fix:", error);
      res.status(500).json({ error: "Failed to approve contractor fix" });
    }
  });
  app2.get("/api/admin/active-sessions", async (req, res) => {
    try {
      console.log("\u{1F4CA} Fetching active work sessions for admin monitoring");
      const activeSessions = await storage3.getActiveWorkSessions();
      const cleanedSessions = /* @__PURE__ */ new Map();
      activeSessions.forEach((session) => {
        let cleanName = session.contractorName.trim();
        if (cleanName === "Dalwayne Bailey") {
          cleanName = "Dalwayne Diedericks";
        }
        const existing = cleanedSessions.get(cleanName);
        if (!existing || new Date(session.startTime) > new Date(existing.startTime)) {
          cleanedSessions.set(cleanName, {
            ...session,
            contractorName: cleanName
          });
        }
      });
      const sessionsWithDuration = Array.from(cleanedSessions.values()).map((session) => {
        const startTime = new Date(session.startTime);
        const now = /* @__PURE__ */ new Date();
        const durationMs = now.getTime() - startTime.getTime();
        const durationHours = Math.floor(durationMs / (1e3 * 60 * 60));
        const durationMinutes = Math.floor(durationMs % (1e3 * 60 * 60) / (1e3 * 60));
        return {
          ...session,
          duration: `${durationHours}h ${durationMinutes}m`,
          durationMs,
          isActive: true,
          status: "clocked_in",
          workingHours: durationHours,
          workingMinutes: durationMinutes,
          startedAt: startTime.toLocaleTimeString("en-GB", {
            timeZone: "Europe/London",
            hour: "2-digit",
            minute: "2-digit"
          })
        };
      });
      console.log(`\u{1F4C8} Found ${sessionsWithDuration.length} active sessions`);
      res.json(sessionsWithDuration);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ error: "Failed to fetch active sessions" });
    }
  });
  app2.get("/api/admin/recent-activities", async (req, res) => {
    try {
      console.log("\u{1F4CA} Fetching recent clock activities for admin monitoring");
      const recentActivities = await storage3.getRecentClockActivities();
      console.log(`\u{1F550} Current server time: ${(/* @__PURE__ */ new Date()).toLocaleString("en-GB", { timeZone: "Europe/London" })}`);
      console.log(`\u{1F4CB} Recent activities found: ${recentActivities.length}`);
      recentActivities.slice(0, 3).forEach((activity, index) => {
        console.log(`\u23F0 Activity ${index + 1}: ${activity.contractorName} ${activity.activity} at ${activity.actualTime || "raw: " + activity.timestamp}`);
      });
      res.json(recentActivities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ error: "Failed to fetch recent activities" });
    }
  });
  app2.get("/api/admin/today-sessions", async (req, res) => {
    try {
      console.log("\u{1F4CA} Fetching today's work sessions for admin monitoring");
      const todaySessions = await storage3.getTodayWorkSessions();
      const contractorDailyTotals = todaySessions.reduce((acc, session) => {
        const contractorName = session.contractorName;
        if (!acc[contractorName]) {
          acc[contractorName] = {
            contractorName,
            sessions: [],
            totalDailyHours: 0,
            activeSession: null
          };
        }
        const hours = parseFloat(session.totalHours || "0");
        acc[contractorName].sessions.push(session);
        acc[contractorName].totalDailyHours += hours;
        if (session.status === "active") {
          acc[contractorName].activeSession = session;
        }
        return acc;
      }, {});
      const dailySummary = Object.values(contractorDailyTotals).map((contractor) => ({
        ...contractor,
        totalDailyHours: contractor.totalDailyHours.toFixed(2)
      }));
      console.log(`\u{1F4CA} Today's sessions: ${todaySessions.length} total, ${dailySummary.length} contractors`);
      dailySummary.forEach((contractor) => {
        console.log(`   \u{1F464} ${contractor.contractorName}: ${contractor.totalDailyHours}h (${contractor.sessions.length} sessions)`);
      });
      res.json({
        sessions: todaySessions,
        dailySummary,
        totalSessions: todaySessions.length,
        totalContractors: dailySummary.length
      });
    } catch (error) {
      console.error("Error fetching today's sessions:", error);
      res.status(500).json({ error: "Failed to fetch today's sessions" });
    }
  });
  app2.get("/api/admin/time-tracking", async (req, res) => {
    try {
      const weekEnding = req.query.weekEnding;
      console.log(`\u{1F4CA} Fetching time tracking data for week ending: ${weekEnding}`);
      if (!weekEnding) {
        return res.status(400).json({ error: "weekEnding parameter required" });
      }
      const endDate = new Date(weekEnding);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      console.log(`\u{1F4C5} Week range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
      const weekSessions = await storage3.getWorkSessionsForWeek(startDate, endDate);
      console.log(`\u{1F550} Found ${weekSessions.length} sessions for the week`);
      const contractorEarnings = weekSessions.reduce(async (accPromise, session) => {
        const acc = await accPromise;
        const contractorName = session.contractorName;
        if (!acc[contractorName]) {
          const authenticPayRate = await storage3.getContractorPayRate(contractorName);
          acc[contractorName] = {
            contractorName,
            sessions: [],
            totalHours: 0,
            hoursWorked: 0,
            hourlyRate: authenticPayRate,
            // AUTHENTIC database rate only
            grossEarnings: 0,
            cisDeduction: 0,
            netEarnings: 0,
            cisRate: 0.3,
            // Default 30% for unregistered
            gpsVerified: true
          };
        }
        const sessionHours = parseFloat(session.totalHours || "0");
        acc[contractorName].sessions.push({
          ...session,
          sessionHours: sessionHours.toFixed(2)
        });
        acc[contractorName].totalHours += sessionHours;
        acc[contractorName].hoursWorked += sessionHours;
        return acc;
      }, Promise.resolve({}));
      const resolvedContractorEarnings = await contractorEarnings;
      Object.values(resolvedContractorEarnings).forEach((contractor) => {
        const hoursWorked = contractor.hoursWorked;
        const hourlyRate = contractor.hourlyRate;
        let grossEarnings = 0;
        contractor.sessions.forEach((session) => {
          const sessionHours = parseFloat(session.sessionHours);
          const isFullDay = sessionHours >= 8;
          const dailyRate = hourlyRate * 8;
          if (isFullDay) {
            grossEarnings += dailyRate;
          } else {
            grossEarnings += sessionHours * hourlyRate;
          }
        });
        contractor.grossEarnings = grossEarnings;
        contractor.cisDeduction = contractor.grossEarnings * contractor.cisRate;
        contractor.netEarnings = contractor.grossEarnings - contractor.cisDeduction;
        contractor.grossEarnings = Math.round(contractor.grossEarnings * 100) / 100;
        contractor.cisDeduction = Math.round(contractor.cisDeduction * 100) / 100;
        contractor.netEarnings = Math.round(contractor.netEarnings * 100) / 100;
        contractor.totalHours = Math.round(contractor.totalHours * 100) / 100;
      });
      const contractors2 = Object.values(resolvedContractorEarnings);
      const weeklyTotals = {
        totalHours: contractors2.reduce((sum, c) => sum + c.totalHours, 0),
        totalGrossEarnings: contractors2.reduce((sum, c) => sum + c.grossEarnings, 0),
        totalCisDeduction: contractors2.reduce((sum, c) => sum + c.cisDeduction, 0),
        totalNetEarnings: contractors2.reduce((sum, c) => sum + c.netEarnings, 0),
        contractors: contractors2.length
      };
      console.log(`\u{1F4B0} Weekly totals: ${weeklyTotals.totalHours}h, \xA3${weeklyTotals.totalGrossEarnings} gross, \xA3${weeklyTotals.totalNetEarnings} net`);
      res.json({
        weekEnding,
        weekStart: startDate.toISOString().split("T")[0],
        weekEnd: endDate.toISOString().split("T")[0],
        contractors: contractors2,
        totals: weeklyTotals,
        sessionsCount: weekSessions.length
      });
    } catch (error) {
      console.error("Error fetching time tracking data:", error);
      res.status(500).json({ error: "Failed to fetch time tracking data" });
    }
  });
  app2.get("/api/admin/time-tracking/export", async (req, res) => {
    try {
      const weekEnding = req.query.weekEnding;
      if (!weekEnding) {
        return res.status(400).json({ error: "weekEnding parameter required" });
      }
      console.log(`\u{1F4E4} Exporting time tracking data for week ending: ${weekEnding}`);
      const timeTrackingResponse = await fetch(`http://localhost:5000/api/admin/time-tracking?weekEnding=${weekEnding}`);
      const timeTrackingData = await timeTrackingResponse.json();
      let csvContent = "Contractor Name,Total Hours,Hourly Rate,Gross Earnings,CIS Deduction,Net Earnings,Sessions Count,GPS Verified\n";
      timeTrackingData.contractors.forEach((contractor) => {
        csvContent += `"${contractor.contractorName}",${contractor.totalHours},\xA3${contractor.hourlyRate},\xA3${contractor.grossEarnings},\xA3${contractor.cisDeduction},\xA3${contractor.netEarnings},${contractor.sessions.length},Yes
`;
      });
      csvContent += `
TOTALS,${timeTrackingData.totals.totalHours},,\xA3${timeTrackingData.totals.totalGrossEarnings},\xA3${timeTrackingData.totals.totalCisDeduction},\xA3${timeTrackingData.totals.totalNetEarnings},${timeTrackingData.sessionsCount},
`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="time-tracking-week-ending-${weekEnding}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting time tracking data:", error);
      res.status(500).json({ error: "Failed to export time tracking data" });
    }
  });
  app2.get("/api/project-cashflow", async (req, res) => {
    try {
      console.log("\u{1F4B0} Fetching project cashflow data - AUTHENTIC DATA ONLY");
      const session = req.session;
      const currentAdmin = session?.adminName;
      const currentContractor = session?.contractorName;
      console.log("\u{1F510} Auth context - Admin:", currentAdmin, "Contractor:", currentContractor);
      if (currentContractor && currentContractor.toLowerCase().includes("earl")) {
        console.log("\u{1F512} Earl's contractor account - filtering for Earl-specific data only");
        res.json({
          projects: [],
          totalRevenue: 0,
          totalCosts: 0,
          netProfit: 0,
          projectCount: 0,
          message: "No projects assigned to Earl Johnson. Contact admin for job assignments."
        });
        return;
      }
      if (!currentAdmin && !currentContractor) {
        console.log("\u274C No valid authentication - returning empty data");
        res.json({
          projects: [],
          totalRevenue: 0,
          totalCosts: 0,
          netProfit: 0,
          projectCount: 0,
          message: "Authentication Required - Please log in to view cashflow data"
        });
        return;
      }
      const jobs2 = await storage3.getJobs();
      const workSessions2 = await storage3.getWorkSessions();
      if (jobs2.length === 0) {
        console.log("\u{1F4CA} No authentic job data found in database");
        res.json({
          projects: [],
          totalRevenue: 0,
          totalCosts: 0,
          netProfit: 0,
          projectCount: 0,
          message: "Data Missing from Database - No authentic project cashflow data available. Upload real job data via CSV."
        });
        return;
      }
      let filteredJobs = jobs2;
      let filteredWorkSessions = workSessions2;
      if (currentContractor) {
        filteredJobs = jobs2.filter((job) => job.contractor?.name === currentContractor);
        filteredWorkSessions = workSessions2.filter((session2) => session2.contractorName === currentContractor);
        console.log(`\u{1F512} Contractor view: ${filteredJobs.length} jobs, ${filteredWorkSessions.length} sessions for ${currentContractor}`);
      } else if (currentAdmin) {
        console.log(`\u{1F512} Admin view: ${filteredJobs.length} jobs, ${filteredWorkSessions.length} sessions for admin ${currentAdmin}`);
      }
      const projects = filteredJobs.map((job) => {
        const jobWorkSessions = filteredWorkSessions.filter(
          (session2) => session2.contractorName === job.contractor?.name && session2.location && job.location && session2.location.toLowerCase().includes(job.location.toLowerCase())
        );
        const totalHours = jobWorkSessions.reduce((sum, session2) => sum + (session2.totalHours || 0), 0);
        const contractorEarnings = Math.round(totalHours * 18);
        return {
          id: job.id,
          projectName: `${job.title} - ${job.location}`,
          startDate: job.startDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          completionDate: job.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
          totalBudget: Math.round(contractorEarnings * 1.3),
          // 30% markup
          labourCosts: contractorEarnings,
          materialCosts: 0,
          // Material costs not tracked in current system
          actualSpend: contractorEarnings,
          contractorEarnings,
          profitMargin: Math.round(contractorEarnings * 0.3),
          // 30% profit margin
          status: job.status,
          authenticWorkSessions: jobWorkSessions.length,
          totalAuthenticHours: totalHours
        };
      });
      const totalRevenue = projects.reduce((sum, p) => sum + p.totalBudget, 0);
      const totalCosts = projects.reduce((sum, p) => sum + p.actualSpend, 0);
      const netProfit = totalRevenue - totalCosts;
      console.log(`\u{1F4CA} Processed ${projects.length} authentic projects from database`);
      res.json({
        projects,
        totalRevenue,
        totalCosts,
        netProfit,
        projectCount: projects.length,
        message: "Authentic project data loaded from database",
        dataSource: `Database - ${jobs2.length} jobs, ${workSessions2.length} work sessions`
      });
    } catch (error) {
      console.error("Error fetching project cashflow:", error);
      res.status(500).json({ error: "Failed to fetch project cashflow data" });
    }
  });
  app2.get("/api/weekly-cashflow/projects", async (req, res) => {
    try {
      console.log("\u{1F4CB} API: Fetching project masters for weekly cash flow tracking");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        console.log("\u274C Unauthorized access to weekly cash flow data");
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const projects = await storage3.getProjectMasters();
      console.log(`\u2705 Retrieved ${projects.length} project masters`);
      res.json({ projects, message: "Authentic project data loaded" });
    } catch (error) {
      console.error("Error fetching project masters:", error);
      res.status(500).json({ error: "Failed to fetch project masters" });
    }
  });
  app2.post("/api/weekly-cashflow/projects", async (req, res) => {
    try {
      console.log("\u{1F195} API: Creating new project master");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const projectData = {
        ...req.body,
        createdBy: currentAdmin,
        status: "active"
      };
      const project = await storage3.createProjectMaster(projectData);
      console.log(`\u2705 Created project master: ${project.projectName}`);
      res.json({ project, message: "Project created successfully" });
    } catch (error) {
      console.error("Error creating project master:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });
  app2.get("/api/weekly-cashflow/weeks", async (req, res) => {
    try {
      console.log("\u{1F4CA} API: Fetching weekly cashflow data");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const projectId = req.query.projectId;
      const weeklyData = await storage3.getProjectCashflowWeekly(projectId);
      for (let week of weeklyData) {
        if (week.weekStartDate && week.weekEndDate && week.projectId) {
          const calculatedLabourCost = await storage3.calculateWeeklyLabourCosts(
            week.projectId,
            week.weekStartDate,
            week.weekEndDate
          );
          week.actualLabourCostCalculated = calculatedLabourCost.toFixed(2);
          const forecastedLabour = parseFloat(week.forecastedLabourCost) || 0;
          week.labourVarianceCalculated = (calculatedLabourCost - forecastedLabour).toFixed(2);
        }
      }
      console.log(`\u2705 Retrieved ${weeklyData.length} weekly cashflow records`);
      res.json({ weeklyData, message: "Authentic weekly data with calculated labour costs" });
    } catch (error) {
      console.error("Error fetching weekly cashflow:", error);
      res.status(500).json({ error: "Failed to fetch weekly cashflow data" });
    }
  });
  app2.post("/api/weekly-cashflow/weeks", async (req, res) => {
    try {
      console.log("\u{1F4B0} API: Creating weekly cashflow forecast");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const weeklyData = {
        ...req.body,
        dataValidated: false,
        validatedBy: null,
        labourDataSource: "work_sessions"
        // MANDATORY: Only authentic source
      };
      if (weeklyData.projectId && weeklyData.weekStartDate && weeklyData.weekEndDate) {
        const actualLabourCost = await storage3.calculateWeeklyLabourCosts(
          weeklyData.projectId,
          weeklyData.weekStartDate,
          weeklyData.weekEndDate
        );
        weeklyData.actualLabourCost = actualLabourCost.toFixed(2);
        weeklyData.labourVariance = (actualLabourCost - (parseFloat(weeklyData.forecastedLabourCost) || 0)).toFixed(2);
        console.log(`\u{1F4CA} Calculated actual labour cost: \xA3${actualLabourCost.toFixed(2)}`);
      }
      const cashflow = await storage3.createProjectCashflowWeekly(weeklyData);
      console.log(`\u2705 Created weekly cashflow: ${cashflow.projectName} - ${cashflow.weekStartDate}`);
      res.json({ cashflow, message: "Weekly forecast created with authentic labour calculations" });
    } catch (error) {
      console.error("Error creating weekly cashflow:", error);
      res.status(500).json({ error: "Failed to create weekly cashflow" });
    }
  });
  app2.get("/api/weekly-cashflow/materials", async (req, res) => {
    try {
      console.log("\u{1F6D2} API: Fetching material purchases");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const projectId = req.query.projectId;
      const weekStart = req.query.weekStart;
      const materials = await storage3.getMaterialPurchases(projectId, weekStart);
      console.log(`\u2705 Retrieved ${materials.length} material purchase records`);
      res.json({ materials, message: "Authentic material purchase data loaded" });
    } catch (error) {
      console.error("Error fetching material purchases:", error);
      res.status(500).json({ error: "Failed to fetch material purchases" });
    }
  });
  app2.post("/api/weekly-cashflow/materials", async (req, res) => {
    try {
      console.log("\u{1F6D2} API: Creating material purchase record");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const materialData = {
        ...req.body,
        uploadedBy: currentAdmin,
        dataSource: req.body.dataSource || "manual_entry"
      };
      const material = await storage3.createMaterialPurchase(materialData);
      console.log(`\u2705 Created material purchase: ${material.supplierName} - \xA3${material.totalCost}`);
      res.json({ material, message: "Material purchase recorded successfully" });
    } catch (error) {
      console.error("Error creating material purchase:", error);
      res.status(500).json({ error: "Failed to create material purchase" });
    }
  });
  app2.get("/api/weekly-cashflow/dashboard", async (req, res) => {
    try {
      console.log("\u{1F4C8} API: Generating weekly cash flow dashboard data");
      const session = req.session;
      const currentAdmin = session?.adminName;
      if (!currentAdmin) {
        res.status(401).json({ error: "Admin authentication required" });
        return;
      }
      const projectId = req.query.projectId;
      const [projects, weeklyData, materials] = await Promise.all([
        storage3.getProjectMasters(),
        storage3.getProjectCashflowWeekly(projectId),
        storage3.getMaterialPurchases(projectId)
      ]);
      let totalForecastedSpend = 0;
      let totalActualSpend = 0;
      let totalLabourVariance = 0;
      let totalMaterialVariance = 0;
      for (let week of weeklyData) {
        if (week.weekStartDate && week.weekEndDate && week.projectId) {
          const calculatedLabourCost = await storage3.calculateWeeklyLabourCosts(
            week.projectId,
            week.weekStartDate,
            week.weekEndDate
          );
          week.actualLabourCostCalculated = calculatedLabourCost;
          totalActualSpend += calculatedLabourCost;
          const forecastedLabour = parseFloat(week.forecastedLabourCost) || 0;
          totalForecastedSpend += forecastedLabour;
          totalLabourVariance += calculatedLabourCost - forecastedLabour;
        }
        const materialCost = parseFloat(week.actualMaterialCost) || 0;
        const forecastedMaterialCost = parseFloat(week.forecastedMaterialCost) || 0;
        totalActualSpend += materialCost;
        totalForecastedSpend += forecastedMaterialCost;
        totalMaterialVariance += materialCost - forecastedMaterialCost;
      }
      const currentProject = projects.find((p) => p.id === projectId);
      const projectProgress = currentProject ? parseFloat(currentProject.completionPercent) || 0 : 0;
      const budgetUsed = currentProject ? totalActualSpend / parseFloat(currentProject.totalBudget) * 100 : 0;
      const dashboardData = {
        summary: {
          totalProjects: projects.length,
          activeProjects: projects.filter((p) => p.status === "active").length,
          totalForecastedSpend: totalForecastedSpend.toFixed(2),
          totalActualSpend: totalActualSpend.toFixed(2),
          totalVariance: (totalActualSpend - totalForecastedSpend).toFixed(2),
          labourVariance: totalLabourVariance.toFixed(2),
          materialVariance: totalMaterialVariance.toFixed(2),
          projectProgress: projectProgress.toFixed(1),
          budgetUsed: budgetUsed.toFixed(1)
        },
        projects,
        weeklyData,
        materials: materials.slice(0, 10),
        // Recent materials only
        authenticity: {
          dataSource: "database_work_sessions",
          calculationMethod: "authentic_pay_rates",
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          complianceLevel: "mandatory_rules_enforced"
        }
      };
      console.log(`\u2705 Dashboard data generated - ${projects.length} projects, ${weeklyData.length} weeks`);
      res.json(dashboardData);
    } catch (error) {
      console.error("Error generating dashboard data:", error);
      res.status(500).json({ error: "Failed to generate dashboard data" });
    }
  });
  return httpServer;
}

// server-cashflow/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "three": path.resolve(import.meta.dirname, "node_modules/three")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  },
  optimizeDeps: {
    include: ["three"]
  }
});

// server-cashflow/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    root: path2.resolve(import.meta.dirname, "..", "client-cashflow"),
    resolve: {
      ...vite_config_default.resolve,
      alias: {
        ...vite_config_default.resolve?.alias,
        "@": path2.resolve(import.meta.dirname, "..", "client-cashflow", "src")
      }
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client-cashflow",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server-cashflow/index.ts
console.log("Starting server-cashflow/index.ts...");
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
async function startAutomaticLogoutService() {
  const { storage: storage5 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  console.log("\u{1F550} Starting automatic logout service (time + GPS proximity)...");
  function calculateGPSDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function getPostcodeCoordinates(postcode) {
    const postcodeMap = {
      "DA17 5DB": { latitude: "51.4851", longitude: "0.1540" },
      "DA17": { latitude: "51.4851", longitude: "0.1540" },
      "DA7 6HJ": { latitude: "51.4851", longitude: "0.1540" },
      "DA7": { latitude: "51.4851", longitude: "0.1540" },
      "BR6 9HE": { latitude: "51.361", longitude: "0.106" },
      "BR6": { latitude: "51.361", longitude: "0.106" },
      "BR9": { latitude: "51.4612", longitude: "0.1388" },
      "SE9": { latitude: "51.4629", longitude: "0.0789" },
      "DA8": { latitude: "51.4891", longitude: "0.2245" },
      "DA1": { latitude: "51.4417", longitude: "0.2056" },
      "SG1 1EH": { latitude: "51.8721", longitude: "-0.2015" },
      "SG1": { latitude: "51.8721", longitude: "-0.2015" },
      "ME5 9GX": { latitude: "51.335996", longitude: "0.530215" },
      "ME5": { latitude: "51.335996", longitude: "0.530215" }
    };
    const upperPostcode = postcode.toUpperCase().trim();
    if (postcodeMap[upperPostcode]) {
      return postcodeMap[upperPostcode];
    }
    const postcodePrefix = upperPostcode.split(" ")[0];
    if (postcodeMap[postcodePrefix]) {
      return postcodeMap[postcodePrefix];
    }
    return null;
  }
  setInterval(async () => {
    try {
      const now = /* @__PURE__ */ new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const allSessions = await storage5.getAllActiveSessions();
      if (currentHour >= 17) {
        for (const session of allSessions) {
          const endTime = new Date(session.startTime);
          endTime.setHours(17, 0, 0, 0);
          await storage5.updateWorkSession(session.id, {
            endTime,
            status: "completed"
          });
          console.log(`\u{1F550} AUTO-LOGOUT (5PM): ${session.contractorName} clocked out at 5:00 PM`);
        }
      } else {
        const { getContractorLocation: getContractorLocation2 } = await Promise.resolve().then(() => (init_location_tracker(), location_tracker_exports));
        for (const session of allSessions) {
          try {
            const currentLocation = getContractorLocation2(session.contractorName.trim());
            console.log(`\u{1F50D} Checking GPS for ${session.contractorName.trim()}: ${currentLocation ? "LOCATION FOUND" : "NO LOCATION DATA"}`);
            if (currentLocation) {
              console.log(`\u{1F4CD} Location found for ${session.contractorName}: ${currentLocation.latitude}, ${currentLocation.longitude}`);
              const allJobs = await storage5.getJobs();
              let nearestJobSite = null;
              let nearestDistance = Infinity;
              let isNearAnyJobSite = false;
              for (const job of allJobs) {
                if (job.location) {
                  const jobSiteCoords = getPostcodeCoordinates(job.location);
                  if (jobSiteCoords) {
                    const jobSiteLat = parseFloat(jobSiteCoords.latitude);
                    const jobSiteLon = parseFloat(jobSiteCoords.longitude);
                    const distance = calculateGPSDistance(
                      currentLocation.latitude,
                      currentLocation.longitude,
                      jobSiteLat,
                      jobSiteLon
                    );
                    if (distance < nearestDistance) {
                      nearestDistance = distance;
                      nearestJobSite = {
                        location: job.location,
                        distance,
                        jobTitle: job.title
                      };
                    }
                    if (distance <= 3500) {
                      isNearAnyJobSite = true;
                    }
                  }
                }
              }
              console.log(`\u{1F50D} GPS DEBUG for ${session.contractorName}:`);
              console.log(`   \u{1F4CD} Current GPS: ${currentLocation.latitude}, ${currentLocation.longitude}`);
              console.log(`   \u{1F3D7}\uFE0F Nearest site: ${nearestJobSite ? nearestJobSite.location : "NONE FOUND"}`);
              console.log(`   \u{1F4CF} Distance: ${Math.round(nearestDistance)}m`);
              console.log(`   \u2705 Within range (3500m = 3.5km)? ${isNearAnyJobSite}`);
              const currentHour2 = now.getHours();
              const isWorkingHours = currentHour2 >= 8 && currentHour2 < 17;
              console.log(`   \u{1F550} Working hours (8-17)? ${isWorkingHours} (current: ${currentHour2})`);
              if (!isNearAnyJobSite) {
                if (isWorkingHours) {
                  console.log(`\u{1F7E1} TEMPORARILY AWAY: ${session.contractorName} - outside job site during work hours (timer continues)`);
                  const existingDeparture = await storage5.getActiveDeparture(session.contractorName, session.id);
                  if (!existingDeparture) {
                    await storage5.createTemporaryDeparture({
                      contractorName: session.contractorName,
                      workSessionId: session.id,
                      departureTime: /* @__PURE__ */ new Date(),
                      status: "away",
                      distanceFromSite: nearestJobSite ? Math.round(nearestDistance).toString() : null,
                      nearestJobSite: nearestJobSite ? nearestJobSite.location : null
                    });
                    console.log(`\u{1F4CD} DEPARTURE LOGGED: ${session.contractorName} marked as temporarily away`);
                  }
                  const nearestInfo = nearestJobSite ? `${Math.round(nearestDistance)}m from nearest site (${nearestJobSite.location})` : "no job sites found";
                  console.log(`\u{1F4CD} DEPARTURE TRACKING: ${session.contractorName} - ${nearestInfo}`);
                } else {
                  const endTime = /* @__PURE__ */ new Date();
                  await storage5.updateWorkSession(session.id, {
                    endTime,
                    status: "completed"
                  });
                  const nearestInfo = nearestJobSite ? `${Math.round(nearestDistance)}m from nearest site (${nearestJobSite.location})` : "no job sites found";
                  console.log(`\u{1F4CD} AUTO-LOGOUT (AFTER-HOURS): ${session.contractorName} auto-logged out - ${nearestInfo}`);
                }
              } else {
                const activeDeparture = await storage5.getActiveDeparture(session.contractorName, session.id);
                if (activeDeparture) {
                  await storage5.updateTemporaryDeparture(activeDeparture.id, {
                    returnTime: /* @__PURE__ */ new Date(),
                    status: "returned"
                  });
                  console.log(`\u{1F7E2} RETURNED TO SITE: ${session.contractorName} back on job site (timer continuous)`);
                }
                if (nearestJobSite && nearestDistance <= 3500) {
                  const currentAssignments = await storage5.getContractorAssignments(session.contractorName.trim());
                  if (currentAssignments.length === 0 || currentAssignments[0].workLocation !== nearestJobSite.location) {
                    console.log(`\u{1F504} AUTO-ASSIGNMENT DETECTED: ${session.contractorName} near ${nearestJobSite.location} (${nearestJobSite.jobTitle})`);
                  }
                }
                const statusInfo = nearestJobSite ? `${Math.round(nearestDistance)}m from ${nearestJobSite.location}` : "monitoring all sites";
                console.log(`\u{1F4CD} MULTI-SITE TRACKING: ${session.contractorName} - ${statusInfo} \u2705`);
              }
            } else {
              const assignments = await storage5.getContractorAssignments(session.contractorName.trim());
              if (assignments.length > 0 && session.startLatitude && session.startLongitude) {
                const assignment = assignments[0];
                const workLocation = assignment.workLocation;
                const jobSiteCoords = getPostcodeCoordinates(workLocation);
                if (jobSiteCoords) {
                  const jobSiteLat = parseFloat(jobSiteCoords.latitude);
                  const jobSiteLon = parseFloat(jobSiteCoords.longitude);
                  const contractorLat = parseFloat(session.startLatitude);
                  const contractorLon = parseFloat(session.startLongitude);
                  const distance = calculateGPSDistance(contractorLat, contractorLon, jobSiteLat, jobSiteLon);
                  const currentHour2 = now.getHours();
                  const isWorkingHours = currentHour2 >= 8 && currentHour2 < 17;
                  console.log(`\u{1F50D} FALLBACK GPS CHECK for ${session.contractorName}:`);
                  console.log(`   \u{1F4CD} Start GPS: ${session.startLatitude}, ${session.startLongitude}`);
                  console.log(`   \u{1F3D7}\uFE0F Job site: ${workLocation}`);
                  console.log(`   \u{1F4CF} Distance: ${Math.round(distance)}m`);
                  console.log(`   \u{1F550} Working hours (8-17)? ${isWorkingHours} (current: ${currentHour2})`);
                  if (distance > 500) {
                    if (isWorkingHours) {
                      console.log(`\u{1F7E1} TEMPORARILY AWAY (FALLBACK): ${session.contractorName} - ${Math.round(distance)}m from job site during work hours (timer continues)`);
                    } else {
                      const endTime = /* @__PURE__ */ new Date();
                      await storage5.updateWorkSession(session.id, {
                        endTime,
                        status: "completed"
                      });
                      console.log(`\u{1F4CD} AUTO-LOGOUT (GPS-FALLBACK): ${session.contractorName} auto-logged out - ${Math.round(distance)}m from job site (${workLocation})`);
                    }
                  } else {
                    console.log(`\u2705 CONTRACTOR ON SITE (FALLBACK): ${session.contractorName} within ${Math.round(distance)}m of ${workLocation} - session continues`);
                  }
                }
              }
            }
          } catch (gpsError) {
            console.error(`\u274C GPS proximity check error for ${session.contractorName}:`, gpsError);
          }
        }
      }
      if (currentMinute % 5 === 0 && currentHour < 17) {
        const activeSessions = await storage5.getAllActiveSessions();
        if (activeSessions.length > 0) {
          console.log(`\u{1F550} MULTI-SITE MONITORING: ${activeSessions.length} active contractors, auto-logout at 5:00 PM or if >500m from ALL sites`);
        }
      }
    } catch (error) {
      console.error("\u274C Error in automatic logout service:", error);
    }
  }, 3e4);
}
(async () => {
  const server = await registerRoutes(app);
  await startAutomaticLogoutService();
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.CASHFLOW_PORT || process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0"
  }, () => {
    log(`serving on port ${port}`);
  });
})();
