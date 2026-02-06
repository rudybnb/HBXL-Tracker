
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as WebIFC from "web-ifc";

async function inspect() {
    const filePath = path.resolve(process.cwd(), "server/wall polyline.ifc");
    const ifcApi = new WebIFC.IfcAPI();
    await ifcApi.Init();
    const modelID = ifcApi.OpenModel(new Uint8Array(fs.readFileSync(filePath)));

    // Inspect Wall 180 -> Rep 173 -> Item 95 (Fbsm) -> 94 (ConnectedFaceSet)
    const deepID = 94;
    const deepObj = ifcApi.GetLine(modelID, deepID);
    console.log(`--- OBJECT ${deepID} ---`);
    console.log(JSON.stringify(deepObj, null, 2));

    if (deepObj.CfsFaces) {
        const faceID = deepObj.CfsFaces[0].value;
        const face = ifcApi.GetLine(modelID, faceID);
        console.log(`\n--- FACE ${faceID} ---`);
        console.log(JSON.stringify(face, null, 2));

        if (face.Bounds) {
            const boundID = face.Bounds[0].value;
            const bound = ifcApi.GetLine(modelID, boundID);
            console.log(`\n--- BOUND ${boundID} ---`);
            console.log(JSON.stringify(bound, null, 2));

            if (bound.Bound) {
                const polyID = bound.Bound.value;
                const poly = ifcApi.GetLine(modelID, polyID);
                console.log(`\n--- POLYLOOP ${polyID} ---`);
                console.log(JSON.stringify(poly, null, 2));

                if (poly.Polygon) {
                    console.log("Points found!");
                    // This confirms path: CfsFaces -> Bounds -> Bound -> Polygon
                }
            }
        }
    }
}
inspect();
