
import DxfParser from 'dxf-parser';

interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function dxfToSvg(dxfContent: string): { svg: string, viewBox: ViewBox } | null {
    try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfContent);

        if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const paths: string[] = [];

        // Helper to update bounds
        const updateBounds = (x: number, y: number) => {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        };

        dxf.entities.forEach((entity: any) => {
            if (entity.type === 'LINE') {
                const x1 = entity.vertices[0].x;
                const y1 = entity.vertices[0].y;
                const x2 = entity.vertices[1].x;
                const y2 = entity.vertices[1].y;
                updateBounds(x1, y1);
                updateBounds(x2, y2);
                paths.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />`);
            }
            else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                if (entity.vertices && entity.vertices.length > 1) {
                    const points = entity.vertices.map((v: any) => {
                        updateBounds(v.x, v.y);
                        return `${v.x},${v.y}`;
                    }).join(' ');
                    // Handle closed polyline
                    const isClosed = entity.shape || (entity.flags & 1) === 1; // 1 = Closed for Polyline
                    paths.push(`<polyline points="${points}" fill="none" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />`);
                }
            }
            else if (entity.type === 'CIRCLE') {
                const cx = entity.center.x;
                const cy = entity.center.y;
                const r = entity.radius;
                updateBounds(cx - r, cy - r);
                updateBounds(cx + r, cy + r);
                paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />`);
            }
            else if (entity.type === 'ARC') {
                // Convert ARC to Path
                // entity.center (x,y), radius, startAngle, endAngle (radians)
                const cx = entity.center.x;
                const cy = entity.center.y;
                const r = entity.radius;
                let startAngle = entity.startAngle;
                let endAngle = entity.endAngle;

                // Bounds approximation (simplified - just box around circle)
                updateBounds(cx - r, cy - r);
                updateBounds(cx + r, cy + r);

                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);

                // Flags for arc path
                let largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
                if (endAngle < startAngle) {
                    largeArcFlag = (Math.PI * 2) + (endAngle - startAngle) <= Math.PI ? "0" : "1";
                }

                paths.push(`<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}" fill="none" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" />`);
            }
        });

        if (minX === Infinity) return null;

        // Apply visual padding
        const padding = (maxX - minX) * 0.05;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;
        const viewBox = { x: minX, y: minY, w: width, h: height };

        // Construct SVG
        // Note: DXF Y-axis is typically Up, SVG is Down. 
        // We might need to flip Y. For now let's assume raw coords and CSS transform if needed.
        // Actually, 'dxf-parser' gives raw coords. 
        // To flip Y, we can use transform="scale(1, -1)" on a group.

        // Let's wrap content in a group that flips Y if needed, but usually floor plans might be okay?
        // Let's try raw first. If upside down, we fix.
        // Usually Construction DXFs are Y-Up.
        // SVG is Y-Down. So we likely need to flip Y.
        // To flip Y around center: transform="scale(1, -1)" and translate appropriately?
        // Easier: transform="scale(1, -1)" around 0,0 then rely on viewBox to find it.
        // BUT viewBox acts on the transformed system.

        // Let's just output raw and maybe add a transform to the container group.
        // <g transform="scale(1, -1)">...

        const svgBody = paths.join('\n');

        // We wrap in a group to handle Y-flip convention commonly needed for DXF -> SVG
        // AND we set stroke color to a variable or default.
        // I used stroke="white" above matching the dark theme request usually, or specific colors.
        // In room-builder, we want dark lines on white background or vice versa.
        // The room-builder code replaces colors.
        // Let's use specific color class or standard "black" so room-builder can invert it?
        // room-builder code: .replace(/stroke="white"/g, 'stroke="#334155"')
        // So I should output stroke="white"? 
        // Let's output stroke="black" by default, and let room-builder handle it if it expects that?
        // Room Builder logic:
        // .replace(/fill="#0b0f19"/g, 'fill="#ffffff"')   // Background
        // .replace(/stroke="white"/g, 'stroke="#334155"') // Lines: White -> Dark Slate

        // If my generated SVG has stroke="white", it will serve properly?
        // If I generate stroke="black", it might be kept black.

        // Let's use stroke="black" since we are on a white background in the UI (bg-slate-100).
        // Wait, the UI background for viewer is bg-slate-100.
        // So black lines are good.

        const svg = `
            <svg viewBox="${minX} ${minY} ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    path, line, polyline, circle, arc { vector-effect: non-scaling-stroke; }
                </style>
                <g transform="scale(1, -1) translate(0, ${-(minY + maxY)})" > 
                   <!-- Simplistic Y-flip attempt, might fail. Let's try NO FLIP first, raw coords. 
                        Architectural plans often share coord systems. -->
                   ${svgBody.replace(/stroke="white"/g, 'stroke="black"')} 
                </g>
            </svg>
        `;

        // Actually, simpler to just return the body and let the viewBox handle it if we don't flip.
        // If Y is up in DXF, and Down in SVG, it will appear mirrored vertically.
        // Most floor plans will look upside down.
        // Let's apply transform="scale(1, -1)" to the group.
        // If we scale(1, -1), y becomes -y.
        // If bounds were [minY, maxY], they become [-maxY, -minY].
        // So we need to update viewBox to match new y range.

        const flipY = true;
        let finalViewBox = viewBox;
        let content = svgBody.replace(/stroke="white"/g, 'stroke="#333"'); // Dark grey lines

        if (flipY) {
            // New Y bounds
            const newMinY = -maxY;
            // const newMaxY = -minY;

            finalViewBox = {
                x: minX,
                y: newMinY,
                w: width,
                h: height
            };

            content = `<g transform="scale(1, -1)">${content}</g>`;
        }

        return {
            svg: `<svg viewBox="${finalViewBox.x} ${finalViewBox.y} ${finalViewBox.w} ${finalViewBox.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
            viewBox: finalViewBox
        };

    } catch (e) {
        console.error("DXF Parse Error:", e);
        return null;
    }
}
