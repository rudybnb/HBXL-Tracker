
console.log("Testing pg Pool...");
import pg from "pg";
const { Pool } = pg;

console.log("Creating pool...");
const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
});
console.log("Pool created. connecting...");
pool.connect().then(client => {
    console.log("Connected!");
    client.release();
    pool.end();
}).catch(e => console.error(e));
