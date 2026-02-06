
import 'dotenv/config';
import { IfcAgent } from '../server/agents/ifc-agent';
import * as path from 'path';
import * as fs from 'fs';

async function test() {
    const source = 'server/wall polyline.ifc';
    const target = 'server/uploads/debug_repro.ifc';

    // Copy to uploads
    if (fs.existsSync(source)) {
        if (!fs.existsSync('server/uploads')) fs.mkdirSync('server/uploads');
        fs.copyFileSync(source, target);
        console.log(`Copied ${source} to ${target}`);
    } else {
        console.error(`Source file not found: ${source}`);
        return;
    }

    const agent = new IfcAgent();
    console.log("Processing...");
    try {
        const result = await agent.process(path.resolve(target));
        console.log("---- RESULT ----");
        console.log("Success:", result.success);
        console.log("Rooms found:", result.rooms.length);
        if (result.rooms.length > 0) {
            result.rooms.forEach(r => console.log(` - ${r.name} (${r.area} sqm)`));
        } else {
            console.log("NO ROOMS FOUND.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
