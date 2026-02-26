
import 'dotenv/config';
import { db } from "../db";
import { jobs, packages } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
    console.log("🔍 DIAGNOSTIC: Checking latest job sync status...");

    // Get last job
    const [lastJob] = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1);
    if (!lastJob) {
        console.log("❌ No jobs found in database.");
        process.exit(1);
    }

    console.log(`\n📋 Latest Job:`);
    console.log(`   ID: ${lastJob.id}`);
    console.log(`   Title: ${lastJob.title}`);
    console.log(`   ExternalCode: ${lastJob.externalCode}`);

    const p8Id = lastJob.externalCode || lastJob.id;
    console.log(`   Port 8000 Target ID: ${p8Id}`);

    // Check Port 8000
    const url = `http://localhost:8000/projects/${p8Id}/output/packages.json`;
    console.log(`\n📡 Fetching from Port 8000: ${url}`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.log(`❌ FETCH FAILED: ${res.status} ${res.statusText}`);

            // Try legacy
            const legUrl = `http://localhost:8000/projects/${p8Id}/export/rooms.v1.json`;
            console.log(`   Trying legacy url: ${legUrl}`);
            const legRes = await fetch(legUrl);
            if (!legRes.ok) {
                console.log(`❌ LEGACY FETCH FAILED: ${legRes.status}`);
            } else {
                console.log(`✅ LEGACY FETCH OK`);
                const legData = await legRes.json();
                const pkgs = legData.packages || [];
                console.log(`   Legacy Packages Count: ${pkgs.length}`);
            }
        } else {
            const data = await res.json();
            console.log(`✅ FETCH SUCCESS`);
            console.log(`   Packages returned by P8000: ${Array.isArray(data) ? data.length : 'Not Array'}`);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`   Sample Package: ${JSON.stringify(data[0].name)} (Type: ${data[0].type})`);
                console.log(`   Sample Section Count: ${data[0].sections?.length || 0}`);
                console.log(`   Sample Items Count: ${data[0].items?.length || 0}`);
            }
        }

        // Check Local Database Packages
        console.log(`\n🗄️  Checking Local Database (Port 5000)...`);
        const dbPkgs = await db.select().from(packages).where(eq(packages.jobId, lastJob.id));
        console.log(`   Packages in DB for this job: ${dbPkgs.length}`);

        if (dbPkgs.length === 0) {
            console.log(`⚠️  WARNING: No packages in DB. Sync failed or P8000 returned empty.`);
        } else {
            console.log(`✅ DB is populated.`);
        }

    } catch (e) {
        console.error("❌ CRTICAL ERROR during fetch:", e);
    }

    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
