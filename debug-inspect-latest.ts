
import 'dotenv/config';
import { db } from "./server/db";
import { rooms, jobFiles } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

async function inspect() {
    console.log("🔍 Inspecting Latest Job Data...");

    // Get latest file
    const files = await db.select().from(jobFiles).orderBy(desc(jobFiles.createdAt)).limit(1);
    if (files.length === 0) {
        console.log("❌ No files found.");
        return;
    }
    const file = files[0];
    console.log(`📂 Latest File: ${file.originalName} (ID: ${file.id})`);
    console.log(`   Status: ${file.extractionStatus}`);

    // Get rooms
    const roomList = await db.select().from(rooms).where(eq(rooms.fileId, file.id));
    console.log(`🏠 Rooms found: ${roomList.length}`);

    if (roomList.length > 0) {
        const r = roomList[0];
        console.log(`   Room 1: ${r.name}`);
        console.log(`   BBox: ${r.bbox}`);
        console.log(`   Geometry Length: ${r.geometry?.length}`);
        console.log(`   Geometry Preview: ${r.geometry?.substring(0, 100)}...`);

        // Try parsing
        try {
            const geo = JSON.parse(r.geometry || "null");
            console.log(`   ✅ Geometry Parse Success. Type: ${Array.isArray(geo) ? "Array" : typeof geo}`);
            if (Array.isArray(geo) && geo.length > 0) {
                console.log(`   First Point: ${JSON.stringify(geo[0])}`);
            }
        } catch (e) {
            console.log(`   ❌ Geometry Parse Failed: ${e}`);
        }
    } else {
        console.log("   ❌ No rooms row found in DB.");
    }
    process.exit(0);
}

inspect().catch(console.error);
