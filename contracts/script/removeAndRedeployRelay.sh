#!/bin/bash

# Script đơn giản để remove và redeploy RelayProxyFacet
# Chỉ cần sửa các biến bên dưới

# ===== CONFIGURATION - SỬA CÁC GIÁ TRỊ NÀY =====
NETWORK="localhost"                    # Network: localhost, sepolia, mainnet
DIAMOND_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"  # Địa chỉ diamond
RELAY_AGGREGATOR_ADDRESS="0x1234567890123456789012345678901234567890"  # Địa chỉ relay aggregator
VERIFY="false"                         # Verify contract: true/false
# ==============================================

echo "🚀 Starting RelayProxyFacet remove and redeploy..."
echo "Network: $NETWORK"
echo "Diamond: $DIAMOND_ADDRESS"
echo "Relay: $RELAY_AGGREGATOR_ADDRESS"
echo "Verify: $VERIFY"
echo ""

# Set environment variables
export DIAMOND_ADDRESS="$DIAMOND_ADDRESS"
export FACET_NAME="RelayProxyFacet"
export CONSTRUCTOR_ARGS="[\"$RELAY_AGGREGATOR_ADDRESS\"]"
export VERIFY_CONTRACT="$VERIFY"

# Run script
cd contracts
./script/removeAndRedeployFacet.sh "$NETWORK" "RelayProxyFacet" "$CONSTRUCTOR_ARGS" "$VERIFY"

echo "✅ RelayProxyFacet remove and redeploy completed!" 