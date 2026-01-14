import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface Message {
  user?: string;
  assistant?: string;
}

/**
 * Get GPT response for conversational AI
 * Maintains conversation history for context
 */
export async function getGPTResponse(
  prompt: string, 
  history: Message[],
  systemPrompt?: string
): Promise<string> {
  try {
    // Build conversation messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt || 
          'You are a helpful voice assistant for a contractor management company. ' +
          'You help with scheduling, time tracking, job assignments, and general questions. ' +
          'Keep responses conversational and concise for voice interaction. ' +
          'If asked about specific contractor data, provide accurate information. ' +
          'You can help with clocking in/out, checking assignments, and workforce status.'
      }
    ];
    
    // Add conversation history
    for (const msg of history) {
      if (msg.user) {
        messages.push({ role: 'user', content: msg.user });
      }
      if (msg.assistant) {
        messages.push({ role: 'assistant', content: msg.assistant });
      }
    }
    
    // Add current prompt
    messages.push({ role: 'user', content: prompt });
    
    console.log(`🤖 Sending to GPT: "${prompt.slice(0, 50)}..."`);
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // FASTEST model
      messages,
      temperature: 0.7,
      max_tokens: 120 // Cap for speed
    });
    
    const reply = response.choices[0]?.message?.content || 'I apologize, I did not understand that.';
    
    console.log(`✅ GPT response: "${reply.slice(0, 50)}..."`);
    
    return reply;
    
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.message);
    return 'I apologize, I am having trouble processing that request right now. Please try again.';
  }
}

/**
 * Get specialized response for contractor actions
 */
export async function getContractorActionResponse(
  action: string,
  contractorName: string,
  context?: any
): Promise<string> {
  const systemPrompt = 
    'You are a voice assistant helping contractors with their work tasks. ' +
    'Provide brief, clear confirmations and next steps. ' +
    'Be encouraging and professional.';
  
  const prompt = `A contractor named ${contractorName} is ${action}. ${
    context ? `Context: ${JSON.stringify(context)}` : ''
  } Provide a brief voice confirmation.`;
  
  return getGPTResponse(prompt, [], systemPrompt);
}

/**
 * Get specialized response for admin queries
 */
export async function getAdminResponse(
  query: string,
  data?: any
): Promise<string> {
  const systemPrompt = 
    'You are a voice assistant helping an admin manage their workforce. ' +
    'Provide clear summaries of data and actionable insights. ' +
    'Be professional and efficient.';
  
  const prompt = data 
    ? `${query}\n\nData: ${JSON.stringify(data)}`
    : query;
  
  return getGPTResponse(prompt, [], systemPrompt);
}
