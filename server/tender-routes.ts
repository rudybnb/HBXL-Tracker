/**
 * PRE-AWARD TENDER ROUTES
 * 
 * Tender workflow: Admin creates → Contractor prices → Contractor submits → Admin approves → Assignment created
 * 
 * IMPORTANT: These endpoints are purely ADDITIVE. They do NOT modify existing
 * job-assignments, task-progress, or package-items logic.
 */

import type { Express } from "express";
import { db } from "./db";
import {
    tenderRequests,
    tenderRequestContractors,
    tenderSubmissions,
    tenderSubmissionItems,
    assignmentPricingBaseline,
    packages as packagesTable,
    packageItems,
    jobs,
    jobAssignments,
    contractorApplications,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export function registerTenderRoutes(app: Express) {

    // ============================================================
    // 1) POST /api/tenders — Admin creates a tender request
    // ============================================================
    app.post("/api/tenders", async (req, res) => {
        try {
            const { jobId, title, packageIds, contractorIds } = req.body;

            if (!jobId) return res.status(400).json({ error: "jobId is required" });
            if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
                return res.status(400).json({ error: "packageIds must be a non-empty array of package IDs" });
            }
            if (!contractorIds || !Array.isArray(contractorIds) || contractorIds.length === 0) {
                return res.status(400).json({ error: "contractorIds must be a non-empty array" });
            }

            // Validate job exists
            const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
            if (!job) return res.status(404).json({ error: "Job not found" });

            // Validate packages exist and belong to this job
            const pkgs = await db.select().from(packagesTable)
                .where(and(
                    eq(packagesTable.jobId, jobId),
                    inArray(packagesTable.id, packageIds)
                ));
            if (pkgs.length !== packageIds.length) {
                return res.status(400).json({ error: 'INVALID_PACKAGES', message: `Some packageIds not found for this job. Found ${pkgs.length} of ${packageIds.length}` });
            }

            // Ensure all packages belong to the job
            // (Standard check already performed above line 53)

            // Log package info
            console.log(`[Tender] Creating with ${pkgs.length} packages (various sources)`);

            // Log package types being included
            const roomQtoPkgs = pkgs.filter(p => p.type === 'ROOM' && p.source === 'ROOM_QTO');
            console.log(`[Tender] Creating with ${roomQtoPkgs.length} ROOM_QTO packages`);

            // Get ALL items from selected packages
            const rawItems = await db.select().from(packageItems)
                .where(inArray(packageItems.packageId, packageIds));
            const allItems = rawItems;
            if (allItems.length === 0) {
                return res.status(400).json({ error: 'NO_ITEMS', message: 'No items found in selected packages.' });
            }
            // Log m² vs non-m² breakdown
            const m2Items = rawItems.filter(item => item.unit === 'm2');
            const nonM2Items = rawItems.filter(item => item.unit !== 'm2');
            console.log(`[Tender] Items: ${m2Items.length} m² + ${nonM2Items.length} other units = ${rawItems.length} total`);

            // Resolve contractor details
            const contractors: { id: string; name: string; email: string }[] = [];
            for (const cId of contractorIds) {
                // Try contractor_applications first
                const [app] = await db.select().from(contractorApplications).where(eq(contractorApplications.id, cId));
                if (app) {
                    contractors.push({ id: app.id, name: `${app.firstName} ${app.lastName}`, email: app.email });
                } else {
                    // Fallback: just use the ID as name
                    contractors.push({ id: cId, name: cId, email: '' });
                }
            }

            // Create tender request
            const tenderTitle = title || `Tender - ${job.title} - ${new Date().toISOString().slice(0, 10)}`;
            const [tenderReq] = await db.insert(tenderRequests).values({
                jobId,
                title: tenderTitle,
                packageIds: JSON.stringify(packageIds),
                status: 'DRAFT',
            }).returning();

            // Create contractor invitations and submissions
            const submissionLinks: { contractorId: string; contractorName: string; submissionId: string; tenderLink: string }[] = [];

            for (const c of contractors) {
                // Create invitation row
                await db.insert(tenderRequestContractors).values({
                    tenderRequestId: tenderReq.id,
                    contractorId: c.id,
                    contractorName: c.name,
                    contractorEmail: c.email,
                    status: 'INVITED',
                });

                // Create submission (DRAFT) with pre-populated items
                const [submission] = await db.insert(tenderSubmissions).values({
                    tenderRequestId: tenderReq.id,
                    contractorId: c.id,
                    contractorName: c.name,
                    status: 'DRAFT',
                    currency: 'GBP',
                }).returning();

                // Pre-populate tender_submission_items from package_items (qty/unit snapshot, no pricing yet)
                if (allItems.length > 0) {
                    const itemValues = allItems.map(item => ({
                        submissionId: submission.id,
                        packageId: item.packageId,
                        packageItemId: item.id,
                        description: item.description,
                        qty: item.quantity || '0',
                        unit: item.unit || '',
                        fix: item.fix || null,
                        trade: item.trade || null,
                        unitPrice: null as string | null,
                        totalPrice: null as string | null,
                        pricingSource: 'CONTRACTOR',
                    }));
                    await db.insert(tenderSubmissionItems).values(itemValues);
                }

                submissionLinks.push({
                    contractorId: c.id,
                    contractorName: c.name,
                    submissionId: submission.id,
                    tenderLink: `/contractor-tender/${submission.id}`,
                });
            }

            res.json({
                success: true,
                tenderRequestId: tenderReq.id,
                title: tenderTitle,
                status: 'DRAFT',
                packageCount: pkgs.length,
                itemCount: allItems.length,
                contractors: submissionLinks,
            });
        } catch (e: any) {
            console.error("[Tender] Create error:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 2) POST /api/tenders/:tenderRequestId/send — Mark tender as SENT + notify contractor
    // ============================================================
    app.post("/api/tenders/:tenderRequestId/send", async (req, res) => {
        try {
            const { tenderRequestId } = req.params;
            const [tr] = await db.select().from(tenderRequests).where(eq(tenderRequests.id, tenderRequestId));
            if (!tr) return res.status(404).json({ error: "Tender request not found" });

            if (tr.status !== 'DRAFT') {
                return res.status(400).json({ error: `Cannot send — current status is '${tr.status}', must be 'DRAFT'` });
            }

            await db.update(tenderRequests).set({ status: 'SENT', updatedAt: new Date() })
                .where(eq(tenderRequests.id, tenderRequestId));

            // Update sentAt on contractor rows
            await db.update(tenderRequestContractors).set({ sentAt: new Date() })
                .where(eq(tenderRequestContractors.tenderRequestId, tenderRequestId));

            // Get contractor invitation rows (have email)
            const contractorRows = await db.select().from(tenderRequestContractors)
                .where(eq(tenderRequestContractors.tenderRequestId, tenderRequestId));

            // Get job info for email context
            const [job] = await db.select().from(jobs).where(eq(jobs.id, tr.jobId));

            // Get submission links
            const subs = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.tenderRequestId, tenderRequestId));
            const links = subs.map(s => ({
                contractorId: s.contractorId,
                contractorName: s.contractorName,
                submissionId: s.id,
                tenderLink: `/contractor-tender-new/${s.id}`,
            }));

            // ── Send Email & Telegram to each contractor ──
            const baseUrl = process.env.APP_URL || `http://localhost:5000`;
            const notifications: { contractorName: string; email: boolean; telegram: boolean }[] = [];

            for (const sub of subs) {
                const contractorRow = contractorRows.find(c => c.contractorId === sub.contractorId);
                const contractorEmail = contractorRow?.contractorEmail || '';
                const tenderLink = `${baseUrl}/contractor-tender-new/${sub.id}`;

                let emailSent = false;
                let telegramSent = false;

                // 1) Send Email
                if (contractorEmail) {
                    try {
                        const { sendContractorEmail } = await import('./email-service');
                        const emailResult = await sendContractorEmail({
                            contractorName: sub.contractorName || 'Contractor',
                            contractorEmail,
                            subject: `Tender for Pricing: ${tr.title || job?.title || 'Job'}`,
                            message: [
                                `You have been invited to price a tender.`,
                                ``,
                                `📋 Tender: ${tr.title || 'Untitled'}`,
                                `🏗️ Job: ${job?.title || 'N/A'}`,
                                `📍 Location: ${job?.location || 'N/A'}`,
                                ``,
                                `Please click the link below to view the tender items and enter your unit prices:`,
                                ``,
                                `🔗 ${tenderLink}`,
                                ``,
                                `Once you have filled in all prices, click "Submit Tender" to lock your pricing.`,
                            ].join('\n'),
                            priority: 'high',
                        });
                        emailSent = emailResult.success;
                        console.log(`[Tender] Email to ${contractorEmail}: ${emailSent ? '✅' : '❌'} ${emailResult.error || ''}`);
                    } catch (err) {
                        console.error(`[Tender] Email error for ${contractorEmail}:`, err);
                    }
                }

                // 2) Send Telegram
                try {
                    const { TelegramService } = await import('./telegram');
                    const telegram = new TelegramService();

                    // Look up contractor's Telegram chat ID from contractorApplications
                    const [app] = await db.select().from(contractorApplications)
                        .where(eq(contractorApplications.id, sub.contractorId));
                    const chatId = app?.telegramId || '7617462316'; // Default to admin

                    const message = [
                        `📋 <b>TENDER FOR PRICING</b>`,
                        ``,
                        `Hello ${sub.contractorName || 'Contractor'},`,
                        ``,
                        `You have been invited to price a tender:`,
                        ``,
                        `🏗️ <b>Job:</b> ${job?.title || 'N/A'}`,
                        `📍 <b>Location:</b> ${job?.location || 'N/A'}`,
                        `📋 <b>Tender:</b> ${tr.title || 'Untitled'}`,
                    ].join('\n');

                    // Try inline button first (works with proper domains)
                    let tgResult = await telegram.sendMessageWithButton(
                        chatId,
                        message + '\n\nTap the button below to open the tender and enter your unit prices.',
                        '📋 Open Tender & Enter Prices',
                        tenderLink
                    );

                    // Fallback: if button fails (e.g. localhost URL), send link as text
                    if (!tgResult.success) {
                        console.log(`[Tender] Button failed, falling back to text link...`);
                        const fallbackMsg = message + '\n\n' +
                            `👉 <b>Open tender to enter prices:</b>\n` +
                            `<a href="${tenderLink}">${tenderLink}</a>\n\n` +
                            `Please enter your unit prices for each item and submit when ready.`;
                        tgResult = await telegram.sendCustomMessage(chatId, fallbackMsg);
                    }

                    telegramSent = tgResult.success;
                    console.log(`[Tender] Telegram to ${chatId}: ${telegramSent ? '✅' : '❌'}`);
                } catch (err) {
                    console.error(`[Tender] Telegram error:`, err);
                }

                notifications.push({
                    contractorName: sub.contractorName || 'Unknown',
                    email: emailSent,
                    telegram: telegramSent,
                });
            }

            res.json({ success: true, status: 'SENT', tenderLinks: links, notifications });
        } catch (e: any) {
            console.error("[Tender] Send error:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 3) GET /api/tenders/:tenderRequestId — Admin view of a tender
    // ============================================================
    app.get("/api/tenders/:tenderRequestId", async (req, res) => {
        try {
            const { tenderRequestId } = req.params;
            const [tr] = await db.select().from(tenderRequests).where(eq(tenderRequests.id, tenderRequestId));
            if (!tr) return res.status(404).json({ error: "Tender request not found" });

            // Get job info
            const [job] = await db.select().from(jobs).where(eq(jobs.id, tr.jobId));

            // Get packages
            const pkgIds = JSON.parse(tr.packageIds || '[]');
            let pkgs: any[] = [];
            if (pkgIds.length > 0) {
                pkgs = await db.select().from(packagesTable).where(inArray(packagesTable.id, pkgIds));
            }

            // Get contractors
            const contractors = await db.select().from(tenderRequestContractors)
                .where(eq(tenderRequestContractors.tenderRequestId, tenderRequestId));

            // Get submissions
            const submissions = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.tenderRequestId, tenderRequestId));

            res.json({
                ...tr,
                jobTitle: job?.title || 'Unknown',
                packages: pkgs.map(p => ({ id: p.id, name: p.name, type: p.type })),
                contractors: contractors.map(c => ({
                    id: c.id,
                    contractorId: c.contractorId,
                    contractorName: c.contractorName,
                    status: c.status,
                    sentAt: c.sentAt,
                })),
                submissions: submissions.map(s => ({
                    id: s.id,
                    contractorId: s.contractorId,
                    contractorName: s.contractorName,
                    status: s.status,
                    submittedAt: s.submittedAt,
                    approvedAt: s.approvedAt,
                    totalsJson: s.totalsJson ? JSON.parse(s.totalsJson) : null,
                    tenderLink: `/contractor-tender/${s.id}`,
                })),
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 4) GET /api/tenders/:tenderRequestId/submissions — Admin list of submissions
    // ============================================================
    app.get("/api/tenders/:tenderRequestId/submissions", async (req, res) => {
        try {
            const { tenderRequestId } = req.params;
            const submissions = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.tenderRequestId, tenderRequestId));

            const result = [];
            for (const s of submissions) {
                const items = await db.select().from(tenderSubmissionItems)
                    .where(eq(tenderSubmissionItems.submissionId, s.id));
                const grandTotal = items.reduce((sum, i) => sum + (parseFloat(i.totalPrice || '0')), 0);

                result.push({
                    id: s.id,
                    contractorId: s.contractorId,
                    contractorName: s.contractorName,
                    status: s.status,
                    submittedAt: s.submittedAt,
                    approvedAt: s.approvedAt,
                    itemCount: items.length,
                    pricedCount: items.filter(i => i.unitPrice && parseFloat(i.unitPrice) > 0).length,
                    grandTotal: Math.round(grandTotal * 100) / 100,
                    totalsJson: s.totalsJson ? JSON.parse(s.totalsJson) : null,
                });
            }

            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 5) POST /api/tenders/:tenderRequestId/submissions/:submissionId/approve
    //    Admin approves → creates Assignment + pricing baseline
    // ============================================================
    app.post("/api/tenders/:tenderRequestId/submissions/:submissionId/approve", async (req, res) => {
        try {
            const { tenderRequestId, submissionId } = req.params;

            const [submission] = await db.select().from(tenderSubmissions)
                .where(and(
                    eq(tenderSubmissions.id, submissionId),
                    eq(tenderSubmissions.tenderRequestId, tenderRequestId)
                ));
            if (!submission) return res.status(404).json({ error: "Submission not found" });

            if (submission.status !== 'SUBMITTED') {
                return res.status(400).json({ error: `Cannot approve — status is '${submission.status}', must be 'SUBMITTED'` });
            }

            // Get tender request info
            const [tr] = await db.select().from(tenderRequests).where(eq(tenderRequests.id, tenderRequestId));
            if (!tr) return res.status(404).json({ error: "Tender request not found" });

            // Get job info
            const [job] = await db.select().from(jobs).where(eq(jobs.id, tr.jobId));
            if (!job) return res.status(404).json({ error: "Job not found" });

            const pkgIds = JSON.parse(tr.packageIds || '[]');

            // Mark submission APPROVED
            await db.update(tenderSubmissions).set({
                status: 'APPROVED',
                approvedAt: new Date(),
                updatedAt: new Date(),
            }).where(eq(tenderSubmissions.id, submissionId));

            // Update contractor status
            await db.update(tenderRequestContractors).set({ status: 'SUBMITTED' })
                .where(and(
                    eq(tenderRequestContractors.tenderRequestId, tenderRequestId),
                    eq(tenderRequestContractors.contractorId, submission.contractorId)
                ));

            // Close tender request
            await db.update(tenderRequests).set({ status: 'CLOSED', updatedAt: new Date() })
                .where(eq(tenderRequests.id, tenderRequestId));

            // CREATE ASSIGNMENT (post-award) — use raw SQL to include build_phases
            const assignmentResult = await db.execute(sql`
              INSERT INTO job_assignments (
                id, contractor_name, email, phone, work_location, hbxl_job,
                job_id, assigned_packages, build_phases,
                start_date, end_date, status, tender_status,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid()::text,
                ${submission.contractorName},
                ${''},
                ${''},
                ${job.location || ''},
                ${job.title || ''},
                ${tr.jobId},
                ${sql`ARRAY[${sql.join(pkgIds.map((id: string) => sql`${id}`), sql`, `)}]::TEXT[]`},
                ${sql`ARRAY[]::TEXT[]`},
                ${new Date().toISOString().slice(0, 10)},
                ${new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)},
                ${'assigned'},
                ${'APPROVED'},
                NOW(), NOW()
              ) RETURNING id
            `);
            const assignment = { id: (assignmentResult as any).rows?.[0]?.id || (assignmentResult as any)[0]?.id };

            // Copy pricing baseline from submission items
            const subItems = await db.select().from(tenderSubmissionItems)
                .where(eq(tenderSubmissionItems.submissionId, submissionId));

            if (subItems.length > 0) {
                const baselineValues = subItems
                    .filter(si => si.unitPrice !== null)
                    .map(si => ({
                        assignmentId: assignment.id,
                        packageItemId: si.packageItemId,
                        unitPrice: si.unitPrice || '0',
                        totalPrice: si.totalPrice || '0',
                    }));

                if (baselineValues.length > 0) {
                    await db.insert(assignmentPricingBaseline).values(baselineValues);
                }
            }

            // Calculate totals
            const grandTotal = subItems.reduce((s, i) => s + (parseFloat(i.totalPrice || '0')), 0);

            res.json({
                success: true,
                submissionStatus: 'APPROVED',
                assignmentId: assignment.id,
                contractorName: submission.contractorName,
                grandTotal: Math.round(grandTotal * 100) / 100,
                itemCount: subItems.length,
                pricedItems: subItems.filter(i => i.unitPrice && parseFloat(i.unitPrice) > 0).length,
            });
        } catch (e: any) {
            console.error("[Tender] Approve error:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 6) GET /api/contractor/tenders — List tenders for a contractor
    // ============================================================
    app.get("/api/contractor/tenders", async (req, res) => {
        try {
            const contractorId = req.query.contractorId as string;
            if (!contractorId) return res.status(400).json({ error: "contractorId query param required" });

            const submissions = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.contractorId, contractorId));

            const result = [];
            for (const s of submissions) {
                const [tr] = await db.select().from(tenderRequests)
                    .where(eq(tenderRequests.id, s.tenderRequestId));
                const [job] = tr ? await db.select().from(jobs).where(eq(jobs.id, tr.jobId)) : [null];

                result.push({
                    submissionId: s.id,
                    tenderRequestId: s.tenderRequestId,
                    tenderTitle: tr?.title || 'Unknown',
                    jobTitle: job?.title || 'Unknown',
                    jobLocation: job?.location || '',
                    status: s.status,
                    submittedAt: s.submittedAt,
                    tenderLink: `/contractor-tender/${s.id}`,
                });
            }

            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 7) GET /api/contractor/tenders/:submissionId — Contractor tender view (grouped)
    // ============================================================
    app.get("/api/contractor/tenders/:submissionId", async (req, res) => {
        try {
            const { submissionId } = req.params;

            const [submission] = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.id, submissionId));
            if (!submission) return res.status(404).json({ error: "Submission not found" });

            // Get tender request
            const [tr] = await db.select().from(tenderRequests)
                .where(eq(tenderRequests.id, submission.tenderRequestId));
            const [job] = tr ? await db.select().from(jobs).where(eq(jobs.id, tr.jobId)) : [null];

            // Get all tender submission items
            const items = await db.select().from(tenderSubmissionItems)
                .where(eq(tenderSubmissionItems.submissionId, submissionId));

            // Fix 2: Metadata enrichment from packageItems
            const piIds = [...new Set(items.map(i => i.packageItemId).filter(Boolean))];
            let itemMetas: Record<string, any> = {};
            if (piIds.length > 0) {
                const origItems = await db.select({
                    id: packageItems.id,
                    source: packageItems.source,
                    fix: packageItems.fix,
                    trade: packageItems.trade
                })
                    .from(packageItems)
                    .where(inArray(packageItems.id, piIds));

                for (const oi of origItems) {
                    itemMetas[oi.id] = oi;
                }
            }

            // Enrich items with fix_stage and trade
            const enrichedItems = items.map(i => {
                const meta = itemMetas[i.packageItemId] || {};
                const source = meta.source || '';

                // Determine Fix Stage from meta or source or description
                let fixStage = i.fix || meta.fix;
                if (!fixStage) {
                    const src = (source || '').toUpperCase();
                    const desc = (i.description || '').toLowerCase();
                    if (src.includes('ROOM_QTO') || src.includes('AG_8000') || src === 'QTO' || desc.includes('area')) {
                        fixStage = 'QTO';
                    } else {
                        fixStage = 'UNGROUPED';
                    }
                }
                console.log(`[DEBUG ITEM] desc: "${i.description}" src: "${source}" trade: "${i.trade}/${meta.trade}" -> fixStage: "${fixStage}"`);

                // Determine Trade
                let tradeVal = i.trade || meta.trade || 'General';
                // User requirement: ROOM_QTO floor area -> trade="General"
                // Also default to General if trade is just "QTO"
                if (fixStage === 'QTO' && (tradeVal === 'QTO' || !tradeVal || tradeVal === 'General')) {
                    tradeVal = 'General';
                }

                // Final normalized values
                return {
                    ...i,
                    source,
                    fix_stage: fixStage,
                    trade: tradeVal
                };
            });

            // Get unique package IDs from items
            const pkgIds = [...new Set(items.map(i => i.packageId))];
            let allPkgs: any[] = [];
            if (pkgIds.length > 0) {
                allPkgs = await db.select().from(packagesTable).where(inArray(packagesTable.id, pkgIds));
            }

            // Split packages. Contractors see ROOM only (specific sources). Admins see all.
            const isAdminView = req.query.view === 'admin';

            let filteredPkgs = allPkgs;
            if (!isAdminView) {
                // Fix 1: Labour-only filtering for contractors
                filteredPkgs = allPkgs.filter(p =>
                    p.type === 'ROOM' &&
                    (p.source?.includes('ROOM_QTO') || p.source?.includes('ROOM_SCOPE_LABOUR_V1') || p.source?.includes('AG_8000'))
                );
            }

            const roomPkgs = filteredPkgs.filter(p => p.type === 'ROOM');
            const ifcPkgs = isAdminView
                ? allPkgs.filter(p => p.type === 'IFC_PACKAGE' || p.source === 'CSV_BOQ')
                : [];

            // Define items for IFC/Baseline processing
            const ifcItems = enrichedItems;

            const formatItems = (list: any[]) => list.map(i => ({
                id: i.id,
                packageItemId: i.packageItemId,
                description: i.description,
                qty: parseFloat(i.qty || '0'),
                unit: i.unit || '',
                trade: i.trade || 'General',
                fix_stage: i.fix_stage || 'UNGROUPED',
                source: i.source || '',
                unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null,
                totalPrice: i.totalPrice ? parseFloat(i.totalPrice) : null,
            }));

            // ── Build ROOM cards (Grouped by Fix -> Trade) ──
            const roomsData = roomPkgs.map(pkg => {
                const pkgItems = enrichedItems.filter(i => i.packageId === pkg.id);
                const formatted = formatItems(pkgItems);

                // Group by FIX STAGE: QTO, FIRST_FIX, SECOND_FIX, UNGROUPED
                const fixStages = ["QTO", "FIRST_FIX", "SECOND_FIX", "UNGROUPED"];
                const sections: any[] = [];

                for (const fix of fixStages) {
                    const fixItems = formatted.filter(i => i.fix_stage === fix);

                    if (fixItems.length === 0) continue;

                    // Within each FIX, group by TRADE
                    const trades = [...new Set(fixItems.map(i => i.trade || "General"))];
                    const tradeGroups = trades.map(t => {
                        const itemsInTrade = fixItems.filter(i => (i.trade || "General") === t);
                        const subtotal = Math.round(itemsInTrade.reduce((s, i) => s + (i.totalPrice || 0), 0) * 100) / 100;
                        return {
                            trade: t,
                            items: itemsInTrade,
                            subtotal
                        };
                    });

                    const fixSubtotal = Math.round(fixItems.reduce((s, i) => s + (i.totalPrice || 0), 0) * 100) / 100;

                    sections.push({
                        title: fix.replace("_", " "),
                        fixKey: fix,
                        tradeGroups,
                        subtotal: fixSubtotal
                    });
                }

                const roomTotal = Math.round(formatted.reduce((s, i) => s + (i.totalPrice || 0), 0) * 100) / 100;

                return {
                    packageId: pkg.id,
                    roomName: pkg.name,
                    type: pkg.type || 'ROOM',
                    packageSource: pkg.source,
                    sections,
                    roomTotal,
                };
            });

            // ── Build IFC package cards (admin only) ──
            const ifcPackagesData = ifcPkgs.map(pkg => {
                const pkgItems = ifcItems.filter(i => i.packageId === pkg.id);
                const formatted = formatItems(pkgItems);
                const pkgTotal = Math.round(formatted.reduce((s, i) => s + (i.totalPrice || 0), 0) * 100) / 100;

                // Simple trade grouping for IFC
                const trades = [...new Set(formatted.map(i => i.trade || "General"))];
                const sections = trades.map(t => ({
                    title: t,
                    items: formatted.filter(i => (i.trade || "General") === t),
                    subtotal: Math.round(formatted.filter(i => (i.trade || "General") === t).reduce((s, i) => s + (i.totalPrice || 0), 0) * 100) / 100
                }));

                return {
                    packageId: pkg.id,
                    packageName: pkg.name,
                    type: pkg.type || 'IFC_PACKAGE',
                    packageSource: pkg.source || 'CSV_BOQ',
                    sections,
                    packageTotal: pkgTotal,
                };
            });

            const roomTotal = Math.round(roomsData.reduce((s, r) => s + r.roomTotal, 0) * 100) / 100;
            const ifcTotal = Math.round(ifcPackagesData.reduce((s, p) => s + p.packageTotal, 0) * 100) / 100;
            const grandTotal = isAdminView
                ? Math.round((roomTotal + ifcTotal) * 100) / 100
                : roomTotal;

            const response: any = {
                submissionId: submission.id,
                tenderRequestId: submission.tenderRequestId,
                contractorName: submission.contractorName,
                status: submission.status,
                currency: submission.currency || 'GBP',
                tenderTitle: tr?.title || '',
                jobTitle: job?.title || '',
                jobLocation: job?.location || '',
                rooms: roomsData,
                grandTotal,
                roomTotal,
            };

            // Send IFC/Baseline packages to both admin and contractor
            response.ifcPackages = ifcPackagesData;
            response.ifcTotal = ifcTotal;

            res.json(response);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 8) PATCH /api/contractor/tenders/:submissionId/items/:itemId — Update unit price
    // ============================================================
    app.patch("/api/contractor/tenders/:submissionId/items/:itemId", async (req, res) => {
        try {
            const { submissionId, itemId } = req.params;
            const { unitPrice } = req.body;

            // Validate submission exists and is DRAFT
            const [submission] = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.id, submissionId));
            if (!submission) return res.status(404).json({ error: "Submission not found" });
            if (submission.status !== 'DRAFT') {
                return res.status(403).json({ error: `Cannot edit — submission status is '${submission.status}', must be 'DRAFT'` });
            }

            if (unitPrice === undefined) return res.status(400).json({ error: "unitPrice is required" });
            const numPrice = parseFloat(unitPrice);
            if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ error: "unitPrice must be >= 0" });

            // Find the item
            const [item] = await db.select().from(tenderSubmissionItems)
                .where(and(
                    eq(tenderSubmissionItems.id, itemId),
                    eq(tenderSubmissionItems.submissionId, submissionId)
                ));
            if (!item) return res.status(404).json({ error: "Item not found in this submission" });

            const qty = parseFloat(item.qty || '0');
            const totalPrice = Math.round(qty * numPrice * 100) / 100;

            await db.update(tenderSubmissionItems).set({
                unitPrice: String(numPrice),
                totalPrice: String(totalPrice),
                updatedAt: new Date(),
            }).where(eq(tenderSubmissionItems.id, itemId));

            res.json({
                success: true,
                itemId,
                unitPrice: numPrice,
                totalPrice,
                qty,
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 9) POST /api/contractor/tenders/:submissionId/submit — Lock and submit
    // ============================================================
    app.post("/api/contractor/tenders/:submissionId/submit", async (req, res) => {
        try {
            const { submissionId } = req.params;

            const [submission] = await db.select().from(tenderSubmissions)
                .where(eq(tenderSubmissions.id, submissionId));
            if (!submission) return res.status(404).json({ error: "Submission not found" });

            if (submission.status !== 'DRAFT') {
                return res.status(400).json({ error: `Cannot submit — status is '${submission.status}', must be 'DRAFT'` });
            }

            // Calculate totals
            const items = await db.select().from(tenderSubmissionItems)
                .where(eq(tenderSubmissionItems.submissionId, submissionId));

            const pricedItems = items.filter(i => i.unitPrice && parseFloat(i.unitPrice) > 0);
            const grandTotal = items.reduce((s, i) => s + (parseFloat(i.totalPrice || '0')), 0);

            const totalsJson = JSON.stringify({
                totalItems: items.length,
                pricedItems: pricedItems.length,
                unpricedItems: items.length - pricedItems.length,
                grandTotal: Math.round(grandTotal * 100) / 100,
            });

            // Lock submission
            await db.update(tenderSubmissions).set({
                status: 'SUBMITTED',
                submittedAt: new Date(),
                totalsJson,
                updatedAt: new Date(),
            }).where(eq(tenderSubmissions.id, submissionId));

            // Update contractor status
            await db.update(tenderRequestContractors).set({ status: 'SUBMITTED' })
                .where(and(
                    eq(tenderRequestContractors.tenderRequestId, submission.tenderRequestId),
                    eq(tenderRequestContractors.contractorId, submission.contractorId)
                ));

            res.json({
                success: true,
                status: 'SUBMITTED',
                totalItems: items.length,
                pricedItems: pricedItems.length,
                grandTotal: Math.round(grandTotal * 100) / 100,
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // ADMIN: GET /api/tenders — List all tender requests
    // ============================================================
    app.get("/api/tenders", async (req, res) => {
        try {
            const allTenders = await db.select().from(tenderRequests);
            const result = [];

            for (const tr of allTenders) {
                const [job] = await db.select().from(jobs).where(eq(jobs.id, tr.jobId));
                const subs = await db.select().from(tenderSubmissions)
                    .where(eq(tenderSubmissions.tenderRequestId, tr.id));

                result.push({
                    id: tr.id,
                    jobId: tr.jobId,
                    jobTitle: job?.title || 'Unknown',
                    title: tr.title,
                    status: tr.status,
                    createdAt: tr.createdAt,
                    contractorCount: subs.length,
                    submissions: subs.map(s => ({
                        id: s.id,
                        contractorName: s.contractorName,
                        status: s.status,
                        submittedAt: s.submittedAt,
                        tenderLink: `/contractor-tender/${s.id}`,
                    })),
                });
            }

            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
    // ============================================================
    // DELETE /api/tenders/:tenderRequestId — Delete a tender request
    // ============================================================
    app.delete("/api/tenders/:tenderRequestId", async (req, res) => {
        try {
            const { tenderRequestId } = req.params;
            const [tr] = await db.select().from(tenderRequests).where(eq(tenderRequests.id, tenderRequestId));
            if (!tr) return res.status(404).json({ error: "Tender request not found" });

            // CASCADE handles contractors, submissions, submission_items
            await db.delete(tenderRequests).where(eq(tenderRequests.id, tenderRequestId));

            res.json({ success: true, deleted: tenderRequestId });
        } catch (e: any) {
            console.error("[Tender] Delete error:", e);
            res.status(500).json({ error: e.message });
        }
    });

    console.log("✅ Tender routes registered");
}
