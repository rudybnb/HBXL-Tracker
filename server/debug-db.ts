
import * as dotfrom from "dotenv";
dotfrom.config();
import { db } from "./db";
import { extractedElements, rooms } from "@shared/schema";
import { eq } from "drizzle-orm";

async function run() {
    try {
        console.log("🔍 Checking DB for Extracted Elements...");
        const allElements = await db.select().from(extractedElements);

        console.log(`Found ${allElements.length} elements.`);

        for (const el of allElements) {
            console.log(`ID: ${el.id}, Type: ${el.elementType}, Desc: ${el.description}`);
            console.log(`   Dimension: ${el.dimensions}`);
            console.log(`   BBox: ${el.bbox}`);
            console.log(`   Geometry: ${el.geometry ? el.geometry.substring(0, 50) + "..." : "null"}`);
            console.log("---------------------------------------------------");
        }

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

run();
