
import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

// Replicate db.ts logic to ensure connection
const databaseUrl = process.env.DATABASE_URL
    ? process.env.DATABASE_URL
    : `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;

console.log(`🔌 Connecting to: ${databaseUrl.replace(/:[^:@]*@/, ':****@')}`); // Log masked URL

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool);

async function verifySchema() {
    try {
        console.log("🧪 Testing schema by inserting a dummy extracted element...");

        // 1. Get a job ID (any job)
        const jobs = await db.execute(sql`SELECT id FROM jobs LIMIT 1`);
        if (jobs.rows.length === 0) {
            console.log("⚠️ No jobs found to test against. Cannot verify FK.");
            return;
        }
        const jobId = jobs.rows[0].id;

        // 2. Get a file ID
        const files = await db.execute(sql`SELECT id FROM job_files WHERE job_id = ${jobId} LIMIT 1`);
        let fileId;
        if (files.rows.length === 0) {
            console.log("⚠️ No files found. Creating dummy file record for test...");
            const newFile = await db.execute(sql`
            INSERT INTO job_files (job_id, filename, original_name, file_url, file_type)
            VALUES (${jobId}, 'test.png', 'test.png', 'http://test.com', 'image/png')
            RETURNING id
        `);
            fileId = newFile.rows[0].id;
        } else {
            fileId = files.rows[0].id;
        }

        // 3. Try to insert with NEW columns
        const result = await db.execute(sql`
      INSERT INTO extracted_elements (
        job_id, file_id, element_type, description, unit, rate, total, room_name
      ) VALUES (
        ${jobId}, ${fileId}, 'test_socket', 'Test Unit Column', 'nr', 10, 10, 'Test Room'
      )
      RETURNING id, unit
    `);

        console.log("✅ SUCCESS! Inserted row ID:", result.rows[0].id);
        console.log("✅ Column 'unit' verified:", result.rows[0].unit);

        // Cleanup
        await db.execute(sql`DELETE FROM extracted_elements WHERE element_type = 'test_socket'`);
        console.log("🧹 Cleanup complete.");

    } catch (err) {
        console.error("❌ SCHEMA VERIFICATION FAILED:", err);

        if (err.message.includes('column "unit" of relation "extracted_elements" does not exist')) {
            console.log("⚠️ DIAGNOSIS: The column is indeed missing. Running fix...");
            await fixSchema();
        }
    } finally {
        await pool.end();
    }
}

async function fixSchema() {
    try {
        console.log("🛠️ Applying schema patch...");
        await db.execute(sql`
          ALTER TABLE extracted_elements
          ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'nr',
          ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT '0',
          ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT '0',
          ADD COLUMN IF NOT EXISTS room_name TEXT;
        `);
        console.log("✅ Schema patched. Retrying verification...");
        await verifySchema();
    } catch (err) {
        console.error("❌ FIX FAILED:", err);
    }
}

verifySchema();
