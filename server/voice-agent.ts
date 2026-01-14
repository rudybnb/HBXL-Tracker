import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Initialize client only if credentials are valid
let client: any = null;
const rawSid = process.env.TWILIO_ACCOUNT_SID;
const sid = rawSid?.trim();
// Debug: Log the actual SID to understand format
console.log(`🔍 DEBUG: Raw SID from env: "${rawSid}"`);
console.log(`🔍 DEBUG: Trimmed SID: "${sid}"`);
console.log(`🔍 DEBUG: SID length: ${sid?.length}`);

// Check for valid Account SID format (must start with AC for Twilio SDK)
const isValidSid = !!sid && sid.length === 34 && sid.startsWith('AC');
const fromNumber = process.env.TWILIO_PHONE_NUMBER?.replace(/\s+/g, '');

if (sid && sid.startsWith('AP')) {
  console.log('❌ TWILIO SETUP ERROR: You provided an API Key SID (starts with AP)');
  console.log('✅ SOLUTION: Please use your Account SID (starts with AC) instead');
  console.log('📖 Find your Account SID at: https://console.twilio.com/');
} else if (isValidSid && authToken && fromNumber) {
  client = twilio(sid, authToken);
  console.log('🎙️ Twilio client initialized successfully');
} else {
  console.log('⚠️ Twilio credentials not configured or invalid. Voice features disabled.');
  console.log(`Debug: SID valid: ${isValidSid}, Auth token exists: ${!!authToken}, Phone exists: ${!!fromNumber}`);
}

export interface VoiceAgentResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class VoiceAgent {
  private storage: any;

  constructor(storage: any) {
    this.storage = storage;
  }

  // Generate TwiML response for voice interactions
  generateTwiML(message: string, action?: string): string {
    if (action) {
      return `
        <Response>
          <Say voice="alice">${message}</Say>
          <Gather numDigits="1" action="${action}" timeout="10">
            <Say voice="alice">Press any key to continue or hang up to end the call.</Say>
          </Gather>
        </Response>
      `;
    }
    return `
      <Response>
        <Say voice="alice">${message}</Say>
      </Response>
    `;
  }

  // Clock in/out functionality via voice
  async handleClockAction(contractorName: string, action: 'in' | 'out', location?: string): Promise<VoiceAgentResponse> {
    try {
      console.log(`🎙️ Voice command: ${contractorName} clocking ${action} ${location ? `at ${location}` : ''}`);
      
      if (action === 'in') {
        // Start work session
        const workSession = await this.storage.createWorkSession({
          contractorName,
          jobSiteLocation: location || 'Voice Check-in',
          startTime: new Date(),
          status: 'active'
        });
        
        return {
          success: true,
          message: `Hello ${contractorName}. You are now clocked in${location ? ` at ${location}` : ''}. Have a productive day!`,
          data: { sessionId: workSession.id }
        };
      } else {
        // End active session
        const activeSessions = await this.storage.getActiveWorkSessions(contractorName);
        if (activeSessions.length === 0) {
          return {
            success: false,
            message: `${contractorName}, you don't have any active work sessions to clock out from.`
          };
        }

        const session = activeSessions[0];
        await this.storage.updateWorkSession(session.id, {
          endTime: new Date(),
          status: 'completed'
        });

        const duration = this.calculateDuration(session.startTime, new Date());
        return {
          success: true,
          message: `${contractorName}, you are now clocked out. You worked for ${duration} today. Great job!`,
          data: { sessionId: session.id, duration }
        };
      }
    } catch (error) {
      console.error('Voice clock action error:', error);
      return {
        success: false,
        message: 'Sorry, there was an error processing your request. Please try again or contact support.'
      };
    }
  }

  // Get contractor assignment information
  async getAssignmentInfo(contractorName: string): Promise<VoiceAgentResponse> {
    try {
      const assignments = await this.storage.getContractorAssignments(contractorName);
      
      if (assignments.length === 0) {
        return {
          success: true,
          message: `${contractorName}, you currently have no active job assignments.`
        };
      }

      const assignment = assignments[0];
      const message = `${contractorName}, your current assignment is ${assignment.jobName} at ${assignment.location}. Deadline is ${new Date(assignment.deadline).toLocaleDateString()}.`;
      
      return {
        success: true,
        message,
        data: assignment
      };
    } catch (error) {
      console.error('Voice assignment info error:', error);
      return {
        success: false,
        message: 'Sorry, I could not retrieve your assignment information at this time.'
      };
    }
  }

  // Get earnings information
  async getEarningsInfo(contractorName: string): Promise<VoiceAgentResponse> {
    try {
      const sessions = await this.storage.getWorkSessions(contractorName);
      const contractor = await this.storage.getContractorByName(contractorName);
      
      if (!contractor) {
        return {
          success: false,
          message: 'Contractor not found in the system.'
        };
      }

      // Calculate this week's earnings
      const thisWeek = sessions.filter((session: any) => {
        const sessionDate = new Date(session.startTime);
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return sessionDate >= weekStart;
      });

      const totalHours = thisWeek.reduce((sum: number, session: any) => {
        return sum + parseFloat(session.totalHours || '0');
      }, 0);

      const hourlyRate = parseFloat(contractor.adminPayRate || '18.75');
      const grossEarnings = totalHours * hourlyRate;
      const cisRate = contractor.isCisRegistered === 'true' ? 20 : 30;
      const cisDeduction = (grossEarnings * cisRate) / 100;
      const netEarnings = grossEarnings - cisDeduction;

      return {
        success: true,
        message: `${contractorName}, this week you've worked ${totalHours} hours. Your gross earnings are £${grossEarnings.toFixed(2)}, with £${cisDeduction.toFixed(2)} CIS deduction, leaving you with £${netEarnings.toFixed(2)} net pay.`,
        data: { totalHours, grossEarnings, cisDeduction, netEarnings }
      };
    } catch (error) {
      console.error('Voice earnings info error:', error);
      return {
        success: false,
        message: 'Sorry, I could not retrieve your earnings information at this time.'
      };
    }
  }

  // Make outbound call to contractor
  async callContractor(phoneNumber: string, message: string): Promise<VoiceAgentResponse> {
    try {
      const twiml = this.generateTwiML(message);
      
      const call = await client.calls.create({
        to: phoneNumber,
        from: twilioPhone!,
        twiml: twiml
      });

      console.log(`📞 Voice call initiated to ${phoneNumber}: ${call.sid}`);
      
      return {
        success: true,
        message: 'Call initiated successfully',
        data: { callSid: call.sid }
      };
    } catch (error) {
      console.error('Voice call error:', error);
      return {
        success: false,
        message: 'Failed to initiate call'
      };
    }
  }

  // Send job assignment notification via voice call
  async notifyJobAssignment(contractorName: string, jobDetails: any): Promise<VoiceAgentResponse> {
    try {
      const contractor = await this.storage.getContractorByName(contractorName);
      if (!contractor || !contractor.phone) {
        return {
          success: false,
          message: 'Contractor phone number not found'
        };
      }

      const message = `Hello ${contractorName}. You have been assigned to a new job: ${jobDetails.title} at ${jobDetails.location}. Please report to the site by ${new Date(jobDetails.startDate).toLocaleDateString()}. Thank you.`;
      
      return await this.callContractor(contractor.phone, message);
    } catch (error) {
      console.error('Voice job notification error:', error);
      return {
        success: false,
        message: 'Failed to send job assignment notification'
      };
    }
  }

  // Handle emergency alerts
  async sendEmergencyAlert(contractorName: string, alertMessage: string): Promise<VoiceAgentResponse> {
    try {
      const contractor = await this.storage.getContractorByName(contractorName);
      if (!contractor || !contractor.phone) {
        return {
          success: false,
          message: 'Contractor phone number not found'
        };
      }

      const urgentMessage = `URGENT ALERT: ${contractorName}, ${alertMessage}. Please respond immediately.`;
      
      return await this.callContractor(contractor.phone, urgentMessage);
    } catch (error) {
      console.error('Voice emergency alert error:', error);
      return {
        success: false,
        message: 'Failed to send emergency alert'
      };
    }
  }

  // Process voice commands from incoming calls
  async processVoiceCommand(from: string, digits?: string, speechResult?: string): Promise<string> {
    try {
      // Find contractor by phone number
      const contractor = await this.storage.getContractorByPhone(from);
      if (!contractor) {
        return this.generateTwiML('Sorry, your phone number is not registered in our system. Please contact your administrator.');
      }

      const contractorName = `${contractor.firstName} ${contractor.lastName}`;

      // Handle DTMF commands
      if (digits) {
        switch (digits) {
          case '1': // Clock in
            const clockInResult = await this.handleClockAction(contractorName, 'in');
            return this.generateTwiML(clockInResult.message);
          
          case '2': // Clock out
            const clockOutResult = await this.handleClockAction(contractorName, 'out');
            return this.generateTwiML(clockOutResult.message);
          
          case '3': // Get assignment info
            const assignmentResult = await this.getAssignmentInfo(contractorName);
            return this.generateTwiML(assignmentResult.message);
          
          case '4': // Get earnings info
            const earningsResult = await this.getEarningsInfo(contractorName);
            return this.generateTwiML(earningsResult.message);
          
          default:
            return this.generateTwiML('Invalid option. Please try again.');
        }
      }

      // Main menu - use relative path for Twilio callbacks
      return this.generateTwiML(
        `Hello ${contractorName}. Welcome to the contractor voice system. Press 1 to clock in, 2 to clock out, 3 for assignment information, or 4 for earnings information.`,
        '/webhook/voice-a'
      );
      
    } catch (error) {
      console.error('Voice command processing error:', error);
      return this.generateTwiML('Sorry, there was an error processing your request. Please try again later.');
    }
  }

  private calculateDuration(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} hours and ${minutes} minutes`;
  }
}

export default VoiceAgent;