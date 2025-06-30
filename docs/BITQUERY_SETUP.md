# Bitquery API Setup Guide

## Overview

MoonXFarm now integrates with Bitquery API through the Core Service to provide real historical OHLCV (Open, High, Low, Close, Volume) data for trading charts. The system automatically fetches data based on the actual tokens selected by users in the token selector, not just predefined pairs.

## Architecture

```
Frontend (Next.js) → Core Service → Bitquery API
```

- **Frontend**: Makes requests to Core Service API
- **Core Service**: Handles Bitquery API calls, rate limiting, and data processing
- **Bitquery API**: Provides real OHLCV data from DEXes

## Benefits

- **Real Market Data**: Get actual historical price data from DEXes
- **Dynamic Token Pairs**: Automatically fetches data for any token pair selected by users
- **Multiple Networks**: Support for Ethereum, BSC, Polygon, Base, and more
- **High Quality**: Professional-grade data used by trading platforms
- **Free Tier**: Generous free tier with 100 requests per minute
- **Secure**: API keys stored securely on backend, not exposed to frontend
- **Centralized**: All Bitquery logic handled by Core Service

## Setup Instructions

### 1. Get Bitquery API Key

1. Visit [Bitquery.io](https://bitquery.io/account/api)
2. Create a free account
3. Navigate to API section
4. Generate a new API key
5. Copy the API key

### 2. Configure Core Service Environment

Add the API key to your Core Service environment variables:

```bash
# services/core-service/.env
BITQUERY_API_KEY=your_api_key_here
```

### 3. Configure Frontend Environment

Add the Core Service URL to your frontend environment:

```bash
# apps/web/.env.local
NEXT_PUBLIC_CORE_SERVICE_URL=http://localhost:3001
```

### 4. Restart Services

After adding the environment variables, restart your services:

```bash
# Restart Core Service
cd services/core-service
npm run dev

# Restart Frontend
cd apps/web
npm run dev
```

## How It Works

### 1. User Token Selection
When users select tokens in the Orders page:
- **Limit Orders**: User selects "Sell" token and "Buy" token
- **DCA Strategy**: User selects "Buy" token and "Sell" token
- The system automatically detects the token pair and network

### 2. Data Fetching Flow
The system uses a smart fallback approach:

1. **Core Service Bitquery API** (Primary)
   - Frontend calls Core Service `/api/v1/bitquery/chart`
   - Core Service calls Bitquery API with proper authentication
   - Returns real OHLCV data for the exact token pair selected

2. **DexScreener API** (Secondary)
   - Gets current price data
   - Generates realistic historical simulation
   - Always available as backup

3. **Simulated Data** (Final Fallback)
   - Realistic price movements for any token
   - Ensures charts always work

### 3. Network Detection
The system automatically detects the network from:
- Token's `chainId` property
- Smart contract addresses
- User's wallet network

## API Endpoints

The Core Service provides these Bitquery endpoints:

- `GET /api/v1/bitquery/test` - Test connection
- `GET /api/v1/bitquery/ohlcv` - Get OHLCV for token pair
- `GET /api/v1/bitquery/symbol/:symbol` - Get OHLCV by symbol
- `GET /api/v1/bitquery/pair` - Get OHLCV for token pair by addresses
- `GET /api/v1/bitquery/chart` - Main endpoint for frontend (with fallback logic)

## Supported Networks

The integration supports these networks with automatic detection:

- **Ethereum** (Chain ID: 1)
- **BSC** (Chain ID: 56)
- **Polygon** (Chain ID: 137)
- **Avalanche** (Chain ID: 43114)
- **Arbitrum** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)
- **Base** (Chain ID: 8453)

## Common Token Pairs

For fallback scenarios, these common pairs are supported:

- **ETH/USDC** (Ethereum)
- **ETH/USDT** (Ethereum)  
- **BNB/BUSD** (BSC)
- **WETH/USDC** (Base)

## Usage Examples

### Limit Orders
1. User selects ETH as "Sell" token
2. User selects USDC as "Buy" token
3. System fetches ETH/USDC OHLCV data from Bitquery
4. Chart displays real historical data for ETH/USDC pair

### DCA Strategy
1. User selects BTC as "Buy" token
2. User selects USDT as "Sell" token
3. System fetches BTC/USDT OHLCV data from Bitquery
4. DCA simulation uses real historical prices

## Rate Limits

- **Free Tier**: 100 requests per minute
- **Paid Plans**: Higher limits available
- **Automatic Fallback**: System falls back to DexScreener if rate limit exceeded
- **Smart Caching**: Reduces API calls for repeated requests

## Troubleshooting

### API Key Not Working

1. Verify the API key is correct
2. Check environment variable name: `NEXT_PUBLIC_BITQUERY_API_KEY`
3. Restart development server after adding environment variable
4. Check browser console for error messages

### No Data Showing

1. Check if both tokens are selected in the interface
2. Verify token addresses are valid for the selected network
3. Check Bitquery API status at [status.bitquery.io](https://status.bitquery.io)
4. Look for fallback indicators in the UI

### Rate Limit Errors

1. Upgrade to a paid plan for higher limits
2. Implement caching to reduce API calls
3. Use DexScreener fallback for non-critical data

## API Documentation

For more details about the Bitquery API:

- [GraphQL API Docs](https://graphql.bitquery.io/)
- [Network Support](https://bitquery.io/docs/networks)
- [Rate Limits](https://bitquery.io/docs/rate-limits)

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your API key is valid
3. Test with a simple query first
4. Contact Bitquery support for API-specific issues 