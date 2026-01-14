#!/usr/bin/env node

/**
 * 🤖 Telegram Bot Connection Tester
 * 
 * This script tests your Telegram bot connection and sends a test message.
 * 
 * Usage:
 *   node test-telegram-bot.js
 */

import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = '7617462316'; // Rudy's Chat ID

console.log('🤖 Testing Telegram Bot Connection...\n');

async function testBotConnection() {
  // Step 1: Verify bot token
  console.log('📝 Step 1: Verifying bot token...');
  
  if (!BOT_TOKEN) {
    console.error('❌ ERROR: TELEGRAM_BOT_TOKEN not found in environment variables!');
    console.log('   Add it to Replit Secrets or .env file');
    process.exit(1);
  }
  
  console.log(`✅ Bot token found: ${BOT_TOKEN.substring(0, 10)}...`);
  
  // Step 2: Get bot info
  console.log('\n📝 Step 2: Getting bot information...');
  
  try {
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    
    if (!botInfoResponse.ok) {
      console.error('❌ ERROR: Invalid bot token!');
      const error = await botInfoResponse.text();
      console.error('   Telegram API error:', error);
      process.exit(1);
    }
    
    const botInfo = await botInfoResponse.json();
    
    if (botInfo.ok) {
      console.log('✅ Bot information retrieved:');
      console.log(`   Bot ID: ${botInfo.result.id}`);
      console.log(`   Bot Name: ${botInfo.result.first_name}`);
      console.log(`   Username: @${botInfo.result.username}`);
      console.log(`   Can join groups: ${botInfo.result.can_join_groups}`);
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to get bot info');
    console.error('   ', error.message);
    process.exit(1);
  }
  
  // Step 3: Send test message
  console.log('\n📝 Step 3: Sending test message...');
  
  try {
    const message = `
🎉 <b>Telegram Bot Connection Test</b>

✅ Bot is connected and working!

📊 System: ERdesignandbuild GPS Tracker
⏰ Time: ${new Date().toLocaleString()}
🤖 Bot Token: Active

Your Telegram bot is ready to send:
• Job assignments
• Contractor notifications
• Admin alerts
• Time tracking updates

<i>This is an automated test message.</i>
    `.trim();
    
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ ERROR: Failed to send message');
      console.error('   Telegram API error:', error);
      console.log('\n💡 Possible issues:');
      console.log('   1. You haven\'t started the bot in Telegram');
      console.log('   2. Chat ID is incorrect');
      console.log('   3. Bot was blocked');
      console.log('\n   Solution: Open Telegram, search for your bot, and click "Start"');
      process.exit(1);
    }
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Test message sent successfully!');
      console.log(`   Message ID: ${result.result.message_id}`);
      console.log(`   Chat ID: ${result.result.chat.id}`);
      console.log('\n📱 Check your Telegram app - you should see the message!');
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to send test message');
    console.error('   ', error.message);
    process.exit(1);
  }
  
  // Step 4: Get recent updates
  console.log('\n📝 Step 4: Checking for recent messages...');
  
  try {
    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5`
    );
    
    if (updatesResponse.ok) {
      const updates = await updatesResponse.json();
      
      if (updates.result && updates.result.length > 0) {
        console.log(`✅ Found ${updates.result.length} recent updates`);
        console.log('\n📩 Recent messages:');
        
        updates.result.slice(0, 3).forEach((update, index) => {
          if (update.message) {
            console.log(`   ${index + 1}. From: ${update.message.from.first_name}`);
            console.log(`      Chat ID: ${update.message.chat.id}`);
            console.log(`      Text: ${update.message.text?.substring(0, 50) || 'N/A'}...`);
          }
        });
      } else {
        console.log('ℹ️  No recent messages found');
        console.log('   Send a message to your bot to test it!');
      }
    }
  } catch (error) {
    console.log('⚠️  Could not fetch recent updates (not critical)');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 CONNECTION TEST COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n✅ Your Telegram bot is fully operational!\n');
  console.log('Next steps:');
  console.log('1. Check your Telegram app for the test message');
  console.log('2. Add contractor Telegram IDs to the database');
  console.log('3. Test job assignment notifications');
  console.log('\nFor more info, see: TELEGRAM_BOT_SETUP.md\n');
}

// Run the test
testBotConnection().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
