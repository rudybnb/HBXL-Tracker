#!/bin/bash

# 🚀 Prepare ERdesignandbuild for Render Deployment
# This script creates a clean deployment package

echo "🚀 Preparing Render deployment package..."

# Step 1: Rename Python requirements
echo "📦 Step 1: Rename python-requirements.txt to requirements.txt"
if [ -f "python-requirements.txt" ]; then
    cp python-requirements.txt requirements.txt
    echo "✅ Created requirements.txt"
else
    echo "⚠️ python-requirements.txt not found, creating minimal requirements.txt"
    cat > requirements.txt << EOF
fastapi==0.115.5
uvicorn[standard]==0.32.1
asyncpg==0.30.0
python-dotenv==1.0.1
pydantic==2.10.3
EOF
fi

# Step 2: Verify critical files exist
echo ""
echo "📋 Step 2: Verifying critical files..."
critical_files=("package.json" "app.py" "render.yaml" "requirements.txt" "server/index.ts")
missing_files=0

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ MISSING: $file"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -gt 0 ]; then
    echo ""
    echo "⚠️ Warning: $missing_files critical files missing!"
    echo "   Deployment may fail. Please create missing files."
fi

# Step 3: Clean up development artifacts
echo ""
echo "🧹 Step 3: Removing development artifacts..."
rm -rf node_modules .pythonlibs .venv __pycache__ dist .cache /tmp/logs
echo "✅ Cleaned up build artifacts"

# Step 4: Create deployment info
echo ""
echo "📝 Step 4: Creating deployment info..."
cat > DEPLOYMENT_INFO.txt << EOF
ERdesignandbuild - Render Deployment Package
===========================================

Generated: $(date)

Services Required:
------------------
1. Node.js Web Service (erdesignandbuild-web)
   - Runtime: Node
   - Build: npm install
   - Start: npm run dev
   - Port: Auto (Render assigns)

2. Python API Service (erdesignandbuild-telegram-api)
   - Runtime: Python 3
   - Build: pip install -r requirements.txt
   - Start: uvicorn app:app --host 0.0.0.0 --port \$PORT
   - Port: Auto (Render assigns)

Database:
---------
PostgreSQL (Connect your existing Render database)

Required Environment Variables:
-------------------------------
See RENDER_DEPLOYMENT_GUIDE.md for complete list

Node.js Service:
- DATABASE_URL
- SESSION_SECRET
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- ELEVEN_API_KEY
- ELEVEN_VOICE_ID
- PYTHON_API_URL (set after Python service deployed)

Python Service:
- DATABASE_URL

Next Steps:
-----------
1. Push this code to GitHub
2. Deploy Python service first on Render
3. Deploy Node.js service second
4. Set environment variables
5. Verify both services are live

For detailed instructions, see:
- RENDER_DEPLOYMENT_GUIDE.md
- DEPLOYMENT_CHECKLIST.md
EOF

echo "✅ Created DEPLOYMENT_INFO.txt"

# Step 5: Show file count
echo ""
echo "📊 Package Statistics:"
echo "   Total files: $(find . -type f | wc -l)"
echo "   TypeScript files: $(find . -name "*.ts" -o -name "*.tsx" | wc -l)"
echo "   Python files: $(find . -name "*.py" | wc -l)"
echo "   React components: $(find client/src -name "*.tsx" 2>/dev/null | wc -l)"

echo ""
echo "✅ Preparation complete!"
echo ""
echo "📦 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Commit and push to GitHub: git add . && git commit -m 'Prepare for Render' && git push"
echo "2. Follow DEPLOYMENT_CHECKLIST.md for Render setup"
echo "3. Deploy Python service first, then Node.js service"
echo ""
echo "Good luck! 🚀"
