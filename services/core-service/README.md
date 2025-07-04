# MoonXFarm Core Service

Central Platform Service providing **Order Management**, **Portfolio Sync**, **P&L Analytics**, **Trading History**, **Sync Management**, và **Chain Management** cho MoonXFarm platform.

## 🏗️ Architecture

**Port**: 3007 (configured in @moonx-farm/configs)  
**Framework**: Fastify v5 with TypeScript  
**Infrastructure**: @moonx/infrastructure, @moonx-farm/configs, @moonx/common  
**Authentication**: JWT verification via Auth Service + Admin API key for admin operations  
**Database**: PostgreSQL với orders, order_executions, user_trades, chains, sync_operations tables  
**Caching**: Redis with intelligent TTL strategies + auto-refresh cache  
**External APIs**: Alchemy API (5 chains: Ethereum, Polygon, Optimism, Arbitrum, Base)

## 🔧 **Current Implementation Status**

✅ **PRODUCTION READY** - Core Service với complete feature set:
- ✅ **Order Management**: Complete CRUD với LIMIT/DCA orders
- ✅ **Portfolio Sync**: Alchemy integration với auto-sync system
- ✅ **P&L Analytics**: Real-time P&L với cost basis tracking
- ✅ **Sync Management**: Manual sync triggers, status monitoring, và admin controls
- ✅ **Chain Management**: Centralized blockchain network configuration với admin controls
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

### 🔷 Sync Management (User + Admin)
**User Endpoints (Authentication required):**
- `POST /api/v1/sync/trigger` - Manual sync for current user
- `GET /api/v1/sync/status` - Get sync status for current user
- `GET /api/v1/sync/operations` - Get sync operations history
- `DELETE /api/v1/sync/operations/:operationId` - Cancel sync operation

**Admin Endpoints (x-api-key required):**
- `GET /api/v1/sync/queue` - Get sync queue status
- `POST /api/v1/sync/bulk` - Trigger bulk sync for multiple users
- `PUT /api/v1/sync/pause` - Pause/resume sync service
- `GET /api/v1/sync/stats` - Get detailed sync statistics

### 🔷 Chain Management (Public + Admin)
**Public Endpoints (No Authentication):**
- `GET /api/v1/chains` - Get all supported blockchain networks
- `GET /api/v1/chains/active` - Get active chains only
- `GET /api/v1/chains/stats` - Chain statistics overview
- `GET /api/v1/chains/:id` - Get chain by UUID
- `GET /api/v1/chains/chain-id/:chainId` - Get chain by chain ID

**Admin Endpoints (x-api-key required):**
- `POST /api/v1/admin/chains` - Create new blockchain network
- `PUT /api/v1/admin/chains/:id` - Update chain configuration
- `DELETE /api/v1/admin/chains/:id` - Delete chain
- `POST /api/v1/admin/chains/refresh-cache` - Refresh chain cache

### 🔷 System Health
- `GET /api/v1/health` - Service health check

## 📋 API Detailed Documentation

### **Sync Management APIs**

#### `POST /api/v1/sync/trigger` - Manual Sync for Current User
**Purpose**: Trigger manual portfolio sync for authenticated user

**Request Body**:
```json
{
  "priority": "high" | "normal" | "low",     // Optional: default "normal"
  "syncType": "portfolio" | "trades" | "full", // Optional: default "portfolio"
  "forceRefresh": boolean                      // Optional: default false
}
```

**Response (202)**:
```json
{
  "success": true,
  "data": {
    "syncTriggered": true,
    "userId": "user-uuid",
    "walletAddress": "0x...",
    "priority": "high",
    "syncType": "portfolio",
    "forceRefresh": true,
    "message": "Sync initiated successfully. Check sync status for progress."
  },
  "message": "portfolio sync triggered with high priority",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/sync/status` - Get User Sync Status
**Purpose**: Get detailed sync status for authenticated user

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "walletAddress": "0x...",
    "lastSyncAt": "2024-01-15T10:25:00Z",
    "syncStatus": "current",  // "current" | "recent" | "stale" | "never"
    "isRunning": false,
    "activeSyncOperations": 0,
    "totalTokens": 23,
    "totalValueUsd": 12459.34,
    "syncFrequency": 1800,     // seconds (30 minutes)
    "nextScheduledSync": "2024-01-15T11:00:00Z"
  },
  "message": "User sync status retrieved",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/sync/operations` - Get Sync Operations History
**Purpose**: Get sync operations history for authenticated user

**Query Parameters**:
```typescript
{
  limit?: number;    // Default: 20, Max: 100
  status?: "pending" | "running" | "completed" | "failed";
  type?: "portfolio" | "trades" | "full";
  days?: number;     // Default: 7, Max: 90
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "operations": [
      {
        "id": "sync-operation-uuid",
        "type": "portfolio",
        "status": "completed",
        "priority": "high",
        "startedAt": "2024-01-15T10:25:00Z",
        "completedAt": "2024-01-15T10:25:15Z",
        "duration": 15000,         // milliseconds
        "tokensLynced": 23,
        "chainsLynced": 5,
        "totalValueUsd": 12459.34,
        "error": null,
        "retryCount": 0
      }
    ],
    "count": 15,
    "filters": {
      "limit": 20,
      "status": "completed",
      "days": 7
    }
  },
  "message": "Retrieved 15 sync operations",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `DELETE /api/v1/sync/operations/:operationId` - Cancel Sync Operation
**Purpose**: Cancel a pending sync operation for authenticated user

**Response**:
```json
{
  "success": true,
  "data": {
    "operationId": "sync-operation-uuid",
    "cancelled": true,
    "previousStatus": "pending",
    "cancelledAt": "2024-01-15T10:30:00Z"
  },
  "message": "Sync operation cancelled successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Response (404)**:
```json
{
  "success": false,
  "error": "Sync operation not found",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/sync/queue` - Get Sync Queue Status (Admin Only)
**Purpose**: Get current sync queue status and statistics

**Headers**:
```
x-api-key: your-admin-api-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "usersNeedingSync": 45,
    "stalePortfolios": 12,
    "isRunning": true,
    "lastProcessedAt": "2024-01-15T10:29:30Z",
    "syncErrors": 3
  },
  "message": "Sync queue status retrieved",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/v1/sync/bulk` - Trigger Bulk Sync (Admin Only)
**Purpose**: Trigger sync for multiple users or wallets

**Headers**:
```
x-api-key: your-admin-api-key
Content-Type: application/json
```

**Request Body**:
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],      // Optional
  "walletAddresses": ["0x...", "0x..."],          // Optional
  "priority": "low",                               // Optional: default "low"
  "syncType": "portfolio",                         // Optional: default "portfolio"
  "batchSize": 10                                  // Optional: default 10, max 50
}
```

**Response (202)**:
```json
{
  "success": true,
  "data": {
    "bulkSyncTriggered": true,
    "totalRequests": 50,
    "successfulTriggers": 48,
    "failedTriggers": 2,
    "priority": "low",
    "syncType": "portfolio",
    "batchSize": 10
  },
  "message": "Bulk sync initiated for 50 targets",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `PUT /api/v1/sync/pause` - Pause/Resume Sync Service (Admin Only)
**Purpose**: Pause or resume the automatic sync service

**Headers**:
```
x-api-key: your-admin-api-key
Content-Type: application/json
```

**Request Body**:
```json
{
  "action": "pause" | "resume",   // Required
  "reason": "Maintenance period"  // Optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "pause",
    "success": true,
    "previousState": true,    // was running
    "currentState": false,    // now paused
    "reason": "Maintenance period",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "message": "Sync service paused successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/sync/stats` - Get Detailed Sync Statistics (Admin Only)
**Purpose**: Get comprehensive sync statistics with breakdown

**Headers**:
```
x-api-key: your-admin-api-key
```

**Query Parameters**:
```typescript
{
  timeframe?: "24h" | "7d" | "30d";      // Default: "24h"
  breakdown?: "user" | "chain" | "type"; // Default: "type"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "timeframe": "24h",
    "breakdown": "type",
    "summary": {
      "totalSyncs": 1250,
      "successfulSyncs": 1205,
      "failedSyncs": 45,
      "averageDuration": 4500,    // milliseconds
      "totalTokensSynced": 28750,
      "totalValueSynced": 15750000.50
    },
    "breakdownData": [
      {
        "category": "portfolio",
        "count": 980,
        "successRate": 96.5,
        "avgDuration": 4200,
        "totalValue": 12500000.00
      },
      {
        "category": "trades",
        "count": 180,
        "successRate": 94.2,
        "avgDuration": 2800,
        "totalValue": 2250000.50
      },
      {
        "category": "full",
        "count": 90,
        "successRate": 91.1,
        "avgDuration": 8500,
        "totalValue": 1000000.00
      }
    ],
    "serviceStatus": {
      "isRunning": true,
      "lastProcessedAt": "2024-01-15T10:29:30Z",
      "queueLength": 15
    }
  },
  "message": "Sync statistics for 24h retrieved",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

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

### **Chain Management APIs**

> **Note**: Aggregator Providers field support ANY aggregator names (not limited to lifi/relay/oneinch). Examples: `paraswap`, `zeroex`, `uniswap`, `rambo`, `kyberswap`, etc. Each chain can have different combinations.

#### `GET /api/v1/chains` - Get All Chains
**Purpose**: Lấy danh sách tất cả supported blockchain networks với optional filtering

**Query Parameters**:
```typescript
{
  networkType?: "mainnet" | "testnet";    // Optional: filter by network type
  status?: "active" | "inactive" | "maintenance";  // Optional: filter by status
  active?: boolean;                        // Optional: filter by active flag
  isTestnet?: boolean;                    // Optional: filter testnets
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "chains": [
      {
        "id": "uuid",
        "chainId": 1,
        "name": "Ethereum",
        "shortName": "eth",
        "networkType": "mainnet",
        "rpcProviders": {
          "primary": "https://eth-mainnet.alchemyapi.io/v2/...",
          "secondary": "https://mainnet.infura.io/v3/...",
          "fallback": "https://ethereum.publicnode.com"
        },
                 "aggregatorProviders": {
           "lifi": {
             "enabled": true,
             "functionName": "callLifi",
             "priority": 1
           },
           "relay": {
             "enabled": true,
             "functionName": "callRelay", 
             "priority": 2
           },
           "paraswap": {
             "enabled": true,
             "functionName": "callParaswap",
             "priority": 3
           },
           "zeroex": {
             "enabled": false,
             "functionName": "callZeroEx",
             "priority": 4
           }
         },
        "explorerUrls": ["https://etherscan.io"],
        "nativeCurrency": {
          "name": "Ether",
          "symbol": "ETH",
          "decimals": 18
        },
        "iconUrl": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
        "brandColor": "#627EEA",
        "active": true,
        "status": "active",
        "priority": 1,
        "isTestnet": false,
        "diamondContractAddress": "0x1234567890123456789012345678901234567890",
        "chainConfig": {
          "gasLimit": 21000,
          "blockTime": 12,
          "maxGasPrice": "100000000000"
        },
        "faucetUrls": [],
        "docsUrl": "https://ethereum.org/docs",
        "websiteUrl": "https://ethereum.org",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ]
  },
  "message": "Retrieved 6 chains",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/chains/active` - Get Active Chains
**Purpose**: Lấy tất cả chains đang active (sẵn sàng cho trading)

**Response**:
```json
{
  "success": true,
  "data": {
    "chains": [
      {
        "id": "uuid",
        "chainId": 1,
        "name": "Ethereum",
        "shortName": "eth",
        "active": true,
        "status": "active",
        "priority": 1,
        "rpcProviders": {
          "primary": "https://eth-mainnet.alchemyapi.io/v2/..."
        },
        "nativeCurrency": {
          "name": "Ether",
          "symbol": "ETH",
          "decimals": 18
        }
      }
    ]
  },
  "message": "Found 4 active chains",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/chains/stats` - Chain Statistics
**Purpose**: Lấy thống kê tổng quan về supported chains

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 12,
      "active": 6,
      "inactive": 6,
      "mainnet": 6,
      "testnet": 6
    }
  },
  "message": "Chain statistics retrieved successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/chains/:id` - Get Chain by UUID
**Purpose**: Lấy chi tiết chain bằng internal UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "chain": {
      "id": "uuid",
      "chainId": 1,
      "name": "Ethereum",
      "shortName": "eth",
      "networkType": "mainnet",
      "rpcProviders": {
        "primary": "https://eth-mainnet.alchemyapi.io/v2/...",
        "secondary": "https://mainnet.infura.io/v3/...",
        "fallback": "https://ethereum.publicnode.com"
      },
      "aggregatorProviders": {
        "lifi": {
          "enabled": true,
          "functionName": "callLifi",
          "priority": 1
        }
      },
      "diamondContractAddress": "0x1234567890123456789012345678901234567890",
      "active": true,
      "status": "active"
    }
  },
  "message": "Chain retrieved successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `GET /api/v1/chains/chain-id/:chainId` - Get Chain by Chain ID
**Purpose**: Lấy chain bằng numeric chain ID (ví dụ: 1 cho Ethereum, 56 cho BSC)

**Response**: Same as above but using chainId parameter

#### `POST /api/v1/admin/chains` - Create Chain (Admin Only)
**Purpose**: Tạo blockchain network configuration mới

**Headers**:
```
x-api-key: your-admin-api-key
Content-Type: application/json
```

**Request Body**:
```json
{
  "chainId": 42161,
  "name": "Arbitrum One",
  "shortName": "arbitrum",
  "networkType": "mainnet",
  "rpcProviders": {
    "primary": "https://arb1.arbitrum.io/rpc",
    "secondary": "https://arbitrum-one.publicnode.com",
    "fallback": "https://rpc.ankr.com/arbitrum"
  },
     "aggregatorProviders": {
     "lifi": {
       "enabled": true,
       "functionName": "callLifi",
       "priority": 1
     },
     "rambo": {
       "enabled": true,
       "functionName": "callRambo",
       "priority": 2
     },
     "kyberswap": {
       "enabled": false,
       "functionName": "callKyber",
       "priority": 3
     }
   },
  "explorerUrls": ["https://arbiscan.io"],
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH", 
    "decimals": 18
  },
  "iconUrl": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  "brandColor": "#2D374B",
  "active": true,
  "status": "active",
  "priority": 4,
  "diamondContractAddress": "0x1234567890123456789012345678901234567890",
  "chainConfig": {
    "gasLimit": 21000,
    "blockTime": 0.25,
    "maxGasPrice": "100000000000"
  },
  "websiteUrl": "https://arbitrum.io",
  "docsUrl": "https://docs.arbitrum.io"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "chain": {
      "id": "new-uuid",
      "chainId": 42161,
      "name": "Arbitrum One",
      "active": true,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  },
  "message": "Chain created successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `PUT /api/v1/admin/chains/:id` - Update Chain (Admin Only)
**Purpose**: Cập nhật chain configuration

**Headers**:
```
x-api-key: your-admin-api-key
Content-Type: application/json
```

**Request Body** (các fields optional):
```json
{
  "active": false,
  "status": "maintenance",
  "rpcProviders": {
    "primary": "https://new-rpc-endpoint.com"
  },
     "aggregatorProviders": {
     "lifi": {
       "enabled": false,
       "functionName": "callLifi",
       "priority": 1
     },
     "uniswap": {
       "enabled": true,
       "functionName": "callUniswap",
       "priority": 2
     }
   }
}
```

#### `DELETE /api/v1/admin/chains/:id` - Delete Chain (Admin Only)
**Purpose**: Xóa chain configuration

**Headers**:
```
x-api-key: your-admin-api-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "message": "Chain deleted successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/v1/admin/chains/refresh-cache` - Refresh Cache (Admin Only)
**Purpose**: Manually refresh chain cache (cache auto-refreshes sau admin operations)

**Headers**:
```
x-api-key: your-admin-api-key
```

**Response**:
```json
{
  "success": true,
  "data": {
    "refreshed": true
  },
  "message": "Chain cache refreshed successfully",
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

### **Chain Management System**
- ✅ **Centralized Configuration**: Single source of truth cho blockchain networks
- ✅ **Multi-Provider Support**: Primary/secondary/fallback RPC configurations
- ✅ **Flexible Aggregator Integration**: Support ANY aggregator (LiFi, Relay, 1inch, Paraswap, 0x, Uniswap, Rambo, Kyber, v.v.) với custom function names
- ✅ **Diamond Contract Management**: Store contract addresses per chain
- ✅ **Public/Admin Split**: Public read endpoints, admin-protected CRUD operations
- ✅ **Auto Cache Refresh**: Intelligent cache invalidation sau admin modifications
- ✅ **Production Ready**: GitHub-hosted icons, comprehensive validation, audit logging

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
│   ├── chains.ts      # Chain management routes (public + admin)
│   └── health.ts      # Health check routes
├── controllers/
│   ├── orderController.ts
│   ├── portfolioController.ts
│   ├── chainController.ts
│   └── healthController.ts
├── services/
│   ├── portfolioService.ts
│   ├── pnlService.ts
│   ├── tradesService.ts
│   ├── chainService.ts      # Chain management với cache
│   └── autoSyncService.ts
├── models/
│   └── chain.ts             # Chain database model
├── schemas/
│   ├── orderSchemas.ts
│   └── chainSchemas.ts      # Zod validation schemas
├── middleware/
│   ├── authMiddleware.ts
│   └── adminMiddleware.ts   # Admin API key authentication
└── index.ts                 # Main server với route registration
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

# Chain management examples
curl http://localhost:3007/api/v1/chains/active
curl http://localhost:3007/api/v1/chains/chain-id/1

# Admin chain operations (requires ADMIN_API_KEY)
curl -H "x-api-key: your-admin-key" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{"chainId": 42161, "name": "Arbitrum One", ...}' \
     http://localhost:3007/api/v1/admin/chains
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

### **Chain Management Schema**
```sql
-- Blockchain networks configuration
chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(20) NOT NULL,
  network_type VARCHAR(10) NOT NULL CHECK (network_type IN ('mainnet', 'testnet')),
  rpc_providers JSONB NOT NULL,
  aggregator_providers JSONB DEFAULT '{}'::jsonb,
  explorer_urls TEXT[] NOT NULL,
  native_currency JSONB NOT NULL,
  icon_url TEXT,
  brand_color VARCHAR(7) CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  active BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  priority INTEGER NOT NULL DEFAULT 0,
  is_testnet BOOLEAN NOT NULL DEFAULT false,
  diamond_contract_address VARCHAR(42) 
    CHECK (diamond_contract_address ~ '^0x[a-fA-F0-9]{40}$'),
  chain_config JSONB DEFAULT '{}'::jsonb,
  faucet_urls TEXT[],
  docs_url TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_chains_chain_id ON chains(chain_id);
CREATE INDEX idx_chains_active ON chains(active);
CREATE INDEX idx_chains_status ON chains(status);
CREATE INDEX idx_chains_network_type ON chains(network_type);
CREATE INDEX idx_chains_priority ON chains(priority DESC);
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

# Admin API Access (Chain Management)
ADMIN_API_KEY=your_admin_api_key_32_chars_minimum

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

**Overall**: Production-ready Core Service với comprehensive order management, intelligent portfolio sync, real-time P&L analytics, centralized chain management, và enterprise-grade technical implementation. Complete feature set ready for frontend integration và production deployment! 🚀