#!/bin/bash

set -e

echo "🚀 Setting up MoonXFarm Quote Service..."

# Source bashrc to get Go in PATH
source ~/.bashrc

# Export Go path explicitly
export PATH=$PATH:/usr/local/go/bin

# Check Go installation
echo "📋 Checking Go installation..."
go version

# Navigate to quote service directory
cd /root/develop/moonx-farm/services/quote-service

# Download dependencies
echo "📦 Downloading Go dependencies..."
go mod tidy

# Install development tools
echo "🔧 Installing development tools..."
go install github.com/swaggo/swag/cmd/swag@latest

# Generate Swagger documentation
echo "📚 Generating Swagger documentation..."
swag init -g cmd/server/main.go -o docs/

# Build the application
echo "🔨 Building quote service..."
go build -o bin/quote-service cmd/server/main.go

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file from env.example..."
    cp env.example .env
    echo "⚠️  Please update .env file with your API keys before running!"
fi

echo "✅ Setup completed successfully!"
echo ""
echo "To run the service:"
echo "  cd services/quote-service"
echo "  ./bin/quote-service"
echo ""
echo "Or to run in development mode:"
echo "  go run cmd/server/main.go"
echo ""
echo "API Documentation will be available at:"
echo "  http://localhost:3003/swagger/index.html" 