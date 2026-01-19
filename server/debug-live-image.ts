
import { extractFromImage } from './drawing-extraction-agent';
import * as path from 'path';

async function runDebug() {
    const imagePath = 'C:/Users/rudyb/.gemini/antigravity/brain/122fb878-7a18-4963-b165-b34f7a6f71de/uploaded_image_0_1768828920806.png';
    console.log(`🔍 Debugging extraction for: ${imagePath}`);

    try {
        const result = await extractFromImage(imagePath);
        console.log('---------------------------------------------------');
        console.log('EXTRACTED ROOMS:', JSON.stringify(result.rooms, null, 2));
        console.log('---------------------------------------------------');
        console.log('EXTRACTED ELEMENTS:', JSON.stringify(result.detailedElements, null, 2));
        console.log('---------------------------------------------------');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

runDebug();
