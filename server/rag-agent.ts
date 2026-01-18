
import OpenAI from "openai";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { rooms, extractedElements, jobFiles } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class RagAgent {
    /**
     * Generates a response to a user question about a specific drawing file.
     * dynamically assembles context from the database.
     */
    async chatAboutDrawing(fileId: string, userMessage: string): Promise<string> {
        try {
            // 1. Fetch Context
            // Get File Info
            const [file] = await db.select().from(jobFiles).where(eq(jobFiles.id, fileId));
            if (!file) throw new Error("File not found");

            const jobId = file.jobId;

            // Get Rooms successfully extracted (conceptually linked to job, but good context)
            const allRooms = await db.select().from(rooms).where(eq(rooms.jobId, jobId));

            // Get Elements specifically extracted from this file
            const elements = await db.select().from(extractedElements).where(eq(extractedElements.fileId, fileId));

            // 2. Build Text Context
            let context = `Current Drawing: ${file.originalName}\n`;
            context += `Project Context (Job ID: ${jobId})\n\n`;

            if (allRooms.length > 0) {
                context += `Identified Rooms in Project:\n`;
                allRooms.forEach(r => {
                    context += `- ${r.name} (${r.floor})\n`;
                });
                context += `\n`;
            }

            if (elements.length > 0) {
                context += `BLUEPRINT READER FINDINGS (Visual & Text):\n`;

                // Group elements by room for spatial context
                const elementsByRoom: Record<string, any[]> = {};
                elements.forEach(e => {
                    const room = e.roomName || "Unallocated";
                    if (!elementsByRoom[room]) elementsByRoom[room] = [];
                    elementsByRoom[room].push(e);
                });

                // Output categorized lists
                Object.keys(elementsByRoom).sort().forEach(room => {
                    context += `\n📍 ROOM: ${room.toUpperCase()}\n`;
                    elementsByRoom[room].forEach(e => {
                        const code = e.elementCode || "No Code";
                        context += `   - [${code}] ${e.description || e.elementType} (Qty: ${e.quantity})\n`;
                    });
                });
            } else {
                context += `No specific elements were extracted from this drawing yet.\n`;
            }

            // 3. System Prompt
            const systemPrompt = `You are an expert AI Construction Assistant named "New SKI".
You are analyzing a construction drawing.
Use the provided extracted data to answer the user's question.
If the answer is not in the data, verify if it might be inferred, otherwise state you don't know.
Be helpful, professional, and concise.
Structure your answer with markdown if needed (lists, bolding).

CONTEXT DATA:
${context}
`;

            // 4. Call LLM
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3, // Low temperature for factual accuracy
            });

            return response.choices[0].message.content || "I couldn't generate a response.";

        } catch (error) {
            console.error("RAG Agent Error:", error);
            throw new Error("Failed to process your question about the drawing.");
        }
    }
}

export const ragAgent = new RagAgent();
