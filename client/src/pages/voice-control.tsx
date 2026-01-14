import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function VoiceControl() {
  const [selectedContractor, setSelectedContractor] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [callType, setCallType] = useState('normal');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const { toast } = useToast();

  // Admin role check
  const userRole = localStorage.getItem('userRole');
  const adminName = localStorage.getItem('adminName');
  
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-2">Access Denied</div>
          <div className="text-slate-400">Voice control is only available to administrators</div>
        </div>
      </div>
    );
  }

  const contractors = [
    { name: 'Dalwayne Diedericks', phone: '+447123456789' },
    { name: 'Mohamed guizeni', phone: '+447123456790' },
    { name: 'SAID tiss', phone: '+447123456791' },
    { name: 'Marius Andronache', phone: '+447123456792' }
  ];

  const handleContractorSelect = (contractorName: string) => {
    setSelectedContractor(contractorName);
    const contractor = contractors.find(c => c.name === contractorName);
    if (contractor) {
      setPhoneNumber(contractor.phone);
    }
  };

  const quickMessages = [
    {
      title: 'Site Assignment',
      message: 'You have been assigned to a new job site. Please report to {location} by {time}. Contact the office if you have any questions.'
    },
    {
      title: 'Emergency Alert',
      message: 'URGENT: Please evacuate the site immediately due to safety concerns. Report to the assembly point and await further instructions.'
    },
    {
      title: 'Schedule Change',
      message: 'Your work schedule has been updated. Please check your assignment details for the new timing and location.'
    },
    {
      title: 'Equipment Reminder',
      message: 'Reminder: Please bring your safety equipment and tools to the job site tomorrow. Contact supervisor if you need any equipment.'
    }
  ];

  const handleVoiceCall = async () => {
    if (!selectedContractor || !phoneNumber || !message) {
      toast({
        title: 'Missing Information',
        description: 'Please select a contractor, phone number, and message.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/voice/call-contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: selectedContractor,
          phoneNumber,
          message,
          type: callType
        })
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.success) {
        toast({
          title: 'Call Initiated',
          description: `Voice call successfully sent to ${selectedContractor}`,
        });
      } else {
        toast({
          title: 'Call Failed',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Voice call error:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate voice call',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobAssignment = async () => {
    if (!selectedContractor) {
      toast({
        title: 'Missing Information',
        description: 'Please select a contractor.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const jobDetails = {
        title: 'Promise Bram Construction',
        location: 'Bramling, CT15 7PG',
        startDate: new Date().toISOString()
      };

      const response = await fetch('/api/voice/notify-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: selectedContractor,
          jobDetails
        })
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.success) {
        toast({
          title: 'Assignment Notification Sent',
          description: `Job assignment call sent to ${selectedContractor}`,
        });
      } else {
        toast({
          title: 'Notification Failed',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Assignment notification error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send assignment notification',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testClockAction = async (action: 'in' | 'out') => {
    if (!selectedContractor) {
      toast({
        title: 'Missing Information',
        description: 'Please select a contractor.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/voice/clock-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: selectedContractor,
          action,
          location: 'Bramling, CT15 7PG'
        })
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.success) {
        toast({
          title: `Clock ${action.toUpperCase()} Successful`,
          description: result.message,
        });
      } else {
        toast({
          title: `Clock ${action.toUpperCase()} Failed`,
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Clock action error:', error);
      toast({
        title: 'Error',
        description: `Failed to process clock ${action}`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <i className="fas fa-microphone text-white"></i>
          </div>
          <div>
            <div className="text-sm font-medium">Voice Agent Control</div>
            <div className="text-xs text-slate-400">Twilio Voice Integration</div>
          </div>
        </div>
        <Badge variant="default" className="bg-green-600">
          Admin: {adminName}
        </Badge>
      </div>

      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold text-green-400 mb-6">Voice Agent Dashboard</h1>

        {/* Contractor Selection */}
        <Card className="bg-slate-800 border-slate-600 mb-6">
          <CardHeader>
            <CardTitle className="text-green-400">Select Contractor</CardTitle>
            <CardDescription>Choose contractor for voice interaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contractor">Contractor</Label>
              <Select value={selectedContractor} onValueChange={handleContractorSelect}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select contractor..." />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map((contractor) => (
                    <SelectItem key={contractor.name} value={contractor.name}>
                      {contractor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+447123456789"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-phone"
              />
            </div>
          </CardContent>
        </Card>

        {/* Voice Message Controls */}
        <Card className="bg-slate-800 border-slate-600 mb-6">
          <CardHeader>
            <CardTitle className="text-green-400">Voice Message</CardTitle>
            <CardDescription>Send custom voice messages to contractors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message-type">Message Type</Label>
              <Select value={callType} onValueChange={setCallType}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal Call</SelectItem>
                  <SelectItem value="emergency">Emergency Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your voice message..."
                className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
                data-testid="input-message"
              />
            </div>

            <div className="space-y-2">
              <Label>Quick Messages</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {quickMessages.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage(template.message)}
                    className="text-left justify-start bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  >
                    {template.title}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleVoiceCall}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-send-voice"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Sending Call...
                </>
              ) : (
                <>
                  <i className="fas fa-phone mr-2"></i>
                  Send Voice Call
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-600">
            <CardHeader>
              <CardTitle className="text-blue-400">Job Assignment</CardTitle>
              <CardDescription>Send automated job assignment calls</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleJobAssignment}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-job-assignment"
              >
                <i className="fas fa-briefcase mr-2"></i>
                Send Job Assignment
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-600">
            <CardHeader>
              <CardTitle className="text-yellow-400">Clock Actions</CardTitle>
              <CardDescription>Test clock in/out functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => testClockAction('in')}
                disabled={isLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
                data-testid="button-clock-in"
              >
                <i className="fas fa-clock mr-2"></i>
                Test Clock In
              </Button>
              <Button
                onClick={() => testClockAction('out')}
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700"
                data-testid="button-clock-out"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Test Clock Out
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Response Display */}
        {lastResponse && (
          <Card className="bg-slate-800 border-slate-600">
            <CardHeader>
              <CardTitle className="text-purple-400">Last Response</CardTitle>
              <CardDescription>Voice agent response data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Badge variant={lastResponse.success ? "default" : "destructive"} className="mr-2">
                    {lastResponse.success ? "Success" : "Failed"}
                  </Badge>
                  <span className="text-sm text-slate-400">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-white mb-2">{lastResponse.message}</p>
                {lastResponse.data && (
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer">Response Data</summary>
                    <pre className="mt-2 overflow-x-auto">
                      {JSON.stringify(lastResponse.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-slate-800 border-slate-600 mt-6">
          <CardHeader>
            <CardTitle className="text-cyan-400">How Voice Agents Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start">
              <i className="fas fa-phone text-cyan-400 mr-3 mt-1"></i>
              <div>
                <strong>Incoming Calls:</strong> Contractors can call your Twilio number and use voice commands. 
                Press 1 for clock in, 2 for clock out, 3 for assignment info, 4 for earnings.
              </div>
            </div>
            <div className="flex items-start">
              <i className="fas fa-robot text-cyan-400 mr-3 mt-1"></i>
              <div>
                <strong>Data Access:</strong> Voice agents have full access to contractor data, work sessions, 
                pay rates, job assignments, and can execute tasks automatically.
              </div>
            </div>
            <div className="flex items-start">
              <i className="fas fa-microphone text-cyan-400 mr-3 mt-1"></i>
              <div>
                <strong>Outgoing Calls:</strong> Use this dashboard to send voice messages, job assignments, 
                and emergency alerts to contractors automatically.
              </div>
            </div>
            <div className="flex items-start">
              <i className="fas fa-database text-cyan-400 mr-3 mt-1"></i>
              <div>
                <strong>Real-time Updates:</strong> All voice actions update the database immediately, 
                including clock in/out times, assignment confirmations, and contractor responses.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}