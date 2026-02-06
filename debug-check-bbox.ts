
import { db } from "./server/db";
import { extractedElements } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkBBox() {
    const JOB_ID = "70c72dda-9af5-4f97-aae9-777092dc435c"; // Fixed ID from context
    console.log("Checking DB for Job:", JOB_ID);

    try {
        const results = await db.select().from(extractedElements).where(eq(extractedElements.jobId, JOB_ID));
        console.log(`Found ${results.length} total elements.`);

        const walls = results.filter(e => e.elementType === 'wall' || e.elementType === 'Internal Partition');
        console.log(`Found ${walls.length} walls.`);

        walls.forEach((w, i) => {
            console.log(`[Wall ${i}] ID: ${w.id} | Desc: ${w.description} | BBox: ${w.bbox} | RawJson: ${w.rawJson ? 'Yes' : 'No'}`);
        });

    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

checkBBox();
