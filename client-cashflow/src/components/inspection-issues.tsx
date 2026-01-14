import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, MessageCircle, Camera, CheckCircle, Clock, Wrench } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskInspectionResult {
  id: string;
  assignmentId: string;
  contractorName: string;
  taskId: string;
  phase: string;
  taskName: string;
  inspectionStatus: 'approved' | 'issues' | 'pending';
  notes: string | null;
  photos: string[] | null;
  inspectedBy: string;
  inspectedAt: string;
  contractorViewed: boolean;
  contractorViewedAt: string | null;
}

interface InspectionIssuesProps {
  contractorName: string;
}

export function InspectionIssues({ contractorName }: InspectionIssuesProps) {
  const [showAll, setShowAll] = useState(false);
  const [fixNotes, setFixNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inspectionResults = [], isLoading } = useQuery<TaskInspectionResult[]>({
    queryKey: [`/api/task-inspection-results/${contractorName}`],
    enabled: !!contractorName,
  });

  const markDoneMutation = useMutation({
    mutationFn: async ({ inspectionId, notes }: { inspectionId: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/task-inspection-results/${inspectionId}/mark-done`, {
        contractorName,
        fixNotes: notes
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/task-inspection-results/${contractorName}`] });
      toast({
        title: "Issue Marked as Resolved",
        description: "Issue has been marked as fixed. Waiting for admin approval.",
      });
      setFixNotes({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark issue as resolved",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-slate-600 bg-slate-700/50">
        <CardHeader>
          <CardTitle className="text-amber-500 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Task Inspections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">Loading inspection results...</div>
        </CardContent>
      </Card>
    );
  }

  if (inspectionResults.length === 0) {
    return (
      <Card className="border-slate-600 bg-slate-700/50">
        <CardHeader>
          <CardTitle className="text-amber-500 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Task Inspections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">No inspection results yet.</div>
        </CardContent>
      </Card>
    );
  }

  // Filter results based on showAll
  const filteredResults = showAll 
    ? inspectionResults 
    : inspectionResults.filter(result => result.inspectionStatus === 'issues');

  const issuesCount = inspectionResults.filter(r => r.inspectionStatus === 'issues').length;
  const approvedCount = inspectionResults.filter(r => r.inspectionStatus === 'approved').length;
  const pendingCount = inspectionResults.filter(r => r.inspectionStatus === 'pending').length;

  return (
    <Card className="border-slate-600 bg-slate-700/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-amber-500 flex items-center gap-2">
            {issuesCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Task Inspections
          </CardTitle>
          
          <div className="flex flex-wrap gap-2">
            {issuesCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {issuesCount} Issues
              </Badge>
            )}
            {approvedCount > 0 && (
              <Badge variant="default" className="bg-green-600 text-xs">
                {approvedCount} Approved
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} Pending
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Toggle Button */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={!showAll ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAll(false)}
            className="text-xs"
          >
            Issues Only ({issuesCount})
          </Button>
          <Button
            variant={showAll ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-xs"
          >
            All Results ({inspectionResults.length})
          </Button>
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            {showAll ? "No inspection results yet." : "No issues found. Great work!"}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((result) => (
              <div
                key={result.id}
                className={`p-4 rounded-lg border ${
                  result.inspectionStatus === 'issues'
                    ? 'border-red-500/30 bg-red-900/20'
                    : result.inspectionStatus === 'approved'
                    ? 'border-green-500/30 bg-green-900/20'
                    : 'border-amber-500/30 bg-amber-900/20'
                }`}
              >
                {/* Task Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <div>
                    <h4 className="font-medium text-slate-200 text-sm">
                      {result.taskName}
                    </h4>
                    <div className="text-xs text-slate-400 mt-1">
                      <span className="inline-block mr-3">{result.phase}</span>
                      <span>Inspected by {result.inspectedBy}</span>
                    </div>
                  </div>
                  
                  <Badge
                    variant={
                      result.inspectionStatus === 'issues'
                        ? 'destructive'
                        : result.inspectionStatus === 'approved'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {result.inspectionStatus === 'issues' ? 'Needs Attention' 
                     : result.inspectionStatus === 'approved' ? 'Approved' 
                     : 'Pending Review'}
                  </Badge>
                </div>

                {/* Inspector Notes */}
                {result.notes && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-400">Inspector Notes:</span>
                    </div>
                    <div className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded border border-slate-600">
                      {result.notes}
                    </div>
                  </div>
                )}

                {/* Photos */}
                {result.photos && result.photos.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        Photos ({result.photos.length}):
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {result.photos.map((photo, index) => (
                        <div
                          key={index}
                          className="aspect-square bg-slate-800 rounded border border-slate-600 overflow-hidden"
                        >
                          <img
                            src={photo}
                            alt={`Inspection photo ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(photo, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contractor Actions - Only show for issues */}
                {result.inspectionStatus === 'issues' && (
                  <div className="mt-4 p-3 bg-slate-800/70 rounded-lg border border-slate-600">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-200">Mark as Fixed</span>
                    </div>
                    
                    <Textarea
                      placeholder="Describe what you did to fix this issue (optional)"
                      value={fixNotes[result.id] || ''}
                      onChange={(e) => setFixNotes(prev => ({ ...prev, [result.id]: e.target.value }))}
                      className="mb-3 bg-slate-700 border-slate-600 text-slate-200 text-sm"
                      rows={2}
                    />
                    
                    <Button
                      onClick={() => markDoneMutation.mutate({ 
                        inspectionId: result.id, 
                        notes: fixNotes[result.id] || '' 
                      })}
                      disabled={markDoneMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      {markDoneMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Marking as Done...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Done
                        </>
                      )}
                    </Button>
                    
                    <div className="text-xs text-slate-400 mt-2 text-center">
                      This will notify the admin for re-approval
                    </div>
                  </div>
                )}

                {/* Inspection Date */}
                <div className="text-xs text-slate-500 mt-2">
                  Inspected: {new Date(result.inspectedAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}