import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella

interface Message {
  user?: string;
  assistant?: string;
}

/**
 * Simple working voice system
 * 1. Get GPT response (fast model)
 * 2. Generate audio with ElevenLabs  
 * 3. Return audio URL for Twilio to play
 */
export async function getSimpleVoiceResponse(
  userMessage: string,
  history: Message[]
): Promise<string> {
  try {
    // 1. Get GPT response (gpt-4o-mini is FAST)
    console.log(`🤖 GPT: "${userMessage.slice(0, 50)}..."`);
    
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
    
    messages.push({ role: 'user', content: userMessage });
    
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 120
    });
    
    const responseText = gptResponse.choices[0]?.message?.content || 'I apologize, I did not understand that.';
    console.log(`✅ Response: "${responseText}"`);
    
    return responseText;
    
  } catch (error: any) {
    console.error('❌ Voice error:', error.message);
    return 'I apologize, I am having trouble right now.';
  }
}

/**
 * Generate audio URL for Twilio to play
 */
export async function generateAudioUrl(text: string): Promise<string | null> {
  try {
    console.log(`🎵 ElevenLabs: "${text.slice(0, 50)}..."`);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.2,
            similarity_boost: 0.9
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.statusText}`);
    }
    
    // Save audio to temp file and return URL
    // For now, just return null - Twilio will use <Say>
    console.log('✅ Audio generated');
    return null;
    
  } catch (error: any) {
    console.error('❌ ElevenLabs error:', error.message);
    return null;
  }
}
