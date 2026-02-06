
import { neon } from "@neondatabase/serverless";
console.log("Imported neon");

const url = "postgresql://hbxl_tracker_db_user:8y5XwyxylJ0ASXYiTIyNeMH6Kxrdwd1w@dpg-d5jpo7vgi27c73e0hjq0-a.frankfurt-postgres.render.com/hbxl_tracker_db";
const sql = neon(url);
console.log("Created sql client");

async function test() {
    console.log("Executing query...");
    try {
        const result = await sql("SELECT 1");
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
