
import "dotenv/config";
import * as fs from 'fs';
import { db } from "../db";  // Fixed path ../db vs ./db based on location
import { jobs, jobCostItems } from "../../shared/schema"; // Fixed path
import { eq, desc } from "drizzle-orm";

async function simulate() {
    console.log("🚀 Starting Import Simulation...");

    // 1. Get or Create Job
    const allJobs = await db.select().from(jobs);
    let job = allJobs.find(j => j.title === "Loft Conversion (Restored)");

    if (!job) {
        console.log("⚠️ Job not found, creating it now...");
        const [newJob] = await db.insert(jobs).values({
            title: "Loft Conversion (Restored)",
            status: "pending",
            clientName: "Restored Client",
            location: "London, UK",
            dueDate: new Date().toISOString()
        }).returning();
        job = newJob;
    }
    console.log(`✅ Using Job: ${job.id}`);

    // 2. Read CSV
    const csvPath = "C:\\Users\\rudyb\\Sculpt Job Tracker\\wall 1 polyline.ifc - Material Used.csv";
    if (!fs.existsSync(csvPath)) {
        console.error("❌ CSV file not found at " + csvPath);
        process.exit(1);
    }
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    console.log(`📄 Read ${lines.length} lines from CSV`);

    // 3. Parse (Logic copied from routes.ts)
    const hbxLines: any[] = [];
    const clean = (s: string) => s ? s.replace(/^"|"$/g, '').trim() : '';
    let idCounter = 1;

    for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (cols.length < 5) continue;

        let phase = "", desc = "", type = "MATERIAL", unit = "", qty = 0, price = 0, total = 0;

        const col0 = clean(cols[0]);
        const col2 = clean(cols[2]);
        const col7 = clean(cols[7]);

        // Matching routes.ts logic exactly
        if (col0 && col2 && !col7) {
            phase = col0;
            desc = col2;
            unit = clean(cols[8]);
            qty = parseFloat(clean(cols[11] || "0").replace(/[^0-9.-]/g, ""));
            price = parseFloat(clean(cols[5] || "0").replace(/[^0-9.-]/g, ""));
            total = parseFloat(clean(cols[14] || "0").replace(/[^0-9.-]/g, ""));
        } else {
            continue; // Skip lines that don't match our target format for this test
        }

        if (isNaN(qty)) qty = 0;
        if (isNaN(price)) price = 0;
        if (isNaN(total)) total = 0;

        if (!desc) continue;

        // Type Detection (Simplified from routes.ts for simulation)
        const col3Type = clean(cols[3]).toLowerCase();
        if (col3Type) {
            if (col3Type.includes('labour')) type = "LABOUR";
            else if (col3Type.includes('plant')) type = "PLANT";
            else if (col3Type.includes('material')) type = "MATERIAL";
        } else {
            const textCheck = (desc + " " + phase).toLowerCase();
            const unitCheck = unit.toLowerCase();
            if (unitCheck.includes('hour') || unitCheck.includes('day')) type = "LABOUR";
            else if (textCheck.includes('labour') || textCheck.includes('installation')) type = "LABOUR";
            else if (textCheck.includes('plant') || textCheck.includes('hire')) type = "PLANT";
            else type = "MATERIAL";
        }

        hbxLines.push({
            phase_code: phase,
            type,
            description: desc,
            qty,
            unit,
            hbxl_total_pence: Math.round(total * 100),
            hbxl_unit_rate_pence: Math.round(price * 100)
        });
    }

    console.log(`✅ Parsed ${hbxLines.length} valid lines`);

    if (hbxLines.length === 0) {
        console.error("❌ No lines parsed! Format mismatch likely.");
        process.exit(1);
    }

    // 4. Transform for Room Mapper
    const phaseTaskData: Record<string, any[]> = {};
    for (const line of hbxLines) {
        if (!phaseTaskData[line.phase_code]) phaseTaskData[line.phase_code] = [];
        phaseTaskData[line.phase_code].push({
            description: line.description,
            quantity: line.qty,
            unit: line.unit,
            rate: line.hbxl_unit_rate_pence / 100,
            total: line.hbxl_total_pence / 100,
            category: line.type
        });
    }

    // 5. Run Room Mapper
    const { roomMapper } = await import("../room-mapper"); // Fixed path
    // Need to mock DB insert if running outside routes? No, room-mapper uses DB.

    console.log("🧹 Clearing room costs...");
    await roomMapper.clearRoomCosts(job.id);

    console.log("🏠 Allocating...");
    await roomMapper.allocateCostsToRooms(job.id, phaseTaskData);

    console.log("✅ Simulation Complete.");
    process.exit(0);
}

simulate().catch(e => { console.error(e); process.exit(1); });
