import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, User, Phone, Hash, Calendar } from "lucide-react";

export default function TelegramMonitor() {
  const [contractorName, setContractorName] = useState("David Wilson");
  const [contractorPhone, setContractorPhone] = useState("07934567890");
  const { toast } = useToast();

  // Send onboarding form mutation
  const sendOnboardingFormMutation = useMutation({
    mutationFn: async (data: { contractorName: string; contractorPhone?: string }) => {
      const response = await apiRequest("POST", "/api/send-onboarding-form", data);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "✅ Onboarding Form Sent",
          description: `Generated ID: ${result.contractorId}`,
          duration: 8000,
        });
      } else {
        toast({
          title: "⚠️ Form Send Failed", 
          description: result.error || "Failed to send onboarding form",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-yellow-400">📱 Telegram ID System Demo</h1>
          <p className="text-slate-300">See how contractor Telegram IDs work in real-time</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manual Form Sending */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Send Onboarding Form
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Contractor Name</Label>
                <Input
                  id="name"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone (Optional)</Label>
                <Input
                  id="phone"
                  value={contractorPhone}
                  onChange={(e) => setContractorPhone(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <Button
                onClick={() => sendOnboardingFormMutation.mutate({ contractorName, contractorPhone })}
                disabled={sendOnboardingFormMutation.isPending || !contractorName}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {sendOnboardingFormMutation.isPending ? "Sending..." : "📋 Generate ID & Send Form"}
              </Button>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <Hash className="w-5 h-5" />
                How Telegram IDs Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-300">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium text-white">Contractor sends message</p>
                    <p className="text-sm text-slate-400">Any message like "Hello", "Ready to work", etc.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-green-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium text-white">System captures Telegram ID</p>
                    <p className="text-sm text-slate-400">Each Telegram user has a unique number ID</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium text-white">Generate contractor ID</p>
                    <p className="text-sm text-slate-400">Creates unique ID like CTR-1754661318-ABC12</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-purple-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium text-white">Send onboarding form</p>
                    <p className="text-sm text-slate-400">Automatically sends form back to same Telegram ID</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Example Telegram IDs */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">📋 Example Telegram IDs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-white">Admin (Rudy)</span>
                </div>
                <p className="text-yellow-400 font-mono">ID: 7617462316</p>
                <p className="text-sm text-slate-400">Receives notifications</p>
              </div>
              
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-white">Contractor</span>
                </div>
                <p className="text-yellow-400 font-mono">ID: [Auto-detected]</p>
                <p className="text-sm text-slate-400">When they send message</p>
              </div>
              
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-white">Generated ID</span>
                </div>
                <p className="text-yellow-400 font-mono">CTR-{Date.now()}-ABC12</p>
                <p className="text-sm text-slate-400">Unique contractor identifier</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}