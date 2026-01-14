import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Automatic logout service - handles both time-based (5 PM) and GPS proximity-based logout
async function startAutomaticLogoutService() {
  const { storage } = await import('./storage');
  console.log("🕐 Starting automatic logout service (time + GPS proximity)...");
  
  // GPS distance calculation function
  function calculateGPSDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  }

  // Get postcode coordinates function
  function getPostcodeCoordinates(postcode: string): { latitude: string; longitude: string } | null {
    const postcodeMap: { [key: string]: { latitude: string; longitude: string } } = {
      'DA17 5DB': { latitude: '51.4851', longitude: '0.1540' },
      'DA17': { latitude: '51.4851', longitude: '0.1540' },
      'DA7 6HJ': { latitude: '51.4851', longitude: '0.1540' },
      'DA7': { latitude: '51.4851', longitude: '0.1540' },
      'BR6 9HE': { latitude: '51.361', longitude: '0.106' },
      'BR6': { latitude: '51.361', longitude: '0.106' },
      'BR9': { latitude: '51.4612', longitude: '0.1388' },
      'SE9': { latitude: '51.4629', longitude: '0.0789' },
      'DA8': { latitude: '51.4891', longitude: '0.2245' },
      'DA1': { latitude: '51.4417', longitude: '0.2056' },
      'SG1 1EH': { latitude: '51.8721', longitude: '-0.2015' },
      'SG1': { latitude: '51.8721', longitude: '-0.2015' },
      'ME5 9GX': { latitude: '51.335996', longitude: '0.530215' },
      'ME5': { latitude: '51.335996', longitude: '0.530215' },
    };
    
    const upperPostcode = postcode.toUpperCase().trim();
    if (postcodeMap[upperPostcode]) {
      return postcodeMap[upperPostcode];
    }
    
    const postcodePrefix = upperPostcode.split(' ')[0];
    if (postcodeMap[postcodePrefix]) {
      return postcodeMap[postcodePrefix];
    }
    
    return null;
  }
  
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      const allSessions = await storage.getAllActiveSessions();
      
      // Force logout at 5:00 PM exactly
      if (currentHour >= 17) {
        for (const session of allSessions) {
          // Calculate end time as 5:00 PM sharp
          const endTime = new Date(session.startTime);
          endTime.setHours(17, 0, 0, 0);
          
          // Update session to completed
          await storage.updateWorkSession(session.id, {
            endTime,
            status: 'completed' as const
          });
          
          console.log(`🕐 AUTO-LOGOUT (5PM): ${session.contractorName} clocked out at 5:00 PM`);
        }
      } else {
        // GPS proximity check during working hours (before 5 PM)
        const { getContractorLocation } = await import('./location-tracker');
        
        for (const session of allSessions) {
          try {
            // Get real-time location from location tracker
            const currentLocation = getContractorLocation(session.contractorName.trim());
            console.log(`🔍 Checking GPS for ${session.contractorName.trim()}: ${currentLocation ? 'LOCATION FOUND' : 'NO LOCATION DATA'}`);
            
            if (currentLocation) {
              console.log(`📍 Location found for ${session.contractorName}: ${currentLocation.latitude}, ${currentLocation.longitude}`);
              // Multi-site detection: Check proximity to ALL job sites
              const allJobs = await storage.getJobs();
              let nearestJobSite = null;
              let nearestDistance = Infinity;
              let isNearAnyJobSite = false;
              
              // Check distance to all job sites
              for (const job of allJobs) {
                if (job.location) {
                  const jobSiteCoords = getPostcodeCoordinates(job.location);
                  if (jobSiteCoords) {
                    const jobSiteLat = parseFloat(jobSiteCoords.latitude);
                    const jobSiteLon = parseFloat(jobSiteCoords.longitude);
                    
                    const distance = calculateGPSDistance(
                      currentLocation.latitude, 
                      currentLocation.longitude, 
                      jobSiteLat, 
                      jobSiteLon
                    );
                    
                    // Track nearest job site
                    if (distance < nearestDistance) {
                      nearestDistance = distance;
                      nearestJobSite = {
                        location: job.location,
                        distance: distance,
                        jobTitle: job.title
                      };
                    }
                    
                    // Check if within working range of ANY job site (3.5km threshold = 3500m)
                    if (distance <= 3500) {
                      isNearAnyJobSite = true;
                    }
                  }
                }
              }
              
              // Debug GPS proximity logic
              console.log(`🔍 GPS DEBUG for ${session.contractorName}:`);
              console.log(`   📍 Current GPS: ${currentLocation.latitude}, ${currentLocation.longitude}`);
              console.log(`   🏗️ Nearest site: ${nearestJobSite ? nearestJobSite.location : 'NONE FOUND'}`);
              console.log(`   📏 Distance: ${Math.round(nearestDistance)}m`);
              console.log(`   ✅ Within range (3500m = 3.5km)? ${isNearAnyJobSite}`);
              
              // Check for temporary departure during work hours (between 8 AM and 5 PM)
              const currentHour = now.getHours();
              const isWorkingHours = currentHour >= 8 && currentHour < 17;
              console.log(`   🕐 Working hours (8-17)? ${isWorkingHours} (current: ${currentHour})`);
              
              if (!isNearAnyJobSite) {
                if (isWorkingHours) {
                  // During work hours: Mark as temporarily away but keep session active
                  console.log(`🟡 TEMPORARILY AWAY: ${session.contractorName} - outside job site during work hours (timer continues)`);
                  
                  // Check if we already have an active departure record
                  const existingDeparture = await storage.getActiveDeparture(session.contractorName, session.id);
                  
                  if (!existingDeparture) {
                    // Create new temporary departure record
                    await storage.createTemporaryDeparture({
                      contractorName: session.contractorName,
                      workSessionId: session.id,
                      departureTime: new Date(),
                      status: 'away',
                      distanceFromSite: nearestJobSite ? Math.round(nearestDistance).toString() : null,
                      nearestJobSite: nearestJobSite ? nearestJobSite.location : null
                    });
                    
                    console.log(`📍 DEPARTURE LOGGED: ${session.contractorName} marked as temporarily away`);
                  }
                  
                  const nearestInfo = nearestJobSite ? 
                    `${Math.round(nearestDistance)}m from nearest site (${nearestJobSite.location})` :
                    'no job sites found';
                    
                  console.log(`📍 DEPARTURE TRACKING: ${session.contractorName} - ${nearestInfo}`);
                } else {
                  // Outside work hours: Complete auto-logout
                  const endTime = new Date();
                  
                  await storage.updateWorkSession(session.id, {
                    endTime,
                    status: 'completed' as const
                  });
                  
                  const nearestInfo = nearestJobSite ? 
                    `${Math.round(nearestDistance)}m from nearest site (${nearestJobSite.location})` :
                    'no job sites found';
                  
                  console.log(`📍 AUTO-LOGOUT (AFTER-HOURS): ${session.contractorName} auto-logged out - ${nearestInfo}`);
                }
              } else {
                // Contractor is back on site - check if they were previously away
                const activeDeparture = await storage.getActiveDeparture(session.contractorName, session.id);
                
                if (activeDeparture) {
                  // Mark return time
                  await storage.updateTemporaryDeparture(activeDeparture.id, {
                    returnTime: new Date(),
                    status: 'returned'
                  });
                  
                  console.log(`🟢 RETURNED TO SITE: ${session.contractorName} back on job site (timer continuous)`);
                }
                
                // Update active assignment if moved to different job site
                if (nearestJobSite && nearestDistance <= 3500) {
                  // Contractor is very close to a specific job site - could update assignment
                  const currentAssignments = await storage.getContractorAssignments(session.contractorName.trim());
                  
                  if (currentAssignments.length === 0 || currentAssignments[0].workLocation !== nearestJobSite.location) {
                    console.log(`🔄 AUTO-ASSIGNMENT DETECTED: ${session.contractorName} near ${nearestJobSite.location} (${nearestJobSite.jobTitle})`);
                  }
                }
                
                // Log multi-site tracking status
                const statusInfo = nearestJobSite ? 
                  `${Math.round(nearestDistance)}m from ${nearestJobSite.location}` :
                  'monitoring all sites';
                
                console.log(`📍 MULTI-SITE TRACKING: ${session.contractorName} - ${statusInfo} ✅`);
              }
            } else {
              // No current location available - use start coordinates as fallback
              const assignments = await storage.getContractorAssignments(session.contractorName.trim());
              
              if (assignments.length > 0 && session.startLatitude && session.startLongitude) {
                const assignment = assignments[0];
                const workLocation = assignment.workLocation;
                const jobSiteCoords = getPostcodeCoordinates(workLocation);
                
                if (jobSiteCoords) {
                  const jobSiteLat = parseFloat(jobSiteCoords.latitude);
                  const jobSiteLon = parseFloat(jobSiteCoords.longitude);
                  const contractorLat = parseFloat(session.startLatitude);
                  const contractorLon = parseFloat(session.startLongitude);
                  
                  const distance = calculateGPSDistance(contractorLat, contractorLon, jobSiteLat, jobSiteLon);
                  const currentHour = now.getHours();
                  const isWorkingHours = currentHour >= 8 && currentHour < 17;
                  
                  console.log(`🔍 FALLBACK GPS CHECK for ${session.contractorName}:`);
                  console.log(`   📍 Start GPS: ${session.startLatitude}, ${session.startLongitude}`);
                  console.log(`   🏗️ Job site: ${workLocation}`);
                  console.log(`   📏 Distance: ${Math.round(distance)}m`);
                  console.log(`   🕐 Working hours (8-17)? ${isWorkingHours} (current: ${currentHour})`);
                  
                  if (distance > 500) {
                    if (isWorkingHours) {
                      // During work hours: Allow temporary departure - don't auto-logout
                      console.log(`🟡 TEMPORARILY AWAY (FALLBACK): ${session.contractorName} - ${Math.round(distance)}m from job site during work hours (timer continues)`);
                    } else {
                      // After hours: Auto-logout
                      const endTime = new Date();
                      
                      await storage.updateWorkSession(session.id, {
                        endTime,
                        status: 'completed' as const
                      });
                      
                      console.log(`📍 AUTO-LOGOUT (GPS-FALLBACK): ${session.contractorName} auto-logged out - ${Math.round(distance)}m from job site (${workLocation})`);
                    }
                  } else {
                    console.log(`✅ CONTRACTOR ON SITE (FALLBACK): ${session.contractorName} within ${Math.round(distance)}m of ${workLocation} - session continues`);
                  }
                }
              }
            }
          } catch (gpsError) {
            console.error(`❌ GPS proximity check error for ${session.contractorName}:`, gpsError);
          }
        }
      }
      
      // Show progress monitoring
      if (currentMinute % 5 === 0 && currentHour < 17) {
        const activeSessions = await storage.getAllActiveSessions();
        if (activeSessions.length > 0) {
          console.log(`🕐 MULTI-SITE MONITORING: ${activeSessions.length} active contractors, auto-logout at 5:00 PM or if >500m from ALL sites`);
        }
      }
      
    } catch (error) {
      console.error("❌ Error in automatic logout service:", error);
    }
  }, 30000); // Check every 30 seconds
}

(async () => {
  const server = await registerRoutes(app);
  
  // Start automatic logout service
  await startAutomaticLogoutService();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
