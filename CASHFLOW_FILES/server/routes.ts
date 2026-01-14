import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { DatabaseStorage } from './database-storage.js';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow XLSX and CSV files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'text/csv' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only XLSX, XLS, and CSV files are allowed'));
    }
  }
});

export function cashflowRoutes(storage: DatabaseStorage) {
  const router = Router();

  // POST /api/import-xlsx - Upload XLSX file and extract all data automatically
  router.post('/import-xlsx', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('📁 Processing XLSX file:', req.file.originalname);
      
      // Parse the XLSX file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.length === 0) {
        return res.status(400).json({ error: 'No sheets found in the file' });
      }

      let extractedData = {
        contractors: [],
        jobs: [],
        workSessions: [],
        materials: [],
        summary: {
          contractorsFound: 0,
          jobsFound: 0,
          workSessionsFound: 0,
          materialsFound: 0
        }
      };

      // Process each sheet in the workbook
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`📊 Processing sheet: ${sheetName} with ${data.length} rows`);
        
        // Extract contractors automatically (look for names and rates)
        await extractContractorsFromSheet(data, sheetName, extractedData, storage);
        
        // Extract jobs/projects (look for job names, addresses, budgets)
        await extractJobsFromSheet(data, sheetName, extractedData, storage);
        
        // Extract work sessions (look for dates, times, contractor names)
        await extractWorkSessionsFromSheet(data, sheetName, extractedData, storage);
        
        // Extract material costs (look for descriptions, costs, quantities)
        await extractMaterialsFromSheet(data, sheetName, extractedData, storage);
      }

      console.log('✅ Data extraction complete:', extractedData.summary);
      
      res.json({
        success: true,
        message: 'XLSX file processed successfully',
        data: extractedData,
        fileName: req.file.originalname,
        sheetsProcessed: sheetNames
      });
      
    } catch (error) {
      console.error('❌ Error processing XLSX file:', error);
      res.status(500).json({ 
        error: 'Failed to process XLSX file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/contractors - Get all contractors with their rates
  router.get('/contractors', async (req, res) => {
    try {
      const contractors = await storage.getContractors();
      res.json(contractors);
    } catch (error) {
      console.error('❌ Error fetching contractors:', error);
      res.status(500).json({ error: 'Failed to fetch contractors' });
    }
  });

  // GET /api/contractor/:id - Get specific contractor
  router.get('/contractor/:id', async (req, res) => {
    try {
      const contractor = await storage.getContractor(req.params.id);
      if (!contractor) {
        return res.status(404).json({ error: 'Contractor not found' });
      }
      res.json(contractor);
    } catch (error) {
      console.error('❌ Error fetching contractor:', error);
      res.status(500).json({ error: 'Failed to fetch contractor' });
    }
  });

  // GET /api/jobs - Get all jobs
  router.get('/jobs', async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      console.error('❌ Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // GET /api/active-jobs - Get active jobs only
  router.get('/active-jobs', async (req, res) => {
    try {
      const jobs = await storage.getActiveJobs();
      res.json(jobs);
    } catch (error) {
      console.error('❌ Error fetching active jobs:', error);
      res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
  });

  // GET /api/work-sessions - Get work sessions with optional filters
  router.get('/work-sessions', async (req, res) => {
    try {
      const { contractor, startDate, endDate } = req.query;
      
      const start = startDate ? parseISO(startDate as string) : undefined;
      const end = endDate ? parseISO(endDate as string) : undefined;
      
      const sessions = await storage.getWorkSessions(
        contractor as string,
        start,
        end
      );
      
      res.json(sessions);
    } catch (error) {
      console.error('❌ Error fetching work sessions:', error);
      res.status(500).json({ error: 'Failed to fetch work sessions' });
    }
  });

  // GET /api/contractor-earnings/:name - Get contractor earnings for date range
  router.get('/contractor-earnings/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }
      
      const start = parseISO(startDate as string);
      const end = parseISO(endDate as string);
      
      const earnings = await storage.getContractorEarnings(name, start, end);
      res.json(earnings);
    } catch (error) {
      console.error('❌ Error fetching contractor earnings:', error);
      res.status(500).json({ error: 'Failed to fetch contractor earnings' });
    }
  });

  // GET /api/project-cashflow/:jobId - Get project cash flow analysis
  router.get('/project-cashflow/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? parseISO(startDate as string) : undefined;
      const end = endDate ? parseISO(endDate as string) : undefined;
      
      const cashFlow = await storage.getProjectCashFlow(jobId, start, end);
      
      if (!cashFlow) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json(cashFlow);
    } catch (error) {
      console.error('❌ Error fetching project cash flow:', error);
      res.status(500).json({ error: 'Failed to fetch project cash flow' });
    }
  });

  // GET /api/weekly-report - Get weekly cash flow report
  router.get('/weekly-report', async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? parseISO(date as string) : new Date();
      
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 }); // Sunday
      
      // Get all work sessions for the week
      const sessions = await storage.getWeeklyWorkSessions(weekStart, weekEnd);
      
      // Group by contractor and calculate costs
      const contractorBreakdown: Record<string, {
        name: string;
        hours: number;
        cost: number;
        rate: number;
        sessions: number;
      }> = {};
      
      let totalLabourCosts = 0;
      let totalHours = 0;
      
      for (const session of sessions) {
        if (!session.endTime) continue;
        
        const contractor = await storage.getContractorByName(session.contractorName);
        if (!contractor) continue;
        
        const hours = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
        const rate = parseFloat(contractor.payRate);
        const cost = hours * rate;
        
        if (!contractorBreakdown[session.contractorName]) {
          contractorBreakdown[session.contractorName] = {
            name: session.contractorName,
            hours: 0,
            cost: 0,
            rate,
            sessions: 0
          };
        }
        
        contractorBreakdown[session.contractorName].hours += hours;
        contractorBreakdown[session.contractorName].cost += cost;
        contractorBreakdown[session.contractorName].sessions += 1;
        
        totalLabourCosts += cost;
        totalHours += hours;
      }
      
      // Get active jobs count
      const activeJobs = await storage.getActiveJobs();
      
      const report = {
        weekPeriod: {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd'),
          startFormatted: format(weekStart, 'MMM dd, yyyy'),
          endFormatted: format(weekEnd, 'MMM dd, yyyy')
        },
        summary: {
          totalLabourCosts: Number(totalLabourCosts.toFixed(2)),
          totalMaterialCosts: 0, // TODO: Calculate from material costs table
          totalProjectCosts: Number(totalLabourCosts.toFixed(2)),
          totalHours: Number(totalHours.toFixed(2)),
          activeJobs: activeJobs.length,
          activeContractors: Object.keys(contractorBreakdown).length
        },
        contractorBreakdown: Object.values(contractorBreakdown),
        sessions: sessions.map(session => ({
          ...session,
          duration: session.endTime ? 
            (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60) : 0
        }))
      };
      
      res.json(report);
    } catch (error) {
      console.error('❌ Error generating weekly report:', error);
      res.status(500).json({ error: 'Failed to generate weekly report' });
    }
  });

  // GET /api/dashboard-summary - Get overall cash flow dashboard data
  router.get('/dashboard-summary', async (req, res) => {
    try {
      const currentDate = new Date();
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      // This week's data
      const thisWeekSessions = await storage.getWeeklyWorkSessions(weekStart, weekEnd);
      
      // Calculate this week's totals
      let thisWeekLabour = 0;
      let thisWeekHours = 0;
      const activeContractors = new Set<string>();
      
      for (const session of thisWeekSessions) {
        if (!session.endTime) continue;
        
        const contractor = await storage.getContractorByName(session.contractorName);
        if (!contractor) continue;
        
        const hours = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
        const cost = hours * parseFloat(contractor.payRate);
        
        thisWeekLabour += cost;
        thisWeekHours += hours;
        activeContractors.add(session.contractorName);
      }
      
      // Get all active jobs
      const activeJobs = await storage.getActiveJobs();
      
      // Get all contractors for rates display
      const allContractors = await storage.getContractors();
      
      const summary = {
        thisWeek: {
          labourCosts: Number(thisWeekLabour.toFixed(2)),
          materialCosts: 0, // TODO: Add material costs
          totalCosts: Number(thisWeekLabour.toFixed(2)),
          hoursWorked: Number(thisWeekHours.toFixed(2)),
          activeContractors: activeContractors.size,
          activeSessions: thisWeekSessions.length
        },
        projects: {
          activeJobs: activeJobs.length,
          totalBudget: 0, // TODO: Calculate from project budgets
          spent: Number(thisWeekLabour.toFixed(2)),
          remaining: 0 // TODO: Calculate remaining budget
        },
        contractors: allContractors.map(c => ({
          id: c.id,
          name: c.name,
          hourlyRate: parseFloat(c.payRate),
          thisWeekHours: thisWeekSessions
            .filter(s => s.contractorName === c.name && s.endTime)
            .reduce((total, s) => total + ((s.endTime!.getTime() - s.startTime.getTime()) / (1000 * 60 * 60)), 0),
          thisWeekEarnings: 0 // Will be calculated from hours
        }))
      };
      
      // Calculate contractor earnings
      summary.contractors.forEach(c => {
        c.thisWeekEarnings = Number((c.thisWeekHours * c.hourlyRate).toFixed(2));
      });
      
      res.json(summary);
    } catch (error) {
      console.error('❌ Error generating dashboard summary:', error);
      res.status(500).json({ error: 'Failed to generate dashboard summary' });
    }
  });

  return router;
}

// XLSX Data extraction functions - automatically detect and extract data
async function extractContractorsFromSheet(data: any[], sheetName: string, extractedData: any, storage: DatabaseStorage) {
  try {
    // Look for contractor data patterns - names with hourly rates
    const contractorPatterns = [
      /contractor/i, /worker/i, /employee/i, /staff/i, /name/i, /person/i
    ];
    
    const ratePatterns = [
      /rate/i, /pay/i, /hour/i, /wage/i, /cost/i, /£/i, /price/i
    ];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 2) continue;
      
      // Check each cell for contractor name and rate patterns
      for (let j = 0; j < row.length - 1; j++) {
        const cell = String(row[j] || '').trim();
        const nextCell = String(row[j + 1] || '').trim();
        
        // If current cell looks like a name and next cell looks like a rate
        if (cell && cell.length > 2 && 
            (/^[a-zA-Z\s]+$/.test(cell) || contractorPatterns.some(p => p.test(cell))) &&
            (/^\d+(\.\d+)?$/.test(nextCell) || /£\d+/.test(nextCell))) {
          
          const name = cell.replace(/contractor|worker|employee|staff/i, '').trim();
          const rate = parseFloat(nextCell.replace(/[£$]/g, ''));
          
          if (name.length > 1 && rate > 0 && rate < 1000) { // reasonable rate check
            const contractor = {
              name: name,
              payRate: rate.toString(),
              cisRegistered: true, // default
              emergencyContact: '',
              phoneNumber: '',
              email: `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`
            };
            
            extractedData.contractors.push(contractor);
            extractedData.summary.contractorsFound++;
            console.log(`👷 Found contractor: ${name} at £${rate}/hour`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting contractors:', error);
  }
}

async function extractJobsFromSheet(data: any[], sheetName: string, extractedData: any, storage: DatabaseStorage) {
  try {
    // Look for job/project data patterns
    const jobPatterns = [
      /job/i, /project/i, /site/i, /address/i, /location/i, /property/i
    ];
    
    const budgetPatterns = [
      /budget/i, /cost/i, /price/i, /quote/i, /estimate/i, /total/i, /amount/i
    ];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 2) continue;
      
      // Look for job descriptions with addresses or budgets
      for (let j = 0; j < row.length - 1; j++) {
        const cell = String(row[j] || '').trim();
        const nextCell = String(row[j + 1] || '').trim();
        
        // Check for job names with addresses
        if (cell && cell.length > 5 && 
            (jobPatterns.some(p => p.test(cell)) || 
             /^\d+\s+[a-zA-Z\s,]+/.test(cell) || // Looks like address
             /[a-zA-Z\s]+(road|street|avenue|way|close|drive|lane)/i.test(cell))) {
          
          const jobName = cell.length > 50 ? cell.substring(0, 50) + '...' : cell;
          const address = nextCell || cell;
          
          // Look for budget in nearby cells
          let budget = 0;
          for (let k = j; k < Math.min(j + 5, row.length); k++) {
            const cellValue = String(row[k] || '').trim();
            const numValue = parseFloat(cellValue.replace(/[£$,]/g, ''));
            if (!isNaN(numValue) && numValue > 1000 && numValue < 1000000) {
              budget = numValue;
              break;
            }
          }
          
          const job = {
            name: jobName,
            address: address,
            projectType: 'Construction',
            status: 'active',
            startDate: new Date(),
            estimatedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            budget: budget || 50000 // default budget if not found
          };
          
          extractedData.jobs.push(job);
          extractedData.summary.jobsFound++;
          console.log(`🏗️ Found job: ${jobName} (Budget: £${budget || 'TBD'})`);
        }
      }
    }
  } catch (error) {
    console.error('Error extracting jobs:', error);
  }
}

async function extractWorkSessionsFromSheet(data: any[], sheetName: string, extractedData: any, storage: DatabaseStorage) {
  try {
    // Look for work session patterns - dates, times, contractor names
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/, // MM/DD/YYYY or DD/MM/YYYY
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{1,2}-\d{1,2}-\d{2,4}/ // DD-MM-YYYY
    ];
    
    const timePatterns = [
      /\d{1,2}:\d{2}/, // HH:MM
      /\d{1,2}\.\d{2}/ // HH.MM
    ];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 3) continue;
      
      let foundDate = null;
      let foundStartTime = null;
      let foundEndTime = null;
      let foundContractor = null;
      
      // Scan row for date, time, and contractor patterns
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        
        // Check for date
        if (!foundDate && datePatterns.some(p => p.test(cell))) {
          try {
            foundDate = new Date(cell);
            if (isNaN(foundDate.getTime())) {
              foundDate = null;
            }
          } catch (e) {
            foundDate = null;
          }
        }
        
        // Check for times
        if (timePatterns.some(p => p.test(cell))) {
          if (!foundStartTime) {
            foundStartTime = cell;
          } else if (!foundEndTime) {
            foundEndTime = cell;
          }
        }
        
        // Check for contractor names (from already found contractors)
        if (!foundContractor && cell.length > 2) {
          const matchingContractor = extractedData.contractors.find((c: any) => 
            cell.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(cell.toLowerCase())
          );
          if (matchingContractor) {
            foundContractor = matchingContractor.name;
          }
        }
      }
      
      // If we have enough data, create a work session
      if (foundDate && foundStartTime && foundEndTime && foundContractor) {
        const startDateTime = new Date(foundDate);
        const endDateTime = new Date(foundDate);
        
        // Parse times
        const [startHour, startMin] = foundStartTime.split(/[:.]/).map(Number);
        const [endHour, endMin] = foundEndTime.split(/[:.]/).map(Number);
        
        startDateTime.setHours(startHour, startMin || 0);
        endDateTime.setHours(endHour, endMin || 0);
        
        const session = {
          contractorName: foundContractor,
          startTime: startDateTime,
          endTime: endDateTime,
          locationName: extractedData.jobs[0]?.address || 'Site Location',
          gpsLat: 51.5074, // default London coordinates
          gpsLng: -0.1278,
          notes: `Imported from ${sheetName}`
        };
        
        extractedData.workSessions.push(session);
        extractedData.summary.workSessionsFound++;
        console.log(`⏱️ Found work session: ${foundContractor} (${foundStartTime}-${foundEndTime})`);
      }
    }
  } catch (error) {
    console.error('Error extracting work sessions:', error);
  }
}

async function extractMaterialsFromSheet(data: any[], sheetName: string, extractedData: any, storage: DatabaseStorage) {
  try {
    // Look for material/cost patterns
    const materialPatterns = [
      /material/i, /supply/i, /equipment/i, /tool/i, /cement/i, /brick/i, /wood/i, /steel/i
    ];
    
    const costPatterns = [
      /cost/i, /price/i, /amount/i, /total/i, /£/i, /\$/i
    ];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 2) continue;
      
      // Look for material descriptions with costs
      for (let j = 0; j < row.length - 1; j++) {
        const cell = String(row[j] || '').trim();
        const nextCell = String(row[j + 1] || '').trim();
        
        // Check if cell contains material description and next cell contains cost
        if (cell && cell.length > 3 &&
            (materialPatterns.some(p => p.test(cell)) || cell.length > 10) &&
            (/^\d+(\.\d+)?$/.test(nextCell.replace(/[£$,]/g, '')))) {
          
          const cost = parseFloat(nextCell.replace(/[£$,]/g, ''));
          
          if (cost > 0 && cost < 100000) { // reasonable cost check
            const material = {
              description: cell,
              cost: cost,
              quantity: 1,
              unit: 'item',
              jobId: extractedData.jobs[0]?.name || 'General',
              date: new Date()
            };
            
            extractedData.materials.push(material);
            extractedData.summary.materialsFound++;
            console.log(`🧱 Found material: ${cell} (£${cost})`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting materials:', error);
  }
}

// Export routes
router.get('/export/excel', async (req, res) => {
  try {
    const data = await storage.exportData();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cashflow-export-${new Date().toISOString().split('T')[0]}.csv"`);
    
    let csvContent = 'Type,Name,Amount,Date,Description\n';
    
    data.contractors.forEach(contractor => {
      csvContent += `Contractor,"${contractor.name}",${contractor.hourlyRate},${new Date().toISOString().split('T')[0]},"Pay Rate"\n`;
    });
    
    data.jobs.forEach(job => {
      csvContent += `Job,"${job.address}",${job.budget || 0},${new Date().toISOString().split('T')[0]},"${job.description || 'Job Budget'}"\n`;
    });
    
    data.materials.forEach(material => {
      csvContent += `Material,"${material.description}",${material.cost},${new Date().toISOString().split('T')[0]},"Material Cost"\n`;
    });
    
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const data = await storage.exportData();
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="cashflow-report-${new Date().toISOString().split('T')[0]}.html"`);
    
    const htmlReport = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cash Flow Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1, h2 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Cash Flow Report - ${new Date().toLocaleDateString()}</h1>
        
        <h2>Contractors (${data.contractors.length})</h2>
        <table>
          <tr><th>Name</th><th>Hourly Rate</th></tr>
          ${data.contractors.map(c => `<tr><td>${c.name}</td><td>£${c.hourlyRate}</td></tr>`).join('')}
        </table>
        
        <h2>Jobs (${data.jobs.length})</h2>
        <table>
          <tr><th>Address</th><th>Budget</th><th>Description</th></tr>
          ${data.jobs.map(j => `<tr><td>${j.address}</td><td>£${j.budget || 0}</td><td>${j.description || 'N/A'}</td></tr>`).join('')}
        </table>
        
        <h2>Materials (${data.materials.length})</h2>
        <table>
          <tr><th>Description</th><th>Cost</th></tr>
          ${data.materials.map(m => `<tr><td>${m.description}</td><td>£${m.cost}</td></tr>`).join('')}
        </table>
      </body>
      </html>
    `;
    
    res.send(htmlReport);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.use('/api', router);

const httpServer = createServer(app);
return httpServer;
}