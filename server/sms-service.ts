// SMS service using existing Twilio setup for ElevenLabs agents
import twilio from 'twilio';

// Initialize client only if credentials are valid
let client: any = null;
const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
const fromNumber = process.env.TWILIO_PHONE_NUMBER?.replace(/\s+/g, '');

// Debug credential info
console.log(`🔍 SMS DEBUG: Account SID exists: ${!!accountSid}`);
console.log(`🔍 SMS DEBUG: API Key SID exists: ${!!apiKeySid}, starts with: ${apiKeySid?.substring(0, 2)}`);
console.log(`🔍 SMS DEBUG: API Key Secret exists: ${!!apiKeySecret}`);

// Prefer API Key authentication if available, fallback to standard auth
if (accountSid && fromNumber) {
  try {
    if (apiKeySid && apiKeySecret) {
      // API Key authentication: use API Key SID as username, API Key Secret as password
      console.log('🔑 Using Twilio API Key authentication');
      client = twilio(apiKeySid, apiKeySecret, { accountSid });
    } else if (authToken) {
      // Standard authentication: Account SID + Auth Token
      console.log('🔑 Using standard Twilio authentication');
      client = twilio(accountSid, authToken);
    }
    
    if (client) {
      console.log('📱 Twilio SMS client initialized successfully');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error);
  }
} else {
  console.log('⚠️ Twilio SMS credentials not configured. SMS features disabled.');
  console.log(`Debug SMS: Account SID exists: ${!!accountSid}, Phone exists: ${!!fromNumber}`);
}

interface SMSParams {
  to: string;
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

interface ContractorSMSData {
  contractorName: string;
  contractorPhone: string;
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

export async function sendSMS(params: SMSParams): Promise<{ success: boolean, messageId?: string, error?: string }> {
  if (!client) {
    console.error('❌ Twilio client not initialized. SMS cannot be sent.');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const priorityPrefix = params.priority === 'urgent' ? '[URGENT] ' : 
                          params.priority === 'high' ? '[HIGH] ' : '';
    
    console.log(`📱 Sending SMS to ${params.to}: ${priorityPrefix}${params.message.substring(0, 50)}...`);
    
    const message = await client.messages.create({
      body: `${priorityPrefix}${params.message}\n\n- ERdesignandbuild Job Tracker`,
      from: fromNumber,
      to: params.to
    });
    
    console.log(`✅ SMS sent successfully: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('❌ Twilio SMS error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendContractorSMS(data: ContractorSMSData): Promise<{ success: boolean, messageId?: string, error?: string }> {
  return await sendSMS({
    to: data.contractorPhone,
    message: `Hi ${data.contractorName}, ${data.message}`,
    priority: data.priority
  });
}

// Get contractor phone from database
export async function getContractorPhone(contractorName: string): Promise<string | null> {
  try {
    const { DatabaseStorage } = await import('./database-storage.js');
    const db = new DatabaseStorage();
    
    // Try to find exact match first
    const applications = await db.getContractorApplications();
    const exactMatch = applications.find((app: any) => 
      `${app.firstName} ${app.lastName}` === contractorName ||
      app.firstName === contractorName ||
      contractorName.includes(app.firstName)
    );
    
    if (exactMatch?.phone) {
      console.log(`📱 Found phone for ${contractorName}: ${exactMatch.phone}`);
      return exactMatch.phone;
    }
    
    // Fallback to test numbers if no database match found
    console.log(`⚠️ No phone found in database for: ${contractorName}, using test numbers`);
    const phoneMap: Record<string, string> = {
      'Marius Andronache': '+447123456789',
      'Dalwayne Diedericks': '+447987654321', 
      'Earl': '+447555123456',
      'SAID tiss': '+447555987654',
      'Rudy': '07534251548'
    };
    
    return phoneMap[contractorName] || null;
  } catch (error) {
    console.error('❌ Error fetching contractor phone from database:', error);
    return null;
  }
}

export async function sendJobAssignmentSMS(contractorName: string, jobDetails: string): Promise<{ success: boolean, messageId?: string, error?: string }> {
  const phone = await getContractorPhone(contractorName);
  if (!phone) {
    console.error(`❌ No phone number found for contractor: ${contractorName}`);
    return { success: false, error: `No phone number found for contractor: ${contractorName}` };
  }

  return await sendContractorSMS({
    contractorName,
    contractorPhone: phone,
    message: `New job assignment: ${jobDetails}. Check your Job Tracker dashboard for full details.`,
    priority: 'high'
  });
}

export async function sendEarningsUpdateSMS(contractorName: string, earningsInfo: string): Promise<{ success: boolean, messageId?: string, error?: string }> {
  const phone = await getContractorPhone(contractorName);
  if (!phone) {
    console.error(`❌ No phone number found for contractor: ${contractorName}`);
    return { success: false, error: `No phone number found for contractor: ${contractorName}` };
  }

  return await sendContractorSMS({
    contractorName,
    contractorPhone: phone,
    message: `Earnings update: ${earningsInfo}. Any questions? Reply to discuss.`,
    priority: 'normal'
  });
}