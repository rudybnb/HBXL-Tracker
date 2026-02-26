
import { db } from "./db";
import { jobAssignments, packages, packageItems, jobs } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking DB...");

    const assignments = await db.select().from(jobAssignments);
    console.log(`Found ${assignments.length} assignments.`);

    for (const a of assignments) {
        console.log(`\nAssignment: ${a.contractorName} - ${a.hbxlJob} (ID: ${a.id})`);
        console.log(`Assigned Packages:`, a.assignedPackages);
        // console.log(`Legacy Phases:`, a.buildPhases);

        if (a.assignedPackages && a.assignedPackages.length > 0) {
            console.log("Has assigned packages IDs.");
        } else {
            console.log("No specific packages assigned. Trying fallback resolution...");
            let targetJobId = (a as any).jobId;
            if (!targetJobId && a.hbxlJob) {
                const jobByTitle = await db.select().from(jobs).where(eq(jobs.title, a.hbxlJob));
                if (jobByTitle.length > 0) {
                    targetJobId = jobByTitle[0].id;
                    console.log(`Resolved via Title: ${a.hbxlJob} -> Job ID: ${targetJobId}`);
                } else {
                    const jobByCode = await db.select().from(jobs).where(eq(jobs.externalCode, a.hbxlJob));
                    if (jobByCode.length > 0) {
                        targetJobId = jobByCode[0].id;
                        console.log(`Resolved via External Code: ${a.hbxlJob} -> Job ID: ${targetJobId}`);
                    } else {
                        console.log(`Could NOT resolve job from hbxlJob: '${a.hbxlJob}'`);
                    }
                }
            }

            if (targetJobId) {
                const pkgs = await db.select().from(packages).where(eq(packages.jobId, targetJobId));
                console.log(`Found ${pkgs.length} packages for Job ID ${targetJobId}.`);
                if (pkgs.length > 0) {
                    const items = await db.select().from(packageItems).where(eq(packageItems.packageId, pkgs[0].id)); // check first pkg
                    console.log(`First package '${pkgs[0].name}' has ${items.length} items.`);
                }
            }
        }
    }

    if (assignments.length === 0) {
        console.log("No assignments found. Checking Jobs...");
        const allJobs = await db.select().from(jobs);
        console.log(`Found ${allJobs.length} jobs.`);
        allJobs.forEach(j => console.log(`Job: ${j.title} (ID: ${j.id})`));
    }
}

main().catch(console.error);
