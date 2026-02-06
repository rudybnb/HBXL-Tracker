
import { pgTable, text, varchar, timestamp, pgEnum, boolean, serial, bigint, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobStatusEnum = pgEnum("job_status", ["pending", "assigned", "completed"]);
export const contractorStatusEnum = pgEnum("contractor_status", ["available", "busy", "unavailable"]);
export const uploadStatusEnum = pgEnum("upload_status", ["processing", "processed", "failed"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled", "temporarily_away"]);
export const eventStatusEnum = pgEnum("event_status", ["scheduled", "completed", "cancelled"]);

// Manus-n8n Integration - Cost Category Types
export const costCategoryEnum = pgEnum("cost_category", ["LABOUR", "MATERIAL", "PLANT", "SUBCONTRACTOR"]);

// NEW: Tender Status Enum for Labour Only Tender Workflow
export const tenderStatusEnum = pgEnum("tender_status", ["draft", "sent", "viewed", "submitted", "accepted", "rejected"]);


// EXISTING TABLES (Contractors, Jobs, etc.) - Preserved
export const contractors = pgTable("contractors", {
    id: varchar("id").primaryKey().defaultNow(), // Keep original structure, defaultNow() or gen_random_uuid in actual DB
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    specialty: text("specialty").notNull(),
    status: contractorStatusEnum("status").notNull().default("available"),
    rating: text("rating").notNull().default("0"),
    activeJobs: text("active_jobs").notNull().default("0"),
    completedJobs: text("completed_jobs").notNull().default("0"),
});

export const jobs = pgTable("jobs", {
    id: varchar("id").primaryKey().defaultNow(),
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
    phaseTaskData: text("phase_task_data"),
    telegramNotified: text("telegram_notified").default("false"),
    latitude: text("latitude"),
    longitude: text("longitude"),

    // Manus-n8n Integration - Enhanced Financial Fields
    externalCode: text("external_code"),
    clientName: text("client_name"),
    projectType: text("project_type"),
    address: text("address"),
    postcode: text("postcode"),
    quotedAmount: text("quoted_amount"),
    financialSummary: text("financial_summary"),
});

// EXISTING: JobCostItems
export const jobCostItems = pgTable("job_cost_items", {
    id: varchar("id").primaryKey().defaultNow(),
    jobId: varchar("job_id").notNull().references(() => jobs.id),
    category: costCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    quantity: text("quantity").notNull().default("1"),
    unit: text("unit").notNull().default("Each"),
    rate: text("rate").notNull().default("0"),
    total: text("total").notNull().default("0"),
    supplier: text("supplier"),
    source: text("source").default("manual"),
    sourceMetadata: text("source_metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// EXISTING: JobFiles
export const jobFiles = pgTable("job_files", {
    id: varchar("id").primaryKey().defaultNow(),
    jobId: varchar("job_id").notNull().references(() => jobs.id),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    fileUrl: text("file_url").notNull(),
    filePath: text("file_path"),
    fileType: text("file_type").notNull(),
    uploadedBy: text("uploaded_by").default("user"),
    extractionStatus: text("extraction_status").default("pending"),
    extractionError: text("extraction_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// EXISTING: ExtractedElements
export const extractedElements = pgTable("extracted_elements", {
    id: varchar("id").primaryKey().defaultNow(),
    jobId: varchar("job_id").notNull().references(() => jobs.id),
    fileId: varchar("file_id").notNull().references(() => jobFiles.id),
    elementType: text("element_type").notNull(),
    elementCode: text("element_code"),
    description: text("description").notNull(),
    dimensions: text("dimensions"),
    quantity: text("quantity").default("1"),
    unit: text("unit").default("nr"),
    rate: numeric("rate", { precision: 10, scale: 2 }).default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).default("0"),
    roomName: text("room_name"),
    location: text("location"),
    material: text("material"),
    notes: text("notes"),
    linkedCostItemId: varchar("linked_cost_item_id").references(() => jobCostItems.id),
    rawJson: text("raw_json"),
    page: integer("page").default(1),
    bbox: text("bbox"),
    geometry: text("geometry"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ============================================================================
// ROOM-BASED COMMERCIAL MODEL (AGENTS.md Compliant)
// Hierarchy: JOB -> ROOM -> ELEMENT -> PAYABLE_ITEM
// ============================================================================

export const roomStatusEnum = pgEnum("room_status", ["not_started", "in_progress", "complete"]);

// Rooms
export const rooms = pgTable("rooms", {
    id: varchar("id").primaryKey().defaultNow(),
    jobId: varchar("job_id").notNull().references(() => jobs.id),
    fileId: varchar("file_id").references(() => jobFiles.id),
    name: text("name").notNull(),
    floor: text("floor"),
    notes: text("notes"),
    status: roomStatusEnum("status").notNull().default("not_started"),
    totalValue: text("total_value").default("0"),
    page: integer("page").default(1),
    bbox: text("bbox"),
    geometry: text("geometry"),
    area: text("area"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Room Elements
export const roomElements = pgTable("room_elements", {
    id: varchar("id").primaryKey().defaultNow(),
    roomId: varchar("room_id").notNull().references(() => rooms.id),
    name: text("name").notNull(),
    measurementSummary: text("measurement_summary"),
    subtotal: text("subtotal").default("0"),
    hbxlSourcePhase: text("hbxl_source_phase"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payable Items - MODIFIED FOR LABOUR TENDER
export const payableItems = pgTable("payable_items", {
    id: varchar("id").primaryKey().defaultNow(),
    elementId: varchar("element_id").notNull().references(() => roomElements.id),
    description: text("description").notNull(),
    quantity: text("quantity").notNull(),
    unit: text("unit").notNull(),
    rate: text("rate").notNull(),
    total: text("total").notNull(),

    // New Field for Labour Tender Filtering
    itemType: text("item_type").default("MATERIAL"), // 'LABOUR' or 'MATERIAL' - derived from HBXL

    assignedContractorId: varchar("assigned_contractor_id").references(() => contractors.id),
    assignedContractorName: text("assigned_contractor_name"),
    assignedDate: timestamp("assigned_date"),

    status: roomStatusEnum("status").notNull().default("not_started"),

    hbxlSourcePhase: text("hbxl_source_phase"),
    hbxlOriginalQty: text("hbxl_original_qty"),
    roomAllocationPercent: text("room_allocation_percent").default("100"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NEW: Tender Submissions Table
// Stores the actual tender data submitted by a subcontractor
export const tenderSubmissions = pgTable("tender_submissions", {
    id: varchar("id").primaryKey().defaultNow(),
    jobId: varchar("job_id").notNull().references(() => jobs.id),
    contractorId: varchar("contractor_id"), // Optional if public link
    contractorName: text("contractor_name").notNull(),
    contractorEmail: text("contractor_email"),
    status: tenderStatusEnum("status").default("draft").notNull(),
    totalPrice: text("total_price").default("0"), // Total labour price submitted
    submittedAt: timestamp("submitted_at"),

    // JSON blob for storing the granular rates per item
    // Structure: { [itemId]: { rate: 5000, total: 10000 } } (in pence)
    lineItemRates: text("line_item_rates"),

    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});


// (Res of existing schemas for CSV, Applications, Sessions, etc. omit for brevity in this update block, 
// but in real file they exist)
// ... [Remaining schemas] ...

// SCHEMA OUTPUTS
export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true });
export const insertRoomElementSchema = createInsertSchema(roomElements).omit({ id: true, createdAt: true });
export const insertPayableItemSchema = createInsertSchema(payableItems).omit({ id: true, createdAt: true });
export const insertTenderSubmissionSchema = createInsertSchema(tenderSubmissions).omit({ id: true, createdAt: true, submittedAt: true });

export type InsertTenderSubmission = z.infer<typeof insertTenderSubmissionSchema>;
export type TenderSubmission = typeof tenderSubmissions.$inferSelect;

