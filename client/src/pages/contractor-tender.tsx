import "./contractor-tender.css";
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/* ────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────── */
interface TenderItem {
    id: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    trade: string;
    fix: string;
    hasOverride: boolean;
    budgetRate?: number;
    budgetTotal?: number;
    notes?: string;
}

interface TenderSection {
    title: string;
    items: TenderItem[];
    subtotal: number;
}

interface TenderPackage {
    id: string;
    name: string;
    type: string;
    sections: TenderSection[];
    roomTotal: number;
}

interface IfcPackage {
    id: string;
    name: string;
    type: string;
    items: TenderItem[];
    packageTotal: number;
    budgetTotal: number;
}

type TenderStatus = "DRAFT" | "SENT_FOR_PRICING" | "SUBMITTED" | "APPROVED";

interface TenderResponse {
    assignmentId: string;
    contractorName: string;
    tenderStatus: TenderStatus;
    packages: TenderPackage[];
    ifcPackages?: IfcPackage[];
    tenderTotal: number;
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

function groupByTrade(items: TenderItem[]) {
    const map: Record<string, TenderItem[]> = {};
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
   AUTO-ADVANCE: find & focus the next empty price cell
   ──────────────────────────────────────────────────────── */
function focusNextEmptyPrice(currentItemId: string) {
    // Small delay to let React re-render after commit
    requestAnimationFrame(() => {
        const allCells = Array.from(
            document.querySelectorAll<HTMLElement>("[data-price-item-id]")
        );
        const currentIdx = allCells.findIndex(
            (el) => el.dataset.priceItemId === currentItemId
        );
        if (currentIdx === -1) return;

        // Search forward from current position for the next un-priced cell
        for (let i = currentIdx + 1; i < allCells.length; i++) {
            const el = allCells[i];
            if (el.dataset.priceHasValue === "false") {
                // Scroll into view smoothly, centered
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                // Click to open the editor after scroll completes
                setTimeout(() => el.click(), 350);
                return;
            }
        }

        // If no un-priced cell found after current, just go to the very next cell
        const nextCell = allCells[currentIdx + 1];
        if (nextCell) {
            nextCell.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => nextCell.click(), 350);
        }
    });
}

/* ────────────────────────────────────────────────────────
   EDITABLE PRICE CELL
   ──────────────────────────────────────────────────────── */
function PriceCell({
    item,
    onSave,
    editable,
}: {
    item: TenderItem;
    onSave: (id: string, price: number) => void;
    editable: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(item.unitPrice || ""));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(String(item.unitPrice || ""));
    }, [item.unitPrice]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commit = (advance: boolean = true) => {
        setEditing(false);
        const num = parseFloat(value);
        if (!isNaN(num) && num !== item.unitPrice) {
            onSave(item.id, num);
            // Auto-advance to next empty price after saving
            if (advance) {
                focusNextEmptyPrice(item.id);
            }
        } else {
            setValue(String(item.unitPrice || ""));
        }
    };

    const hasValue = item.unitPrice > 0;

    // Read-only view
    if (!editable) {
        return (
            <div className="price-cell price-cell-readonly">
                {item.unitPrice > 0 ? `£${item.unitPrice.toFixed(2)}` : "£0.00"}
            </div>
        );
    }

    if (!editing) {
        return (
            <div
                data-price-item-id={item.id}
                data-price-has-value={String(hasValue)}
                onClick={() => setEditing(true)}
                className={`price-cell ${!hasValue ? "price-cell-empty" : ""}`}
                title="Click to edit"
            >
                {hasValue ? `£${item.unitPrice.toFixed(2)}` : "—"}
                <span className="edit-hint">✎</span>
            </div>
        );
    }

    return (
        <input
            ref={inputRef}
            data-price-item-id={item.id}
            data-price-has-value={String(hasValue)}
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => commit(true)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    commit(true);
                }
                if (e.key === "Escape") {
                    setValue(String(item.unitPrice || ""));
                    setEditing(false);
                }
            }}
            className="price-input"
        />
    );
}

/* ────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────── */
function fmt(v: number) {
    return `£${v.toFixed(2)}`;
}

function tradeBadge(trade: string) {
    const colors: Record<string, string> = {
        Electrical: "#f59e0b",
        Plumbing: "#3b82f6",
        Joinery: "#a855f7",
        Finishes: "#10b981",
    };
    return (
        <span
            className="trade-badge"
            style={{ background: colors[trade] || "#6b7280" }}
        >
            {trade}
        </span>
    );
}

const STATUS_LABELS: Record<TenderStatus, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "#64748b" },
    SENT_FOR_PRICING: { label: "Pricing Required", color: "#f59e0b" },
    SUBMITTED: { label: "Submitted — Awaiting Approval", color: "#3b82f6" },
    APPROVED: { label: "Approved", color: "#10b981" },
};

/* ────────────────────────────────────────────────────────
   PROGRESS INDICATOR
   ──────────────────────────────────────────────────────── */
function PricingProgress({ rooms, ifcPkgs }: { rooms: TenderPackage[]; ifcPkgs: IfcPackage[] }) {
    const roomItems = rooms.flatMap((r) => r.sections.flatMap((s) => s.items));
    const ifcItems = ifcPkgs.flatMap((p) => p.items);
    const allItems = [...roomItems, ...ifcItems];
    const total = allItems.length;
    const priced = allItems.filter((i) => i.unitPrice > 0).length;
    const pct = total > 0 ? Math.round((priced / total) * 100) : 0;

    return (
        <div className="pricing-progress">
            <div className="pricing-progress-bar">
                <div
                    className="pricing-progress-fill"
                    style={{
                        width: `${pct}%`,
                        background: pct === 100
                            ? "linear-gradient(135deg, #10b981, #059669)"
                            : "linear-gradient(135deg, #f59e0b, #d97706)",
                    }}
                />
            </div>
            <span className="pricing-progress-text">
                {priced}/{total} priced ({pct}%)
            </span>
        </div>
    );
}

/* ────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────── */
export default function ContractorTender() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [, params] = useRoute("/contractor-tender/:assignmentId");
    const assignmentId = params?.assignmentId;

    // Local override prices for instant UI update
    const [localPrices, setLocalPrices] = useState<Record<string, number>>({});

    // Auto-discover if no valid assignment ID
    const { data: allAssignments } = useQuery<any[]>({
        queryKey: ["/api/job-assignments"],
        enabled: !assignmentId || assignmentId === "<assignmentId>",
    });

    const effectiveAssignmentId =
        assignmentId && assignmentId !== "<assignmentId>"
            ? assignmentId
            : allAssignments?.[0]?.id;

    // Fetch tender data using the NEW /tender endpoint
    const {
        data: tenderData,
        isLoading,
        error,
    } = useQuery<TenderResponse>({
        queryKey: [`/api/job-assignments/${effectiveAssignmentId}/tender`],
        enabled: !!effectiveAssignmentId,
    });

    const tenderStatus: TenderStatus = tenderData?.tenderStatus || "DRAFT";
    const isEditable = tenderStatus === "SENT_FOR_PRICING";

    // PATCH mutation for unit price (uses NEW assignment-scoped endpoint)
    const priceMutation = useMutation({
        mutationFn: async ({
            itemId,
            unitPrice,
        }: {
            itemId: string;
            unitPrice: number;
        }) => {
            const res = await apiRequest(
                "PATCH",
                `/api/assignment-items/${itemId}/unit-price`,
                { unitPrice, assignmentId: effectiveAssignmentId }
            );
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [`/api/job-assignments/${effectiveAssignmentId}/tender`],
            });
        },
        onError: (err: any) => {
            toast({
                title: "Save failed",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest(
                "POST",
                `/api/job-assignments/${effectiveAssignmentId}/submit-tender`,
                {}
            );
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({
                queryKey: [`/api/job-assignments/${effectiveAssignmentId}/tender`],
            });
            toast({
                title: "Tender Submitted",
                description: `Tender of ${fmt(data.tenderTotal || 0)} submitted successfully.${data.warnings?.length ? " " + data.warnings[0] : ""
                    }`,
            });
        },
        onError: (err: any) => {
            toast({
                title: "Submit failed",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const handleSave = useCallback(
        (itemId: string, price: number) => {
            setLocalPrices((prev) => ({ ...prev, [itemId]: price }));
            priceMutation.mutate({ itemId, unitPrice: price });
        },
        [priceMutation]
    );

    // Helper: apply local price overrides for instant UI
    const applyLocalPrice = (item: TenderItem) => {
        const price = localPrices[item.id] !== undefined ? localPrices[item.id] : item.unitPrice;
        return { ...item, unitPrice: price, totalPrice: Math.round(item.qty * price * 100) / 100 };
    };

    // Merge local overrides into ROOM tender data
    const rooms: TenderPackage[] = (tenderData?.packages || []).map((room) => ({
        ...room,
        sections: room.sections.map((section) => {
            const items = section.items.map(applyLocalPrice);
            return { ...section, items, subtotal: items.reduce((s, i) => s + i.totalPrice, 0) };
        }),
        roomTotal: 0,
    }));
    for (const room of rooms) {
        room.roomTotal = room.sections.reduce((s, sec) => s + sec.subtotal, 0);
    }

    // Merge local overrides into IFC/BUDGET packages
    const ifcPkgs: IfcPackage[] = (tenderData?.ifcPackages || []).map((pkg) => {
        const items = pkg.items.map(applyLocalPrice);
        return { ...pkg, items, packageTotal: items.reduce((s, i) => s + i.totalPrice, 0) };
    });

    const roomTotal = rooms.reduce((s, r) => s + r.roomTotal, 0);
    const ifcTotal = ifcPkgs.reduce((s, p) => s + p.packageTotal, 0);
    const jobTotal = roomTotal + ifcTotal;

    // ── Loading / Error ──
    if (isLoading || (!effectiveAssignmentId && !allAssignments)) {
        return (
            <div className="tender-page">
                <div className="tender-loading">
                    <div className="spinner" />
                    <p>Loading tender data...</p>
                </div>
            </div>
        );
    }

    if (!effectiveAssignmentId) {
        return (
            <div className="tender-page">
                <div className="tender-empty">
                    <h2>No assignments found</h2>
                    <p>No job assignments exist yet.</p>
                </div>
            </div>
        );
    }

    if (tenderStatus === "DRAFT") {
        return (
            <div className="tender-page">
                <div className="tender-empty">
                    <h2>Tender Not Released</h2>
                    <p>This tender hasn't been sent for pricing yet. Please wait for admin to release it.</p>
                    <div className="status-badge" style={{ background: STATUS_LABELS.DRAFT.color }}>
                        {STATUS_LABELS.DRAFT.label}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !tenderData) {
        return (
            <div className="tender-page">
                <div className="tender-empty">
                    <h2>Unable to load tender</h2>
                    <p>Please try refreshing the page.</p>
                </div>
            </div>
        );
    }

    const statusInfo = STATUS_LABELS[tenderStatus];

    return (
        <div className="tender-page">
            {/* ── HEADER ── */}
            <header className="tender-header">
                <div className="header-left">
                    <h1 className="header-title">Contractor Tender</h1>
                    <p className="header-sub">
                        {isEditable
                            ? "Price each line item below. Press Enter or Tab to save & jump to the next item."
                            : tenderStatus === "SUBMITTED"
                                ? "Tender submitted — awaiting admin approval."
                                : "Tender approved — pricing is locked."}
                    </p>
                    <div
                        className="status-badge"
                        style={{ background: statusInfo.color }}
                    >
                        {statusInfo.label}
                    </div>
                    {isEditable && <PricingProgress rooms={rooms} ifcPkgs={ifcPkgs} />}
                </div>
                <div className="job-total-card">
                    <span className="job-total-label">Tender Total</span>
                    <span className="job-total-value">{fmt(jobTotal)}</span>
                    <span className="job-total-rooms">
                        {rooms.length} room{rooms.length !== 1 ? "s" : ""}
                        {ifcPkgs.length > 0 && ` · ${ifcPkgs.length} package${ifcPkgs.length !== 1 ? "s" : ""}`}
                    </span>
                </div>
            </header>

            {/* ── ROOM CARDS ── */}
            {rooms.length > 0 && (
                <div className="rooms-container">
                    <h2 style={{ padding: '0 24px', fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🏠 Room Packages
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>({rooms.length})</span>
                    </h2>
                    {rooms.map((room) => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            onSave={handleSave}
                            editable={isEditable}
                        />
                    ))}
                </div>
            )}

            {/* ── IFC / BUDGET PACKAGES ── */}
            {ifcPkgs.length > 0 && (
                <div className="rooms-container">
                    <h2 style={{ padding: '0 24px', fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
                        📦 Budget / IFC Packages
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>({ifcPkgs.length})</span>
                    </h2>
                    {ifcPkgs.map((pkg) => (
                        <IfcPackageCard
                            key={pkg.id}
                            pkg={pkg}
                            onSave={handleSave}
                            editable={isEditable}
                        />
                    ))}
                </div>
            )}

            {/* ── BOTTOM NAV ── */}
            <nav className="tender-nav">
                <a href="/jobs" className="nav-link">← Back to Jobs</a>
                <div className="nav-total">
                    Total: <strong>{fmt(jobTotal)}</strong>
                </div>
                {isEditable && (
                    <button
                        className="submit-btn"
                        disabled={submitMutation.isPending}
                        onClick={() => {
                            if (window.confirm(`Submit tender for ${fmt(jobTotal)}? You won't be able to edit prices after submission.`)) {
                                submitMutation.mutate();
                            }
                        }}
                    >
                        {submitMutation.isPending ? "Submitting..." : "Submit Tender"}
                    </button>
                )}
            </nav>
        </div>
    );
}

/* ────────────────────────────────────────────────────────
   ROOM CARD
   ──────────────────────────────────────────────────────── */
function RoomCard({
    room,
    onSave,
    editable,
}: {
    room: TenderPackage;
    onSave: (id: string, price: number) => void;
    editable: boolean;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const firstFix = room.sections.find((s) => s.title === "First Fix");
    const secondFix = room.sections.find((s) => s.title === "Second Fix");
    const firstFixTotal = firstFix?.subtotal || 0;
    const secondFixTotal = secondFix?.subtotal || 0;

    return (
        <div className="room-card">
            <div className="room-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="room-header-left">
                    <span className="room-expand">{collapsed ? "▶" : "▼"}</span>
                    <h2 className="room-name">{room.name}</h2>
                    <span className="room-count">
                        {room.sections.reduce((s, sec) => s + sec.items.length, 0)} items
                    </span>
                </div>
                <div className="room-header-right">
                    <span className="room-total">{fmt(room.roomTotal)}</span>
                </div>
            </div>

            {!collapsed && (
                <div className="room-body">
                    {firstFix && firstFix.items.length > 0 && (
                        <FixSection title="First Fix" section={firstFix} onSave={onSave} editable={editable} />
                    )}
                    {secondFix && secondFix.items.length > 0 && (
                        <FixSection title="Second Fix" section={secondFix} onSave={onSave} editable={editable} />
                    )}

                    <div className="room-footer">
                        <div className="room-footer-row">
                            <span>1st Fix Subtotal</span>
                            <span>{fmt(firstFixTotal)}</span>
                        </div>
                        <div className="room-footer-row">
                            <span>2nd Fix Subtotal</span>
                            <span>{fmt(secondFixTotal)}</span>
                        </div>
                        <div className="room-footer-row room-footer-total">
                            <span>Room Total</span>
                            <span>{fmt(room.roomTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────────────────
   FIX SECTION
   ──────────────────────────────────────────────────────── */
function FixSection({
    title,
    section,
    onSave,
    editable,
}: {
    title: string;
    section: TenderSection;
    onSave: (id: string, price: number) => void;
    editable: boolean;
}) {
    const trades = groupByTrade(section.items);

    return (
        <div className="fix-section">
            <div className="fix-header">
                <h3 className="fix-title">{title}</h3>
                <span className="fix-subtotal">{fmt(section.subtotal)}</span>
            </div>

            {trades.map(({ trade, items }) => (
                <div key={trade} className="trade-group">
                    <div className="trade-header">
                        {tradeBadge(trade)}
                        <span className="trade-count">{items.length} items</span>
                    </div>

                    <table className="tender-table">
                        <thead>
                            <tr>
                                <th className="col-desc">Description</th>
                                <th className="col-qty">Qty</th>
                                <th className="col-unit">Unit</th>
                                <th className="col-price">Unit Price (£)</th>
                                <th className="col-total">Total (£)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td className="col-desc">{item.description}</td>
                                    <td className="col-qty">{item.qty}</td>
                                    <td className="col-unit">{item.unit}</td>
                                    <td className="col-price">
                                        <PriceCell item={item} onSave={onSave} editable={editable} />
                                    </td>
                                    <td className="col-total">{fmt(item.totalPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
}

/* ────────────────────────────────────────────────────────
   IFC / BUDGET PACKAGE CARD
   ──────────────────────────────────────────────────────── */
function IfcPackageCard({
    pkg,
    onSave,
    editable,
}: {
    pkg: IfcPackage;
    onSave: (id: string, price: number) => void;
    editable: boolean;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const PHASE_COLORS: Record<string, string> = {
        "Foundations": "#f97316",
        "Concrete": "#6366f1",
        "External Walls": "#3b82f6",
        "Ground Floor": "#8b5cf6",
        "Structural Openings": "#ec4899",
        "Demolition": "#ef4444",
        "External Decoration": "#14b8a6",
        "Plastering": "#a855f7",
    };
    const accentColor = PHASE_COLORS[pkg.name] || "#6b7280";

    return (
        <div className="room-card" style={{ borderLeft: `3px solid ${accentColor}` }}>
            <div className="room-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="room-header-left">
                    <span className="room-expand">{collapsed ? "▶" : "▼"}</span>
                    <h2 className="room-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {pkg.name}
                        <span style={{
                            fontSize: "0.65rem",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: `${accentColor}22`,
                            color: accentColor,
                            fontWeight: 600,
                        }}>
                            IFC
                        </span>
                    </h2>
                    <span className="room-count">{pkg.items.length} items</span>
                </div>
                <div className="room-header-right" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span className="room-total">{fmt(pkg.packageTotal)}</span>
                    {pkg.budgetTotal > 0 && (
                        <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                            Budget ref: {fmt(pkg.budgetTotal)}
                        </span>
                    )}
                </div>
            </div>

            {!collapsed && (
                <div className="room-body">
                    <table className="tender-table">
                        <thead>
                            <tr>
                                <th className="col-desc">Description</th>
                                <th className="col-qty">Qty</th>
                                <th className="col-unit">Type</th>
                                <th className="col-price" style={{ minWidth: 100 }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                                        <span>Your Rate (£)</span>
                                    </div>
                                </th>
                                <th className="col-total">
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                                        <span>Budget Rate</span>
                                    </div>
                                </th>
                                <th className="col-total">Total (£)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pkg.items.map((item) => (
                                <tr key={item.id}>
                                    <td className="col-desc">{item.description}</td>
                                    <td className="col-qty">{item.qty}</td>
                                    <td className="col-unit">
                                        <span style={{
                                            fontSize: "0.68rem",
                                            padding: "1px 6px",
                                            borderRadius: 3,
                                            background: item.notes === "Labour"
                                                ? "rgba(59,130,246,0.12)"
                                                : item.notes === "Material"
                                                    ? "rgba(245,158,11,0.12)"
                                                    : "rgba(107,114,128,0.12)",
                                            color: item.notes === "Labour"
                                                ? "#60a5fa"
                                                : item.notes === "Material"
                                                    ? "#fbbf24"
                                                    : "#94a3b8",
                                        }}>
                                            {item.notes || "—"}
                                        </span>
                                    </td>
                                    <td className="col-price">
                                        <PriceCell item={item} onSave={onSave} editable={editable} />
                                    </td>
                                    <td className="col-total" style={{ color: "#64748b", fontSize: "0.78rem" }}>
                                        {item.budgetRate && item.budgetRate > 0 ? `£${item.budgetRate.toFixed(2)}` : "—"}
                                    </td>
                                    <td className="col-total">{fmt(item.totalPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="room-footer">
                        {pkg.budgetTotal > 0 && (
                            <div className="room-footer-row">
                                <span>Budget Reference</span>
                                <span style={{ color: "#64748b" }}>{fmt(pkg.budgetTotal)}</span>
                            </div>
                        )}
                        <div className="room-footer-row room-footer-total">
                            <span>Package Total</span>
                            <span>{fmt(pkg.packageTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
