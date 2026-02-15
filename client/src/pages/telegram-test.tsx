import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function TelegramTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState('');
  const [testMessage, setTestMessage] = useState('🔨 Test message from ERdesignandbuild!\n\nThis is a test to verify Telegram integration is working correctly.');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const { toast } = useToast();

  const testBotConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/telegram/test');
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Bot Connection Success',
          description: `Bot Name: ${result.botInfo.first_name} (@${result.botInfo.username})`,
        });
      } else {
        toast({
          title: 'Bot Connection Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test bot connection',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/send-telegram-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: 'Test User',
          phone: '07534251548',
          hbxlJob: 'Test Job - Renovation',
          buildPhases: ['Kitchen Fitout', 'Bathroom Installation'],
          workLocation: 'Test Location',
          startDate: '06/08/2025'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Notification Sent',
          description: result.message + (result.details.simulated ? ' (Simulated)' : ''),
        });
      } else {
        toast({
          title: 'Notification Failed',
          description: result.message || 'Failed to send notification',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendCustomMessage = async () => {
    if (!chatId) {
      toast({
        title: 'Chat ID Required',
        description: 'Please enter your Chat ID first',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/telegram/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId,
          message: testMessage
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Message Sent Successfully!',
          description: 'Check your Telegram for the message',
        });
      } else {
        toast({
          title: 'Message Failed',
          description: result.error || 'Failed to send message',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send custom message',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkRecentMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/telegram/messages');
      const result = await response.json();
      
      if (result.success) {
        setRecentMessages(result.messages || []);
        toast({
          title: 'Messages Retrieved',
          description: `Found ${result.messages?.length || 0} recent messages`,
        });
      } else {
        toast({
          title: 'Failed to Get Messages',
          description: result.error || 'Could not retrieve messages',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to check messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-yellow-400">Telegram Bot Test</h1>
          <p className="text-slate-300">Test your Telegram bot integration</p>
        </div>

        {/* Bot Info Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">Bot Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-slate-300">Bot Token</Label>
                <p className="text-slate-400 font-mono">8382710567:AAF...6iEA</p>
              </div>
              <div>
                <Label className="text-slate-300">Bot ID</Label>
                <p className="text-slate-400 font-mono">8382710567</p>
              </div>
            </div>
            
            <Button 
              onClick={testBotConnection}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isLoading ? 'Testing...' : 'Test Bot Connection'}
            </Button>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-slate-300">
              <p><strong>To receive test messages:</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Open Telegram and search for your bot ID: <code className="bg-slate-700 px-2 py-1 rounded">8382710567</code></li>
                <li>Start a chat with the bot by clicking "Start" or sending <code className="bg-slate-700 px-2 py-1 rounded">/start</code></li>
                <li>Get your Chat ID by messaging the bot and checking the logs</li>
                <li>Update the chat ID in <code className="bg-slate-700 px-2 py-1 rounded">server/telegram.ts</code></li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Test Notification */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">Test Job Assignment Notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">Send a test job assignment notification:</p>
            
            <Button 
              onClick={sendTestNotification}
              disabled={isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLoading ? 'Sending...' : 'Send Test Job Assignment'}
            </Button>
          </CardContent>
        </Card>

        {/* Chat ID Setup */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">Manual Message Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="chatId" className="text-slate-300">Your Chat ID</Label>
                <Input
                  id="chatId"
                  placeholder="e.g., 123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <p className="text-sm text-slate-400 mt-1">
                  Get this by messaging @userinfobot in Telegram
                </p>
              </div>
              
              <div>
                <Label htmlFor="message" className="text-slate-300">Test Message</Label>
                <Textarea
                  id="message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={4}
                />
              </div>
              
              <Button 
                onClick={sendCustomMessage}
                disabled={!chatId || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? 'Sending...' : 'Send Custom Message'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Check Messages */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">Check Recent Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">Check if you've sent any messages to the bot:</p>
            
            <Button 
              onClick={checkRecentMessages}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? 'Checking...' : 'Check Messages'}
            </Button>

            {recentMessages.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-yellow-400 font-semibold">Recent Messages:</h4>
                {recentMessages.map((msg, index) => (
                  <div key={index} className="bg-slate-700 p-3 rounded border">
                    <p className="text-slate-300">{msg.text}</p>
                    <div className="text-xs text-slate-400 mt-1">
                      From: {msg.from?.first_name} ({msg.chatId}) • {new Date(msg.date).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}