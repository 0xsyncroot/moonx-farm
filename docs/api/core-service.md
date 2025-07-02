# Core Service API - MoonXFarm DEX

**Service**: Core Platform Service  
**Port**: 3007  
**Base URL**: `/api/v1`  
**Status**: ✅ Production Ready

## 🎯 Overview

Core Service provides the central platform APIs for order management, portfolio tracking, and P&L calculation with Alchemy integration across 5 chains.

## 🔧 Order Management APIs

### Create Order
```typescript
POST /api/v1/orders
```

**Request Body**:
```typescript
{
  "type": "LIMIT" | "DCA",
  "tokenIn": "0x...",
  "tokenOut": "0x...", 
  "amountIn": "1000000000000000000",
  "targetPrice"?: "2500.50",      // For LIMIT orders
  "frequency"?: "DAILY",          // For DCA orders  
  "maxExecutions"?: 10,           // For DCA orders
  "expiresAt": "2025-02-15T00:00:00Z"
}
```

**Response**:
```typescript
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING",
    "createdAt": "2025-01-16T10:30:00.000Z"
  },
  "message": "Order created successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### List Orders
```typescript
GET /api/v1/orders?status=PENDING&page=1&limit=20
```

**Response**:
```typescript
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "uuid",
        "type": "LIMIT",
        "status": "PENDING",
        "tokenIn": "0x...",
        "tokenOut": "0x...",
        "amountIn": "1000000000000000000",
        "targetPrice": "2500.50",
        "executionCount": 0,
        "createdAt": "2025-01-16T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "hasMore": true
    }
  }
}
```

### Get Order Details
```typescript
GET /api/v1/orders/:orderId
```

**Response**: Order with execution history
```typescript
{
  "success": true,
  "data": {
    "order": { /* order details */ },
    "executions": [
      {
        "executionId": "uuid",
        "txHash": "0x...",
        "amountExecuted": "500000000000000000",
        "gasUsed": "150000",
        "gasPrice": "20000000000",
        "executedAt": "2025-01-16T11:00:00.000Z"
      }
    ]
  }
}
```

### Cancel Order
```typescript
DELETE /api/v1/orders/:orderId
```

## 📊 Portfolio Management APIs

### Manual Portfolio Sync
```typescript
POST /api/v1/portfolio/sync
```

**Response**:
```typescript
{
  "success": true,
  "data": {
    "syncId": "uuid",
    "status": "COMPLETED",
    "chainsUpdated": ["ethereum", "polygon", "base"],
    "tokensFound": 15,
    "lastSyncAt": "2025-01-16T10:30:00.000Z"
  }
}
```

### Quick Portfolio (2min cache)
```typescript
GET /api/v1/portfolio/quick
```

**Response**:
```typescript
{
  "success": true,
  "data": {
    "totalValueUSD": "25678.45",
    "tokens": [
      {
        "chainId": 1,
        "address": "0x...",
        "symbol": "ETH",
        "balance": "10.5",
        "valueUSD": "24500.00",
        "price": "2333.33"
      }
    ],
    "lastUpdated": "2025-01-16T10:28:00.000Z",
    "cacheExpiry": "2025-01-16T10:32:00.000Z"
  }
}
```

### Force Portfolio Refresh
```typescript
GET /api/v1/portfolio/refresh
```

### Real-time P&L Calculation
```typescript
GET /api/v1/portfolio/pnl?timeframe=24h
```

**Response**:
```typescript
{
  "success": true,
  "data": {
    "totalPnL": {
      "realized": "1250.75",
      "unrealized": "2890.25", 
      "total": "4141.00"
    },
    "pnlPercentage": "16.12",
    "breakdown": [
      {
        "token": "ETH",
        "pnl": "3500.00",
        "pnlPercentage": "18.5",
        "costBasis": "18918.92"
      }
    ],
    "timeframe": "24h"
  }
}
```

### Portfolio Analytics
```typescript
GET /api/v1/portfolio/analytics
```

**Response**: Historical performance, win rate, etc.

### Trading History
```typescript
GET /api/v1/portfolio/trades?days=30
```

**Response**: Recent trades (read-only)

## 🔄 Order Execution APIs

### Record Order Execution
```typescript
POST /api/v1/orders/:orderId/executions
```

**Request Body**:
```typescript
{
  "txHash": "0x...",
  "amountExecuted": "500000000000000000",
  "gasUsed": "150000",
  "gasPrice": "20000000000",
  "executedAt": "2025-01-16T11:00:00.000Z"
}
```

### Get Order Statistics  
```typescript
GET /api/v1/orders/stats
```

**Response**: User order statistics and performance metrics

## 📋 Health & Monitoring

### Service Health Check
```typescript
GET /api/v1/health
```

**Response**:
```typescript
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "alchemy": "responsive"
  },
  "version": "1.0.0",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## 🔐 Authentication

All endpoints require JWT authentication:
```typescript
Authorization: Bearer <jwt_token>
```

Get JWT token from Auth Service (`POST /auth/login`)

## ⚡ Performance

| Endpoint Category | Response Time |
|------------------|---------------|
| Order APIs | ~150-250ms |
| Portfolio APIs | ~200-300ms |
| Health Check | ~50-100ms |

## 🔧 Auto-Sync System

### Background Worker Features
- **Smart Triggers**: onUserLogin(), onUserTrade(), onUserAccess()
- **Priority System**: triggered (high), scheduled (normal), stale (low)
- **Frequency**: Every 2 minutes background sync
- **Concurrency**: Max 5 parallel syncs
- **Alchemy Integration**: 5 chains (Ethereum, Polygon, Optimism, Arbitrum, Base)

### Caching Strategy
```typescript
const CACHE_TTLS = {
  quickPortfolio: 120,    // 2 minutes
  fullPortfolio: 600,     // 10 minutes 
  orderData: 300,         // 5 minutes
  pnlData: 180,          // 3 minutes (variable by timeframe)
};
```

## 📊 Database Schema

### Key Tables
- **orders**: Order CRUD with execution counts
- **order_executions**: Detailed execution history  
- **user_trades**: Trading history with JSONB optimization
- **Views**: active_orders, completed_orders, order_summary

### Indexes
- User-based: `(user_id, status)`, `(user_id, created_at)`
- Status-based: `(status)` for active order queries
- Performance: Optimized for portfolio and P&L queries

---

**Enterprise-grade Core Service APIs for trading platform operations.** 