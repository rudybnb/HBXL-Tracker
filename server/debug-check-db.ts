
import "dotenv/config";
import { db } from "./db";
import { jobs, jobCostItems } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function checkDb() {
    console.log("🔍 Checking DB State...");
    // console.log("DB URL: ", process.env.DATABASE_URL?.split('@')[1]); // Log part of URL for safety

    const allJobs = await db.select().from(jobs);
    console.log(`Found ${allJobs.length} jobs total.`);

    allJobs.forEach(j => console.log(` - ${j.id}: ${j.title} (Status: ${j.status})`));

    if (allJobs.length > 0) {
        const job = allJobs[0];
        const items = await db.select().from(jobCostItems).where(eq(jobCostItems.jobId, job.id));
        console.log(`Job ${job.id} has ${items.length} cost items.`);
    }

    process.exit(0);
}

checkDb().catch(console.error);
