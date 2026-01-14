import { writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_DIR = 'logs';

interface CallSession {
  callId: string;
  startTime: Date;
  history: Array<{ user?: string; assistant?: string; timestamp: Date }>;
  phoneNumber?: string;
  logFile: string;
}

// In-memory session storage (use Redis for production)
const sessions = new Map<string, CallSession>();

/**
 * Create a new call session
 */
export async function createCallSession(callId: string, phoneNumber?: string): Promise<CallSession> {
  const now = new Date();
  const logFile = join(LOG_DIR, `call_${callId}_${now.getTime()}.txt`);
  
  const session: CallSession = {
    callId,
    startTime: now,
    history: [],
    phoneNumber,
    logFile
  };
  
  sessions.set(callId, session);
  
  // Initialize log file
  await writeFile(
    logFile,
    `--- Call started: ${now.toISOString()} ---\n` +
    `Call ID: ${callId}\n` +
    `Phone: ${phoneNumber || 'unknown'}\n` +
    `---\n\n`
  );
  
  console.log(`📞 New call session created: ${callId}`);
  
  return session;
}

/**
 * Get existing session
 */
export function getCallSession(callId: string): CallSession | undefined {
  return sessions.get(callId);
}

/**
 * Add message to session history and log file
 */
export async function addToHistory(
  callId: string, 
  message: { user?: string; assistant?: string }
): Promise<void> {
  const session = sessions.get(callId);
  if (!session) {
    console.error(`❌ Session not found: ${callId}`);
    return;
  }
  
  const entry = {
    ...message,
    timestamp: new Date()
  };
  
  session.history.push(entry);
  
  // Log to file
  let logEntry = '';
  if (message.user) {
    logEntry += `[${entry.timestamp.toISOString()}] USER: ${message.user}\n`;
  }
  if (message.assistant) {
    logEntry += `[${entry.timestamp.toISOString()}] ASSISTANT: ${message.assistant}\n`;
  }
  
  await appendFile(session.logFile, logEntry);
  
  console.log(`📝 Message logged for call ${callId}`);
}

/**
 * Log raw event to file
 */
export async function logEvent(callId: string, event: string): Promise<void> {
  const session = sessions.get(callId);
  if (!session) return;
  
  await appendFile(session.logFile, `[${new Date().toISOString()}] ${event}\n`);
}

/**
 * End call session
 */
export async function endCallSession(callId: string): Promise<void> {
  const session = sessions.get(callId);
  if (!session) return;
  
  await appendFile(
    session.logFile,
    `\n--- Call ended: ${new Date().toISOString()} ---\n` +
    `Duration: ${Math.round((Date.now() - session.startTime.getTime()) / 1000)}s\n` +
    `Messages: ${session.history.length}\n`
  );
  
  console.log(`📞 Call session ended: ${callId}`);
  
  // Keep session in memory for 1 hour for potential review
  setTimeout(() => {
    sessions.delete(callId);
    console.log(`🗑️ Session ${callId} removed from memory`);
  }, 3600000);
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): CallSession[] {
  return Array.from(sessions.values());
}
