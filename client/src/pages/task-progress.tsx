import "./contractor-tender.css";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";

/* ────────────────────────────────────────────────────────
   TYPES (mirrors contractor-tender)
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

interface TenderResponse {
  assignmentId: string;
  contractorName: string;
  tenderStatus: string;
  packages: TenderPackage[];
  tenderTotal: number;
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

/* ────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────── */
export default function TaskProgress() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get contractor info
  const contractorName = localStorage.getItem("contractorName") || "";
  const contractorFirstName = contractorName.split(" ")[0];

  const [, params] = useRoute("/task-progress/:assignmentId?");
  const previewAssignmentId = params?.assignmentId;

  // Track completed items locally for instant UI
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  // Get contractor assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: previewAssignmentId
      ? [`/api/job-assignments/${previewAssignmentId}`]
      : [`/api/contractor-assignments/${contractorFirstName}`],
    queryFn: async () => {
      if (previewAssignmentId) {
        const res = await fetch(`/api/job-assignments/${previewAssignmentId}`);
        if (!res.ok) throw new Error("Failed to fetch assignment");
        const data = await res.json();
        return [data];
      }
      const res = await fetch(`/api/contractor-assignments/${contractorFirstName}`);
      return res.json();
    },
  });

  const activeAssignment = (assignments as any[])?.[0];
  const effectiveAssignmentId = activeAssignment?.id;

  // Fetch tender data (same endpoint as contractor-tender page)
  const {
    data: tenderData,
    isLoading: tenderLoading,
    error,
  } = useQuery<TenderResponse>({
    queryKey: [`/api/job-assignments/${effectiveAssignmentId}/tender`],
    enabled: !!effectiveAssignmentId,
  });

  // Fetch assignment details to get completedQuantity for each item
  const { data: assignmentDetails } = useQuery({
    queryKey: [`/api/job-assignments/${effectiveAssignmentId}/details`],
    enabled: !!effectiveAssignmentId,
    queryFn: async () => {
      const res = await fetch(`/api/job-assignments/${effectiveAssignmentId}/details`);
      if (!res.ok) throw new Error("Failed to fetch details");
      return res.json();
    },
  });

  // Build completed map from assignment details
  useEffect(() => {
    if (assignmentDetails?.packages) {
      const map: Record<string, boolean> = {};
      assignmentDetails.packages.forEach((pkg: any) => {
        if (pkg.items && Array.isArray(pkg.items)) {
          pkg.items.forEach((item: any) => {
            const qty = parseFloat(item.quantity) || 0;
            const completed = parseFloat(item.completedQuantity) || 0;
            map[item.id] = completed >= qty && qty > 0;
          });
        }
      });
      setCompletedItems(map);
    }
  }, [assignmentDetails]);

  // Mutation: toggle item completion
  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed, qty }: { itemId: string; completed: boolean; qty: number }) => {
      await fetch(`/api/package-items/${itemId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedQuantity: completed ? qty : 0 }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/job-assignments/${effectiveAssignmentId}/details`] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleToggle = useCallback(
    (itemId: string, qty: number) => {
      const newState = !completedItems[itemId];
      setCompletedItems((prev) => ({ ...prev, [itemId]: newState }));
      toggleMutation.mutate({ itemId, completed: newState, qty });
    },
    [completedItems, toggleMutation]
  );

  // Merge tender data
  const rooms: TenderPackage[] = (tenderData?.packages || []).map((room) => ({
    ...room,
    sections: room.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
      })),
    })),
  }));

  const jobTotal = rooms.reduce((s, r) => s + r.roomTotal, 0);

  // Calculate overall progress
  const allItems = rooms.flatMap((r) => r.sections.flatMap((s) => s.items));
  const totalItemCount = allItems.length;
  const completedCount = allItems.filter((item) => completedItems[item.id]).length;
  const overallProgress = totalItemCount > 0 ? Math.round((completedCount / totalItemCount) * 100) : 0;

  // Loading
  if (assignmentsLoading || tenderLoading) {
    return (
      <div className="tender-page">
        <div className="tender-loading">
          <div className="spinner" />
          <p>Loading task progress...</p>
        </div>
      </div>
    );
  }

  if (!effectiveAssignmentId) {
    return (
      <div className="tender-page">
        <div className="tender-empty">
          <h2>No Assignment Found</h2>
          <p>You have no active job assignments.</p>
        </div>
      </div>
    );
  }

  if (error || !tenderData || tenderData.packages.length === 0) {
    return (
      <div className="tender-page">
        <div className="tender-empty">
          <h2>No Tender Data</h2>
          <p>No tender items have been set up for this assignment yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tender-page">
      {/* ── HEADER ── */}
      <header className="tender-header">
        <div className="header-left">
          <h1 className="header-title">Task Progress</h1>
          <p className="header-sub">
            Tick each item when completed. Your quoted prices are shown for reference.
          </p>
          {/* Progress bar */}
          <div style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            maxWidth: 400,
          }}>
            <div style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: "rgba(71,85,105,0.4)",
              overflow: "hidden",
            }}>
              <div
                style={{
                  width: `${overallProgress}%`,
                  height: "100%",
                  borderRadius: 4,
                  background: overallProgress === 100
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "linear-gradient(135deg, #f59e0b, #d97706)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: overallProgress === 100 ? "#34d399" : "#f59e0b",
              minWidth: 48,
              textAlign: "right",
            }}>
              {overallProgress}%
            </span>
          </div>
        </div>
        <div className="job-total-card">
          <span className="job-total-label">Contract Value</span>
          <span className="job-total-value">{fmt(jobTotal)}</span>
          <span className="job-total-rooms">
            {completedCount}/{totalItemCount} items done
          </span>
        </div>
      </header>

      {/* ── ROOM CARDS ── */}
      <div className="rooms-container">
        {rooms.map((room) => (
          <ProgressRoomCard
            key={room.id}
            room={room}
            completedItems={completedItems}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="tender-nav">
        <a href="/jobs" className="nav-link">← Back to Jobs</a>
        <div className="nav-total">
          Done: <strong>{completedCount}/{totalItemCount}</strong>
        </div>
      </nav>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   ROOM CARD (Progress version)
   ──────────────────────────────────────────────────────── */
function ProgressRoomCard({
  room,
  completedItems,
  onToggle,
}: {
  room: TenderPackage;
  completedItems: Record<string, boolean>;
  onToggle: (id: string, qty: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const firstFix = room.sections.find((s) => s.title === "First Fix");
  const secondFix = room.sections.find((s) => s.title === "Second Fix");
  const firstFixTotal = firstFix?.subtotal || 0;
  const secondFixTotal = secondFix?.subtotal || 0;

  // Room completion stats
  const roomItems = room.sections.flatMap((s) => s.items);
  const roomDone = roomItems.filter((i) => completedItems[i.id]).length;
  const roomTotal = roomItems.length;
  const roomPct = roomTotal > 0 ? Math.round((roomDone / roomTotal) * 100) : 0;

  return (
    <div className="room-card">
      <div className="room-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="room-header-left">
          <span className="room-expand">{collapsed ? "▶" : "▼"}</span>
          <h2 className="room-name">{room.name}</h2>
          <span className="room-count">
            {roomDone}/{roomTotal} done
          </span>
        </div>
        <div className="room-header-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Mini progress ring */}
          <svg width="32" height="32" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="rgba(71,85,105,0.3)"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke={roomPct === 100 ? "#10b981" : "#f59e0b"}
              strokeWidth="3"
              strokeDasharray={`${roomPct * 0.975} 100`}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
            <text
              x="18" y="20"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill={roomPct === 100 ? "#10b981" : "#f59e0b"}
            >
              {roomPct}%
            </text>
          </svg>
          <span className="room-total">{fmt(room.roomTotal)}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="room-body">
          {firstFix && firstFix.items.length > 0 && (
            <ProgressFixSection
              title="First Fix"
              section={firstFix}
              completedItems={completedItems}
              onToggle={onToggle}
            />
          )}
          {secondFix && secondFix.items.length > 0 && (
            <ProgressFixSection
              title="Second Fix"
              section={secondFix}
              completedItems={completedItems}
              onToggle={onToggle}
            />
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
   FIX SECTION (Progress version)
   ──────────────────────────────────────────────────────── */
function ProgressFixSection({
  title,
  section,
  completedItems,
  onToggle,
}: {
  title: string;
  section: TenderSection;
  completedItems: Record<string, boolean>;
  onToggle: (id: string, qty: number) => void;
}) {
  const trades = groupByTrade(section.items);
  const sectionDone = section.items.filter((i) => completedItems[i.id]).length;

  return (
    <div className="fix-section">
      <div className="fix-header">
        <h3 className="fix-title">
          {title}
          <span style={{
            marginLeft: 8,
            fontSize: "0.75rem",
            fontWeight: 400,
            color: sectionDone === section.items.length && section.items.length > 0 ? "#10b981" : "#64748b",
          }}>
            {sectionDone}/{section.items.length}
          </span>
        </h3>
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
                <th style={{ width: 40, textAlign: "center" }}>✓</th>
                <th className="col-desc">Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-unit">Unit</th>
                <th className="col-price">Rate (£)</th>
                <th className="col-total">Total (£)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isDone = !!completedItems[item.id];
                return (
                  <tr
                    key={item.id}
                    style={{
                      opacity: isDone ? 0.55 : 1,
                      transition: "opacity 0.25s ease",
                    }}
                  >
                    <td style={{ textAlign: "center", width: 40 }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: isDone
                            ? "2px solid #10b981"
                            : "2px solid rgba(71,85,105,0.5)",
                          background: isDone
                            ? "rgba(16,185,129,0.15)"
                            : "transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          userSelect: "none",
                        }}
                        onClick={() => onToggle(item.id, item.qty)}
                      >
                        {isDone && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path
                              d="M2 7.5L5.5 11L12 3"
                              stroke="#10b981"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </label>
                    </td>
                    <td
                      className="col-desc"
                      style={{
                        textDecoration: isDone ? "line-through" : "none",
                        color: isDone ? "#64748b" : "#e2e8f0",
                      }}
                    >
                      {item.description}
                    </td>
                    <td className="col-qty">{item.qty}</td>
                    <td className="col-unit">{item.unit}</td>
                    <td className="col-price">
                      <div className="price-cell price-cell-readonly">
                        {item.unitPrice > 0 ? `£${item.unitPrice.toFixed(2)}` : "—"}
                      </div>
                    </td>
                    <td className="col-total">{fmt(item.totalPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}