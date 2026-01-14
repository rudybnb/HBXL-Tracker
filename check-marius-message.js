// Quick script to check for Marius's message
import fetch from 'node-fetch';

async function checkMariusMessage() {
  try {
    console.log('🔍 Checking for Marius message...');
    
    const response = await fetch('http://localhost:5000/api/telegram/recent-messages?limit=20');
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Messages retrieved successfully');
      console.log(`📊 Total messages checked: ${result.totalChecked}`);
      console.log(`🎯 Relevant messages found: ${result.relevantCount}`);
      
      if (result.messages && result.messages.length > 0) {
        console.log('\n📨 Recent Messages:');
        result.messages.forEach((msg, index) => {
          console.log(`\n${index + 1}. From: ${msg.from?.first_name || 'Unknown'} (${msg.from?.username || 'no username'})`);
          console.log(`   Text: "${msg.text}"`);
          console.log(`   Date: ${new Date(msg.date).toLocaleString()}`);
          console.log(`   Chat ID: ${msg.chatId}`);
        });
      } else {
        console.log('\n❌ No relevant messages found');
        console.log('💡 This could mean:');
        console.log('   - Marius hasn\'t sent a message recently');
        console.log('   - The message doesn\'t contain work-related keywords');
        console.log('   - The bot token may not be configured');
      }
    } else {
      console.log('❌ Failed to get messages:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkMariusMessage();