
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as WebIFC from "web-ifc";

async function trace() {
    const filePath = path.resolve(process.cwd(), "server/wall polyline.ifc");
    const ifcApi = new WebIFC.IfcAPI();
    await ifcApi.Init();
    const modelID = ifcApi.OpenModel(new Uint8Array(fs.readFileSync(filePath)));

    // IDs to watch
    const watchList = new Set([180, 174, 173, 95, 94, 48, 47, 46, 34]);

    const visit = (id: number, depth: number) => {
        const indent = "  ".repeat(depth);
        // Corrected: Get type from the line object
        const line = ifcApi.GetLine(modelID, id);
        const type = line.type;

        let label = String(id);
        if (watchList.has(id)) label += " <--- WATCH";

        console.log(`${indent}Visit ${label} (Type ${type})`);

        if (type === WebIFC.IFCCARTESIANPOINT) {
            console.log(`${indent}FOUND POINT!`);
            console.log(`${indent}Coords:`, line.Coordinates);
            return;
        }

        const structFields = ['Representation', 'Representations', 'Items', 'OuterCurve', 'Points', 'Polygon', 'SweptArea', 'FbsmFaces', 'CfsFaces', 'Faces', 'Bounds', 'Bound'];

        for (const f of structFields) {
            const val = line[f];
            if (val) {
                console.log(`${indent}  Field ${f} found`);
                if (Array.isArray(val)) {
                    val.forEach(v => {
                        if (v.value) visit(v.value, depth + 1);
                    });
                } else if (val.value) {
                    visit(val.value, depth + 1);
                }
            }
        }
    };

    console.log("Starting Trace on Wall 180...");
    visit(180, 0);
}
trace();
