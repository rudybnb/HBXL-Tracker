async function debug() {
    const BASE = 'http://localhost:5000';
    const jRes = await fetch(BASE + '/api/jobs');
    const jobs = await jRes.json();
    if (!jobs.length) return console.log('No jobs');

    const jobId = jobs[0].id;
    console.log('Job:', jobs[0].title, jobId);

    const pRes = await fetch(BASE + '/api/jobs/' + jobId + '/packages?grouped=true');
    const data = await pRes.json();

    const all = [...(data.roomPackages || []), ...(data.ifcPackages || [])];
    all.forEach(p => {
        const priced = (p.items || []).filter(i => parseFloat(i.unitPrice) > 0);
        if (priced.length > 0) {
            console.log(`Package: ${p.name} | Items: ${p.items.length} | Priced: ${priced.length}`);
            console.log(`  Example: "${priced[0].description}" | Price: ${priced[0].unitPrice}`);
        } else {
            console.log(`Package: ${p.name} | Items: ${(p.items || []).length} | No prices found.`);
        }
    });
}
debug().catch(console.error);
