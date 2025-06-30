#!/bin/bash

# Script đơn giản để remove và redeploy RelayProxyFacet
# Chỉ cần sửa các biến bên dưới

# ===== CONFIGURATION - SỬA CÁC GIÁ TRỊ NÀY =====
NETWORK="bsc"                    # Network: localhost, sepolia, mainnet
DIAMOND_ADDRESS="0x5a96aC4B19E039cBc40cB6eB736069041BaABCC2"  # Địa chỉ diamond
RELAY_AGGREGATOR_ADDRESS="0xa5F565650890fBA1824Ee0F21EbBbF660a179934"  # Địa chỉ relay aggregator
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