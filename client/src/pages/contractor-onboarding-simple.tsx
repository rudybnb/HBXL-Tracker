import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle, XCircle, Clock } from "lucide-react";

function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('isLoggedIn');
    window.location.href = '/login';
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-slate-800 rounded-lg p-2 border border-slate-600 shadow-lg">
      <div className="flex items-center space-x-2">
        <span className="text-yellow-400 text-sm font-medium">Admin</span>
        <Button
          onClick={handleLogout}
          size="sm"
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function ContractorOnboarding() {
  const [activeTab, setActiveTab] = useState("Send Form");
  
  // Simple form to send invitation
  const [contractorName, setContractorName] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");
  const [telegramId, setTelegramId] = useState("");
  
  const [pendingApplications, setPendingApplications] = useState([
    {
      id: "1",
      name: "James Carpenter",
      phone: "07534251548",
      email: "james@gmail.com",
      specialization: ["Carpentry", "Flooring"],
      status: "pending",
      submittedDate: "06/08/2025",
      telegramId: "@james_contractor"
    },
    {
      id: "2", 
      name: "Sarah Mason",
      phone: "07845123456",
      email: "sarah.mason@email.com",
      specialization: ["Bricklaying", "Masonry"],
      status: "pending",
      submittedDate: "05/08/2025",
      telegramId: "@sarah_mason"
    }
  ]);
  
  const [reviewedApplications, setReviewedApplications] = useState([
    {
      id: "3",
      name: "Mike Electrician", 
      phone: "07567890123",
      email: "mike.elec@email.com",
      specialization: ["Electrical"],
      status: "approved",
      reviewedDate: "04/08/2025",
      telegramId: "@mike_electrical"
    }
  ]);

  const { toast } = useToast();

  const handleSendForm = async () => {
    if (!contractorName || !telegramId) {
      toast({
        title: "Missing Information",
        description: "Please provide contractor's name and Telegram ID",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate unique form link
      const formId = Math.random().toString(36).substr(2, 9);
      const formLink = `${window.location.origin}/contractor-form?id=${formId}&name=${encodeURIComponent(contractorName)}`;
      
      // Send Telegram message with link to professional onboarding form
      const telegramMessage = `📋 Contractor Onboarding - ER Build & Design

Hello ${contractorName}!

You've been invited to join our construction team. Please complete your contractor registration form:

🔗 Form Link: ${formLink}

📝 What you'll need:
• Personal details & contact information
• Passport photo and right to work documents
• CIS number and tax details
• CSCS card information (if available)
• Bank details for payments
• Emergency contact details
• Your primary trade and tool availability

⏱️ Please complete within 24 hours

❓ Need help? Reply to this message

📱 Complete Form`;

      // Send directly via Telegram API
      if (telegramId) {
        const response = await fetch('https://api.telegram.org/bot8382710567:AAFshEGUHA-3P-Jf_PuLIQjskb-1_fY6iEA/sendMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramId.startsWith('@') ? telegramId.slice(1) : telegramId,
            text: telegramMessage,
            parse_mode: 'HTML'
          }),
        });

        if (response.ok) {
          toast({
            title: "Onboarding Form Sent Successfully",
            description: `Professional registration form sent to ${contractorName} via Telegram with secure link.`,
          });
        } else {
          toast({
            title: "Form Link Prepared",
            description: `Professional form link ready for ${contractorName}. Send manually if needed.`,
          });
        }
      } else {
        toast({
          title: "Form Link Generated", 
          description: `Professional registration form link prepared for ${contractorName}. Share via any contact method.`,
        });
      }

      // Add to pending applications
      const newApplication = {
        id: Date.now().toString(),
        name: contractorName,
        phone: "To Be Provided",
        email: "To Be Provided",
        specialization: ["To Be Determined"],
        status: "invited" as const,
        submittedDate: new Date().toLocaleDateString('en-GB'),
        telegramId: telegramId
      };

      setPendingApplications(prev => [newApplication, ...prev]);

      // Reset form
      setContractorName("");
      setTelegramId("");

    } catch (error) {
      console.error('Error sending onboarding form:', error);
      toast({
        title: "Error",
        description: "Failed to send onboarding form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApproveApplication = (applicationId: string) => {
    const application = pendingApplications.find(app => app.id === applicationId);
    if (application) {
      setReviewedApplications(prev => [...prev, { ...application, status: "approved", reviewedDate: new Date().toLocaleDateString('en-GB') }]);
      setPendingApplications(prev => prev.filter(app => app.id !== applicationId));
      
      toast({
        title: "Application Approved",
        description: `${application.name} has been approved and added to the contractor network.`,
      });
    }
  };

  const handleRejectApplication = (applicationId: string) => {
    const application = pendingApplications.find(app => app.id === applicationId);
    if (application) {
      setPendingApplications(prev => prev.filter(app => app.id !== applicationId));
      
      toast({
        title: "Application Rejected",
        description: `${application.name}'s application has been rejected.`,
        variant: "destructive",
      });
    }
  };

  const renderSendFormTab = () => (
    <div className="space-y-4 pb-20">
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Send className="w-5 h-5 text-yellow-400" />
          <h3 className="text-yellow-400 text-lg font-medium">Send Contractor Form</h3>
        </div>
        <p className="text-slate-400 mb-4 text-sm">
          Send onboarding form to new contractors via Telegram
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-yellow-400 text-sm font-medium mb-2">Contractor Name *</label>
            <input
              type="text"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              placeholder="e.g. James Carpenter"
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none text-sm"
            />
          </div>
          
          <div>
            <label className="block text-yellow-400 text-sm font-medium mb-2">Telegram ID *</label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="@username or 1234567890"
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none text-sm"
            />
            <p className="text-slate-500 text-xs mt-1">Use @username or numeric ID</p>
          </div>

          <div className="bg-slate-700 border border-slate-600 rounded p-3 mt-4">
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 mt-0.5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-blue-400 text-sm font-medium">The contractor will receive a comprehensive form covering</p>
                <p className="text-slate-300 text-xs mt-1">personal details, right to work, CIS information, banking details, emergency contacts, and trade specialization.</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSendForm}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2.5 mt-4 text-sm"
          >
            Send Form
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPendingReviewTab = () => (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-yellow-400 text-lg font-medium">Applications Pending Review</h3>
        <Badge variant="secondary" className="bg-orange-600 text-white">
          {pendingApplications.length} Pending
        </Badge>
      </div>

      {pendingApplications.length === 0 ? (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h4 className="text-slate-300 text-lg mb-2">No Pending Applications</h4>
          <p className="text-slate-500">Applications will appear here when contractors submit their forms.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingApplications.map((application) => (
            <div key={application.id} className="bg-slate-800 border border-slate-600 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-white text-lg font-medium">{application.name}</h4>
                  <div className="text-slate-400 text-sm space-y-1">
                    <p>📧 {application.email}</p>
                    <p>📞 {application.phone}</p>
                    <p>📅 Submitted: {application.submittedDate}</p>
                    {application.telegramId && <p>💬 {application.telegramId}</p>}
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="bg-orange-600 text-white"
                >
                  {application.status}
                </Badge>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  onClick={() => handleApproveApplication(application.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve</span>
                </Button>
                <Button
                  onClick={() => handleRejectApplication(application.id)}
                  variant="destructive"
                  className="flex-1 flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderApprovedTab = () => (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-yellow-400 text-lg font-medium">Approved Contractors</h3>
        <Badge variant="secondary" className="bg-green-600 text-white">
          {reviewedApplications.length} Approved
        </Badge>
      </div>

      {reviewedApplications.length === 0 ? (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-8 text-center">
          <CheckCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h4 className="text-slate-300 text-lg mb-2">No Approved Contractors</h4>
          <p className="text-slate-500">Approved contractors will appear here after review.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reviewedApplications.map((contractor) => (
            <div key={contractor.id} className="bg-slate-800 border border-green-600 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-white text-lg font-medium">{contractor.name}</h4>
                  <div className="text-slate-400 text-sm space-y-1">
                    <p>📧 {contractor.email}</p>
                    <p>📞 {contractor.phone}</p>
                    <p>✅ Approved: {contractor.reviewedDate}</p>
                    {contractor.telegramId && <p>💬 {contractor.telegramId}</p>}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-600 text-white">
                  Approved
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {contractor.specialization.map((spec, index) => (
                  <Badge key={index} variant="outline" className="border-yellow-500 text-yellow-400">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
                <Button
                  onClick={() => handleRejectApplication(application.id)}
                  variant="destructive"
                  className="flex-1 flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderApprovedTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-yellow-400 text-lg font-medium">Approved Contractors</h3>
        <Badge variant="secondary" className="bg-green-600 text-white">
          {reviewedApplications.length} Approved
        </Badge>
      </div>

      {reviewedApplications.length === 0 ? (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-8 text-center">
          <CheckCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h4 className="text-slate-300 text-lg mb-2">No Approved Contractors</h4>
          <p className="text-slate-500">Approved contractors will appear here after review.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reviewedApplications.map((contractor) => (
            <div key={contractor.id} className="bg-slate-800 border border-green-600 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-white text-lg font-medium">{contractor.name}</h4>
                  <div className="text-slate-400 text-sm space-y-1">
                    <p>📧 {contractor.email}</p>
                    <p>📞 {contractor.phone}</p>
                    <p>✅ Approved: {contractor.reviewedDate}</p>
                    {contractor.telegramId && <p>💬 {contractor.telegramId}</p>}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-600 text-white">
                  Approved
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {contractor.specialization.map((spec, index) => (
                  <Badge key={index} variant="outline" className="border-yellow-500 text-yellow-400">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white relative">
      <LogoutButton />
      
      {/* Header */}
      <div className="bg-orange-600 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center space-x-3">
          <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm">Pro</span>
          </div>
          <div>
            <h1 className="text-lg font-medium">Simple Time Tracking</h1>
          </div>
          <div className="ml-auto">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs ml-1">Online</span>
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div className="bg-slate-900 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400 text-sm">Send forms and manage contractor applications</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-900 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-6 border-b border-slate-700">
            {[
              { key: "Send Form", label: "Send Form" },
              { key: "Pending Review", label: "Pending Review" },
              { key: "Approved", label: "Reviewed" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-1 text-sm font-medium border-b-2 ${
                  activeTab === tab.key
                    ? "border-yellow-500 text-yellow-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {activeTab === "Send Form" && renderSendFormTab()}
        {activeTab === "Pending Review" && renderPendingReviewTab()}
        {activeTab === "Approved" && renderApprovedTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="flex justify-around py-2">
          <a href="/" className="flex flex-col items-center py-2 px-4">
            <div className="w-6 h-6 mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400">Dashboard</span>
          </a>
          <a href="/jobs" className="flex flex-col items-center py-2 px-4">
            <div className="w-6 h-6 mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400">Jobs</span>
          </a>
          <a href="/admin" className="flex flex-col items-center py-2 px-4">
            <div className="w-6 h-6 mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className="text-xs text-yellow-400">Admin</span>
          </a>
          <a href="/upload-job" className="flex flex-col items-center py-2 px-4">
            <div className="w-6 h-6 mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400">Upload Job</span>
          </a>
        </div>
      </div>
    </div>
  );
}