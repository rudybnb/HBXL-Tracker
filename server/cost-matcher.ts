
import { db } from "./db";
import { jobCostItems, payableItems, extractedElements } from "@shared/schema";
import { eq, like, and, ilike } from "drizzle-orm";
import { log } from "./vite";

/**
 * Attempts to match extracted drawing elements to priced items from the HBXL CSV
 * and update their costs in the database.
 */
export async function matchCostsToExtractedItems(jobId: number, roomElementIds: number[]) {
    console.log(`💰 MATCHING: Starting cost match for Job ${jobId}`);

    // 1. Fetch all cost items from the CSV for this job
    const costItems = await db.select()
        .from(jobCostItems)
        .where(eq(jobCostItems.jobId, jobId));

    if (costItems.length === 0) {
        console.log(`⚠️ MATCHING: No CSV cost items found for Job ${jobId}. Skipping cost allocation.`);
        return;
    }

    // 2. Fetch all the newly created payable items (linked to room elements)
    // We need to join payableItems -> roomElements to filter by the specific IDs we just created
    // For simplicity, we'll fetch them individually or assume the caller passed the list.
    // Actually, let's just fetch all payable items for this job's rooms if possible, 
    // but to be safe, we'll traverse based on the roomElements created.

    // NOTE: 'roomElementIds' comes from the extraction process

    let matchCount = 0;
    let totalAllocated = 0;

    for (const elementId of roomElementIds) {
        // Get the payable item and the element info
        // We assume 1-to-1 mapping for now (1 payable item per room element)
        const pItems = await db.select().from(payableItems).where(eq(payableItems.elementId, elementId));

        if (pItems.length === 0) continue;
        const pItem = pItems[0];

        // Get description to match (e.g. "Window (W01)" or "General Door")
        // We might need to check the 'extractedElements' table for the raw code/description
        // But pItem.description usually holds the good stuff ("Double Glazed Window")

        const searchTerms = extractSearchTerms(pItem.description);

        // Find best match in CSV items
        const match = findBestMatch(searchTerms, costItems);

        if (match) {
            console.log(`   ✅ MATCH: "${pItem.description}" -> "${match.description}" (£${match.rate})`);

            // Update the payable item with the cost
            await db.update(payableItems)
                .set({
                    rate: match.rate,
                    total: match.rate, // Default to 1 unit for now
                    unit: match.unit,
                    status: 'not_started' // Ready for assignment
                })
                .where(eq(payableItems.id, pItem.id));

            matchCount++;
            totalAllocated += parseFloat(match.rate.toString());
        } else {
            console.log(`   🔸 NO MATCH: "${pItem.description}" (No similar item in CSV)`);
        }
    }

    console.log(`💰 MATCHING COMPLETE: Linked ${matchCount} items. Total Value: £${totalAllocated.toFixed(2)}`);
}

/**
 * Extract clean terms for searching (e.g. remove "Standard", "Generic")
 */
function extractSearchTerms(description: string): string[] {
    if (!description) return [];

    // If it has a code like (W01), definitely use that
    const codeMatch = description.match(/\(([^)]+)\)/);
    if (codeMatch) return [codeMatch[1]]; // Return "W01"

    // Otherwise split by space and take key words
    return description.toLowerCase()
        .replace(/standard|generic|internal|external/g, '')
        .split(' ')
        .filter(w => w.length > 2);
}

/**
 * Fuzzy finder for cost items
 */
function findBestMatch(terms: string[], costItems: any[]): any | null {
    if (terms.length === 0) return null;

    // Priority 1: Exact code match (e.g. "W01")
    for (const item of costItems) {
        if (terms.length === 1 && item.description.includes(terms[0])) {
            return item;
        }
    }

    // Priority 2: Keyword match (any word matches)
    // Matches "Window" in "Supply and fit Window type..."
    for (const item of costItems) {
        const descLower = item.description.toLowerCase();
        if (terms.some(t => descLower.includes(t))) {
            return item;
        }
    }

    return null;
}
