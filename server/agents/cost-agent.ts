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
You are the **Cost & Pricing Authority Agent**.
Your job is to resolve **scope into cost** using the CSV library.

### YOU MUST DO
* Match every item to a CSV entry
* Validate unit, name, and rate
* Reject items not found in CSV

### RULES
* CSV is the single source of cost truth
* No hard-coded prices
* No assumptions

### OUTPUT FORMAT
\`\`\`
Item: Internal door fitting
Unit: nr
Rate: £XXX
Status: VERIFIED
\`\`\`
`;

export async function runCostAgent(itemDescription: string, csvContext: string): Promise<string> {
    const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Match this item to the provided CSV data:\n\nItem: ${itemDescription}\n\nCSV Data:\n${csvContext}`
            }
        ],
        max_tokens: 1000,
        temperature: 0.0
    });

    return response.choices[0].message.content || "No output";
}
