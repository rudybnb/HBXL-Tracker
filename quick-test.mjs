// Quick test script - run with: node quick-test.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not set');
    process.exit(1);
}

console.log('✅ API Key loaded:', apiKey.substring(0, 20) + '...');

const openai = new OpenAI({ apiKey });

const imagePath = path.join(__dirname, '..', 'Test HBXL.JPG');
console.log('📁 Image path:', imagePath);

if (!fs.existsSync(imagePath)) {
    console.log('❌ Image not found!');
    process.exit(1);
}

console.log('✅ Image found');

const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
console.log('📊 Image size:', (imageBuffer.length / 1024).toFixed(2), 'KB');

const prompt = `You are analyzing a construction floor plan drawing.
Your job is to IDENTIFY ROOMS and their DIMENSIONS only.

**DO NOT:**
- Generate costs or rates
- Make up prices
- Estimate quantities

**DO:**
- Identify all room names visible in the drawing (e.g., "Lounge", "Bathroom", "Kitchen", "Bedroom")
- Extract room dimensions if shown (in mm or m)
- Calculate approximate floor area from dimensions
- Note any visible element codes (D01, W01, etc.) and which room they belong to

Respond ONLY with valid JSON:
{
  "rooms": [
    {
      "name": "Room Name",
      "floor": "Ground",
      "dimensions": "4850mm x 3600mm",
      "area": 17.46,
      "elements": ["D01", "W01"]
    }
  ]
}`;

async function test() {
    console.log('\n🔍 Sending to GPT-4 Vision...\n');

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0.1
        });

        console.log('═══════════════════════════════════════════');
        console.log('📝 RAW AI RESPONSE:');
        console.log('═══════════════════════════════════════════');
        console.log(response.choices[0]?.message?.content);
        console.log('═══════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

test();
