import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, User, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PendingInspection {
  id: string;
  assignmentId: string;
  contractorName: string;
  notificationType: string;
  jobTitle: string;
  jobLocation: string;
  createdAt: string;
  inspectionType: string;
}

export default function AdminInspections() {
  const { toast } = useToast();

  const { data: pendingInspections = [], isLoading } = useQuery<PendingInspection[]>({
    queryKey: ["/api/pending-inspections"],
  });

  const completeInspectionMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/complete-inspection/${notificationId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to complete inspection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-inspections"] });
      toast({
        title: "Inspection Completed",
        description: "The inspection has been marked as completed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete inspection",
        variant: "destructive",
      });
    },
  });

  const getBadgeColor = (notificationType: string) => {
    return notificationType === "50_percent_ready" ? "bg-yellow-500" : "bg-green-500";
  };

  const getIcon = (notificationType: string) => {
    return notificationType === "50_percent_ready" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <CheckCircle className="h-4 w-4" />
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-800 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-amber-400 mb-6">Admin Inspections</h1>
          <div className="text-slate-300">Loading pending inspections...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-400 mb-2">Admin Inspections</h1>
          <p className="text-slate-300">
            Monitor job progress and complete required site inspections at 50% and 100% milestones
          </p>
        </div>

        {pendingInspections.length === 0 ? (
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                No Pending Inspections
              </h3>
              <p className="text-slate-400">
                All current jobs are either below 50% completion or have completed their required inspections.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingInspections.map((inspection) => (
              <Card key={inspection.id} className="bg-slate-700 border-slate-600">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getIcon(inspection.notificationType)}
                      <div>
                        <CardTitle className="text-slate-200 text-lg">
                          {inspection.inspectionType}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          Job: {inspection.jobTitle}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      className={`${getBadgeColor(inspection.notificationType)} text-white`}
                    >
                      {inspection.notificationType.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="h-4 w-4 text-amber-400" />
                      <span>Contractor: {inspection.contractorName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="h-4 w-4 text-amber-400" />
                      <span>Location: {inspection.jobLocation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CalendarDays className="h-4 w-4 text-amber-400" />
                      <span>Triggered: {new Date(inspection.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-3">
                    <Button
                      onClick={() => completeInspectionMutation.mutate(inspection.id)}
                      disabled={completeInspectionMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {completeInspectionMutation.isPending ? "Completing..." : "Mark Inspection Complete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-700 rounded-lg border border-slate-600">
          <h3 className="text-lg font-semibold text-amber-400 mb-2">How It Works</h3>
          <ul className="text-slate-300 space-y-1 text-sm">
            <li>• <strong>50% Inspection:</strong> Triggered automatically when job reaches 50% completion</li>
            <li>• <strong>100% Inspection:</strong> Triggered when job is marked as fully complete</li>
            <li>• Click "Mark Inspection Complete" to confirm the inspection has been done</li>
            <li>• Use other admin tools for detailed site reports and quality assessments</li>
          </ul>
        </div>
      </div>
    </div>
  );
}