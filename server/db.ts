import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('[username]')
  ? process.env.DATABASE_URL
  : `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Render requires SSL for external connections
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
});
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
      ADD COLUMN IF NOT EXISTS financial_summary TEXT
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

    // Create job_files table if it doesn't exist (Fallback for migration failures)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_files (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR(36) NOT NULL REFERENCES jobs(id),
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        uploaded_by TEXT DEFAULT 'user',
        extraction_status TEXT DEFAULT 'pending',
        extraction_error TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Add extraction columns if table already exists
    await db.execute(sql`
      ALTER TABLE job_files 
      ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS extraction_error TEXT
    `);

    // Create extracted_elements table for AI extraction results
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS extracted_elements (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR(36) NOT NULL REFERENCES jobs(id),
        file_id VARCHAR(36) NOT NULL REFERENCES job_files(id),
        element_type TEXT NOT NULL,
        element_code TEXT,
        description TEXT NOT NULL,
        dimensions TEXT,
        quantity TEXT DEFAULT '1',
        unit TEXT DEFAULT 'nr',
        rate NUMERIC DEFAULT '0',
        total NUMERIC DEFAULT '0',
        room_name TEXT,
        location TEXT,
        material TEXT,
        notes TEXT,
        linked_cost_item_id VARCHAR(36) REFERENCES job_cost_items(id),
        raw_json TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Add columns if table already exists (Schema Patch)
    await db.execute(sql`
      ALTER TABLE extracted_elements
      ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'nr',
      ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT '0',
      ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT '0',
      ADD COLUMN IF NOT EXISTS room_name TEXT,
      ADD COLUMN IF NOT EXISTS page INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS bbox TEXT;
    `);

    // Create room_status enum for Room-Based Commercial Model
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE room_status AS ENUM ('not_started', 'in_progress', 'complete');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Create rooms table (AGENTS.md Room Register)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        file_id VARCHAR(36) REFERENCES job_files(id),
        name TEXT NOT NULL,
        floor TEXT,
        notes TEXT,
        status room_status NOT NULL DEFAULT 'not_started',
        total_value TEXT DEFAULT '0',
        page INTEGER DEFAULT 1,
        bbox TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Add columns to rooms table
    await db.execute(sql`
      ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS page INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS bbox TEXT,
      ADD COLUMN IF NOT EXISTS file_id VARCHAR(36) REFERENCES job_files(id);
    `);

    // CLEAN UP ORPHANS (Fixes "Key (job_id)=(...) is not present in table jobs")
    // If a job doesn't exist, its children should be removed before we enforce FK constraints
    console.log('🧹 Cleaning up database orphans...');
    await db.execute(sql`
      DELETE FROM payable_items WHERE element_id IN (SELECT id FROM room_elements WHERE room_id IN (SELECT id FROM rooms WHERE job_id NOT IN (SELECT id FROM jobs)));
      DELETE FROM room_elements WHERE room_id IN (SELECT id FROM rooms WHERE job_id NOT IN (SELECT id FROM jobs));
      DELETE FROM rooms WHERE job_id NOT IN (SELECT id FROM jobs);
      DELETE FROM extracted_elements WHERE job_id NOT IN (SELECT id FROM jobs);
      DELETE FROM job_cost_items WHERE job_id NOT IN (SELECT id FROM jobs);
      DELETE FROM job_files WHERE job_id NOT IN (SELECT id FROM jobs);
    `);

    // FIX: Update Foreign Keys to CASCADE DELETE (Fixes "Failed to delete job")
    await db.execute(sql`
      DO $$ BEGIN
        -- extracted_elements -> jobs
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extracted_elements_job_id_jobs_id_fk') THEN
          ALTER TABLE extracted_elements DROP CONSTRAINT extracted_elements_job_id_jobs_id_fk;
        END IF;
        
        -- extracted_elements -> job_files
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extracted_elements_file_id_job_files_id_fk') THEN
          ALTER TABLE extracted_elements DROP CONSTRAINT extracted_elements_file_id_job_files_id_fk;
        END IF;

        -- rooms -> jobs
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'rooms_job_id_jobs_id_fk') THEN
          ALTER TABLE rooms DROP CONSTRAINT rooms_job_id_jobs_id_fk;
        END IF;

        -- rooms -> job_files
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'rooms_file_id_job_files_id_fk') THEN
          ALTER TABLE rooms DROP CONSTRAINT rooms_file_id_job_files_id_fk;
        END IF;
      END $$;
    `);

    // Re-add constraints with CASCADE
    await db.execute(sql`
      ALTER TABLE extracted_elements 
      ADD CONSTRAINT extracted_elements_job_id_jobs_id_fk 
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

      ALTER TABLE extracted_elements 
      ADD CONSTRAINT extracted_elements_file_id_job_files_id_fk 
      FOREIGN KEY (file_id) REFERENCES job_files(id) ON DELETE CASCADE;

      ALTER TABLE rooms 
      ADD CONSTRAINT rooms_job_id_jobs_id_fk 
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

      ALTER TABLE rooms 
      ADD CONSTRAINT rooms_file_id_job_files_id_fk 
      FOREIGN KEY (file_id) REFERENCES job_files(id) ON DELETE CASCADE;
    `);

    // Create room_elements table (Elements within rooms)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS room_elements (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        room_id VARCHAR(36) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        measurement_summary TEXT,
        subtotal TEXT DEFAULT '0',
        hbxl_source_phase TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create payable_items table (Assignable level per AGENTS.md)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payable_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        element_id VARCHAR(36) NOT NULL REFERENCES room_elements(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity TEXT NOT NULL,
        unit TEXT NOT NULL,
        rate TEXT NOT NULL,
        total TEXT NOT NULL,
        assigned_contractor_id VARCHAR(36) REFERENCES contractors(id),
        assigned_contractor_name TEXT,
        assigned_date TIMESTAMP,
        status room_status NOT NULL DEFAULT 'not_started',
        hbxl_source_phase TEXT,
        hbxl_original_qty TEXT,
        room_allocation_percent TEXT DEFAULT '100',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    console.log('✅ Manus-n8n schema initialized successfully');
    console.log('✅ Room-Based Commercial Model tables created');
  } catch (error) {
    console.log('⚠️ Some schema elements may already exist:', error);
  }
}