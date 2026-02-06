
import { Point } from "./geometric-room-detector";

export class GridRoomDetector {
    private gridSize: number; // in meters (e.g. 0.05 for 5cm)

    constructor(gridSizeMM = 50) {
        this.gridSize = gridSizeMM / 1000;
    }

    public detectRooms(wallPolygons: Point[][]): { polygon: Point[], area: number, perimeter: number }[] {
        if (wallPolygons.length === 0) return [];

        console.log(`🧱 GridRoomDetector: Rasterizing with ${this.gridSize}m resolution...`);

        // 1. Determine World Bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        wallPolygons.forEach(poly => {
            poly.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });

        // Add padding
        const padding = 1.0; // 1 meter padding
        minX -= padding; minY -= padding;
        maxX += padding; maxY += padding;

        const width = Math.ceil((maxX - minX) / this.gridSize);
        const height = Math.ceil((maxY - minY) / this.gridSize);

        console.log(`   Grid Dimensions: ${width} x ${height} cells.`);
        if (width * height > 5000000) {
            console.warn("   ⚠️ Grid too large! Aborting to prevent OOM.");
            return [];
        }

        // 2. Create Grid (0 = Empty, 1 = Wall, 2+ = Room IDs)
        const grid = new Uint8Array(width * height);

        // 3. Rasterize Walls
        wallPolygons.forEach(poly => {
            // Get wall bbox in grid coords
            let wMinX = width, wMaxX = 0, wMinY = height, wMaxY = 0;
            poly.forEach(p => {
                const gx = Math.floor((p.x - minX) / this.gridSize);
                const gy = Math.floor((p.y - minY) / this.gridSize);
                wMinX = Math.min(wMinX, gx);
                wMaxX = Math.max(wMaxX, gx);
                wMinY = Math.min(wMinY, gy);
                wMaxY = Math.max(wMaxY, gy);
            });

            // Clamp
            wMinX = Math.max(0, wMinX); wMaxX = Math.min(width - 1, wMaxX);
            wMinY = Math.max(0, wMinY); wMaxY = Math.min(height - 1, wMaxY);

            // Rasterize (Simple Box check + Point in Polygon for precision)
            for (let y = wMinY; y <= wMaxY; y++) {
                for (let x = wMinX; x <= wMaxX; x++) {
                    const wx = minX + (x + 0.5) * this.gridSize;
                    const wy = minY + (y + 0.5) * this.gridSize;
                    if (this.isPointInPolygon({ x: wx, y: wy }, poly)) {
                        grid[y * width + x] = 1; // Wall
                    }
                }
            }
        });

        // 4. Flood Fill to find Rooms
        const rooms: { polygon: Point[], area: number, perimeter: number }[] = [];
        const visited = new Uint8Array(width * height); // keep track of visited for floodfill separate from grid types

        // Mark walls as visited
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] === 1) visited[i] = 1;
        }

        // Helper: Get Index
        const idx = (x: number, y: number) => y * width + x;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (visited[idx(x, y)] === 0) {
                    // Start Flood Fill
                    const { cells, isExterior } = this.floodFill(x, y, width, height, visited, grid);

                    if (!isExterior && cells.length > 0) {
                        // Calculate Area
                        const area = cells.length * (this.gridSize * this.gridSize);

                        // Filter tiny areas (< 1.0m2)
                        if (area > 1.0) {
                            // Extract Boundary Polygon
                            const polygon = this.traceBoundary(cells, width, height, minX, minY);
                            // Simplify with Douglas-Peucker. Tolerance = 1.5x Grid Size to smooth stairs.
                            const simplified = this.simplifyPolygon(polygon, this.gridSize * 1.5);
                            const perimeter = this.calculatePerimeter(simplified);

                            rooms.push({
                                polygon: simplified,
                                area,
                                perimeter
                            });
                        }
                    }
                }
            }
        }

        return rooms;
    }

    private floodFill(startX: number, startY: number, w: number, h: number, visited: Uint8Array, grid: Uint8Array) {
        const stack = [startX, startY];
        const cells: { x: number, y: number }[] = [];
        let isExterior = false;
        const idx = (x: number, y: number) => y * w + x;

        // Mark start
        visited[idx(startX, startY)] = 1;
        cells.push({ x: startX, y: startY });

        let ptr = 0;
        while (ptr < cells.length) {
            const { x, y } = cells[ptr++];

            // Check if touching border -> Exterior
            if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
                isExterior = true;
            }

            // Neighbors 4-way
            const neighbors = [
                { nx: x + 1, ny: y },
                { nx: x - 1, ny: y },
                { nx: x, ny: y + 1 },
                { nx: x, ny: y - 1 }
            ];

            for (const { nx, ny } of neighbors) {
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const i = idx(nx, ny);
                    if (visited[i] === 0 && grid[i] !== 1) { // Not visited, Not Wall
                        visited[i] = 1;
                        cells.push({ x: nx, y: ny });
                    }
                }
            }
        }

        return { cells, isExterior };
    }

    // Simplistic Boundary Tracing from a set of cells
    // Strategy: Create a set of "edges" for every cell. Remove edges that are shared. Remaining edges form the boundary.
    private traceBoundary(cells: { x: number, y: number }[], w: number, h: number, worldMinX: number, worldMinY: number): Point[] {
        const edges = new Set<string>(); // "x1,y1-x2,y2"

        // Helper to toggle edge
        const toggleEdge = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
            // Normalized key: sort points
            const k = `${p1.x},${p1.y}-${p2.x},${p2.y}`;
            if (edges.has(k)) edges.delete(k); // Shared edge (internal) -> remove
            else edges.add(k);
        };

        // For each cell, add its 4 edges. 
        // If an edge is added twice (shared by 2 cells), it is removed.
        // What remains is the boundary.
        cells.forEach(c => {
            // Clockwise edges for a unit square at c.x, c.y
            // Top: (0,1) -> (1,1)
            // Right: (1,1) -> (1,0)
            // Bottom: (1,0) -> (0,0)
            // Left: (0,0) -> (0,1)
            // Actually, let's just use consistent ordering. 
            // We use grid coords.
            const p00 = { x: c.x, y: c.y };
            const p10 = { x: c.x + 1, y: c.y };
            const p11 = { x: c.x + 1, y: c.y + 1 };
            const p01 = { x: c.x, y: c.y + 1 };

            // We need directed edges to trace? Or just set of undirected segments?
            // Undirected segments approach works for finding the set of lines.
            // But we need an ordered polygon.
            // Let's rely on standard "Marching Squares" or just simple edge walking.

            // To make sorting edges easier, let's use a Map where key=StartPoint, val=EndPoint[]
            // But edge sharing removal is best done with undirected keys.
            // Actually, tracing the outer boundary of a set of pixels is simpler:
            // 1. Find a top-left most pixel.
            // 2. Walk "Hand on Left Wall".
        });

        // RE-IMPLEMENTATION: MOORE-NEIGHBOR TRACING
        // 1. Find Start Pixel (Top-Left most)
        // cells are not sorted. Let's sort or find min.
        let startCell = cells[0];
        for (const c of cells) {
            if (c.y < startCell.y || (c.y === startCell.y && c.x < startCell.x)) {
                startCell = c;
            }
        }

        const boundary: Point[] = [];
        // Walk direction: 0=Up, 1=Right, 2=Down, 3=Left
        // Entrance direction to startCell from "Left" logic essentially.
        // We need a definition of "Pixel Boundary".
        // Let's assume we are tracing the grid lines.
        // Start Point: (startCell.x, startCell.y) bottom-left? No top-left is (x, y+1) in mathematical?
        // Let's say grid (x,y) corresponds to box [x, x+1] x [y, y+1].
        // "Top-Left" of the set of pixels? 
        // We found minY then minX. 
        // So we are at the top-left-most pixel. Its Left Edge (x, y)->(x, y+1) is definitely a boundary.
        // Let's trace edges.

        // Simpler approach for Proto:
        // Use Convex Hull? No, rooms are concave.
        // Use "Concave Hull" / Alpha Shape? Overkill.
        // Use "Edge Dedup" approach + Sort.

        // Let's try Edge Dedup and Chain Assembly.
        const segmentSet = new Map<string, { p1: Point, p2: Point }>();
        const addSeg = (x1, y1, x2, y2) => {
            // Order so key is unique
            const k = x1 < x2 || (x1 === x2 && y1 < y2) ? `${x1},${y1}-${x2},${y2}` : `${x2},${y2}-${x1},${y1}`;
            if (segmentSet.has(k)) segmentSet.delete(k); // Shared -> Remove
            else segmentSet.set(k, { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } });
        };

        for (const c of cells) {
            // Box vertices
            const x0 = c.x, x1 = c.x + 1;
            const y0 = c.y, y1 = c.y + 1;
            // Edges
            addSeg(x0, y0, x1, y0); // Bottom
            addSeg(x1, y0, x1, y1); // Right
            addSeg(x1, y1, x0, y1); // Top
            addSeg(x0, y1, x0, y0); // Left
        }

        // Now we have a soup of segments. Assemble into loop.
        if (segmentSet.size === 0) return [];

        // Build Adjacency Graph
        const adj = new Map<string, string[]>(); // pointKey -> [pointKey, pointKey]
        const segments = Array.from(segmentSet.values());

        segments.forEach(s => {
            const k1 = `${s.p1.x},${s.p1.y}`;
            const k2 = `${s.p2.x},${s.p2.y}`;
            if (!adj.has(k1)) adj.set(k1, []);
            if (!adj.has(k2)) adj.set(k2, []);
            adj.get(k1)!.push(k2);
            adj.get(k2)!.push(k1);
        });

        // Walk the graph
        const finalPath: Point[] = [];
        const startKey = adj.keys().next().value; // Pick any
        if (!startKey) return [];

        let curr = startKey;
        let prev = null;

        // We need to handle holes? Just take the largest outer loop.
        // Or simpler: We just need "A" polygon.
        // Depth First traversal to find cycle?

        // Let's trace one loop.
        const pathKeys = [curr];
        const visitedPath = new Set<string>();
        visitedPath.add(curr);

        while (true) {
            const neighbors = adj.get(curr);
            if (!neighbors) break;

            // Pick neighbor not visited (or start if closing loop)
            let next = neighbors.find(n => n !== prev && !visitedPath.has(n));

            // Check if we can close loop
            if (!next && neighbors.includes(pathKeys[0]) && pathKeys[0] !== prev) {
                next = pathKeys[0]; // Close it
                break;
            }

            if (!next) break; // Dead end? Should not happen in boundary.

            finalPath.push({
                x: worldMinX + (parseFloat(curr.split(',')[0])) * this.gridSize,
                y: worldMinY + (parseFloat(curr.split(',')[1])) * this.gridSize
            });

            prev = curr;
            curr = next;
            visitedPath.add(curr);
            pathKeys.push(curr);
        }

        // Add final point
        finalPath.push({
            x: worldMinX + (parseFloat(curr.split(',')[0])) * this.gridSize,
            y: worldMinY + (parseFloat(curr.split(',')[1])) * this.gridSize
        });

        return finalPath;
    }

    private simplifyPolygon(points: Point[], tolerance: number = 0.5): Point[] {
        if (points.length < 3) return points;

        // 1. Filter very close points
        const unique = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const last = unique[unique.length - 1];
            const curr = points[i];
            const dist = Math.sqrt((curr.x - last.x) ** 2 + (curr.y - last.y) ** 2);
            if (dist > 0.01) unique.push(curr); // Filter identical/micro points
        }
        if (unique.length < 3) return unique;

        // 2. Simplistic "Slope" (Collinear) reduction for Grid steps
        // This turns "stairs" into lines if they align (approx)
        // Actually, Douglas-Peucker is safer for "Noise" removal.
        // Implementation of Ramer-Douglas-Peucker

        const sqr = (x: number) => x * x;
        const getSqSegDist = (p: Point, p1: Point, p2: Point) => {
            let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
            if (dx !== 0 || dy !== 0) {
                const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) { x = p2.x; y = p2.y; }
                else if (t > 0) { x += dx * t; y += dy * t; }
            }
            dx = p.x - x; dy = p.y - y;
            return dx * dx + dy * dy;
        };

        const simplifyDPStep = (pts: Point[], epsilon: number): Point[] => {
            let dmax = 0;
            let index = 0;
            const end = pts.length - 1;

            for (let i = 1; i < end; i++) {
                const d = getSqSegDist(pts[i], pts[0], pts[end]);
                if (d > dmax) { index = i; dmax = d; }
            }

            if (dmax > epsilon * epsilon) {
                const recResults1 = simplifyDPStep(pts.slice(0, index + 1), epsilon);
                const recResults2 = simplifyDPStep(pts.slice(index), epsilon);
                return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
            } else {
                return [pts[0], pts[end]];
            }
        };

        // For closed polygon, we treat it as open line P0->P0, simplify, then check close
        // Or just simplify the loop.
        // Let's use simple logic: If grid size is 50mm, we want deviation < 25mm to be flattened.
        // But stairs (zig zag 50mm) might need relaxed tolerance to become a diagonal line.
        // Let's try epsilon = grid Size * 2?
        // Tolerance passed in is usually small.
        // If detector grid is 0.05m (50mm). We can pass 0.1?

        // Ensure closed loop for processing
        const closed = [...unique];
        if (unique[0].x !== unique[unique.length - 1].x || unique[0].y !== unique[unique.length - 1].y) {
            closed.push(unique[0]);
        }

        return simplifyDPStep(closed, tolerance);
    }

    private calculatePerimeter(points: Point[]): number {
        let p = 0;
        for (let i = 0; i < points.length; i++) {
            const next = points[(i + 1) % points.length];
            p += Math.sqrt((next.x - points[i].x) ** 2 + (next.y - points[i].y) ** 2);
        }
        return p;
    }

    private isPointInPolygon(pt: Point, polygon: Point[]): boolean {
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }
}
