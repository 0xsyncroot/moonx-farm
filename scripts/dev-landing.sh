#!/bin/bash

# MoonX Farm Landing Page Development Script
echo "🚀 Starting MoonX Farm Landing Page..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if landing page exists
if [ ! -d "apps/landing" ]; then
    echo "❌ Error: Landing page project not found at apps/landing"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "apps/landing/node_modules" ]; then
    echo "📦 Installing landing page dependencies..."
    cd apps/landing && npm install && cd ../..
fi

# Start landing page development server
echo "🌟 Starting landing page at http://localhost:3001"
echo "🔗 Main app should be running at http://localhost:3000"
echo ""
echo "📋 Available commands:"
echo "  - Ctrl+C to stop the server"
echo "  - Open http://localhost:3001 to view landing page"
echo "  - Open http://localhost:3000 to view main app"
echo ""

cd apps/landing && npm run dev 