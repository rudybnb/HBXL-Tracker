import fetch from 'node-fetch';

export class TelegramService {
  private botToken: string;
  private baseUrl: string;

  constructor() {
    this.botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    console.log('🤖 Telegram Service initialized with token:', this.botToken ? 'Available' : 'Missing');
    console.log('🔗 Base URL:', this.baseUrl);
  }

  // Send job assignment notification
  async sendJobAssignment(params: {
    contractorName: string;
    phone: string;
    hbxlJob: string;
    buildPhases: string[];
    workLocation: string;
    startDate: string;
  }) {
    try {
      console.log('📱 Sending Telegram job assignment notification...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating notification');
        return { success: true, simulated: true };
      }

      // Map contractor names to their specific chat IDs for job assignments
      let chatId = '7617462316'; // Default to admin
      
      if (params.contractorName.toLowerCase().includes('marius')) {
        chatId = '8006717361'; // Marius Andronache
      } else if (params.contractorName.toLowerCase().includes('dalwayne')) {
        chatId = '8016744652'; // Dalwayne Diedericks
      } else if (params.contractorName.toLowerCase().includes('earl')) {
        chatId = '6792554033'; // Earl Johnson
      } else if (params.contractorName.toLowerCase().includes('muhammed') || params.contractorName.toLowerCase().includes('midou')) {
        chatId = '5209713845'; // Muhammed/Midou
      }
      
      const message = this.formatJobAssignmentMessage(params);
      
      const url = `${this.baseUrl}/sendMessage`;
      console.log('📱 Telegram API URL:', url);
      console.log('📱 Chat ID:', chatId);
      console.log('📱 Message length:', message.length);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Telegram API error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Telegram message sent successfully:', result);
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Telegram service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send welcome message for contractor onboarding
  async sendWelcomeMessage(contractorName: string, phone: string) {
    try {
      console.log('📱 Sending welcome Telegram message...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating welcome message');
        return { success: true, simulated: true };
      }

      // Use Rudy's actual Chat ID for welcome messages
      const chatId = '7617462316';
      
      const message = `
🎉 <b>Welcome to JobFlow, ${contractorName}!</b>

Your contractor account has been set up successfully.

📱 Phone: ${phone}
🔧 You'll receive job assignments and updates through this bot.

To get started, make sure to:
✅ Keep notifications enabled
✅ Contact admin if you have any questions

Ready to receive your first job assignment!
      `.trim();
      
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Telegram welcome message error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Telegram welcome message sent:', result);
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Welcome message error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private formatJobAssignmentMessage(params: {
    contractorName: string;
    phone: string;
    hbxlJob: string;
    buildPhases: string[];
    workLocation: string;
    startDate: string;
  }) {
    const { contractorName, phone, hbxlJob, buildPhases, workLocation, startDate } = params;
    
    const phasesText = Array.isArray(buildPhases) && buildPhases.length > 0
      ? buildPhases.map(phase => `• ${phase}`).join('\n')
      : '• No phases specified';
    
    return `🔨 JOB ASSIGNMENT - ${hbxlJob}

👤 Contractor: ${contractorName}
📱 Phone: ${phone}
📍 Location: ${workLocation}
📅 Start Date: ${startDate}

🏗️ Build Phases:
${phasesText}

Please confirm receipt and let us know if you have any questions!

Good luck with the project! 💪`;
  }

  // Generate unique contractor ID and send onboarding form
  async sendOnboardingForm(contractorName: string, contractorPhone?: string) {
    try {
      console.log('📱 Sending onboarding form to contractor...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating onboarding form');
        return { success: true, simulated: true };
      }

      // Generate unique contractor ID
      const contractorId = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Map contractor names to their specific chat IDs
      let chatId = '7617462316'; // Default to Rudy
      
      if (contractorName.toLowerCase().includes('marius')) {
        chatId = '8006717361'; // Marius Andronache
      } else if (contractorName.toLowerCase().includes('dalwayne')) {
        chatId = '8016744652'; // Dalwayne Diedericks
      } else if (contractorName.toLowerCase().includes('earl')) {
        chatId = '6792554033'; // Earl Johnson
      } else if (contractorName.toLowerCase().includes('muhammed') || contractorName.toLowerCase().includes('midou')) {
        chatId = '5209713845'; // Muhammed/Midou
      }
      
      const message = `🎯 <b>New Contractor Onboarding Required</b>

👤 Contractor: ${contractorName}
${contractorPhone ? `📱 Phone: ${contractorPhone}` : ''}
🆔 ID: <code>${contractorId}</code>

📋 <b>Please complete your contractor onboarding form:</b>
👆 Click the link below to access your personalized form

🔗 <a href="https://${process.env.REPLIT_DEV_DOMAIN || 'replit.dev'}/contractor-onboarding?id=${contractorId}">Complete Onboarding Form</a>

⚠️ <b>Important:</b>
• Fill out all 6 steps completely
• Upload required documents (Passport, UTR, CIS, Insurance)
• Submit form for admin review
• You'll receive confirmation once approved

Need help? Reply to this message! 💬`;
      
      const url = `${this.baseUrl}/sendMessage`;
      console.log('📱 Onboarding URL:', url);
      console.log('📱 Chat ID:', chatId);
      console.log('📱 Message length:', message.length);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Telegram onboarding form error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Onboarding form sent with ID:', contractorId);
      
      return { 
        success: true, 
        messageId: result.message_id,
        contractorId: contractorId
      };
      
    } catch (error) {
      console.error('❌ Onboarding form error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send hello message from contractor
  async sendContractorHello(contractorName: string = 'James Carpenter') {
    try {
      console.log('📱 Sending contractor hello message...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating hello message');
        return { success: true, simulated: true };
      }

      // Use Rudy's Chat ID
      const chatId = '7617462316';
      
      const message = `👋 Hello from ${contractorName}!

🔧 I'm ready to start work today
📍 Currently at job site
⏰ Timer system is working perfectly
📱 All systems are ready for GPS tracking

Looking forward to today's assignments! 💪`;
      
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Telegram hello message error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Contractor hello message sent:', result);
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Hello message error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send custom message to specific chat ID
  async sendCustomMessage(chatId: string, message: string) {
    try {
      console.log('📱 Sending custom Telegram message...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating message');
        return { success: true, simulated: true };
      }

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Telegram custom message error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Custom message sent successfully:', result);
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Custom message error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get recent messages and auto-register new contractor Telegram IDs
  async getRecentMessages(limit: number = 10) {
    try {
      if (!this.botToken) {
        return { success: false, error: 'No bot token provided' };
      }

      console.log('📥 Checking for recent messages...');
      
      const response = await fetch(`${this.baseUrl}/getUpdates?limit=${limit}`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Failed to get updates:', response.status, errorData);
        return { success: false, error: `Failed to get updates: ${response.status}` };
      }

      const result: any = await response.json();
      console.log('✅ Retrieved updates:', result);
      
      if (result.ok && result.result.length > 0) {
        const messages = result.result.map((update: any) => ({
          messageId: update.message?.message_id,
          from: update.message?.from,
          text: update.message?.text,
          date: new Date(update.message?.date * 1000),
          chatId: update.message?.chat?.id
        })).filter((msg: any) => msg.text);

        // Auto-register new contractor Telegram IDs
        await this.autoRegisterContractorTelegramIds(messages);

        return { 
          success: true, 
          messages,
          totalUpdates: result.result.length
        };
      }
      
      return { 
        success: true, 
        messages: [],
        totalUpdates: 0
      };
      
    } catch (error) {
      console.error('❌ Error getting messages:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Auto-register new contractor Telegram IDs when they message the bot
  private async autoRegisterContractorTelegramIds(messages: any[]) {
    try {
      const { DatabaseStorage } = await import('./database-storage');
      const storage = new DatabaseStorage();
      
      const knownIds = ['8006717361', '8016744652', '6792554033', '5209713845'];
      
      for (const message of messages) {
        const chatId = message.chatId?.toString();
        const firstName = message.from?.first_name;
        
        if (chatId && firstName && !knownIds.includes(chatId)) {
          console.log(`🆕 New contractor detected: ${firstName} (ID: ${chatId})`);
          
          // Try to find contractor by name and update their Telegram ID
          const contractors = await storage.getContractors();
          const matchingContractor = contractors.find(c => 
            c.name.toLowerCase().includes(firstName.toLowerCase())
          );
          
          if (matchingContractor) {
            console.log(`🔗 Linking ${firstName} to contractor: ${matchingContractor.name}`);
            // Update contractor with Telegram ID
            await storage.updateContractor(matchingContractor.id, { 
              telegramId: chatId 
            });
            knownIds.push(chatId);
          } else {
            console.log(`⚠️ No matching contractor found for ${firstName}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error auto-registering Telegram IDs:', error);
    }
  }

  // Test bot connection
  async testConnection() {
    try {
      if (!this.botToken) {
        return { success: false, error: 'No bot token provided' };
      }

      console.log('🧪 Testing Telegram bot connection...');
      
      const response = await fetch(`${this.baseUrl}/getMe`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Bot connection test failed:', response.status, errorData);
        return { success: false, error: `Connection test failed: ${response.status}` };
      }

      const botInfo = await response.json();
      console.log('✅ Bot connection successful:', botInfo.result);
      
      return { 
        success: true, 
        botInfo: botInfo.result 
      };
      
    } catch (error) {
      console.error('❌ Bot connection error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send approval notification to contractor
  async sendApprovalNotification(contractorData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    primaryTrade: string;
    adminPayRate?: string;
    telegramId?: string;
  }) {
    try {
      console.log('📱 Sending approval notification to contractor...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating approval notification');
        return { success: true, simulated: true };
      }

      // Use contractor's actual Telegram ID if available, otherwise use known Dalwayne's ID
      const chatId = contractorData.telegramId || '8016744652'; // Dalwayne's actual chat ID
      
      const payRateInfo = contractorData.adminPayRate 
        ? `💰 <b>Pay Rate:</b> £${contractorData.adminPayRate}/hour`
        : '';
      
      const message = `
✅ <b>APPLICATION APPROVED!</b>

🎉 Congratulations ${contractorData.firstName} ${contractorData.lastName}!

Your contractor application has been <b>APPROVED</b> by our team.

👤 <b>Trade:</b> ${contractorData.primaryTrade}
📧 <b>Email:</b> ${contractorData.email}
📱 <b>Phone:</b> ${contractorData.phone}
${payRateInfo}

🚀 Welcome to our contractor network! You'll start receiving job assignments soon.

📞 If you have any questions, please contact us.
`;

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Approval notification error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Approval notification sent successfully');
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Approval notification error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send rejection notification to contractor
  async sendRejectionNotification(contractorData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    primaryTrade: string;
    rejectionReason?: string;
  }) {
    try {
      console.log('📱 Sending rejection notification to contractor...');
      
      if (!this.botToken) {
        console.log('⚠️ No bot token - simulating rejection notification');
        return { success: true, simulated: true };
      }

      const chatId = '7617462316';
      
      const reasonInfo = contractorData.rejectionReason 
        ? `\n📋 <b>Reason:</b> ${contractorData.rejectionReason}`
        : '';
      
      const message = `
❌ <b>APPLICATION UPDATE</b>

Dear ${contractorData.firstName} ${contractorData.lastName},

Unfortunately, your contractor application has been <b>NOT APPROVED</b> at this time.

👤 <b>Trade:</b> ${contractorData.primaryTrade}
📧 <b>Email:</b> ${contractorData.email}
📱 <b>Phone:</b> ${contractorData.phone}${reasonInfo}

🔄 You may reapply in the future when requirements change.

📞 If you have any questions, please contact us.

Thank you for your interest in our contractor network.
`;

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Rejection notification error:', response.status, errorData);
        return { success: false, error: `Telegram API error: ${response.status}` };
      }

      const result = await response.json();
      console.log('✅ Rejection notification sent successfully');
      
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      console.error('❌ Rejection notification error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}