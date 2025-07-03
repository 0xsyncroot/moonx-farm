# Aggregator Service API Documentation

**Service**: Aggregator Service  
**Port**: 3003  
**Base URL**: `/api/v1`  
**Status**: ✅ Production Ready  
**Last Updated**: January 2025

## 🎯 Overview

The Aggregator Service provides multi-tier quote aggregation for optimal swap routing across multiple DEX aggregators. Built with Go for high performance, it implements circuit breaker patterns and intelligent quote optimization.

## ⚡ Multi-Tier Architecture

### Quote Response Tiers
- **Fast Quotes** (<800ms): Priority aggregators with cached results
- **Comprehensive Quotes** (<3s): All aggregators with best route optimization
- **Circuit Breaker**: Automatic failover for unreliable aggregators

### Supported Aggregators
| Aggregator | Cross-Chain | Response Time | Reliability |
|------------|-------------|---------------|-------------|
| **LI.FI** | ✅ Yes | ~300-500ms | 98.5% |
| **1inch** | ❌ Same-chain only | ~200-400ms | 99.2% |
| **Relay** | ✅ Yes | ~400-600ms | 97.8% |

## 🔑 API Endpoints

### 1. Multi-Tier Quote
```typescript
GET /api/v1/quote
```

Returns optimized quote from multiple aggregators with intelligent routing.

**Query Parameters:**
```typescript
fromChainId: number      // Source chain ID
toChainId: number        // Destination chain ID (same as fromChainId for same-chain)
fromToken: string        // Source token address
toToken: string          // Destination token address
fromAmount: string       // Amount in wei (as string)
userAddress: string      // User wallet address
slippage?: number        // Slippage tolerance (default: 0.5%)
tier?: "fast" | "comprehensive" // Quote tier (default: "comprehensive")
```

**Example Request:**
```
GET /api/v1/quote?fromChainId=8453&toChainId=8453&fromToken=0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA&toToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&fromAmount=1000000000000000000&userAddress=0x742d35Cc6634C0532925a3b8D8f72d4e6b4ed8C6&slippage=0.5&tier=comprehensive
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "bestRoute": {
      "aggregator": "lifi",
      "fromChainId": 8453,
      "toChainId": 8453,
      "fromToken": {
        "address": "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
        "symbol": "USDbC",
        "decimals": 6
      },
      "toToken": {
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6
      },
      "fromAmount": "1000000000000000000",
      "toAmount": "999850000000000000",
      "estimatedGas": "150000",
      "gasCost": "0.0015",
      "gasCostUSD": "3.75",
      "priceImpact": "0.015",
      "routes": [
        {
          "protocol": "Uniswap V3",
          "portion": 1.0,
          "toAmount": "999850000000000000"
        }
      ],
      "transaction": {
        "to": "0x...",
        "data": "0x...",
        "value": "0",
        "gasLimit": "150000"
      },
      "responseTimeMs": 485
    },
    "alternatives": [
      {
        "aggregator": "1inch",
        "toAmount": "999820000000000000",
        "gasCost": "0.0018",
        "gasCostUSD": "4.50",
        "priceImpact": "0.018",
        "responseTimeMs": 320
      },
      {
        "aggregator": "relay",
        "toAmount": "999800000000000000",
        "gasCost": "0.0020",
        "gasCostUSD": "5.00",
        "priceImpact": "0.020",
        "responseTimeMs": 550
      }
    ],
    "metadata": {
      "tier": "comprehensive",
      "totalResponseTime": 612,
      "aggregatorsQueried": 3,
      "aggregatorsResponded": 3,
      "cacheHit": false,
      "optimization": {
        "bestByOutput": "lifi",
        "bestByGas": "1inch",
        "bestBySpeed": "1inch",
        "recommendation": "lifi",
        "reason": "Best net output after gas costs"
      }
    }
  },
  "message": "Quote retrieved successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 2. Fast Quote
```typescript
GET /api/v1/quote/fast
```

Returns cached quote from fastest responding aggregator (<800ms).

**Same parameters as multi-tier quote**

**Response:**
```typescript
{
  "success": true,
  "data": {
    "route": {
      "aggregator": "1inch",
      "fromAmount": "1000000000000000000",
      "toAmount": "999820000000000000",
      "estimatedGas": "145000",
      "gasCost": "0.0018",
      "priceImpact": "0.018",
      "transaction": {
        "to": "0x...",
        "data": "0x...",
        "value": "0",
        "gasLimit": "145000"
      },
      "responseTimeMs": 285
    },
    "metadata": {
      "tier": "fast",
      "source": "cache",
      "cacheAge": 45,
      "fallbackUsed": false
    }
  },
  "message": "Fast quote retrieved successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 3. Comprehensive Quote
```typescript
GET /api/v1/quote/comprehensive
```

Returns best optimized quote from all available aggregators (<3s).

**Same parameters as multi-tier quote**

**Enhanced Response with detailed analysis:**
```typescript
{
  "success": true,
  "data": {
    "bestRoute": { /* Same as multi-tier */ },
    "detailedAnalysis": {
      "crossChainOptions": [
        {
          "aggregator": "lifi",
          "bridgeUsed": "Stargate",
          "bridgeTime": "2-5 minutes",
          "bridgeFee": "0.005",
          "totalTime": "3-6 minutes"
        }
      ],
      "liquidityAnalysis": {
        "deepestPool": "Uniswap V3 USDC/USDbC 0.05%",
        "totalLiquidity": "12500000",
        "priceImpactBreakdown": {
          "slippage": "0.010",
          "bridgeSlippage": "0.005",
          "total": "0.015"
        }
      },
      "riskAssessment": {
        "protocolRisk": "low",
        "liquidityRisk": "low",
        "bridgeRisk": "medium",
        "overallRisk": "low"
      }
    },
    "metadata": {
      "tier": "comprehensive",
      "analysisDepth": "full",
      "recommendationConfidence": 0.95
    }
  }
}
```

### 4. Cross-Chain Quote
```typescript
GET /api/v1/quote?fromChainId=8453&toChainId=56&fromToken=0x...&toToken=0x...
```

**Cross-chain specific response:**
```typescript
{
  "success": true,
  "data": {
    "bestRoute": {
      "aggregator": "lifi",
      "type": "cross-chain",
      "bridge": {
        "name": "Stargate",
        "fee": "0.005",
        "estimatedTime": "2-5 minutes"
      },
      "steps": [
        {
          "type": "swap",
          "chainId": 8453,
          "protocol": "Uniswap V3",
          "fromToken": "USDbC",
          "toToken": "USDC",
          "fromAmount": "1000000",
          "toAmount": "999850"
        },
        {
          "type": "bridge",
          "fromChainId": 8453,
          "toChainId": 56,
          "protocol": "Stargate",
          "token": "USDC",
          "amount": "999850",
          "bridgeFee": "5000"
        },
        {
          "type": "swap",
          "chainId": 56,
          "protocol": "PancakeSwap V3",
          "fromToken": "USDC",
          "toToken": "BUSD",
          "fromAmount": "994850",
          "toAmount": "994700"
        }
      ],
      "totalGasCost": "0.025",
      "totalTime": "3-6 minutes"
    }
  }
}
```

## 🔧 Circuit Breaker System

### Aggregator Health Monitoring
```typescript
GET /api/v1/aggregators/status
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "aggregators": [
      {
        "name": "lifi",
        "status": "healthy",
        "responseTime": "485ms",
        "successRate": "98.5%",
        "lastFailure": null,
        "circuitState": "closed"
      },
      {
        "name": "1inch",
        "status": "healthy",
        "responseTime": "320ms",
        "successRate": "99.2%",
        "lastFailure": null,
        "circuitState": "closed"
      },
      {
        "name": "relay",
        "status": "degraded",
        "responseTime": "1200ms",
        "successRate": "89.5%",
        "lastFailure": "2025-01-16T10:25:00.000Z",
        "circuitState": "half-open"
      }
    ],
    "overall": {
      "healthyAggregators": 2,
      "degradedAggregators": 1,
      "unavailableAggregators": 0
    }
  }
}
```

### Circuit States
- **Closed**: Normal operation, all requests allowed
- **Open**: Service failed, requests blocked for cooldown period
- **Half-Open**: Testing period, limited requests to check recovery

## ⚡ Performance Features

### Caching Strategy
```typescript
{
  "fastQuotes": {
    "ttl": 30,          // 30 seconds
    "strategy": "LRU",
    "maxSize": 10000
  },
  "comprehensiveQuotes": {
    "ttl": 120,         // 2 minutes
    "strategy": "LRU",
    "maxSize": 5000
  },
  "tokenMetadata": {
    "ttl": 3600,        // 1 hour
    "strategy": "LRU",
    "maxSize": 50000
  }
}
```

### Optimization Algorithms
```typescript
{
  "routeOptimization": {
    "criteria": [
      "netOutputAfterGas",    // Primary
      "priceImpact",          // Secondary
      "executionTime",        // Tertiary
      "protocolReliability"   // Risk factor
    ],
    "weights": {
      "output": 0.6,
      "speed": 0.2,
      "reliability": 0.2
    }
  }
}
```

## 🏥 Health Check
```typescript
GET /health
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.2.0",
    "uptime": 7200,
    "checks": {
      "redis": "healthy",
      "lifi": "healthy",
      "oneinch": "healthy",
      "relay": "degraded"
    },
    "metrics": {
      "quotesPerMinute": 450,
      "avgResponseTime": "485ms",
      "cacheHitRate": "73.5%",
      "errorRate": "0.8%"
    },
    "circuitBreakers": {
      "lifi": "closed",
      "oneinch": "closed",
      "relay": "half-open"
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## 📊 Error Handling

### Common Error Responses
```typescript
// Insufficient Liquidity
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_LIQUIDITY",
    "message": "Insufficient liquidity for requested swap amount",
    "details": {
      "fromToken": "USDbC",
      "toToken": "USDC",
      "requestedAmount": "10000000000000000000000",
      "maxAvailable": "5000000000000000000000"
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}

// Unsupported Route
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_ROUTE",
    "message": "No route found for requested token pair",
    "details": {
      "fromChainId": 8453,
      "toChainId": 137,
      "fromToken": "0x...",
      "toToken": "0x...",
      "availableAggregators": ["lifi"]
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}

// Service Timeout
{
  "success": false,
  "error": {
    "code": "SERVICE_TIMEOUT",
    "message": "Quote request timed out",
    "details": {
      "timeout": 3000,
      "tier": "comprehensive",
      "partialResults": ["1inch", "lifi"]
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}

// All Aggregators Down
{
  "success": false,
  "error": {
    "code": "ALL_AGGREGATORS_UNAVAILABLE",
    "message": "All aggregators are currently unavailable",
    "details": {
      "circuitStates": {
        "lifi": "open",
        "oneinch": "open",
        "relay": "open"
      },
      "estimatedRecovery": "2025-01-16T10:35:00.000Z"
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### Error Codes Reference
| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_PARAMETERS` | Missing or invalid request parameters | 400 |
| `UNSUPPORTED_CHAIN` | Chain ID not supported | 400 |
| `UNSUPPORTED_TOKEN` | Token not supported on specified chain | 400 |
| `UNSUPPORTED_ROUTE` | No route available for token pair | 404 |
| `INSUFFICIENT_LIQUIDITY` | Not enough liquidity for swap | 400 |
| `AMOUNT_TOO_SMALL` | Swap amount below minimum threshold | 400 |
| `AMOUNT_TOO_LARGE` | Swap amount exceeds maximum threshold | 400 |
| `SLIPPAGE_TOO_HIGH` | Price impact exceeds slippage tolerance | 400 |
| `SERVICE_TIMEOUT` | Request timed out | 408 |
| `AGGREGATOR_ERROR` | Aggregator service error | 502 |
| `ALL_AGGREGATORS_UNAVAILABLE` | All aggregators down | 503 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## 🔧 Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Quote Requests | 100 requests | 1 minute |
| Fast Quotes | 200 requests | 1 minute |
| Health Checks | No limit | - |

## 📈 Performance Metrics

### Response Time Targets
| Quote Tier | Target | Current Average |
|------------|--------|-----------------|
| Fast | <800ms | ~285ms |
| Comprehensive | <3s | ~612ms |
| Cross-chain | <5s | ~1.2s |

### Reliability Metrics
- **Uptime**: 99.9%
- **Cache Hit Rate**: 73.5%
- **Error Rate**: <1%
- **Aggregator Success Rate**: >95%

## 🔧 Environment Variables

```bash
# Service Configuration
PORT=3003
GO_ENV=production
LOG_LEVEL=info

# Redis Cache
REDIS_URL=redis://localhost:6379
CACHE_TTL_FAST=30
CACHE_TTL_COMPREHENSIVE=120

# Aggregator APIs
LIFI_API_URL=https://li.quest/v1
ONEINCH_API_URL=https://api.1inch.dev/swap/v5.2
RELAY_API_URL=https://api.relay.link/v1

# Circuit Breaker
CIRCUIT_FAILURE_THRESHOLD=5
CIRCUIT_RECOVERY_TIMEOUT=30
CIRCUIT_SUCCESS_THRESHOLD=3

# Performance
REQUEST_TIMEOUT=3000
MAX_CONCURRENT_REQUESTS=100
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

---

**High-performance aggregator service with intelligent routing and enterprise-grade reliability.** 