import OpenAI from 'openai';
import { WebSocket } from 'ws';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella voice - natural, conversational

interface Message {
  user?: string;
  assistant?: string;
}

/**
 * STREAMING VERSION - Get GPT response with streaming
 * Much faster: starts returning text immediately
 */
export async function getGPTStreamingResponse(
  prompt: string,
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> {
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'Be friendly. Keep answers under 2 sentences unless asked.'
      }
    ];
    
    // Add history
    for (const msg of history) {
      if (msg.user) messages.push({ role: 'user', content: msg.user });
      if (msg.assistant) messages.push({ role: 'assistant', content: msg.assistant });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    console.log(`🤖 Streaming GPT: "${prompt.slice(0, 50)}..."`);
    
    // STREAMING mode - much faster!
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // FASTEST model
      messages,
      temperature: 0.7,
      max_tokens: 120, // Cap for speed
      stream: true // Enable streaming!
    });
    
    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        onChunk(content); // Send each chunk immediately!
      }
    }
    
    console.log(`✅ GPT streaming complete: "${fullText.slice(0, 50)}..."`);
    return fullText || 'I apologize, I did not understand that.';
    
  } catch (error: any) {
    console.error('❌ OpenAI streaming error:', error.message);
    return 'I apologize, I am having trouble right now.';
  }
}

/**
 * ELEVENLABS WEBSOCKET STREAMING
 * Real-time audio generation - starts playing while still generating!
 */
export async function streamElevenLabsAudio(
  text: string,
  onAudioChunk: (audioData: Buffer) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ELEVEN_API_KEY) {
      reject(new Error('ELEVENLABS_API_KEY not configured'));
      return;
    }
    
    console.log(`🎵 Starting ElevenLabs WebSocket stream for: "${text.slice(0, 50)}..."`);
    
    const ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream-input?model_id=eleven_monolingual_v1`,
      {
        headers: {
          'xi-api-key': ELEVEN_API_KEY
        }
      }
    );
    
    ws.on('open', () => {
      // Send configuration with LOWEST latency
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.2,
          similarity_boost: 0.9
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290]
        },
        optimize_streaming_latency: 4, // LOWEST LATENCY (fastest)
        xi_api_key: ELEVEN_API_KEY
      }));
      
      // Send the text
      ws.send(JSON.stringify({
        text: text,
        try_trigger_generation: true
      }));
      
      // Signal end of text
      ws.send(JSON.stringify({
        text: ''
      }));
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.audio) {
          // Decode base64 audio and send chunk
          const audioBuffer = Buffer.from(response.audio, 'base64');
          onAudioChunk(audioBuffer);
        }
        
        if (response.isFinal) {
          console.log('✅ ElevenLabs streaming complete');
          ws.close();
          resolve();
        }
      } catch (err) {
        // Might be binary audio data
        onAudioChunk(data);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ ElevenLabs WebSocket error:', error);
      reject(error);
    });
    
    ws.on('close', () => {
      resolve();
    });
  });
}

/**
 * FAST RESPONSE - Combine GPT streaming + ElevenLabs streaming
 * Start speaking as soon as first words are ready!
 */
export async function getFastVoiceResponse(
  prompt: string,
  history: Message[],
  onAudioChunk: (audioData: Buffer) => void
): Promise<string> {
  let fullResponse = '';
  let textBuffer = '';
  let isGeneratingAudio = false;
  
  // Get GPT response with streaming
  fullResponse = await getGPTStreamingResponse(
    prompt,
    history,
    async (chunk: string) => {
      textBuffer += chunk;
      
      // When we have enough text (a sentence), start streaming audio
      if ((textBuffer.includes('.') || textBuffer.includes('!') || textBuffer.includes('?')) && !isGeneratingAudio) {
        isGeneratingAudio = true;
        const sentenceToSpeak = textBuffer.trim();
        
        console.log(`🎤 Starting audio for: "${sentenceToSpeak.slice(0, 30)}..."`);
        
        // Stream audio immediately!
        await streamElevenLabsAudio(sentenceToSpeak, onAudioChunk);
      }
    }
  );
  
  // If there's remaining text that wasn't spoken
  if (textBuffer && !isGeneratingAudio) {
    await streamElevenLabsAudio(textBuffer.trim(), onAudioChunk);
  }
  
  return fullResponse;
}
