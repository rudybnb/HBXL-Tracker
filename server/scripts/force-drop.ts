
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting...");
        await client.connect();
        console.log("Connected. Dropping table extracted_elements...");
        await client.query("DROP TABLE IF EXISTS extracted_elements CASCADE");
        console.log("Table dropped successfully.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
