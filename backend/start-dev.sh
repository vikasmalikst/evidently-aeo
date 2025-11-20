#!/bin/bash

# Safe dev script that kills any process using port 3000 before starting

PORT=${PORT:-3000}

echo "🔍 Checking if port $PORT is in use..."

# Find process using the port
PID=$(lsof -ti:$PORT)

if [ ! -z "$PID" ]; then
  echo "⚠️  Port $PORT is already in use by process $PID"
  echo "🛑 Killing process $PID..."
  kill -9 $PID 2>/dev/null
  
  # Wait a moment for the port to be released
  sleep 1
  
  # Verify the port is now free
  if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "❌ Failed to free port $PORT. Please check manually."
    exit 1
  else
    echo "✅ Port $PORT is now free"
  fi
else
  echo "✅ Port $PORT is available"
fi

echo "🚀 Starting development server..."
npm run dev

