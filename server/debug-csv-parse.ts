/**
 * Debug script to test CSV parsing for Job 49 format
 * Run with: npx tsx server/debug-csv-parse.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, '..', '..', 'Job 49 test for job tracker - Materials Used.csv');

console.log('📄 Reading CSV from:', csvPath);

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

console.log(`📊 Total lines: ${lines.length}`);
console.log('\n📋 First 7 lines:');
lines.slice(0, 7).forEach((line, i) => console.log(`  ${i}: ${line.substring(0, 100)}...`));

// Helper function to properly parse CSV with quoted values containing commas
const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
};

// Find the header row
const materialsFormatIndex = lines.findIndex(line =>
    line.includes('Resource quantity') &&
    line.includes('Resource cost') &&
    (line.includes('excluding wastage') || line.includes('including wastage'))
);

console.log(`\n🎯 Materials format header at line: ${materialsFormatIndex}`);

if (materialsFormatIndex !== -1) {
    console.log(`  Header: ${lines[materialsFormatIndex].substring(0, 100)}...`);
}

// Check for Grand Total row
let csvGrandTotal = 0;
for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('Grand Total')) {
        const columns = parseCSVLine(line);
        console.log(`\n📊 Grand Total row found at line ${i}:`);
        console.log(`  Raw: ${line}`);
        console.log(`  Parsed columns (${columns.length}):`, columns);
        const lastCol = columns[columns.length - 1];
        if (lastCol) {
            csvGrandTotal = parseFloat(lastCol.replace(/[£,]/g, ''));
            console.log(`  Extracted Grand Total: £${csvGrandTotal.toFixed(2)}`);
        }
        break;
    }
}

// Parse and sum all data rows
let totalValue = 0;
let totalRows = 0;
let rowsWithZeroCost = 0;
const phasesSeen: Record<string, number> = {};

console.log('\n📝 Sample parsed rows:');

for (let i = materialsFormatIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    if (line.startsWith('Grand Total')) continue;

    const columns = parseCSVLine(line);
    const workType = columns[0] || '';
    if (!workType || workType === '') continue;

    // Get total cost from last column
    const lastCol = columns[columns.length - 1];
    let totalCost = 0;
    if (lastCol) {
        const val = lastCol.replace(/[£,]/g, '');
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) {
            totalCost = parsed;
        }
    }

    totalRows++;
    totalValue += totalCost;

    if (totalCost === 0) rowsWithZeroCost++;

    // Track phases
    if (!phasesSeen[workType]) phasesSeen[workType] = 0;
    phasesSeen[workType] += totalCost;

    // Show first 5 rows and any with large costs
    if (totalRows <= 5 || totalCost > 500) {
        console.log(`  Row ${totalRows}: phase="${workType}", cols=${columns.length}, lastCol="${lastCol}", cost=£${totalCost.toFixed(2)}`);
    }
}

console.log('\n📊 SUMMARY:');
console.log(`  Total data rows parsed: ${totalRows}`);
console.log(`  Rows with £0 cost: ${rowsWithZeroCost}`);
console.log(`  Calculated total: £${totalValue.toFixed(2)}`);
console.log(`  CSV Grand Total row: £${csvGrandTotal.toFixed(2)}`);
console.log(`  Difference: £${Math.abs(totalValue - csvGrandTotal).toFixed(2)}`);

console.log('\n📂 Phases and their totals:');
Object.entries(phasesSeen)
    .sort((a, b) => b[1] - a[1])
    .forEach(([phase, total]) => {
        console.log(`  ${phase}: £${total.toFixed(2)}`);
    });
