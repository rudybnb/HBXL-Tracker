import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ContextualTooltip from "@/components/contextual-tooltip";
import { useWorkflowHelp, WORKFLOW_CONFIGS } from "@/hooks/use-workflow-help";

function LogoutButton() {
  const handleLogout = () => {
    // Clear all localStorage data
    localStorage.clear();
    // Force page reload to ensure clean state
    window.location.href = '/login';
    window.location.reload();
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

  const tradeOptions = [
    "Carpenter", "Electrician", "Plumber", "Bricklayer", "Roofer", 
    "Plasterer", "Painter & Decorator", "Tiler", "Flooring Specialist", "HVAC Engineer", 
    "Landscaper", "Mason", "Glazier", "Kitchen Fitter", "Bathroom Fitter"
  ];

  const stepTitles = [
    "Personal Information",
    "Right to Work & Documentation", 
    "CIS & Tax Details",
    "Banking Information",
    "Emergency Contact",
    "Trade & Tools"
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(firstName && lastName && email && phoneNumber && fullAddress && city && postcode);
      case 2:
        return !!(hasRightToWork && passportNumber && utrNumber && cisRegistrationStatus && hasPublicLiability);
      case 3:
        return !!(cisVerificationStatus && cscsCardNumber && cscsExpiry);
      case 4:
        return !!(bankName && accountNumber && sortCode && accountHolderName);
      case 5:
        return !!(emergencyContactName && emergencyContactPhone && emergencyContactRelationship);
      case 6:
        return !!(primaryTrade && yearsExperience && hasOwnTools);
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    } else {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields before proceeding",
        variant: "destructive",
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPassportPhoto(file);
    }
  };

  const handleSendForm = async () => {
    if (!firstName || !lastName || !email || !phoneNumber) {
      toast({
        title: "Missing Information",
        description: "Please provide at least the contractor's name, email, and phone number",
        variant: "destructive",
      });
      return;
    }

    try {
      const contractorName = `${firstName} ${lastName}`;
      
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
            description: `Professional form link ready for ${contractorName}. Send manually if needed: ${formLink}`,
          });
        }
      } else {
        toast({
          title: "Form Link Generated", 
          description: `Professional registration form link prepared for ${contractorName}. Share via any contact method.`,
        });
      }

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
            description: `Complete 6-step form sent to ${contractorName} via Telegram. They can now fill it out and send back.`,
          });
        } else {
          toast({
            title: "Form Prepared",
            description: `Onboarding form ready for ${contractorName}. Send manually via other contact method if needed.`,
          });
        }
      } else {
        toast({
          title: "Form Prepared", 
          description: `Complete 6-step onboarding form prepared for ${contractorName}. Send via email or other contact method.`,
        });
      }

      // Add to pending applications
      const newApplication = {
        id: Date.now().toString(),
        name: contractorName,
        phone: phoneNumber,
        email: email,
        specialization: [primaryTrade],
        status: "invited" as const,
        submittedDate: new Date().toLocaleDateString('en-GB'),
        telegramId: telegramId
      };

      setPendingApplications(prev => [newApplication, ...prev]);

      // Reset form
      setCurrentStep(1);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneNumber("");
      setTelegramId("");
      setFullAddress("");
      setCity("");
      setPostcode("");
      setHasRightToWork("");
      setPassportNumber("");
      setPassportPhoto(null);
      setUtrNumber("");
      setCisRegistrationStatus("");
      setHasPublicLiability("");
      setCisVerificationStatus("");
      setCisNumber("");
      setCscsCardNumber("");
      setCscsExpiry("");
      setBankName("");
      setAccountNumber("");
      setSortCode("");
      setAccountHolderName("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setEmergencyContactRelationship("");
      setPrimaryTrade("");
      setYearsExperience("");
      setHasOwnTools("");
      setToolsList("");
      setAdditionalNotes("");

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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 1: Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="James"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Carpenter"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="james@gmail.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07534251548"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Telegram ID (Optional)</label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="@username or 7617462316"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
                <p className="text-slate-500 text-xs mt-1">For job notifications</p>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Full Address *</label>
                <input
                  type="text"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder="123 Main Street, London"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="London"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Postcode *</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="SW1A 1AA"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 2: Right to Work & Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Right to Work in UK *</label>
                <select
                  value={hasRightToWork}
                  onChange={(e) => setHasRightToWork(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select status</option>
                  <option value="yes">Yes - Confirmed</option>
                  <option value="no">No - Require sponsorship</option>
                </select>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Passport Number *</label>
                <input
                  type="text"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Passport Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-600 file:text-black hover:file:bg-yellow-700"
                />
                {passportPhoto && <p className="text-green-400 text-xs mt-1">File uploaded: {passportPhoto.name}</p>}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">UTR Number *</label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="1234567890"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CIS Registration Status *</label>
                <select
                  value={cisRegistrationStatus}
                  onChange={(e) => setCisRegistrationStatus(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select status</option>
                  <option value="registered">CIS Registered</option>
                  <option value="not-registered">Not CIS Registered</option>
                  <option value="pending">Registration Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Public Liability Insurance *</label>
                <select
                  value={hasPublicLiability}
                  onChange={(e) => setHasPublicLiability(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select status</option>
                  <option value="yes">Yes - Valid Insurance</option>
                  <option value="no">No - Need to Obtain</option>
                  <option value="pending">Application Pending</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 3: CIS & Tax Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CIS Verification Status *</label>
                <select
                  value={cisVerificationStatus}
                  onChange={(e) => setCisVerificationStatus(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select status</option>
                  <option value="gross">Gross Payment (0% deduction)</option>
                  <option value="net">Net Payment (20% deduction)</option>
                  <option value="unregistered">Unregistered (30% deduction)</option>
                </select>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CIS Number</label>
                <input
                  type="text"
                  value={cisNumber}
                  onChange={(e) => setCisNumber(e.target.value)}
                  placeholder="12/34567890"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
                <p className="text-slate-500 text-xs mt-1">Only if CIS registered</p>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CSCS Card Number *</label>
                <input
                  type="text"
                  value={cscsCardNumber}
                  onChange={(e) => setCscsCardNumber(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CSCS Card Expiry *</label>
                <input
                  type="date"
                  value={cscsExpiry}
                  onChange={(e) => setCscsExpiry(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 4: Banking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Bank Name *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Lloyds Bank"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Account Number *</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="12345678"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Sort Code *</label>
                <input
                  type="text"
                  value={sortCode}
                  onChange={(e) => setSortCode(e.target.value)}
                  placeholder="12-34-56"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Account Holder Name *</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="James Carpenter"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 5: Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Emergency Contact Name *</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Sarah Carpenter"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Emergency Contact Phone *</label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="07987654321"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Relationship *</label>
                <select
                  value={emergencyContactRelationship}
                  onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select relationship</option>
                  <option value="spouse">Spouse/Partner</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="child">Child</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2">Step 6: Trade & Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Primary Trade *</label>
                <select
                  value={primaryTrade}
                  onChange={(e) => setPrimaryTrade(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select primary trade</option>
                  {tradeOptions.map((trade) => (
                    <option key={trade} value={trade}>{trade}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Years of Experience *</label>
                <select
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select experience</option>
                  <option value="0-1">0-1 years (Apprentice)</option>
                  <option value="2-5">2-5 years (Junior)</option>
                  <option value="6-10">6-10 years (Experienced)</option>
                  <option value="11-15">11-15 years (Senior)</option>
                  <option value="16+">16+ years (Expert)</option>
                </select>
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Own Tools *</label>
                <select
                  value={hasOwnTools}
                  onChange={(e) => setHasOwnTools(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select availability</option>
                  <option value="yes">Yes - Full tool kit</option>
                  <option value="partial">Yes - Partial tools</option>
                  <option value="no">No - Need tools provided</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-yellow-400 text-sm font-medium mb-2">Tools List</label>
                <textarea
                  value={toolsList}
                  onChange={(e) => setToolsList(e.target.value)}
                  placeholder="List your available tools and equipment..."
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-yellow-400 text-sm font-medium mb-2">Additional Notes</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <LogoutButton />
      
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">Pro</span>
          </div>
          <div>
            <div className="text-sm font-medium">Pro</div>
            <div className="text-xs text-slate-400">Simple Time Tracking</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-500">Online</span>
          <i className="fas fa-sun text-yellow-400 ml-2"></i>
          <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center ml-4">
            <span className="text-white font-bold text-sm">RD</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-slate-400 text-lg">Contractor Onboarding Management</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-800 rounded-lg p-1">
          {["Send Form", "Pending Review", "Reviewed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-yellow-600 text-black'
                  : 'text-yellow-400 hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "Send Form" && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center mb-6">
              <i className="fas fa-paper-plane text-yellow-400 mr-3 text-xl"></i>
              <h2 className="text-xl font-semibold text-yellow-400">Send Onboarding Form to Contractor</h2>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <i className="fas fa-info-circle text-blue-400 mt-1"></i>
                <div className="text-blue-300 text-sm">
                  <p className="font-medium mb-1">How it works:</p>
                  <p>1. Fill in the contractor's basic details below</p>
                  <p>2. Click "Send Form" to send the complete 6-step onboarding form via Telegram</p>
                  <p>3. Contractor receives the form and fills it out in Telegram</p>
                  <p>4. Contractor replies with all their information</p>
                  <p>5. Review and approve their application in the "Pending Review" tab</p>
                </div>
              </div>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-8">
              {stepTitles.map((title, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > index + 1 ? 'bg-green-600 text-white' :
                    currentStep === index + 1 ? 'bg-yellow-600 text-black' :
                    'bg-slate-600 text-slate-400'
                  }`}>
                    {currentStep > index + 1 ? '✓' : index + 1}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 text-center max-w-20">{title}</span>
                </div>
              ))}
            </div>

            {/* Step Content */}
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                onClick={prevStep}
                disabled={currentStep === 1}
                className="bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Previous
              </Button>
              
              {currentStep < 6 ? (
                <Button
                  onClick={nextStep}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black"
                >
                  Next
                  <i className="fas fa-arrow-right ml-2"></i>
                </Button>
              ) : (
                <Button
                  onClick={handleSendForm}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <i className="fas fa-paper-plane mr-2"></i>
                  Send Onboarding Package
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Pending Review Tab */}
        {activeTab === "Pending Review" && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center mb-6">
              <i className="fas fa-clock text-yellow-400 mr-3 text-xl"></i>
              <h2 className="text-xl font-semibold text-yellow-400">Pending Applications</h2>
            </div>
            
            {pendingApplications.length > 0 ? (
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <div key={application.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-user text-white text-lg"></i>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{application.name}</h3>
                          <p className="text-sm text-slate-400">📞 {application.phone}</p>
                          <p className="text-sm text-slate-400">📧 {application.email}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {application.specialization.map((spec) => (
                              <Badge key={spec} className="bg-blue-600 text-white text-xs">{spec}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right mr-4">
                          <div className="text-xs text-slate-400">Submitted</div>
                          <div className="text-white text-sm">{application.submittedDate}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Status: <span className="text-yellow-400 capitalize">{application.status}</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleApproveApplication(application.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                        >
                          <i className="fas fa-check mr-1"></i>
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleRejectApplication(application.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
                        >
                          <i className="fas fa-times mr-1"></i>
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-inbox text-slate-500 text-4xl mb-4"></i>
                <div className="text-slate-400 text-lg mb-2">No pending applications</div>
                <div className="text-slate-500 text-sm">New contractor applications will appear here for review</div>
              </div>
            )}
          </div>
        )}

        {/* Reviewed Tab */}
        {activeTab === "Reviewed" && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center mb-6">
              <i className="fas fa-check-circle text-yellow-400 mr-3 text-xl"></i>
              <h2 className="text-xl font-semibold text-yellow-400">Reviewed Applications</h2>
            </div>
            
            {reviewedApplications.length > 0 ? (
              <div className="space-y-4">
                {reviewedApplications.map((application) => (
                  <div key={application.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-user-check text-white text-lg"></i>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{application.name}</h3>
                          <p className="text-sm text-slate-400">📞 {application.phone}</p>
                          <p className="text-sm text-slate-400">📧 {application.email}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {application.specialization.map((spec) => (
                              <Badge key={spec} className="bg-green-600 text-white text-xs">{spec}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Reviewed</div>
                        <div className="text-white text-sm">{application.reviewedDate}</div>
                        <div className="text-xs text-green-400 mt-1 capitalize font-medium">
                          <i className="fas fa-check mr-1"></i>
                          {application.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-clipboard-check text-slate-500 text-4xl mb-4"></i>
                <div className="text-slate-400 text-lg mb-2">No reviewed applications</div>
                <div className="text-slate-500 text-sm">Approved and rejected applications will appear here</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="grid grid-cols-4 text-center">
          <button 
            onClick={() => window.location.href = '/'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-home block mb-1"></i>
            <span className="text-xs">Dashboard</span>
          </button>
          <button 
            onClick={() => window.location.href = '/job-assignments'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-briefcase block mb-1"></i>
            <span className="text-xs">Jobs</span>
          </button>
          <button 
            onClick={() => window.location.href = '/admin-task-monitor'}
            className="py-3 px-4 text-slate-400 hover:text-white"
          >
            <i className="fas fa-user-cog block mb-1"></i>
            <span className="text-xs">Admin</span>
          </button>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="py-3 px-4 text-yellow-400"
          >
            <i className="fas fa-upload block mb-1"></i>
            <span className="text-xs">Upload Job</span>
          </button>
        </div>
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}