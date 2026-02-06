
import 'dotenv/config';
import * as path from 'path';
import { IfcAgent } from "./server/agents/ifc-agent";

async function integrationTest() {
    console.log("🚀 Starting Integration Test...");
    const filePath = path.resolve(process.cwd(), "server/wall polyline.ifc");

    // Simulate the server process
    const agent = new IfcAgent();
    try {
        const result = await agent.process(filePath);

        console.log(`\nResults: ${result.rooms.length} Rooms Detected.`);

        result.rooms.forEach((r, i) => {
            console.log(`\n[Room ${i + 1}]`);
            console.log(`  Name: ${r.name}`);
            console.log(`  Area: ${r.area} sqm`);
            console.log(`  Props: ${JSON.stringify(r.properties)}`);
            console.log(`  Poly Points: ${r.geometry.length}`);

            // Validation
            if (r.area < 1.0) console.error("  ❌ FAIL: Too small");
            if (!r.properties || !r.properties.composition) console.error("  ❌ FAIL: Missing Composition");
            else console.log("  ✅ PASS: Composition Found");
        });

    } catch (e) {
        console.error("❌ CRASH:", e);
    }
}
integrationTest();
