
import { Client } from 'pg';
import 'dotenv/config';

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
});

(async () => {
    try {
        console.log('Connecting to DB...');
        await client.connect();
        console.log('Connected successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('Time from DB:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
})();
