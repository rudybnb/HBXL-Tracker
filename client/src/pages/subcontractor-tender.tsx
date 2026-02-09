
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Wrench, Settings2, Info } from "lucide-react";
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
    roomId: string;
    roomName: string;
    itemType?: string;
}

// Items grouped by fix stage within a room
interface FixStageGroup {
    name: string;           // e.g. "Electrical – First Fix"
    isFirstFix: boolean;
    isSecondFix: boolean;
    items: TenderItem[];
}

interface TenderRoom {
    id: string;
    name: string;
    items: TenderItem[];
    fixStages: FixStageGroup[];
}

export default function SubcontractorTenderView() {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [submitted, setSubmitted] = useState(false);
    const [rates, setRates] = useState<Record<string, string>>({});

    // Fetch Job Details
    const { data: job, isLoading: jobLoading } = useQuery({
        queryKey: [`/api/jobs/${id}`],
    });

    // Fetch Room Data (which contains items)
    const { data: roomsData, isLoading: roomsLoading } = useQuery({
        queryKey: [`/api/jobs/${id}/rooms`],
    });

    // Filter for LABOUR Items Only, group by room then by fix stage
    const labourRooms: TenderRoom[] = [];
    let totalLabourItems = 0;

    if (roomsData?.data) {
        const rooms = roomsData.data || (Array.isArray(roomsData) ? roomsData : []);

        rooms.forEach((room: any) => {
            const roomItems: TenderItem[] = [];
            room.elements?.forEach((el: any) => {
                el.items?.forEach((item: any) => {
                    const isLabour = item.itemType === 'LABOUR' ||
                        item.description.toLowerCase().includes('labour') ||
                        item.description.toLowerCase().includes('fix') ||
                        item.description.toLowerCase().includes('install');

                    if (isLabour) {
                        roomItems.push({
                            id: item.id,
                            description: item.description,
                            quantity: item.quantity,
                            unit: item.unit,
                            rate: item.rate,
                            total: item.total,
                            elementId: el.id,
                            elementName: el.name,
                            roomId: room.id,
                            elementName: el.name,
                            roomId: room.id,
                            roomName: room.name,
                            itemType: item.itemType
                        });
                    }
                });
            });

            if (roomItems.length > 0) {
                // Group items by element name (which includes fix stage label)
                const groupMap = new Map<string, TenderItem[]>();
                roomItems.forEach(item => {
                    const key = item.elementName;
                    if (!groupMap.has(key)) groupMap.set(key, []);
                    groupMap.get(key)!.push(item);
                });

                // Sort: First Fix groups first, then Second Fix, then others
                const fixStages: FixStageGroup[] = Array.from(groupMap.entries())
                    .map(([name, items]) => ({
                        name,
                        isFirstFix: name.toLowerCase().includes('first fix') || name.toLowerCase().includes('1st fix'),
                        isSecondFix: name.toLowerCase().includes('second fix') || name.toLowerCase().includes('2nd fix'),
                        items
                    }))
                    .sort((a, b) => {
                        if (a.isFirstFix && !b.isFirstFix) return -1;
                        if (!a.isFirstFix && b.isFirstFix) return 1;
                        if (a.isSecondFix && !b.isSecondFix) return 1;
                        if (!a.isSecondFix && b.isSecondFix) return -1;
                        return a.name.localeCompare(b.name);
                    });

                labourRooms.push({
                    id: room.id,
                    name: room.name,
                    items: roomItems,
                    fixStages
                });
                totalLabourItems += roomItems.length;
            }
        });
    }

    // Submission Mutation
    const submitTenderMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", `/api/jobs/${id}/tender-submission`, data);
            return res.json();
        },
        onSuccess: () => {
            setSubmitted(true);
            toast({
                title: "Tender Submitted Successfully",
                description: "Thank you for your submission. We will be in touch shortly.",
            });
        },
        onError: (err) => {
            toast({
                title: "Submission Failed",
                description: "Please try again later.",
                variant: "destructive"
            });
        }
    });

    const handleRateChange = (itemId: string, val: string) => {
        setRates(prev => ({
            ...prev,
            [itemId]: val
        }));
    };

    const calculateTotal = () => {
        let total = 0;
        labourRooms.forEach(room => {
            room.items.forEach(item => {
                const rate = parseFloat(rates[item.id] || "0");
                const qty = parseFloat(item.quantity);
                total += rate * qty;
            });
        });
        return total;
    };

    const handleSubmit = () => {
        submitTenderMutation.mutate({
            jobId: id,
            contractorName: "Guest Contractor",
            rates: rates,
            totalPrice: calculateTotal()
        });
    };

    if (jobLoading || roomsLoading) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-950 text-white"><Loader2 className="animate-spin h-8 w-8 text-amber-500" /></div>;
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
                <CheckCircle2 className="h-20 w-20 text-green-500 mb-6" />
                <h1 className="text-3xl font-bold mb-2">Tender Submitted</h1>
                <p className="text-slate-400 mb-8 max-w-md text-center">Your submission for {job?.title} has been received. Reference: TND-{id?.substring(0, 6).toUpperCase()}</p>
                <Link href="/">
                    <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">Return to Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
            {/* 1. TENDER LANDING HEADER */}
            <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-lg shadow-black/20">
                <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Labour Only Tender</div>
                            <h1 className="text-xl md:text-2xl font-bold text-white">{job?.title || "Project Title"}</h1>
                            <p className="text-sm text-slate-400 mt-1">Ref: {id?.substring(0, 8)} | deadline: {job?.dueDate ? format(new Date(job.dueDate), "dd MMM yyyy") : "TBC"}</p>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="text-sm text-slate-400">Total Tender Value</div>
                            <div className="text-2xl font-bold text-white">£{calculateTotal().toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* INSTRUCTION PANEL */}
                <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-6 mb-6">
                    <h3 className="text-blue-400 font-semibold mb-3 flex items-center">
                        <span className="bg-blue-500/10 p-1 rounded mr-2">ℹ</span>
                        IMPORTANT INSTRUCTIONS
                    </h3>
                    <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
                        <li>This is a <strong className="text-white">LABOUR ONLY</strong> tender. Materials are excluded.</li>
                        <li>Please enter your rate per item. Total will calculate automatically.</li>
                        <li>Payment is released per completed item upon site inspection.</li>
                        <li>Quantities are fixed based on the architectural drawing.</li>
                    </ul>
                </div>

                {/* GOLDEN RULE BANNER */}
                <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg px-5 py-4 mb-8">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-sm font-semibold text-amber-400 mb-1">First Fix &amp; Second Fix — Clarification</div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                First fix and second fix are shown for <strong className="text-slate-300">clarity only</strong>.
                                All pricing and payments are made per <strong className="text-slate-300">individual labour item</strong> within each room.
                                No phase-based or percentage payments apply.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. GLOBAL ELEMENTS SECTION */}
                {(() => {
                    const globalRoom = labourRooms.find(r => r.name === 'Building / Global');
                    if (!globalRoom) return null;

                    return (
                        <div className="mb-10">
                            <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-2">3. Global Elements (Foundations → Roof)</h2>
                            <div className="space-y-6">
                                {globalRoom.fixStages.map((stage, idx) => (
                                    <div key={stage.name} className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden">
                                        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Section 3.{idx + 1}</div>
                                                <h3 className="text-lg font-semibold text-white">{stage.name}</h3>
                                            </div>
                                            <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                                                Labour Only · {stage.items.length} Items
                                            </div>
                                        </div>

                                        <div className="p-0">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-950/30 border-b border-slate-800/50">
                                                    <tr>
                                                        <th className="py-3 pl-6 pr-4 font-medium w-1/2">Item Description</th>
                                                        <th className="py-3 px-2 font-medium w-24">Unit</th>
                                                        <th className="py-3 px-2 font-medium w-24 text-center">Qty</th>
                                                        <th className="py-3 px-2 font-medium w-32">Rate (£)</th>
                                                        <th className="py-3 pr-6 font-medium w-32 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/30">
                                                    {stage.items.map((item) => (
                                                        <tr key={item.id} className="group hover:bg-slate-800/20 transition-colors">
                                                            <td className="py-3 pl-6 pr-4 text-slate-300 font-medium">
                                                                {item.description}
                                                            </td>
                                                            <td className="py-3 px-2 text-slate-500 text-xs uppercase">{item.unit}</td>
                                                            <td className="py-3 px-2 text-center text-slate-300 bg-slate-950/20">{parseFloat(item.quantity).toFixed(2)}</td>
                                                            <td className="py-3 px-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    className="bg-slate-950 border-slate-700 text-white h-9 text-sm focus:border-amber-500 text-right font-mono"
                                                                    value={rates[item.id] || ""}
                                                                    onChange={(e) => handleRateChange(item.id, e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3 pr-6 text-right text-amber-500 font-mono">
                                                                £{((parseFloat(rates[item.id] || "0") * parseFloat(item.quantity)) || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* 3. ROOM WORK PACKAGES */}
                <div className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-2">4. Rooms (Room Work Packages)</h2>
                    <p className="text-slate-400 mb-6 text-sm">Enter labour rates for items within each room.</p>

                    <Accordion type="multiple" defaultValue={labourRooms.filter(r => r.name !== 'Building / Global').map(r => r.id)} className="space-y-4">
                        {labourRooms.filter(r => r.name !== 'Building / Global').map((room, index) => (
                            <AccordionItem key={room.id} value={room.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden px-0">
                                <AccordionTrigger className="px-6 py-4 hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-white">{room.name}</div>
                                            <div className="text-xs text-slate-500">
                                                {room.fixStages.length} section{room.fixStages.length !== 1 ? 's' : ''} · {room.items.length} items to price
                                            </div>
                                        </div>
                                    </div>
                                    {/* Subtotal for room */}
                                    <div className="mr-4 text-slate-400 text-sm font-medium">
                                        {(() => {
                                            const sub = room.items.reduce((acc, item) => acc + (parseFloat(rates[item.id] || "0") * parseFloat(item.quantity)), 0);
                                            return sub > 0 ? `£${sub.toFixed(2)}` : "-";
                                        })()}
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className="border-t border-slate-800 bg-slate-950/30">
                                    <div className="px-4 py-4 md:px-6 space-y-4">
                                        {/* Render each fix stage group */}
                                        {room.fixStages.map((stage) => (
                                            <div key={stage.name} className="rounded-lg border border-slate-800/60 overflow-hidden">
                                                {/* Fix Stage Header */}
                                                <div className={`flex items-center gap-3 px-4 py-3 ${stage.isFirstFix
                                                    ? 'bg-blue-950/30 border-b border-blue-900/30'
                                                    : stage.isSecondFix
                                                        ? 'bg-emerald-950/20 border-b border-emerald-900/30'
                                                        : 'bg-slate-900/50 border-b border-slate-800/50'
                                                    }`}>
                                                    {stage.isFirstFix ? (
                                                        <Wrench className="h-4 w-4 text-blue-400" />
                                                    ) : stage.isSecondFix ? (
                                                        <Settings2 className="h-4 w-4 text-emerald-400" />
                                                    ) : (
                                                        <Wrench className="h-4 w-4 text-slate-500" />
                                                    )}
                                                    <div className="flex-1">
                                                        <span className={`text-sm font-semibold ${stage.isFirstFix
                                                            ? 'text-blue-300'
                                                            : stage.isSecondFix
                                                                ? 'text-emerald-300'
                                                                : 'text-slate-300'
                                                            }`}>
                                                            {stage.name}
                                                        </span>
                                                        <span className="text-xs text-slate-600 ml-2">
                                                            ({stage.items.length} item{stage.items.length !== 1 ? 's' : ''})
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-medium">
                                                        Informational
                                                    </span>
                                                </div>

                                                {/* Items Table */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-500 uppercase border-b border-slate-800/50">
                                                            <tr>
                                                                <th className="py-2.5 pl-4 pr-4 font-medium min-w-[200px]">Item Description</th>
                                                                <th className="py-2.5 px-2 font-medium w-16">Unit</th>
                                                                <th className="py-2.5 px-2 font-medium w-16 text-center">Qty</th>
                                                                <th className="py-2.5 px-2 font-medium w-28">Rate (£)</th>
                                                                <th className="py-2.5 pr-4 font-medium w-28 text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800/30">
                                                            {stage.items.map((item) => (
                                                                <tr key={item.id} className="group hover:bg-slate-900/40 transition-colors">
                                                                    <td className="py-3 pl-4 pr-4 text-slate-300">
                                                                        <div className="font-medium text-sm">{item.description}</div>
                                                                    </td>
                                                                    <td className="py-3 px-2 text-slate-500 text-xs uppercase">{item.unit}</td>
                                                                    <td className="py-3 px-2 text-center text-slate-300 font-medium bg-slate-900/30 rounded">{item.quantity}</td>
                                                                    <td className="py-3 px-2">
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="0.00"
                                                                            className="bg-slate-900 border-slate-700 text-white h-8 text-sm focus:border-amber-500 transition-colors text-right"
                                                                            value={rates[item.id] || ""}
                                                                            onChange={(e) => handleRateChange(item.id, e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-3 pr-4 text-right text-amber-500 font-mono text-sm">
                                                                        £{((parseFloat(rates[item.id] || "0") * parseFloat(item.quantity)) || 0).toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {/* 8. SUMMARY & SUBMIT */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 sticky bottom-4 shadow-2xl shadow-black/50 backdrop-blur-sm bg-slate-900/95">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                        <div className="flex items-start gap-3">
                            <Checkbox id="confirm" className="mt-1 border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500" />
                            <div className="space-y-1">
                                <label htmlFor="confirm" className="text-sm font-medium text-white cursor-pointer select-none">
                                    I confirm this price is for LABOUR ONLY
                                </label>
                                <p className="text-xs text-slate-500">I accept payment is per item complete. First fix / second fix are informational labels only.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Total Quote</div>
                                <div className="text-2xl font-bold text-amber-500">£{calculateTotal().toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
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
        </div>
    );
}
