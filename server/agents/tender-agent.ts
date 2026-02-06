import OpenAI from 'openai';

let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set.');
        openai = new OpenAI({ apiKey, timeout: 120000, maxRetries: 2 });
    }
    return openai;
}

const SYSTEM_PROMPT = `### ROLE
You are the **Commercial Output Agent**.
Your job is to convert validated scope into tender-ready and payment-ready outputs.

### YOU MUST DO
* Generate room-based tenders
* Itemise every payable line
* Enable item-complete payment

### RULES
* No phases
* No percentages
* Items only

### OUTPUT FORMAT
\`\`\`
Room: Bathroom
Item: Wall tiling
Qty: 45 sqm
\`\`\`
`;

export async function runTenderAgent(validatedScope: any): Promise<string> {
    const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Generate Tender Output for the following Scope:\n\n${JSON.stringify(validatedScope, null, 2)}`
            }
        ],
        max_tokens: 1500,
        temperature: 0.0
    });

    return response.choices[0].message.content || "No output";
}
