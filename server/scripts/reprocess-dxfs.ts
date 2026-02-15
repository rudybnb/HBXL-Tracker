
import * as fs from 'fs';
import * as path from 'path';
import { DxfAgent } from '../agents/dxf-agent';

async function reprocessDxfs() {
    const jobUploadsDir = path.join(process.cwd(), "uploads", "jobs");
    console.log(`📂 Scanning directory: ${jobUploadsDir}`);

    if (!fs.existsSync(jobUploadsDir)) return;

    const files = fs.readdirSync(jobUploadsDir);
    const dxfFiles = files.filter(f => f.toLowerCase().endsWith('.dxf'));

    console.log(`Found ${dxfFiles.length} DXF files.`);
    const agent = new DxfAgent();

    for (const file of dxfFiles) {
        const filePath = path.join(jobUploadsDir, file);
        console.log(`Processing ${file}...`);

        try {
            const result = await agent.process(filePath, jobUploadsDir);
            if (result.success) {
                console.log(`✅ Successfully reprocessed ${file}`);
            } else {
                console.warn(`⚠️ Warning: ${result.error}`);
            }
        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err);
        }
    }
}

reprocessDxfs().catch(console.error);
