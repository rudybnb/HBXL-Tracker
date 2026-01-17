
import dotenv from "dotenv";
dotenv.config();
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function fixDatabase() {
    try {
        console.log("🛠️ Attempting to add missing 'unit' column to extracted_elements...");

        await db.execute(sql`
      ALTER TABLE extracted_elements 
      ADD COLUMN IF NOT EXISTS unit text DEFAULT 'nr';
    `);

        console.log("✅ Successfully added 'unit' column!");
    } catch (err) {
        console.error("❌ Failed to alter table:", err);
    }
}

fixDatabase();
