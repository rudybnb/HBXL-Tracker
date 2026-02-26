import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

/* ────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────── */
interface SubmissionItem {
    id: string;
    description: string;
    qty: number;
    unit: string;
    trade: string;
    fix: string;
    source: string;
    unitPrice: number | null;
    totalPrice: number | null;
    flagsJson?: { allowance: boolean; keywords?: string[] } | null;
}

interface TradeGroup {
    trade: string;
    items: SubmissionItem[];
    subtotal: number;
}

interface RoomData {
    packageId: string;
    roomName: string;
    type: string;
    packageSource?: string;
    sections: {
        title: string;
        tradeGroups?: TradeGroup[];
        items: SubmissionItem[];
        subtotal: number
    }[];
    roomTotal: number;
}

interface IfcPackageData {
    packageId: string;
    packageName: string;
    type: string;
    packageSource?: string;
    sections: {
        title: string;
        items: SubmissionItem[];
        subtotal: number
    }[];
    packageTotal: number;
}

interface SubmissionDetail {
    submissionId: string;
    tenderRequestId: string;
    contractorName: string;
    status: string;
    currency: string;
    tenderTitle: string;
    jobTitle: string;
    jobLocation: string;
    rooms: RoomData[];
    ifcPackages?: IfcPackageData[];
    grandTotal: number;
    roomTotal?: number;
    ifcTotal?: number;
}

interface TenderSubmission {
    id: string;
    contractorId: string;
    contractorName: string;
    status: string;
    submittedAt: string | null;
    tenderLink: string;
}

interface TenderRequest {
    id: string;
    jobId: string;
    jobTitle: string;
    title: string;
    status: string;
    createdAt: string;
    contractorCount: number;
    submissions: TenderSubmission[];
}

/* ────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────── */
const styles = {
    page: {
        padding: "24px",
        maxWidth: "1400px",
        margin: "0 auto",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#e2e8f0",
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #0f172a, #1e293b)",
    } as React.CSSProperties,
    header: {
        marginBottom: "32px",
    } as React.CSSProperties,
    h1: {
        fontSize: "28px",
        fontWeight: 700,
        color: "#f8fafc",
        marginBottom: "8px",
    } as React.CSSProperties,
    subtitle: {
        color: "#94a3b8",
        fontSize: "14px",
    } as React.CSSProperties,
    tenderCard: {
        background: "rgba(30, 41, 59, 0.8)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "20px",
        backdropFilter: "blur(10px)",
    } as React.CSSProperties,
    tenderHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "16px",
    } as React.CSSProperties,
    tenderTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#f1f5f9",
    } as React.CSSProperties,
    badge: (color: string) =>
    ({
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#fff",
        background: color,
    } as React.CSSProperties),
    meta: {
        display: "flex",
        gap: "16px",
        fontSize: "13px",
        color: "#94a3b8",
        marginBottom: "16px",
        flexWrap: "wrap" as const,
    } as React.CSSProperties,
    submissionsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "16px",
    } as React.CSSProperties,
    submissionCard: (isSelected: boolean) =>
    ({
        background: isSelected
            ? "rgba(99, 102, 241, 0.15)"
            : "rgba(15, 23, 42, 0.6)",
        border: isSelected
            ? "2px solid #6366f1"
            : "1px solid rgba(148, 163, 184, 0.15)",
        borderRadius: "10px",
        padding: "16px",
        cursor: "pointer",
        transition: "all 0.2s",
    } as React.CSSProperties),
    contractorName: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#f1f5f9",
        marginBottom: "8px",
    } as React.CSSProperties,
    priceTag: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#10b981",
        marginBottom: "4px",
    } as React.CSSProperties,
    statusRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "12px",
    } as React.CSSProperties,
    btnApprove: {
        background: "linear-gradient(135deg, #10b981, #059669)",
        color: "#fff",
        border: "none",
        padding: "10px 20px",
        borderRadius: "8px",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: "14px",
        transition: "all 0.2s",
    } as React.CSSProperties,
    btnView: {
        background: "rgba(99, 102, 241, 0.15)",
        color: "#818cf8",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        padding: "8px 16px",
        borderRadius: "8px",
        fontWeight: 500,
        cursor: "pointer",
        fontSize: "13px",
    } as React.CSSProperties,
    comparisonPanel: {
        background: "rgba(15, 23, 42, 0.9)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: "12px",
        padding: "24px",
        marginTop: "20px",
    } as React.CSSProperties,
    table: {
        width: "100%",
        borderCollapse: "collapse" as const,
        fontSize: "13px",
    } as React.CSSProperties,
    th: {
        textAlign: "left" as const,
        padding: "10px 8px",
        borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
    } as React.CSSProperties,
    td: {
        padding: "8px",
        borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
        color: "#cbd5e1",
    } as React.CSSProperties,
    roomSection: {
        marginBottom: "20px",
    } as React.CSSProperties,
    roomTitle: {
        fontSize: "15px",
        fontWeight: 600,
        color: "#f1f5f9",
        padding: "8px 0",
        borderBottom: "2px solid rgba(99, 102, 241, 0.3)",
        marginBottom: "8px",
    } as React.CSSProperties,
    emptyState: {
        textAlign: "center" as const,
        padding: "60px 20px",
        color: "#64748b",
    } as React.CSSProperties,
    backLink: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color: "#818cf8",
        textDecoration: "none",
        fontSize: "14px",
        marginBottom: "16px",
        cursor: "pointer",
    } as React.CSSProperties,
    spinner: {
        display: "inline-block",
        width: "20px",
        height: "20px",
        border: "2px solid rgba(99, 102, 241, 0.3)",
        borderTopColor: "#6366f1",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
    } as React.CSSProperties,
};

/* ────────────────────────────────────────────────────────
   STATUS HELPERS
   ──────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
    DRAFT: "#f59e0b",
    SENT: "#3b82f6",
    SUBMITTED: "#8b5cf6",
    APPROVED: "#10b981",
    CLOSED: "#6b7280",
    INVITED: "#94a3b8",
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span style={styles.badge(STATUS_COLORS[status] || "#6b7280")}>
            {status}
        </span>
    );
}

/* ────────────────────────────────────────────────────────
   SOURCE + ALLOWANCE BADGES
   ──────────────────────────────────────────────────────── */
const ALLOWANCE_KW = ['allowance', 'provisional', 'pc sum', 'prime cost', 'tbc', 'to be confirmed', 'estimate'];
function isAllowance(item: SubmissionItem) {
    return item.flagsJson?.allowance === true || ALLOWANCE_KW.some(kw => item.description.toLowerCase().includes(kw));
}

const SRC: Record<string, { bg: string; fg: string; label: string }> = {
    QTO: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: 'QTO' },
    MANUAL_ROOM: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: 'QTO' },
    DICTIONARY: { bg: 'rgba(99,102,241,0.15)', fg: '#818cf8', label: 'DICT' },
    IFC: { bg: 'rgba(56,189,248,0.15)', fg: '#38bdf8', label: 'IFC' },
    CSV: { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c', label: 'CSV' },
    DXF: { bg: 'rgba(232,121,249,0.15)', fg: '#e879f9', label: 'DXF' },
};

const tagStyle = (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: '10px', fontWeight: 700,
    padding: '1px 6px', borderRadius: '4px', background: bg, color: fg,
    marginLeft: '6px', verticalAlign: 'middle', letterSpacing: '0.5px',
});
function SrcTag({ s }: { s: string }) {
    const i = SRC[s] || { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8', label: s || '?' };
    return <span style={tagStyle(i.bg, i.fg)}>{i.label}</span>;
}
function AllowBadge({ item }: { item?: SubmissionItem }) {
    const keywords = item?.flagsJson?.keywords?.join(', ');
    return (
        <span
            style={tagStyle('rgba(245,158,11,0.2)', '#f59e0b')}
            title={keywords ? `Matched: ${keywords}` : "This item is flagged as an allowance/provisional sum."}
        >
            ⚠ ALLOWANCE
        </span>
    );
}
function PkgSourceBadge({ source }: { source?: string }) {
    if (!source) return null;
    const colors: Record<string, { bg: string; fg: string }> = {
        ROOM_QTO: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981' },
        CSV_BOQ: { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c' },
    };
    const c = colors[source] || { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' };
    return <span style={tagStyle(c.bg, c.fg)}>{source}</span>;
}

/* ────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────── */
export default function AdminTenderReview() {
    const { toast } = useToast();
    const [tenders, setTenders] = useState<TenderRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTender, setExpandedTender] = useState<string | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
    const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [approving, setApproving] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopyLink = (submissionId: string) => {
        const link = `${window.location.origin}/contractor-tender-new/${submissionId}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopiedId(submissionId);
            toast({ title: 'Copied!', description: 'Tender link copied — paste into WhatsApp, email, etc.' });
            setTimeout(() => setCopiedId(null), 3000);
        });
    };

    // Fetch all tenders
    const fetchTenders = useCallback(async () => {
        try {
            const res = await fetch("/api/tenders");
            if (!res.ok) throw new Error("Failed to fetch tenders");
            const data = await res.json();
            setTenders(data);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchTenders(); }, [fetchTenders]);

    // Fetch submission detail
    const fetchSubmissionDetail = useCallback(async (submissionId: string) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/contractor/tenders/${submissionId}?view=admin`);
            if (!res.ok) throw new Error("Failed to fetch submission");
            const data = await res.json();
            setSubmissionDetail(data);
            setSelectedSubmission(submissionId);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setLoadingDetail(false);
        }
    }, [toast]);

    // Approve submission
    const handleApprove = useCallback(async (tenderRequestId: string, submissionId: string, contractorName: string) => {
        if (!confirm(`Approve ${contractorName}'s tender submission? This will create a job assignment and close the tender.`)) return;
        setApproving(true);
        try {
            const res = await fetch(`/api/tenders/${tenderRequestId}/approve/${submissionId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Failed to approve");
            toast({
                title: "✅ Tender Approved",
                description: `${contractorName}'s bid of £${d.grandTotal?.toFixed(2)} approved. Assignment created.`,
            });
            setSelectedSubmission(null);
            setSubmissionDetail(null);
            fetchTenders();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setApproving(false);
        }
    }, [fetchTenders, toast]);

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={{ textAlign: "center", padding: "60px" }}>
                    <div style={styles.spinner} />
                    <p style={{ marginTop: "12px", color: "#94a3b8" }}>Loading tenders...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Inline keyframes for spinner */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <div style={styles.header}>
                <a href="/job-assignments" style={styles.backLink}>← Back to Job Assignments</a>
                <h1 style={styles.h1}>📋 Tender Review</h1>
                <p style={styles.subtitle}>
                    Review contractor submissions, compare pricing, and approve the best bid.
                </p>
            </div>

            {/* No tenders */}
            {tenders.length === 0 && (
                <div style={styles.emptyState}>
                    <h2 style={{ fontSize: "20px", color: "#94a3b8", marginBottom: "8px" }}>No tenders yet</h2>
                    <p>Create a tender from the Job Assignments page to get started.</p>
                </div>
            )}

            {/* Tender List */}
            {tenders.map((tender) => {
                const isExpanded = expandedTender === tender.id;
                const submittedCount = tender.submissions.filter(s => s.status === "SUBMITTED" || s.status === "APPROVED").length;
                const hasBids = submittedCount > 0;

                return (
                    <div key={tender.id} style={styles.tenderCard}>
                        {/* Tender Header */}
                        <div style={styles.tenderHeader}>
                            <div>
                                <div style={styles.tenderTitle}>{tender.title}</div>
                                <div style={styles.meta}>
                                    <span>🏗️ {tender.jobTitle}</span>
                                    <span>👷 {tender.contractorCount} contractor{tender.contractorCount !== 1 ? "s" : ""}</span>
                                    <span>📅 {new Date(tender.createdAt).toLocaleDateString()}</span>
                                    {hasBids && <span style={{ color: "#10b981", fontWeight: 600 }}>✅ {submittedCount} bid{submittedCount !== 1 ? "s" : ""} received</span>}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <StatusBadge status={tender.status} />
                                <button
                                    style={styles.btnView}
                                    onClick={() => setExpandedTender(isExpanded ? null : tender.id)}
                                >
                                    {isExpanded ? "▲ Collapse" : "▼ View Submissions"}
                                </button>
                            </div>
                        </div>

                        {/* Submissions Grid */}
                        {isExpanded && (
                            <div>
                                <div style={styles.submissionsGrid}>
                                    {tender.submissions.map((sub) => {
                                        const isSelected = selectedSubmission === sub.id;
                                        const isSubmitted = sub.status === "SUBMITTED";
                                        const isApproved = sub.status === "APPROVED";

                                        return (
                                            <div
                                                key={sub.id}
                                                style={styles.submissionCard(isSelected)}
                                                onClick={() => {
                                                    if (sub.status !== "DRAFT") fetchSubmissionDetail(sub.id);
                                                }}
                                            >
                                                <div style={styles.contractorName}>👷 {sub.contractorName}</div>

                                                {sub.status === "DRAFT" ? (
                                                    <div style={{ color: "#f59e0b", fontSize: "14px" }}>
                                                        ⏳ Awaiting pricing — not yet submitted
                                                    </div>
                                                ) : (
                                                    <>
                                                        {sub.submittedAt && (
                                                            <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>
                                                                Submitted: {new Date(sub.submittedAt).toLocaleString()}
                                                            </div>
                                                        )}
                                                        <div style={{ color: "#818cf8", fontSize: "13px" }}>
                                                            Click to view detailed pricing →
                                                        </div>
                                                    </>
                                                )}

                                                <div style={styles.statusRow}>
                                                    <StatusBadge status={sub.status} />
                                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                        <button
                                                            style={{
                                                                background: copiedId === sub.id ? "rgba(16, 185, 129, 0.2)" : "rgba(99, 102, 241, 0.15)",
                                                                color: copiedId === sub.id ? "#10b981" : "#818cf8",
                                                                border: `1px solid ${copiedId === sub.id ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
                                                                padding: "6px 12px",
                                                                borderRadius: "6px",
                                                                fontWeight: 500,
                                                                cursor: "pointer",
                                                                fontSize: "12px",
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyLink(sub.id);
                                                            }}
                                                        >
                                                            {copiedId === sub.id ? "✓ Copied!" : "📋 Copy Link"}
                                                        </button>
                                                        {isSubmitted && tender.status !== "CLOSED" && (
                                                            <button
                                                                style={styles.btnApprove}
                                                                disabled={approving}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleApprove(tender.id, sub.id, sub.contractorName);
                                                                }}
                                                            >
                                                                {approving ? "Approving..." : "✅ Approve This Bid"}
                                                            </button>
                                                        )}
                                                        {isApproved && (
                                                            <span style={{ color: "#10b981", fontWeight: 600, fontSize: "14px" }}>
                                                                ✅ Winner
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Detailed Pricing View */}
                                {selectedSubmission && submissionDetail && (
                                    <div style={styles.comparisonPanel}>
                                        {loadingDetail ? (
                                            <div style={{ textAlign: "center", padding: "20px" }}>
                                                <div style={styles.spinner} />
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                                                    <div>
                                                        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#f1f5f9", marginBottom: "4px" }}>
                                                            📄 {submissionDetail.contractorName}'s Submission
                                                        </h3>
                                                        <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                                                            {submissionDetail.tenderTitle} • {submissionDetail.jobTitle}
                                                            {submissionDetail.jobLocation && ` • 📍 ${submissionDetail.jobLocation}`}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: "right" }}>
                                                        <div style={styles.priceTag}>£{submissionDetail.grandTotal.toFixed(2)}</div>
                                                        <div style={{ color: "#94a3b8", fontSize: "12px" }}>{submissionDetail.currency} Grand Total</div>
                                                    </div>
                                                </div>

                                                {/* Room-by-room breakdown */}
                                                {submissionDetail.rooms.map((room) => (
                                                    <div key={room.packageId} style={styles.roomSection}>
                                                        <div style={styles.roomTitle}>
                                                            🏠 {room.roomName}
                                                            <span style={{ float: "right", color: "#10b981" }}>
                                                                £{room.roomTotal.toFixed(2)}
                                                            </span>
                                                        </div>

                                                        {room.sections.map((section: any) => {
                                                            return (
                                                                <div key={section.title} style={{ marginBottom: "16px" }}>
                                                                    <div style={{
                                                                        fontSize: "13px",
                                                                        fontWeight: 600,
                                                                        color: "#818cf8",
                                                                        padding: "8px 12px",
                                                                        backgroundColor: "rgba(129, 140, 248, 0.1)",
                                                                        borderRadius: "4px",
                                                                        display: "flex",
                                                                        justifyContent: "space-between",
                                                                        marginBottom: "8px"
                                                                    }}>
                                                                        <span>{section.title === "FIRST FIX" ? "🔧" : "🎨"} {section.title}</span>
                                                                        <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                                                                            Subtotal: £{section.subtotal.toFixed(2)}
                                                                        </span>
                                                                    </div>

                                                                    {section.tradeGroups ? (
                                                                        section.tradeGroups.map((group: any) => (
                                                                            <div key={group.trade} style={{ paddingLeft: "12px", marginBottom: "12px" }}>
                                                                                <div style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                                                                                    ⚒️ {group.trade}
                                                                                </div>
                                                                                <table style={styles.table}>
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th style={{ ...styles.th, width: "50%" }}>Description</th>
                                                                                            <th style={{ ...styles.th, width: "10%" }}>Qty</th>
                                                                                            <th style={{ ...styles.th, width: "10%" }}>Unit</th>
                                                                                            <th style={{ ...styles.th, width: "15%" }}>Rate (£)</th>
                                                                                            <th style={{ ...styles.th, width: "15%" }}>Total (£)</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {group.items.map((item: any) => (
                                                                                            <tr key={item.id}>
                                                                                                <td style={styles.td}>
                                                                                                    {item.description}
                                                                                                    {item.source && (
                                                                                                        <span style={{ marginLeft: "6px", fontSize: "10px", padding: "2px 4px", borderRadius: "3px", backgroundColor: "rgba(148, 163, 184, 0.15)", color: "#94a3b8" }}>
                                                                                                            {item.source}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={styles.td}>{item.qty}</td>
                                                                                                <td style={styles.td}>{item.unit}</td>
                                                                                                <td style={styles.td}>£{(item.unitPrice || 0).toFixed(2)}</td>
                                                                                                <td style={{ ...styles.td, color: "#10b981", fontWeight: 500 }}>
                                                                                                    £{(item.totalPrice || 0).toFixed(2)}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                                <div style={{ textAlign: "right", fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                                                                                    {group.trade} Total: £{group.subtotal.toFixed(2)}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <table style={styles.table}>
                                                                            <thead>
                                                                                <tr>
                                                                                    <th style={{ ...styles.th, width: "50%" }}>Description</th>
                                                                                    <th style={{ ...styles.th, width: "10%" }}>Qty</th>
                                                                                    <th style={{ ...styles.th, width: "10%" }}>Unit</th>
                                                                                    <th style={{ ...styles.th, width: "15%" }}>Rate (£)</th>
                                                                                    <th style={{ ...styles.th, width: "15%" }}>Total (£)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {section.items.map((item: any) => (
                                                                                    <tr key={item.id}>
                                                                                        <td style={styles.td}>{item.description}</td>
                                                                                        <td style={styles.td}>{item.qty}</td>
                                                                                        <td style={styles.td}>{item.unit}</td>
                                                                                        <td style={styles.td}>£{(item.unitPrice || 0).toFixed(2)}</td>
                                                                                        <td style={{ ...styles.td, color: "#10b981", fontWeight: 500 }}>
                                                                                            £{(item.totalPrice || 0).toFixed(2)}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ))}

                                                {/* ── IFC / Build Packages (admin only) ── */}
                                                {(submissionDetail.ifcPackages || []).length > 0 && (
                                                    <>
                                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: '24px 0 8px', borderBottom: '2px solid rgba(251,146,60,0.3)', paddingBottom: '6px' }}>
                                                            🏗️ Build Packages (BoQ Baseline)
                                                        </div>
                                                        {submissionDetail.ifcPackages!.map((pkg) => (
                                                            <div key={pkg.packageId} style={styles.roomSection}>
                                                                <div style={styles.roomTitle}>
                                                                    🏗️ {pkg.packageName}
                                                                    <PkgSourceBadge source={pkg.packageSource} />
                                                                    <span style={{ float: 'right', color: '#fb923c' }}>
                                                                        £{pkg.packageTotal.toFixed(2)}
                                                                    </span>
                                                                </div>

                                                                {pkg.sections.map((section) => {
                                                                    if (section.items.length === 0) return null;
                                                                    return (
                                                                        <div key={section.title} style={{ marginBottom: '12px' }}>
                                                                            <table style={styles.table}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th style={{ ...styles.th, width: '40%' }}>Description</th>
                                                                                        <th style={{ ...styles.th, width: '10%' }}>Qty</th>
                                                                                        <th style={{ ...styles.th, width: '10%' }}>Unit</th>
                                                                                        <th style={{ ...styles.th, width: '10%' }}>Trade</th>
                                                                                        <th style={{ ...styles.th, width: '15%', textAlign: 'right' }}>Unit Price</th>
                                                                                        <th style={{ ...styles.th, width: '15%', textAlign: 'right' }}>Total</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {section.items.map((item) => (
                                                                                        <tr key={item.id}>
                                                                                            <td style={styles.td}>
                                                                                                {item.description}
                                                                                                <SrcTag s={item.source} />
                                                                                                {isAllowance(item.description) && <AllowBadge />}
                                                                                            </td>
                                                                                            <td style={styles.td}>{item.qty}</td>
                                                                                            <td style={styles.td}>{item.unit || '—'}</td>
                                                                                            <td style={styles.td}>{item.trade || '—'}</td>
                                                                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>
                                                                                                {item.unitPrice != null ? `£${item.unitPrice.toFixed(2)}` : '—'}
                                                                                            </td>
                                                                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: '#e2e8f0' }}>
                                                                                                {item.totalPrice != null ? `£${item.totalPrice.toFixed(2)}` : '—'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ))}
                                                    </>
                                                )}

                                                {/* Total breakdown */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(99,102,241,0.3)', paddingTop: '16px', marginTop: '16px' }}>
                                                    <div>
                                                        {submissionDetail.roomTotal != null && (
                                                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
                                                                📐 Room Total: <span style={{ color: '#10b981', fontWeight: 600 }}>£{submissionDetail.roomTotal.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {submissionDetail.ifcTotal != null && submissionDetail.ifcTotal > 0 && (
                                                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
                                                                🏗️ Build Total: <span style={{ color: '#fb923c', fontWeight: 600 }}>£{submissionDetail.ifcTotal.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Grand Total:</span>{' '}
                                                        <span style={{ fontSize: '22px', fontWeight: 700, color: '#10b981' }}>
                                                            £{submissionDetail.grandTotal.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {submissionDetail.status === "SUBMITTED" && (
                                                        <button
                                                            style={styles.btnApprove}
                                                            disabled={approving}
                                                            onClick={() => {
                                                                const t = tenders.find(t => t.submissions.some(s => s.id === selectedSubmission));
                                                                if (t) handleApprove(t.id, selectedSubmission, submissionDetail.contractorName);
                                                            }}
                                                        >
                                                            {approving ? "Approving..." : "✅ Approve This Bid & Create Assignment"}
                                                        </button>
                                                    )}
                                                    {submissionDetail.status === "APPROVED" && (
                                                        <span style={{ color: "#10b981", fontWeight: 600, fontSize: "16px" }}>
                                                            ✅ Approved — Assignment Created
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
