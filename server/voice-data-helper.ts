import type { IStorage } from './storage';

// Financial data from Financeflow app
async function getFinancialData(endpoint: string): Promise<any> {
  try {
    const FINANCE_API_BASE = process.env.FINANCE_API_BASE || 'https://pound-wise-rudybnbd.replit.app/api/finance';
    const response = await fetch(`${FINANCE_API_BASE}/${endpoint}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error(`Error fetching financial data from ${endpoint}:`, error);
    return null;
  }
}

export async function getVoiceAssistantData(query: string, storage: IStorage): Promise<string | null> {
  const lowerQuery = query.toLowerCase();
  
  // Who's working / active sessions
  if (lowerQuery.includes('working') || lowerQuery.includes('clocked in') || lowerQuery.includes('active')) {
    const activeSessions = await storage.getAllActiveSessions();
    if (activeSessions.length === 0) {
      return "No one is currently clocked in.";
    }
    const names = activeSessions.map(s => s.contractorName).join(', ');
    return `${activeSessions.length} ${activeSessions.length === 1 ? 'person is' : 'people are'} working right now: ${names}`;
  }
  
  // Work hours for specific contractor
  if (lowerQuery.includes('hours') && (lowerQuery.includes('marius') || lowerQuery.includes('dalwayne') || lowerQuery.includes('earl') || lowerQuery.includes('muhammed'))) {
    const name = lowerQuery.includes('marius') ? 'Marius Andronache' :
                 lowerQuery.includes('dalwayne') ? 'Dalwayne Diedericks' :
                 lowerQuery.includes('earl') ? 'Earl Joseph' : 'Muhammed Hussain';
    
    const sessions = await storage.getWorkSessions(name);
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter(s => s.startTime.toISOString().startsWith(today));
    
    if (todaySessions.length === 0) {
      return `${name.split(' ')[0]} hasn't worked today yet.`;
    }
    
    const totalMinutes = todaySessions.reduce((sum, s) => {
      if (s.totalHours) {
        const [h, m] = s.totalHours.split(':').map(Number);
        return sum + (h * 60) + m;
      }
      return sum;
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${name.split(' ')[0]} has worked ${hours} hours and ${mins} minutes today.`;
  }
  
  // Jobs / assignments
  if (lowerQuery.includes('job') || lowerQuery.includes('project') || lowerQuery.includes('assignment')) {
    const jobs = await storage.getJobs();
    const activeJobs = jobs.filter(j => j.status === 'assigned');
    
    if (activeJobs.length === 0) {
      return "No active jobs right now.";
    }
    
    return `There are ${activeJobs.length} active ${activeJobs.length === 1 ? 'job' : 'jobs'}. ${activeJobs.slice(0, 3).map(j => `${j.title} at ${j.location}`).join(', ')}`;
  }
  
  // Pending inspections
  if (lowerQuery.includes('inspection') || lowerQuery.includes('inspect')) {
    const inspections = await storage.getAdminInspections();
    const pending = inspections.filter(i => i.status === 'pending_review');
    
    if (pending.length === 0) {
      return "No pending inspections.";
    }
    
    return `You have ${pending.length} pending ${pending.length === 1 ? 'inspection' : 'inspections'}.`;
  }
  
  // Contractor applications
  if (lowerQuery.includes('application') || lowerQuery.includes('applicant')) {
    const applications = await storage.getContractorApplications();
    const pending = applications.filter(a => a.status === 'pending');
    
    if (pending.length === 0) {
      return "No pending applications.";
    }
    
    return `You have ${pending.length} new contractor ${pending.length === 1 ? 'application' : 'applications'}.`;
  }
  
  // Specific contractor info
  if (lowerQuery.includes('pay rate') || lowerQuery.includes('hourly rate')) {
    const name = lowerQuery.includes('marius') ? 'Marius Andronache' :
                 lowerQuery.includes('dalwayne') ? 'Dalwayne Diedericks' :
                 lowerQuery.includes('earl') ? 'Earl Joseph' : 
                 lowerQuery.includes('muhammed') ? 'Muhammed Hussain' : null;
    
    if (name) {
      const applications = await storage.getContractorApplications();
      const contractor = applications.find(a => a.firstName + ' ' + a.lastName === name);
      
      if (contractor?.adminPayRate) {
        return `${name.split(' ')[0]}'s pay rate is ${contractor.adminPayRate} per hour.`;
      }
    }
  }
  
  // Financial queries - Financeflow app integration
  // Check credit cards FIRST (before "balance" keyword) to avoid conflict
  // Alternative keywords for accent recognition: broccoli=barclaycard, barkley=barclaycard
  if (lowerQuery.includes('credit card') || lowerQuery.includes('credit cards') || lowerQuery.includes('card balance') || lowerQuery.includes('debt') || lowerQuery.includes('owe') || lowerQuery.includes('marbles') || lowerQuery.includes('capital one') || lowerQuery.includes('capital') || lowerQuery.includes('zable') || lowerQuery.includes('barclaycard') || lowerQuery.includes('broccoli') || lowerQuery.includes('barkley')) {
    console.log('💳 Financial query detected: credit cards/debt');
    const data = await getFinancialData('debt');
    console.log('💳 Credit card data received:', data);
    if (data) {
      // Check if asking about a specific card
      const cardName = lowerQuery.includes('marbles') || lowerQuery.includes('marble') ? 'marbles' :
                      lowerQuery.includes('capital one') || lowerQuery.includes('capital 1') || lowerQuery.includes('capital') ? 'capital one' :
                      lowerQuery.includes('zable') || lowerQuery.includes('zabel') ? 'zable' :
                      lowerQuery.includes('barclaycard') || lowerQuery.includes('barclay') || lowerQuery.includes('broccoli') || lowerQuery.includes('barkley') ? 'barclaycard' : null;
      
      if (cardName) {
        // Find the specific card
        const allCards = [...(data.cards || []), ...(data.loans || [])];
        const card = allCards.find(c => c.name.toLowerCase().includes(cardName));
        
        if (card) {
          const balance = parseFloat(card.balance).toFixed(0);
          const simpleName = cardName.charAt(0).toUpperCase() + cardName.slice(1);
          
          if (card.creditLimit) {
            const limit = parseFloat(card.creditLimit).toFixed(0);
            const isOverLimit = parseFloat(card.balance) > parseFloat(card.creditLimit);
            if (isOverLimit) {
              return `Your ${simpleName} card owes ${balance} pounds. It's maxed out.`;
            } else {
              const available = parseFloat(card.availableCredit).toFixed(0);
              return `Your ${simpleName} card owes ${balance} pounds. You have ${available} pounds left to spend.`;
            }
          } else {
            return `Your ${simpleName} owes ${balance} pounds.`;
          }
        } else {
          return `I can't find a ${cardName} card.`;
        }
      }
      
      // If not asking about specific card, give total
      const debt = data.totalDebt.toFixed(0);
      const overdue = data.overdueCards?.length || 0;
      
      if (overdue > 0) {
        return `You owe ${debt} pounds on your cards. ${overdue} ${overdue === 1 ? 'card is' : 'cards are'} maxed out.`;
      } else {
        return `You owe ${debt} pounds on your cards.`;
      }
    }
  }
  
  // Bank balance (checked AFTER credit cards to avoid conflict)
  if (lowerQuery.includes('balance') || lowerQuery.includes('bank') || lowerQuery.includes('starling') || lowerQuery.includes('styling')) {
    console.log('💰 Financial query detected: bank balance');
    const data = await getFinancialData('balance');
    console.log('💰 Financial data received:', data);
    if (data) {
      const balance = data.totalBalance.toFixed(0);
      return `You have ${balance} pounds in Starling Bank.`;
    }
  }
  
  if (lowerQuery.includes('financial') || lowerQuery.includes('money') || lowerQuery.includes('net worth') || lowerQuery.includes('finances')) {
    const data = await getFinancialData('summary');
    if (data) {
      const balance = data.bankBalance.toFixed(0);
      const debt = data.totalDebt.toFixed(0);
      const netWorth = data.netWorth.toFixed(0);
      
      if (data.netWorth < 0) {
        return `You have ${balance} pounds in the bank and ${debt} pounds in debt. Your net worth is negative ${Math.abs(parseFloat(netWorth))} pounds.`;
      } else {
        return `You have ${balance} pounds in the bank and ${debt} pounds in debt. Your net worth is ${netWorth} pounds.`;
      }
    }
  }
  
  // Return null if no app-specific data found (will use ChatGPT instead)
  return null;
}
