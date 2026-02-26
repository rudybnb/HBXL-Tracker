
import { db } from "./db";
import { packages, packageItems } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking Packages...");
    const allPkgs = await db.select().from(packages);
    console.log(`Total Packages: ${allPkgs.length}`);

    const allItems = await db.select().from(packageItems);
    console.log(`Total Items: ${allItems.length}`);

    // Group by job
    const jobMap = new Map();
    for (const p of allPkgs) {
        if (!jobMap.has(p.jobId)) jobMap.set(p.jobId, 0);
        jobMap.set(p.jobId, jobMap.get(p.jobId) + 1);
    }

    console.log("\nPackages by Job ID:");
    for (const [jid, count] of jobMap) {
        console.log(`Job ${jid}: ${count} packages`);
    }
}

main().catch(console.error);
