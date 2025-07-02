#!/bin/bash

# ================================
# MoonXFarm Auth Service - Build & Test Script
# ================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="auth-service"
IMAGE_NAME="moonx/auth-service"
TAG="${1:-latest}"
CONTAINER_NAME="moonx-auth-test"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup containers
cleanup() {
    log_info "Cleaning up test containers..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}

# Set up cleanup trap
trap cleanup EXIT

# Step 1: Validate environment
log_info "🔍 Validating environment..."

# Check if we're in the correct directory (monorepo root)
if [[ ! -f "pnpm-workspace.yaml" ]]; then
    log_error "This script must be run from the monorepo root directory"
    exit 1
fi

# Check if required files exist
required_files=(
    "services/auth-service/package.json"
    "packages/common/package.json"
    "packages/infrastructure/package.json"
    "configs/package.json"
    "pnpm-lock.yaml"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        log_error "Required file not found: $file"
        exit 1
    fi
done

log_success "Environment validation passed"

# Step 2: Build the Docker image
log_info "🏗️  Building Docker image: $IMAGE_NAME:$TAG"

docker build \
    -f services/auth-service/Dockerfile \
    -t $IMAGE_NAME:$TAG \
    . # Build from monorepo root

log_success "Docker image built successfully"

# Step 3: Test the image
log_info "🧪 Testing the Docker image..."

# Start container in background
log_info "Starting container for testing..."
docker run -d \
    --name $CONTAINER_NAME \
    -p 3001:3001 \
    -e NODE_ENV=production \
    -e JWT_SECRET=test-secret-key-for-testing-only \
    -e PRIVY_APP_ID=test-app-id \
    -e PRIVY_APP_SECRET=test-app-secret \
    -e DATABASE_URL=postgresql://test:test@localhost:5432/test \
    -e REDIS_URL=redis://localhost:6379 \
    $IMAGE_NAME:$TAG

# Wait for container to start
log_info "Waiting for container to start..."
sleep 10

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    log_error "Container failed to start"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Test health endpoint (with timeout)
log_info "Testing health endpoint..."
max_attempts=30
attempt=1

while [[ $attempt -le $max_attempts ]]; do
    if curl -f -s http://localhost:3001/api/v1/health > /dev/null; then
        log_success "Health check passed"
        break
    fi
    
    if [[ $attempt -eq $max_attempts ]]; then
        log_error "Health check failed after $max_attempts attempts"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    
    log_info "Health check attempt $attempt/$max_attempts failed, retrying in 2s..."
    sleep 2
    ((attempt++))
done

# Test API structure
log_info "Testing API structure..."
response=$(curl -s http://localhost:3001/api/v1/health)
if echo "$response" | grep -q "success"; then
    log_success "API structure test passed"
else
    log_warning "API structure test failed. Response: $response"
fi

# Check container logs for errors
log_info "Checking container logs for errors..."
if docker logs $CONTAINER_NAME 2>&1 | grep -i "error\|exception\|failed" | grep -v "test"; then
    log_warning "Found potential errors in logs (check above)"
else
    log_success "No errors found in container logs"
fi

# Step 4: Image analysis
log_info "📊 Analyzing Docker image..."

# Get image size
image_size=$(docker images $IMAGE_NAME:$TAG --format "table {{.Size}}" | tail -n 1)
log_info "Image size: $image_size"

# Security scan (if available)
if command -v docker-scan &> /dev/null; then
    log_info "Running security scan..."
    docker scan $IMAGE_NAME:$TAG || log_warning "Security scan failed or not available"
fi

# Step 5: Performance test
log_info "🚀 Running basic performance test..."

# Simple load test with curl
log_info "Testing response time..."
response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001/api/v1/health)
log_info "Response time: ${response_time}s"

if (( $(echo "$response_time < 1.0" | bc -l) )); then
    log_success "Response time is good (< 1s)"
else
    log_warning "Response time is slow (> 1s)"
fi

# Final success message
log_success "🎉 Build and test completed successfully!"
log_info "Image: $IMAGE_NAME:$TAG"
log_info "Size: $image_size"
log_info "Health endpoint: http://localhost:3001/api/v1/health"

# Optional: Push to registry
if [[ "$2" == "--push" ]]; then
    log_info "🚀 Pushing to registry..."
    docker push $IMAGE_NAME:$TAG
    log_success "Image pushed successfully"
fi

# Optional: Keep container running
if [[ "$2" == "--keep" ]] || [[ "$3" == "--keep" ]]; then
    log_info "Container will be kept running for manual testing"
    log_info "Access it at: http://localhost:3001"
    log_info "Stop it with: docker stop $CONTAINER_NAME"
    trap - EXIT  # Disable cleanup trap
else
    cleanup
fi

log_success "Script completed successfully! 🎉" 