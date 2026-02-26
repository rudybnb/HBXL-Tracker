
import { db } from "../db";
import { jobAssignments, packages, jobs, packageItems } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🔍 Debugging Assignments...");

    // 1. Find the Job
    const allJobs = await db.select().from(jobs);
    const jamesBondJob = allJobs.find(j => j.title.includes("James Bond"));

    if (!jamesBondJob) {
        console.error("❌ Job 'James Bond' not found!");
        process.exit(1);
    }
    console.log(`✅ Found Job: ${jamesBondJob.title} (ID: ${jamesBondJob.id})`);

    // 2. Check Packages for this Job
    const jobPackages = await db.select().from(packages).where(eq(packages.jobId, jamesBondJob.id));
    console.log(`📦 Found ${jobPackages.length} packages for this job.`);
    jobPackages.forEach(p => console.log(`   - ${p.name} (${p.id}) [OriginalID: ${p.originalId}]`));

    // 3. Check Assignments for this Job
    const assignments = await db.select().from(jobAssignments).where(eq(jobAssignments.hbxlJob, jamesBondJob.title));
    console.log(`👤 Found ${assignments.length} assignments for this job.`);

    if (assignments.length > 0) {
        const assignment = assignments[0];
        console.log(`   - Assigned to: ${assignment.contractorName}`);
        console.log(`   - Assigned Packages:`, assignment.assignedPackages);

        // Check if assigned packages exist in the packages table
        if (assignment.assignedPackages && assignment.assignedPackages.length > 0) {
            console.log("   - Verifying assigned packages exist...");
            for (const pkgId of assignment.assignedPackages) {
                const pkg = jobPackages.find(p => p.id === pkgId);
                console.log(`     - Package ${pkgId}: ${pkg ? "✅ Found" : "❌ NOT FOUND"}`);
            }
        } else {
            console.warn("   ⚠️ Assigned Packages array is empty/null!");
        }
    } else {
        console.warn("   ⚠️ No assignments found using title match.");
        // Try searching by similar name?
    }

    // 4. Check Items for the first package if exists
    if (jobPackages.length > 0) {
        const firstPkg = jobPackages[0];
        const items = await db.select().from(packageItems).where(eq(packageItems.packageId, firstPkg.id));
        console.log(`📝 Items in package '${firstPkg.name}': ${items.length}`);
    }

    process.exit(0);
}

main().catch(console.error);
