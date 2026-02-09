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
    Calendar,
    Plus,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
    status: "not_started" | "in_progress" | "complete";
    assignedContractorName?: string;
    itemType?: string;
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

// Main Page Component
export default function RoomWorkPackages() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomFloor, setNewRoomFloor] = useState("");
    const [viewMode, setViewMode] = useState<'ALL' | 'LABOUR'>('ALL');

    const { data, isLoading, error } = useQuery<RoomWorkPackagesResponse>({
        queryKey: [`/api/jobs/${id}/rooms`],
    });

    const createRoomMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/jobs/${id}/rooms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newRoomName,
                    floor: newRoomFloor || "Ground Floor"
                })
            });
            if (!res.ok) throw new Error("Failed to create room");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${id}/rooms`] });
            setIsCreateDialogOpen(false);
            setNewRoomName("");
            setNewRoomFloor("");
            toast({ title: "Room Created", description: `Added ${newRoomName} to work packages.` });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create room.", variant: "destructive" });
        }
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
    // Calculate totals dynamically from items (ignoring potentially stale room totals)
    const processedRooms = data.rooms.map(room => {
        // Filter elements and items based on viewMode
        const filteredElements = room.elements.map(el => {
            const visibleItems = el.items.filter(item => {
                if (viewMode === 'ALL') return true;

                const desc = item.description.toLowerCase();

                // Explicitly HIDE known materials even if marked as Labour (legacy data fix)
                if (desc.includes('cable') || desc.includes('box') || desc.includes('clip') || desc.includes('screw') || desc.includes('plug') || desc.includes('plate') || desc.includes('socket') || desc.includes('switch')) {
                    return false;
                }

                // Labour Only Filter
                return item.itemType === 'LABOUR' ||
                    desc.includes('labour') ||
                    desc.includes('electrician') ||
                    desc.includes('plumber') ||
                    desc.includes('carpenter') ||
                    desc.includes('mate');
            });

            return {
                ...el,
                items: visibleItems,
                // Recalculate element subtotal from visible items
                subtotal: visibleItems.reduce((sum, item) => sum + (item.total || 0), 0)
            };
        }).filter(el => el.items.length > 0); // Only keep elements with visible items

        const calculatedTotal = filteredElements.reduce((rSum, el) => rSum + el.subtotal, 0);

        return {
            ...room,
            elements: filteredElements,
            totalValue: calculatedTotal
        };
    }).filter(room => room.elements.length > 0 || room.name === 'Building / Global'); // Keep rooms with content (or Global)

    const grandTotal = processedRooms.reduce((sum, room) => sum + room.totalValue, 0);
    const totalItems = processedRooms.reduce((sum, room) =>
        sum + room.elements.reduce((eSum, el) => eSum + el.items.length, 0), 0);
    const completedItems = processedRooms.reduce((sum, room) =>
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
                                    Project: {data?.projectName} | {data?.rooms.length || 0} Rooms | {completedItems}/{totalItems} Items Complete
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Room
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-800 text-slate-100 border-slate-700">
                                    <DialogHeader>
                                        <DialogTitle>Add New Room</DialogTitle>
                                        <DialogDescription className="text-slate-400">
                                            Manually add a room to this job. You can populate it with items later.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="name" className="text-right text-slate-300">
                                                Name
                                            </Label>
                                            <Input
                                                id="name"
                                                value={newRoomName}
                                                onChange={(e) => setNewRoomName(e.target.value)}
                                                className="col-span-3 bg-slate-700 border-slate-600 text-slate-100"
                                                placeholder="e.g. Master Bedroom"
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="floor" className="text-right text-slate-300">
                                                Floor
                                            </Label>
                                            <Input
                                                id="floor"
                                                value={newRoomFloor}
                                                onChange={(e) => setNewRoomFloor(e.target.value)}
                                                className="col-span-3 bg-slate-700 border-slate-600 text-slate-100"
                                                placeholder="e.g. First Floor"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={() => createRoomMutation.mutate()}
                                            disabled={createRoomMutation.isPending || !newRoomName}
                                            className="bg-amber-600 hover:bg-amber-700"
                                        >
                                            {createRoomMutation.isPending && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Create Room
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-slate-400">Total Contract Value</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    £{grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toggle & Cost Breakdown Summary */}
            <div className="max-w-7xl mx-auto pt-6 px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <button
                            onClick={() => setViewMode('ALL')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'ALL'
                                ? 'bg-slate-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            All Items
                        </button>
                        <button
                            onClick={() => setViewMode('LABOUR')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'LABOUR'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Labour Only
                        </button>
                    </div>
                    {viewMode === 'LABOUR' && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/50 px-3 py-1">
                            Viewing Labour Tender Scope
                        </Badge>
                    )}
                </div>

                {/* Summary Cards - Dynamic based on View */}
                {data.costBreakdown && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Labour - Always Show */}
                        <div className={`border rounded-xl p-4 ${viewMode === 'LABOUR' ? 'bg-amber-900/20 border-amber-500/50 ring-1 ring-amber-500/30' : 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${viewMode === 'LABOUR' ? 'text-amber-400' : 'text-blue-400'}`}>Labour Total</span>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${viewMode === 'LABOUR' ? 'bg-amber-500/20' : 'bg-blue-600/30'}`}>
                                    <User className={`h-4 w-4 ${viewMode === 'LABOUR' ? 'text-amber-400' : 'text-blue-400'}`} />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-white">
                                {viewMode === 'LABOUR'
                                    ? `£${grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                                    : `£${data.costBreakdown.labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                                }
                            </p>
                            {viewMode === 'LABOUR' && <p className="text-xs text-amber-500/70 mt-1">Total Labour Scope</p>}
                        </div>

                        {/* Material - Hide if Labour Only */}
                        {viewMode === 'ALL' && (
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
                        )}

                        {/* Plant - Hide if Labour Only */}
                        {viewMode === 'ALL' && (
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
                        )}

                        {/* Total - Context Aware */}
                        <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border border-amber-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-amber-400 text-sm font-medium">{viewMode === 'LABOUR' ? 'Visible Total' : 'Total Project Cost'}</span>
                                <div className="w-8 h-8 bg-amber-600/30 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-amber-400">
                                £{grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Room Cards */}
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div className="space-y-4">
                    {processedRooms.length === 0 ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                            <Home className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-400 mb-2">No Rooms Generated</h3>
                            <p className="text-sm text-slate-500">
                                Import a CSV to automatically generate Room Work Packages from HBXL phases.
                            </p>
                        </div>
                    ) : (
                        processedRooms.map(room => (
                            <RoomCard key={room.id} room={room} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function RoomCard({ room }: { room: RoomData }) {
    const [isOpen, setIsOpen] = useState(false);

    // Dynamic status color
    const statusColor = room.status === 'complete' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
        room.status === 'in_progress' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
            'text-slate-500 border-slate-700 bg-slate-800';

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md hover:border-slate-600">
            {/* Header Trigger */}
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-4">
                    <div className={`p-1 rounded transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-slate-100 text-lg tracking-tight">{room.name}</h3>
                            {room.floor && (
                                <Badge variant="secondary" className="bg-slate-700 text-slate-400 text-[10px] h-5">
                                    {room.floor}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{room.elements.length} elements</span>
                            <span className="text-slate-700 mx-1">•</span>
                            <span className="text-xs text-slate-500">
                                {room.elements.reduce((acc, el) => acc + el.items.length, 0)} items
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <Badge variant="outline" className={`${statusColor} capitalize`}>
                        {room.status.replace('_', ' ')}
                    </Badge>
                    <div className="text-right min-w-[100px]">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Value</p>
                        <p className="font-mono text-amber-400 font-bold text-lg">
                            £{room.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <CollapsibleContent>
                <div className="px-4 pb-4 pt-0 space-y-3">
                    <div className="h-px bg-slate-700/50 mb-4" />
                    {room.elements.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-slate-700/50 rounded-lg">
                            <p className="text-slate-500 text-sm">No elements have been identified for this room yet.</p>
                        </div>
                    ) : (
                        room.elements.map(el => <ElementRow key={el.id} element={el} />)
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

function ElementRow({ element }: { element: ElementData }) {
    return (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-slate-200 font-medium text-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                    {element.name}
                </h4>
                <div className="flex items-center gap-4">
                    {element.measurementSummary && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {element.measurementSummary}
                        </span>
                    )}
                    <span className="text-slate-400 text-sm font-mono font-medium">
                        £{element.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            <div className="space-y-1 bg-slate-950/30 rounded px-3 py-2">
                {element.items.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No payable items linked</p>
                ) : (
                    element.items.map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 text-xs text-slate-400 py-1.5 border-b border-slate-800/50 last:border-0 hover:text-slate-300">
                            <span className="truncate pr-4">{item.description}</span>
                            <div className="flex items-center gap-3 text-slate-500">
                                <span className="font-mono">{item.quantity} {item.unit}</span>
                                <span className="text-slate-600">x</span>
                                <span className="font-mono">£{item.rate}</span>
                            </div>
                            <span className="font-mono text-slate-300 w-[70px] text-right">
                                £{item.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
