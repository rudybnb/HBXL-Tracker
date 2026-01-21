
import 'dotenv/config';
import { db } from "./server/db";
import { jobFiles, rooms, extractedElements } from "./shared/schema";
import { desc, eq } from "drizzle-orm";

async function checkExtraction() {
    console.log("🔍 Checking latest file uploads...");

    const files = await db.select().from(jobFiles).orderBy(desc(jobFiles.createdAt)).limit(1);

    if (files.length === 0) {
        console.log("No files found.");
        return;
    }

    const file = files[0];
    console.log(`\n📁 File: ${file.filename} (ID: ${file.id})`);
    console.log(`   Type: ${file.fileType}`);
    console.log(`   Status: ${file.extractionStatus}`);
    console.log(`   Error: ${file.extractionError || "None"}`);

    const fileRooms = await db.select().from(rooms).where(eq(rooms.fileId, file.id));
    console.log(`\n🏠 Extracted Rooms: ${fileRooms.length}`);
    fileRooms.forEach(r => console.log(`   - ${r.name} (Layer: ${r.bbox ? "Yes" : "No"})`));

    const fileElements = await db.select().from(extractedElements).where(eq(extractedElements.fileId, file.id));
    console.log(`\n⚡ Extracted Elements: ${fileElements.length}`);
    fileElements.forEach(e => console.log(`   - ${e.description} (${e.elementType})`));

    process.exit(0);
}

checkExtraction().catch(console.error);
