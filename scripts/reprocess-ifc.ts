
import 'dotenv/config';
import { db } from '../server/db';
import { jobFiles, extractedElements, rooms } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { IfcAgent } from '../server/agents/ifc-agent';
import * as path from 'path';

async function reprocess() {
    // Find file
    const files = await db.select().from(jobFiles);
    console.log(`Checking ${files.length} files in DB...`);
    files.forEach(f => console.log(` - ${f.filename}`));

    // Find the file. It might be named with timestamp prefix or original name
    const target = files.find(f => f.filename && (f.filename.toLowerCase().includes('polyline') || f.filename.toLowerCase().endsWith('.ifc')));

    if (!target) {
        console.log("No IFC file found in DB.");
        return;
    }

    console.log(`Reprocessing ${target.filename} (ID: ${target.id})...`);

    // File path is usually absolute or relative to project root
    let filePath = target.filePath;

    // Fix: Handle null/empty path by assuming uploads directory
    if (!filePath) {
        filePath = path.join('uploads', target.filename);
        console.log(`⚠️ Path was missing, assumed: ${filePath}`);
    }

    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(process.cwd(), filePath);
    }

    console.log(`Loading: ${filePath}`);

    const agent = new IfcAgent();
    // Wrap in try-catch
    try {
        const result = await agent.process(filePath);

        if (result.success) {
            console.log(`Extraction Success: ${result.rooms.length} rooms.`);

            // Clear old elements for this file
            await db.delete(extractedElements).where(eq(extractedElements.fileId, target.id));
            await db.delete(rooms).where(eq(rooms.fileId, target.id));

            // Insert new
            // Helper to insert
            const insertEl = async (type: string, desc: string, qty: string, geom?: any, props?: any) => {
                await db.insert(extractedElements).values({
                    jobId: target.jobId,
                    fileId: target.id,
                    elementType: type,
                    description: desc || type,
                    dimensions: "0,0,0,0",
                    quantity: qty, unit: type === 'room' ? "sqm" : "nr", rate: "0", total: "0",
                    roomName: type === 'room' ? desc : "Global",
                    geometry: geom ? JSON.stringify(geom) : null,
                    rawJson: props ? JSON.stringify(props) : null
                });
            };

            // Save Rooms
            for (const room of result.rooms) {
                await insertEl("room", room.name, String(room.area), room.geometry, room.properties);
                // Add to 'rooms' table
                await db.insert(rooms).values({
                    jobId: target.jobId,
                    fileId: target.id,
                    name: room.name,
                    floor: "Ground",
                    bbox: "0,0,0,0",
                    totalValue: "0",
                    geometry: room.geometry ? JSON.stringify(room.geometry) : null
                });
            }
            // Save Elements
            for (const el of result.elements) {
                await insertEl(el.type, el.name || el.type, "1", el.geometry, null);
            }
            console.log("DB Updated.");
        } else {
            console.log("Extraction returned success=false");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
reprocess();
