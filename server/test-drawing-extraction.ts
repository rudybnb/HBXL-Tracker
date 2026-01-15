/**
 * Test Script: Drawing Extraction Debug
 * Run with: npx tsx server/test-drawing-extraction.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { extractFromImage } from './drawing-extraction-agent';

async function testExtraction() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 DRAWING EXTRACTION TEST');
    console.log('═══════════════════════════════════════════════════════════════');

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.log('\n❌ ERROR: OPENAI_API_KEY environment variable is not set!');
        console.log('   Please set it before running this test.');
        console.log('   Example: $env:OPENAI_API_KEY="sk-..." (PowerShell)');
        process.exit(1);
    }
    console.log('✅ OpenAI API Key is configured');

    // Path to test drawing
    const testImagePath = path.join(__dirname, '..', '..', 'Test HBXL.JPG');

    console.log(`\n📁 Test Image Path: ${testImagePath}`);

    // Check if file exists
    if (!fs.existsSync(testImagePath)) {
        console.log('❌ ERROR: Test image not found!');
        console.log('   Expected: Test HBXL.JPG in project root');
        process.exit(1);
    }

    const stats = fs.statSync(testImagePath);
    console.log(`📊 File Size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log('\n🔍 Starting GPT-4 Vision extraction...\n');
    console.log('─────────────────────────────────────────────────────────────────');

    const startTime = Date.now();

    try {
        const result = await extractFromImage(testImagePath);

        const duration = Date.now() - startTime;

        console.log('─────────────────────────────────────────────────────────────────');
        console.log(`\n⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
        console.log(`📊 Success: ${result.success}`);

        if (result.error) {
            console.log(`❌ Error: ${result.error}`);
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🏠 EXTRACTED ROOMS:');
        console.log('═══════════════════════════════════════════════════════════════');

        if (result.rooms && result.rooms.length > 0) {
            result.rooms.forEach((room, index) => {
                console.log(`\n  ${index + 1}. ${room.name}`);
                console.log(`     Floor: ${room.floor}`);
                console.log(`     Dimensions: ${room.dimensions || 'Not detected'}`);
                console.log(`     Area: ${room.area ? room.area + ' sqm' : 'Not calculated'}`);
                console.log(`     Elements: ${room.elements?.length > 0 ? room.elements.join(', ') : 'None detected'}`);
            });
        } else {
            console.log('\n  ⚠️  No rooms were extracted!');
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📝 RAW AI RESPONSE:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(result.rawResponse || '(empty)');

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('✅ TEST COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ EXTRACTION FAILED WITH ERROR:');
        console.error(error);
    }
}

// Run the test
testExtraction();
