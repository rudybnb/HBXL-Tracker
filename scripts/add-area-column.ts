
import 'dotenv/config';
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding 'area' column to 'rooms' table...");
        await db.execute(sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS area text`);
        console.log("✅ Column added successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to add column:", error);
        process.exit(1);
    }
}

main();
