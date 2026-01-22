
import 'dotenv/config';
import { db } from "./server/db";
import { jobFiles } from "./shared/schema";
import { desc } from "drizzle-orm";

async function checkLatestError() {
    console.log("🔍 Checking latest file upload status...");

    const files = await db.select().from(jobFiles).orderBy(desc(jobFiles.createdAt)).limit(1);

    if (files.length === 0) {
        console.log("No files found.");
        return;
    }

    const file = files[0];
    console.log(`\n📁 File: ${file.filename}`);
    console.log(`   Original Name: ${file.originalName}`);
    console.log(`   Status: ${file.extractionStatus}`);
    console.log(`   Error: ${file.extractionError || "None"}`);

    process.exit(0);
}

checkLatestError().catch(console.error);
