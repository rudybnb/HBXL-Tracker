# 🔑 COPY THESE SECRETS NOW (Before You Leave Replit!)

## ⚠️ IMPORTANT: Copy these values RIGHT NOW before downloading!

You'll need these for Render deployment. Copy them somewhere safe (like a text file on your computer).

---

## 📋 Secrets to Copy from Replit

Go to the **Secrets** tab (lock icon 🔒 on the left) in this Replit and copy these values:

### **1. Twilio (Voice Assistant)**
```
TWILIO_ACCOUNT_SID = 
TWILIO_AUTH_TOKEN = 
TWILIO_PHONE_NUMBER = 
```

### **2. ElevenLabs (Text-to-Speech)**
```
ELEVEN_API_KEY = 
ELEVEN_VOICE_ID = 
```

### **3. Database (from Render)**
```
DATABASE_URL = 
```
(Get this from your Render PostgreSQL dashboard)

### **4. Optional (if you use them)**
```
SENDGRID_API_KEY = 
FINANCE_API_BASE = 
```

### **5. Generate New on Your Computer**
```
SESSION_SECRET = 
```
**Generate this:** Go to https://randomkeygen.com and pick any 32-character string

---

## ✅ Checklist

- [ ] I copied all Twilio values
- [ ] I copied all ElevenLabs values
- [ ] I have my Render DATABASE_URL
- [ ] I generated a SESSION_SECRET
- [ ] I saved everything to a text file

---

## 🎯 Where to Use These

After you deploy to Render, you'll paste these into the **Environment Variables** section when creating each service.

**Python Service** needs:
- DATABASE_URL

**Node.js Service** needs:
- DATABASE_URL
- SESSION_SECRET
- PYTHON_API_URL (you'll get this after Python service deploys)
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- ELEVEN_API_KEY
- ELEVEN_VOICE_ID

---

**Ready?** Copy these values NOW, then download the ZIP! 📦
