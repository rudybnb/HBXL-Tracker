
import { db } from "./db";
import { jobAssignments, packages, packageItems, jobs } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
    console.log("Debugging James Bond Assignment...");

    // 1. Find the assignment
    const assignments = await db.select().from(jobAssignments);
    const target = assignments.find(a => a.contractorName?.includes("Pro") || a.hbxlJob?.includes("James Bond")); // User seems to be 'Pro Pro' or viewing 'James Bond' project? 
    // Wait, the screenshot shows "Project: James Bond". The assignment might be to the current user.
    // The screenshot shows "Pro Pro" in the corner, so the logged in user is likely "Pro".

    // Let's dump all assignments to be sure
    console.log(`\nFound ${assignments.length} assignments.`);
    for (const a of assignments) {
        console.log(`\n--------------------------------------------------`);
        console.log(`ID: ${a.id}`);
        console.log(`Contractor: ${a.contractorName}`);
        console.log(`Job Name (hbxlJob): ${a.hbxlJob}`);
        console.log(`Assigned Packages (raw): ${JSON.stringify(a.assignedPackages)}`);

        let pkgIds = a.assignedPackages || [];
        if (typeof pkgIds === 'string') {
            // It might be stored as a stringified JSON if something went wrong, though schema says array.
            // Drizzle usually handles array types correctly if defined as text[].
            console.log(`Warning: assignedPackages is a string: ${pkgIds}`);
        }

        if (pkgIds.length > 0) {
            const pkgs = await db.select().from(packages).where(inArray(packages.id, pkgIds));
            console.log(`Found ${pkgs.length} packages matching IDs in assignedPackages.`);
            pkgs.forEach(p => console.log(`  - Package: ${p.id} / ${p.name} / JobId: ${p.jobId}`));

            if (pkgs.length > 0) {
                const items = await db.select().from(packageItems).where(inArray(packageItems.packageId, pkgs.map(p => p.id)));
                console.log(`  - Total Items in these packages: ${items.length}`);
            }
        } else {
            console.log("No specific packages assigned. Checking fallback resolution...");
            // Fallback logic simulation
            let targetJobId = (a as any).jobId;
            const allJobs = await db.select().from(jobs);
            const searchKey = a.hbxlJob.trim().toLowerCase();

            if (!targetJobId && a.hbxlJob) {
                const jobMatch = allJobs.find(j => j.title.trim().toLowerCase() === searchKey || (j.externalCode && j.externalCode.trim().toLowerCase() === searchKey));
                if (jobMatch) {
                    targetJobId = jobMatch.id;
                    console.log(`  - Resolved Job ID: ${targetJobId} (${jobMatch.title})`);
                } else {
                    console.log(`  - FAILED to resolve Job ID for '${a.hbxlJob}'`);
                }
            }

            if (targetJobId) {
                const jobPkgs = await db.select().from(packages).where(eq(packages.jobId, targetJobId));
                console.log(`  - Found ${jobPkgs.length} packages linked to Job ID ${targetJobId}.`);
                if (jobPkgs.length > 0) {
                    const jobItems = await db.select().from(packageItems).where(inArray(packageItems.packageId, jobPkgs.map(p => p.id)));
                    console.log(`  - Found ${jobItems.length} items in those packages.`);
                }
            }
        }
    }
}

main().catch(console.error);
