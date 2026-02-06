
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface TenderItem {
    id: string;
    description: string;
    quantity: string;
    unit: string;
    rate: string; // The rate suggested (hidden or explicitly 0 for blind tender)
    total: string;
    elementId: string;
    elementName: string;
    roomId: string;
    roomName: string;
}

interface TenderRoom {
    id: string;
    name: string;
    items: TenderItem[];
}

export default function SubcontractorTenderView() {
    const { id } = useParams<{ id: string }>(); // This is the Job ID
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [submitted, setSubmitted] = useState(false);
    const [rates, setRates] = useState<Record<string, string>>({}); // itemId -> rate (pence)

    // Fetch Job Details
    const { data: job, isLoading: jobLoading } = useQuery({
        queryKey: [`/api/jobs/${id}`],
    });

    // Fetch Room Data (which contains items)
    const { data: roomsData, isLoading: roomsLoading } = useQuery({
        queryKey: [`/api/jobs/${id}/rooms`],
    });

    // Filter for LABOUR Items Only
    const labourRooms: TenderRoom[] = [];
    let totalLabourItems = 0;

    if (roomsData?.data) { // Assuming response structure
        // Need to flatten the room -> element -> item hierarchy
        // Actually the API returns RoomData[] structure.
        // Let's assume standard room structure:
        const rooms = roomsData.data || (Array.isArray(roomsData) ? roomsData : []);

        rooms.forEach((room: any) => {
            const roomItems: TenderItem[] = [];
            room.elements?.forEach((el: any) => {
                el.items?.forEach((item: any) => {
                    // FILTER: Only show items tagged as labour or implied
                    // Since we just added itemType, we use that if available.
                    // Fallback to text matching if itemType missing in older data
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
                            roomName: room.name
                        });
                    }
                });
            });

            if (roomItems.length > 0) {
                labourRooms.push({
                    id: room.id,
                    name: room.name,
                    items: roomItems
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
            contractorName: "Guest Contractor", // TODO: Auth or Input
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
                <p className="text-slate-400 mb-8 max-w-md text-center">Your submisson for {job?.title} has been received. Reference: TND-{id?.substring(0, 6).toUpperCase()}</p>
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
                <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-6 mb-8">
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

                {/* 2. TENDER OVERVIEW */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Scope of Works ({labourRooms.length} Rooms)</h2>

                    <Accordion type="multiple" defaultValue={[labourRooms[0]?.id]} className="space-y-4">
                        {labourRooms.map((room, index) => (
                            <AccordionItem key={room.id} value={room.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden px-0">
                                <AccordionTrigger className="px-6 py-4 hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-white">{room.name}</div>
                                            <div className="text-xs text-slate-500">{room.items.length} items to price</div>
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
                                    <div className="px-4 py-2 md:px-6">
                                        {/* 4. PAYABLE ITEM TABLE */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-900/0 border-b border-slate-800">
                                                    <tr>
                                                        <th className="py-3 pr-4 font-medium min-w-[200px]">Item Description</th>
                                                        <th className="py-3 px-2 font-medium w-20">Unit</th>
                                                        <th className="py-3 px-2 font-medium w-20 text-center">Qty</th>
                                                        <th className="py-3 px-2 font-medium w-32">Rate (£)</th>
                                                        <th className="py-3 pl-4 font-medium w-32 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/50">
                                                    {room.items.map((item) => (
                                                        <tr key={item.id} className="group hover:bg-slate-900/40">
                                                            <td className="py-3 pr-4 text-slate-300">
                                                                <div className="font-medium">{item.description}</div>
                                                                <div className="text-xs text-slate-600">{item.elementName}</div>
                                                            </td>
                                                            <td className="py-3 px-2 text-slate-500 text-xs uppercase">{item.unit}</td>
                                                            <td className="py-3 px-2 text-center text-slate-300 font-medium bg-slate-900/30 rounded">{item.quantity}</td>
                                                            <td className="py-3 px-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    className="bg-slate-900 border-slate-700 text-white h-9 focus:border-amber-500 transition-colors text-right"
                                                                    value={rates[item.id] || ""}
                                                                    onChange={(e) => handleRateChange(item.id, e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3 pl-4 text-right text-amber-500 font-mono">
                                                                £{((parseFloat(rates[item.id] || "0") * parseFloat(item.quantity)) || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
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
                                <p className="text-xs text-slate-500">I accept payment is per item complete and quantities are fixed.</p>
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
