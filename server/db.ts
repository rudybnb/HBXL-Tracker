import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('[username]')
  ? process.env.DATABASE_URL
  : `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}/${process.env.PGDATABASE}`;

// Create a connection pool for better performance with standard Postgres
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// Initialize Drizzle with the postgres pool
export const db = drizzle(pool, { schema });

// Initialize Manus-n8n schema columns if they don't exist
export async function initManusSchema(): Promise<void> {
  try {
    console.log('🔧 Checking Manus-n8n schema columns...');

    // Add missing columns to jobs table
    await db.execute(sql`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS external_code TEXT,
      ADD COLUMN IF NOT EXISTS client_name TEXT,
      ADD COLUMN IF NOT EXISTS project_type TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS postcode TEXT,
      ADD COLUMN IF NOT EXISTS quoted_amount TEXT,
      ADD COLUMN IF NOT EXISTS financial_summary TEXT,
      ADD COLUMN IF NOT EXISTS external_job_key TEXT,
      ADD COLUMN IF NOT EXISTS external_source TEXT DEFAULT 'AG_8000',
      ADD COLUMN IF NOT EXISTS external_manifest_path TEXT
    `);

    // Create cost_category enum if it doesn't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cost_category AS ENUM ('LABOUR', 'MATERIAL', 'PLANT', 'SUBCONTRACTOR');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Create job_cost_items table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_cost_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        category cost_category NOT NULL,
        description TEXT NOT NULL,
        quantity TEXT DEFAULT '1',
        unit TEXT DEFAULT 'Each',
        rate TEXT DEFAULT '0',
        total TEXT NOT NULL DEFAULT '0',
        supplier TEXT,
        source_metadata TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Add missing columns if table already exists
    await db.execute(sql`
      ALTER TABLE job_cost_items 
      ADD COLUMN IF NOT EXISTS source_metadata TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL
    `);


    // Create extracted_elements table if it doesn't exist (IFC Data)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS extracted_elements (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
        file_id VARCHAR(36) REFERENCES job_files(id) ON DELETE CASCADE,
        original_id TEXT,
        room_name TEXT,
        element_type TEXT,
        description TEXT,
        dimensions TEXT,
        bbox TEXT,
        geometry TEXT,
        quantity TEXT DEFAULT '1',
        raw_json TEXT,
        properties TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add DXF fittings columns to rooms table
    await db.execute(sql`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS fittings TEXT,
      ADD COLUMN IF NOT EXISTS fittings_source TEXT
    `);

    // Create package enums
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE package_type AS ENUM ('ROOM', 'STRUCTURE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE package_source AS ENUM ('IFC', 'MANUAL', 'CSV');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create packages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS packages (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id VARCHAR(36) REFERENCES jobs(id),
        original_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type package_type NOT NULL,
        source package_source NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create job_assignments table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_assignments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        contractor_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        work_location TEXT NOT NULL,
        hbxl_job TEXT NOT NULL,
        build_phases TEXT[],
        assigned_packages TEXT[],
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        special_instructions TEXT,
        status TEXT NOT NULL DEFAULT 'assigned',
        send_telegram_notification BOOLEAN DEFAULT false,
        latitude TEXT,
        longitude TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure columns exist in job_assignments (if table already existed)
    await db.execute(sql`
      ALTER TABLE job_assignments 
      ADD COLUMN IF NOT EXISTS assigned_packages TEXT[],
      ADD COLUMN IF NOT EXISTS build_phases TEXT[],
      ADD COLUMN IF NOT EXISTS latitude TEXT,
      ADD COLUMN IF NOT EXISTS longitude TEXT,
      ADD COLUMN IF NOT EXISTS job_id TEXT
    `);

    // Add unique constraint on external_job_key if not exists
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE jobs ADD CONSTRAINT jobs_external_job_key_unique UNIQUE (external_job_key);
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN duplicate_table THEN null;
      END $$
    `);

    // Create package_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS package_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        package_id VARCHAR(36) NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity TEXT DEFAULT '0',
        unit TEXT,
        source TEXT,
        fix TEXT,
        trade TEXT,
        completed_quantity TEXT DEFAULT '0',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Ensure completed_quantity exists
    await db.execute(sql`
      ALTER TABLE package_items
      ADD COLUMN IF NOT EXISTS completed_quantity TEXT DEFAULT '0'
    `);

    // Add missing columns to packages table (schema.ts has ifcType)
    await db.execute(sql`
      ALTER TABLE packages
      ADD COLUMN IF NOT EXISTS ifc_type TEXT
    `);

    // Convert packages type/source from enum to TEXT (schema uses text, not enum)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE packages ALTER COLUMN type TYPE TEXT USING type::TEXT;
        ALTER TABLE packages ALTER COLUMN type SET DEFAULT 'ROOM';
        ALTER TABLE packages ALTER COLUMN type DROP NOT NULL;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE packages ALTER COLUMN source TYPE TEXT USING source::TEXT;
        ALTER TABLE packages ALTER COLUMN source SET DEFAULT 'MANUAL';
        ALTER TABLE packages ALTER COLUMN source DROP NOT NULL;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);

    // Add missing columns to package_items table
    await db.execute(sql`
      ALTER TABLE package_items
      ADD COLUMN IF NOT EXISTS qty_total TEXT DEFAULT '0',
      ADD COLUMN IF NOT EXISTS rate TEXT,
      ADD COLUMN IF NOT EXISTS total TEXT,
      ADD COLUMN IF NOT EXISTS source_tag TEXT
    `);

    // Add sort_order separately (SERIAL requires special handling)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE package_items ADD COLUMN sort_order SERIAL;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    // Add stable room identity columns
    await db.execute(sql`
      ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS external_room_key TEXT,
      ADD COLUMN IF NOT EXISTS source TEXT
    `);

    // ADDITIVE: Pricing columns on package_items
    await db.execute(sql`
      ALTER TABLE package_items
      ADD COLUMN IF NOT EXISTS unit_price TEXT,
      ADD COLUMN IF NOT EXISTS total_price TEXT,
      ADD COLUMN IF NOT EXISTS pricing_source TEXT,
      ADD COLUMN IF NOT EXISTS currency TEXT,
      ADD COLUMN IF NOT EXISTS labour_only TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS flags_json JSONB,
      ADD COLUMN IF NOT EXISTS source TEXT
    `);

    // Ensure packages also has source
    await db.execute(sql`
      ALTER TABLE packages 
      ADD COLUMN IF NOT EXISTS source TEXT
    `);

    // ADDITIVE: Budget ledger on job_finances (may not exist on all deployments)
    try {
      await db.execute(sql`
        ALTER TABLE job_finances
        ADD COLUMN IF NOT EXISTS budget_ledger TEXT
      `);
    } catch (e) {
      console.log('⚠️ job_finances table not found, skipping budget_ledger migration');
    }

    // ADDITIVE: Budget ledger on jobs table
    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS budget_ledger TEXT
    `);

    // ADDITIVE: Tender status on job_assignments
    await db.execute(sql`
      ALTER TABLE job_assignments
      ADD COLUMN IF NOT EXISTS tender_status TEXT DEFAULT 'DRAFT'
    `);

    // ADDITIVE: Assignment tender items table (contractor-scoped pricing)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS assignment_tender_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        assignment_id VARCHAR(36) NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
        package_item_id VARCHAR(36) NOT NULL REFERENCES package_items(id) ON DELETE CASCADE,
        unit_price TEXT DEFAULT '0',
        total_price TEXT DEFAULT '0',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure unique constraint on (assignment_id, package_item_id)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE assignment_tender_items 
          ADD CONSTRAINT ati_assignment_item_unique 
          UNIQUE (assignment_id, package_item_id);
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN duplicate_table THEN null;
      END $$
    `);

    // ============================================================
    // PRE-AWARD TENDER SYSTEM TABLES (all idempotent)
    // ============================================================

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tender_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        title TEXT NOT NULL,
        package_ids TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tender_request_contractors (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tender_request_id TEXT NOT NULL REFERENCES tender_requests(id) ON DELETE CASCADE,
        contractor_id TEXT NOT NULL,
        contractor_name TEXT NOT NULL,
        contractor_email TEXT,
        status TEXT NOT NULL DEFAULT 'INVITED',
        sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE tender_request_contractors
          ADD CONSTRAINT trc_unique_tender_contractor
          UNIQUE (tender_request_id, contractor_id);
      EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tender_submissions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tender_request_id TEXT NOT NULL REFERENCES tender_requests(id) ON DELETE CASCADE,
        contractor_id TEXT NOT NULL,
        contractor_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        submitted_at TIMESTAMP,
        approved_at TIMESTAMP,
        notes TEXT,
        currency TEXT DEFAULT 'GBP',
        totals_json TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE tender_submissions
          ADD CONSTRAINT ts_unique_tender_contractor
          UNIQUE (tender_request_id, contractor_id);
      EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tender_submission_items (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        submission_id TEXT NOT NULL REFERENCES tender_submissions(id) ON DELETE CASCADE,
        package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
        package_item_id TEXT NOT NULL REFERENCES package_items(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        qty TEXT DEFAULT '0',
        unit TEXT DEFAULT '',
        fix TEXT,
        trade TEXT,
        unit_price TEXT,
        total_price TEXT,
        pricing_source TEXT DEFAULT 'CONTRACTOR',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE tender_submission_items
          ADD CONSTRAINT tsi_unique_submission_item
          UNIQUE (submission_id, package_item_id);
      EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS assignment_pricing_baseline (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        assignment_id TEXT NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
        package_item_id TEXT NOT NULL REFERENCES package_items(id) ON DELETE CASCADE,
        unit_price TEXT DEFAULT '0',
        total_price TEXT DEFAULT '0',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE assignment_pricing_baseline
          ADD CONSTRAINT apb_unique_assignment_item
          UNIQUE (assignment_id, package_item_id);
      EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$
    `);

    // Fix FK constraints to add ON DELETE CASCADE (idempotent)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE tender_submission_items DROP CONSTRAINT IF EXISTS tender_submission_items_package_id_fkey;
        ALTER TABLE tender_submission_items ADD CONSTRAINT tender_submission_items_package_id_fkey
          FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE;
      EXCEPTION WHEN others THEN null; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE tender_submission_items DROP CONSTRAINT IF EXISTS tender_submission_items_package_item_id_fkey;
        ALTER TABLE tender_submission_items ADD CONSTRAINT tender_submission_items_package_item_id_fkey
          FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE CASCADE;
      EXCEPTION WHEN others THEN null; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE assignment_pricing_baseline DROP CONSTRAINT IF EXISTS assignment_pricing_baseline_package_item_id_fkey;
        ALTER TABLE assignment_pricing_baseline ADD CONSTRAINT assignment_pricing_baseline_package_item_id_fkey
          FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE CASCADE;
      EXCEPTION WHEN others THEN null; END $$
    `);

    console.log('✅ Manus-n8n schema initialized successfully (including packages & job_assignments & tender system)');

  } catch (error) {
    console.log('⚠️ Some Manus-n8n schema elements may already exist:', error);
  }
}