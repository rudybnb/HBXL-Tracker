import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { FileText, ArrowLeft, Download, Calculator, CheckCircle2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobDrawings from "@/components/job-drawings";

interface QSItem {
    element: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
    isCalculated: boolean;
    source?: string;
}

interface QSSection {
    id: string;
    title: string;
    description: string;
    total: number;
    items: QSItem[];
}

interface QSTenderDocument {
    projectId: string;
    projectName: string;
    generatedAt: string;
    grandTotal: number;
    sections: QSSection[];
}

export default function JobTenderView() {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiRequest('POST', `/api/jobs/${id}/import-hbxl`, formData);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Budget Imported Successfully",
                description: `Processed ${data.rooms} rooms. Grand Total: £${(data.totals.grand_total_pence / 100).toFixed(2)}`
            });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${id}/qs-tender`] });
        },
        onError: (err) => {
            toast({
                title: "Import Failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive"
            });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadMutation.mutate(e.target.files[0]);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const { data: tender, isLoading, error } = useQuery<QSTenderDocument>({
        queryKey: [`/api/jobs/${id}/qs-tender`],
    });

    const exportToExcel = () => {
        if (!tender) return;

        // Flatten sections for Excel
        const rows: any[] = [];
        tender.sections.forEach(section => {
            // Section Header
            rows.push({
                "Section": section.title,
                "Description": section.description,
                "Total": section.total
            });

            // Items
            section.items.forEach(item => {
                rows.push({
                    "Section": "",
                    "Element": item.element,
                    "Description": item.description,
                    "Quantity": item.quantity,
                    "Unit": item.unit,
                    "Rate": item.rate,
                    "Total": item.total,
                    "Source": item.isCalculated ? "QS Calculation" : "CSV"
                });
            });

            rows.push({}); // Gap
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tender Breakdown");
        XLSX.writeFile(wb, `${tender.projectName}_Tender.xlsx`);
    };

    if (isLoading) {
        return <div className="p-8 bg-slate-900 min-h-screen text-slate-100 flex justify-center"><Skeleton className="h-96 w-full max-w-4xl bg-slate-800" /></div>;
    }

    if (error || !tender) {
        return (
            <div className="p-8 bg-slate-900 min-h-screen text-slate-100 flex flex-col items-center">
                <h1 className="text-2xl text-amber-500 mb-4">Tender Not Yet Generated</h1>
                <p className="text-slate-400 mb-6">No QS data found. Please import HBXL/CSV data to generate the tender.</p>
                <div className="flex gap-4">
                    <Link href="/">
                        <Button variant="outline">Return Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-4">
                            <Link href="/admin-task-monitor">
                                <Button variant="ghost" className="text-slate-400 hover:text-amber-400">
                                    <ArrowLeft className="h-5 w-5 mr-2" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-amber-400 flex items-center">
                                    <Calculator className="mr-2 h-6 w-6" />
                                    QS Tender Document
                                </h1>
                                <p className="text-xs text-slate-400">Project: {tender.projectName} | Generated: {format(new Date(tender.generatedAt), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white">
                                <Download className="mr-2 h-4 w-4" />
                                Export Excel
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto py-8 px-4">

                <Tabs defaultValue="tender" className="space-y-6">
                    <TabsList className="bg-slate-800 border-slate-700">
                        <TabsTrigger value="tender" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Smart Plan (HBXL)</TabsTrigger>
                        <Link href={`/jobs/${id}/rooms`}>
                            <TabsTrigger value="rooms" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Room Work Packages</TabsTrigger>
                        </Link>
                        <TabsTrigger value="drawings" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">Drawings & Files</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tender">
                        {/* Grand Total Card */}
                        <div className="bg-slate-800 border border-amber-500/30 rounded-lg p-6 mb-8 text-center shadow-lg shadow-amber-900/10">
                            <h2 className="text-slate-400 uppercase tracking-wider text-sm mb-2">Total Construction Cost (Est)</h2>
                            <div className="text-5xl font-bold text-amber-400">
                                £{tender.grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </div>
                            <p className="text-slate-500 text-xs mt-2">*Excludes Prelims & Welfare (HBXL Included)</p>

                            {/* Breakdown Grid */}
                            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-700/50">
                                {(() => {
                                    let labour = 0, material = 0, plant = 0;
                                    tender.sections.forEach(s => s.items.forEach(i => {
                                        const type = i.element.toUpperCase();
                                        if (type === 'LABOUR') labour += i.total;
                                        else if (type === 'PLANT') plant += i.total;
                                        else material += i.total; // Default to material if unknown or MATERIAL
                                        // Note: If you have SUBCONTRACTOR, it falls to material here, unless we add a 4th box.
                                        // Let's keep it simple for now matching the user request.
                                    }));
                                    return (
                                        <>
                                            <div className="bg-slate-900/50 rounded p-3">
                                                <div className="text-xs text-slate-400 uppercase">Labour</div>
                                                <div className="text-xl font-semibold text-blue-400">£{labour.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            </div>
                                            <div className="bg-slate-900/50 rounded p-3">
                                                <div className="text-xs text-slate-400 uppercase">Material</div>
                                                <div className="text-xl font-semibold text-emerald-400">£{material.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            </div>
                                            <div className="bg-slate-900/50 rounded p-3">
                                                <div className="text-xs text-slate-400 uppercase">Plant</div>
                                                <div className="text-xl font-semibold text-purple-400">£{plant.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-6">
                            {tender.sections.map((section) => (
                                <div key={section.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-bold text-white flex items-center">
                                                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded mr-3">Section {section.id}</span>
                                                {section.title}
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-1 ml-14">{section.description}</p>
                                        </div>
                                        <div className="text-xl font-semibold text-amber-500">
                                            £{section.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-900/50 text-slate-400 font-medium border-b border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-3 text-left">Element</th>
                                                    <th className="px-6 py-3 text-left">Description</th>
                                                    <th className="px-6 py-3 text-right">Qty</th>
                                                    <th className="px-6 py-3 text-right">Unit</th>
                                                    <th className="px-6 py-3 text-right">Rate</th>
                                                    <th className="px-6 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/50">
                                                {section.items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-700/30">
                                                        <td className="px-6 py-4 font-medium text-slate-200">
                                                            {item.element}
                                                            {item.isCalculated && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500" title="QS Model Calculated"></span>}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={item.description}>{item.description}</td>
                                                        <td className="px-6 py-4 text-right text-slate-300">{item.quantity}</td>
                                                        <td className="px-6 py-4 text-right text-slate-400 text-xs uppercase">{item.unit}</td>
                                                        <td className="px-6 py-4 text-right text-slate-300">£{item.rate.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-amber-500">£{item.total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                {section.items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">No items found for this section in CSV or Model.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

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
