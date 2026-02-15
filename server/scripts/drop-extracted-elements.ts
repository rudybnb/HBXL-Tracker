
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function dropTable() {
    console.log("🗑️ Dropping extracted_elements table...");
    try {
        await db.execute(sql`DROP TABLE IF EXISTS extracted_elements CASCADE;`);
        console.log("✅ Table dropped.");
    } catch (e) {
        console.error("❌ Error dropping table:", e);
    }
    process.exit(0);
}

dropTable();
