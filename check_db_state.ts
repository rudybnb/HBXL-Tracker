
import { db } from "./server/db";
import { jobFiles, extractedElements } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkData() {
    const jobId = "70c72dda-9af5-4f97-aae9-777092dc435c";
    console.log("Checking for Job:", jobId);

    const files = await db.select().from(jobFiles).where(eq(jobFiles.jobId, jobId));
    console.log("Files found:", files.length);
    files.forEach(f => {
        console.log(` - File: ${f.filename} (ID: ${f.id})`);
        console.log(`   Status: ${f.extractionStatus}`);
    });

    const elements = await db.select().from(extractedElements).where(eq(extractedElements.jobId, jobId));
    console.log("Elements found:", elements.length);
    if (elements.length > 0) {
        console.log("First 3 elements:");
        elements.slice(0, 3).forEach(e => {
            console.log(` - [${e.elementType}] ${e.description}`);
            console.log(`   BBox: ${e.dimensions}`);
            console.log(`   Geom: ${e.geometry ? e.geometry.substring(0, 50) + "..." : "NULL"}`);
            // Check rawJson for the 'width' property we added
            console.log(`   RawJson: ${e.rawJson}`);
        });
    }
    process.exit(0);
}

checkData();
