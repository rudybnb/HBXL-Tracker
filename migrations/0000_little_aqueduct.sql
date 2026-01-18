CREATE TYPE "public"."contractor_status" AS ENUM('available', 'busy', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('LABOUR', 'MATERIAL', 'PLANT', 'SUBCONTRACTOR');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'assigned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'cancelled', 'temporarily_away');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "admin_inspections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" text NOT NULL,
	"inspector_name" text NOT NULL,
	"inspection_type" text NOT NULL,
	"work_quality_rating" text NOT NULL,
	"weather_conditions" text NOT NULL,
	"progress_comments" text NOT NULL,
	"safety_notes" text,
	"materials_issues" text,
	"next_actions" text,
	"photo_urls" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" text NOT NULL,
	"event_time" text NOT NULL,
	"duration_minutes" text DEFAULT '30' NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"reminder_set" boolean DEFAULT true NOT NULL,
	"event_type" text DEFAULT 'reminder' NOT NULL,
	"participants" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contractor_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"telegram_id" text,
	"full_address" text NOT NULL,
	"city" text NOT NULL,
	"postcode" text NOT NULL,
	"has_right_to_work" text DEFAULT 'false' NOT NULL,
	"passport_number" text NOT NULL,
	"passport_photo_uploaded" text DEFAULT 'false' NOT NULL,
	"has_public_liability" text DEFAULT 'false' NOT NULL,
	"cis_status" text NOT NULL,
	"utr_number_details" text NOT NULL,
	"is_cis_registered" text DEFAULT 'false' NOT NULL,
	"has_valid_cscs" text DEFAULT 'false' NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"sort_code" text NOT NULL,
	"account_number" text NOT NULL,
	"emergency_name" text NOT NULL,
	"emergency_phone" text NOT NULL,
	"relationship" text NOT NULL,
	"primary_trade" text NOT NULL,
	"years_experience" text NOT NULL,
	"has_own_tools" text DEFAULT 'false' NOT NULL,
	"tools_list" text,
	"admin_cis_verification" text,
	"admin_pay_rate" text,
	"admin_notes" text,
	"username" text,
	"password" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"contractor_name" text NOT NULL,
	"contractor_phone" text,
	"message_text" text NOT NULL,
	"contractor_id" text NOT NULL,
	"telegram_user_id" text,
	"received_at" text NOT NULL,
	"form_sent" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "contractor_reports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"assignment_id" text NOT NULL,
	"report_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"specialty" text NOT NULL,
	"status" "contractor_status" DEFAULT 'available' NOT NULL,
	"rating" text DEFAULT '0' NOT NULL,
	"active_jobs" text DEFAULT '0' NOT NULL,
	"completed_jobs" text DEFAULT '0' NOT NULL,
	CONSTRAINT "contractors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"role" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"status" "upload_status" DEFAULT 'processing' NOT NULL,
	"jobs_count" text DEFAULT '0' NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"email_type" text DEFAULT 'outgoing' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"calendar_event_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_elements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"file_id" varchar NOT NULL,
	"element_type" text NOT NULL,
	"element_code" text,
	"description" text NOT NULL,
	"dimensions" text,
	"quantity" text DEFAULT '1',
	"unit" text DEFAULT 'nr',
	"rate" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) DEFAULT '0',
	"room_name" text,
	"location" text,
	"material" text,
	"notes" text,
	"linked_cost_item_id" varchar,
	"raw_json" text,
	"page" integer DEFAULT 1,
	"bbox" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" text NOT NULL,
	"contractor_name" text NOT NULL,
	"notification_type" text NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"inspection_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "job_assignments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"work_location" text NOT NULL,
	"hbxl_job" text NOT NULL,
	"build_phases" text[] NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"special_instructions" text,
	"status" text DEFAULT 'assigned' NOT NULL,
	"send_telegram_notification" boolean DEFAULT false,
	"latitude" text,
	"longitude" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_cost_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"category" "cost_category" NOT NULL,
	"description" text NOT NULL,
	"quantity" text DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'Each' NOT NULL,
	"rate" text DEFAULT '0' NOT NULL,
	"total" text DEFAULT '0' NOT NULL,
	"supplier" text,
	"source_metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"uploaded_by" text DEFAULT 'user',
	"extraction_status" text DEFAULT 'pending',
	"extraction_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"contractor_id" varchar,
	"contractor_name" text,
	"due_date" text NOT NULL,
	"start_date" text,
	"notes" text,
	"upload_id" varchar,
	"phases" text,
	"phase_task_data" text,
	"telegram_notified" text DEFAULT 'false',
	"latitude" text,
	"longitude" text,
	"external_code" text,
	"client_name" text,
	"project_type" text,
	"address" text,
	"postcode" text,
	"quoted_amount" text,
	"financial_summary" text
);
--> statement-breakpoint
CREATE TABLE "material_purchases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"project_name" text NOT NULL,
	"purchase_week" text NOT NULL,
	"supplier_name" text NOT NULL,
	"invoice_number" text NOT NULL,
	"purchase_date" text NOT NULL,
	"item_description" text NOT NULL,
	"quantity" text NOT NULL,
	"unit_cost" text NOT NULL,
	"total_cost" text NOT NULL,
	"category" text NOT NULL,
	"data_source" text DEFAULT 'uploaded_invoice' NOT NULL,
	"invoice_file_url" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"meeting_date" text NOT NULL,
	"meeting_time" text NOT NULL,
	"duration_minutes" text DEFAULT '60' NOT NULL,
	"location" text,
	"participants" text NOT NULL,
	"organizer_email" text NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"meeting_type" text DEFAULT 'business' NOT NULL,
	"calendar_event_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payable_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"rate" text NOT NULL,
	"total" text NOT NULL,
	"assigned_contractor_id" varchar,
	"assigned_contractor_name" text,
	"assigned_date" timestamp,
	"status" "room_status" DEFAULT 'not_started' NOT NULL,
	"hbxl_source_phase" text,
	"hbxl_original_qty" text,
	"room_allocation_percent" text DEFAULT '100',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cashflow_weekly" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"project_name" text NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"week_number" text NOT NULL,
	"forecasted_labour_cost" text DEFAULT '0' NOT NULL,
	"forecasted_material_cost" text DEFAULT '0' NOT NULL,
	"forecasted_total_spend" text DEFAULT '0' NOT NULL,
	"actual_labour_cost" text DEFAULT '0' NOT NULL,
	"actual_material_cost" text DEFAULT '0' NOT NULL,
	"actual_total_spend" text DEFAULT '0' NOT NULL,
	"cumulative_spend" text DEFAULT '0' NOT NULL,
	"remaining_budget" text DEFAULT '0' NOT NULL,
	"project_completion_percent" text DEFAULT '0' NOT NULL,
	"budget_used_percent" text DEFAULT '0' NOT NULL,
	"labour_variance" text DEFAULT '0' NOT NULL,
	"material_variance" text DEFAULT '0' NOT NULL,
	"total_variance" text DEFAULT '0' NOT NULL,
	"labour_data_source" text DEFAULT 'work_sessions' NOT NULL,
	"material_data_source" text DEFAULT 'manual' NOT NULL,
	"data_validated" boolean DEFAULT false NOT NULL,
	"validated_by" text,
	"validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_master" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" text NOT NULL,
	"client_name" text NOT NULL,
	"project_type" text NOT NULL,
	"start_date" text NOT NULL,
	"estimated_end_date" text NOT NULL,
	"actual_end_date" text,
	"total_budget" text NOT NULL,
	"quoted_price" text NOT NULL,
	"labour_budget" text NOT NULL,
	"material_budget" text NOT NULL,
	"weekly_breakdown" text,
	"supplier_breakdown" text,
	"resource_breakdown" text,
	"status" text DEFAULT 'active' NOT NULL,
	"completion_percent" text DEFAULT '0' NOT NULL,
	"budget_data_source" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_master_project_name_unique" UNIQUE("project_name")
);
--> statement-breakpoint
CREATE TABLE "room_elements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"name" text NOT NULL,
	"measurement_summary" text,
	"subtotal" text DEFAULT '0',
	"hbxl_source_phase" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"file_id" varchar,
	"name" text NOT NULL,
	"floor" text,
	"notes" text,
	"status" "room_status" DEFAULT 'not_started' NOT NULL,
	"total_value" text DEFAULT '0',
	"page" integer DEFAULT 1,
	"bbox" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_inspection_results" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" text NOT NULL,
	"contractor_name" text NOT NULL,
	"task_id" text NOT NULL,
	"phase" text NOT NULL,
	"task_name" text NOT NULL,
	"inspection_status" text NOT NULL,
	"notes" text,
	"photos" text[],
	"inspected_by" text NOT NULL,
	"inspected_at" timestamp DEFAULT now() NOT NULL,
	"contractor_viewed" boolean DEFAULT false NOT NULL,
	"contractor_viewed_at" timestamp,
	"contractor_marked_done" boolean DEFAULT false NOT NULL,
	"contractor_marked_done_at" timestamp,
	"contractor_fix_notes" text,
	"admin_reapproved_by" text,
	"admin_reapproved_at" timestamp,
	"admin_reapproval_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_progress" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"assignment_id" text NOT NULL,
	"task_id" text NOT NULL,
	"phase" text NOT NULL,
	"task_description" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporary_departures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"work_session_id" varchar,
	"departure_time" timestamp NOT NULL,
	"return_time" timestamp,
	"status" text DEFAULT 'away' NOT NULL,
	"distance_from_site" text,
	"nearest_job_site" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"job_site_location" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"total_hours" text,
	"start_latitude" text,
	"start_longitude" text,
	"end_latitude" text,
	"end_longitude" text,
	"status" "session_status" DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "email_records" ADD CONSTRAINT "email_records_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_elements" ADD CONSTRAINT "extracted_elements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_elements" ADD CONSTRAINT "extracted_elements_file_id_job_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."job_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_elements" ADD CONSTRAINT "extracted_elements_linked_cost_item_id_job_cost_items_id_fk" FOREIGN KEY ("linked_cost_item_id") REFERENCES "public"."job_cost_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cost_items" ADD CONSTRAINT "job_cost_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_files" ADD CONSTRAINT "job_files_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_upload_id_csv_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."csv_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_element_id_room_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "public"."room_elements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_items" ADD CONSTRAINT "payable_items_assigned_contractor_id_contractors_id_fk" FOREIGN KEY ("assigned_contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_elements" ADD CONSTRAINT "room_elements_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_file_id_job_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."job_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_departures" ADD CONSTRAINT "temporary_departures_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE no action ON UPDATE no action;