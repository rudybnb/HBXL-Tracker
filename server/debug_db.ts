
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { jobs } from "@shared/schema";
import { eq } from "drizzle-orm";

async function debug() {
    console.log("--- DEBUG START ---");

    // 1. Check FS
    const projectRoot = "C:/Brudys/job_data";
    if (fs.existsSync(projectRoot)) {
        console.log(`FS: ${projectRoot} exists.`);
        try {
            const dirs = fs.readdirSync(projectRoot, { withFileTypes: true });
            console.log(`FS: Found ${dirs.length} entries.`);
            dirs.forEach(d => console.log(` - ${d.name} (${d.isDirectory() ? 'DIR' : 'FILE'})`));
        } catch (e) {
            console.error("FS: Error reading dir:", e);
        }
    } else {
        console.error(`FS: ${projectRoot} DOES NOT EXIST.`);
    }

    // 2. Check DB Jobs
    try {
        const allJobs = await db.select().from(jobs);
        console.log(`DB: Found ${allJobs.length} jobs.`);
        allJobs.forEach(j => console.log(` - Job: ${j.id} | ${j.title} | ${j.externalCode}`));
    } catch (e) {
        console.error("DB: Error selecting jobs:", e);
    }

    // 3. Try Insert
    try {
        console.log("DB: Attempting to insert Test Job...");
        const [inserted] = await db.insert(jobs).values({
            title: "DEBUG TEST JOB",
            location: "Debug Land",
            dueDate: new Date().toISOString(),
            status: "pending",
            externalCode: "DEBUG-001"
        }).returning();
        console.log("DB: Inserted:", inserted);
    } catch (e) {
        console.error("DB: Insert Failed:", e);
    }

    console.log("--- DEBUG END ---");
    process.exit(0);
}

debug();
