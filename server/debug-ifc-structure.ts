
import * as WebIFC from "web-ifc";
import * as fs from "fs";
import * as path from "path";

async function run() {
    const api = new WebIFC.IfcAPI();
    const wasmPath = path.join(process.cwd(), "node_modules", "web-ifc") + "/";
    api.SetWasmPath(wasmPath, true);
    await api.Init();

    const uploadDir = path.join(process.cwd(), "uploads");
    const files = fs.readdirSync(uploadDir).filter(f => f.endsWith(".ifc"));
    if (files.length === 0) { console.error("No IFC files found"); return; }
    const latest = files.map(f => ({ name: f, time: fs.statSync(path.join(uploadDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time)[0].name;

    const filePath = path.join(uploadDir, latest);
    console.log(`🔍 Analyzing: ${latest}`);
    const data = fs.readFileSync(filePath);
    const modelID = api.OpenModel(new Uint8Array(data));

    console.log("🔍 Inspecting 5031:");
    try {
        const e = api.GetLine(modelID, 5031);
        console.log(JSON.stringify(e, null, 2));
    } catch (e) { }
}
run();
