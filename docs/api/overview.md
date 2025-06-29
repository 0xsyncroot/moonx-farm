# API Overview - MoonXFarm DEX

**Status**: Production Ready  
**API Version**: v1  
**Last Updated**: January 2025

## 🎯 API Architecture

MoonXFarm DEX provides RESTful APIs across 3 core services with standardized responses and authentication.

## 📋 Service Endpoints

| Service | Port | Base URL | Status |
|---------|------|----------|--------|
| **Core Service** | 3007 | `/api/v1` | ✅ Production Ready |
| **Auth Service** | 3001 | `/auth` | ✅ Production Ready |
| **Aggregator Service** | 3003 | `/api/v1` | ✅ Production Ready |

## 🔧 Core Service API (Port 3007)

### Order Management
```typescript
POST   /api/v1/orders              // Create limit/DCA orders
GET    /api/v1/orders              // List orders (filtering/pagination)
GET    /api/v1/orders/active       // Active orders only
GET    /api/v1/orders/:id          // Order details + executions
PUT    /api/v1/orders/:id          // Update order
DELETE /api/v1/orders/:id          // Cancel order
POST   /api/v1/orders/:id/executions // Record execution
```

### Portfolio Management
```typescript
GET    /api/v1/portfolio/sync      // Manual sync with Alchemy
GET    /api/v1/portfolio/quick     // Quick portfolio (2min cache)
GET    /api/v1/portfolio/refresh   // Force refresh
GET    /api/v1/portfolio/pnl       // Real-time P&L calculation
GET    /api/v1/portfolio/analytics // Portfolio analytics
GET    /api/v1/portfolio/trades    // Trading history
```

### Health & Monitoring
```typescript
GET    /api/v1/health              // Service health check
```

## 🔐 Auth Service API (Port 3001)

```typescript
POST   /auth/login                 // Social login callback
POST   /auth/refresh               // JWT token refresh
GET    /auth/verify                // Token verification
GET    /auth/user                  // User profile
```

## 📊 Aggregator Service API (Port 3003)

```typescript
GET    /api/v1/quote               // Multi-tier quote aggregation
GET    /api/v1/quote/fast          // Fast quotes (<800ms)
GET    /api/v1/quote/comprehensive // Best quotes (<3s)
GET    /health                     // Service health
```

## 📝 Standard Response Format

### Success Response
```typescript
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### Error Response
```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": { /* error details */ }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## 🔑 Authentication

### JWT Authentication
```typescript
Authorization: Bearer <jwt_token>
```

### Getting JWT Token
```typescript
// 1. Social login via Privy
// 2. POST /auth/login with Privy token
// 3. Receive JWT token
// 4. Use JWT for API requests
```

## ⚡ Performance

| Metric | Target | Current |
|--------|--------|---------|
| **Quote API** | <800ms | ~200-500ms |
| **Portfolio API** | <500ms | ~200-300ms |
| **Order API** | <300ms | ~150-250ms |
| **Auth API** | <200ms | ~100-150ms |

## 📚 Documentation

- **[Core Service API](core-service.md)** - Detailed Core Service endpoints
- **[Authentication](authentication.md)** - Auth flow and JWT management  
- **[Aggregator API](aggregator-service.md)** - Quote aggregation details
- **[Error Handling](error-handling.md)** - Error codes and handling

---

**Production-ready APIs with enterprise-grade performance and reliability.** 