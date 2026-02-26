
import { db } from "../db";
import { sql } from "drizzle-orm";

async function cleanup() {
    console.log("🧹 Starting System Cleanup...");

    try {
        // 1. Clean Job-related tables
        console.log("... Cleaning Task Progress");
        await db.execute(sql`TRUNCATE TABLE task_progress CASCADE`);

        console.log("... Cleaning Job Assignments");
        await db.execute(sql`TRUNCATE TABLE job_assignments CASCADE`);

        console.log("... Cleaning Package Items");
        await db.execute(sql`TRUNCATE TABLE package_items CASCADE`);

        console.log("... Cleaning Packages");
        await db.execute(sql`TRUNCATE TABLE packages CASCADE`);

        console.log("... Cleaning Room Elements");
        await db.execute(sql`TRUNCATE TABLE room_elements CASCADE`);

        console.log("... Cleaning Rooms");
        await db.execute(sql`TRUNCATE TABLE rooms CASCADE`);

        console.log("... Cleaning Jobs");
        await db.execute(sql`TRUNCATE TABLE jobs CASCADE`);

        console.log("... Cleaning CSV Uploads");
        await db.execute(sql`TRUNCATE TABLE csv_uploads CASCADE`);

        console.log("✅ Database Cleanup Complete. All jobs removed.");
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    }
    process.exit(0);
}

cleanup();
