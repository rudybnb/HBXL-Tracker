
import { db } from "./db";
import { jobs } from "@shared/schema";

async function seed() {
    console.log("Seeding database...");
    try {
        const existing = await db.select().from(jobs);
        if (existing.length === 0) {
            console.log("Inserting seeded job...");
            await db.insert(jobs).values({
                title: "Jimmy Jones - Seeded",
                location: "23 Gilbert Road",
                dueDate: new Date().toISOString(),
                status: "pending",
                externalCode: "SEED-001"
            });
            console.log("Seeded job inserted.");
        } else {
            console.log(`Database already has ${existing.length} jobs.`);
            existing.forEach(j => console.log(` - ${j.title}`));
        }
    } catch (e) {
        console.error("Seed Error:", e);
    }
    process.exit(0);
}

seed();
