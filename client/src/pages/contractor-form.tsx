import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, User, FileText, CreditCard, Users, Wrench, Shield } from "lucide-react";

export default function ContractorForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    telegramId: "",
    fullAddress: "",
    city: "",
    postcode: "",
    
    // Step 2: Right to Work & Documentation
    hasRightToWork: false,
    passportNumber: "",
    passportPhotoUploaded: false,
    passportPhotoFile: null, // Store the actual file
    passportPhotoName: "", // Store the file name
    utrNumber: "",
    isCisRegistered: null, // null means not selected yet
    hasPublicLiability: false,
    
    // Step 3: CIS & Tax Information
    cisStatus: "",
    cisNumber: "",
    utrNumberDetails: "",
    hasValidCscs: false,
    
    // Step 4: Banking Details
    bankName: "",
    accountHolderName: "",
    sortCode: "",
    accountNumber: "",
    
    // Step 5: Emergency Contact
    emergencyName: "",
    emergencyPhone: "",
    relationship: "",
    
    // Step 6: Trade & Tools
    primaryTrade: "",
    yearsExperience: "",
    hasOwnTools: false,
    toolsList: ""
  });

  const { toast } = useToast();

  const stepConfig = [
    { 
      number: 1, 
      title: "Personal Information", 
      icon: User,
      fields: ["firstName", "lastName", "email", "phone", "fullAddress", "city", "postcode"] 
    },
    { 
      number: 2, 
      title: "Right to Work & Documentation", 
      icon: Shield,
      fields: ["hasRightToWork", "passportNumber"] 
    },
    { 
      number: 3, 
      title: "CIS & Tax Information", 
      icon: FileText,
      fields: ["isCisRegistered", "utrNumberDetails"] 
    },
    { 
      number: 4, 
      title: "Banking Details", 
      icon: CreditCard,
      fields: ["bankName", "accountHolderName", "sortCode", "accountNumber"] 
    },
    { 
      number: 5, 
      title: "Emergency Contact", 
      icon: Users,
      fields: ["emergencyName", "emergencyPhone", "relationship"] 
    },
    { 
      number: 6, 
      title: "Trade & Tools", 
      icon: Wrench,
      fields: ["primaryTrade", "yearsExperience"] 
    }
  ];

  const tradeOptions = [
    "General Builder", "Carpenter", "Electrician", "Plumber", "Plasterer", 
    "Tiler", "Painter & Decorator", "Bricklayer", "Roofer", "Groundworker",
    "Glazier", "Flooring Specialist", "HVAC Technician", "Steelwork", "Scaffolder"
  ];

  const experienceOptions = [
    "0-1 years", "2-5 years", "6-10 years", "11-15 years", "16+ years"
  ];

  // CIS status is now automatically determined by Yes/No answer

  const updateFormData = (field: string, value: any) => {
    try {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    } catch (error) {
      console.error('Error updating form data:', error);
    }
  };

  const validateStep = (step: number): boolean => {
    const config = stepConfig[step - 1];
    if (!config) return false;
    
    return config.fields.every(field => {
      const value = formData[field as keyof typeof formData];
      
      // Handle different field types properly
      if (typeof value === 'boolean' || value === null) {
        // For boolean fields like hasRightToWork, they must be true to be valid
        // For isCisRegistered, it can be true or false (both are valid choices), but not null
        if (field === 'isCisRegistered') {
          return value === true || value === false;
        }
        return field.startsWith('has') || field.includes('is') ? value === true : true;
      }
      
      // For string fields, they must not be empty
      return value !== "" && value !== undefined && value !== null;
    });
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    } else {
      toast({
        title: "Please complete the following required fields:",
        description: getRequiredFieldsText(currentStep),
        variant: "destructive",
      });
    }
  };

  const getRequiredFieldsText = (step: number): string => {
    const config = stepConfig[step - 1];
    const missingFields = config.fields.filter(field => {
      const value = formData[field as keyof typeof formData];
      
      if (typeof value === 'boolean' || value === null) {
        // For isCisRegistered, it must have been set (not null/undefined)
        if (field === 'isCisRegistered') {
          return value === null || value === undefined;
        }
        return field.startsWith('has') || field.includes('is') ? value !== true : false;
      }
      
      return value === "" || value === undefined || value === null;
    });

    const fieldLabels: Record<string, string> = {
      firstName: "First Name", lastName: "Last Name", email: "Email Address",
      phone: "Phone Number", fullAddress: "Full Address", city: "City", 
      postcode: "Postcode", hasRightToWork: "Right to work confirmation",
      passportNumber: "Passport Number", utrNumber: "UTR Number",
      isCisRegistered: "CIS registration status", hasPublicLiability: "Public liability insurance",
      cisStatus: "CIS Status", utrNumberDetails: "UTR Number",
      bankName: "Bank Name", accountHolderName: "Account Holder Name",
      sortCode: "Sort Code", accountNumber: "Account Number",
      emergencyName: "Emergency Contact Name", emergencyPhone: "Emergency Phone",
      relationship: "Relationship", primaryTrade: "Primary Trade",
      yearsExperience: "Years of Experience"
    };

    return missingFields.map(field => `• ${fieldLabels[field] || field}`).join("\n");
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) {
      toast({
        title: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Submit the application to the API
      const response = await fetch('/api/contractor-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit application');
      }

      const result = await response.json();
      console.log('Application submitted successfully:', result);

      toast({
        title: "Application Submitted Successfully!",
        description: "Your contractor application has been submitted for review. You'll hear back from us within 24 hours.",
      });

      // Redirect to success page
      setTimeout(() => {
        window.location.href = "/contractor-success";
      }, 2000);

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderStepContent = () => {
    try {
      switch (currentStep) {
        case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">Personal Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateFormData("firstName", e.target.value)}
                    placeholder="e.g. James"
                    className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateFormData("lastName", e.target.value)}
                    placeholder="e.g. Carpenter"
                    className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="james@example.com"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  placeholder="07123456789"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Telegram ID (Optional)</label>
                <input
                  type="text"
                  value={formData.telegramId}
                  onChange={(e) => updateFormData("telegramId", e.target.value)}
                  placeholder="@username or user ID"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
                <p className="text-slate-400 text-sm mt-1">For work notifications</p>
              </div>

              <div className="border-t border-slate-600 pt-4">
                <h3 className="text-yellow-400 font-medium mb-4">Address Details</h3>
                
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">Full Address *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.fullAddress}
                      onChange={(e) => updateFormData("fullAddress", e.target.value)}
                      placeholder="123 High Street, London"
                      className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-yellow-400 text-sm font-medium mb-2">City *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                      placeholder="London"
                      className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-yellow-400 text-sm font-medium mb-2">Postcode *</label>
                    <input
                      type="text"
                      value={formData.postcode}
                      onChange={(e) => updateFormData("postcode", e.target.value)}
                      placeholder="SW1A 1AA"
                      className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        case 2:
          return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">Right to Work & Documentation</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="rightToWork"
                  checked={formData.hasRightToWork}
                  onChange={(e) => updateFormData("hasRightToWork", e.target.checked)}
                  className="w-5 h-5 text-yellow-400 bg-slate-800 border-yellow-500 rounded focus:ring-yellow-400"
                />
                <label htmlFor="rightToWork" className="text-white font-medium">
                  I have the right to work in the UK *
                </label>
              </div>

              <Card className="bg-slate-800 border-slate-600">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <label className="block text-yellow-400 text-sm font-medium mb-2">Passport Number</label>
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={(e) => updateFormData("passportNumber", e.target.value)}
                      placeholder="e.g. 123456789"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="block text-yellow-400 text-sm font-medium mb-2">Passport Photo</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          // Basic file validation
                          if (file.size > 10 * 1024 * 1024) { // 10MB limit
                            toast({
                              title: "File too large",
                              description: "Please select a file smaller than 10MB",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          // Store file information
                          updateFormData("passportPhotoUploaded", true);
                          updateFormData("passportPhotoFile", file);
                          updateFormData("passportPhotoName", file.name);
                          
                          toast({
                            title: "Photo uploaded",
                            description: `Successfully uploaded ${file.name}`,
                          });
                        }
                      }}
                      className="hidden"
                      id="passportUpload"
                    />
                    <label
                      htmlFor="passportUpload"
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded-lg flex items-center space-x-2 cursor-pointer inline-flex"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{formData.passportPhotoUploaded ? "Change Photo" : "Upload Passport Photo"}</span>
                    </label>
                    {formData.passportPhotoUploaded && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Photo uploaded successfully</span>
                        </div>
                        {formData.passportPhotoName && (
                          <div className="text-xs text-slate-400">
                            File: {formData.passportPhotoName}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-slate-400">
                      Accepted formats: JPG, PNG, PDF (max 10MB)
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="border-t border-slate-600 pt-4">
                <h3 className="text-yellow-400 font-medium mb-4">Insurance (Optional)</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="hasInsurance"
                      checked={formData.hasPublicLiability}
                      onChange={(e) => updateFormData("hasPublicLiability", e.target.checked)}
                      className="w-5 h-5 text-yellow-400 bg-slate-800 border-yellow-500 rounded focus:ring-yellow-400"
                    />
                    <label htmlFor="hasInsurance" className="text-white">I have public liability insurance (optional)</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        case 3:
          return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <FileText className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">CIS & Tax Information</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">CIS Registration Status *</label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="cisYes"
                      name="cisRegistered"
                      checked={formData.isCisRegistered === true}
                      onChange={(e) => {
                        updateFormData('isCisRegistered', true);
                        updateFormData('cisStatus', 'CIS Registered (20% deduction)');
                      }}
                      className="w-4 h-4 text-yellow-500 bg-slate-800 border-yellow-500 focus:ring-yellow-400"
                    />
                    <label htmlFor="cisYes" className="text-white">Yes - I am CIS Registered (20% deduction)</label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="cisNo"
                      name="cisRegistered"
                      checked={formData.isCisRegistered === false}
                      onChange={(e) => {
                        updateFormData('isCisRegistered', false);
                        updateFormData('cisStatus', 'Not CIS Registered (30% deduction)');
                      }}
                      className="w-4 h-4 text-yellow-500 bg-slate-800 border-yellow-500 focus:ring-yellow-400"
                    />
                    <label htmlFor="cisNo" className="text-white">No - I am not CIS Registered (30% deduction)</label>
                  </div>
                </div>
              </div>

              {formData.isCisRegistered && (
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">CIS Number (if applicable)</label>
                  <input
                    type="text"
                    value={formData.cisNumber}
                    onChange={(e) => updateFormData("cisNumber", e.target.value)}
                    placeholder="e.g. 123/AB12345"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">UTR Number</label>
                <input
                  type="text"
                  value={formData.utrNumberDetails}
                  onChange={(e) => updateFormData("utrNumberDetails", e.target.value)}
                  placeholder="10 digit UTR number"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div className="border-t border-slate-600 pt-4">
                <h3 className="text-yellow-400 font-medium mb-4">CSCS Card Details</h3>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="hasValidCscs"
                    checked={formData.hasValidCscs}
                    onChange={(e) => updateFormData("hasValidCscs", e.target.checked)}
                    className="w-5 h-5 text-yellow-400 bg-slate-800 border-yellow-500 rounded focus:ring-yellow-400"
                  />
                  <label htmlFor="hasValidCscs" className="text-white">I have a valid CSCS card</label>
                </div>
              </div>

              {(formData.cisNumber || formData.utrNumberDetails) && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <h4 className="text-red-800 font-medium mb-2">Please complete the following required fields:</h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      {!formData.cisNumber && formData.isCisRegistered && <li>• CIS number is required when registered</li>}
                      {!formData.utrNumberDetails && <li>• UTR number is required when you have one</li>}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

        case 4:
          return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <CreditCard className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">Banking Details</h2>
            </div>

            <Card className="bg-slate-800 border-yellow-500">
              <CardContent className="p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <Shield className="w-5 h-5 text-yellow-400 mt-1" />
                  <p className="text-slate-300 text-sm">
                    Your banking information is encrypted and secure. Required for payment processing.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Bank Name *</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => updateFormData("bankName", e.target.value)}
                  placeholder="e.g. Barclays, HSBC, NatWest"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Account Holder Name *</label>
                <input
                  type="text"
                  value={formData.accountHolderName}
                  onChange={(e) => updateFormData("accountHolderName", e.target.value)}
                  placeholder="Full name as on account"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Sort Code *</label>
                <input
                  type="text"
                  value={formData.sortCode}
                  onChange={(e) => updateFormData("sortCode", e.target.value)}
                  placeholder="12-34-56"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Account Number *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => updateFormData("accountNumber", e.target.value)}
                    placeholder="12345678"
                    className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        case 5:
          return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">Emergency Contact</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Emergency Contact Name *</label>
                <input
                  type="text"
                  value={formData.emergencyName}
                  onChange={(e) => updateFormData("emergencyName", e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Emergency Contact Phone *</label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => updateFormData("emergencyPhone", e.target.value)}
                  placeholder="07123456789"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Relationship *</label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => updateFormData("relationship", e.target.value)}
                  placeholder="e.g. Spouse, Parent, Sibling"
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>
        );

        case 6:
          return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Wrench className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-yellow-400">Trade & Tools</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Primary Trade *</label>
                <select
                  value={formData.primaryTrade}
                  onChange={(e) => updateFormData("primaryTrade", e.target.value)}
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="">Select your primary trade</option>
                  {tradeOptions.map((trade) => (
                    <option key={trade} value={trade} className="bg-slate-800">
                      {trade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">Years of Experience *</label>
                <select
                  value={formData.yearsExperience}
                  onChange={(e) => updateFormData("yearsExperience", e.target.value)}
                  className="w-full bg-slate-800 border border-yellow-500 rounded-lg px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="">Select your experience level</option>
                  {experienceOptions.map((exp) => (
                    <option key={exp} value={exp} className="bg-slate-800">
                      {exp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="hasOwnTools"
                  checked={formData.hasOwnTools}
                  onChange={(e) => updateFormData("hasOwnTools", e.target.checked)}
                  className="w-5 h-5 text-yellow-400 bg-slate-800 border-yellow-500 rounded focus:ring-yellow-400"
                />
                <label htmlFor="hasOwnTools" className="text-white">I have my own tools</label>
              </div>

              {formData.hasOwnTools && (
                <Card className="bg-slate-800 border-slate-600">
                  <CardContent className="p-6">
                    <label className="block text-yellow-400 text-sm font-medium mb-2">
                      List your main tools (optional)
                    </label>
                    <textarea
                      value={formData.toolsList}
                      onChange={(e) => updateFormData("toolsList", e.target.value)}
                      placeholder="Drill"
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-none"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

        default:
          return <div>Invalid step</div>;
      }
    } catch (error) {
      console.error('Error rendering step content:', error);
      return (
        <div className="text-center text-red-400 p-8">
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p>Please refresh the page and try again.</p>
        </div>
      );
    }
  };

  try {
    return (
      <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-blue-400">Contractor Registration</h1>
            <p className="text-slate-400">ER Build & Design - Complete your onboarding</p>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Step {currentStep} of 6</span>
              <span className="text-sm text-slate-400">{Math.round((currentStep / 6) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8">
            {renderStepContent()}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-600">
              <Button
                onClick={prevStep}
                disabled={currentStep === 1}
                variant="outline"
                className="px-6 py-2 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Previous
              </Button>

              {currentStep < 6 ? (
                <Button
                  onClick={nextStep}
                  className="px-8 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="px-8 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
                >
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  } catch (error) {
    console.error('Contractor form error:', error);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
          <p className="text-slate-400">Sorry, there was an error loading the form. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }
}