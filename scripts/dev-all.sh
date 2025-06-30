#!/bin/bash

# MoonX Farm - Run All Apps Development Script
echo "🚀 Starting MoonX Farm Complete Development Environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all development servers..."
    jobs -p | xargs -r kill
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Start main web app in background
echo "🌐 Starting main web app at http://localhost:3000..."
if [ -d "apps/web" ]; then
    cd apps/web && npm run dev &
    WEB_PID=$!
    cd ../..
else
    echo "⚠️  Warning: Main web app not found at apps/web"
fi

# Wait a moment
sleep 2

# Start landing page in background
echo "📱 Starting landing page at http://localhost:3001..."
if [ -d "apps/landing" ]; then
    cd apps/landing && npm run dev &
    LANDING_PID=$!
    cd ../..
else
    echo "⚠️  Warning: Landing page not found at apps/landing"
fi

# Display information
echo ""
echo "✅ MoonX Farm Development Environment Ready!"
echo ""
echo "🌐 Applications:"
echo "  🔗 Main App:     http://localhost:3000"
echo "  🔗 Landing Page: http://localhost:3001"
echo ""
echo "⚡ Services (if running):"
echo "  🔗 Auth Service: http://localhost:3001 (Fastify)"
echo "  🔗 Core Service: http://localhost:3007 (Fastify)"
echo ""
echo "📋 Commands:"
echo "  - Ctrl+C to stop all servers"
echo "  - Open browser tabs for both apps"
echo ""

# Wait for all background jobs
wait 