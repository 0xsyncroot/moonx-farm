# MoonXFarm Core Service

Central Platform Service providing **Order Management**, **Portfolio Sync**, **P&L Analytics**, và **Trading History** cho MoonXFarm platform.

## 🏗️ Architecture

**Port**: 3007 (configured in @moonx-farm/configs)  
**Framework**: Fastify v5 with TypeScript  
**Infrastructure**: @moonx/infrastructure, @moonx-farm/configs, @moonx/common  
**Authentication**: JWT verification via Auth Service  
**Database**: PostgreSQL với orders, order_executions, user_trades tables  
**Caching**: Redis with intelligent TTL strategies  
**External APIs**: Alchemy API (5 chains: Ethereum, Polygon, Optimism, Arbitrum, Base)

## 🔧 **Current Implementation Status**

✅ **PRODUCTION READY** - Core Service với complete feature set:
- ✅ **Order Management**: Complete CRUD với LIMIT/DCA orders
- ✅ **Portfolio Sync**: Alchemy integration với auto-sync system
- ✅ **P&L Analytics**: Real-time P&L với cost basis tracking  
- ✅ **ApiResponse**: Standardized response format
- ✅ **Router Structure**: Organized routes với proper OpenAPI docs
- ✅ **TypeScript**: Production-ready với proper type safety
- ✅ **Error Handling**: Comprehensive error boundaries

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
- `GET /api/v1/portfolio` - Get user portfolio (auto-synced)
- `GET /api/v1/portfolio/quick` - Quick portfolio overview (2min cache)
- `POST /api/v1/portfolio/refresh` - Force refresh portfolio
- `GET /api/v1/portfolio/sync-status` - Get sync system status

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

#### `GET /api/v1/portfolio` - Get Portfolio
**Purpose**: Lấy user portfolio với auto-sync behavior

**Query Parameters**:
```typescript
{
  chainIds?: string;     // Optional: comma-separated chain IDs (e.g. "1,137,10")
  includeSpam?: boolean; // Optional: include spam tokens (default: false)
  minValueUSD?: number;  // Optional: minimum token value filter
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "portfolio": {
      "totalValueUSD": 12459.34,
      "holdings": [
        {
          "tokenSymbol": "ETH",
          "tokenName": "Ethereum",
          "tokenAddress": "0x...",
          "chainId": 1,
          "balance": "4.125",
          "balanceFormatted": "4.125",
          "valueUSD": 8234.56,
          "priceUSD": 1996.50,
          "logoUrl": "https://...",
          "isSpam": false
        }
      ],
      "lastSynced": "2024-01-15T10:29:00Z"
    },
    "syncStatus": "current",  // "current" | "refreshing" | "syncing"
    "lastSynced": "2024-01-15T10:29:00Z"
  },
  "message": "Portfolio retrieved with 23 holdings",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Loading State Response (202)**:
```json
{
  "success": true,
  "data": {
    "portfolio": null,
    "status": "syncing",
    "message": "Portfolio is being synced. Please check back in a few moments."
  },
  "message": "Portfolio sync initiated",
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
    "holdingsCount": 23,
    "topHoldings": [
      {
        "tokenSymbol": "ETH",
        "tokenName": "Ethereum",
        "balance": "4.125",
        "valueUSD": 8234.56,
        "chainId": 1,
        "priceUSD": 1996.50
      }
    ],
    "lastSynced": "2024-01-15T10:29:00Z",
    "status": "ready"  // "ready" | "syncing"
  },
  "message": "Quick portfolio overview: $12,459.34",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/v1/portfolio/refresh` - Force Refresh
**Purpose**: Force refresh portfolio data from Alchemy (bypass cache)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Portfolio refresh initiated. Check back in a few moments for updated data.",
    "status": "refreshing"
  },
  "message": "Portfolio refresh initiated",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/sync-status` - Sync Status
**Purpose**: Get sync system statistics và performance

**Response**:
```json
{
  "success": true,
  "data": {
    "syncStats": {
      "totalSyncsToday": 1250,
      "activeSyncs": 3,
      "avgSyncTimeSeconds": 4.5,
      "syncQueues": {
        "triggered": 2,
        "scheduled": 15,
        "stale": 8
      },
      "lastProcessedAt": "2024-01-15T10:29:45Z"
    }
  },
  "message": "Sync statistics retrieved successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **P&L Analytics APIs**

#### `GET /api/v1/portfolio/pnl` - P&L Calculation
**Purpose**: Real P&L calculation với cost basis tracking

**Query Parameters**:
```typescript
{
  timeframe?: "24h" | "7d" | "30d" | "90d" | "1y" | "all";  // Default: "30d"
  walletAddress?: string;  // Optional: defaults to authenticated user
}
```

**Response**:
```json
{
  "success": true,
  "data": {
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
  },
  "message": "P&L calculated for 30d timeframe with 67.5% win rate",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/analytics` - Portfolio Analytics
**Purpose**: Detailed portfolio analytics với breakdown options

**Query Parameters**:
```typescript
{
  timeframe?: string;     // Default: "30d"
  breakdown?: "chain" | "token" | "dex";  // Default: "token"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pnl": {
      "timeframe": "30d",
      "netPnlUSD": 2101.00,
      "winRate": 67.5
    },
    "analytics": {
      "topTokens": [
        {
          "symbol": "ETH",
          "name": "Ethereum",
          "valueUSD": 8234.56,
          "percentage": 66.1,
          "chainId": 1,
          "balance": "4.125",
          "priceUSD": 1996.50
        }
      ]
    },
    "summary": {
      "totalPortfolioValue": 12459.34,
      "totalTokens": 23,
      "lastUpdated": "2024-01-15T10:29:00Z"
    }
  },
  "message": "Analytics generated with token breakdown",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/portfolio/history` - Portfolio History
**Purpose**: Portfolio value change history (COMING SOON)

**Query Parameters**:
```typescript
{
  timeframe?: string;              // Default: "30d"
  interval?: "hour" | "day" | "week";  // Default: "day"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "history": {
      "timeframe": "30d",
      "interval": "day",
      "data": []
    }
  },
  "message": "Portfolio history feature will be available soon",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Trading History APIs**

#### `GET /api/v1/portfolio/trades` - Recent Trades  
**Purpose**: Lấy recent trades (read-only, từ blockchain data)

**Query Parameters**:
```typescript
{
  limit?: number;    // Default: 20, Max: 100  
  days?: number;     // Default: 30
  chainIds?: string; // Optional: comma-separated chain IDs
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
    "count": 20,
    "filters": {
      "limit": 20,
      "days": 30,
      "chainIds": [1, 137, 10]
    }
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
- ✅ **Graceful UX**: Loading states, background refresh, stale detection

### **P&L Analytics**
- ✅ **Cost Basis**: Accurate unrealized P&L calculation
- ✅ **Real-time**: Realized + unrealized P&L tracking
- ✅ **Performance**: Win rate, biggest wins/losses
- ✅ **Timeframes**: 24h, 7d, 30d, 90d, 1y, all-time

### **Technical Excellence**
- ✅ **ApiResponse**: Standardized format với success/error/message/timestamp
- ✅ **Type Safety**: Complete TypeScript implementation với proper error handling
- ✅ **Router Structure**: Organized routes in `/routes/` directory với proper separation
- ✅ **Validation**: Comprehensive input validation với detailed error messages
- ✅ **Logging**: Structured logging với winston và proper error context
- ✅ **Health Monitoring**: Database, Redis, Alchemy connectivity checks

## 🏗️ **Code Structure**

### **Router Organization**
```
src/
├── routes/
│   ├── orders.ts      # Order management routes
│   ├── portfolio.ts   # Portfolio management routes
│   └── health.ts      # Health check routes
├── controllers/
│   ├── orderController.ts
│   ├── portfolioController.ts
│   └── healthController.ts
├── services/
│   ├── portfolioService.ts
│   ├── pnlService.ts
│   ├── tradesService.ts
│   └── autoSyncService.ts
├── middleware/
│   └── authMiddleware.ts
└── index.ts           # Main server với route registration
```

### **ApiResponse Standardization**
All endpoints follow consistent response format:
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}
```

Helper functions trong controllers:
```typescript
function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T>
function createErrorResponse(error: string): ApiResponse
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Development server với hot reload
npm run dev

# API documentation (development only)
http://localhost:3007/docs

# Health check
curl http://localhost:3007/api/v1/health

# Quick portfolio test
curl -H "Authorization: Bearer <token>" \
     http://localhost:3007/api/v1/portfolio/quick
```

## 🔒 Security & Performance

**Authentication**: JWT required cho tất cả endpoints via Auth Service integration  
**Rate Limiting**: Configurable limits per endpoint  
**Input Validation**: Comprehensive request validation với detailed error messages  
**Error Handling**: Proper error boundaries với structured logging  
**Caching**: Redis với intelligent TTL strategies  
**Database**: Optimized indexes, JSONB fields, performance views

## 📊 **Auto-Sync System**

### **Background Worker**
- ✅ Runs every 2 minutes với priority-based processing
- ✅ Three-tier priority: triggered → scheduled → stale  
- ✅ Smart triggers: onUserAccess(), onUserTrade(), onUserLogin()
- ✅ Concurrent limits: max 5 parallel syncs để avoid API limits
- ✅ Graceful UX: Loading states (202), background refresh, stale detection

### **Sync Triggers**
```typescript
// Auto-sync triggers
onUserAccess(userId, walletAddress)    // User views portfolio
onUserTrade(userId, walletAddress)     // After successful trade
onUserLogin(userId, walletAddress)     // User authentication

// Priority levels
HIGH:      User-triggered actions (immediate)
SCHEDULED: Regular maintenance sync (every 30min)  
STALE:     Data older than 4 hours (background)
```

### **Caching Strategy**
```typescript
Quick Portfolio: 2 minutes TTL    // Fast UI loading
Full Portfolio: 10 minutes TTL    // Comprehensive data với loading states
P&L 24h: 5 minutes TTL           // Frequent updates
P&L 30d+: 1-4 hours TTL          // Stable calculations
Recent Trades: 5 minutes TTL      // Trade history
Sync Stats: 30 seconds TTL        // System monitoring
```

## 🗄️ **Database Schema**

### **Orders System**
```sql
-- Main orders table
orders (
  order_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  type ORDER_TYPE NOT NULL,
  status ORDER_STATUS NOT NULL,
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  target_price DECIMAL,
  frequency TEXT,
  max_executions INTEGER,
  execution_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Execution tracking  
order_executions (
  execution_id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(order_id),
  execution_index INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  output_amount TEXT NOT NULL,
  gas_used INTEGER,
  gas_price_gwei DECIMAL,
  executed_at TIMESTAMP NOT NULL
);

-- Performance indexes
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_executions_order_id ON order_executions(order_id);
```

### **Portfolio & Trading History**
```sql
-- User trades với JSONB optimization
user_trades (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  chain_id INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  from_token JSONB NOT NULL,
  to_token JSONB NOT NULL,
  gas_fee_usd DECIMAL,
  dex_name TEXT,
  pnl JSONB
);

-- Performance indexes
CREATE INDEX idx_trades_user_timestamp ON user_trades(user_id, timestamp DESC);
CREATE INDEX idx_trades_wallet ON user_trades(wallet_address);
CREATE INDEX idx_trades_chain ON user_trades(chain_id);
CREATE INDEX idx_trades_type ON user_trades(type);
```

## 🚀 **Production Deployment**

### **Environment Requirements**
```bash
# Core Service Configuration
CORE_SERVICE_PORT=3007
CORE_SERVICE_HOST=0.0.0.0

# Database Connection
DATABASE_URL=postgresql://user:pass@host:5432/moonx
REDIS_URL=redis://host:6379

# External APIs
ALCHEMY_API_KEY=your_alchemy_key

# JWT Configuration  
JWT_SECRET=your_jwt_secret
AUTH_SERVICE_URL=http://auth-service:3003

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### **Docker Deployment**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3007
CMD ["node", "dist/index.js"]
```

### **Health Monitoring**
```bash
# Basic health check
curl http://localhost:3007/api/v1/health

# Detailed service monitoring
curl -H "Authorization: Bearer <token>" \
     http://localhost:3007/api/v1/portfolio/sync-status
```

**Overall**: Production-ready Core Service với comprehensive order management, intelligent portfolio sync, real-time P&L analytics, và enterprise-grade technical implementation. Complete feature set ready for frontend integration và production deployment! 🚀