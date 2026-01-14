// Email service using SendGrid integration for ElevenLabs agents
import { MailService } from '@sendgrid/mail';

// Don't throw on import - handle gracefully at runtime

const mailService = new MailService();

// Initialize only if API key is available
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

interface ContractorEmailData {
  contractorName: string;
  contractorEmail: string;
  subject: string;
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

export async function sendEmail(params: EmailParams): Promise<{ success: boolean, messageId?: string, error?: string }> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    console.log(`📧 Sending email: ${params.subject || 'No subject'} to ${params.to}`);
    
    const response = await mailService.send({
      to: params.to,
      from: params.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@erdesignandbuild.com',
      subject: params.subject || 'ERdesignandbuild Notification',
      text: params.text,
      html: params.html,
      replyTo: params.replyTo || process.env.SENDGRID_REPLY_TO || params.from
    });
    
    console.log(`✅ Email sent successfully to ${params.to}`);
    return { success: true, messageId: response[0]?.headers?.['x-message-id'] };
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendContractorEmail(data: ContractorEmailData): Promise<{ success: boolean, messageId?: string, error?: string }> {
  const priorityPrefix = data.priority === 'urgent' ? '[URGENT] ' : 
                        data.priority === 'high' ? '[HIGH PRIORITY] ' : '';
  
  const messageLines = data.message?.split('\n') || [''];
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e293b; color: #d97706; padding: 20px; text-align: center;">
        <h1>ERdesignandbuild - Job Tracker</h1>
      </div>
      <div style="padding: 20px; background-color: #f8f9fa;">
        <h2>Hello ${data.contractorName},</h2>
        <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
          ${messageLines.map(line => `<p>${line}</p>`).join('')}
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
          <p><strong>Need assistance?</strong> Reply to this email or contact your supervisor.</p>
        </div>
      </div>
      <div style="background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px;">
        <p>ERdesignandbuild Job Tracker System</p>
        <p>This is an automated message from your job management system.</p>
      </div>
    </div>
  `;
  
  return await sendEmail({
    to: data.contractorEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@erdesignandbuild.com',
    subject: `${priorityPrefix}${data.subject}`,
    text: `Hello ${data.contractorName},\n\n${data.message || ''}\n\nERdesignandbuild Job Tracker`,
    html: htmlContent,
    replyTo: process.env.SENDGRID_REPLY_TO || 'admin@erdesignandbuild.com'
  });
}

export async function replyToEmail(originalFrom: string, subject: string, message: string): Promise<{ success: boolean, messageId?: string, error?: string }> {
  const messageLines = message?.split('\n') || [''];
  return await sendEmail({
    to: originalFrom,
    from: 'admin@erdesignandbuild.com',
    subject: `Re: ${subject}`,
    text: message || '',
    html: `<div style="font-family: Arial, sans-serif;"><p>${messageLines.join('</p><p>')}</p></div>`
  });
}

// Get contractor email from database
export async function getContractorEmail(contractorName: string): Promise<string | null> {
  // This would typically query your database for contractor contact info
  // For now, returning a placeholder - you'd need to add email field to contractors table
  const emailMap: Record<string, string> = {
    'Marius Andronache': 'marius@contractor.com',
    'Dalwayne Diedericks': 'dalwayne@contractor.com', 
    'Earl': 'earl@contractor.com',
    'SAID tiss': 'said@contractor.com'
  };
  
  return emailMap[contractorName] || null;
}