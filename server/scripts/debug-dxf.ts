
import DxfParser from 'dxf-parser';
import * as fs from 'fs';
import * as path from 'path';

const jobUploadsDir = path.join(process.cwd(), "uploads", "jobs");
// Find the DXF file
const files = fs.readdirSync(jobUploadsDir);
const dxfFile = files.find(f => f.includes('DXF_TEST.dxf'));

if (!dxfFile) {
    console.error("No DXF file found");
    process.exit(1);
}

const parser = new DxfParser();
const content = fs.readFileSync(path.join(jobUploadsDir, dxfFile), 'utf-8');
const dxf = parser.parseSync(content);

console.log("Entities count:", dxf.entities ? dxf.entities.length : 0);
console.log("Blocks found:", dxf.blocks ? Object.keys(dxf.blocks).length : 0);

if (dxf.blocks) {
    const blockNames = Object.keys(dxf.blocks).slice(0, 5);
    console.log("Sample Block Names:", blockNames);
    const firstBlock = dxf.blocks[blockNames[0]];
    console.log("First Block Structure:", JSON.stringify(firstBlock, null, 2).substring(0, 500));
}

// Check INSERT entities
const inserts = dxf.entities ? dxf.entities.filter(e => e.type === 'INSERT') : [];
console.log("INSERT entities count:", inserts.length);
if (inserts.length > 0) {
    console.log("Sample Insert:", JSON.stringify(inserts[0], null, 2));
}
