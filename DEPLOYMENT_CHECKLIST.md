# ✅ Render Deployment Checklist

## 📦 Step 1: Prepare Files

Create/verify these files exist:

### Required Files:
- [x] `render.yaml` - Render configuration
- [x] `python-requirements.txt` - Python dependencies (rename to `requirements.txt` before deploy)
- [x] `.gitignore` - Exclude build artifacts
- [x] `RENDER_DEPLOYMENT_GUIDE.md` - Full deployment guide
- [x] `package.json` - Node.js dependencies
- [x] `app.py` - Python FastAPI app

### Rename Before Deploy:
```bash
# Rename python-requirements.txt to requirements.txt
mv python-requirements.txt requirements.txt
```

---

## 🔑 Step 2: Collect Environment Variables

### Node.js Service Environment Variables:

Copy these values from your current Replit environment:

```bash
# Required - Database
DATABASE_URL="postgresql://username:password@hostname:5432/database"

# Required - Session
SESSION_SECRET="<generate-random-32-char-string>"

# Required - Twilio (Voice Assistant)
TWILIO_ACCOUNT_SID="<from-replit-secrets>"
TWILIO_AUTH_TOKEN="<from-replit-secrets>"
TWILIO_PHONE_NUMBER="<from-replit-secrets>"

# Required - ElevenLabs (TTS)
ELEVEN_API_KEY="<from-replit-secrets>"
ELEVEN_VOICE_ID="<from-replit-secrets>"

# Optional - SendGrid
SENDGRID_API_KEY="<from-replit-secrets-if-used>"

# Optional - Finance API
FINANCE_API_BASE="<from-replit-secrets-if-used>"

# System (auto-set by Render)
NODE_ENV="production"
PUBLIC_URL="<will-be-auto-generated>"
PYTHON_API_URL="<set-after-python-service-deployed>"
```

### Python Service Environment Variables:

```bash
# Required - Database (same as Node.js)
DATABASE_URL="postgresql://username:password@hostname:5432/database"

# System
PYTHON_ENV="production"
```

---

## 🗂️ Step 3: Create GitHub Repository

```bash
# 1. Initialize git (if not already)
git init

# 2. Add all files
git add .

# 3. Commit
git commit -m "Prepare for Render deployment"

# 4. Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/erdesignandbuild.git
git branch -M main
git push -u origin main
```

---

## 🐍 Step 4: Deploy Python Service FIRST

### On Render Dashboard:

1. Click "New +" → "Web Service"
2. Connect GitHub repository
3. Configure:
   - **Name**: `erdesignandbuild-telegram-api`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Region**: Choose closest to your users
   - **Instance Type**: Free or Starter ($7/mo)

4. Environment Variables:
   - `DATABASE_URL` = (your Render PostgreSQL connection string)
   - `PYTHON_ENV` = production

5. Click "Create Web Service"

6. **Wait for deployment** ⏳

7. **Copy the service URL** (example: `https://erdesignandbuild-telegram-api.onrender.com`)

8. **Test it**:
   ```bash
   curl https://YOUR-PYTHON-SERVICE.onrender.com/health
   ```
   Should return: `{"status":"healthy","database":"connected"}`

---

## 🌐 Step 5: Deploy Node.js Service SECOND

### On Render Dashboard:

1. Click "New +" → "Web Service"
2. Connect SAME GitHub repository
3. Configure:
   - **Name**: `erdesignandbuild-web`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run dev`
   - **Region**: Same as Python service
   - **Instance Type**: Free or Starter ($7/mo)

4. Add ALL Environment Variables (from Step 2)
   - **Important**: Set `PYTHON_API_URL` to the URL from Step 4

5. Click "Create Web Service"

6. **Wait for deployment** ⏳

7. **Test it**:
   ```bash
   # Test main app
   curl https://YOUR-WEB-SERVICE.onrender.com/

   # Test Telegram API proxy
   curl https://YOUR-WEB-SERVICE.onrender.com/api/telegram/conversation-history/7617462316
   ```

---

## 🧪 Step 6: Verify Everything Works

### Test Checklist:

- [ ] Python service health: `GET /health` returns 200
- [ ] Node.js main page loads
- [ ] Login page accessible
- [ ] Admin can log in
- [ ] Telegram API endpoints respond
- [ ] Database tables auto-created
- [ ] GPS dashboard loads for contractors

### Test Commands:

```bash
# Replace with your actual URLs
PYTHON_URL="https://erdesignandbuild-telegram-api.onrender.com"
WEB_URL="https://erdesignandbuild-web.onrender.com"

# Test Python API
curl $PYTHON_URL/health

# Test Telegram endpoints
curl "$WEB_URL/api/telegram/conversation-history/7617462316?limit=5"

# Test worker type
curl "$WEB_URL/api/telegram/worker-type/7617462316"
```

---

## 📊 Step 7: Monitor Deployment

### On Render Dashboard:

1. Check **Logs** tab for both services
2. Look for errors in red
3. Verify database connections successful
4. Monitor response times

### Common Issues:

**Build fails:**
- Check build logs for missing dependencies
- Verify `package.json` or `requirements.txt` is correct

**Runtime crash:**
- Check `DATABASE_URL` is set correctly
- Verify all required environment variables present
- Review application logs for stack traces

**503 errors:**
- Python service may be down
- Check Python service health endpoint
- Verify `PYTHON_API_URL` in Node.js service

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Both services show "Live" (green) status
✅ Health checks passing
✅ Login page loads
✅ Admin dashboard accessible
✅ Contractor GPS dashboard works
✅ Telegram API endpoints respond
✅ Database tables populated
✅ No errors in logs

---

## 💰 Estimated Costs

### Free Tier (Testing):
- 750 hours/month shared across services
- Services sleep after 15 mins inactivity
- Cold start: ~30 seconds

### Paid Production (Recommended):
- **Node.js Web Service**: $7/month (Starter)
- **Python Telegram API**: $7/month (Starter)
- **PostgreSQL Database**: $7/month (if not using existing)

**Total**: ~$14-21/month for always-on production

---

## 📞 Support

**Render Docs**: https://render.com/docs
**Render Support**: support@render.com
**Community**: https://community.render.com

---

## 🔄 Auto-Deploy Setup

### Enable Auto-Deploy from GitHub:

1. In each service settings
2. Go to "Settings" tab
3. Enable "Auto-Deploy"
4. Choose branch: `main`

Now every `git push` automatically deploys! 🚀
