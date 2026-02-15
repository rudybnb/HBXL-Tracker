
import DxfParser from 'dxf-parser';
import * as fs from 'fs';
import * as path from 'path';

export interface DxfExtractionResult {
    success: boolean;
    svgPath?: string;
    rooms: any[];
    detailedElements: any[];
    error?: string;
}

interface Transform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    layer: string; // Context layer for inheritance
}

export class DxfAgent {
    private parser: DxfParser;

    constructor() {
        this.parser = new DxfParser();
    }

    public async process(dxfPath: string, outputDir: string): Promise<DxfExtractionResult> {
        const svgFilename = path.basename(dxfPath) + '.svg';
        const svgPath = path.join(outputDir, svgFilename);

        try {
            const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
            let dxfData: any;
            try {
                dxfData = this.parser.parseSync(dxfContent);
            } catch (pErr) {
                throw new Error("DXF Parse Error: " + pErr);
            }

            if (!dxfData) throw new Error("Parser returned empty data");

            // FLATTEN BLOCKS (Handle Nested Geometry)
            const flatEntities = this.flattenEntities(dxfData);
            console.log(`🔍 DXF Flattened: ${flatEntities.length} primitives (from ${dxfData.entities ? dxfData.entities.length : 0} root entities).`);

            // 1. Generate SVG
            this.generateSVG(flatEntities, svgPath);

            // 2. Extract Data
            const extracted = this.extractEntities(flatEntities);

            return {
                svgPath: svgFilename,
                rooms: extracted.rooms,
                detailedElements: extracted.elements
            };

        } catch (err: any) {
            console.error("DXF Processing Error:", err);
            this.generateErrorSVG(err.message || "Unknown Error", svgPath);
            return {
                success: true,
                svgPath: svgFilename,
                rooms: [],
                detailedElements: [],
                error: err.message
            };
        }
    }

    private flattenEntities(dxf: any): any[] {
        const result: any[] = [];
        const blocks = dxf.blocks || {};
        const symbolInstances: any[] = [];

        const processEntity = (entity: any, t: Transform, depth: number) => {
            if (depth > 10) return; // Limit recursion

            // Logic for Layer Inheritance (0 layer inherits parent)
            const effectiveLayer = entity.layer === '0' && t.layer ? t.layer : (entity.layer || t.layer || '0');

            // Shallow clone to apply local transform without mutation of original parsed object
            const flatEntity = { ...entity, layer: effectiveLayer };

            if (entity.type === 'INSERT') {
                const blockName = entity.name || entity.block;
                const block = blocks[blockName];

                // Combine Transforms
                const insScaleX = entity.xScale || entity.scale || 1;
                const insScaleY = entity.yScale || entity.scale || 1;
                const insRot = entity.rotation || 0;
                const insPos = entity.position || { x: 0, y: 0 };

                // Transform insertion point by parent transform
                const p = this.transformPoint({ x: insPos.x, y: insPos.y }, t);

                const newT: Transform = {
                    x: p.x,
                    y: p.y,
                    scaleX: t.scaleX * insScaleX,
                    scaleY: t.scaleY * insScaleY,
                    rotation: t.rotation + insRot,
                    layer: effectiveLayer
                };

                // CHECK FOR SYMBOL (By Block Name)
                if (blockName) {
                    const symbolType = this.classifyString(blockName);
                    if (symbolType) {
                        symbolInstances.push({
                            type: symbolType,
                            name: blockName,
                            x: newT.x,
                            y: newT.y,
                            layer: effectiveLayer
                        });
                    }
                }

                if (block && block.entities) {
                    for (const sub of block.entities) {
                        processEntity(sub, newT, depth + 1);
                    }
                }
            } else {
                // Primitive: Transform Geometry to Global
                this.applyTransformToEntity(flatEntity, t);
                result.push(flatEntity);
            }
        };

        if (dxf.entities) {
            for (const entity of dxf.entities) {
                processEntity(entity, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, layer: '' }, 0);
            }
        }

        // Attach symbols to the result array for extraction (hacky but keeps signature clean)
        (result as any)._symbols = symbolInstances;

        return result;
    }

    private transformPoint(p: { x: number, y: number }, t: Transform) {
        // scale
        const sx = p.x * t.scaleX;
        const sy = p.y * t.scaleY;
        // rotate
        const rad = t.rotation * (Math.PI / 180);
        const rx = sx * Math.cos(rad) - sy * Math.sin(rad);
        const ry = sx * Math.sin(rad) + sy * Math.cos(rad);
        // translate
        return { x: rx + t.x, y: ry + t.y };
    }

    private applyTransformToEntity(e: any, t: Transform) {
        if (e.position) e.position = this.transformPoint(e.position, t);

        if (e.vertices) {
            e.vertices = e.vertices.map((v: any) => {
                const p = this.transformPoint(v, t);
                return { ...v, x: p.x, y: p.y };
            });
        }

        if (e.center) e.center = this.transformPoint(e.center, t);

        if (e.type === 'CIRCLE' || e.type === 'ARC') {
            e.radius *= (Math.abs(t.scaleX) + Math.abs(t.scaleY)) / 2;
        }

        if (e.type === 'ARC' || e.type === 'TEXT' || e.type === 'MTEXT') {
            if (e.rotation !== undefined) e.rotation += t.rotation;
            if (e.startAngle !== undefined) e.startAngle += t.rotation;
            if (e.endAngle !== undefined) e.endAngle += t.rotation;
        }

        if (e.type === 'TEXT' || e.type === 'MTEXT') {
            if (e.height) e.height *= Math.abs(t.scaleY);
        }
    }

    private generateErrorSVG(errorMessage: string, outputPath: string) {
        const cleanError = errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background-color: #1a0000;">
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff4444" font-family="sans-serif" font-size="24">
    DXF CONVERSION FAILED
  </text>
  <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#aaaaaa" font-family="sans-serif" font-size="16">
    ${cleanError}
  </text>
</svg>`;
        fs.writeFileSync(outputPath, svgContent);
    }

    private extractEntities(entities: any[]) {
        const rooms: any[] = [];
        const elements: any[] = [];

        // Recover symbols captured during flattening
        const symbols = (entities as any)._symbols || [];

        // Add identified symbols
        for (const sym of symbols) {
            elements.push({
                type: sym.type,
                name: sym.name, // Use block name
                bbox: [sym.x - 50, sym.y - 50, sym.x + 50, sym.y + 50],
                layer: sym.layer,
                source: 'block'
            });
        }

        // Debug: Log text found
        const allText = entities
            .filter((e: any) => e.type === 'TEXT' || e.type === 'MTEXT')
            .map((e: any) => e.text || e.string);
        // if (allText.length > 0) console.log("🔎 DXF Flattened Text:", allText.slice(0, 10));

        for (const entity of entities) {
            // TEXT / MTEXT
            if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                const text = entity.text || entity.string;
                if (this.isRoomLabel(text) && entity.position) {
                    rooms.push({
                        name: text,
                        bbox: [entity.position.x - 500, entity.position.y - 500, entity.position.x + 500, entity.position.y + 500],
                        layer: entity.layer
                    });
                }
            }

            // ELEMENTS
            let type = null;
            if (entity.layer) {
                type = this.classifyString(entity.layer);
            }

            if (type) {
                let x: number | null = null;
                let y: number | null = null;

                if (entity.position) { x = entity.position.x; y = entity.position.y; }
                else if (entity.center) { x = entity.center.x; y = entity.center.y; }
                else if (entity.vertices && entity.vertices.length > 0) { x = entity.vertices[0].x; y = entity.vertices[0].y; }

                if (x !== null && y !== null) {
                    elements.push({
                        type: type,
                        name: entity.layer,
                        bbox: [x - 50, y - 50, x + 50, y + 50],
                        layer: entity.layer,
                        source: 'layer' // Distinguish from block-derived
                    });
                }
            }
        }
        return { rooms, elements };
    }

    private isRoomLabel(text: string): boolean {
        if (!text) return false;
        const lower = text.toLowerCase().trim();
        if (lower.match(/rev|date|scale|drg|chk|drawn|client|project|dwg|title|a1|a0|a3/)) return false;
        if (lower.length < 3) return false;
        const roomKeywords = [
            'room', 'bed', 'kitchen', 'lounge', 'bath', 'ens', 'w.c', 'wc',
            'hall', 'landing', 'garage', 'study', 'office', 'dining', 'living',
            'utility', 'plant', 'store', 'cupboard', 'void', 'area', 'lobby',
            'entrance', 'porch', 'balcony', 'terrace', 'gym', 'cinema'
        ];
        return roomKeywords.some(k => lower.includes(k));
    }

    private classifyString(str: string): string | null {
        if (!str) return null;
        const lower = str.toLowerCase();

        // Electrical
        if (lower.match(/socket|power|pwr|dss|sso|sk|pow|outlet/)) return 'socket';
        if (lower.match(/light|lamp|spot|ceiling|lig|lit|lum|pendant|downlight/)) return 'light';
        if (lower.match(/switch|sw\b|sw_|dimmer/)) return 'switch';
        if (lower.match(/data|rj45|comms|tel|tv|av|hdmi|bt|point/)) return 'data';
        if (lower.match(/fire|smoke|det|sd|sounder|alarm|heat/)) return 'fire_alarm';

        // Openings
        if ((lower.includes('door') || lower.match(/\bd\d\d/)) && !lower.includes('outdoor')) return 'door';
        if (lower.includes('window') || lower.includes('glaz') || lower.match(/\bw\d\d/)) return 'window';

        // Sanitary / Plumbing
        if (lower.match(/wc|toilet|cistern|pan/)) return 'toilet';
        if (lower.match(/bath|tub|shower|tray/)) return 'bath_shower';
        if (lower.match(/sink|basin|whb|wash/)) return 'sink';
        if (lower.match(/rad|radiator|towel/)) return 'radiator';

        // Kitchen
        if (lower.match(/cooker|hob|oven|stove/)) return 'appliance';
        if (lower.match(/fridge|freezer/)) return 'appliance';
        if (lower.match(/wm|washer|dryer/)) return 'appliance';

        return null;
    }

    private generateSVG(entities: any[], outputPath: string) {
        let svgContent = '';
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        const updateBounds = (x: number, y: number) => {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        };

        entities.forEach((entity: any) => {
            if (entity.type === 'LINE' && entity.vertices) {
                entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
            } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
                entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
            } else if (entity.type === 'CIRCLE' && entity.center) {
                updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
                updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
            } else if (entity.type === 'ARC' && entity.center) {
                updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
                updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
            } else if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && entity.position) {
                updateBounds(entity.position.x, entity.position.y);
            }
        });

        if (minX === Infinity) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }

        const padding = (maxX - minX) * 0.05;
        minX -= padding; maxX += padding;
        minY -= padding; maxY += padding;
        const width = maxX - minX;
        const height = maxY - minY;

        svgContent += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#0b0f19" />\n`;

        entities.forEach((entity: any) => {
            // Geometry is already flattened and global.
            // SVG Y is inverted relative to DXF

            if (entity.type === 'LINE') {
                const x1 = entity.vertices[0].x;
                const y1 = maxY - (entity.vertices[0].y - minY);
                const x2 = entity.vertices[1].x;
                const y2 = maxY - (entity.vertices[1].y - minY);
                svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
            } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                if (entity.vertices && entity.vertices.length > 0) {
                    const points = entity.vertices.map((v: any) => `${v.x},${maxY - (v.y - minY)}`).join(' ');
                    const isClosed = entity.shape || (entity.vertices.length > 1 && entity.vertices[0].x === entity.vertices[entity.vertices.length - 1].x);
                    svgContent += `<${isClosed ? 'polygon' : 'polyline'} points="${points}" fill="none" stroke="cyan" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
                }
            } else if (entity.type === 'CIRCLE' && entity.center) {
                const cx = entity.center.x;
                const cy = maxY - (entity.center.y - minY);
                svgContent += `<circle cx="${cx}" cy="${cy}" r="${entity.radius}" fill="none" stroke="yellow" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
            } else if (entity.type === 'ARC' && entity.center) {
                const r = entity.radius;
                const startAngle = (entity.startAngle || 0) * (Math.PI / 180);
                const endAngle = (entity.endAngle || 0) * (Math.PI / 180);

                const startX = entity.center.x + r * Math.cos(startAngle);
                const startY = entity.center.y + r * Math.sin(startAngle);
                const endX = entity.center.x + r * Math.cos(endAngle);
                const endY = entity.center.y + r * Math.sin(endAngle);

                const x1 = startX;
                const y1 = maxY - (startY - minY);
                const x2 = endX;
                const y2 = maxY - (endY - minY);

                let diff = (entity.endAngle || 0) - (entity.startAngle || 0);
                if (diff < 0) diff += 360;
                const largeArc = diff > 180 ? 1 : 0;
                const sweep = 0;

                svgContent += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}" fill="none" stroke="orange" stroke-width="2" vector-effect="non-scaling-stroke" />\n`;
            } else if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && entity.position) {
                const x = entity.position.x;
                const y = maxY - (entity.position.y - minY);
                const txt = (entity.text || entity.string || '').replace(/[<>&]/g, '_');
                svgContent += `<text x="${x}" y="${y}" fill="lime" font-size="${entity.height || 100}" font-family="monospace">${txt}</text>\n`;
            }
        });

        const svgFile = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}">
  <g transform="scale(1, 1)">
    ${svgContent}
  </g>
</svg>`;
        fs.writeFileSync(outputPath, svgFile);
    }
}
