# 🚀 Render Deployment Guide - ERdesignandbuild

## Overview
This project requires **TWO separate Render services**:
1. **Web Service** - Node.js (Express + React frontend)
2. **Python Service** - FastAPI Telegram Bot API

---

## 📋 Prerequisites

1. **Render Account** - [https://render.com](https://render.com)
2. **PostgreSQL Database** - Already set up on Render
3. **GitHub Repository** - Push this code to GitHub first

---

## 🗄️ Database Setup

### Your Existing Render PostgreSQL Database

**Connection String Format:**
```
postgresql://username:password@hostname:5432/database_name
```

**Required Tables** (Auto-created by Drizzle on first run):
- `contractor_applications`
- `contractor_replies`
- `contractor_reports`
- `contractors`
- `conversation_history`
- `jobs`
- `work_sessions`
- `admin_settings`
- `admin_inspections`
- `csv_uploads`

---

## 🌐 Service 1: Node.js Web Application

### Create New Web Service on Render:

1. **Name:** `erdesignandbuild-web`
2. **Runtime:** Node
3. **Build Command:**
   ```bash
   npm install
   ```
4. **Start Command:**
   ```bash
   npm run dev
   ```

### Environment Variables:

```bash
# Database
DATABASE_URL=<your-render-postgres-connection-string>

# Node Environment
NODE_ENV=production

# Session Secret (generate random string)
SESSION_SECRET=<generate-random-32-char-string>

# Twilio (Voice Assistant)
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
TWILIO_PHONE_NUMBER=<your-twilio-number>

# ElevenLabs (Text-to-Speech)
ELEVEN_API_KEY=<your-elevenlabs-key>
ELEVEN_VOICE_ID=<your-voice-id>

# SendGrid (Email)
SENDGRID_API_KEY=<your-sendgrid-key>

# Python API URL (will be set after creating Python service)
PYTHON_API_URL=https://erdesignandbuild-telegram-api.onrender.com

# Finance API (if using external finance app)
FINANCE_API_BASE=<your-finance-api-url>

# Public URL (Render auto-generates)
PUBLIC_URL=https://erdesignandbuild-web.onrender.com
```

### Health Check:
- **Path:** `/`
- **Expected Status:** 200

---

## 🐍 Service 2: Python FastAPI (Telegram Bot API)

### Create New Web Service on Render:

1. **Name:** `erdesignandbuild-telegram-api`
2. **Runtime:** Python 3
3. **Build Command:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Start Command:**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```

### Environment Variables:

```bash
# Database (same as Node.js service)
DATABASE_URL=<your-render-postgres-connection-string>

# Python Environment
PYTHON_ENV=production
```

### Health Check:
- **Path:** `/health`
- **Expected Status:** 200

---

## 🔗 Connect the Two Services

After both services are deployed:

1. **Update Node.js service** environment variable:
   ```bash
   PYTHON_API_URL=https://erdesignandbuild-telegram-api.onrender.com
   ```

2. **The Node.js proxy** at `/api/telegram/*` will forward requests to the Python service

---

## 📦 Files Required for Deployment

### Root Directory Files:
- ✅ `render.yaml` - Infrastructure as code (optional)
- ✅ `package.json` - Node.js dependencies
- ✅ `requirements.txt` - Python dependencies
- ✅ `app.py` - Python FastAPI application
- ✅ `server/` - Node.js Express server
- ✅ `client/` - React frontend
- ✅ `shared/` - TypeScript schemas

### Files to EXCLUDE (add to .gitignore):
```
node_modules/
.pythonlibs/
.venv/
dist/
.env
*.log
.DS_Store
```

---

## 🚀 Deployment Steps

### Step 1: Prepare GitHub Repository

```bash
# Create .gitignore
echo "node_modules/
.pythonlibs/
.venv/
dist/
.env
*.log" > .gitignore

# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit for Render deployment"

# Push to GitHub
git remote add origin https://github.com/yourusername/erdesignandbuild.git
git push -u origin main
```

### Step 2: Deploy Python Service First

1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name:** `erdesignandbuild-telegram-api`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (DATABASE_URL)
6. Click "Create Web Service"
7. **Copy the service URL** (e.g., `https://erdesignandbuild-telegram-api.onrender.com`)

### Step 3: Deploy Node.js Service

1. Click "New +" → "Web Service"
2. Connect same GitHub repository
3. Configure:
   - **Name:** `erdesignandbuild-web`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm run dev`
4. Add ALL environment variables (including PYTHON_API_URL from Step 2)
5. Click "Create Web Service"

### Step 4: Verify Deployment

**Test Python API:**
```bash
curl https://erdesignandbuild-telegram-api.onrender.com/health
```
Expected: `{"status":"healthy","database":"connected"}`

**Test Node.js Web App:**
```bash
curl https://erdesignandbuild-web.onrender.com/
```
Expected: HTML page loads

**Test Telegram API via Proxy:**
```bash
curl https://erdesignandbuild-web.onrender.com/api/telegram/conversation-history/7617462316
```
Expected: `{"success":true,"messages":[...]}`

---

## 🔧 Troubleshooting

### Build Failures

**Node.js build fails:**
- Check `package.json` has all dependencies
- Ensure `node_modules` is not committed
- Verify build command: `npm install`

**Python build fails:**
- Check `requirements.txt` exists
- Verify Python version compatibility
- Ensure `.pythonlibs` is not committed

### Runtime Errors

**Database connection errors:**
- Verify `DATABASE_URL` is set correctly in both services
- Check database allows external connections
- Test connection string manually

**Proxy errors (503):**
- Verify `PYTHON_API_URL` is set in Node.js service
- Check Python service is running and healthy
- Test direct Python API endpoint first

---

## 📊 Post-Deployment Checklist

- [ ] Both services show "Live" status on Render
- [ ] Health checks pass (green checkmarks)
- [ ] Database tables auto-created
- [ ] Login page loads at main URL
- [ ] Admin can log in successfully
- [ ] Telegram API endpoints respond
- [ ] Voice assistant works (Twilio integration)

---

## 💰 Render Pricing Estimate

**Free Tier:**
- 750 hours/month free (both services combined)
- Services spin down after 15 mins of inactivity
- Cold start time: ~30 seconds

**Paid Plans (Recommended for Production):**
- **Starter:** $7/month per service = $14/month total
  - Always-on (no cold starts)
  - 512 MB RAM
  - Custom domains
  
- **PostgreSQL:** $7/month
  - 1 GB storage
  - Automatic backups

**Total Monthly Cost:** ~$21/month for always-on production setup

---

## 🆘 Need Help?

1. Check Render logs: Dashboard → Service → Logs tab
2. Review build logs for errors
3. Test API endpoints individually
4. Contact Render support: support@render.com

---

## 🎉 Success!

Your ERdesignandbuild app is now live on Render with:
- ✅ Better uptime and reliability
- ✅ Everything in one place
- ✅ Automatic deployments from GitHub
- ✅ Professional hosting infrastructure
