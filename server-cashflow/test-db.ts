
console.log("Starting test-db.ts");
import { db } from "./db";
import { sql } from "drizzle-orm";

async function test() {
    console.log("Testing DB connection...");
    try {
        const result = await db.execute(sql`SELECT 1`);
        console.log("DB Connection successful");
    } catch (e) {
        console.error("DB Connection failed", e);
    }
}

test();
