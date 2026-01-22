
import 'dotenv/config';
import { db } from "./server/db";
import { extractedElements, jobs } from "./shared/schema";
import { desc } from "drizzle-orm";

async function check() {
    try {
        console.log("Checking DB...");

        // Check Jobs
        const jobList = await db.select().from(jobs).orderBy(desc(jobs.id)).limit(5);
        console.log("\n--- Recent Jobs ---");
        jobList.forEach(j => console.log(`ID: ${j.id} | Code: ${j.code} | Client: ${j.client_name}`));

        // Check Elements
        const els = await db.select().from(extractedElements).orderBy(desc(extractedElements.id)).limit(20);
        console.log(`\n--- Recent Elements (${els.length}) ---`);
        els.forEach(e => console.log(`ID: ${e.id} | JobID: ${e.jobId} | [${e.elementType}] ${e.description}`));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
