
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as PImage from 'pureimage';
import DxfParser from 'dxf-parser';
import { db } from "./server/db";
import { jobFiles } from "./shared/schema";
import { desc } from "drizzle-orm";

async function debugVisualFlow() {
    console.log("🔍 Starting Visual Fallback Debugger...");

    // 1. Get Latest DXF File
    const files = await db.select().from(jobFiles).orderBy(desc(jobFiles.createdAt)).limit(1);
    if (files.length === 0) { console.error("No files found"); return; }

    const file = files[0];
    // Reconstruct path (server uses process.cwd()/uploads)
    const filePath = path.resolve(process.cwd(), "uploads", file.filename);

    console.log(`📂 Processing: ${filePath}`);
    if (!fs.existsSync(filePath)) { console.error("File not found on disk!"); return; }

    // 2. Parse DXF
    const parser = new DxfParser();
    const content = fs.readFileSync(filePath, 'utf-8');
    const dxf = parser.parseSync(content);

    if (!dxf) { console.error("DXF Parse Failed"); return; }
    console.log(`✅ Parsed ${dxf.entities.length} entities.`);

    // 3. Calculate Bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dxf.entities.forEach(entity => {
        if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            const verts = entity.vertices || [];
            verts.forEach(v => {
                if (v.x < minX) minX = v.x;
                if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.y > maxY) maxY = v.y;
            });
        }
    });

    console.log(`📏 Bounds: [${minX}, ${minY}] to [${maxX}, ${maxY}]`);
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0 || width === Infinity) {
        console.error("❌ Invalid Bounds! Cannot generate image.");
        return;
    }

    // 4. Generate PNG
    console.log("🎨 Generating PNG with pureimage...");
    const maxDim = 2000;
    const scale = Math.min(maxDim / width, maxDim / height);
    const cvsWidth = Math.ceil(width * scale);
    const cvsHeight = Math.ceil(height * scale);

    console.log(`   Image Size: ${cvsWidth}x${cvsHeight}`);

    const img = PImage.make(cvsWidth, cvsHeight);
    const ctx = img.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cvsWidth, cvsHeight);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    let drawCount = 0;
    dxf.entities.forEach(entity => {
        const toCx = (x) => (x - minX) * scale;
        const toCy = (y) => (maxY - y) * scale;

        ctx.beginPath();
        if (entity.type === 'LINE') {
            ctx.moveTo(toCx(entity.vertices[0].x), toCy(entity.vertices[0].y));
            ctx.lineTo(toCx(entity.vertices[1].x), toCy(entity.vertices[1].y));
            ctx.stroke();
            drawCount++;
        } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            const v = entity.vertices;
            if (v && v.length > 0) {
                ctx.moveTo(toCx(v[0].x), toCy(v[0].y));
                for (let i = 1; i < v.length; i++) ctx.lineTo(toCx(v[i].x), toCy(v[i].y));
                if (entity.shape) ctx.closePath();
                ctx.stroke();
                drawCount++;
            }
        }
    });
    console.log(`   Drawn ${drawCount} entities.`);

    const outPath = "debug_output.png";
    const stream = fs.createWriteStream(outPath);
    await PImage.encodePNGToStream(img, stream);
    console.log(`✅ PNG Saved to ${outPath}`);
    process.exit(0);
}

debugVisualFlow().catch(console.error);
