
console.log("Start test-deps.js");
import { drizzle } from "drizzle-orm/node-postgres";
console.log("Imported drizzle");
import pg from "pg";
console.log("Imported pg");
const { Pool } = pg;
const pool = new Pool();
console.log("Pool created");
