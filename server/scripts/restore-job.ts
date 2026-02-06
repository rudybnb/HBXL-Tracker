
import "dotenv/config";
import { db } from "../db";
import { jobs } from "../../shared/schema";

async function restore() {
    console.log("Creating restored job...");

    // Create Job with hardcoded title specific to user's lost context
    const [job] = await db.insert(jobs).values({
        title: "Loft Conversion (Restored)",
        status: "pending",
        clientName: "Restored Client",
        location: "London, UK",
        dueDate: new Date().toISOString()
    }).returning();

    console.log(`✅ Job Created: ${job.id}`);
    process.exit(0);
}

restore().catch(e => {
    console.error(e);
    process.exit(1);
});
