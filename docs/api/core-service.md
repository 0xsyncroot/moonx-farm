# Core Service API Documentation

**Service**: Core Platform Service  
**Port**: 3007  
**Base URL**: `/api/v1`  
**Status**: ✅ Production Ready  
**Last Updated**: January 2025

## 🎯 Overview

The Core Service provides centralized platform APIs for order management, portfolio tracking, and P&L analytics. It integrates with Alchemy API for multi-chain portfolio sync and provides enterprise-grade data operations.

## 🔑 Authentication

All endpoints require JWT authentication:
```typescript
Authorization: Bearer <jwt_token>
```

## 📋 Order Management APIs

### Create Order
```typescript
POST /api/v1/orders
```

**Request Body:**
```typescript
{
  "type": "LIMIT" | "DCA",
  "fromToken": "0x...", // Token contract address
  "toToken": "0x...",   // Target token address
  "fromAmount": "1000000000000000000", // Amount in wei
  "limitPrice": "2500.50", // Price threshold
  "chainId": 8453,      // Base mainnet
  "dcaSettings"?: {     // Required for DCA orders
    "interval": 3600,   // Seconds between executions
    "totalExecutions": 10
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "status": "PENDING",
    "createdAt": "2025-01-16T10:30:00.000Z",
    "estimatedGas": "150000"
  },
  "message": "Order created successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### List Orders
```typescript
GET /api/v1/orders?status=ACTIVE&limit=20&offset=0
```

**Query Parameters:**
- `status`: `PENDING` | `ACTIVE` | `COMPLETED` | `CANCELLED`
- `type`: `LIMIT` | `DCA`
- `chainId`: Network ID filter
- `limit`: Records per page (default: 20, max: 100)
- `offset`: Pagination offset

**Response:**
```typescript
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "uuid",
        "type": "LIMIT",
        "status": "ACTIVE",
        "fromToken": "0x...",
        "toToken": "0x...",
        "fromAmount": "1000000000000000000",
        "limitPrice": "2500.50",
        "chainId": 8453,
        "executionCount": 0,
        "totalExecutions": 1,
        "createdAt": "2025-01-16T10:30:00.000Z",
        "updatedAt": "2025-01-16T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### Get Active Orders Only
```typescript
GET /api/v1/orders/active
```

Returns only orders with status `PENDING` or `ACTIVE`.

### Get Order Details
```typescript
GET /api/v1/orders/:orderId
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "order": {
      "orderId": "uuid",
      "type": "DCA",
      "status": "ACTIVE",
      // ... order details
    },
    "executions": [
      {
        "executionId": "uuid",
        "txHash": "0x...",
        "fromAmount": "100000000000000000",
        "toAmount": "250000000000000000",
        "gasUsed": "145000",
        "gasFee": "2500000000000000",
        "executedAt": "2025-01-16T10:30:00.000Z"
      }
    ]
  }
}
```

### Update Order
```typescript
PUT /api/v1/orders/:orderId
```

**Request Body:**
```typescript
{
  "status"?: "CANCELLED",  // Only cancellation allowed
  "limitPrice"?: "2600.00" // Update price for pending orders
}
```

### Cancel Order
```typescript
DELETE /api/v1/orders/:orderId
```

Soft delete - preserves order history for analytics.

### Record Order Execution
```typescript
POST /api/v1/orders/:orderId/executions
```

**Request Body:**
```typescript
{
  "txHash": "0x...",
  "fromAmount": "100000000000000000",
  "toAmount": "250000000000000000",
  "gasUsed": "145000",
  "gasFee": "2500000000000000"
}
```

### Order Statistics
```typescript
GET /api/v1/orders/stats
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "totalOrders": 156,
    "activeOrders": 12,
    "completedOrders": 142,
    "cancelledOrders": 2,
    "totalVolume": "45670.50",
    "averageOrderSize": "292.75"
  }
}
```

## 💼 Portfolio Management APIs

### Manual Portfolio Sync
```typescript
POST /api/v1/portfolio/sync
```

Triggers manual sync with Alchemy API across 5 supported chains.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "syncJobId": "uuid",
    "chainsQueued": ["ethereum", "polygon", "optimism", "arbitrum", "base"],
    "estimatedCompletion": "2025-01-16T10:32:00.000Z"
  }
}
```

### Quick Portfolio Data
```typescript
GET /api/v1/portfolio/quick
```

Returns cached portfolio data (2-minute cache).

**Response:**
```typescript
{
  "success": true,
  "data": {
    "totalValueUsd": "12450.75",
    "chainBreakdown": {
      "ethereum": { "valueUsd": "8500.50", "tokenCount": 5 },
      "base": { "valueUsd": "3950.25", "tokenCount": 8 }
    },
    "topHoldings": [
      {
        "symbol": "ETH",
        "balance": "3.5",
        "valueUsd": "8750.00",
        "percentage": 70.3
      }
    ],
    "lastSyncAt": "2025-01-16T10:28:00.000Z",
    "cacheExpiresAt": "2025-01-16T10:30:00.000Z"
  }
}
```

### Force Portfolio Refresh
```typescript
GET /api/v1/portfolio/refresh
```

Forces immediate portfolio refresh from Alchemy API.

## 📊 P&L Analytics APIs

### Real-time P&L Calculation
```typescript
GET /api/v1/portfolio/pnl
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "totalPnl": {
      "realized": "1250.75",
      "unrealized": "-320.50",
      "total": "930.25"
    },
    "dailyPnl": "45.80",
    "weeklyPnl": "312.90",
    "monthlyPnl": "930.25",
    "costBasis": "11520.50",
    "currentValue": "12450.75",
    "returnPercentage": 8.07,
    "breakdown": [
      {
        "token": "ETH",
        "realized": "850.00",
        "unrealized": "125.50",
        "costBasis": "8000.00",
        "currentValue": "8975.50"
      }
    ]
  }
}
```

### Portfolio Analytics
```typescript
GET /api/v1/portfolio/analytics
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "performance": {
      "allTime": { "return": 8.07, "period": "180d" },
      "monthly": { "return": 12.5, "period": "30d" },
      "weekly": { "return": 3.2, "period": "7d" }
    },
    "allocation": {
      "byChain": { "ethereum": 68.3, "base": 31.7 },
      "byCategory": { "defi": 45.2, "layer1": 54.8 }
    },
    "riskMetrics": {
      "volatility": 0.45,
      "sharpeRatio": 1.23,
      "maxDrawdown": -15.8
    }
  }
}
```

### Portfolio History
```typescript
GET /api/v1/portfolio/history?period=30d
```

**Query Parameters:**
- `period`: `7d` | `30d` | `90d` | `1y`
- `granularity`: `hourly` | `daily` | `weekly`

**Response:**
```typescript
{
  "success": true,
  "data": {
    "timeline": [
      {
        "date": "2025-01-15",
        "totalValue": "12105.25",
        "pnl": "885.00",
        "returnPercentage": 7.89
      }
    ],
    "summary": {
      "startValue": "11220.25",
      "endValue": "12450.75",
      "totalReturn": "1230.50",
      "returnPercentage": 10.97
    }
  }
}
```

## 📈 Trading History APIs

### Recent Trades
```typescript
GET /api/v1/portfolio/trades?limit=50&offset=0
```

**Query Parameters:**
- `chainId`: Filter by network
- `tokenAddress`: Filter by token
- `limit`: Records per page (default: 50, max: 200)
- `offset`: Pagination offset

**Response:**
```typescript
{
  "success": true,
  "data": {
    "trades": [
      {
        "tradeId": "uuid",
        "txHash": "0x...",
        "type": "SWAP",
        "fromToken": {
          "address": "0x...",
          "symbol": "USDC",
          "amount": "1000.00"
        },
        "toToken": {
          "address": "0x...",
          "symbol": "ETH",
          "amount": "0.4"
        },
        "chainId": 8453,
        "gasFee": "0.05",
        "executedAt": "2025-01-16T10:30:00.000Z",
        "pnlImpact": "+125.50"
      }
    ],
    "pagination": {
      "total": 234,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

## 🏥 Health & Monitoring

### Service Health Check
```typescript
GET /api/v1/health
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600,
    "checks": {
      "database": "healthy",
      "redis": "healthy",
      "alchemy": "healthy"
    },
    "metrics": {
      "activeConnections": 45,
      "avgResponseTime": "250ms",
      "requestsPerMinute": 120
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## ⚡ Performance Features

### Auto-Sync System
- **Background Worker**: Syncs portfolio every 2 minutes
- **Smart Triggers**: onUserLogin(), onUserTrade(), onUserAccess()
- **Priority Queue**: Triggered > Scheduled > Stale
- **Alchemy Integration**: 5 chains (Ethereum, Polygon, Optimism, Arbitrum, Base)

### Caching Strategy
- **Quick Portfolio**: 2-minute cache for fast responses
- **Full Portfolio**: 10-minute cache for comprehensive data
- **P&L Data**: Variable TTL based on market volatility
- **Redis Optimization**: Batch operations, connection pooling

### Performance Metrics
- **API Response**: ~200-300ms average
- **Portfolio Sync**: ~3-5 seconds for 5 chains
- **P&L Calculation**: ~150ms for complex portfolios
- **Cache Hit Rate**: >95% for frequent queries

## 🔧 Rate Limiting

- **General APIs**: 1000 requests/hour per user
- **Portfolio Sync**: 10 requests/hour per user
- **Health Check**: No limits

## 🗄️ Database Integration

### Tables Used
- `orders`: Order management with execution tracking
- `order_executions`: Detailed execution history
- `user_trades`: Trading history with JSONB optimization
- `portfolio_snapshots`: Historical portfolio data

### Database Views
- `active_orders`: Real-time active order tracking
- `completed_orders`: Historical order analysis
- `order_summary`: Aggregated order statistics

---

**Production-ready Core Service APIs with enterprise-grade performance and comprehensive portfolio management.** 