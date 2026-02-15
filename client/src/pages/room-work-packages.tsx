
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, AlertCircle, Wrench, Home, BarChart3, Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// --- TENDER TYPES (Matching Server Schema) ---
export interface TenderItem {
    itemId: string;
    itemType: "LABOUR";
    description: string;
    unit: "m2" | "m3" | "lm" | "nr" | "point" | "hour" | "day";
    quantity: number;
    quantityLocked: true;
    rate: number | null; // Must be null until contractor enters it
    completion?: {
        status: "NOT_STARTED" | "COMPLETED";
    };
}

export interface GlobalSection {
    sectionId: string;
    title: string;
    items: TenderItem[];
}

export interface RoomPackage {
    packageId: string;
    label: "FIRST_FIX" | "SECOND_FIX";
    items: TenderItem[];
}

export interface TenderRoom {
    roomId: string;
    name: string;
    areaM2: number;
    packages: RoomPackage[];
}

export interface TenderData {
    tenderId: string;
    projectName: string;
    currency: "GBP";
    tenderType: "LABOUR_ONLY";
    materialsExcluded: true;
    plantExcluded: true;
    paymentBasis: "ITEM_COMPLETE";
    quantitiesBasis: "IFC_DERIVED_LOCKED";
}

export interface TenderResponse {
    schemaVersion: "1.0.0";
    tender: TenderData;
    globalElements: GlobalSection[];
    rooms: TenderRoom[];
}

export default function RoomWorkPackages() {
    const { id } = useParams<{ id: string }>();

    // Fetch Data
    const { data, isLoading, error } = useQuery<TenderResponse>({
        queryKey: [`/api/jobs/${id}/tender`],
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            </div>
        );
    }

    if (error || !data) {
        console.error(error);
        return (
            <div className="min-h-screen bg-white p-8 flex items-center justify-center text-red-600">
                <AlertCircle className="h-6 w-6 mr-2" />
                Error loading extraction data.
            </div>
        );
    }

    // Calculations
    const getRoomTotal = (r: TenderRoom) => {
        let total = 0;
        r.packages.forEach(pkg => {
            pkg.items.forEach(item => {
                const rate = item.rate || 0;
                total += rate * item.quantity;
            });
        });
        return total;
    };

    const getGlobalTotal = () => {
        if (!data) return 0;
        let total = 0;
        data.globalElements.forEach(section => {
            section.items.forEach(item => {
                const rate = item.rate || 0;
                total += rate * item.quantity;
            });
        });
        return total;
    };

    const getTotalLabourTender = () => {
        if (!data) return 0;
        const roomsTotal = data.rooms.reduce((acc, r) => acc + getRoomTotal(r), 0);
        return getGlobalTotal() + roomsTotal;
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans p-8 md:p-16 max-w-5xl mx-auto selection:bg-yellow-100">

            {/* --- HEADER --- */}
            <div className="mb-12 border-b border-slate-200 pb-6">
                <h1 className="text-2xl font-bold uppercase tracking-tight mb-2 text-slate-900">
                    COMPLETE EXTRACTION — GLOBAL + {data.rooms.length} ROOMS
                </h1>
                <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">
                    Labour Only • Quantities from IFC
                </p>
                <p className="text-xs text-slate-400 mt-1 uppercase font-mono">
                    Tender ID: {data.tender.tenderId}
                </p>
            </div>

            {/* --- GLOBAL ELEMENTS --- */}
            <div className="mb-16">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-tight">
                    <Wrench className="h-5 w-5 text-slate-400" />
                    GLOBAL ELEMENTS (BUILDING-LEVEL)
                </h2>

                {data.globalElements.map((section) => (
                    <div key={section.sectionId} className="mb-8 last:mb-0">
                        <h3 className="text-md font-bold text-slate-800 mb-3 pl-2 border-l-4 border-slate-200">
                            {section.title}
                        </h3>
                        <ExtractionTable items={section.items} withRates />
                    </div>
                ))}

                {data.globalElements.length === 0 && <p className="text-slate-400 italic">No global elements found.</p>}

                <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-slate-900 font-bold uppercase text-sm">
                    <span>GLOBAL ELEMENTS SUBTOTAL (AUTO):</span>
                    <span className="font-mono text-lg border-b border-slate-300 min-w-[100px] text-right">
                        £{getGlobalTotal() > 0 ? getGlobalTotal().toFixed(2) : '_____'}
                    </span>
                </div>
            </div>

            <Separator className="my-12 bg-slate-200" />

            {/* --- ROOM PACKAGES --- */}
            <div className="mb-16">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-8 uppercase tracking-tight">
                    <Home className="h-5 w-5 text-slate-400" />
                    ROOM PACKAGES
                </h2>

                {data.rooms.map((room, index) => (
                    <div key={room.roomId} className="mb-16 last:mb-0">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-900 uppercase">
                                ROOM {index + 1} — {room.name}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">Area: {room.areaM2.toFixed(2)} m²</p>
                        </div>

                        <div className="space-y-6">
                            {room.packages.map(pkg => (
                                <div key={pkg.packageId}>
                                    <h4 className="text-sm font-bold text-slate-700 mb-2">
                                        {formatLabel(pkg.label)} (label only)
                                    </h4>
                                    <ExtractionTable items={pkg.items} withRates />
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 flex justify-between items-center text-slate-900 font-bold uppercase text-sm">
                            <span>{room.name} Subtotal (auto):</span>
                            <span className="font-mono text-lg border-b border-slate-300 min-w-[100px] text-right">
                                £{getRoomTotal(room) > 0 ? getRoomTotal(room).toFixed(2) : '_____'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <Separator className="my-12 bg-slate-200" />

            {/* --- FINAL TOTALS --- */}
            <div className="mb-16">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-tight">
                    <BarChart3 className="h-5 w-5 text-slate-400" />
                    FINAL TOTALS (READ-ONLY)
                </h2>

                <div className="max-w-md ml-auto">
                    <table className="w-full text-sm font-medium">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="text-left py-2 font-normal">Section</th>
                                <th className="text-right py-2 font-normal">Total (£)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="py-3 text-slate-700">Global Elements</td>
                                <td className="py-3 text-right font-mono">
                                    £{getGlobalTotal() > 0 ? getGlobalTotal().toFixed(2) : '_____'}
                                </td>
                            </tr>
                            {data.rooms.map(r => (
                                <tr key={r.roomId}>
                                    <td className="py-3 text-slate-700">{r.name}</td>
                                    <td className="py-3 text-right font-mono">£{getRoomTotal(r) > 0 ? getRoomTotal(r).toFixed(2) : '_____'}</td>
                                </tr>
                            ))}
                            <tr className="border-t border-slate-300 font-bold text-slate-900 text-base">
                                <td className="py-4 uppercase">TOTAL LABOUR TENDER</td>
                                <td className="py-4 text-right font-mono">
                                    £{getTotalLabourTender() > 0 ? getTotalLabourTender().toFixed(2) : '_____'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- FOOTER: RULES --- */}
            <div className="pt-8 border-t border-slate-200 text-slate-600">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Locked Rules (unchanged)
                </h3>
                <ul className="text-xs space-y-1 list-disc pl-5 font-medium leading-relaxed">
                    <li>Quantities fixed from IFC</li>
                    <li>Contractor enters <strong>rates only</strong></li>
                    <li>Payment released <strong>per completed line item</strong></li>
                    <li>No % stages, no phased payments</li>
                </ul>
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function formatLabel(label: string) {
    if (label === 'FIRST_FIX') return 'First Fix';
    if (label === 'SECOND_FIX') return 'Second Fix';
    return label;
}

function ExtractionTable({ items, withRates = false }: { items: TenderItem[], withRates?: boolean }) {
    if (!items.length) return <div className="text-xs text-slate-400 italic pl-4">No items</div>;

    return (
        <table className="w-full text-sm text-left border-collapse">
            <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold tracking-wide">
                    <th className="py-2 pl-0 w-[50%]">Item</th>
                    <th className="py-2 px-4 w-[10%] text-left">Unit</th>
                    <th className="py-2 px-4 w-[15%] text-right">Quantity</th>
                    <th className="py-2 px-4 w-[15%] text-right font-normal text-slate-400">Rate (£)</th>
                    <th className="py-2 pr-0 w-[10%] text-right font-normal text-slate-400">Total (£)</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                    const lineTotal = (item.rate || 0) * item.quantity;
                    return (
                        <tr key={item.itemId} className="hover:bg-slate-50">
                            <td className="py-3 pl-0 font-medium text-slate-700 align-top">
                                {item.description}
                            </td>
                            <td className="py-3 px-4 text-left text-slate-500 align-top">
                                {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-800 align-top">
                                {item.quantity ? item.quantity.toFixed(2) : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-400 align-top">
                                {withRates && item.rate ? item.rate.toFixed(2) : '—'}
                            </td>
                            <td className="py-3 pr-0 text-right font-mono text-slate-400 font-medium align-top">
                                {withRates && item.rate ? lineTotal.toFixed(2) : 'auto'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
