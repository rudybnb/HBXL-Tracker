console.log("Loading db.ts...");
import { drizzle } from "drizzle-orm/node-postgres";
console.log("Imported drizzle");
import pg from "pg";
console.log("Imported pg");
import * as schema from "../shared-cashflow/schema";
console.log("Imported schema");

const { Pool } = pg;

console.log("Creating Pool...");
const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
});
console.log("Pool created");

console.log("Creating drizzle instance...");
export const db = drizzle(pool, { schema });
console.log("Drizzle instance created");