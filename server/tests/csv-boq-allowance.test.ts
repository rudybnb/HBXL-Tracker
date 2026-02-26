/**
 * CSV_BOQ & Allowance Validation Tests
 */
const BASE = process.env.PORT5000 || "http://localhost:5000";

async function jsonFetch(url: string, opts?: RequestInit) {
    const res = await fetch(url, opts);
    let body: any;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
}

async function run() {
    console.log("\n🧪 STARTING CSV_BOQ & ALLOWANCE TESTS\n");

    // 1. Find a job
    const { body: jobs } = await jsonFetch(`${BASE}/api/jobs`);
    if (!jobs || jobs.length === 0) {
        console.log("❌ No jobs found. Ensure server is running and has data.");
        process.exit(1);
    }
    const testJob = jobs[0];
    console.log(`- Testing with job: ${testJob.title} (${testJob.id})`);

    // 2. Fetch packages
    const { body: pkgs } = await jsonFetch(`${BASE}/api/jobs/${testJob.id}/packages`);
    const csvBoqPkgs = pkgs.filter((p: any) => p.source === 'CSV_BOQ');
    const roomQtoPkgs = pkgs.filter((p: any) => p.source === 'ROOM_QTO' || p.source === 'AG_8000_ROOM_QTO');

    console.log(`- Found ${csvBoqPkgs.length} CSV_BOQ packages`);
    console.log(`- Found ${roomQtoPkgs.length} ROOM_QTO packages`);

    // 3. Test Tendering Guardrail (Should fail if CSV_BOQ is included)
    if (csvBoqPkgs.length > 0) {
        console.log("- Testing guardrail: Including CSV_BOQ in tender creation...");
        const { status, body } = await jsonFetch(`${BASE}/api/tenders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobId: testJob.id,
                packageIds: [csvBoqPkgs[0].id],
                contractorIds: ["test-contractor"],
                title: "GUARDRAIL_TEST"
            })
        });

        if (status === 400 && body.error === "CSV_BOQ_NOT_ALLOWED") {
            console.log("✅ PASS: CSV_BOQ tender creation rejected as expected.");
        } else {
            console.log(`❌ FAIL: Expected 400 CSV_BOQ_NOT_ALLOWED, got ${status} ${JSON.stringify(body)}`);
        }
    } else {
        console.log("⚠️ SKIP: No CSV_BOQ packages found to test guardrail.");
    }

    // 4. Test Allowance Detection
    console.log("- Testing allowance detection in items...");
    const { body: groupedData } = await jsonFetch(`${BASE}/api/jobs/${testJob.id}/packages?grouped=true`);

    if (!groupedData || !groupedData.ifcPackages) {
        console.log("❌ FAIL: Could not fetch grouped package data.");
        return;
    }

    let foundAllowance = false;
    // Check both roomPackages and ifcPackages
    const allPkgLists = [...groupedData.roomPackages, ...groupedData.ifcPackages];

    for (const p of allPkgLists) {
        if (!p.items) continue;
        const allowances = p.items.filter((i: any) => i.flagsJson?.allowance === true);
        if (allowances.length > 0) {
            console.log(`✅ PASS: Found ${allowances.length} allowance items in package ${p.name}.`);
            console.log(`  Example: "${allowances[0].description}" (Keywords: ${allowances[0].flagsJson.keywords?.join(', ') || 'none'})`);
            foundAllowance = true;
            break;
        }
    }

    if (!foundAllowance) {
        console.log("⚠️ WARN: No allowance items found in DB. Ensure you have imported a CSV with keywords like 'provisional' or 'allowance'.");
    }

    console.log("\n🏁 TESTS COMPLETED\n");
}

run().catch(console.error);
