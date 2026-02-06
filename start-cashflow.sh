#!/bin/bash

# ERdesignandbuild Cash Flow System Startup Script
# This script starts the cash flow system on a separate port to avoid conflicts

echo "🏗️ Starting ERdesignandbuild Cash Flow System..."
echo "📊 This runs independently of the main GPS tracking system"

# Set cash flow specific environment
export CASHFLOW_PORT=5001
export NODE_ENV=development
export DATABASE_URL="${DATABASE_URL}"

# Start the cashflow server (which handles both API and Client via Vite)
# Start the cashflow server (which handles both API and Client via Vite)
# We use esbuild + node because tsx has issues with pg native bindings in this environment
# Ensure we are in project root
npx esbuild server-cashflow/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist-cashflow
node dist-cashflow/index.js