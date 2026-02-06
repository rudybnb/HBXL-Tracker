
import 'dotenv/config';
import * as path from 'path';
import { IfcAgent } from "./server/agents/ifc-agent";

async function run() {
    const filePath = path.resolve(process.cwd(), "server/wall polyline.ifc");
    console.log(`Analyzing: ${filePath}`);

    try {
        const agent = new IfcAgent();
        const result = await agent.process(filePath);

        console.log(`\n--- RESULTS ---`);
        console.log(`Rooms Detected: ${result.rooms.length}`);
        result.rooms.forEach(r => {
            console.log(`Room: ${r.name}`);
            console.log(`  Area: ${r.area} sqm`);
            console.log(`  Perimeter: ${r.perimeter} m`);
            console.log(`  BBox: ${JSON.stringify(r.bbox)}`);
        });

        console.log(`\nWalls:`);
        const walls = result.elements.filter(e => e.type === 'wall');
        walls.forEach(w => {
            console.log(`  ${w.name} (ID: ${w.id})`);
            if (w.geometry) {
                console.log(`    Start: (${w.geometry.start.x.toFixed(2)}, ${w.geometry.start.y.toFixed(2)})`);
                console.log(`    End:   (${w.geometry.end.x.toFixed(2)}, ${w.geometry.end.y.toFixed(2)})`);
            } else {
                console.log(`    NO GEOMETRY`);
            }
        });
    } catch (err) {
        console.error("Analysis Failed:", err);
    }
}
run();
