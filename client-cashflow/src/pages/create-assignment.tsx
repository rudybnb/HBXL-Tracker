import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

interface UploadedJob {
  id: string;
  name: string;
  location: string;
  phaseData?: any[];
  clientInfo?: {
    name: string;
    address: string;
    postCode: string;
    projectType: string;
  };
}

interface Contractor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  primaryTrade: string;
}

export default function CreateAssignment() {
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);
  const [contractorName, setContractorName] = useState(""); // This will be auto-filled from selection
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [selectedHbxlJob, setSelectedHbxlJob] = useState("");
  const [startDate, setStartDate] = useState("06/08/2025");
  const [endDate, setEndDate] = useState("13/08/2025");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [uploadedJobs, setUploadedJobs] = useState<UploadedJob[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [availablePhases, setAvailablePhases] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch approved contractors
  const { data: approvedContractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/contractor-applications"],
    select: (data: any[]) => 
      data
        .filter(contractor => contractor.status === 'approved')
        .map(contractor => ({
          id: contractor.id,
          firstName: contractor.firstName,
          lastName: contractor.lastName,
          email: contractor.email,
          phone: contractor.phone,
          primaryTrade: contractor.primaryTrade
        }))
  });

  // Dynamic build phases will be loaded from CSV data

  useEffect(() => {
    // Load jobs from database instead of localStorage
    const loadJobsFromDatabase = async () => {
      try {
        console.log('🔍 Loading jobs from database...');
        const response = await fetch('/api/jobs');
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        const jobs = await response.json();
        console.log('✅ Loaded jobs from database:', jobs.length);
        
        // Transform database jobs to match expected format
        const transformedJobs = jobs.map((job: any) => ({
          id: job.id,
          name: job.title,
          location: job.location,
          status: job.status,
          phases: job.phases ? job.phases.split(', ') : [],
          phaseData: job.phases ? job.phases.split(', ').reduce((acc: any, phase: string) => {
            acc[phase] = [];
            return acc;
          }, {}) : {}
        }));
        
        setUploadedJobs(transformedJobs);
        console.log('✅ Transformed jobs for dropdown:', transformedJobs.length);
      } catch (error) {
        console.error('❌ Error loading jobs:', error);
        toast({
          title: "Error Loading Jobs",
          description: "Could not load jobs from database",
          variant: "destructive",
        });
      }
    };
    
    loadJobsFromDatabase();
  }, []);

  useEffect(() => {
    // When HBXL job is selected, load available phases from CSV data
    if (selectedHbxlJob) {
      console.log('=== PHASE EXTRACTION DEBUG ===');
      console.log('Selected HBXL Job:', selectedHbxlJob);
      console.log('All uploaded jobs:', uploadedJobs);
      
      const selectedJob = uploadedJobs.find(job => job.name === selectedHbxlJob);
      console.log('Found selected job:', selectedJob);
      
      if (selectedJob) {
        console.log('Job phase data exists:', !!selectedJob.phaseData);
        console.log('Phase data type:', typeof selectedJob.phaseData);
        console.log('Phase data content:', selectedJob.phaseData);
        
        if (selectedJob.phaseData && typeof selectedJob.phaseData === 'object' && selectedJob.phaseData !== null) {
          const phases = Object.keys(selectedJob.phaseData);
          setAvailablePhases(phases);
          console.log('✓ Extracted phases:', phases);
        } else {
          console.log('❌ Phase data invalid or missing');
          console.log('Selected job structure:', JSON.stringify(selectedJob, null, 2));
          setAvailablePhases([]);
        }
      } else {
        console.log('❌ No job found with name:', selectedHbxlJob);
        setAvailablePhases([]);
      }
      console.log('=== END DEBUG ===');
    } else {
      setAvailablePhases([]);
    }
  }, [selectedHbxlJob, uploadedJobs]);

  const handlePhaseToggle = (phase: string) => {
    setSelectedPhases(prev => 
      prev.includes(phase) 
        ? prev.filter(p => p !== phase)
        : [...prev, phase]
    );
  };

  const handleSelectAllPhases = () => {
    setSelectedPhases([...availablePhases]);
  };

  const handleClearAllPhases = () => {
    setSelectedPhases([]);
  };

  // Safe Telegram notification function
  const sendTelegramNotification = async (notificationData: any) => {
    try {
      console.log('📱 Sending Telegram notification...', notificationData);
      
      const response = await fetch('/api/send-telegram-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Telegram notification result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Telegram notification failed:', error);
      // Don't throw error to prevent app crashes
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const handleCreateAssignment = async () => {
    // Validate required fields
    if (selectedContractors.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one contractor",
        variant: "destructive"
      });
      return;
    }

    if (!workLocation || !selectedHbxlJob) {
      toast({
        title: "Missing Information",
        description: "Please fill in work location and select an HBXL job",
        variant: "destructive"
      });
      return;
    }

    if (selectedPhases.length === 0) {
      toast({
        title: "No Phases Selected",
        description: "Please select at least one build phase",
        variant: "destructive"
      });
      return;
    }

    try {
      const assignments = [];
      
      // Create assignments for each selected contractor
      for (const contractorId of selectedContractors) {
        const contractor = approvedContractors.find(c => c.id === contractorId);
        if (!contractor) continue;

        const assignment = {
          contractorName: `${contractor.firstName} ${contractor.lastName}`,
          email: contractor.email,
          phone: contractor.phone,
          workLocation,
          hbxlJob: selectedHbxlJob,
          buildPhases: selectedPhases,
          startDate,
          endDate,
          specialInstructions: selectedContractors.length > 1 
            ? `TEAM ASSIGNMENT: Working with ${selectedContractors.length} contractors. ${specialInstructions}`.trim()
            : specialInstructions,
          status: "assigned",
          sendTelegramNotification: true,
          teamAssignment: selectedContractors.length > 1,
          teamMembers: selectedContractors.length > 1 ? selectedContractors.map(id => {
            const c = approvedContractors.find(contractor => contractor.id === id);
            return c ? `${c.firstName} ${c.lastName}` : '';
          }).filter(Boolean) : undefined
        };

        console.log(`📋 Creating assignment for ${contractor.firstName} ${contractor.lastName}:`, assignment);

        // Save assignment to database
        const response = await fetch('/api/job-assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assignment),
        });

        if (!response.ok) {
          throw new Error(`Failed to create assignment for ${contractor.firstName}: ${response.status}`);
        }

        const savedAssignment = await response.json();
        assignments.push(savedAssignment);
        console.log(`✅ Assignment saved for ${contractor.firstName} ${contractor.lastName}`);
      }

      const contractorNames = selectedContractors.map(id => {
        const c = approvedContractors.find(contractor => contractor.id === id);
        return c ? `${c.firstName} ${c.lastName}` : '';
      }).filter(Boolean).join(', ');

      toast({
        title: "Assignments Created",
        description: selectedContractors.length > 1 
          ? `Team assignment created for ${selectedContractors.length} contractors: ${contractorNames}. Telegram notifications sent to each.`
          : `Job assigned to ${contractorNames}. Telegram notification sent.`,
      });

      // Navigate back to job assignments
      setTimeout(() => {
        window.location.href = '/job-assignments';
      }, 2000);
      
    } catch (error) {
      console.error('❌ Assignment creation failed:', error);
      toast({
        title: "Assignment Error",
        description: "Failed to create assignment. Please try again.",
        variant: "destructive"
      });
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-yellow-400">Job Assignments</h1>
          <Button 
            onClick={() => window.location.href = '/job-assignments'}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            + Create Assignment
          </Button>
        </div>

        {/* Create New Job Assignment Form */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center mb-6">
            <i className="fas fa-user-plus text-yellow-400 mr-2"></i>
            <h3 className="text-xl font-semibold text-yellow-400">Create New Job Assignment</h3>
          </div>
          
          <div className="space-y-4">
            {/* Contractor Selection (Multiple) */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                Select Contractors *
                <span className="text-slate-400 text-xs ml-2">(Can select multiple for team work)</span>
              </label>
              
              {/* Contractor Dropdown */}
              <div className="relative mb-3">
                <select
                  onChange={(e) => {
                    const contractorId = e.target.value;
                    if (contractorId && !selectedContractors.includes(contractorId)) {
                      const newSelected = [...selectedContractors, contractorId];
                      setSelectedContractors(newSelected);
                      
                      // Auto-fill contact details from first selected contractor
                      if (newSelected.length === 1) {
                        const contractor = approvedContractors.find(c => c.id === contractorId);
                        if (contractor) {
                          setContractorName(`${contractor.firstName} ${contractor.lastName}`);
                          setEmail(contractor.email);
                          setPhone(contractor.phone);
                        }
                      } else {
                        // For multiple contractors, use combined names
                        const names = newSelected.map(id => {
                          const contractor = approvedContractors.find(c => c.id === id);
                          return contractor ? `${contractor.firstName} ${contractor.lastName}` : '';
                        }).filter(Boolean);
                        setContractorName(names.join(', '));
                        setEmail(''); // Clear email for multiple contractors
                        setPhone(''); // Clear phone for multiple contractors
                      }
                      
                      // Reset dropdown
                      e.target.value = '';
                    }
                  }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Choose contractors...</option>
                  {approvedContractors.map((contractor) => (
                    <option 
                      key={contractor.id} 
                      value={contractor.id}
                      disabled={selectedContractors.includes(contractor.id)}
                    >
                      {contractor.firstName} {contractor.lastName} - {contractor.primaryTrade}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Contractors Display */}
              {selectedContractors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-400">Selected Contractors:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedContractors.map((contractorId) => {
                      const contractor = approvedContractors.find(c => c.id === contractorId);
                      if (!contractor) return null;
                      
                      return (
                        <Badge 
                          key={contractorId}
                          className="bg-blue-600 text-white px-3 py-1 flex items-center gap-2"
                        >
                          <span>{contractor.firstName} {contractor.lastName}</span>
                          <span className="text-blue-200 text-xs">({contractor.primaryTrade})</span>
                          <button
                            onClick={() => {
                              const newSelected = selectedContractors.filter(id => id !== contractorId);
                              setSelectedContractors(newSelected);
                              
                              // Update contact details based on remaining selection
                              if (newSelected.length === 0) {
                                setContractorName('');
                                setEmail('');
                                setPhone('');
                              } else if (newSelected.length === 1) {
                                const remaining = approvedContractors.find(c => c.id === newSelected[0]);
                                if (remaining) {
                                  setContractorName(`${remaining.firstName} ${remaining.lastName}`);
                                  setEmail(remaining.email);
                                  setPhone(remaining.phone);
                                }
                              } else {
                                const names = newSelected.map(id => {
                                  const contractor = approvedContractors.find(c => c.id === id);
                                  return contractor ? `${contractor.firstName} ${contractor.lastName}` : '';
                                }).filter(Boolean);
                                setContractorName(names.join(', '));
                                setEmail('');
                                setPhone('');
                              }
                            }}
                            className="text-blue-200 hover:text-white ml-1"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                  
                  {selectedContractors.length > 1 && (
                    <div className="text-xs text-green-400 bg-green-900/20 border border-green-700 rounded p-2">
                      ✓ Team Assignment: {selectedContractors.length} contractors will work together on this job
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Information (Auto-filled from contractor selection) */}
            {selectedContractors.length === 1 && (
              <>
                {/* Email */}
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">
                    Email * <span className="text-slate-400 text-xs">(Auto-filled from contractor profile)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Enter email address"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-yellow-400 text-sm font-medium mb-2">
                    Phone <span className="text-slate-400 text-xs">(Auto-filled from contractor profile)</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Enter phone number"
                  />
                </div>
              </>
            )}
            
            {selectedContractors.length > 1 && (
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="text-yellow-400 font-medium mb-2">Team Assignment Mode</div>
                <div className="text-slate-300 text-sm">
                  For team assignments with multiple contractors, notifications will be sent to each contractor individually. 
                  Contact details are managed through their individual profiles.
                </div>
              </div>
            )}

            {/* Work Location */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                Work Location (Postcode) *
              </label>
              <input
                type="text"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                placeholder="Enter postcode"
              />
            </div>

            {/* HBXL Job Selection */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                HBXL Job *
              </label>
              <select
                value={selectedHbxlJob}
                onChange={(e) => {
                  console.log('Job selection changed to:', e.target.value);
                  setSelectedHbxlJob(e.target.value);
                  setSelectedPhases([]);
                  
                  // Auto-populate work location with job's postcode
                  if (e.target.value) {
                    const selectedJob = uploadedJobs.find(job => job.name === e.target.value);
                    if (selectedJob && selectedJob.location) {
                      // Extract postcode from location (e.g., "Bexleyheath, BR9 &HJ" -> "BR9 &HJ")
                      const locationParts = selectedJob.location.split(', ');
                      const postcode = locationParts[locationParts.length - 1]; // Get last part as postcode
                      setWorkLocation(postcode);
                      console.log('✅ Auto-populated work location with postcode:', postcode);
                    }
                  } else {
                    // Clear work location if no job selected
                    setWorkLocation('');
                  }
                }}
                className="w-full bg-slate-700 border border-yellow-500 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              >
                <option value="">Select HBXL job</option>
                {uploadedJobs.map((job) => (
                  <option key={job.id} value={job.name}>
                    {job.name} {job.phaseData ? `(${Object.keys(job.phaseData).length} phases)` : '(No phases)'}
                  </option>
                ))}
              </select>
              {uploadedJobs.length === 0 && (
                <p className="text-red-400 text-sm mt-2">
                  No jobs available. Upload CSV files on the Upload Job page first.
                </p>
              )}
              {uploadedJobs.length > 0 && (
                <p className="text-green-400 text-sm mt-2">
                  ✓ {uploadedJobs.length} job(s) loaded from CSV uploads
                </p>
              )}
            </div>

            {/* Build Phases */}
            {selectedHbxlJob && (
              <div>
                <label className="block text-yellow-400 text-sm font-medium mb-2">
                  Build Phases
                </label>
                
                <div className="mb-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={handleSelectAllPhases}
                      className="text-yellow-400 text-sm hover:text-yellow-300"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleClearAllPhases}
                      className="text-yellow-400 text-sm hover:text-yellow-300"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {availablePhases.length > 0 ? (
                    availablePhases.map((phase) => (
                      <div key={phase} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={phase}
                          checked={selectedPhases.includes(phase)}
                          onChange={() => handlePhaseToggle(phase)}
                          className="w-4 h-4 text-yellow-400 bg-slate-700 border-slate-600 rounded focus:ring-yellow-500"
                        />
                        <label htmlFor={phase} className="text-white text-sm">
                          {phase}
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-slate-400 text-sm text-center py-4 border border-slate-600 rounded-lg bg-slate-800">
                      {selectedHbxlJob ? 
                        `No phases found for "${selectedHbxlJob}". Upload a CSV file first to get real phase data.` : 
                        'Select an HBXL job to see available phases'
                      }
                    </div>
                  )}
                </div>
                
                <div className="mt-2 text-slate-400 text-sm">
                  Selected: {selectedPhases.length} of {availablePhases.length} phases from {selectedHbxlJob}
                </div>
              </div>
            )}

            {/* Start Date */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                Start Date
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                placeholder="DD/MM/YYYY"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                End Date
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                placeholder="DD/MM/YYYY"
              />
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-yellow-400 text-sm font-medium mb-2">
                Special Instructions
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={4}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                placeholder="Any special instructions for the contractor..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4">
              <Button
                onClick={() => window.location.href = '/job-assignments'}
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAssignment}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Create Assignment
              </Button>
            </div>
          </div>
        </div>
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
            className="py-3 px-4 text-yellow-400"
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

        </div>
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}