
import 'dotenv/config';
import { db } from '../server/db';
import { jobFiles } from '../shared/schema';
import { IfcAgent } from '../server/agents/ifc-agent';
import * as path from 'path';
import * as fs from 'fs';

async function verify() {
    console.log("Checking DB for file...");
    const files = await db.select().from(jobFiles);
    const target = files.find(f => f.fileName && (f.fileName.toLowerCase().includes('polyline') || f.fileName.toLowerCase().endsWith('.ifc')));

    if (!target) {
        console.log("No file found.");
        return;
    }

    console.log(`Found ID: ${target.id}`);
    console.log(`DB Path: ${target.filePath}`);

    // Resolve path
    let filePath = target.filePath;
    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(process.cwd(), filePath);
    }
    console.log(`Resolved Path: ${filePath}`);

    if (fs.existsSync(filePath)) {
        console.log(`File exists on disk (Size: ${fs.statSync(filePath).size} bytes)`);
    } else {
        console.error(`❌ File NOT found on disk!`);
        return;
    }

    // Process
    console.log("Running Agent on this EXACT file...");
    const agent = new IfcAgent();
    try {
        const result = await agent.process(filePath);
        console.log("---- RESULT ----");
        console.log("Success:", result.success);
        console.log("Error:", result.error);
        console.log("Rooms found:", result.rooms.length);
        result.rooms.forEach(r => console.log(` - ${r.name} (${r.area} sqm)`));
    } catch (e) {
        console.error("Agent failed:", e);
    }
}

verify();
