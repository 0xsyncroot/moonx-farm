#!/bin/bash

# Script để remove và redeploy RelayProxyFacet
# Usage: ./removeAndRedeployRelay.sh <network> <relay_aggregator_address>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <network> <relay_aggregator_address>"
    echo ""
    echo "Arguments:"
    echo "  network               - Network to deploy to (e.g., localhost, sepolia, mainnet)"
    echo "  relay_aggregator_address - Address of Relay aggregator contract"
    echo ""
    echo "Examples:"
    echo "  $0 localhost 0x1234567890123456789012345678901234567890"
    echo "  $0 sepolia 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    echo "  $0 mainnet 0xE592427A0AEce92De3Edee1F18E0157C05861564"
    exit 1
fi

NETWORK=$1
RELAY_AGGREGATOR_ADDRESS=$2

# Validate network
if [ -z "$NETWORK" ]; then
    print_error "Network is required"
    exit 1
fi

# Validate relay aggregator address
if [ -z "$RELAY_AGGREGATOR_ADDRESS" ]; then
    print_error "Relay aggregator address is required"
    exit 1
fi

# Check if address format is valid (basic check)
if [[ ! $RELAY_AGGREGATOR_ADDRESS =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    print_error "Invalid relay aggregator address format"
    exit 1
fi

# Check if DIAMOND_ADDRESS is set
if [ -z "$DIAMOND_ADDRESS" ]; then
    print_error "DIAMOND_ADDRESS environment variable is required"
    echo "Please set it to your diamond contract address:"
    echo "export DIAMOND_ADDRESS=0x..."
    exit 1
fi

print_info "Starting RelayProxyFacet remove and redeploy process..."
echo ""
print_info "Configuration:"
echo "  Network: $NETWORK"
echo "  Facet Name: RelayProxyFacet"
echo "  Diamond Address: $DIAMOND_ADDRESS"
echo "  Relay Aggregator: $RELAY_AGGREGATOR_ADDRESS"
echo ""

# Set environment variables for the script
export FACET_NAME="RelayProxyFacet"
export CONSTRUCTOR_ARGS="[\"$RELAY_AGGREGATOR_ADDRESS\"]"
export VERIFY_CONTRACT="false"

# Run the remove and redeploy script
print_info "Running RelayProxyFacet remove and redeploy..."
cd contracts
./script/removeAndRedeployFacet.sh "$NETWORK" "RelayProxyFacet" "$CONSTRUCTOR_ARGS" "false"

print_success "RelayProxyFacet remove and redeploy completed successfully!" 