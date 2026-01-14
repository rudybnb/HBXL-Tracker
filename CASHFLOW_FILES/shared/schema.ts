import { pgTable, text, timestamp, uuid, decimal, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// CONTRACTORS TABLE
export const contractors = pgTable('contractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  payRate: decimal('pay_rate', { precision: 10, scale: 2 }).notNull().default('0.00'),
  cisRegistered: boolean('cis_registered').default(false),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// JOBS TABLE
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  address: text('address'),
  postcode: text('postcode'),
  projectType: text('project_type'),
  phases: text('phases'),
  status: text('status').default('active'),
  uploadId: uuid('upload_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// WORK SESSIONS TABLE
export const workSessions = pgTable('work_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractorName: text('contractor_name').notNull(),
  jobId: uuid('job_id'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  location: text('location'),
  gpsCoordinates: text('gps_coordinates'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// CSV UPLOADS TABLE
export const csvUploads = pgTable('csv_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull(),
  status: text('status').default('processing'),
  jobsCount: text('jobs_count').default('0'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// ADMIN SETTINGS TABLE
export const adminSettings = pgTable('admin_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// CASH FLOW SPECIFIC TABLES

// PROJECT BUDGETS
export const projectBudgets = pgTable('project_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull(),
  budgetedLabour: decimal('budgeted_labour', { precision: 12, scale: 2 }).default('0.00'),
  budgetedMaterials: decimal('budgeted_materials', { precision: 12, scale: 2 }).default('0.00'),
  budgetedTotal: decimal('budgeted_total', { precision: 12, scale: 2 }).default('0.00'),
  actualLabour: decimal('actual_labour', { precision: 12, scale: 2 }).default('0.00'),
  actualMaterials: decimal('actual_materials', { precision: 12, scale: 2 }).default('0.00'),
  actualTotal: decimal('actual_total', { precision: 12, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// MATERIAL COSTS
export const materialCosts = pgTable('material_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull(),
  description: text('description').notNull(),
  category: text('category'), // e.g., 'materials', 'equipment', 'supplies'
  supplier: text('supplier'),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1.00'),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
  phase: text('phase'), // build phase this cost belongs to
  orderDate: timestamp('order_date'),
  deliveryDate: timestamp('delivery_date'),
  invoiceNumber: text('invoice_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// WEEKLY CASHFLOW REPORTS
export const weeklyReports = pgTable('weekly_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekStarting: timestamp('week_starting').notNull(),
  weekEnding: timestamp('week_ending').notNull(),
  totalLabourCosts: decimal('total_labour_costs', { precision: 12, scale: 2 }).default('0.00'),
  totalMaterialCosts: decimal('total_material_costs', { precision: 12, scale: 2 }).default('0.00'),
  totalProjectCosts: decimal('total_project_costs', { precision: 12, scale: 2 }).default('0.00'),
  activeJobs: integer('active_jobs').default(0),
  hoursWorked: decimal('hours_worked', { precision: 8, scale: 2 }).default('0.00'),
  contractorBreakdown: jsonb('contractor_breakdown'), // JSON object with contractor costs
  projectBreakdown: jsonb('project_breakdown'), // JSON object with project costs
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// TYPE DEFINITIONS
export type Contractor = typeof contractors.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type CsvUpload = typeof csvUploads.$inferSelect;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type ProjectBudget = typeof projectBudgets.$inferSelect;
export type MaterialCost = typeof materialCosts.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;

// INSERT SCHEMAS
export const insertContractorSchema = createInsertSchema(contractors);
export const insertJobSchema = createInsertSchema(jobs);
export const insertWorkSessionSchema = createInsertSchema(workSessions);
export const insertProjectBudgetSchema = createInsertSchema(projectBudgets);
export const insertMaterialCostSchema = createInsertSchema(materialCosts);
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports);

// INSERT TYPES
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type InsertMaterialCost = z.infer<typeof insertMaterialCostSchema>;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;