#!/bin/bash

# Start Python voice assistant on port 8000
echo "🐍 Starting Python voice assistant on port 8000..."
python3 app.py &
PYTHON_PID=$!

# Start Node.js app on port 5000
echo "🟢 Starting Node.js app on port 5000..."
npm run dev &
NODE_PID=$!

# Wait for both processes
wait $PYTHON_PID $NODE_PID
