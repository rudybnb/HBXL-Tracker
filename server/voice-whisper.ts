import OpenAI from 'openai';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import { FileWriter } from 'wav';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Convert mulaw to linear PCM
 * Twilio sends mulaw-encoded audio, we need to convert it to PCM
 */
function mulawToPcm(mulaw: Buffer): Buffer {
  const MULAW_BIAS = 0x84;
  const MULAW_MAX = 0x1FFF;
  
  const pcm = Buffer.alloc(mulaw.length * 2); // 16-bit samples
  
  for (let i = 0; i < mulaw.length; i++) {
    let mulawByte = ~mulaw[i];
    let sign = mulawByte & 0x80;
    let exponent = (mulawByte >> 4) & 0x07;
    let mantissa = mulawByte & 0x0F;
    let sample = (mantissa << 3) + MULAW_BIAS;
    sample = sample << exponent;
    
    if (sign != 0) {
      sample = -sample;
    }
    
    // Write as 16-bit little-endian
    pcm.writeInt16LE(sample, i * 2);
  }
  
  return pcm;
}

/**
 * Simple resampling from 8kHz to 16kHz (doubles every sample)
 */
function resample8kTo16k(pcm8k: Buffer): Buffer {
  const pcm16k = Buffer.alloc(pcm8k.length * 2);
  
  for (let i = 0; i < pcm8k.length; i += 2) {
    const sample = pcm8k.readInt16LE(i);
    pcm16k.writeInt16LE(sample, i * 2);       // Original sample
    pcm16k.writeInt16LE(sample, (i * 2) + 2); // Duplicate sample
  }
  
  return pcm16k;
}

/**
 * Create a proper WAV file from PCM audio
 */
async function createWavFile(pcmBuffer: Buffer, outputPath: string, sampleRate: number = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = new FileWriter(outputPath, {
      channels: 1,
      sampleRate,
      bitDepth: 16
    });
    
    writer.write(pcmBuffer);
    writer.end();
    
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}

/**
 * Create WAV buffer from PCM16 data at 16kHz
 */
export function wav16kFromPcm16(pcm16: Buffer): Buffer {
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm16.length, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // chunk size
  header.writeUInt16LE(1, 20);         // audio format (PCM)
  header.writeUInt16LE(1, 22);         // num channels
  header.writeUInt32LE(16000, 24);     // sample rate
  header.writeUInt32LE(32000, 28);     // byte rate
  header.writeUInt16LE(2, 32);         // block align
  header.writeUInt16LE(16, 34);        // bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(pcm16.length, 40);
  
  return Buffer.concat([header, pcm16]);
}

/**
 * Transcribe audio buffer to text using OpenAI Whisper
 * Accepts either mulaw or WAV buffer
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    let wavBuffer: Buffer;
    
    // Check if it's already a WAV file (starts with "RIFF")
    if (audioBuffer.toString('utf8', 0, 4) === 'RIFF') {
      wavBuffer = audioBuffer;
    } else {
      // Convert mulaw to PCM and create WAV
      const pcmBuffer = mulawToPcm(audioBuffer);
      const tempFile = join('/tmp', `audio_${Date.now()}.wav`);
      await createWavFile(pcmBuffer, tempFile, 8000);
      wavBuffer = await import('fs/promises').then(fs => fs.readFile(tempFile));
      await unlink(tempFile).catch(() => {});
    }
    
    console.log(`🎤 Transcribing ${audioBuffer.length} bytes...`);
    
    // Create a temporary file for Whisper
    const tempFile = join('/tmp', `whisper_${Date.now()}.wav`);
    await writeFile(tempFile, wavBuffer);
    
    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempFile) as any,
      model: 'whisper-1',
      language: 'en'
    });
    
    // Cleanup
    await unlink(tempFile).catch(() => {});
    
    const text = (transcription as any).text || '';
    
    if (text) {
      console.log(`✅ Transcription: "${text}"`);
    }
    
    return text.trim();
    
  } catch (error: any) {
    console.error('❌ Whisper transcription error:', error.message);
    return '';
  }
}

/**
 * Export utility functions
 */
export { mulawToPcm, resample8kTo16k };
