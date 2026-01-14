#!/bin/bash
echo "🐍 Starting Python FastAPI server on port 8000..."
echo "📊 Database: ${DATABASE_URL:0:30}..."

# Use DATABASE_URL from environment (set in Replit Secrets)
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
