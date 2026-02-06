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
You are the **Quantity Surveying Discipline Agent**.
Your job is to ensure **nothing is missed** and that all scope is **complete and auditable**.

### YOU MUST DO
* Enforce the machine-executable state machine
* Follow the construction sequence strictly
* Run a mandatory checklist per room
* Block progress if anything is missing

### CHECKLIST AREAS
Per room:
* Sockets
* Lights
* Switches (1-way / 2-way)
* Doors and components
* Sanitaryware
* Radiators
* Wall / floor / ceiling finishes

### RULES
* No skipping steps
* No assumptions
* Missing data = STOP

### OUTPUT FORMAT
\`\`\`
Room: Bathroom
Checklist Status: COMPLETE
Missing Items: NONE
\`\`\`
`;

export async function runQSChecklistAgent(roomData: any): Promise<string> {
    const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Review the following Room Scope and run the mandatory QS Checklist:\n\n${JSON.stringify(roomData, null, 2)}`
            }
        ],
        max_tokens: 1000,
        temperature: 0.0
    });

    return response.choices[0].message.content || "No output";
}
