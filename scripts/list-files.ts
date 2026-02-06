
import 'dotenv/config';
import { db } from '../server/db';
import { jobFiles } from '../shared/schema';

async function list() {
    console.log("Checking DB...");
    const files = await db.select().from(jobFiles);
    console.log("Files match:", files.length);
    files.forEach(f => console.log(`- ID: ${f.id}, Name: ${f.fileName}, Path: ${f.filePath}`));
}
list();
