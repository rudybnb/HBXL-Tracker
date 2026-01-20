
// Minimal DOMMatrix polyfill for pdfjs-dist
// Supports 2D affine transformations required by PDF rendering

export class DOMMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;

    constructor(init?: string | number[]) {
        if (Array.isArray(init)) {
            // [a, b, c, d, e, f]
            this.a = init[0];
            this.b = init[1];
            this.c = init[2];
            this.d = init[3];
            this.e = init[4];
            this.f = init[5];
        } else if (typeof init === 'string') {
            // Parse string? For now fallback to identity.
            // (PDFJS mostly constructs with array or nothing)
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        } else {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    }

    // Basic methods potentially used by pdfjs
    translate(tx: number, ty: number): DOMMatrix {
        // [1 0 0 1 tx ty] * [a b c d e f]
        // Actually it's M * T? 
        // Matrix multiplication:
        // [a c e]   [1 0 tx]   [a  c  a*tx + c*ty + e]
        // [b d f] * [0 1 ty] = [b  d  b*tx + d*ty + f]
        // [0 0 1]   [0 0 1]

        // Wait, standard order is: this * newTranslation
        // The resulting X column is a*1 + c*0 + e*0 = a
        // newE = a*tx + c*ty + e
        // newF = b*tx + d*ty + f

        const m = new DOMMatrix();
        m.a = this.a;
        m.b = this.b;
        m.c = this.c;
        m.d = this.d;
        m.e = this.a * tx + this.c * ty + this.e;
        m.f = this.b * tx + this.d * ty + this.f;
        return m;
    }

    scale(sx: number, sy?: number, sz?: number, ox?: number, oy?: number, oz?: number): DOMMatrix {
        const s_x = sx;
        const s_y = sy === undefined ? sx : sy;

        // Simple 2D scale: [sx 0 0 sy 0 0]
        // Result = This * Scale
        // newA = a*sx
        // newB = b*sx
        // newC = c*sy
        // newD = d*sy
        // newE = e
        // newF = f

        const m = new DOMMatrix();
        m.a = this.a * s_x;
        m.b = this.b * s_x;
        m.c = this.c * s_y;
        m.d = this.d * s_y;
        m.e = this.e;
        m.f = this.f;
        return m;
    }

    toString(): string {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }
}
