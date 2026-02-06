
console.log("Starting test-db-inline.ts");
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared-cashflow/schema";
import { sql } from "drizzle-orm";

console.log("Imports done");

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });
console.log("DB initialized");

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
