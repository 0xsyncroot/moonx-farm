# MoonXFarm Core Service

Central Platform Service providing **Order Management**, **Portfolio Sync**, **P&L Analytics**, và **Trading History** cho MoonXFarm platform.

## 🏗️ Architecture

**Port**: 3007 (configured in @moonx/configs)  
**Framework**: Fastify v5 with TypeScript  
**Infrastructure**: @moonx/infrastructure, @moonx/configs, @moonx/common  
**Authentication**: JWT verification via Auth Service  
**Database**: PostgreSQL với orders, order_executions, user_trades tables  
**Caching**: Redis with intelligent TTL strategies  
**External APIs**: Alchemy API (5 chains: Ethereum, Polygon, Optimism, Arbitrum, Base)

## 📊 API Endpoints Overview

### 🔷 Order Management (Complete CRUD)
- `POST /api/v1/orders` - Create limit/DCA orders
- `GET /api/v1/orders` - List user orders với filtering/pagination
- `GET /api/v1/orders/active` - Get active orders only
- `GET /api/v1/orders/:orderId` - Order details với execution history
- `PUT /api/v1/orders/:orderId` - Update order status/details  
- `DELETE /api/v1/orders/:orderId` - Cancel order (soft delete)
- `POST /api/v1/orders/:orderId/executions` - Record on-chain execution
- `GET /api/v1/orders/stats` - Order statistics

### 🔷 Portfolio Management (Alchemy Integration)
- `POST /api/v1/portfolio/sync` - Manual portfolio sync
- `GET /api/v1/portfolio/quick` - Quick portfolio (2min cache)
- `GET /api/v1/portfolio/refresh` - Force refresh portfolio

### 🔷 P&L Analytics
- `GET /api/v1/portfolio/pnl` - Real P&L calculation với cost basis
- `GET /api/v1/portfolio/analytics` - Portfolio analytics với breakdown
- `GET /api/v1/portfolio/history` - Portfolio change history

### 🔷 Trading History
- `GET /api/v1/portfolio/trades` - Recent trades (read-only, last 30 days)

### 🔷 System Health
- `GET /api/v1/health` - Service health check

## 📋 API Detailed Documentation

### **Order Management APIs**

#### `POST /api/v1/orders` - Create Order
**Purpose**: Tạo limit order hoặc DCA order

**Request Body**:
```json
{
  "walletAddress": "0x...",
  "type": "LIMIT" | "DCA",
  "chainId": 1,
  "fromToken": "0x...",
  "toToken": "0x...", 
  "fromAmount": "1000000000000000000",
  
  // For LIMIT orders
  "targetPrice": "2500.50",
  
  // For DCA orders  
  "frequency": "daily" | "weekly" | "monthly",
  "maxExecutions": 10,
  "amountPerExecution": "100000000000000000"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "uuid",
      "type": "LIMIT",
      "status": "PENDING",
      "fromToken": "0x...",
      "targetPrice": "2500.50",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  },
  "message": "Order created successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/orders` - List Orders
**Purpose**: Lấy danh sách orders với filtering và pagination

**Query Parameters**:
```typescript
{
  limit?: number;        // Default: 20, Max: 100
  offset?: number;       // Default: 0
  status?: "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  type?: "LIMIT" | "DCA";
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "uuid",
        "type": "LIMIT",
        "status": "PENDING",
        "fromAmount": "1000000000000000000",
        "executionCount": 0,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 25,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "message": "Retrieved 20 orders",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/orders/active` - Active Orders
**Purpose**: Lấy tất cả orders đang active (PENDING, PARTIALLY_FILLED)

**Response**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "uuid",
        "type": "DCA", 
        "status": "PENDING",
        "frequency": "weekly",
        "executionCount": 3,
        "maxExecutions": 10,
        "nextExecutionAt": "2024-01-22T10:30:00Z"
      }
    ]
  },
  "message": "Found 5 active orders",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/orders/:orderId` - Order Details
**Purpose**: Lấy chi tiết order và execution history

**Response**:
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "uuid",
      "type": "LIMIT",
      "status": "PARTIALLY_FILLED",
      "fromToken": "0x...",
      "toToken": "0x...",
      "fromAmount": "1000000000000000000",
      "targetPrice": "2500.50",
      "executionCount": 2,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "executions": [
      {
        "executionId": "uuid",
        "executionIndex": 1,
        "transactionHash": "0x...",
        "outputAmount": "499750000000000000",
        "gasUsed": "150000",
        "gasPriceGwei": "20",
        "executedAt": "2024-01-15T11:15:00Z"
      }
    ]
  },
  "message": "Order details retrieved with 2 executions",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `PUT /api/v1/orders/:orderId` - Update Order
**Purpose**: Cập nhật order status hoặc details

**Request Body**:
```json
{
  "status"?: "FILLED" | "CANCELLED",
  "targetPrice"?: "2600.00",        // For LIMIT orders
  "maxExecutions"?: 15              // For DCA orders
}
```

#### `DELETE /api/v1/orders/:orderId` - Cancel Order  
**Purpose**: Cancel order (soft delete - preserves history)

**Response**:
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "uuid",
      "status": "CANCELLED",
      "cancelledAt": "2024-01-15T10:30:00Z"
    }
  },
  "message": "Order cancelled successfully. Order history preserved for audit purposes.",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/v1/orders/:orderId/executions` - Record Execution
**Purpose**: Ghi lại kết quả execution từ on-chain

**Request Body**:
```json
{
  "executionIndex": 1,
  "transactionHash": "0x...",
  "outputAmount": "499750000000000000",
  "gasUsed": "150000",
  "gasPriceGwei": "20",
  "executedAt": "2024-01-15T11:15:00Z"
}
```

#### `GET /api/v1/orders/stats` - Order Statistics
**Purpose**: Lấy thống kê orders của user

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 47,
      "active": 8,
      "completed": 35,
      "cancelled": 4,
      "totalVolume": "125000.50",
      "avgOrderSize": "2659.57",
      "successRate": 89.36
    }
  },
  "message": "Order statistics retrieved for 47 total orders",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Portfolio Management APIs**

#### `POST /api/v1/portfolio/sync` - Manual Sync
**Purpose**: Manually trigger portfolio sync với Alchemy API

**Request Body**:
```json
{
  "walletAddress": "0x...",
  "chainIds"?: [1, 137, 10, 42161, 8453],  // Optional: specific chains
  "forceRefresh"?: true                    // Optional: skip cache
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "syncOperation": {
      "id": "uuid",
      "status": "completed",
      "chainsCount": 5,
      "tokensCount": 23,
      "totalValueUSD": 12459.34,
      "completedAt": "2024-01-15T10:31:00Z"
    }
  },
  "message": "Portfolio synced successfully with 23 tokens across 5 chains",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/quick` - Quick Portfolio
**Purpose**: Lấy portfolio overview nhanh (cached 2 minutes)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalValueUSD": 12459.34,
    "topHoldings": [
      {
        "tokenSymbol": "ETH",
        "tokenName": "Ethereum",
        "balance": "4.125",
        "valueUSD": 8234.56,
        "chainId": 1,
        "priceUSD": 1996.50
      },
      {
        "tokenSymbol": "MATIC",
        "tokenName": "Polygon",
        "balance": "2500.0",
        "valueUSD": 2200.00,
        "chainId": 137,
        "priceUSD": 0.88
      }
    ],
    "lastSynced": "2024-01-15T10:29:00Z"
  },
  "message": "Quick portfolio data with $12,459.34 total value",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/refresh` - Force Refresh
**Purpose**: Force refresh portfolio data from Alchemy (bypass cache)

### **P&L Analytics APIs**

#### `GET /api/v1/portfolio/pnl` - P&L Calculation
**Purpose**: Real P&L calculation với cost basis tracking

**Query Parameters**:
```typescript
{
  timeframe: "24h" | "7d" | "30d" | "90d" | "1y" | "all";
  walletAddress?: string;  // Optional: defaults to authenticated user
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pnl": {
      "timeframe": "30d",
      "realizedPnlUSD": 1250.75,
      "unrealizedPnlUSD": 850.25,
      "netPnlUSD": 2101.00,
      "totalFeesUSD": 145.50,
      "winRate": 67.5,
      "totalTrades": 24,
      "profitableTrades": 16,
      "currentPortfolioValueUSD": 12459.34,
      "portfolioChangePercent": 16.87,
      "biggestWinUSD": 425.75,
      "biggestLossUSD": -158.25
    }
  },
  "message": "P&L calculated for 30d timeframe with 67.5% win rate",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/analytics` - Portfolio Analytics
**Purpose**: Detailed portfolio analytics với breakdown

**Response**:
```json
{
  "success": true,
  "data": {
    "analytics": {
      "chainBreakdown": [
        {
          "chainId": 1,
          "chainName": "Ethereum", 
          "valueUSD": 8234.56,
          "percentage": 66.1,
          "tokenCount": 8
        }
      ],
      "topTokens": [
        {
          "tokenSymbol": "ETH",
          "valueUSD": 8234.56,
          "percentage": 66.1,
          "pnlUSD": 1250.75,
          "pnlPercentage": 17.9
        }
      ],
      "diversificationScore": 7.2,
      "riskLevel": "medium"
    }
  },
  "message": "Portfolio analytics with 66.1% ETH dominance",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/history` - Portfolio History
**Purpose**: Portfolio value change history với daily breakdown

**Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2024-01-15",
        "totalValueUSD": 12459.34,
        "changeUSD": 125.50,
        "changePercent": 1.02,
        "tokenCount": 23
      },
      {
        "date": "2024-01-14", 
        "totalValueUSD": 12333.84,
        "changeUSD": -75.25,
        "changePercent": -0.61,
        "tokenCount": 22
      }
    ],
    "totalChangeUSD": 2101.00,
    "totalChangePercent": 16.87
  },
  "message": "Portfolio history with 16.87% total change",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Trading History APIs**

#### `GET /api/v1/portfolio/trades` - Recent Trades  
**Purpose**: Lấy recent trades (read-only, từ blockchain data)

**Query Parameters**:
```typescript
{
  limit?: number;        // Default: 20, Max: 100  
  offset?: number;       // Default: 0
  days?: number;         // Default: 30, Max: 90
  chainId?: number;      // Optional: filter by chain
  type?: "swap" | "limit_order" | "dca" | "bridge";
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "id": "uuid",
        "txHash": "0x...",
        "timestamp": "2024-01-15T09:15:00Z",
        "chainId": 1,
        "type": "swap",
        "status": "completed",
        "fromToken": {
          "symbol": "USDC",
          "amount": "1000.00",
          "valueUSD": 1000.00
        },
        "toToken": {
          "symbol": "ETH", 
          "amount": "0.501",
          "valueUSD": 995.50
        },
        "gasFeeETH": 0.0045,
        "gasFeeUSD": 12.45,
        "dexName": "Uniswap V3",
        "slippage": 0.45,
        "pnl": {
          "realizedPnlUSD": -4.50,
          "feesPaidUSD": 12.45,
          "netPnlUSD": -16.95
        }
      }
    ],
    "total": 24,
    "limit": 20,
    "offset": 0
  },
  "message": "Retrieved 20 recent trades",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **System Health API**

#### `GET /api/v1/health` - Health Check
**Purpose**: Service health monitoring với connectivity checks

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 3600,
    "version": "1.0.0",
    "checks": {
      "database": {
        "status": "healthy",
        "responseTime": 15
      },
      "redis": {
        "status": "healthy", 
        "responseTime": 5
      },
      "alchemy": {
        "status": "healthy",
        "responseTime": 120
      }
    }
  },
  "message": "All systems operational",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🎯 **Implementation Features**

### **Order Management System**
- ✅ **Complete CRUD**: Create, read, update, cancel orders
- ✅ **Order Types**: LIMIT (target price) và DCA (frequency-based)
- ✅ **Execution Tracking**: Record on-chain execution results
- ✅ **Soft Delete**: Cancel preserves history cho audit
- ✅ **Status Flow**: PENDING → PARTIALLY_FILLED → FILLED/CANCELLED

### **Portfolio Management**  
- ✅ **Multi-chain**: 5 chains (Ethereum, Polygon, Optimism, Arbitrum, Base)
- ✅ **Real Data**: Direct Alchemy API integration
- ✅ **Auto-sync**: Background worker với smart triggers
- ✅ **Smart Caching**: 2min quick, 10min full portfolio
- ✅ **Token Filtering**: Spam detection, minimum value filtering

### **P&L Analytics**
- ✅ **Cost Basis**: Accurate unrealized P&L calculation
- ✅ **Real-time**: Realized + unrealized P&L tracking
- ✅ **Performance**: Win rate, biggest wins/losses
- ✅ **Timeframes**: 24h, 7d, 30d, 90d, 1y, all-time

### **Technical Excellence**
- ✅ **ApiResponse**: Standardized format với timestamp
- ✅ **Type Safety**: Complete TypeScript implementation
- ✅ **Validation**: Zod schemas cho all inputs
- ✅ **Logging**: Structured logging với correlation IDs
- ✅ **Health Monitoring**: Database, Redis, Alchemy connectivity

## 🔧 Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# API documentation (development only)
http://localhost:3007/docs

# Health check
curl http://localhost:3007/api/v1/health
```

## 🔒 Security & Performance

**Authentication**: JWT required cho tất cả endpoints  
**Rate Limiting**: 1000 requests/hour per user  
**Input Validation**: Comprehensive request validation  
**Error Handling**: Proper error boundaries với detailed context  
**Caching**: Redis với intelligent TTL strategies  
**Database**: Optimized indexes, JSONB fields, performance views

## 📊 **Auto-Sync System**

### **Background Worker**
- ✅ Runs every 2 minutes
- ✅ Three-tier priority: triggered → scheduled → stale  
- ✅ Smart triggers: onUserLogin(), onUserTrade(), onUserAccess()
- ✅ Concurrent limits: max 5 parallel syncs
- ✅ Graceful UX: Loading states, background refresh

### **Caching Strategy**
```typescript
Quick Portfolio: 2 minutes TTL    // Fast UI loading
Full Portfolio: 10 minutes TTL    // Comprehensive data
P&L 24h: 5 minutes TTL           // Frequent updates
P&L 30d+: 1-4 hours TTL          // Stable calculations
Recent Trades: 5 minutes TTL      // Trade history
```

## 🗄️ **Database Schema**

### **Orders System**
```sql
-- Main orders table
orders (order_id, user_id, type, status, from_token, to_token, target_price, frequency, max_executions, execution_count, created_at, updated_at)

-- Execution tracking  
order_executions (execution_id, order_id, execution_index, transaction_hash, output_amount, gas_used, gas_price_gwei, executed_at)

-- Performance views
active_orders, completed_orders, order_summary
```

### **Trading History**
```sql
-- User trades với JSONB optimization
user_trades (id, user_id, wallet_address, tx_hash, chain_id, timestamp, type, status, from_token JSONB, to_token JSONB, gas_fee_usd, dex_name, pnl JSONB)

-- 15+ optimized indexes cho performance
```

**Overall**: Production-ready Core Service với comprehensive order management, portfolio sync, và P&L analytics. Ready for frontend integration và production deployment! 🚀