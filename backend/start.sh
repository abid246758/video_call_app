#!/bin/bash

# Secure Video Chat Application Startup Script

echo "🚀 Starting Secure Video Chat Application..."

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use. Killing existing process..."
        lsof -ti:$1 | xargs kill -9
        sleep 2
    fi
}

# Check and clear ports
check_port 4001
check_port 3000
check_port 9000

echo "📦 Starting Backend Server..."
npm start &
BACKEND_PID=$!

echo "🔗 Starting PeerJS Server..."
node peer-server.js &
PEERJS_PID=$!

# Wait a moment for servers to start
sleep 3

echo "🎨 Starting Frontend Application..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Application started successfully!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:4001"
echo "🔗 PeerJS:   http://localhost:9000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $PEERJS_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for both processes
wait
