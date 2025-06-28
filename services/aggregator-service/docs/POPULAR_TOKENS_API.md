# Popular Tokens API

## Overview

The Popular Tokens API provides a curated list of popular tokens across multiple chains with real-time price data from Binance API. This API is designed for cross-chain swap interfaces and token selection components.

## Endpoint

```
GET /api/v1/tokens/popular
```

## Features

✅ **Multi-chain Support**: Tokens across 6 supported chains (Ethereum, Base, BSC, Polygon, Arbitrum, Optimism)  
✅ **Real-time Prices**: Live price data from Binance 24hr ticker API  
✅ **Cross-chain Ready**: Token addresses for each supported chain  
✅ **GitHub Assets**: Lightweight token images from Trust Wallet assets  
✅ **Volume Data**: 24hr trading volume and price change percentage  
✅ **Fast Response**: Optimized for UI components (~200-500ms)  

## Response Format

```json
{
  "tokens": [
    {
      "address": "0x0000000000000000000000000000000000000000",
      "symbol": "ETH", 
      "name": "Ethereum",
      "decimals": 18,
      "chainId": 1,
      "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
      "isNative": true,
      "popular": true,
      "priceUSD": 3247.82,
      "change24h": 2.4,
      "volume24h": 12450000000,
      "lastUpdated": "2024-01-15T10:30:00Z",
      "source": "binance"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 12,
  "updatedAt": "2024-01-15T10:30:00Z",
  "metadata": {
    "source": "binance+github",
    "type": "popular"
  }
}
```

## Supported Tokens

### Native Tokens
- **ETH** (Ethereum, Base, Arbitrum, Optimism)
- **BNB** (BSC)  
- **MATIC** (Polygon)

### Major Tokens
- **WBTC** (Wrapped Bitcoin)
- **USDC** (USD Coin - all chains)
- **USDT** (Tether USD)

## Chain Support

| Chain ID | Network | Native Token | USDC Address |
|----------|---------|--------------|--------------|
| 1 | Ethereum | ETH | 0xA0b86a33E6441ad06b6b6F0E5Ce7dF9e7fC56a5e |
| 8453 | Base | ETH | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| 56 | BSC | BNB | 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d |
| 137 | Polygon | MATIC | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 |
| 42161 | Arbitrum | ETH | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| 10 | Optimism | ETH | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 |

## Price Data Integration

The API integrates with Binance 24hr ticker API to provide:
- **Real-time Price**: Latest USD price  
- **24hr Change**: Price change percentage
- **Volume**: 24hr trading volume in USD

### Binance Symbol Mapping
- ETH → ETHUSDT
- WBTC → BTCUSDT  
- BNB → BNBUSDT
- MATIC → MATICUSDT
- USDC/USDT → USDCUSDT

## Frontend Integration

```typescript
// Fetch popular tokens
const response = await fetch(`${AGGREGATOR_API_URL}/tokens/popular`)
const data = await response.json()

// Use in token selector
data.tokens.forEach(token => {
  console.log(`${token.symbol}: $${token.priceUSD} (${token.change24h}%)`)
})
```

## Performance

- **Response Time**: ~200-500ms
- **Cache Strategy**: None (real-time data priority)
- **Rate Limits**: Standard aggregator service limits
- **Error Handling**: Graceful fallback to cached prices

## Error Handling

```json
{
  "error": "Failed to get popular tokens",
  "message": "Binance API error: timeout",
  "code": 500
}
```

## Use Cases

1. **Token Selection UI**: Dropdown/modal for swap interfaces
2. **Popular Token List**: Dashboard token listings  
3. **Cross-chain Trading**: Multi-chain token selection
4. **Price Displays**: Real-time price components

## Development

The API is implemented in:
- **Backend**: `services/aggregator-service/internal/handlers/quote.go`
- **Service Logic**: `services/aggregator-service/internal/services/aggregator_tokens.go`
- **Frontend**: `apps/web/src/components/swap/token-list.tsx`

## Configuration

Configured via environment variable:
```bash
NEXT_PUBLIC_AGGREGATOR_API_URL=http://localhost:3003/api/v1
``` 