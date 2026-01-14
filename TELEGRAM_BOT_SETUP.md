# 🤖 Telegram Bot Connection Guide

## ✅ Current Status

Your Telegram bot token (`TELEGRAM_BOT_TOKEN`) is already configured in Replit secrets!

---

## 📱 How to Connect to Your Telegram Bot

### Step 1: Find Your Bot on Telegram

1. Open Telegram app
2. Search for your bot username (usually ends with `_bot`)
3. Click "Start" to activate the bot

### Step 2: Get Your Chat ID

To receive messages, the bot needs your Telegram Chat ID. Here's how to get it:

**Option A: Send a message to your bot**
1. Send any message to your bot in Telegram
2. Visit this URL in your browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Look for `"chat":{"id":123456789}` - that's your Chat ID!

**Option B: Use @userinfobot**
1. Open Telegram
2. Search for `@userinfobot`
3. Start the bot
4. It will send you your Chat ID

---

## 🧪 Test Your Bot Connection

### Method 1: Using the API Endpoint

```bash
# Send a test message to yourself
curl -X POST http://localhost:5000/api/send-telegram-test \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "7617462316",
    "message": "🎉 Test message from ERdesignandbuild!"
  }'
```

### Method 2: Using Node.js Code

```javascript
import { TelegramService } from './server/telegram';

const telegram = new TelegramService();

// Send test message
await telegram.sendCustomMessage(
  "7617462316",  // Your Telegram Chat ID
  "🚀 Bot is connected and working!"
);
```

### Method 3: Direct Telegram API

```bash
# Replace <BOT_TOKEN> with your actual token
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "7617462316",
    "text": "✅ Direct API test successful!"
  }'
```

---

## 🔧 Bot Features in Your App

Your Telegram bot can:

### 1. **Send Job Assignments**
```typescript
await telegram.sendJobAssignment({
  contractorName: "Marius Andronache",
  phone: "+447123456789",
  hbxlJob: "Kitchen Renovation",
  buildPhases: ["Foundation", "Framing"],
  workLocation: "ME5 9GX",
  startDate: "2024-11-20"
});
```

### 2. **Send Custom Messages**
```typescript
await telegram.sendCustomMessage(
  "8006717361",  // Marius's Telegram ID
  "📋 Your timesheet has been approved!"
);
```

### 3. **Send Contractor Notifications**
- Application approvals
- Application rejections
- Job assignments
- Admin notifications

---

## 👥 Contractor Telegram IDs

Current contractors in the system:

| Name | Telegram ID | Status |
|------|-------------|--------|
| Rudy Diedericks (Admin) | `7617462316` | ✅ Active |
| Marius Andronache | `8006717361` | ✅ Active |
| Dalwayne Diedericks | `8016744652` | ✅ Active |
| Earl Johnson | `6792554033` | ✅ Active |
| Hamza Aouichaoui | `8108393007` | ✅ Active |
| Muhammed/Midou | `5209713845` | ✅ Active |

---

## 🆕 Add New Contractor Telegram ID

### Via Admin Dashboard:
1. Go to: http://localhost:5000/admin/applications
2. Edit contractor application
3. Add Telegram ID in the `telegramId` field
4. Save

### Via API:
```bash
curl -X PATCH http://localhost:5000/api/contractor-applications/<ID> \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": "1234567890"
  }'
```

---

## 🔍 Verify Bot Information

Check your bot's details:

```bash
# Get bot info
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "YourBotName",
    "username": "your_bot_username",
    "can_join_groups": true,
    "can_read_all_group_messages": false,
    "supports_inline_queries": false
  }
}
```

---

## 🔐 Security Notes

- ✅ Bot token is stored securely in Replit Secrets
- ✅ Never commit the token to git
- ✅ Only share bot token with trusted team members
- ✅ Tokens can be regenerated via @BotFather if compromised

---

## 🐛 Troubleshooting

### Bot not responding?

1. **Check token is valid:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   ```

2. **Verify you've started the bot:**
   - Open bot in Telegram
   - Click "Start" button

3. **Check chat ID is correct:**
   - Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Verify your chat ID matches

### "Unauthorized" error?

- Token is missing or incorrect
- Check Replit Secrets → `TELEGRAM_BOT_TOKEN`
- Regenerate token via @BotFather if needed

### "Chat not found" error?

- You haven't started the bot yet
- Chat ID is incorrect
- Open bot in Telegram and click "Start"

---

## 📚 Useful Commands

### Get Recent Updates:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

### Get Bot Info:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

### Send Message:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=7617462316&text=Hello!"
```

---

## 🎯 Next Steps

1. ✅ Verify bot token works (test with `/getMe`)
2. ✅ Get your Chat ID (use @userinfobot)
3. ✅ Send test message to yourself
4. ✅ Add contractor Telegram IDs
5. ✅ Test job assignment notifications

---

**Your bot is ready to use!** 🚀

Need help? Check the logs or test with the methods above!
