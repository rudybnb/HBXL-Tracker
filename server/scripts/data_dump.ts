
import 'dotenv/config';
import { db } from "../db";
import { jobs, jobAssignments, packages, packageItems } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
    console.log("🔍 DIAGNOSTIC DATA DUMP");

    try {
        // 1. JOBS
        const recentJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(3);
        console.log(`\n📋 Recent Jobs (${recentJobs.length}):`);
        for (const j of recentJobs) {
            console.log(`   - ID: ${j.id}`);
            console.log(`     Title: '${j.title}'`);
            console.log(`     ExternalCode: '${j.externalCode}'`);

            const pkgs = await db.select().from(packages).where(eq(packages.jobId, j.id));
            console.log(`     📦 Packages: ${pkgs.length}`);
            if (pkgs.length > 0) {
                const samplePkg = pkgs[0];
                const items = await db.select().from(packageItems).where(eq(packageItems.packageId, samplePkg.id));
                console.log(`        Sample Pkg: '${samplePkg.name}' (Type: ${samplePkg.type}) - Items: ${items.length}`);
                if (items.length > 0) {
                    console.log(`        Sample Item: ${items[0].description} (Qty: ${items[0].quantity})`);
                }
            }
        }

        // 2. ASSIGNMENTS
        // Dynamic import to avoid schema issues if jobAssignments definition varies
        const assignments = await db.select().from(jobAssignments).orderBy(desc(jobAssignments.createdAt)).limit(3);
        console.log(`\n📋 Recent Assignments (${assignments.length}):`);
        for (const a of assignments) {
            console.log(`   - ID: ${a.id}`);
            console.log(`     HbxlJob: '${a.hbxlJob}'`);
            console.log(`     AssignedPackages: ${JSON.stringify(a.assignedPackages)}`);
        }

    } catch (e) {
        console.error("❌ ERROR:", e);
    }

    process.exit(0);
}

run();
