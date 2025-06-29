#!/bin/bash

# Script to build auth-service Docker image locally (no push)
# Usage: ./build-local.sh [tag]
# If no tag provided, it will use "local-test"

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get tag from parameter or use default
TAG=${1:-"local-test"}
IMAGE_NAME="moonx-auth-service:${TAG}"

print_step "Building Docker image locally: ${IMAGE_NAME}"

# Check if we're in the right place
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found. Run from services/auth-service directory."
    exit 1
fi

print_info "📁 Current directory: $(pwd)"
print_info "🐋 Build context: $(realpath ../../)"
print_info "📄 Dockerfile: services/auth-service/Dockerfile"

# Change to project root for build context
cd ../../

print_step "Building image..."
docker build -f services/auth-service/Dockerfile -t "${IMAGE_NAME}" .

print_info "✅ Build completed successfully!"
print_info "🚀 To run the image:"
print_info "   docker run -p 3001:3001 ${IMAGE_NAME}"
print_info ""
print_info "🔍 To check the image:"
print_info "   docker images | grep moonx-auth-service" 