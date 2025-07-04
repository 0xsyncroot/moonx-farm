# API Reference

**Complete API documentation for MoonXFarm DEX**

This reference covers all public APIs available in the MoonXFarm platform. All APIs use RESTful principles with JSON request/response format.

## 🔐 Authentication

All API endpoints require authentication using JWT Bearer tokens obtained from the Auth Service.

```http
Authorization: Bearer <jwt_token>
```

### Base URLs

| Environment | Auth Service | Core Service | Aggregator Service |
|-------------|--------------|--------------|-------------------|
| **Production** | `https://auth.moonx.farm/api/v1` | `https://core.moonx.farm/api/v1` | `https://aggregator.moonx.farm/api/v1` |
| **Development** | `http://localhost:3001/api/v1` | `http://localhost:3007/api/v1` | `http://localhost:3003/api/v1` |

## 🔑 Authentication Service

### Login with Privy

```http
POST /auth/login
Content-Type: application/json

{
  "privy_token": "string",
  "user_id": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "string"
}
```

### Get User Profile

```http
GET /auth/user
Authorization: Bearer <token>
```

### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

## 💼 Core Service API

### Order Management

#### Create Order

```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "limit",
  "pair": "ETH/USDC",
  "side": "buy",
  "amount": "1.0",
  "price": "2000.00",
  "chain_id": 8453
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order_123",
    "type": "limit",
    "status": "pending",
    "user_id": "user_123",
    "pair": "ETH/USDC",
    "side": "buy",
    "amount": "1.0",
    "price": "2000.00",
    "filled_amount": "0.0",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

#### List Orders

```http
GET /orders?status=active&limit=20&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: `active`, `completed`, `cancelled`, `all`
- `type`: `limit`, `dca`, `market`
- `limit`: Number of orders to return (max 100)
- `offset`: Pagination offset

#### Get Order Details

```http
GET /orders/{order_id}
Authorization: Bearer <token>
```

#### Update Order

```http
PUT /orders/{order_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": "2100.00",
  "amount": "0.5"
}
```

#### Cancel Order

```http
DELETE /orders/{order_id}
Authorization: Bearer <token>
```

### Portfolio Management

#### Get Portfolio Overview

```http
GET /portfolio/quick
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_value_usd": "10000.50",
    "total_pnl_usd": "500.25",
    "total_pnl_percentage": "5.25",
    "chains": {
      "8453": {
        "name": "Base",
        "value_usd": "5000.00",
        "tokens": [
          {
            "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            "symbol": "USDC",
            "name": "USD Coin",
            "balance": "5000.000000",
            "value_usd": "5000.00",
            "price_usd": "1.00"
          }
        ]
      }
    },
    "last_updated": "2025-01-01T00:00:00Z"
  }
}
```

#### Sync Portfolio

```http
POST /portfolio/sync
Authorization: Bearer <token>
```

#### Get P&L Analytics

```http
GET /portfolio/pnl?period=7d
Authorization: Bearer <token>
```

**Query Parameters:**
- `period`: `1d`, `7d`, `30d`, `90d`, `1y`, `all`

### Trading History

#### Get Recent Trades

```http
GET /portfolio/trades?limit=50
Authorization: Bearer <token>
```

## 🔄 Aggregator Service

### Get Quote

```http
POST /quotes
Content-Type: application/json

{
  "from_token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "to_token": "0x4200000000000000000000000000000000000006",
  "amount": "1000000000",
  "from_chain_id": 8453,
  "to_chain_id": 8453,
  "slippage": 0.5,
  "user_address": "0x742d35Cc6634C0532925a3b8D5C7e9d10d854A3e"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "provider": "lifi",
        "estimated_amount": "1950000000000000000",
        "estimated_gas": "150000",
        "price_impact": "0.02",
        "route": {
          "steps": [
            {
              "tool": "uniswap-v3",
              "from": "USDC",
              "to": "ETH",
              "fee": "0.05%"
            }
          ]
        },
        "execution_data": "0x..."
      }
    ],
    "best_quote": {
      "provider": "lifi",
      "estimated_amount": "1950000000000000000"
    },
    "response_time_ms": 450
  }
}
```

### Get Supported Tokens

```http
GET /tokens?chain_id=8453
```

### Get Token Price

```http
GET /tokens/{token_address}/price?chain_id=8453
```

## 📊 Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "amount",
      "reason": "Must be a positive number"
    }
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## 🚫 Error Codes

### Authentication Errors
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `INVALID_CREDENTIALS` | 401 | Invalid login credentials |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |

### Validation Errors
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_PARAMETERS` | 400 | Invalid request parameters |
| `MISSING_REQUIRED_FIELD` | 400 | Required field is missing |
| `INVALID_FORMAT` | 400 | Field format is invalid |

### Business Logic Errors
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ORDER_NOT_FOUND` | 404 | Order does not exist |
| `INSUFFICIENT_BALANCE` | 400 | Insufficient token balance |
| `ORDER_ALREADY_FILLED` | 400 | Order is already completed |
| `INVALID_PRICE` | 400 | Price is outside acceptable range |

### System Errors
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `TIMEOUT` | 504 | Request timeout |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

## 🔒 Rate Limiting

API rate limits are applied per user:

| Service | Limit | Window |
|---------|-------|--------|
| **Auth Service** | 100 requests | 1 hour |
| **Core Service** | 1000 requests | 1 hour |
| **Aggregator Service** | 500 requests | 1 hour |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641024000
```

## 🔧 SDK Usage

### JavaScript/TypeScript

```typescript
import { MoonXFarmAPI } from '@moonx-farm/api-client';

const api = new MoonXFarmAPI({
  baseURL: 'https://api.moonx.farm',
  apiKey: 'your-api-key'
});

// Get portfolio
const portfolio = await api.core.getPortfolio();

// Create order
const order = await api.core.createOrder({
  type: 'limit',
  pair: 'ETH/USDC',
  side: 'buy',
  amount: '1.0',
  price: '2000.00'
});

// Get quote
const quote = await api.aggregator.getQuote({
  fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  toToken: '0x4200000000000000000000000000000000000006',
  amount: '1000000000',
  fromChainId: 8453
});
```

## 📝 Additional Resources

- **[Authentication API](Authentication-API)** - Detailed auth documentation
- **[Core Service API](Core-Service-API)** - Orders and portfolio APIs
- **[Aggregator API](Aggregator-API)** - Quote aggregation details
- **[Error Handling](Error-Handling)** - Error handling best practices
- **[WebSocket API](WebSocket-API)** - Real-time updates
- **[API Examples](API-Examples)** - Code examples and tutorials

## 🧪 Testing

### API Playground
Use the interactive API playground for testing:
- **Development**: http://localhost:3001/docs
- **Production**: https://api.moonx.farm/docs

### Postman Collection
Download the Postman collection: [MoonXFarm API Collection](https://api.moonx.farm/postman/collection.json)

---

**Need help?** Check our [FAQ](FAQ) or join the [Discord community](https://discord.gg/moonxfarm) for support. 