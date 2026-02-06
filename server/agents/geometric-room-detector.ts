
export interface Point { x: number; y: number; }
export interface WallSegment { start: Point; end: Point; }
export interface DetectedRoom {
    name: string;
    polygon: Point[];
    area: number;
    perimeter: number;
    bbox: number[];
}

export class GeometricRoomDetector {
    private snapThreshold = 100.0; // Reduced to 100mm (or 0.1m) - needs dynamic adjustment

    detectRooms(wallPolygons: Point[][]): DetectedRoom[] {
        // Flatten to segments for graph building
        const walls: WallSegment[] = [];
        wallPolygons.forEach(poly => {
            for (let i = 0; i < poly.length; i++) {
                walls.push({ start: poly[i], end: poly[(i + 1) % poly.length] });
            }
        });

        if (walls.length < 3) return [];

        // 1. DYNAMIC THRESHOLD
        let maxVal = 0;
        walls.forEach(w => {
            maxVal = Math.max(maxVal, w.start.x, w.start.y, w.end.x, w.end.y);
        });
        const isMeters = maxVal < 2000;
        this.snapThreshold = isMeters ? 0.01 : 10.0; // 10mm precision

        console.log(`🔍 Geometric Detector: Analyzing ${wallPolygons.length} walls (${walls.length} segs). Units: ${isMeters ? 'm' : 'mm'} (Snap: ${this.snapThreshold})`);

        // 0. Resolve T-Junctions by Splitting
        const processedWalls = this.resolveIntersections(walls);
        console.log(`   Processed T-Junctions. Segments count: ${walls.length} -> ${processedWalls.length}`);

        // 1. Identify Unique Nodes and Edges
        const { nodes, edges } = this.buildGraph(processedWalls);
        console.log(`   Graph constructed: ${nodes.length} nodes, ${edges.length} edges.`);

        // 2. Find Faces
        const faces = this.findFaces(nodes, edges);
        console.log(`   Faces found: ${faces.length}`);

        // 3. Convert to Rooms & Filter
        const rooms = faces.map((face, index) => {
            const rawArea = this.calculateSignedArea(face);
            let area = Math.abs(rawArea);
            let perimeter = this.calculatePerimeter(face);

            // Auto-scale units (mm -> m) for OUTPUT
            if (!isMeters && area > 100000) {
                area = area / 1000000.0;
                perimeter = perimeter / 1000.0;
            }

            const bbox = this.calculateBBox(face);

            // Basic Filter: Tiny/Huge
            if (area < 1.0 || area > 5000) return null;

            // ADVANCED FILTER: "Is this face a Wall?"
            // Check if centroid (or point inside) is inside any Original Wall Polygon
            const center = this.getFaceCentroid(face);

            // Check against ALL source wall polygons
            let isInsideWall = false;
            for (const wallPoly of wallPolygons) {
                // If units mismatch (detector scaling), this might be tricky, but here we work in raw coords derived from walls.
                if (this.isPointInPolygon(center, wallPoly)) {
                    isInsideWall = true;
                    break;
                }
            }

            if (isInsideWall) {
                console.log(`     Face ${index}: Area=${area.toFixed(2)}m² - DISCARDED (Inside Wall)`);
                return null;
            }

            console.log(`     Face ${index}: Area=${area.toFixed(2)}m² - ACCEPTED (Room)`);

            return {
                name: `Diff Detected Room ${index + 1}`,
                polygon: face,
                area: Number(area.toFixed(2)),
                perimeter: Number(perimeter.toFixed(2)),
                bbox
            };
        }).filter(r => r !== null) as DetectedRoom[];

        return rooms;
    }

    private getFaceCentroid(face: Point[]): Point {
        let x = 0, y = 0;
        face.forEach(p => { x += p.x; y += p.y; });
        return { x: x / face.length, y: y / face.length };
    }

    private isPointInPolygon(pt: Point, polygon: Point[]): boolean {
        let isInside = false;
        let minX = polygon[0].x, maxX = polygon[0].x;
        let minY = polygon[0].y, maxY = polygon[0].y;
        for (let i = 1; i < polygon.length; i++) {
            const q = polygon[i];
            minX = Math.min(q.x, minX);
            maxX = Math.max(q.x, maxX);
            minY = Math.min(q.y, minY);
            maxY = Math.max(q.y, maxY);
        }
        if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) return false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    private resolveIntersections(walls: WallSegment[]): WallSegment[] {
        // 1. Initial Cleanup: Filter degenerate segments
        const segments = walls.filter(w => {
            const lenSq = (w.end.x - w.start.x) ** 2 + (w.end.y - w.start.y) ** 2;
            return lenSq > 0.01;
        });

        // Store split points relative to each segment
        const splits: { t: number, p: Point }[][] = Array(segments.length).fill(0).map(() => []);

        // 2. Gather Intersections (N^2)
        // We calculate 't' (0..1) for each intersection to easily sort them later
        for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
                const s1 = segments[i];
                const s2 = segments[j];

                // Check strict intersection
                const intersect = this.getLineIntersection(s1.start, s1.end, s2.start, s2.end);

                if (intersect) {
                    const dx1 = s1.end.x - s1.start.x;
                    const dy1 = s1.end.y - s1.start.y;
                    const lenSq1 = dx1 * dx1 + dy1 * dy1;
                    const t1 = ((intersect.x - s1.start.x) * dx1 + (intersect.y - s1.start.y) * dy1) / lenSq1;

                    const dx2 = s2.end.x - s2.start.x;
                    const dy2 = s2.end.y - s2.start.y;
                    const lenSq2 = dx2 * dx2 + dy2 * dy2;
                    const t2 = ((intersect.x - s2.start.x) * dx2 + (intersect.y - s2.start.y) * dy2) / lenSq2;

                    // Add if internal (with epsilon to avoid endpoint recurrence)
                    const eps = 0.001;
                    if (t1 > eps && t1 < 1 - eps) splits[i].push({ t: t1, p: intersect });
                    if (t2 > eps && t2 < 1 - eps) splits[j].push({ t: t2, p: intersect });
                }

                // Check Collinear Overlaps
                if (this.isPointOnSegment(s2.start, s1.start, s1.end)) {
                    const t = this.getT(s2.start, s1);
                    if (t > 0.001 && t < 0.999) splits[i].push({ t, p: s2.start });
                }
                if (this.isPointOnSegment(s2.end, s1.start, s1.end)) {
                    const t = this.getT(s2.end, s1);
                    if (t > 0.001 && t < 0.999) splits[i].push({ t, p: s2.end });
                }
                if (this.isPointOnSegment(s1.start, s2.start, s2.end)) {
                    const t = this.getT(s1.start, s2);
                    if (t > 0.001 && t < 0.999) splits[j].push({ t, p: s1.start });
                }
                if (this.isPointOnSegment(s1.end, s2.start, s2.end)) {
                    const t = this.getT(s1.end, s2);
                    if (t > 0.001 && t < 0.999) splits[j].push({ t, p: s1.end });
                }
            }
        }

        // 3. Split Segments
        const result: WallSegment[] = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const points = splits[i];

            if (points.length === 0) {
                result.push(seg);
                continue;
            }

            // Sort by t
            points.sort((a, b) => a.t - b.t);

            // Create sub-segments
            let curr = seg.start;
            points.forEach(pt => {
                // Prevent tiny degenerate segments
                if ((pt.p.x - curr.x) ** 2 + (pt.p.y - curr.y) ** 2 > 0.01) {
                    result.push({ start: curr, end: pt.p });
                }
                curr = pt.p;
            });
            // Final segment
            if ((seg.end.x - curr.x) ** 2 + (seg.end.y - curr.y) ** 2 > 0.01) {
                result.push({ start: curr, end: seg.end });
            }
        }

        return result;
    }

    private getT(p: Point, s: WallSegment): number {
        const dx = s.end.x - s.start.x;
        const dy = s.end.y - s.start.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            return (p.x - s.start.x) / dx;
        } else {
            return (p.y - s.start.y) / dy;
        }
    }

    private isPointOnSegment(p: Point, a: Point, b: Point): boolean {
        // Assume p is on line, check bounds with tolerance
        const minX = Math.min(a.x, b.x) - 0.1;
        const maxX = Math.max(a.x, b.x) + 0.1;
        const minY = Math.min(a.y, b.y) - 0.1;
        const maxY = Math.max(a.y, b.y) + 0.1;
        return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    }

    private distSq(p1: Point, p2: Point) {
        return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
    }

    private getLineIntersection(p0: Point, p1: Point, p2: Point, p3: Point): Point | null {
        const s1_x = p1.x - p0.x;
        const s1_y = p1.y - p0.y;
        const s2_x = p3.x - p2.x;
        const s2_y = p3.y - p2.y;

        const det = -s2_x * s1_y + s1_x * s2_y;
        if (Math.abs(det) < 0.0001) return null; // Parallel

        const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / det;
        const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / det;

        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return {
                x: p0.x + (t * s1_x),
                y: p0.y + (t * s1_y)
            };
        }
        return null;
    }

    private buildGraph(walls: WallSegment[]) {
        const nodes: Point[] = [];

        const getNodeIndex = (p: Point) => {
            for (let i = 0; i < nodes.length; i++) {
                const dx = nodes[i].x - p.x;
                const dy = nodes[i].y - p.y;
                if ((dx * dx + dy * dy) < (this.snapThreshold * this.snapThreshold)) return i;
            }
            nodes.push(p);
            return nodes.length - 1;
        };

        const edges: { u: number, v: number }[] = [];

        walls.forEach(w => {
            const u = getNodeIndex(w.start);
            const v = getNodeIndex(w.end);
            if (u !== v) {
                edges.push({ u, v });
            }
        });

        return { nodes, edges };
    }

    private findFaces(nodes: Point[], edges: { u: number, v: number }[]): Point[][] {
        interface HalfEdge { v: number; angle: number; index: number; visited: boolean; }
        const adj: HalfEdge[][] = Array(nodes.length).fill(0).map(() => []);

        // Edge i (u->v) = 2*i. Edge i (v->u) = 2*i+1
        edges.forEach((e, i) => {
            const angleUV = Math.atan2(nodes[e.v].y - nodes[e.u].y, nodes[e.v].x - nodes[e.u].x);
            const angleVU = Math.atan2(nodes[e.u].y - nodes[e.v].y, nodes[e.u].x - nodes[e.v].x);
            adj[e.u].push({ v: e.v, angle: angleUV, index: 2 * i, visited: false });
            adj[e.v].push({ v: e.u, angle: angleVU, index: 2 * i + 1, visited: false });
        });

        // Sort CCW
        adj.forEach(list => list.sort((a, b) => a.angle - b.angle));

        const faces: Point[][] = [];
        const visitedEdgeIndices = new Set<number>();

        for (let u = 0; u < nodes.length; u++) {
            for (const startEdge of adj[u]) {
                if (visitedEdgeIndices.has(startEdge.index)) continue;

                const cycle: Point[] = [];
                let currU = u;
                let currEdge = startEdge;
                let broken = false;
                let steps = 0;

                while (!visitedEdgeIndices.has(currEdge.index) && steps < 1000) {
                    visitedEdgeIndices.add(currEdge.index);
                    cycle.push(nodes[currU]);
                    steps++;

                    const v = currEdge.v;
                    const vEdges = adj[v];

                    if (vEdges.length === 0) { broken = true; break; }

                    const twinIdx = (currEdge.index % 2 === 0) ? currEdge.index + 1 : currEdge.index - 1;
                    const twinPos = vEdges.findIndex(e => e.index === twinIdx);

                    if (twinPos === -1) { broken = true; break; }

                    // Walk Left (CCW)
                    const nextEdge = vEdges[(twinPos + 1) % vEdges.length];

                    currU = v;
                    currEdge = nextEdge;

                    if (currU === u && currEdge.index === startEdge.index) break;
                }

                if (!broken && cycle.length > 2 && currU === u) {
                    faces.push(cycle);
                }
            }
        }
        return faces;
    }

    private calculateSignedArea(polygon: Point[]): number {
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            let j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return area / 2.0;
    }

    private calculatePerimeter(polygon: Point[]): number {
        let p = 0;
        for (let i = 0; i < polygon.length; i++) {
            let j = (i + 1) % polygon.length;
            const dx = polygon[j].x - polygon[i].x;
            const dy = polygon[j].y - polygon[i].y;
            p += Math.sqrt(dx * dx + dy * dy);
        }
        return p;
    }

    private calculateBBox(polygon: Point[]): number[] {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygon.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
        return [minX, minY, maxX, maxY];
    }
}
