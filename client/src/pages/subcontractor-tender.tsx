
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface TenderItem {
    id: string;
    description: string;
    quantity: string;
    unit: string;
    rate: string;
    total: string;
    elementId: string;
    elementName: string;
    roomId: string;
    roomName: string;
    itemType?: string;
}

const CONSOLIDATED_ITEMS = [
    // Construction Items
    { id: 'summary-foundation', label: 'Foundation works (Excavation & Concrete)', unit: 'm³', keywords: ['foundation', 'footing', 'excavat', 'concrete', 'trench'] },
    { id: 'summary-screed', label: 'Floor Screed & Insulation', unit: 'm²', keywords: ['screed', 'oversite', 'insulation', 'floor'] },
    { id: 'summary-brick', label: 'External Brickwork', unit: 'm²', keywords: ['brick', 'facing', 'masonry'] },
    { id: 'summary-block', label: 'Internal/Structural Blockwork', unit: 'm²', keywords: ['block', 'dense', 'thermal'] },
    { id: 'summary-roof', label: 'Roofing (Structure & Tiling)', unit: 'm²', keywords: ['roof', 'tile', 'truss', 'felt', 'batten'] },

    // Fit-out Items
    { id: 'summary-socket', label: 'Double socket installation', unit: 'nr', keywords: ['socket', 'receptacle', 'power', 'outlet'] },
    { id: 'summary-light', label: 'Light fitting installation', unit: 'nr', keywords: ['light', 'lamp', 'fixture', 'rose', 'pendant', 'spot', 'luminaire'] },
    { id: 'summary-switch', label: 'Switch installation (1-way)', unit: 'nr', keywords: ['switch', 'control', 'dimmer'] },
    { id: 'summary-door', label: 'Internal door fitting', unit: 'nr', keywords: ['door'] },
    { id: 'summary-skirting', label: 'Skirting installation', unit: 'lm', keywords: ['skirting'] },
    { id: 'summary-paint-wall', label: 'Wall painting', unit: 'm²', keywords: ['paint', 'emulsion'] },
    { id: 'summary-paint-ceil', label: 'Ceiling painting', unit: 'm²', keywords: ['ceiling'] },
];

export default function SubcontractorTenderView() {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const [submitted, setSubmitted] = useState(false);
    const [rates, setRates] = useState<Record<string, string>>({});

    // Fetch Job Details
    const { data: job, isLoading: jobLoading } = useQuery({
        queryKey: [`/api/jobs/${id}`],
    });

    // Fetch Room Data (for Areas/Perimeters and CSV Items)
    const { data: roomsData, isLoading: roomsLoading } = useQuery({
        queryKey: [`/api/jobs/${id}/rooms`],
    });

    // Fetch All Extracted Elements (for Object Counts)
    const { data: elementsData, isLoading: elementsLoading } = useQuery({
        queryKey: [`/api/jobs/${id}/elements`],
    });

    // -------------------------------------------------------------------------
    // CONSOLIDATED TENDER SUMMARY LOGIC (Combined IFC + CSV Fallback)
    // -------------------------------------------------------------------------
    const summaryRows = CONSOLIDATED_ITEMS.map(item => ({ ...item, ifcQty: 0, csvQty: 0 }));

    // 1. Calculate IFC Quantities
    if (elementsData && Array.isArray(elementsData)) {
        elementsData.forEach((el: any) => {
            const desc = (el.description || '').toLowerCase();
            const type = (el.elementType || '').toLowerCase();

            summaryRows.forEach(row => {
                if (['m²', 'm³', 'lm'].includes(row.unit) && row.id !== 'summary-skirting') return; // Skip metrics unless specific mapping
                if (row.keywords.some(k => desc.includes(k) || type.includes(k))) {
                    row.ifcQty++;
                }
            });
        });
    }

    if (roomsData) {
        // Handle different response structures
        const rooms = roomsData.rooms || roomsData.data || (Array.isArray(roomsData) ? roomsData : []);

        rooms.forEach((room: any) => {
            // IFC Metrics Mapping
            if (room.metrics) {
                // Skirting & Decoration
                summaryRows.find(r => r.id === 'summary-skirting')!.ifcQty += (room.metrics.wallPerimeter || 0);
                summaryRows.find(r => r.id === 'summary-paint-wall')!.ifcQty += (room.metrics.wallArea || 0);
                summaryRows.find(r => r.id === 'summary-paint-ceil')!.ifcQty += (room.metrics.ceilingArea || 0);

                // Construction metrics
                summaryRows.find(r => r.id === 'summary-screed')!.ifcQty += (room.metrics.floorArea || 0);
                summaryRows.find(r => r.id === 'summary-block')!.ifcQty += (room.metrics.wallArea || 0);
            }

            // CSV Quantities (Fallback)
            room.elements?.forEach((el: any) => {
                el.items?.forEach((item: any) => {
                    const desc = item.description.toLowerCase();
                    const qty = parseFloat(item.quantity) || 0;

                    summaryRows.forEach(row => {
                        // For metric items, avoid double counting unless purely CSV fallback
                        if (row.keywords.some(k => desc.includes(k))) {
                            row.csvQty += qty;
                        }
                    });
                });
            });
        });
    }

    // FINAL QUANTITY LOGIC: Prefer IFC, Fallback to CSV
    // Filter out 0 quantity rows UNLESS they are core items like Sockets/Lights that users expect to see
    const activeConsolidatedRows = summaryRows.map(row => ({
        ...row,
        // Use IFC if available (even slightly > 0), else fallback to CSV
        qty: row.ifcQty > 0.1 ? row.ifcQty : row.csvQty
    })).filter(row => row.qty > 0 || ['summary-socket', 'summary-light'].includes(row.id));


    // -------------------------------------------------------------------------
    // SUBMISSION LOGIC
    // -------------------------------------------------------------------------
    const submitTenderMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", `/api/jobs/${id}/tender-submission`, data);
            return res.json();
        },
        onSuccess: () => {
            setSubmitted(true);
            toast({
                title: "Tender Submitted Successfully",
                description: "Thank you for your submission.",
            });
        },
        onError: () => {
            toast({
                title: "Submission Failed",
                description: "Please try again later.",
                variant: "destructive"
            });
        }
    });

    const handleRateChange = (itemId: string, val: string) => {
        setRates(prev => ({ ...prev, [itemId]: val }));
    };

    const calculateTotal = () => {
        return activeConsolidatedRows.reduce((sum, row) => {
            const rate = parseFloat(rates[row.id] || "0");
            return sum + (rate * row.qty);
        }, 0);
    };

    const handleSubmit = () => {
        submitTenderMutation.mutate({
            jobId: id,
            contractorName: "Guest Contractor",
            rates: rates,
            totalPrice: calculateTotal()
        });
    };

    if (jobLoading || roomsLoading || elementsLoading) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-950 text-white"><Loader2 className="animate-spin h-8 w-8 text-amber-500" /></div>;
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
                <CheckCircle2 className="h-20 w-20 text-green-500 mb-6" />
                <h1 className="text-3xl font-bold mb-2">Tender Submitted</h1>
                <p className="text-slate-400 mb-8 max-w-md text-center">Your submission for {job?.title} has been received.</p>
                <Link href="/">
                    <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">Return to Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
            {/* HERDER */}
            <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-lg px-4 py-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Labour Only Tender</div>
                        <h1 className="text-xl font-bold text-white">{job?.title}</h1>
                        <p className="text-sm text-slate-400">Ref: {id?.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-sm text-slate-400">Total Quote</div>
                        <div className="text-2xl font-bold text-white">£{calculateTotal().toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* 1. CONSOLIDATED TENDER SUMMARY (THE ONLY VIEW) */}
                <div className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-2">Tender Summary</h2>
                    <p className="text-slate-400 mb-6 text-sm">Please price the following items based on the quantities derived directly from the building model.</p>

                    <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden shadow-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="py-4 pl-6 font-semibold">Labour Item</th>
                                    <th className="py-4 px-4 font-semibold w-24 text-center">Unit</th>
                                    <th className="py-4 px-4 font-semibold w-32 text-center">Quantity</th>
                                    <th className="py-4 px-4 font-semibold w-32 text-center text-slate-500">Source</th>
                                    <th className="py-4 px-4 font-semibold w-40">Rate (£)</th>
                                    <th className="py-4 pr-6 font-semibold w-40 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {activeConsolidatedRows.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 pl-6 font-medium text-white text-base">{row.label}</td>
                                        <td className="py-4 px-4 text-center text-slate-400 font-medium">{row.unit}</td>
                                        <td className="py-4 px-4 text-center text-slate-200 bg-slate-950/30 font-mono font-medium border-x border-slate-800/30">
                                            {row.qty.toFixed(2)}
                                        </td>
                                        <td className="py-4 px-4 text-center text-xs text-slate-500">
                                            {row.ifcQty > 0.1 ? "IFC Model" : (row.csvQty > 0 ? "CSV Import" : "-")}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="bg-slate-950 border-slate-700 text-white h-10 pl-7 text-base focus:border-amber-500 text-right font-mono"
                                                    value={rates[row.id] || ""}
                                                    onChange={(e) => handleRateChange(row.id, e.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6 text-right text-amber-500 font-mono text-lg font-bold">
                                            £{((parseFloat(rates[row.id] || "0") * row.qty) || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {activeConsolidatedRows.every(r => r.qty === 0) && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                                            No eligible items found in IFC Model or CSV.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-950/50 border-t border-slate-800">
                                <tr>
                                    <td colSpan={5} className="py-4 px-6 text-right font-semibold text-slate-400 uppercase text-xs tracking-wider">
                                        Total Tender Value
                                    </td>
                                    <td className="py-4 pr-6 text-right text-white font-mono text-lg font-bold">
                                        £{calculateTotal().toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 sticky bottom-4 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                        <div className="flex items-start gap-3">
                            <Checkbox id="confirm" className="mt-1 border-slate-600 data-[state=checked]:bg-amber-500" />
                            <div className="space-y-1">
                                <label htmlFor="confirm" className="text-sm font-medium text-white cursor-pointer select-none">
                                    I confirm this price is for LABOUR ONLY
                                </label>
                                <p className="text-xs text-slate-500">I accept payment is per item complete.</p>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 px-8"
                            onClick={handleSubmit}
                            disabled={submitTenderMutation.isPending}
                        >
                            {submitTenderMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                            Submit Tender
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
