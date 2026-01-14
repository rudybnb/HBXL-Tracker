import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TelegramMessage {
  messageId: number;
  from: {
    first_name: string;
    username?: string;
    id: number;
  };
  text: string;
  date: string;
  chatId: number;
}

export default function TelegramMessages() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRecentMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/recent-messages?limit=20');
      const result = await response.json();
      
      if (result.success) {
        setMessages(result.messages || []);
        toast({
          title: "Messages Updated",
          description: `Found ${result.relevantCount} relevant messages from ${result.totalChecked} total`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch messages",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendOnboardingForm = async (contractorName: string) => {
    try {
      const response = await fetch('/api/send-onboarding-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName,
          contractorPhone: 'unknown'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Onboarding Sent",
          description: `Sent onboarding form to ${contractorName}`,
        });
      } else {
        toast({
          title: "Send Failed",
          description: result.error || "Failed to send onboarding form",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send onboarding form",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRecentMessages();
  }, []);

  return (
    <div className="min-h-screen bg-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Telegram Messages</h1>
            <p className="text-slate-400">Recent contractor communications</p>
          </div>
          <Button onClick={fetchRecentMessages} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {messages.length === 0 ? (
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Recent Messages</h3>
              <p className="text-slate-400">
                {loading ? "Loading messages..." : "No relevant messages found from contractors"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <Card key={`${message.messageId}-${index}`} className="bg-slate-700 border-slate-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">
                      {message.from.first_name}
                      {message.from.username && (
                        <span className="text-slate-400 font-normal ml-2">@{message.from.username}</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        {new Date(message.date).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => sendOnboardingForm(message.from.first_name)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Send Form
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="text-white">{message.text}</p>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Chat ID: {message.chatId} | Message ID: {message.messageId}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}