import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ContextualTooltip from "@/components/contextual-tooltip";
import { useWorkflowHelp, WORKFLOW_CONFIGS } from "@/hooks/use-workflow-help";
import { InspectionIssues } from "@/components/inspection-issues";




// Active Assignment Component
function ActiveAssignmentContent({ nearestJobSite }: { nearestJobSite?: any }) {
  // Get contractor name from localStorage
  const loggedInContractor = localStorage.getItem('contractorName') || 'James Wilson';
  const contractorFirstName = loggedInContractor.split(' ')[0];
  
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: [`/api/contractor-assignments/${contractorFirstName}`],
  });

  // Fetch uploaded jobs with detailed CSV task data
  const { data: uploadedJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/uploaded-jobs"],
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
        <div className="text-slate-400 text-sm">Loading assignments...</div>
      </div>
    );
  }

  if ((assignments as any[]).length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <i className="fas fa-briefcase text-slate-500 text-3xl"></i>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Active Assignment</h3>
        <div className="text-slate-400 text-sm">
          You don't have any active assignments at the moment. Check with your supervisor for new work.
        </div>
      </div>
    );
  }

  // FIXED: Display ALL assignments, not just the first one
  const validAssignments = assignments as any[];

  return (
    <div className="space-y-3">
      {validAssignments.map((assignment: any, index: number) => (
        <div key={assignment.id} className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <i className="fas fa-map-marker-alt text-yellow-400"></i>
              <div>
                <div className="text-white font-medium text-lg">{assignment.workLocation}</div>
                <div className="text-slate-400 text-sm">{assignment.hbxlJob}</div>
              </div>
            </div>
            <Badge className="bg-yellow-500 text-black text-xs px-2 py-1">
              active
            </Badge>
          </div>
          {assignment.buildPhases && assignment.buildPhases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {assignment.buildPhases.map((phase: string, idx: number) => (
                <span 
                  key={idx}
                  className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded"
                >
                  {phase}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}



interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function GPSDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Debug localStorage contents at dashboard load
  const userRole = localStorage.getItem('userRole');
  const adminName = localStorage.getItem('adminName');
  const contractorName = localStorage.getItem('contractorName');
  
  console.log('🚨 GPS DASHBOARD ACCESS ATTEMPT:', {
    userRole,
    adminName, 
    contractorName,
    isAdmin: userRole === 'admin',
    shouldRedirect: userRole === 'admin'
  });
  
  // CRITICAL: If admin user reached GPS dashboard, redirect to admin
  if (userRole === 'admin') {
    console.log('🚫 ADMIN USER BLOCKED FROM GPS DASHBOARD - Redirecting to /admin');
    window.location.href = '/admin';
    return <div>Redirecting admin to dashboard...</div>;
  }
  
  // Get contractor name from localStorage - enforce authentication
  if (!contractorName) {
    console.log('❌ No contractor name found - redirecting to login');
    window.location.href = '/login';
    return null;
  }
  const contractorFirstName = contractorName.split(' ')[0]; // Extract first name for API calls
  
  // Generate initials from contractor name
  const getContractorInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  // Initialize workflow help for GPS tracking
  const workflowHelp = useWorkflowHelp(WORKFLOW_CONFIGS.gpsTracking);
  
  const [currentTime, setCurrentTime] = useState(() => {
    return localStorage.getItem('gps_timer_current') || "00:00:00";
  });
  const [isTracking, setIsTracking] = useState(() => {
    return localStorage.getItem('gps_timer_active') === 'true';
  });
  const [startTime, setStartTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('gps_timer_start');
    return saved ? new Date(saved) : null;
  });
  const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"Good" | "Poor" | "Unavailable" | string>("Unavailable");
  const [showDropdown, setShowDropdown] = useState(false);
  const [contractorDropdownOpen, setContractorDropdownOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Check for existing active session on load
  const { data: activeSession } = useQuery({
    queryKey: [`/api/work-sessions/${contractorFirstName}/active`],
    queryFn: async () => {
      const response = await fetch(`/api/work-sessions/${contractorFirstName}/active`);
      if (response.status === 404) return null; // No active session
      if (!response.ok) throw new Error('Failed to fetch active session');
      return response.json();
    },
    retry: false,
  });

  // Mutations for work sessions
  const startSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await fetch('/api/work-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
      if (!response.ok) throw new Error('Failed to start session');
      return response.json();
    },
    onSuccess: (session) => {
      setActiveSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: [`/api/work-sessions/${contractorFirstName}/active`] });
      console.log('✅ Work session started in database:', session.id);
    }
  });

  const endSessionMutation = useMutation({
    mutationFn: async ({ sessionId, sessionData }: { sessionId: string, sessionData: any }) => {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
      if (!response.ok) throw new Error('Failed to end session');
      return response.json();
    },
    onSuccess: (session) => {
      setActiveSessionId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/work-sessions/${contractorFirstName}/active`] });
      console.log('✅ Work session ended in database:', session.totalHours);
    }
  });

  // Get current assignment data for GPS coordinates
  const { data: assignments = [] } = useQuery({
    queryKey: [`/api/contractor-assignments/${contractorFirstName}`],
  });
  
  // Type guard for assignments
  const typedAssignments = assignments as any[];

  // Send GPS location updates to server for live tracking
  const sendLocationUpdate = async (latitude: number, longitude: number) => {
    try {
      await fetch('/api/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: contractorName,
          latitude,
          longitude
        })
      });
      console.log(`📍 Location sent to live monitor: ${latitude}, ${longitude}`);
    } catch (error) {
      console.error('❌ Failed to send location update:', error);
    }
  };

  // Get Saturday overtime setting from admin settings
  const { data: saturdayOvertimeSetting } = useQuery({
    queryKey: ["/api/admin-settings/saturday_overtime"],
    queryFn: async () => {
      const response = await fetch("/api/admin-settings/saturday_overtime");
      if (response.status === 404) return null; // Setting doesn't exist
      if (!response.ok) throw new Error('Failed to fetch Saturday overtime setting');
      return response.json();
    },
    retry: false,
  });

  // Get Sunday overtime setting from admin settings
  const { data: sundayOvertimeSetting } = useQuery({
    queryKey: ["/api/admin-settings/sunday_overtime"],
    queryFn: async () => {
      const response = await fetch("/api/admin-settings/sunday_overtime");
      if (response.status === 404) return null; // Setting doesn't exist
      if (!response.ok) throw new Error('Failed to fetch Sunday overtime setting');
      return response.json();
    },
    retry: false,
  });





  // State for location validation
  const [userLocation, setUserLocation] = useState<GPSPosition | null>(null);
  const [workSiteLocation, setWorkSiteLocation] = useState<GPSPosition | null>(null);
  const [nearestJob, setNearestJob] = useState<any>(null);
  const [locationValidation, setLocationValidation] = useState<{
    isWithinRange: boolean;
    distance: number;
    isValidTime: boolean;
    canSignIn: boolean;
    errorMessage?: string;
  }>({
    isWithinRange: false,
    distance: 0,
    isValidTime: false,
    canSignIn: false
  });

  // Calculate distance between two GPS coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Check if current time is within working hours (7:45am - 5pm) or weekend overtime is allowed
  const isWithinWorkingHours = (allowClockOut = false): boolean => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes / 60;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    const startTime = 7 + 45/60; // 7:45 AM
    const endTime = 17; // 5:00 PM
    
    // Check if weekend overtime is enabled
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const saturdayOvertimeEnabled = saturdayOvertimeSetting?.settingValue === 'true';
    const sundayOvertimeEnabled = sundayOvertimeSetting?.settingValue === 'true';
    
    // If already tracking and trying to clock out, allow it even after hours
    if (allowClockOut && isTracking) {
      return currentTime >= startTime; // Only need to be after start time
    }
    
    // Regular working hours (Monday-Friday)
    const isRegularWorkingHours = currentTime >= startTime && currentTime <= endTime;
    
    // If it's Saturday and Saturday overtime is enabled, allow work
    if (isSaturday && saturdayOvertimeEnabled) {
      return isRegularWorkingHours; // Same time restrictions but on Saturday
    }
    
    // If it's Sunday and Sunday overtime is enabled, allow work
    if (isSunday && sundayOvertimeEnabled) {
      return isRegularWorkingHours; // Same time restrictions but on Sunday
    }
    
    // Weekend work not allowed if overtime not enabled
    if (isSaturday || isSunday) {
      return false;
    }
    
    return isRegularWorkingHours;
  };

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setUserLocation(newLocation);
          
          // Send location to live monitor if user is clocked in
          if (isTracking && contractorName) {
            sendLocationUpdate(newLocation.latitude, newLocation.longitude);
          }
        },
        (error) => {
          console.log("Geolocation error:", error);
          setGpsStatus("Unavailable");
          
          // Provide specific GPS troubleshooting for DA17 5DB location
          let errorMessage = "Unable to access your location.";
          if (error.code === 1) {
            errorMessage = "GPS permission denied. Please allow location access in your browser settings.";
          } else if (error.code === 2) {
            errorMessage = "GPS signal unavailable. Try moving to an open area with clear sky view.";
          } else if (error.code === 3) {
            errorMessage = "GPS timeout. Please refresh the page and try again.";
          }
          
          toast({
            title: "GPS Error - DA17 5DB",
            description: `${errorMessage} For DA17 5DB area, ensure GPS is enabled and location services are allowed.`,
            variant: "destructive"
          });
        }
      );
    }
  }, []);

  // Find the nearest job site based on user's current location
  useEffect(() => {
    if (typedAssignments && typedAssignments.length > 0 && userLocation) {
      let nearestAssignment = null;
      let shortestDistance = Infinity;
      
      // Check all assignments to find which one the user is closest to
      for (const assignment of typedAssignments) {
        if (assignment.latitude && assignment.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            parseFloat(assignment.latitude),
            parseFloat(assignment.longitude)
          );
          
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestAssignment = assignment;
          }
        }
      }
      
      if (nearestAssignment) {
        setWorkSiteLocation({
          latitude: parseFloat(nearestAssignment.latitude),
          longitude: parseFloat(nearestAssignment.longitude),
          accuracy: 5
        });
        setNearestJob(nearestAssignment);
        setGpsStatus("Good");
        console.log(`🎯 Nearest job site: ${nearestAssignment.location} (${shortestDistance.toFixed(2)}km away)`);
      } else {
        setWorkSiteLocation(null);
        setNearestJob(null);
        setGpsStatus("⚠️ Work site GPS coordinates missing - Contact admin to add location data for DA17 5DB");
      }
    } else {
      setWorkSiteLocation(null);
      setNearestJob(null);
      setGpsStatus(typedAssignments?.length > 0 ? "Waiting for GPS location" : "No assignments");
    }
  }, [typedAssignments, userLocation]);

  // Validate location and time whenever user location or work site changes
  useEffect(() => {
    console.log('🔍 GPS Validation Check:');
    console.log('- User location:', userLocation);
    console.log('- Work site location:', workSiteLocation);
    console.log('- Assignments:', typedAssignments?.length || 0);
    
    if (userLocation && workSiteLocation) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        workSiteLocation.latitude,
        workSiteLocation.longitude
      );
      
      const isWithinRange = distance <= 3.5; // 3.5km radius
      const isValidTime = isWithinWorkingHours(isTracking); // Allow clock out after hours
      const canSignIn = isWithinRange && isValidTime;
      
      console.log(`- Distance: ${distance.toFixed(2)}km`);
      console.log(`- Within range (≤1km): ${isWithinRange}`);
      console.log(`- Valid time: ${isValidTime}`);
      console.log(`- Can sign in: ${canSignIn}`);
      
      let errorMessage = '';
      if (!isValidTime) {
        errorMessage = isTracking 
          ? 'Cannot clock out before 7:45 AM' 
          : 'Outside working hours (7:45 AM - 5:00 PM)';
      } else if (!isWithinRange) {
        errorMessage = `Too far from work site (${distance.toFixed(2)}km away)`;
      }
      
      setLocationValidation({
        isWithinRange,
        distance,
        isValidTime,
        canSignIn,
        errorMessage
      });
    } else {
      console.log('❌ Missing location data');
      console.log('- User location missing:', !userLocation);
      console.log('- Work site location missing:', !workSiteLocation);
      
      // No GPS location available - restrict access
      setLocationValidation({
        isWithinRange: false,
        distance: 0,
        isValidTime: isWithinWorkingHours(),
        canSignIn: false,
        errorMessage: userLocation ? 'Work site location data missing' : 'GPS location required - please enable location services'
      });
    }
  }, [userLocation, workSiteLocation]);

  // Continuous GPS tracking for live monitor - update location every 30 seconds when clocked in
  useEffect(() => {
    let locationInterval: NodeJS.Timeout;
    
    if (isTracking && contractorName && userLocation) {
      console.log('📍 Starting continuous GPS tracking for live monitor');
      
      locationInterval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              };
              setUserLocation(currentLocation);
              sendLocationUpdate(currentLocation.latitude, currentLocation.longitude);
            },
            (error) => {
              console.log('❌ GPS update failed:', error);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        }
      }, 30000); // Update every 30 seconds
    }

    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
        console.log('📍 Stopped continuous GPS tracking');
      }
    };
  }, [isTracking, contractorName, userLocation]);

  // Timer effect - maintains timer across page navigation + automatic logout at 5 PM
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      const updateTimer = () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Automatic logout at 5:00 PM sharp
        if (currentHour >= 17) {
          console.log('🕐 Automatic logout at 5:00 PM');
          
          // End work session automatically
          if (activeSessionId) {
            endSessionMutation.mutate({
              sessionId: activeSessionId,
              sessionData: {
                endTime: now.toISOString(),
                gpsLatitude: userLocation?.latitude || 0,
                gpsLongitude: userLocation?.longitude || 0,
                status: 'completed'
              }
            });
          }
          
          // Reset timer state
          setIsTracking(false);
          setStartTime(null);
          setCurrentTime("00:00:00");
          localStorage.removeItem('gps_timer_active');
          localStorage.removeItem('gps_timer_start');
          localStorage.removeItem('gps_timer_current');
          
          toast({
            title: "Work Day Ended",
            description: "Automatically logged out at 5:00 PM - work day complete",
            variant: "default"
          });
          
          return; // Stop the timer
        }
        
        const diff = now.getTime() - startTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setCurrentTime(timeString);
        // Always persist current time to localStorage when timer is running
        localStorage.setItem('gps_timer_current', timeString);
        localStorage.setItem('gps_timer_active', 'true');
        localStorage.setItem('gps_timer_start', startTime.toISOString());
      };
      
      updateTimer(); // Update immediately when starting
      interval = setInterval(updateTimer, 1000);
    } else if (!isTracking) {
      // Only reset to "00:00:00" when explicitly stopped, not when component unmounts
      setCurrentTime("00:00:00");
    }
    
    return () => {
      if (interval) clearInterval(interval);
      // DON'T clear localStorage on component cleanup - timer should persist
    };
  }, [isTracking, startTime, endSessionMutation, contractorName, userLocation, activeSessionId, toast]);

  // Initialize timer from localStorage on component mount
  useEffect(() => {
    const savedActive = localStorage.getItem('gps_timer_active');
    const savedStart = localStorage.getItem('gps_timer_start');
    const savedCurrent = localStorage.getItem('gps_timer_current');
    
    if (savedActive === 'true' && savedStart) {
      const startDate = new Date(savedStart);
      const now = new Date();
      
      // Check if saved start time is valid (not more than 24 hours old)
      if (now.getTime() - startDate.getTime() < 24 * 60 * 60 * 1000) {
        setIsTracking(true);
        setStartTime(startDate);
        
        // Calculate current time based on elapsed time
        const diff = now.getTime() - startDate.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setCurrentTime(timeString);
      } else {
        // Clear old timer data if more than 24 hours old
        localStorage.removeItem('gps_timer_active');
        localStorage.removeItem('gps_timer_start');
        localStorage.removeItem('gps_timer_current');
      }
    } else if (savedCurrent) {
      setCurrentTime(savedCurrent);
    }
  }, []); // Only run on initial mount

  const handleStartWork = () => {
    console.log('🔴 handleStartWork called');
    console.log('📍 Location validation:', locationValidation);
    console.log('📍 User location:', userLocation);
    console.log('📍 Work site location:', workSiteLocation);
    console.log('📍 Nearest job:', nearestJob);
    
    // Check location and time validation before allowing sign in
    if (!locationValidation.canSignIn) {
      console.log('❌ Cannot sign in:', locationValidation.errorMessage);
      toast({
        title: "Cannot Sign In",
        description: locationValidation.errorMessage,
        variant: "destructive",
      });
      return;
    }

    if (!isTracking) {
      const newStartTime = new Date();
      setIsTracking(true);
      setStartTime(newStartTime);
      
      // Create work session in database
      const sessionData = {
        contractorName: contractorName,
        jobSiteLocation: nearestJob?.location || 'Unknown Location',
        startTime: newStartTime.toISOString(),
        status: 'active',
        startLatitude: userLocation?.latitude?.toString(),
        startLongitude: userLocation?.longitude?.toString()
      };

      startSessionMutation.mutate(sessionData);
      
      // Send initial GPS location to live monitor
      if (userLocation && contractorName) {
        sendLocationUpdate(userLocation.latitude, userLocation.longitude);
        console.log('📍 Initial GPS location sent to live monitor at clock-in');
      }
      
      // Persist to localStorage for UI consistency
      localStorage.setItem('gps_timer_active', 'true');
      localStorage.setItem('gps_timer_start', newStartTime.toISOString());
      
      toast({
        title: "Work Started",
        description: "GPS verified - tracking time started",
      });
    } else {
      // Stop work - save session to database
      const endTime = new Date();
      const diff = endTime.getTime() - (startTime?.getTime() || Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      if (activeSessionId) {
        const sessionUpdate = {
          endTime: endTime.toISOString(),
          totalHours: totalHours,
          status: 'completed',
          endLatitude: userLocation?.latitude?.toString(),
          endLongitude: userLocation?.longitude?.toString()
        };
        
        endSessionMutation.mutate({ sessionId: activeSessionId, sessionData: sessionUpdate });
      }
      
      // Reset UI state
      setIsTracking(false);
      setStartTime(null);
      setCurrentTime("00:00:00");
      localStorage.removeItem('gps_timer_active');
      localStorage.removeItem('gps_timer_start');
      localStorage.removeItem('gps_timer_current');
      toast({
        title: "Work Ended", 
        description: "Time tracking stopped",
      });
    }
  };

  const handleMenuAction = (action: string) => {
    setContractorDropdownOpen(false);
    toast({
      title: action,
      description: `Opening ${action} interface...`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'bg-yellow-500 text-black';
      case 'Poor': return 'bg-orange-500 text-white';
      default: return 'bg-red-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">

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
          <div className="relative">
            <button 
              onClick={() => setContractorDropdownOpen(!contractorDropdownOpen)}
              className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center ml-4 hover:bg-yellow-700 transition-colors"
            >
              <span className="text-white font-bold text-sm">{getContractorInitials(contractorName)}</span>
            </button>
            
            {contractorDropdownOpen && (
              <div className="absolute right-0 top-10 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50">
                {/* Contractor Info Header - NEVER show this to admin users */}
                <div className="px-4 py-3 border-b border-slate-600">
                  <div className="text-yellow-400 font-semibold">{contractorName}</div>
                  <div className="text-xs text-slate-500">Role: {userRole || 'Unknown'}</div>
                  {userRole === 'admin' && (
                    <div className="text-red-400 text-xs">⚠️ ADMIN ACCESS ERROR</div>
                  )}
                </div>
                
                {/* Simple Contractor Menu Items */}
                <div className="py-2">
                  <button 
                    onClick={() => window.location.href = '/task-progress'}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-tasks mr-3 text-slate-400"></i>
                    My Tasks
                  </button>
                  
                  <button 
                    onClick={() => handleMenuAction("Report Issue")}
                    className="w-full px-4 py-2 text-left text-yellow-400 hover:bg-slate-700 flex items-center"
                  >
                    <i className="fas fa-exclamation-triangle mr-3 text-yellow-400"></i>
                    Report Issue
                  </button>
                  
                  <div className="border-t border-slate-600 mt-2 pt-2">
                    <button 
                      onClick={() => {
                        localStorage.removeItem('userRole');
                        localStorage.removeItem('isLoggedIn');
                        window.location.href = '/login';
                      }}
                      className="w-full px-4 py-2 text-left text-red-400 hover:bg-slate-700 flex items-center"
                    >
                      <i className="fas fa-sign-out-alt mr-3 text-red-400"></i>
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      <div className="p-4 space-y-4">
        {/* GPS Status Card */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-signal text-white mr-2"></i>
              <h3 className="text-lg font-semibold text-yellow-400">GPS Status</h3>
              <ContextualTooltip
                id="gps-status-indicator"
                title="GPS Status Monitor"
                content="Shows GPS connection quality and work site proximity. GPS must be 'Good' and within 1km of assigned work site to start tracking. Location automatically updates every few seconds."
                type="info"
                placement="right"
              >
                <div className="text-blue-400 cursor-help">
                  <i className="fas fa-info-circle text-sm"></i>
                </div>
              </ContextualTooltip>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(gpsStatus)}>{gpsStatus}</Badge>
              <i className="fas fa-sync-alt text-slate-400"></i>
            </div>
          </div>

          {/* Location Validation Status */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Work Site Access</span>
              <Badge 
                className={locationValidation.canSignIn ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
              >
                {locationValidation.canSignIn ? 'Allowed' : 'Restricted'}
              </Badge>
            </div>
            
            {/* Distance from work site */}
            {userLocation && workSiteLocation && (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Distance from site:</span>
                  <span className={locationValidation.isWithinRange ? 'text-green-400' : 'text-red-400'}>
                    {locationValidation.distance.toFixed(2)}km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Working hours (7:45-17:00):</span>
                  <span className={locationValidation.isValidTime ? 'text-green-400' : 'text-red-400'}>
                    {locationValidation.isValidTime ? 'Active' : 'Outside hours'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Error message if can't sign in */}
            {!locationValidation.canSignIn && locationValidation.errorMessage && (
              <div className="mt-2 p-2 bg-red-900 border border-red-600 rounded text-red-200 text-sm">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                {locationValidation.errorMessage}
              </div>
            )}
          </div>
          
          {userLocation && (
            <>
              <div className="flex items-center mb-3">
                <i className="fas fa-map-marker-alt text-slate-400 mr-2"></i>
                <span className="text-white">Your Location: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}</span>
              </div>
              
              {workSiteLocation && (
                <div className="flex items-center mb-3">
                  <i className="fas fa-building text-slate-400 mr-2"></i>
                  <span className="text-yellow-400">Work Site: {workSiteLocation.latitude.toFixed(6)}, {workSiteLocation.longitude.toFixed(6)}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-400">Your Position:</div>
                  <div className="text-white font-mono text-xs">{userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Accuracy:</div>
                  <div className="text-white">±{userLocation.accuracy}m</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* GPS Time Tracker Card */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center mb-4">
            <i className="fas fa-clock text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">GPS Time Tracker</h3>
          </div>
          
          <div className="flex items-center mb-4">
            <i className="fas fa-map-marker-alt text-slate-400 mr-2"></i>
            <span className="text-slate-400">
              {workSiteLocation && typedAssignments && typedAssignments.length > 0
                ? (() => {
                    // Find which assignment matches the current work site location
                    const currentJob = typedAssignments.find((a: any) => 
                      a.latitude && a.longitude &&
                      Math.abs(parseFloat(a.latitude) - workSiteLocation.latitude) < 0.001 &&
                      Math.abs(parseFloat(a.longitude) - workSiteLocation.longitude) < 0.001
                    );
                    return currentJob ? `Work Site: ${currentJob.location}` : 'Work Site: Unknown';
                  })()
                : 'No assignment location'
              }
            </span>
          </div>
          
          <div className="text-center mb-6">
            <div className="text-4xl font-mono text-blue-400 mb-4">{currentTime}</div>
            
            <div className="mb-4 text-center">
              <div className="text-xl text-green-400 font-semibold">GPS Timer Active</div>
              <div className="text-slate-400 text-xs">
                Location verified - Time tracking in progress
              </div>
            </div>
            
            <ContextualTooltip
              id="start-stop-work-button"
              title="GPS Work Tracking"
              content={isTracking 
                ? "Click to stop work and save time session. GPS location will be recorded for verification." 
                : "Click to start GPS-verified time tracking. System validates you're within 1km of work site and during valid hours (7:45 AM - 5:00 PM)."
              }
              type={isTracking ? "warning" : "success"}
              placement="top"
            >
              <Button 
                onClick={handleStartWork}
                disabled={!locationValidation.canSignIn && !isTracking}
                className={`w-full py-3 text-white font-medium rounded-lg flex items-center justify-center ${
                  (!locationValidation.canSignIn && !isTracking)
                    ? 'bg-red-600 cursor-not-allowed opacity-75'
                    : isTracking 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                <i className={`fas ${isTracking ? 'fa-stop' : !locationValidation.canSignIn ? 'fa-lock' : 'fa-play'} mr-2`}></i>
                {isTracking 
                  ? 'Stop Work' 
                  : !locationValidation.canSignIn 
                    ? 'GPS Check Required'
                    : 'Start Work (GPS Verified)'
                }
              </Button>
            </ContextualTooltip>
          </div>
          
          <div className="text-center text-slate-400 text-sm mb-2">
            {!userLocation 
              ? 'GPS location required - please enable location services'
              : locationValidation.canSignIn 
                ? (isTracking ? 'Ready to stop GPS-verified time tracking' : 'Ready to start GPS-verified time tracking')
                : isTracking 
                  ? 'Must be within 1km of work site to clock out'
                  : 'Must be within 1km of work site during 7:45 AM - 5:00 PM'
            }
          </div>
          {locationValidation.canSignIn && (
            <div className="text-center text-green-400 text-xs">
              ✓ Location verified - Ready to work
            </div>
          )}
        </div>

        {/* Active Assignment Card */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center mb-4">
            <i className="fas fa-briefcase text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Active Assignment</h3>
          </div>
          
          <ActiveAssignmentContent nearestJobSite={nearestJob} />
        </div>



        {/* Task Inspection Results - Feedback from Admin */}
        <InspectionIssues contractorName={contractorName} />

        {/* Overdue Projects Card */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center mb-4">
            <i className="fas fa-calendar-times text-yellow-400 mr-2"></i>
            <h3 className="text-lg font-semibold text-yellow-400">Overdue Projects</h3>
          </div>
          
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <i className="fas fa-calendar-check text-green-600 text-3xl"></i>
            </div>
            <div className="text-slate-400 text-sm">
              No overdue projects
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        {/* Show foreman tab only for Dalwayne */}
        {contractorName && (contractorName.toLowerCase().includes('dalwayne') || contractorName.toLowerCase().includes('diedericks')) ? (
          <div className="grid grid-cols-4 text-center">
            <button 
              onClick={() => window.location.href = '/'}
              className="py-3 px-4 text-yellow-400"
              data-testid="nav-dashboard"
            >
              <i className="fas fa-home block mb-1"></i>
              <span className="text-xs">Dashboard</span>
            </button>
            <button 
              onClick={() => window.location.href = '/jobs'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-jobs"
            >
              <i className="fas fa-briefcase block mb-1"></i>
              <span className="text-xs">Jobs</span>
            </button>
            <button 
              onClick={() => window.location.href = '/foreman'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-foreman"
            >
              <i className="fas fa-users block mb-1"></i>
              <span className="text-xs">Jobs Assigned</span>
            </button>
            <button 
              onClick={() => window.location.href = '/more'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-more"
            >
              <i className="fas fa-ellipsis-h block mb-1"></i>
              <span className="text-xs">More</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 text-center">
            <button 
              onClick={() => window.location.href = '/'}
              className="py-3 px-4 text-yellow-400"
              data-testid="nav-dashboard"
            >
              <i className="fas fa-home block mb-1"></i>
              <span className="text-xs">Dashboard</span>
            </button>
            <button 
              onClick={() => window.location.href = '/jobs'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-jobs"
            >
              <i className="fas fa-briefcase block mb-1"></i>
              <span className="text-xs">Jobs</span>
            </button>
            <button 
              onClick={() => window.location.href = '/more'}
              className="py-3 px-4 text-slate-400 hover:text-white"
              data-testid="nav-more"
            >
              <i className="fas fa-ellipsis-h block mb-1"></i>
              <span className="text-xs">More</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
      
      {/* Overlay to close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}