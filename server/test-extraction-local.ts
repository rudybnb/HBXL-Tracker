
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { extractFromImage } from './drawing-extraction-agent';

// Load environment variables
dotenv.config();

async function testExtraction() {
    const imagePath = String.raw`C:\Users\rudyb\.gemini\antigravity\brain\a512975d-3110-466a-9ca7-d73e3ff8480d\uploaded_image_1768582362323.png`;

    console.log(`🔍 Testing extraction on: ${imagePath}`);

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY is missing from .env');
        process.exit(1);
    }

    if (!fs.existsSync(imagePath)) {
        console.error('❌ Test image not found at path');
        process.exit(1);
    }

    try {
        console.log('⏳ Sending to OpenAI (this may take 30s)...');
        const result = await extractFromImage(imagePath);

        console.log('\n================ RESULT ================');
        console.log(`Success: ${result.success}`);
        console.log(`Error: ${result.error}`);

        console.log('\n--- ROOMS Found ---');
        result.rooms.forEach(r => console.log(`- ${r.name} (${r.floor})`));

        console.log('\n--- DETAILED ELEMENTS Found ---');
        if (result.detailedElements && result.detailedElements.length > 0) {
            result.detailedElements.forEach(e => {
                console.log(`[${e.room}] ${e.type}: ${e.description} (Code: ${e.code})`);
            });
        } else {
            console.log('❌ NO DETAILED ELEMENTS FOUND');
        }

        console.log('\n--- RAW RESPONSE ---');
        console.log(result.rawResponse);

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testExtraction();
