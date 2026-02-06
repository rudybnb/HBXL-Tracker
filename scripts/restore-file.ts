
import 'dotenv/config';
import { db } from '../server/db';
import { jobFiles, jobs } from '../shared/schema';
import * as path from 'path';
import { eq } from 'drizzle-orm';

async function restore() {
    const filename = "1769778389161-Phillip_James.ifc";
    const jobId = "21c15aec-444e-4c3f-a05e-96a9a5ee9d67";

    // 1. Restore Job if missing
    const jobList = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (jobList.length === 0) {
        console.log("Restoring Job...");
        await db.insert(jobs).values({
            id: jobId,
            clientName: "Restored Client",
            jobName: "Restored Job",
            title: "Restored Job Title",
            location: "Restored Location",
            dueDate: "2026-01-01",
            status: "pending"
        });
    } else {
        console.log("Job exists.");
    }

    // 2. Restore File
    const fileList = await db.select().from(jobFiles).where(eq(jobFiles.filename, filename));
    if (fileList.length > 0) {
        console.log("File already exists.");
        return;
    }

    console.log("Restoring file record...");
    await db.insert(jobFiles).values({
        jobId: jobId,
        filename: filename,
        originalName: filename,
        fileUrl: '',
        filePath: path.resolve(process.cwd(), "uploads", filename),
        uploadDate: new Date(),
        fileSize: 1024,
        fileType: "application/x-step",
        status: "pending"
    });
    console.log("Restored File.");
    process.exit(0);
}

restore();
