
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://hbxl_tracker_db_user:8y5XwyxylJ0ASXYiTIyNeMH6Kxrdwd1w@dpg-d5jpo7vgi27c73e0hjq0-a.frankfurt-postgres.render.com/hbxl_tracker_db",
    ssl: {
        rejectUnauthorized: false
    }
});

async function test() {
    console.log("Connecting with pg...");
    try {
        await client.connect();
        console.log("Connected with pg");
        const res = await client.query('SELECT $1::text as message', ['Hello world!']);
        console.log(res.rows[0].message); // Hello world!
        await client.end();
    } catch (err) {
        console.error("Connection error", err.stack);
    }
}

test();
