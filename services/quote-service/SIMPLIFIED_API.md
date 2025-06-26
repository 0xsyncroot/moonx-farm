# Simplified Quote Service API

## Overview

Quote service đã được đơn giản hóa thành **2 API chính** theo yêu cầu thực tế:

1. **GET /api/v1/quote** - Lấy best quote (same-chain & cross-chain)
2. **GET /api/v1/tokens/search** - Search tokens nhanh nhất với prioritization theo chain

## 🎯 API Endpoints

### 1. Get Best Quote

**Endpoint:** `GET /api/v1/quote`

**Mô tả:** Lấy best quote từ tất cả sources (LiFi, OneInch, Relay) với support cross-chain

**Parameters:**
- `fromChainId` (required): Chain ID nguồn
- `toChainId` (required): Chain ID đích  
- `fromToken` (required): Địa chỉ token nguồn
- `toToken` (required): Địa chỉ token đích
- `amount` (required): Số lượng token swap (theo decimals)
- `userAddress` (optional): Địa chỉ wallet user
- `slippage` (optional): Slippage tolerance (default: 0.5)

**Example Request:**
```bash
GET /api/v1/quote?fromChainId=8453&toChainId=8453&fromToken=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&toToken=0x4200000000000000000000000000000000000006&amount=1000000&userAddress=0x123...&slippage=0.5
```

**Response:**
```json
{
  "quote": {
    "id": "quote_123",
    "fromToken": {
      "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "chainId": 8453
    },
    "toToken": {
      "address": "0x4200000000000000000000000000000000000006", 
      "symbol": "WETH",
      "name": "Wrapped Ether",
      "decimals": 18,
      "chainId": 8453
    },
    "fromAmount": "1000000",
    "toAmount": "380145200000000000",
    "price": "0.00038",
    "provider": "lifi",
    "gasEstimate": {
      "gasLimit": 180000,
      "gasPrice": "5000000000",
      "gasFee": "900000000000000",
      "gasFeeUSD": "2.85"
    },
    "route": {
      "steps": [...]
    },
    "callData": "0x...",
    "value": "0",
    "to": "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    "expiresAt": "2024-01-01T12:05:00Z"
  },
  "request": {
    "fromChainId": 8453,
    "toChainId": 8453,
    "fromToken": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "toToken": "0x4200000000000000000000000000000000000006",
    "amount": "1000000",
    "slippage": "0.5"
  },
  "crossChain": false,
  "timestamp": 1704110700
}
```

### 2. Search Tokens

**Endpoint:** `GET /api/v1/tokens/search`

**Mô tả:** Search tokens theo tên, symbol hoặc address với intelligent prioritization theo chain

**Parameters:**
- `q` (required): Search query (name, symbol, hoặc address)
- `chainId` (optional): Chain ID ưu tiên cho prioritization
- `limit` (optional): Giới hạn kết quả (default: 20, max: 100)

**Example Requests:**

#### Search by Symbol
```bash
GET /api/v1/tokens/search?q=USDC&chainId=8453&limit=10
```

#### Search by Address
```bash
GET /api/v1/tokens/search?q=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&chainId=8453
```

#### Search by Name
```bash
GET /api/v1/tokens/search?q=ethereum&limit=5
```

**Response:**
```json
{
  "tokens": [
    {
      "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "chainId": 8453,
      "logoURI": "https://...",
      "isNative": false,
      "priceUSD": "1.0001",
      "metadata": {
        "source": "lifi",
        "isPopular": true,
        "isStable": true
      }
    },
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "chainId": 1,
      "logoURI": "https://...",
      "isNative": false,
      "priceUSD": "1.0000",
      "metadata": {
        "source": "oneinch",
        "isPopular": true,
        "isStable": true
      }
    }
  ],
  "total": 2,
  "updatedAt": "2024-01-01T12:00:00Z",
  "metadata": {
    "query": "USDC",
    "preferredChain": 8453,
    "searchStrategy": "text_search",
    "isAddress": false,
    "resultCount": 2
  }
}
```

## 🚀 Key Features

### Quote API Features
- **Cross-chain support**: fromChainId ≠ toChainId
- **Best price aggregation**: Tự động chọn best quote từ tất cả sources
- **Gas estimation**: Accurate gas costs cho transaction
- **Route information**: Chi tiết steps trong swap
- **Ready-to-execute**: CallData, value, to address sẵn sàng

### Search API Features
- **Chain prioritization**: Tokens từ preferredChain được ưu tiên
- **Intelligent categorization**:
  1. Preferred chain tokens (nếu có chainId)
  2. Native tokens (ETH, MATIC, etc.)
  3. Stablecoins (USDC, USDT, DAI, etc.)
  4. Popular tokens (WETH, UNI, AAVE, etc.)
  5. Other tokens

- **Search strategies**:
  - **Address lookup**: Tự động detect 0x... patterns → direct lookup
  - **Text search**: Name/symbol matching với exact > prefix > contains
  
- **Cross-chain fallback**: Không tìm thấy → tự động search major chains
- **Complete token info**: Name, symbol, decimals cho user chọn swap

## ⚡ Performance Optimizations

### Caching Strategy
- **Multi-layer caching**: 20s-30min TTL tùy theo data type
- **Address-based cache**: 10-15min cho instant lookups
- **Popular tokens cache**: 5min riêng biệt
- **Aggregated cache**: 1min cho real-time updates

### Speed Benchmarks
- **Quote API**: 100-500ms (aggregated from multiple sources)
- **Search API (address)**: 10-50ms (address cache hit)
- **Search API (text)**: 20-100ms (optimized filtering)

## 🎨 UI/UX Integration

### Token Search Flow
1. User gõ "USDC" → prioritize preferred chain
2. User paste "0x833..." → instant address lookup
3. User chọn token từ preferred chain → ready for quote
4. Fallback: Token không có trên preferred chain → show other chains

### Quote Flow  
1. User chọn fromToken, toToken, amount
2. API tự động detect same-chain vs cross-chain
3. Aggregator lấy best quote từ tất cả sources
4. Return ready-to-execute transaction data

## 📝 Example Integration

### React Hook
```javascript
// Token search
const useTokenSearch = (query, chainId) => {
  return useQuery(['tokens', query, chainId], 
    () => fetch(`/api/v1/tokens/search?q=${query}&chainId=${chainId}&limit=20`)
      .then(r => r.json())
  );
};

// Quote
const useQuote = (fromChainId, toChainId, fromToken, toToken, amount, userAddress) => {
  return useQuery(['quote', fromChainId, toChainId, fromToken, toToken, amount], 
    () => fetch(`/api/v1/quote?fromChainId=${fromChainId}&toChainId=${toChainId}&fromToken=${fromToken}&toToken=${toToken}&amount=${amount}&userAddress=${userAddress}`)
      .then(r => r.json())
  );
};
```

## 🔧 Development

### Local Testing
```bash
# Start service
cd services/quote-service
go run cmd/server/main.go

# Test quote API
curl "http://localhost:3003/api/v1/quote?fromChainId=8453&toChainId=8453&fromToken=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&toToken=0x4200000000000000000000000000000000000006&amount=1000000"

# Test search API
curl "http://localhost:3003/api/v1/tokens/search?q=USDC&chainId=8453"
```

### Swagger Documentation
Available at: `http://localhost:3003/swagger/index.html` (development mode)

---

**2 API đơn giản, hiệu quả, đáp ứng đầy đủ nhu cầu DEX operations với tốc độ lightning-fast!** ⚡ 