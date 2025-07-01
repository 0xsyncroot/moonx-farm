#!/bin/bash

# Script đơn giản để deploy RelayProxyFacet
# Usage: ./deployRelay.sh [network]
# Run from anywhere: bash contracts/script/deployRelay.sh [network]

# ===== CONFIGURATION - SỬA CÁC GIÁ TRỊ NÀY =====
NETWORK="${1:-bsc}"                    # Network: localhost, sepolia, mainnet, bsc
DIAMOND_ADDRESS="0x5a96aC4B19E039cBc40cB6eB736069041BaABCC2"  # Địa chỉ diamond
RELAY_ADDRESS="0xa5F565650890fBA1824Ee0F21EbBbF660a179934"    # Địa chỉ relay aggregator
# ==============================================

echo "🚀 Starting RelayProxyFacet deployment..."
echo "Network: $NETWORK"
echo "Diamond: $DIAMOND_ADDRESS"
echo "Relay: $RELAY_ADDRESS"
echo ""

# Set environment variables
export DIAMOND_ADDRESS="$DIAMOND_ADDRESS"
export RELAY_ADDRESS="$RELAY_ADDRESS"

# Find contracts directory
if [ -d "contracts" ]; then
    cd contracts
elif [ -f "hardhat.config.js" ]; then
    # Already in contracts directory
    :
else
    echo "❌ Error: Cannot find contracts directory or hardhat.config.js"
    echo "Please run from project root or contracts directory"
    exit 1
fi

echo "📂 Running from: $(pwd)"
npx hardhat run script/deployRelay.js --network "$NETWORK"

echo "✅ RelayProxyFacet deployment completed!" 