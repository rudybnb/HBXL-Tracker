
import 'dotenv/config';
import { db } from "../server/db";
import { rooms, extractedElements, jobFiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const JOB_ID = "70c72dda-9af5-4f97-aae9-777092dc435c";

async function inspect() {
    console.log("🔍 Inspecting Job:", JOB_ID);

    try {
        // 1. Check Job Files
        const files = await db.select().from(jobFiles).where(eq(jobFiles.jobId, JOB_ID));
        console.log(`\n📂 Files (${files.length}):`);
        files.forEach(f => console.log(` - ${f.filename} (${f.extractionStatus}) ID: ${f.id}`));

        // 2. Check Extracted Elements (The source of 'elementsData')
        // We simulate the SQL that likely powers /api/jobs/:id/elements
        const elements = await db.select().from(extractedElements).where(eq(extractedElements.jobId, JOB_ID));
        console.log(`\n🧩 Extracted Elements (${elements.length}):`);

        // Filter for Walls to see their geometry
        const walls = elements.filter(e => e.elementType?.toLowerCase().includes('wall'));
        console.log(`Found ${walls.length} walls.`);

        if (walls.length > 0) {
            console.log("\n🧱 Sample Wall Data (First 3):");
            walls.slice(0, 3).forEach((w, i) => {
                console.log(`\n--- Wall ${i + 1} ---`);
                console.log(`ID: ${w.id}`);
                console.log(`Desc: ${w.description}`);
                console.log(`BBox (Type: ${typeof w.bbox}):`, w.bbox);
                console.log(`Length of bbox str: ${w.bbox ? w.bbox.length : 0}`);
                console.log(`Geometry (Type: ${typeof w.geometry}):`, w.geometry);
                console.log(`Length of geom str: ${w.geometry ? w.geometry.length : 0}`);

                // Try parsing
                try {
                    const parsedG = w.geometry ? JSON.parse(w.geometry) : null;
                    console.log("Parsed Geometry Type:", Array.isArray(parsedG) ? "Array" : typeof parsedG);
                } catch (e) {
                    console.log("❌ Geometry Parse Error:", e);
                }
            });
        }

        // 3. Check Rooms (The source of 'roomsData')
        const roomData = await db.select().from(rooms).where(eq(rooms.jobId, JOB_ID));
        console.log(`\n🏠 Rooms (${roomData.length}):`);
        if (roomData.length > 0) {
            console.log("Sample Room 1:", roomData[0]);
        }

    } catch (e) {
        console.error("Critical Error during inspection:", e);
    }
}

inspect().then(() => process.exit());
