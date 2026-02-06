
import { db } from "./server/db";
import { extractedElements } from "@shared/schema";
import { like, eq } from "drizzle-orm";

async function check() {
    console.log("Checking Wall Elements in DB...");
    try {
        const walls = await db.select().from(extractedElements);

        console.log(`Total Extracted Elements: ${walls.length}`);

        // Filter in JS to match client logic
        const jsWalls = walls.filter(w =>
            (w.elementType || '').toLowerCase().includes('wall') ||
            (w.description || '').toLowerCase().includes('wall')
        );

        console.log(`Potential Walls found: ${jsWalls.length}`);

        if (jsWalls.length > 0) {
            console.log("--- Sample Walls ---");
            jsWalls.slice(0, 5).forEach(w => {
                console.log(`ID: ${w.id}`);
                console.log(`Type: ${w.elementType}`);
                console.log(`Desc: ${w.description}`);
                console.log(`Dimensions (BBox): ${w.dimensions}`);
                console.log(`Geometry (Raw): ${typeof w.geometry === 'string' ? w.geometry.substring(0, 50) + "..." : w.geometry}`);

                // Try parsing geometry
                let geom = w.geometry;
                if (typeof geom === 'string') {
                    try { geom = JSON.parse(geom); } catch (e) { geom = "INVALID JSON"; }
                }
                console.log(`Geometry (Parsed):`, JSON.stringify(geom));
                console.log("----------------");
            });
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
