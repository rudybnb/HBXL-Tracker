import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const AUDIO_DIR = 'audio';

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Generate audio file using ElevenLabs TTS API
 * Caches files by text hash to avoid regenerating same content
 * Returns public URL for the audio file
 */
export async function generateTTSAudio(text: string, voiceId?: string): Promise<string> {
  if (!ELEVEN_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  // Default voice ID (can be overridden)
  const VOICE_ID = voiceId || 'JBFqnCBsd6RMkjVDRZzb'; // George voice (professional male)

  // Generate stable filename based on text content (cache-friendly)
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 16);
  const filename = `${hash}.mp3`;
  const filepath = join(AUDIO_DIR, filename);

  // Return cached file if it exists
  if (existsSync(filepath)) {
    console.log(`🎵 Using cached TTS audio: ${filename}`);
    const publicUrl = getPublicAudioUrl(filename);
    return publicUrl;
  }

  // Generate new audio file
  console.log(`🎙️ Generating TTS audio for: "${text.slice(0, 50)}..."`);

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.9,
        style: 0.3
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  // Save audio file
  const audioBuffer = await response.buffer();
  writeFileSync(filepath, audioBuffer);

  console.log(`✅ TTS audio generated and saved: ${filename}`);

  const publicUrl = getPublicAudioUrl(filename);
  return publicUrl;
}

/**
 * Get public URL for audio file
 */
function getPublicAudioUrl(filename: string): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
  const protocol = process.env.REPLIT_DEV_DOMAIN ? 'https' : 'http';
  return `${protocol}://${domain}/audio/${filename}`;
}

/**
 * Available ElevenLabs voices
 */
export const ELEVEN_VOICES = {
  GEORGE: 'JBFqnCBsd6RMkjVDRZzb', // Professional male
  BELLA: '21m00Tcm4TlvDq8ikWAM', // Soft female
  RACHEL: '21m00Tcm4TlvDq8ikWAM', // Professional female
  ANTONI: 'ErXwobaYiN019PkySvjV', // Well-rounded male
  JOSH: 'TxGEqnHWrfWFTfGW9XjX', // Deep male
  ARNOLD: 'VR6AewLTigWG4xSOukaG', // Crisp male
};
