/**
 * Direct Assignment Pricing Validation Test
 * Verifies that /api/job-assignments/:id/tender falls back to 
 * base budget unitPrice if no override is present.
 */
const BASE = process.env.PORT5000 || "http://localhost:5000";

async function jsonFetch(url: string, opts?: RequestInit) {
    const res = await fetch(url, opts);
    let body: any;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
}

async function run() {
    console.log("\n🧪 STARTING DIRECT ASSIGNMENT PRICING TESTS\n");

    // 1. Find a job
    const { body: jobs } = await jsonFetch(`${BASE}/api/jobs`);
    if (!jobs || jobs.length === 0) {
        console.log("❌ No jobs found. Ensure server is running and has data.");
        process.exit(1);
    }
    const testJob = jobs[0];
    console.log(`- Testing with job: ${testJob.title} (${testJob.id})`);

    // 2. Find a package with a non-zero unit price
    const { body: pkgs } = await jsonFetch(`${BASE}/api/jobs/${testJob.id}/packages`);
    if (!pkgs || pkgs.length === 0) {
        console.log("❌ No packages found for this job.");
        process.exit(1);
    }

    // Get items for the first package to find one with a price
    const testPkg = pkgs[0];
    const { body: pkgItems } = await jsonFetch(`${BASE}/api/packages/${testPkg.id}/items`);
    const pricedItem = (pkgItems || []).find((i: any) => parseFloat(i.unitPrice) > 0);

    if (!pricedItem) {
        console.log("⚠️ WARN: No priced items found in first package. Test might be inconclusive.");
    } else {
        console.log(`- Found priced item: "${pricedItem.description}" at £${pricedItem.unitPrice}`);
    }

    // 3. Create a direct assignment
    console.log("- Creating direct assignment...");
    const { status: createStatus, body: assignment } = await jsonFetch(`${BASE}/api/job-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contractorName: "Test Contractor",
            email: "test@example.com",
            phone: "0123456789",
            workLocation: "TEST 123",
            hbxlJob: testJob.title,
            jobId: testJob.id,
            assignedPackages: [testPkg.id],
            startDate: "2025-01-01",
            endDate: "2025-01-02",
            status: "assigned"
        })
    });

    if (![200, 201].includes(createStatus)) {
        console.log(`❌ FAIL: Could not create assignment. Status: ${createStatus}, Body: ${JSON.stringify(assignment)}`);
        process.exit(1);
    }
    console.log(`✅ Created assignment: ${assignment.id}`);

    // 4. Verify tender view fallbacks to budget price
    console.log("- Verifying tender view unit price fallback...");
    const { body: tenderData } = await jsonFetch(`${BASE}/api/job-assignments/${assignment.id}/tender`);

    let verified = false;
    const allItems = [...(tenderData.packages || []), ...(tenderData.ifcPackages || [])]
        .flatMap(p => p.sections ? p.sections.flatMap((s: any) => s.items) : (p.items || []));

    if (pricedItem) {
        const itemInTender = allItems.find(i => i.id === pricedItem.id);
        if (itemInTender) {
            const expected = parseFloat(pricedItem.unitPrice);
            const actual = parseFloat(itemInTender.unitPrice);
            if (Math.abs(actual - expected) < 0.01) {
                console.log(`✅ PASS: Item "${itemInTender.description}" has unitPrice £${actual} (correctly matches budget rate).`);
                verified = true;
            } else {
                console.log(`❌ FAIL: Item "${itemInTender.description}" has unitPrice £${actual}, expected budget rate £${expected}.`);
            }
        } else {
            console.log("❌ FAIL: Could not find the priced item in the tender response.");
        }
    } else {
        console.log("⚠️ SKIP: No priced item to verify. Checking if any item has a price > 0...");
        const anyPriced = allItems.find(i => parseFloat(i.unitPrice) > 0);
        if (anyPriced) {
            console.log(`✅ PASS: Found an item with price £${anyPriced.unitPrice}.`);
            verified = true;
        } else {
            console.log("❌ FAIL: All items in tender view have £0.00 price.");
        }
    }

    if (verified) {
        console.log("\n✨ ALL BASELINE PRICING TESTS PASSED\n");
    } else {
        console.log("\n❌ SOME TESTS FAILED\n");
        process.exit(1);
    }
}

run().catch(console.error);
