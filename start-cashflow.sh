#!/bin/bash

# ERdesignandbuild Cash Flow System Startup Script
# This script starts the cash flow system on a separate port to avoid conflicts

echo "🏗️ Starting ERdesignandbuild Cash Flow System..."
echo "📊 This runs independently of the main GPS tracking system"

# Set cash flow specific environment
export CASHFLOW_PORT=5001
export NODE_ENV=development
export DATABASE_URL="${DATABASE_URL}"

# Start the cash flow server
cd server-cashflow
tsx index.ts &
CASHFLOW_SERVER_PID=$!

# Start the cash flow frontend
cd ../client-cashflow
npm run dev &
CASHFLOW_CLIENT_PID=$!

echo "✅ Cash Flow System Started Successfully!"
echo "🌐 Main System: http://localhost:5000 (GPS Tracking)"
echo "💰 Cash Flow System: http://localhost:5001 (Financial Tracking)"
echo ""
echo "Press Ctrl+C to stop both systems"

# Wait for both processes
wait $CASHFLOW_SERVER_PID $CASHFLOW_CLIENT_PID