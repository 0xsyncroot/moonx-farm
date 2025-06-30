#!/bin/bash

# Script wrapper để remove và redeploy facet
# Usage: ./removeAndRedeployFacet.sh <network> <facet_name> [constructor_args] [verify]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if required arguments are provided
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <network> <facet_name> [constructor_args] [verify]"
    echo ""
    echo "Arguments:"
    echo "  network         - Network to deploy to (e.g., localhost, sepolia, mainnet)"
    echo "  facet_name      - Name of the facet to remove and redeploy"
    echo "  constructor_args - JSON array of constructor arguments (optional)"
    echo "  verify          - Set to 'true' to verify contract on Etherscan (optional)"
    echo ""
    echo "Examples:"
    echo "  $0 localhost Test1Facet"
    echo "  $0 sepolia FeeCollectorFacet '[\"0x1234567890123456789012345678901234567890\"]'"
    echo "  $0 mainnet DiamondLoupeFacet '[]' true"
    exit 1
fi

NETWORK=$1
FACET_NAME=$2
CONSTRUCTOR_ARGS=${3:-"[]"}
VERIFY=${4:-"false"}

# Validate network
if [ -z "$NETWORK" ]; then
    print_error "Network is required"
    exit 1
fi

# Validate facet name
if [ -z "$FACET_NAME" ]; then
    print_error "Facet name is required"
    exit 1
fi

# Check if DIAMOND_ADDRESS is set
if [ -z "$DIAMOND_ADDRESS" ]; then
    print_error "DIAMOND_ADDRESS environment variable is required"
    echo "Please set it to your diamond contract address:"
    echo "export DIAMOND_ADDRESS=0x..."
    exit 1
fi

# Validate constructor args format
if ! echo "$CONSTRUCTOR_ARGS" | jq . >/dev/null 2>&1; then
    print_error "Constructor args must be valid JSON array"
    echo "Example: '[\"0x1234567890123456789012345678901234567890\"]'"
    exit 1
fi

print_info "Starting facet remove and redeploy process..."
echo ""
print_info "Configuration:"
echo "  Network: $NETWORK"
echo "  Facet Name: $FACET_NAME"
echo "  Diamond Address: $DIAMOND_ADDRESS"
echo "  Constructor Args: $CONSTRUCTOR_ARGS"
echo "  Verify: $VERIFY"
echo ""

# Set environment variables
export FACET_NAME="$FACET_NAME"
export CONSTRUCTOR_ARGS="$CONSTRUCTOR_ARGS"
export VERIFY_CONTRACT="$VERIFY"

# Run the script
print_info "Running remove and redeploy script..."
npx hardhat run script/removeAndRedeployFacet.js --network "$NETWORK"

print_success "Facet remove and redeploy completed successfully!" 