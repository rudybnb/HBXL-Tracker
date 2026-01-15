/**
 * Room Work Packages UI
 * 
 * AGENTS.md Compliant UI for commercial control
 * Hierarchy: ROOM -> ELEMENT -> PAYABLE ITEM
 * 
 * Assignment is allowed ONLY at Payable Item level
 * Status is auto-calculated from item completion
 */

import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState } from "react";
import {
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    Home,
    CheckCircle2,
    Clock,
    CircleDot,
    User,
    Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { format } from "date-fns";

// Types matching the API response
interface PayableItemData {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
    status: "not_started" | "in_progress" | "complete";
    assignedContractorName?: string;
}

interface ElementData {
    id: string;
    name: string;
    measurementSummary?: string;
    subtotal: number;
    items: PayableItemData[];
}

interface RoomData {
    id: string;
    name: string;
    floor?: string;
    status: "not_started" | "in_progress" | "complete";
    totalValue: number;
    elements: ElementData[];
}

interface CostBreakdown {
    labour: number;
    material: number;
    plant: number;
    subcontractor: number;
    total: number;
}

interface RoomWorkPackagesResponse {
    jobId: string;
    projectName: string;
    rooms: RoomData[];
    costBreakdown?: CostBreakdown;
    generatedAt: string;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config = {
        not_started: { label: "Not Started", icon: CircleDot, className: "bg-slate-600 text-slate-200" },
        in_progress: { label: "In Progress", icon: Clock, className: "bg-amber-600 text-amber-100" },
        complete: { label: "Complete", icon: CheckCircle2, className: "bg-green-600 text-green-100" }
    };

    const { label, icon: Icon, className } = config[status as keyof typeof config] || config.not_started;

    return (
        <Badge className={`${className} gap-1`}>
            <Icon className="h-3 w-3" />
            {label}
        </Badge>
    );
}

// Room Card component
function RoomCard({ room }: { room: RoomData }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                {/* Room Header */}
                <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            {isOpen ? (
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                            ) : (
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            )}
                            <Home className="h-5 w-5 text-amber-400" />
                            <div>
                                <h3 className="text-lg font-bold text-white">{room.name}</h3>
                                {room.floor && (
                                    <p className="text-xs text-slate-400">{room.floor}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <StatusBadge status={room.status} />
                            <div className="text-xl font-semibold text-amber-400">
                                £{room.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>

                {/* Room Content - Elements and Items */}
                <CollapsibleContent>
                    <div className="border-t border-slate-700">
                        {room.elements.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 italic">
                                No elements in this room
                            </div>
                        ) : (
                            room.elements.map(element => (
                                <ElementSection key={element.id} element={element} />
                            ))
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

// Element Section component
function ElementSection({ element }: { element: ElementData }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border-b border-slate-700/50 last:border-b-0">
            {/* Element Header */}
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <div className="px-6 py-3 bg-slate-900/50 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors">
                        <div className="flex items-center gap-2">
                            {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                            )}
                            <span className="font-medium text-slate-300">{element.name}</span>
                            {element.measurementSummary && (
                                <span className="text-xs text-slate-500">({element.measurementSummary})</span>
                            )}
                        </div>
                        <span className="text-sm font-medium text-slate-400">
                            £{element.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </CollapsibleTrigger>

                {/* Payable Items Table */}
                <CollapsibleContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-800/80 text-slate-400 font-medium">
                                <tr>
                                    <th className="px-6 py-2 text-left">Description</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-right">Unit</th>
                                    <th className="px-4 py-2 text-right">Rate</th>
                                    <th className="px-4 py-2 text-right">Total</th>
                                    <th className="px-4 py-2 text-center">Status</th>
                                    <th className="px-4 py-2 text-left">Assigned</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {element.items.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-3 text-slate-200 max-w-xs truncate" title={item.description}>
                                            {item.description}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300">
                                            {item.quantity.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400 text-xs uppercase">
                                            {item.unit}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300">
                                            £{item.rate.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-amber-500">
                                            £{item.total.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <StatusBadge status={item.status} />
                                        </td>
                                        <td className="px-4 py-3 text-left">
                                            {item.assignedContractorName ? (
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <User className="h-3 w-3" />
                                                    {item.assignedContractorName}
                                                </span>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-amber-400">
                                                    Assign
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {element.items.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                            No payable items in this element
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// Main Page Component
export default function RoomWorkPackages() {
    const { id } = useParams<{ id: string }>();

    const { data, isLoading, error } = useQuery<RoomWorkPackagesResponse>({
        queryKey: [`/api/jobs/${id}/rooms`],
    });

    if (isLoading) {
        return (
            <div className="p-8 bg-slate-900 min-h-screen text-slate-100">
                <Skeleton className="h-12 w-64 bg-slate-800 mb-6" />
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full bg-slate-800" />
                    <Skeleton className="h-32 w-full bg-slate-800" />
                    <Skeleton className="h-32 w-full bg-slate-800" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 bg-slate-900 min-h-screen text-slate-100 flex flex-col items-center justify-center">
                <h1 className="text-2xl text-red-500 mb-4">Error Loading Room Data</h1>
                <p className="text-slate-400 mb-6">Could not retrieve Room Work Packages for this job.</p>
                <Link href="/job-assignments">
                    <Button variant="outline">Return to Jobs</Button>
                </Link>
            </div>
        );
    }

    // Calculate totals
    const grandTotal = data.rooms.reduce((sum, room) => sum + room.totalValue, 0);
    const totalItems = data.rooms.reduce((sum, room) =>
        sum + room.elements.reduce((eSum, el) => eSum + el.items.length, 0), 0);
    const completedItems = data.rooms.reduce((sum, room) =>
        sum + room.elements.reduce((eSum, el) =>
            eSum + el.items.filter(item => item.status === 'complete').length, 0), 0);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-4">
                            <Link href="/job-assignments">
                                <Button variant="ghost" className="text-slate-400 hover:text-amber-400">
                                    <ArrowLeft className="h-5 w-5 mr-2" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-amber-400 flex items-center">
                                    <Home className="mr-2 h-6 w-6" />
                                    Room Work Packages
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Project: {data.projectName} | {data.rooms.length} Rooms | {completedItems}/{totalItems} Items Complete
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Total Contract Value</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    £{grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cost Breakdown Summary Cards */}
            {data.costBreakdown && data.costBreakdown.total > 0 && (
                <div className="max-w-7xl mx-auto pt-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Labour */}
                        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-blue-400 text-sm font-medium">Labour</span>
                                <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center">
                                    <User className="h-4 w-4 text-blue-400" />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-white">
                                £{data.costBreakdown.labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        {/* Material */}
                        <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-emerald-400 text-sm font-medium">Material</span>
                                <div className="w-8 h-8 bg-emerald-600/30 rounded-lg flex items-center justify-center">
                                    <Home className="h-4 w-4 text-emerald-400" />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-white">
                                £{data.costBreakdown.material.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        {/* Plant */}
                        <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 border border-orange-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-orange-400 text-sm font-medium">Plant</span>
                                <div className="w-8 h-8 bg-orange-600/30 rounded-lg flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-orange-400" />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-white">
                                £{data.costBreakdown.plant.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        {/* Total */}
                        <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border border-amber-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-amber-400 text-sm font-medium">Total Cost</span>
                                <div className="w-8 h-8 bg-amber-600/30 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-amber-400">
                                £{data.costBreakdown.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Room Cards */}
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div className="space-y-4">
                    {data.rooms.length === 0 ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                            <Home className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-400 mb-2">No Rooms Generated</h3>
                            <p className="text-sm text-slate-500">
                                Import a CSV to automatically generate Room Work Packages from HBXL phases.
                            </p>
                        </div>
                    ) : (
                        data.rooms.map(room => (
                            <RoomCard key={room.id} room={room} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
