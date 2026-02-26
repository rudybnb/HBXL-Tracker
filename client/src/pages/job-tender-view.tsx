import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { FileText, ArrowLeft, Download, Calculator, CheckCircle2, Upload, ChevronDown, ChevronRight, DollarSign, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobDrawings from "@/components/job-drawings";

// Types
interface TenderItem {
    id: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    completedQty: number;
    trade: string;
    fix: string;
    pricingSource: string;
    source: string;
}

interface TenderSection {
    title: string;
    items: TenderItem[];
    subtotal: number;
}

interface RoomTender {
    id: string;
    name: string;
    type: string;
    sections: TenderSection[];
    roomTotal: number;
}

interface BudgetPhase {
    id: string;
    name: string;
    itemCount: number;
    labour: number;
    material: number;
    plant: number;
    total: number;
}

interface BudgetLedger {
    totals: { labour: number; material: number; plant: number; grand: number };
    phaseSummaries: Array<{ phase: string; labour: number; material: number; plant: number; total: number; lineCount: number }>;
    lineCount: number;
    clientName: string;
}

interface TenderData {
    jobId: string;
    jobTitle: string;
    roomTender: RoomTender[];
    budgetPhases: BudgetPhase[];
    budgetLedger: BudgetLedger | null;
    summary: {
        tenderTotal: number;
        budgetTotal: number;
        variance: number;
        labourTotal: number;
        materialTotal: number;
        plantTotal: number;
    };
    roomCount: number;
    budgetPhaseCount: number;
}

// Legacy QS types for backwards compat with old endpoint
interface QSItem { element: string; description: string; quantity: number; unit: string; rate: number; total: number; isCalculated: boolean; source?: string; }
interface QSSection { id: string; title: string; description: string; total: number; items: QSItem[]; }
interface QSTenderDocument { projectId: string; projectName: string; generatedAt: string; grandTotal: number; sections: QSSection[]; }

export default function JobTenderView() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
    const [editingPrice, setEditingPrice] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState("");

    // New tender data endpoint
    const { data: tenderData, isLoading: tenderLoading, error: tenderError } = useQuery<TenderData>({
        queryKey: [`/api/jobs/${id}/tender-data`],
    });

    // Legacy tender endpoint (fallback)
    const { data: legacyTender, isLoading: legacyLoading } = useQuery<QSTenderDocument>({
        queryKey: [`/api/jobs/${id}/qs-tender`],
        enabled: !!tenderError, // Only fetch if new endpoint fails
    });

    // CSV parse mutation
    const parseCsvMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/jobs/${id}/parse-csv`, { method: "POST", headers: { "Content-Type": "application/json" } });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/jobs/${id}/tender-data`] }); },
    });

    // Unit price mutation
    const updatePriceMutation = useMutation({
        mutationFn: async ({ itemId, unitPrice }: { itemId: string; unitPrice: number }) => {
            const res = await fetch(`/api/package-items/${itemId}/unit-price`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unitPrice, pricingSource: "manual" }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${id}/tender-data`] });
            setEditingPrice(null);
            setPriceInput("");
        },
    });

    // HBXL file upload mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const text = await file.text();
            const res = await fetch(`/api/jobs/${id}/parse-csv`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csvContent: text }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/jobs/${id}/tender-data`] }); },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadMutation.mutate(file);
        e.target.value = '';
    };

    const toggleRoom = (roomId: string) => {
        setExpandedRooms(prev => {
            const next = new Set(prev);
            next.has(roomId) ? next.delete(roomId) : next.add(roomId);
            return next;
        });
    };

    const expandAll = () => {
        if (tenderData) {
            setExpandedRooms(new Set(tenderData.roomTender.map(r => r.id)));
        }
    };

    const collapseAll = () => setExpandedRooms(new Set());

    const exportToExcel = () => {
        if (!tenderData) return;
        const rows: any[] = [];
        tenderData.roomTender.forEach(room => {
            rows.push({ Room: room.name, Section: '', Description: '', Qty: '', Unit: '', 'Unit Price': '', 'Line Total': '', Status: '' });
            room.sections.forEach(section => {
                rows.push({ Room: '', Section: section.title, Description: '', Qty: '', Unit: '', 'Unit Price': '', 'Line Total': section.subtotal, Status: '' });
                section.items.forEach(item => {
                    rows.push({
                        Room: '', Section: '', Description: item.description,
                        Qty: item.qty, Unit: item.unit,
                        'Unit Price': item.unitPrice || '',
                        'Line Total': item.totalPrice || '',
                        Status: item.completedQty > 0 ? `${item.completedQty}/${item.qty}` : ''
                    });
                });
            });
            rows.push({ Room: '', Section: 'ROOM TOTAL', Description: '', Qty: '', Unit: '', 'Unit Price': '', 'Line Total': room.roomTotal, Status: '' });
            rows.push({});
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tender");
        XLSX.writeFile(wb, `tender_${tenderData.jobTitle || id}.xlsx`);
    };

    const isLoading = tenderLoading && legacyLoading;
    const hasData = !!tenderData || !!legacyTender;

    if (isLoading) {
        return <div className="p-8 bg-slate-900 min-h-screen text-slate-100 flex justify-center"><Skeleton className="h-96 w-full max-w-4xl bg-slate-800" /></div>;
    }

    if (!hasData) {
        return (
            <div className="p-8 bg-slate-900 min-h-screen text-slate-100 flex flex-col items-center">
                <h1 className="text-2xl text-amber-500 mb-4">Tender Not Yet Generated</h1>
                <p className="text-slate-400 mb-6">No QS data found. Import HBXL/CSV data to generate the tender.</p>
                <div className="flex gap-4">
                    <Link href="/"><Button variant="outline">Return Dashboard</Button></Link>
                    <Button onClick={() => parseCsvMutation.mutate()} className="bg-amber-600 hover:bg-amber-700">
                        <Upload className="mr-2 h-4 w-4" /> Import from Shared Folder
                    </Button>
                </div>
            </div>
        );
    }

    const summary = tenderData?.summary || { tenderTotal: 0, budgetTotal: 0, variance: 0, labourTotal: 0, materialTotal: 0, plantTotal: 0 };
    const rooms = tenderData?.roomTender || [];
    const budgetPhases = tenderData?.budgetPhases || [];
    const budgetLedger = tenderData?.budgetLedger;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-4">
                            <Link href="/admin-task-monitor">
                                <Button variant="ghost" className="text-slate-400 hover:text-amber-400">
                                    <ArrowLeft className="h-5 w-5 mr-2" /> Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-amber-400 flex items-center">
                                    <Calculator className="mr-2 h-6 w-6" /> Tender & Budget
                                </h1>
                                <p className="text-xs text-slate-400">Project: {tenderData?.jobTitle || 'Loading...'}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.xlsx" />
                            <Button onClick={() => parseCsvMutation.mutate()} disabled={parseCsvMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                                <Upload className="mr-1 h-4 w-4" /> {parseCsvMutation.isPending ? 'Parsing...' : 'Parse CSV'}
                            </Button>
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-900/20">
                                <Upload className="mr-2 h-4 w-4" /> Import HBXL
                            </Button>
                            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white">
                                <Download className="mr-2 h-4 w-4" /> Export Excel
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto py-6 px-4">
                <Tabs defaultValue="tender" className="space-y-6">
                    <TabsList className="bg-slate-800 border-slate-700">
                        <TabsTrigger value="tender" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Room Tender</TabsTrigger>
                        <TabsTrigger value="budget" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Budget Packages</TabsTrigger>
                        <TabsTrigger value="reconciliation" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Reconciliation</TabsTrigger>
                        <Link href={`/jobs/${id}/rooms`}>
                            <TabsTrigger value="rooms" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Room Work Packages</TabsTrigger>
                        </Link>
                        <TabsTrigger value="drawings" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Drawings & Files</TabsTrigger>
                    </TabsList>

                    {/* ==================== ROOM TENDER TAB ==================== */}
                    <TabsContent value="tender">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Tender Total */}
                            <div className="bg-gradient-to-br from-amber-900/40 to-slate-800 border border-amber-500/30 rounded-xl p-5 shadow-lg">
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tender Total</div>
                                <div className="text-3xl font-bold text-amber-400">
                                    £{summary.tenderTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Sum of priced room items</div>
                            </div>

                            {/* HBXL Budget Total */}
                            <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 border border-blue-500/30 rounded-xl p-5 shadow-lg">
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">HBXL Budget Total</div>
                                <div className="text-3xl font-bold text-blue-400">
                                    £{summary.budgetTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">From CSV ledger</div>
                            </div>

                            {/* Variance */}
                            <div className={`bg-gradient-to-br ${summary.variance >= 0 ? 'from-green-900/40' : 'from-red-900/40'} to-slate-800 border ${summary.variance >= 0 ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl p-5 shadow-lg`}>
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Variance</div>
                                <div className={`text-3xl font-bold ${summary.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {summary.variance >= 0 ? '+' : ''}£{summary.variance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Tender − Budget</div>
                            </div>
                        </div>

                        {/* L/M/P Split */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <div className="text-xs text-slate-400 uppercase">Labour</div>
                                <div className="text-xl font-semibold text-blue-400">£{summary.labourTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <div className="text-xs text-slate-400 uppercase">Material</div>
                                <div className="text-xl font-semibold text-emerald-400">£{summary.materialTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <div className="text-xs text-slate-400 uppercase">Plant</div>
                                <div className="text-xl font-semibold text-purple-400">£{summary.plantTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        {/* Room Cards */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-200">{rooms.length} Room{rooms.length !== 1 ? 's' : ''}</h2>
                            <div className="flex gap-2">
                                <button onClick={expandAll} className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1">Expand All</button>
                                <button onClick={collapseAll} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1">Collapse All</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {rooms.map(room => {
                                const isExpanded = expandedRooms.has(room.id);
                                return (
                                    <div key={room.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                        {/* Room Header */}
                                        <button
                                            onClick={() => toggleRoom(room.id)}
                                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {isExpanded ? <ChevronDown className="h-5 w-5 text-amber-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                                                <div className="text-left">
                                                    <h3 className="text-lg font-bold text-white">{room.name}</h3>
                                                    <span className="text-xs text-slate-400">
                                                        {room.sections.reduce((s, sec) => s + sec.items.length, 0)} items
                                                        {room.sections.map(s => ` • ${s.title}: ${s.items.length}`).join('')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-semibold text-amber-400">
                                                    £{room.roomTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                                </div>
                                                <span className="text-xs text-slate-500">Room Total</span>
                                            </div>
                                        </button>

                                        {/* Room Content */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-700">
                                                {room.sections.map((section, sIdx) => (
                                                    <div key={sIdx}>
                                                        {/* Section Header */}
                                                        <div className="bg-slate-900/50 px-5 py-2 flex justify-between items-center border-b border-slate-700/50">
                                                            <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{section.title}</span>
                                                            <span className="text-sm font-semibold text-amber-500">
                                                                £{section.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        {/* Items Table */}
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-900/30 text-slate-500 text-xs uppercase">
                                                                <tr>
                                                                    <th className="px-5 py-2 text-left w-2/5">Description</th>
                                                                    <th className="px-3 py-2 text-left w-16">Trade</th>
                                                                    <th className="px-3 py-2 text-right w-16">Qty</th>
                                                                    <th className="px-3 py-2 text-right w-16">Unit</th>
                                                                    <th className="px-3 py-2 text-right w-24">Unit Price</th>
                                                                    <th className="px-3 py-2 text-right w-24">Line Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-700/30">
                                                                {section.items.map(item => (
                                                                    <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                                                                        <td className="px-5 py-3 text-slate-200">{item.description}</td>
                                                                        <td className="px-3 py-3 text-slate-400 text-xs">{item.trade}</td>
                                                                        <td className="px-3 py-3 text-right text-slate-300">{item.qty}</td>
                                                                        <td className="px-3 py-3 text-right text-slate-400 text-xs">{item.unit}</td>
                                                                        <td className="px-3 py-3 text-right">
                                                                            {editingPrice === item.id ? (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <span className="text-slate-400">£</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        value={priceInput}
                                                                                        onChange={e => setPriceInput(e.target.value)}
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter') {
                                                                                                updatePriceMutation.mutate({ itemId: item.id, unitPrice: parseFloat(priceInput) || 0 });
                                                                                            } else if (e.key === 'Escape') {
                                                                                                setEditingPrice(null);
                                                                                            }
                                                                                        }}
                                                                                        className="w-20 bg-slate-700 border border-amber-500 rounded px-2 py-1 text-right text-white text-xs"
                                                                                        autoFocus
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => updatePriceMutation.mutate({ itemId: item.id, unitPrice: parseFloat(priceInput) || 0 })}
                                                                                        className="text-green-400 hover:text-green-300 text-xs px-1"
                                                                                    >✓</button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => { setEditingPrice(item.id); setPriceInput(String(item.unitPrice || '')); }}
                                                                                    className={`hover:bg-slate-600/50 rounded px-2 py-1 transition-colors ${item.unitPrice > 0 ? 'text-slate-200' : 'text-slate-500 italic'
                                                                                        }`}
                                                                                    title="Click to edit unit price"
                                                                                >
                                                                                    {item.unitPrice > 0 ? `£${item.unitPrice.toFixed(2)}` : '—'}
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-right font-medium text-amber-500">
                                                                            {item.totalPrice > 0 ? `£${item.totalPrice.toFixed(2)}` : '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {section.items.length === 0 && (
                                                                    <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500 italic">No items in {section.title}</td></tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ))}

                                                {/* Room Footer */}
                                                <div className="bg-slate-900/60 px-5 py-3 flex justify-between items-center border-t border-slate-600">
                                                    <span className="text-sm font-bold text-slate-300">Room Total</span>
                                                    <span className="text-lg font-bold text-amber-400">
                                                        £{room.roomTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {rooms.length === 0 && (
                            <div className="bg-slate-800 border border-dashed border-slate-600 rounded-lg p-12 text-center">
                                <FileText className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                                <h3 className="text-slate-300 text-lg mb-2">No Room Packages Found</h3>
                                <p className="text-slate-500 text-sm mb-4">Sync rooms from Port 8000 or upload CSV data.</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* ==================== BUDGET PACKAGES TAB ==================== */}
                    <TabsContent value="budget">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white mb-2">Build Phase Budget Packages</h2>
                            <p className="text-slate-400 text-sm">IFC/Budget packages derived from HBXL CSV. These are admin-only, not shown to contractors.</p>
                        </div>

                        {budgetLedger && (
                            <div className="bg-gradient-to-br from-blue-900/30 to-slate-800 border border-blue-500/20 rounded-xl p-6 mb-6">
                                <h3 className="text-amber-400 font-bold mb-4">📊 CSV Budget Ledger Summary</h3>
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400 uppercase">Labour</div>
                                        <div className="text-xl font-bold text-blue-400">£{budgetLedger.totals.labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400 uppercase">Material</div>
                                        <div className="text-xl font-bold text-emerald-400">£{budgetLedger.totals.material.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400 uppercase">Plant</div>
                                        <div className="text-xl font-bold text-purple-400">£{budgetLedger.totals.plant.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400 uppercase">Grand Total</div>
                                        <div className="text-xl font-bold text-amber-400">£{budgetLedger.totals.grand.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>

                                {/* Phase Breakdown Table */}
                                <table className="w-full text-sm mt-4">
                                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase border-b border-slate-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Build Phase</th>
                                            <th className="px-4 py-2 text-right">Lines</th>
                                            <th className="px-4 py-2 text-right">Labour</th>
                                            <th className="px-4 py-2 text-right">Material</th>
                                            <th className="px-4 py-2 text-right">Plant</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30">
                                        {budgetLedger.phaseSummaries.map((ps, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/20">
                                                <td className="px-4 py-2 font-medium text-slate-200">{ps.phase}</td>
                                                <td className="px-4 py-2 text-right text-slate-400">{ps.lineCount}</td>
                                                <td className="px-4 py-2 text-right text-blue-400">£{ps.labour.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right text-emerald-400">£{ps.material.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right text-purple-400">£{ps.plant.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right font-semibold text-amber-400">£{ps.total.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t border-slate-600">
                                        <tr className="font-bold">
                                            <td className="px-4 py-3 text-slate-200">Grand Total</td>
                                            <td className="px-4 py-3 text-right text-slate-400">{budgetLedger.lineCount}</td>
                                            <td className="px-4 py-3 text-right text-blue-400">£{budgetLedger.totals.labour.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-emerald-400">£{budgetLedger.totals.material.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-purple-400">£{budgetLedger.totals.plant.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-amber-400">£{budgetLedger.totals.grand.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {!budgetLedger && (
                            <div className="bg-slate-800 border border-dashed border-amber-500/30 rounded-lg p-8 text-center mb-6">
                                <BarChart3 className="h-10 w-10 text-amber-500/50 mx-auto mb-3" />
                                <h3 className="text-slate-300 mb-2">No CSV Budget Ledger Found</h3>
                                <p className="text-slate-500 text-sm mb-4">Click "Parse CSV" to import budget data from the HBXL CSV file.</p>
                                <Button onClick={() => parseCsvMutation.mutate()} disabled={parseCsvMutation.isPending}
                                    className="bg-amber-600 hover:bg-amber-700">
                                    {parseCsvMutation.isPending ? 'Parsing...' : 'Parse CSV Now'}
                                </Button>
                            </div>
                        )}

                        {/* Existing IFC/Budget Packages from DB */}
                        {budgetPhases.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-300 mb-3">Database Budget Packages ({budgetPhases.length})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {budgetPhases.map(bp => (
                                        <div key={bp.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-white">{bp.name}</h4>
                                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">IFC_PACKAGE</span>
                                            </div>
                                            <div className="text-sm text-slate-400">{bp.itemCount} items</div>
                                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                                <div><span className="text-slate-500">L:</span> <span className="text-blue-400">£{bp.labour.toFixed(2)}</span></div>
                                                <div><span className="text-slate-500">M:</span> <span className="text-emerald-400">£{bp.material.toFixed(2)}</span></div>
                                                <div><span className="text-slate-500">P:</span> <span className="text-purple-400">£{bp.plant.toFixed(2)}</span></div>
                                            </div>
                                            <div className="mt-2 text-right font-semibold text-amber-400">£{bp.total.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ==================== RECONCILIATION TAB ==================== */}
                    <TabsContent value="reconciliation">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                                <TrendingUp className="mr-2 h-5 w-5 text-amber-400" /> Budget Reconciliation
                            </h2>

                            <div className="grid grid-cols-3 gap-6 mb-6">
                                <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-amber-500/20">
                                    <div className="text-xs text-slate-400 uppercase mb-1">Tender Total</div>
                                    <div className="text-2xl font-bold text-amber-400">
                                        £{summary.tenderTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">From priced room items</div>
                                </div>
                                <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-blue-500/20">
                                    <div className="text-xs text-slate-400 uppercase mb-1">HBXL Budget</div>
                                    <div className="text-2xl font-bold text-blue-400">
                                        £{summary.budgetTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">From CSV ledger</div>
                                </div>
                                <div className={`bg-slate-900/50 rounded-lg p-4 text-center border ${summary.variance >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
                                    <div className="text-xs text-slate-400 uppercase mb-1">Variance</div>
                                    <div className={`text-2xl font-bold ${summary.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {summary.variance >= 0 ? '+' : ''}£{summary.variance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{summary.variance >= 0 ? 'Under budget' : 'Over budget'}</div>
                                </div>
                            </div>

                            {/* Reconciliation checks */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                                    <CheckCircle2 className={`h-5 w-5 ${rooms.length > 0 ? 'text-green-400' : 'text-red-400'}`} />
                                    <span className="text-sm text-slate-300">Room packages present: {rooms.length}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                                    <CheckCircle2 className={`h-5 w-5 ${budgetLedger ? 'text-green-400' : 'text-amber-400'}`} />
                                    <span className="text-sm text-slate-300">CSV Budget Ledger: {budgetLedger ? `✅ Parsed (${budgetLedger.lineCount} lines)` : '⚠️ Not parsed yet'}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                                    <CheckCircle2 className={`h-5 w-5 ${summary.tenderTotal > 0 ? 'text-green-400' : 'text-amber-400'}`} />
                                    <span className="text-sm text-slate-300">Tender items priced: {summary.tenderTotal > 0 ? '✅' : '⚠️ No unit prices set'}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                                    <CheckCircle2 className={`h-5 w-5 ${budgetPhases.length > 0 ? 'text-green-400' : 'text-amber-400'}`} />
                                    <span className="text-sm text-slate-300">Budget phases in DB: {budgetPhases.length}</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ==================== DRAWINGS TAB ==================== */}
                    <TabsContent value="drawings">
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Project Drawings & Files</h2>
                            <JobDrawings jobId={id!} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
