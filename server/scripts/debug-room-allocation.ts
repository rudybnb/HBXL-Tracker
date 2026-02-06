import "dotenv/config";
import { db } from "../db";
import { jobs, rooms, roomElements, payableItems, jobCostItems } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { roomMapper } from "../room-mapper";

async function runDebug() {
    console.log("🔍 Debugging Room Allocation...");

    // 1. Find the latest job - Fetch all and sort in JS to avoid SQL issues in debug script
    const allJobs = await db.select().from(jobs);
    const latestJob = allJobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!latestJob) {
        console.error("❌ No jobs found.");
        return;
    }
    console.log(`✅ Latest Job: ${latestJob.id} ("${latestJob.title}")`);

    // 2. Check Rooms
    const jobRooms = await db.select().from(rooms).where(eq(rooms.jobId, latestJob.id));
    console.log(`🏠 Found ${jobRooms.length} rooms:`, jobRooms.map(r => r.name).join(", "));

    // 2b. Check Files
    const { jobFiles } = await import("../../shared/schema");
    const files = await db.select().from(jobFiles).where(eq(jobFiles.jobId, latestJob.id));
    console.log(`📄 Found ${files.length} files:`);
    files.forEach((f: any) => console.log(`   - ${f.filename} (${f.fileType}) | Status: ${f.extractionStatus}`));


    // 3. Check Job Cost Items (HBXL Source)
    const costItems = await db.select().from(jobCostItems).where(eq(jobCostItems.jobId, latestJob.id));
    console.log(`💰 Found ${costItems.length} job cost items (HBXL Source).`);

    if (costItems.length > 0) {
        console.log(`   Sample Item 1: ${costItems[0].description} | Category: ${costItems[0].category}`);
    }

    // 4. Check Payable Items (Room Allocated)
    // Need to find all elements for these rooms
    let totalPayableCount = 0;
    for (const room of jobRooms) {
        const elements = await db.select().from(roomElements).where(eq(roomElements.roomId, room.id));
        for (const el of elements) {
            const items = await db.select().from(payableItems).where(eq(payableItems.elementId, el.id));
            totalPayableCount += items.length;
        }
    }
    console.log(`🧾 Found ${totalPayableCount} payable items allocated to rooms.`);

    // 5. If no payable items, try to trigger allocation manually
    if (totalPayableCount === 0 && costItems.length > 0) {
        console.log("⚠️ No payable items found. Attempting manual allocation trigger...");

        // Reconstruct phaseTaskData from costItems
        const phaseTaskData: Record<string, any[]> = {};
        for (const item of costItems) {
            // Attempt to extract phase from description or metadata
            let phase = "Unknown";
            // Try parse metadata
            // In routes.ts we didn't save phase_code to DB directly, only description includes it
            // But description format is: "Description (PhaseCode)"
            const phaseMatch = item.description.match(/\((.*?)\)$/);
            if (phaseMatch) {
                phase = phaseMatch[1];
            }

            if (!phaseTaskData[phase]) phaseTaskData[phase] = [];

            phaseTaskData[phase].push({
                description: item.description,
                quantity: parseFloat(item.quantity) || 0,
                unit: item.unit,
                rate: parseFloat(item.rate) || 0, // already in pounds in DB? No, schema says pounds?
                // Schema: rate: text("rate").notNull().default("0"), // Unit rate in pence ??
                // Wait, routes.ts saves it as: String(task.hbxl_unit_rate_pence / 100) -> POUNDS
                // So in DB it is POUNDS.
                total: parseFloat(item.total) || 0, // POUNDS
                category: item.category
            });
        }

        console.log("🔄 Triggering roomMapper.allocateCostsToRooms...");
        await roomMapper.allocateCostsToRooms(latestJob.id, phaseTaskData);
        console.log("✅ Allocation complete.");
    }

    process.exit(0);
}

runDebug().catch(console.error);
