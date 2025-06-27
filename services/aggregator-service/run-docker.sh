#!/bin/bash

# Script to run aggregator-service with docker-compose
# Usage: ./run-docker.sh [start|stop|restart|logs|status]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the aggregator service"
    echo "  stop      Stop the aggregator service"
    echo "  restart   Restart the aggregator service"
    echo "  logs      Show logs from the service"
    echo "  status    Show status of containers"
    echo "  build     Build and start the service"
    echo "  clean     Stop and remove containers"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs"
    echo "  $0 status"
}

# Main logic
case "${1:-start}" in
    start)
        print_step "Starting aggregator service..."
        docker-compose up -d
        print_info "Service started. Check status with: $0 status"
        print_info "View logs with: $0 logs"
        ;;
    stop)
        print_step "Stopping aggregator service..."
        docker-compose down
        print_info "Service stopped."
        ;;
    restart)
        print_step "Restarting aggregator service..."
        docker-compose restart
        print_info "Service restarted."
        ;;
    logs)
        print_step "Showing logs..."
        docker-compose logs -f aggregator-service
        ;;
    status)
        print_step "Container status:"
        docker-compose ps
        ;;
    build)
        print_step "Building and starting service..."
        docker-compose up -d --build
        print_info "Service built and started."
        ;;
    clean)
        print_step "Cleaning up containers..."
        docker-compose down -v
        print_info "Containers and volumes removed."
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac 