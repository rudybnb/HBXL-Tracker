import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, User, Phone, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ContractorIdCapture() {
  const [contractorName, setContractorName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  // Known contractor Telegram IDs and login credentials
  const knownContractors = [
    { name: "Marius Andronache", telegramId: "8006717361", username: "marius", password: "marius123", status: "Active" },
    { name: "Dalwayne Diedericks", telegramId: "8016744652", username: "dalwayne", password: "dalwayne123", status: "Active" },
    { name: "Earl", telegramId: "6792554033", username: "earl", password: "earl123", status: "Active" },
    { name: "Muhammed", telegramId: "5209713845", username: "muhammed", password: "muhammed123", status: "Active" }
  ];

  const handleCopyTelegramId = (telegramId: string, name: string) => {
    navigator.clipboard.writeText(telegramId);
    toast({
      title: "Telegram ID Copied",
      description: `${name}'s Telegram ID: ${telegramId}`
    });
  };

  const handleCopyCredentials = (username: string, password: string, name: string) => {
    const credentials = `Username: ${username}\nPassword: ${password}`;
    navigator.clipboard.writeText(credentials);
    toast({
      title: "Login Credentials Copied",
      description: `${name}'s login credentials copied to clipboard`
    });
  };

  const handleCopyFormMessage = () => {
    const formMessage = `🔨 ERdesignandbuild Contractor Application

Hi ${contractorName || '[Contractor Name]'},

Please complete your contractor application form by providing:

📋 **Required Information:**
• Personal details (Name, Email, Phone, Address)
• Right to work documentation
• CIS registration status
• Banking information
• Emergency contact
• Trade specializations and experience

Reply with your completed information or visit our application portal.

Best regards,
ERdesignandbuild Team`;

    navigator.clipboard.writeText(formMessage);
    toast({
      title: "Form Message Copied",
      description: "Send this message to the contractor on Telegram"
    });
  };

  const handleSaveContractor = () => {
    if (!contractorName || !phoneNumber || !username || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter contractor name, phone number, username, and password",
        variant: "destructive"
      });
      return;
    }

    // Save contractor details to localStorage for now
    const contractorData = {
      name: contractorName,
      phone: phoneNumber,
      telegramId: telegramId || 'Not provided',
      username: username,
      password: password,
      dateAdded: new Date().toISOString(),
      status: 'pending_application'
    };

    const existingContractors = JSON.parse(localStorage.getItem('contractor_contacts') || '[]');
    existingContractors.push(contractorData);
    localStorage.setItem('contractor_contacts', JSON.stringify(existingContractors));

    toast({
      title: "Contractor Added",
      description: `${contractorName} has been added with login credentials`
    });

    // Clear form
    setContractorName("");
    setPhoneNumber("");
    setTelegramId("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <User className="h-8 w-8 text-yellow-600 mr-3" />
          <h1 className="text-2xl font-bold">Contractor ID Capture</h1>
        </div>

        {/* Current Contractor Telegram IDs */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              📱 Current Contractor Telegram IDs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {knownContractors.map((contractor, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                      <span className="text-black font-bold text-xs">
                        {contractor.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-white">{contractor.name}</div>
                      <div className="text-sm text-slate-400">ID: {contractor.telegramId}</div>
                      <div className="text-xs text-slate-500">
                        Username: {contractor.username} | Password: {contractor.password}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
                      {contractor.status}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleCopyTelegramId(contractor.telegramId, contractor.name)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-black"
                      data-testid={`copy-telegram-${contractor.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCopyCredentials(contractor.username, contractor.password, contractor.name)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid={`copy-credentials-${contractor.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <User className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-yellow-600">Add New Contractor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Contractor Name</label>
              <Input
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                placeholder="Enter contractor's full name"
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 07534251548"
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Telegram ID (Optional)
                <span className="text-slate-400 text-xs ml-2">Get this from the contractor</span>
              </label>
              <Input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="e.g., @username or user ID number"
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Login Username
                <span className="text-slate-400 text-xs ml-2">For contractor portal access</span>
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., john.smith"
                className="bg-slate-700 border-slate-600"
                data-testid="input-username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Login Password
                <span className="text-slate-400 text-xs ml-2">For contractor portal access</span>
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secure password"
                className="bg-slate-700 border-slate-600"
                data-testid="input-password"
              />
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleSaveContractor}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black"
              >
                <User className="h-4 w-4 mr-2" />
                Save Contractor
              </Button>
              
              <Button 
                onClick={handleCopyFormMessage}
                variant="outline"
                className="flex-1 border-slate-600 hover:bg-slate-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Form Message
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              How to Get Telegram ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="bg-slate-700 p-3 rounded">
                <h4 className="font-medium text-white mb-2">Method 1: Ask the Contractor</h4>
                <p>Ask them to search for "@userinfobot" on Telegram and send /start. The bot will reply with their user ID.</p>
              </div>
              
              <div className="bg-slate-700 p-3 rounded">
                <h4 className="font-medium text-white mb-2">Method 2: Username Method</h4>
                <p>If they have a username (like @john_contractor), you can use that instead of the numeric ID.</p>
              </div>
              
              <div className="bg-slate-700 p-3 rounded">
                <h4 className="font-medium text-white mb-2">Method 3: Phone Contact</h4>
                <p>Start with their phone number for initial contact, then get Telegram ID for future automated messages.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}