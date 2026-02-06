
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as WebIFC from "web-ifc";
import { GeometricRoomDetector } from "./server/agents/geometric-room-detector";
import { IfcAgent } from "./server/agents/ifc-agent";

function dist(p1: any, p2: any) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function pointToLineDist(pt: any, v: any, w: any) {
    const l2 = Math.pow(dist(v, w), 2);
    if (l2 == 0) return dist(pt, v);
    let t = ((pt.x - v.x) * (w.x - v.x) + (pt.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return dist(pt, proj);
}

async function checkGaps() {
    const filePath = path.resolve(process.cwd(), "server/wall polyline.ifc");
    const agent = new IfcAgent();
    const result = await agent.process(filePath);
    const walls = result.elements.filter(e => e.type === 'wall');

    console.log("Checking Wall Connections (T-Junctions)...");

    const stud = walls.find(w => w.name.toLowerCase().includes('stud') || w.id === 647);
    const others = walls.filter(w => w !== stud);

    if (stud && stud.geometry) {
        const s = stud.geometry.start;
        const e = stud.geometry.end;

        console.log(`Stud Wall (${stud.id}) Geometry:`);
        console.log(`  Start: (${s.x.toFixed(2)}, ${s.y.toFixed(2)})`);
        console.log(`  End:   (${e.x.toFixed(2)}, ${e.y.toFixed(2)})`);

        others.forEach(w => {
            if (!w.geometry) return;
            const ds = pointToLineDist(s, w.geometry.start, w.geometry.end);
            const de = pointToLineDist(e, w.geometry.start, w.geometry.end);

            console.log(`  To Wall ${w.id} (${w.geometry.start.x.toFixed(0)} to ${w.geometry.end.x.toFixed(0)}):`);
            console.log(`    Dist from Stud Start: ${ds.toFixed(2)}`);
            console.log(`    Dist from Stud End:   ${de.toFixed(2)}`);
        });
    }
}
checkGaps();
