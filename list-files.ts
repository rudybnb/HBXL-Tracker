
import 'dotenv/config';
import { db } from './server/db';
import { jobFiles } from './shared/schema';

async function listFiles() {
    const files = await db.select().from(jobFiles);
    console.log(`Found ${files.length} files total.`);
    files.forEach(f => {
        console.log(`ID: ${f.id} | Name: \"${f.filename}\" | Path: \"${f.filePath}\" | Job: ${f.jobId}`);
    });
    process.exit(0);
}

listFiles();
