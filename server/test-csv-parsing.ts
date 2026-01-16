
import * as fs from 'fs';
import * as path from 'path';
import { parseEnhancedCSV } from './enhanced-csv-parser';

async function testParsing() {
    try {
        const csvPath = path.join(process.cwd(), 'xavier_jones_sample.csv');
        console.log(`Reading CSV from: ${csvPath}`);

        if (!fs.existsSync(csvPath)) {
            console.error('Sample file not found!');
            return;
        }

        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);

        console.log('--- File Header Content (First 10 lines) ---');
        lines.slice(0, 10).forEach((l, i) => console.log(`${i}: ${l}`));
        console.log('------------------------------------------');

        const result = parseEnhancedCSV(lines);

        if (result) {
            console.log('\n✅ Parse SUCCESS');
            console.log('Extracted Metadata:', JSON.stringify(result.metadata, null, 2));
        } else {
            console.log('\n❌ Parse FAILED (returned null)');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testParsing();
