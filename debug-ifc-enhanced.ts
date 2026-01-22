
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { IfcAgent } from "./server/agents/ifc-agent";

async function testIfc() {
    console.log("🏗️ Testing Enhanced IFC Agent locally...");

    // Find the latest IFC file
    const uploadDir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
        console.error("Uploads dir not found");
        return;
    }

    const files = fs.readdirSync(uploadDir)
        .filter(f => f.endsWith('.ifc'))
        .sort((a, b) => {
            return fs.statSync(path.join(uploadDir, b)).mtime.getTime() -
                fs.statSync(path.join(uploadDir, a)).mtime.getTime();
        });

    if (files.length === 0) {
        console.error("No IFC files found.");
        return;
    }

    const filePath = path.join(uploadDir, files[0]);
    console.log(`Processing: ${filePath}`);

    try {
        const agent = new IfcAgent();
        const result = await agent.process(filePath);

        console.log("\n--- Extraction Result ---");
        console.log(`Success: ${result.success}`);
        console.log(`Rooms: ${result.rooms.length}`);
        console.log(`Elements: ${result.elements.length}`);

        if (result.elements.length > 0) {
            console.log("\nSample Elements:");
            result.elements.slice(0, 5).forEach(el => console.log(`- ${el.type}: ${el.name}`));
        }

    } catch (err) {
        console.error("Critical Error:", err);
    }
}

testIfc();
