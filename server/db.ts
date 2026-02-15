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
  ssl: true,
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

    console.log('✅ Manus-n8n schema initialized successfully (including DXF fittings columns)');
  } catch (error) {
    console.log('⚠️ Some Manus-n8n schema elements may already exist:', error);
  }
}