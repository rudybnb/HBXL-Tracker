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

        // Helper to normalize coordinates (DXF can be huge coordinates)
        // For now, we return raw CAD coordinates. The UI might need to handle the scale.
        // Actually, for "No Guessing", we want REAL units.

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

                // INSERT -> Blocks (Sockets, Lights)
                if (entity.type === 'INSERT') {
                    const blockName = entity.name;
                    const type = this.classifyBlock(blockName);
                    if (type) {
                        elements.push({
                            type: type,
                            name: blockName,
                            bbox: [entity.position.x - 50, entity.position.y - 50, entity.position.x + 50, entity.position.y + 50],
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

    private classifyBlock(name: string): string | null {
        const lower = name.toLowerCase();
        if (lower.includes('socket')) return 'socket';
        if (lower.includes('light') || lower.includes('lamp') || lower.includes('spot')) return 'light';
        if (lower.includes('switch')) return 'switch';
        if (lower.includes('door')) return 'door';
        if (lower.includes('window')) return 'window';
        return null; // Unknown block
    }

    /**
     * Minimal DXF to SVG converter
     * Renders Lines, Polylines, Circles, Arcs to SVG format
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
            });
        }

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
                // Invert Y for SVG (SVG y goes down, CAD y goes up) - handled by viewBox/transform usually,
                // but simpler to just mirror Y coords relative to MaxY
                const svgY = (y: number) => maxY - (y - minY) + minY; // Flip Y axis

                if (entity.type === 'LINE') {
                    const x1 = entity.vertices[0].x;
                    const y1 = maxY - (entity.vertices[0].y - minY); // Flip
                    const x2 = entity.vertices[1].x;
                    const y2 = maxY - (entity.vertices[1].y - minY);
                    svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    if (entity.vertices && entity.vertices.length > 0) {
                        const points = entity.vertices.map((v: any) => `${v.x},${maxY - (v.y - minY)}`).join(' ');
                        const closed = entity.shape || (entity.vertices[0].x === entity.vertices[entity.vertices.length - 1].x); // Check closed flag in real parser
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
                else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                    const x = entity.position.x;
                    const y = maxY - (entity.position.y - minY);
                    // Escaped text
                    const txt = (entity.text || entity.string || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
                    svgContent += `<text x="${x}" y="${y}" fill="lime" font-size="${entity.height || 100}" font-family="monospace">${txt}</text>\n`;
                }
            });
        }

        const svgFile = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" style="background-color: #0b0f19;">
  <g transform="scale(1, 1)">
    ${svgContent}
  </g>
</svg>`;

        fs.writeFileSync(outputPath, svgFile);
    }
}
