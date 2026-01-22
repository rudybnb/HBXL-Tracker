
import 'dotenv/config';
import * as path from 'path';
import { IfcAgent } from "./server/agents/ifc-agent";

async function testIfc() {
    console.log("🏗️ Testing IFC Agent locally...");
    const filePath = path.resolve(process.cwd(), "test_minimal.ifc");

    // Check if file exists (since I don't have the exact filename from the user maybe? I got it from the debug output previously)
    // 1769090375606-IFC2_TEST.ifc

    console.log(`Processing: ${filePath}`);

    try {
        const agent = new IfcAgent();
        const result = await agent.process(filePath);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Critical Error:", err);
    }
}

testIfc();
