import "./contractor-tender.css";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";

/* ────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────── */
interface SubmissionItem {
    id: string;
    packageItemId: string;
    description: string;
    qty: number;
    unit: string;
    trade: string;
    fix: string;
    source: string;
    unitPrice: number | null;
    totalPrice: number | null;
    budgetRate?: number;
    budgetTotal?: number;
    notes?: string;
    flagsJson?: { allowance: boolean; keywords?: string[] } | null;
}

interface TradeGroup {
    trade: string;
    items: SubmissionItem[];
    subtotal: number;
}

interface Section {
    title: string;
    tradeGroups: TradeGroup[];
    subtotal: number;
    items: SubmissionItem[]; // For backwards compat
}

interface RoomData {
    packageId: string;
    roomName: string;
    type: string;
    sections: Section[];
    roomTotal: number;
}

interface SubmissionResponse {
    submissionId: string;
    tenderRequestId: string;
    contractorName: string;
    status: string;
    currency: string;
    tenderTitle: string;
    jobTitle: string;
    jobLocation: string;
    rooms: RoomData[];
    ifcPackages?: RoomData[]; // Baseline/IFC packages share similar structure
    grandTotal: number;
    roomTotal?: number;
    ifcTotal?: number;
}

/* ────────────────────────────────────────────────────────
   TRADE ORDERING
   ──────────────────────────────────────────────────────── */
const TRADE_ORDER = ["Electrical", "Plumbing", "Joinery", "Finishes"];

function tradeSort(a: string, b: string) {
    const ai = TRADE_ORDER.indexOf(a);
    const bi = TRADE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

function groupByTrade(items: SubmissionItem[]) {
    const map: Record<string, SubmissionItem[]> = {};
    for (const item of items) {
        const t = item.trade || "Other";
        if (!map[t]) map[t] = [];
        map[t].push(item);
    }
    return Object.keys(map)
        .sort(tradeSort)
        .map((trade) => ({ trade, items: map[trade] }));
}

/* ────────────────────────────────────────────────────────
   SOURCE + ALLOWANCE BADGES
   ──────────────────────────────────────────────────────── */
const ALLOWANCE_KEYWORDS = ['allowance', 'provisional', 'pc sum', 'prime cost', 'tbc', 'to be confirmed', 'estimate'];
function isAllowanceItem(item: SubmissionItem): boolean {
    return item.flagsJson?.allowance === true || ALLOWANCE_KEYWORDS.some(kw => item.description.toLowerCase().includes(kw));
}

const SOURCE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
    QTO: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981', label: 'QTO' },
    MANUAL_ROOM: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981', label: 'QTO' },
    DICTIONARY: { bg: 'rgba(99, 102, 241, 0.15)', fg: '#818cf8', label: 'DICT' },
    IFC: { bg: 'rgba(56, 189, 248, 0.15)', fg: '#38bdf8', label: 'IFC' },
    CSV: { bg: 'rgba(251, 146, 60, 0.15)', fg: '#fb923c', label: 'CSV' },
    DXF: { bg: 'rgba(232, 121, 249, 0.15)', fg: '#e879f9', label: 'DXF' },
};

function SourceTag({ source }: { source: string }) {
    const info = SOURCE_COLORS[source] || { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8', label: source || '?' };
    return (
        <span style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '4px',
            background: info.bg,
            color: info.fg,
            marginLeft: '6px',
            verticalAlign: 'middle',
            letterSpacing: '0.5px',
        }}>
            {info.label}
        </span>
    );
}

function AllowanceBadge({ item }: { item?: SubmissionItem }) {
    const keywords = item?.flagsJson?.keywords?.join(', ');
    return (
        <span
            title={keywords ? `Matched: ${keywords}` : "This item is flagged as an allowance/provisional sum."}
            style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                marginLeft: '6px',
                verticalAlign: 'middle',
                letterSpacing: '0.5px',
            }}
        >
            ⚠ ALLOWANCE
        </span>
    );
}

/* ────────────────────────────────────────────────────────
   EDITABLE PRICE CELL
   ──────────────────────────────────────────────────────── */
function PriceCell({
    item,
    onSave,
    editable,
}: {
    item: SubmissionItem;
    onSave: (id: string, price: number) => void;
    editable: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(item.unitPrice != null ? String(item.unitPrice) : "");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    useEffect(() => {
        setVal(item.unitPrice != null ? String(item.unitPrice) : "");
    }, [item.unitPrice]);

    if (!editable) {
        return (
            <span className="price-display">
                {item.unitPrice != null ? `£${item.unitPrice.toFixed(2)}` : "—"}
            </span>
        );
    }

    if (!editing) {
        return (
            <button
                className="price-btn"
                onClick={() => setEditing(true)}
                title="Click to enter unit price"
            >
                {item.unitPrice != null ? `£${item.unitPrice.toFixed(2)}` : "Enter price"}
            </button>
        );
    }

    return (
        <div className="price-edit">
            <span>£</span>
            <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        const n = parseFloat(val);
                        if (!isNaN(n) && n >= 0) {
                            onSave(item.id, n);
                            setEditing(false);
                        }
                    } else if (e.key === "Escape") {
                        setEditing(false);
                    }
                }}
                onBlur={() => {
                    const n = parseFloat(val);
                    if (!isNaN(n) && n >= 0) {
                        onSave(item.id, n);
                    }
                    setEditing(false);
                }}
            />
        </div>
    );
}

/* ────────────────────────────────────────────────────────
   STATUS LABELS
   ──────────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft — Fill Prices", color: "#f59e0b" },
    SUBMITTED: { label: "Submitted — Awaiting Review", color: "#3b82f6" },
    APPROVED: { label: "Approved ✓", color: "#10b981" },
    REJECTED: { label: "Rejected", color: "#ef4444" },
};

function TenderTable({ items, editable, onSave }: {
    items: any[];
    editable: boolean;
    onSave: (id: string, price: number) => void;
}) {
    return (
        <table className="tender-table">
            <thead>
                <tr>
                    <th className="col-desc">Description</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-unit">Unit</th>
                    <th className="col-price">Your Rate (£)</th>
                    <th className="col-total">Total (£)</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item) => (
                    <tr key={item.id}>
                        <td className="col-desc">
                            {item.description}
                            <SourceTag source={item.source} />
                            {isAllowanceItem(item) && <AllowanceBadge item={item} />}
                        </td>
                        <td className="col-qty">{item.qty}</td>
                        <td className="col-unit">{item.unit}</td>
                        <td className="col-price">
                            <PriceCell
                                item={item}
                                onSave={onSave}
                                editable={editable}
                            />
                        </td>
                        <td className="col-total">
                            {item.totalPrice != null ? `£${item.totalPrice.toFixed(2)}` : "—"}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/* ────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────── */
export default function ContractorTenderNew() {
    const [, params] = useRoute("/contractor-tender-new/:submissionId");
    const submissionId = params?.submissionId || "";
    const { toast } = useToast();

    const [data, setData] = useState<SubmissionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch submission data
    const fetchData = useCallback(async () => {
        if (!submissionId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/contractor/tenders/${submissionId}`);
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || `HTTP ${res.status}`);
            }
            const d = await res.json();
            setData(d);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [submissionId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Save unit price
    const handleSavePrice = useCallback(async (itemId: string, unitPrice: number) => {
        try {
            const res = await fetch(`/api/contractor/tenders/${submissionId}/items/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unitPrice }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Failed");

            // Refresh data
            fetchData();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    }, [submissionId, fetchData, toast]);

    // Submit tender
    const handleSubmit = useCallback(async () => {
        if (!confirm("Submit this tender? You will not be able to edit prices after submission.")) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/contractor/tenders/${submissionId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Failed");

            toast({ title: "Tender Submitted", description: `Total: £${d.grandTotal?.toFixed(2)}. Awaiting review.` });
            fetchData();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }, [submissionId, fetchData, toast]);

    if (!submissionId) {
        return (
            <div className="tender-page">
                <div className="tender-empty">
                    <h2>No Submission ID</h2>
                    <p>Please use a valid tender link.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="tender-page">
                <div className="tender-loading">
                    <div className="spinner"></div>
                    <p>Loading tender...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tender-page">
                <div className="tender-empty">
                    <h2>Error Loading Tender</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const editable = data.status === "DRAFT";
    const statusInfo = STATUS_LABELS[data.status] || { label: data.status, color: "#6b7280" };

    return (
        <div className="tender-page">
            {/* Header */}
            <div className="tender-header">
                <div className="tender-header-top">
                    <h1>{data.tenderTitle || "Tender"}</h1>
                    <div className="status-badge" style={{ background: statusInfo.color }}>
                        {statusInfo.label}
                    </div>
                </div>
                <div className="tender-meta">
                    <span>👷 {data.contractorName}</span>
                    <span>📋 {data.jobTitle}</span>
                    {data.jobLocation && <span>📍 {data.jobLocation}</span>}
                </div>
            </div>

            {/* Room Packages */}
            {data.rooms.length > 0 && (
                <>
                    <h2 style={{ padding: '0 24px', fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 4px' }}>
                        📐 Rooms — Price per m²
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>({data.rooms.length})</span>
                    </h2>
                    {data.rooms.map((room) => (
                        <div key={room.packageId} className="tender-room">
                            <div className="room-header">
                                <h2>🏠 {room.roomName}</h2>
                                <span className="room-total">Room Total: £{room.roomTotal.toFixed(2)}</span>
                            </div>

                            {room.sections.map((section: any) => (
                                <div key={section.title} className="tender-fix-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '6px 12px', borderLeft: '4px solid #3b82f6', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600 }}>
                                            ⚡ {section.title}
                                        </h3>
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Fix Total: <strong>£{section.subtotal.toFixed(2)}</strong></span>
                                    </div>

                                    {section.tradeGroups.map((group: any) => (
                                        <div key={group.trade} style={{ paddingLeft: '8px', marginBottom: '16px' }}>
                                            <h4 style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                ⚒️ {group.trade}
                                            </h4>
                                            <TenderTable items={group.items} editable={editable} onSave={handleSavePrice} />
                                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', padding: '4px 8px' }}>
                                                {group.trade} Total: <strong>£{group.subtotal.toFixed(2)}</strong>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </>
            )}


            {/* Grand Total & Submit */}
            <div className="tender-footer">
                <div className="grand-total">
                    Grand Total: <strong>£{data.grandTotal.toFixed(2)}</strong>
                    <span className="currency">({data.currency})</span>
                </div>

                {editable && (
                    <button
                        className="submit-btn"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "Submitting..." : "📤 Submit Tender"}
                    </button>
                )}

                {data.status === "SUBMITTED" && (
                    <div className="submitted-msg">
                        ✅ Tender submitted. Awaiting admin review.
                    </div>
                )}

                {data.status === "APPROVED" && (
                    <div className="approved-msg">
                        ✅ Tender approved! This pricing is now the baseline.
                    </div>
                )}
            </div>
        </div >
    );
}
