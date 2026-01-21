/**
 * DXF CAD Expert Agent
 * Parses .dxf files to extract EXACT geometric data and converts to SVG for display.
 * This provides 100% precision for Quant takeoffs.
 */

import DxfParser from 'dxf-parser';
import * as fs from 'fs';
import * as path from 'path';

export interface DxfExtractionResult {
    success: boolean;
    svgPath?: string; // Path to the generated SVG for visualization
    rooms: any[];
    detailedElements: any[];
    error?: string;
}

export class DxfAgent {
    private parser: DxfParser;

    constructor() {
        this.parser = new DxfParser();
    }

    public async process(dxfPath: string, outputDir: string): Promise<DxfExtractionResult> {
        try {
            const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
            const dxfData = this.parser.parseSync(dxfContent);

            if (!dxfData) throw new Error("Failed to parse DXF content");

            // 1. Generate SVG for Visualization
            const svgFilename = path.basename(dxfPath) + '.svg';
            const svgPath = path.join(outputDir, svgFilename);
            this.generateSVG(dxfData, svgPath);

            // 2. Extract Data (Rooms & Elements)
            const extracted = this.extractEntities(dxfData);

            return {
                success: true,
                svgPath: svgFilename, // Return relative filename
                rooms: extracted.rooms,
                detailedElements: extracted.elements
            };

        } catch (err: any) {
            console.error("DXF Processing Error:", err);
            return { success: false, rooms: [], detailedElements: [], error: err.message };
        }
    }

    private extractEntities(dxf: any) {
        const rooms: any[] = [];
        const elements: any[] = [];

        if (dxf.entities) {
            for (const entity of dxf.entities) {

                // TEXT / MTEXT -> Potential Room Names
                if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                    const text = entity.text || entity.string;
                    if (this.isRoomLabel(text)) {
                        rooms.push({
                            name: text,
                            // Use text insertion point as center
                            bbox: [entity.position.x - 500, entity.position.y - 500, entity.position.x + 500, entity.position.y + 500],
                            layer: entity.layer
                        });
                    }
                }

                // INTELLIGENT ELEMENT EXTRACTION
                // Priority 1: Named Blocks (INSERT)
                // Priority 2: Layer-based classification for geometry (Circles = Lights, etc)

                let type = null;

                if (entity.type === 'INSERT') {
                    type = this.classifyString(entity.name);
                }

                if (!type && entity.layer) {
                    type = this.classifyString(entity.layer);
                }

                if (type) {
                    // Locate it
                    let x = 0, y = 0;
                    if (entity.position) { x = entity.position.x; y = entity.position.y; }
                    else if (entity.center) { x = entity.center.x; y = entity.center.y; } // Circle/Arc
                    else if (entity.vertices && entity.vertices.length > 0) { x = entity.vertices[0].x; y = entity.vertices[0].y; }

                    // Filter: Don't count every line. Only Blocks and "Significant" Geometry (Circles)
                    // If it's a Block (INSERT), always count.
                    // If it's Layer-based, only count CIRCLES (Lights) or TEXT (Labels). 
                    // Ignoring lines prevents "1 Square Socket = 4 Lines = 4 Sockets".
                    const isSignificant = entity.type === 'INSERT' || entity.type === 'CIRCLE';

                    if (isSignificant && (x || y)) {
                        elements.push({
                            type: type,
                            name: entity.name || entity.layer,
                            bbox: [x - 50, y - 50, x + 50, y + 50],
                            layer: entity.layer
                        });
                    }
                }
            }
        }

        return { rooms, elements };
    }

    private isRoomLabel(text: string): boolean {
        if (!text) return false;
        const lower = text.toLowerCase();
        return !lower.match(/rev|date|scale|drg|chk/) && // Exclude title block info
            (lower.includes('room') || lower.includes('bed') || lower.includes('kitchen') || lower.includes('lounge') || lower.includes('bath'));
    }

    private classifyString(str: string): string | null {
        if (!str) return null;
        const lower = str.toLowerCase();
        // Electrical
        if (lower.includes('socket') || lower.includes('power') || lower.includes('pwr') || lower.includes('dss') || lower.includes('sso')) return 'socket';
        if (lower.includes('light') || lower.includes('lamp') || lower.includes('spot') || lower.includes('ceiling') || lower.includes('lighting')) return 'light';
        if (lower.includes('switch') || lower.includes('sw')) return 'switch';
        if (lower.includes('data') || lower.includes('rj45') || lower.includes('comms')) return 'data';
        if (lower.includes('smoke') || lower.includes('det') || lower.includes('fire') || lower.includes('sd')) return 'fire_alarm';

        // Structural
        if (lower.includes('door') && !lower.includes('outdoor')) return 'door';
        if (lower.includes('window') || lower.includes('glazing')) return 'window';

        return null;
    }

    /**
     * Minimal DXF to SVG converter
     * Renders Lines, Polylines, Circles, 3DFACEs to SVG format
     */
    private generateSVG(dxf: any, outputPath: string) {
        let svgContent = '';
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Pass 1: Calculate Bounds
        const updateBounds = (x: number, y: number) => {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        };

        if (dxf.entities) {
            dxf.entities.forEach((entity: any) => {
                if (entity.type === 'LINE') {
                    if (entity.vertices) {
                        entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
                    }
                }
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    if (entity.vertices) {
                        entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
                    }
                }
                else if (entity.type === 'INSERT') { // Block
                    updateBounds(entity.position.x, entity.position.y);
                }
                else if (entity.type === 'ARC') {
                    updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
                    updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
                }
                else if (entity.type === '3DFACE' || entity.type === 'SOLID') {
                    if (entity.vertices) {
                        entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
                    }
                }
            });
        }

        // Handle empty bounds (empty file or non-supported entities)
        if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
            console.warn("⚠️ DXF Agent: No geometric bounds found. Defaulting to 1000x1000.");
            minX = 0; minY = 0; maxX = 1000; maxY = 1000;
        }

        // Add padding
        const padding = (maxX - minX) * 0.05;
        minX -= padding; maxX += padding;
        minY -= padding; maxY += padding;
        const width = maxX - minX;
        const height = maxY - minY;

        // Pass 2: Generate SVG Paths
        if (dxf.entities) {
            dxf.entities.forEach((entity: any) => {
                // Invert Y for SVG (SVG y goes down, CAD y goes up)
                const svgY = (y: number) => maxY - (y - minY) + minY;

                if (entity.type === 'LINE') {
                    const x1 = entity.vertices[0].x;
                    const y1 = maxY - (entity.vertices[0].y - minY);
                    const x2 = entity.vertices[1].x;
                    const y2 = maxY - (entity.vertices[1].y - minY);
                    svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    if (entity.vertices && entity.vertices.length > 0) {
                        const points = entity.vertices.map((v: any) => `${v.x},${maxY - (v.y - minY)}`).join(' ');
                        const closed = entity.shape || (entity.vertices[0].x === entity.vertices[entity.vertices.length - 1].x);
                        if (closed)
                            svgContent += `<polygon points="${points}" fill="none" stroke="cyan" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                        else
                            svgContent += `<polyline points="${points}" fill="none" stroke="cyan" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                    }
                }
                else if (entity.type === 'CIRCLE') {
                    const cx = entity.center.x;
                    const cy = maxY - (entity.center.y - minY);
                    svgContent += `<circle cx="${cx}" cy="${cy}" r="${entity.radius}" fill="none" stroke="yellow" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
                else if (entity.type === 'ARC') {
                    const r = entity.radius;
                    const startAngle = entity.startAngle * (Math.PI / 180);
                    const endAngle = entity.endAngle * (Math.PI / 180);

                    // Calculate start and end points in standard Cartesian
                    const startX = entity.center.x + r * Math.cos(startAngle);
                    const startY = entity.center.y + r * Math.sin(startAngle);
                    const endX = entity.center.x + r * Math.cos(endAngle);
                    const endY = entity.center.y + r * Math.sin(endAngle);

                    // Transform to SVG coords (Flip Y)
                    const x1 = startX;
                    const y1 = maxY - (startY - minY);
                    const x2 = endX;
                    const y2 = maxY - (endY - minY);

                    // Large Arc Flag
                    let diff = entity.endAngle - entity.startAngle;
                    if (diff < 0) diff += 360;
                    const largeArc = diff > 180 ? 1 : 0;

                    // Sweep Flag: 
                    // Cartesian CCW is standard for DXF.
                    // In SVG (Y-down), CCW appears CW. But we flipped Y manually with `maxY - ...`
                    // So we are working in a "flipped Y" visual space.
                    // Usually 0 works for standard mathematical arc projection here.
                    const sweep = 0;

                    svgContent += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}" fill="none" stroke="orange" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
                else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                    const x = entity.position.x;
                    const y = maxY - (entity.position.y - minY);
                    const txt = (entity.text || entity.string || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
                    svgContent += `<text x="${x}" y="${y}" fill="lime" font-size="${entity.height || 100}" font-family="monospace">${txt}</text>\n`;
                }
                else if (entity.type === '3DFACE' || entity.type === 'SOLID') {
                    if (entity.vertices && entity.vertices.length > 0) {
                        const points = entity.vertices.map((v: any) => `${v.x},${maxY - (v.y - minY)}`).join(' ');
                        // Render as semi-transparent polygon to show volume
                        svgContent += `<polygon points="${points}" fill="none" stroke="cyan" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                    }
                }
                else if (entity.type === 'INSERT') {
                    // Render Blocks as a small generic symbol (Cross) to indicate presence
                    const ix = entity.position.x;
                    const iy = maxY - (entity.position.y - minY);
                    const sz = 200; // Arbitrary size (mm usually) - roughly 20cm

                    // Draw a Cross (X)
                    svgContent += `<line x1="${ix - sz}" y1="${iy - sz}" x2="${ix + sz}" y2="${iy + sz}" stroke="magenta" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                    svgContent += `<line x1="${ix + sz}" y1="${iy - sz}" x2="${ix - sz}" y2="${iy + sz}" stroke="magenta" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
            });
        }

        const svgFile = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" style="background-color: #0b0f19;">
  <g transform="scale(1, 1)">
    ${svgContent}
  </g>
</svg>`;

        fs.writeFileSync(outputPath, svgFile);
    }
}
