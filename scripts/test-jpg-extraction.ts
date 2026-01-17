
import { extractFromImage } from '../server/drawing-extraction-agent';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    // Use the copied file
    const imagePath = 'uploads/test_drawing.png';
    console.log(`🧪 Testing extraction on: ${imagePath}`);

    try {
        const result = await extractFromImage(imagePath);

        console.log('---------------------------------------------------');
        console.log(`✅ Success: ${result.success}`);
        console.log(`🏠 Rooms Found: ${result.rooms.length}`);
        result.rooms.forEach(r => console.log(`   - ${r.name} (${r.floor})`));

        console.log(`🚪 Detailed Elements Found: ${result.detailedElements.length}`);
        result.detailedElements.forEach(e => console.log(`   - [${e.room}] ${e.type} (${e.code}): ${e.description}`));

        if (result.error) {
            console.error(`❌ Error in result: ${result.error}`);
            console.log(`📝 Raw Response:\n${result.rawResponse}\n`);
        }

    } catch (error) {
        console.error('❌ Script failed:', error);
    }
}

test();
