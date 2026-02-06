
import { QSCalculator } from './qs-calculator';

// Mock the Freddy Jackson CSV content
const csvContent = `Order Date, Date Required, Build Phase,Type of Resource, Resource Type, Supplier, Product Code, Resource Description, Resource Description Without Price, Order Quantity
22/12/2025,22/12/2025,"Footings","Material","Bricks","HBXL Price Tracker+","HB00038","Engineering Brick - Class A Blue 65mm £1.66/Each","Engineering Brick - Class A Blue 65mm (Each)",253
26/01/2026,26/01/2026,"Footings","Labour","Bricklayer","Provisional","","2 Bricklayers & Mate £88.00/Hours","2 Bricklayers & Mate (Hours)",11
09/02/2026,09/02/2026,"Electrical 1st Fix","Material","Electrics","HBXL Price Tracker+","HB00172","3 Core & Earth Cable 1mm (100m) £58.50/Each","3 Core & Earth Cable 1mm (100m) (Each)",1`;

// Simulate the parsing logic I added to routes.ts
function parse(lines: string[]) {
    let headerEndIndex = 0;

    // Header Detection
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
        // Updated Check
        if (cols[0]?.toLowerCase().includes("resource quantity") || cols[0]?.toLowerCase().includes("phase") || cols[2]?.toLowerCase().includes("build phase")) {
            headerEndIndex = i + 1;
            console.log("Found header at index", i);
            break;
        }
    }

    const hbxLines = [];
    for (let i = headerEndIndex; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (cols.length < 5) continue;
        const clean = (s: string) => s ? s.replace(/^"|"$/g, '').trim() : '';

        const col2 = clean(cols[2]); // Phase
        const col7 = clean(cols[7]); // Desc

        console.log(`Row ${i}: Col2=${col2}, Col7=${col7}`);

        if (col2 && col7 && col7.includes("£")) {
            const phase = col2;
            let rawDesc = col7;
            let price = 0;
            let unit = "";
            let desc = "";

            const priceMatch = rawDesc.match(/£([\d.]+)\/([a-zA-Z0-9³²]+)/);
            if (priceMatch) {
                price = parseFloat(priceMatch[1]);
                unit = priceMatch[2];
                desc = rawDesc.replace(priceMatch[0], "").trim();
            } else {
                desc = rawDesc;
            }
            const qty = parseFloat(clean(cols[9] || "0").replace(/[^0-9.-]/g, ""));
            const total = parseFloat((price * qty).toFixed(2));

            hbxLines.push({ Phase: phase, Description: desc, Unit: unit, Price: price, Qty: qty, Total: total });
        }
    }
    console.log("Parsed Items:", hbxLines);
}

const lines = csvContent.split('\n');
parse(lines);
