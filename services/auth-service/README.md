# Authentication Service

Authentication service for MoonXFarm DEX với Privy integration và enterprise-grade security.

## 🏗️ Kiến trúc Layered

### Infrastructure Layer (`@moonx/infrastructure`)
**Base/Generic operations** - không chứa business logic:
- `DatabaseManager`: PostgreSQL connection, query, transaction management
- `RedisManager`: Redis caching, pub/sub, pipeline operations

### Domain Service Layer (`services/auth-service/src/services/`)
**Authentication-specific business logic**:

#### DatabaseService
Domain-specific database operations:
```typescript
// ✅ Sử dụng domain methods
await fastify.db.createUser(userData)
await fastify.db.getUserByPrivyId(privyId)
await fastify.db.createSession(sessionData)
await fastify.db.deleteAllUserSessions(userId)

// ❌ Tránh bypass domain logic
await fastify.db.query("INSERT INTO users...") // Chỉ dùng khi cần thiết
```

#### RedisService  
Authentication-specific caching operations:
```typescript
// ✅ Sử dụng domain methods
await fastify.redisService.blacklistToken(tokenId, ttl)
await fastify.redisService.setRefreshToken(userId, tokenId, ttl)
await fastify.redisService.incrementRateLimit(identifier, windowMs, maxRequests)
await fastify.redisService.setUserCache(userId, userData)

// ❌ Tránh generic operations khi có domain method
await fastify.redisService.set(key, value) // Chỉ dùng khi domain method không phù hợp
```

#### JwtService
JWT token management:
```typescript
await fastify.jwtService.createTokenPair(payload, logContext)
await fastify.jwtService.verifyToken(token, logContext)
await fastify.jwtService.refreshAccessToken(refreshToken, logContext)
```

## 📋 Best Practices

### 1. **Controllers nên sử dụng Domain Methods**
```typescript
// ✅ ĐÚNG - Domain-specific method
const user = await fastify.db.getUserByPrivyId(privyUserId);
await fastify.redisService.blacklistToken(tokenId, 3600);

// ❌ SAI - Bypass domain logic  
const result = await fastify.db.query("SELECT * FROM users WHERE privy_user_id = $1", [privyUserId]);
await fastify.redisService.set(`blacklist:${tokenId}`, "1", { ttl: 3600 });
```

### 2. **Error Handling Pattern**
```typescript
try {
  // Domain operation
  const user = await fastify.db.createUser(userData);
  logger.info('User created successfully', { userId: user.id });
} catch (error) {
  // Domain service đã log error, chỉ cần handle response
  return reply.code(500).send({
    success: false,
    message: 'User creation failed',
  });
}
```

### 3. **Rate Limiting Pattern**
```typescript
// ✅ Sử dụng domain-specific rate limiting
const attempts = await fastify.redisService.incrementRateLimit(
  `login_attempts:${ip}`, 
  900000, // 15 minutes
  5       // max attempts
);

if (attempts.exceeded) {
  return reply.code(429).send({
    success: false,
    message: 'Too many attempts',
    retryAfter: Math.ceil(attempts.ttl / 60)
  });
}
```

### 4. **Session Management Pattern**
```typescript
// ✅ Parallel operations với proper error handling
await Promise.allSettled([
  fastify.db.createSession(sessionData),
  fastify.redisService.setRefreshToken(userId, tokenId, ttl),
  fastify.redisService.setUserCache(userId, userData)
]);
```

## 🚀 Development

### Required Environment Variables

```bash
# Server Configuration
AUTH_SERVICE_HOST=localhost
AUTH_SERVICE_PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/moonx_farm
DATABASE_MAX_CONNECTIONS=20
DATABASE_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=moonx:auth:

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=moonx-farm
JWT_AUDIENCE=moonx-farm-users

# Privy
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_VERIFICATION_KEY=your-privy-verification-key
```

### Getting Started

```bash
# Install dependencies
pnpm install

# Setup database
psql -U postgres -c "CREATE DATABASE moonx_farm;"
psql -U postgres -d moonx_farm -f ../../database/migrations/001_create_users.sql
psql -U postgres -d moonx_farm -f ../../database/migrations/002_create_user_sessions.sql

# Start Redis
redis-server

# Run development server
pnpm dev
```

### Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Type check
pnpm type-check
```

## 📁 Project Structure

```
src/
├── controllers/           # API route handlers
│   ├── authController.ts     # Authentication endpoints
│   ├── sessionController.ts  # Session management
│   └── userController.ts     # User profile management
├── services/             # Domain service layer
│   ├── databaseService.ts   # Auth-specific database operations
│   ├── redisService.ts      # Auth-specific caching operations
│   ├── jwtService.ts        # JWT token management
│   └── privyService.ts      # Privy API integration
├── middleware/           # Request middleware
│   ├── authMiddleware.ts    # JWT verification
│   ├── errorHandler.ts     # Global error handling
│   └── requestLogger.ts    # Request/response logging
└── server.ts            # Fastify server setup
```

## 🔒 Security Features

- **JWT Authentication**: Access + Refresh token pattern
- **Token Blacklisting**: Logout security với Redis
- **Rate Limiting**: IP-based với intelligent windowing
- **Session Management**: Multi-device session tracking
- **Social Login**: Privy integration (Google, TikTok, Telegram, X, Farcaster)
- **Audit Logging**: Comprehensive security event logging
- **Input Validation**: Zod schema validation
- **Error Safety**: No sensitive data exposure

## 🏥 Health Monitoring

### Health Check Endpoint
```
GET /health
```

Response:
```json
{
  "status": "ok|degraded",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "auth-service",
  "version": "1.0.0",
  "services": {
    "database": "healthy|unhealthy",
    "redis": "healthy|unhealthy", 
    "jwt": "healthy"
  },
  "poolStats": {
    "totalCount": 10,
    "idleCount": 8,
    "waitingCount": 0
  }
}
```

## 📊 Performance

- **Database Connection Pooling**: Optimized PostgreSQL connections
- **Redis Pipeline**: Batch operations cho rate limiting
- **Parallel Operations**: Async operations không blocking
- **Smart Caching**: User data caching với TTL
- **Memory Management**: Bounded cache sizes với auto cleanup

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connection string
   psql $DATABASE_URL
   ```

2. **Redis Connection Failed** 
   ```bash
   # Check Redis status
   redis-cli ping
   
   # Check config
   redis-cli config get "*"
   ```

3. **JWT Verification Failed**
   ```bash
   # Check JWT secret
   echo $JWT_SECRET
   
   # Verify token format
   node -e "console.log(require('jsonwebtoken').decode('YOUR_TOKEN'))"
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3001
```

### Authentication
Most endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication Endpoints (`/api/v1/auth`)

### POST `/api/v1/auth/login`
Authenticate user using Privy token and return JWT tokens.

**Request:**
```json
{
  "privyToken": "string" // Privy access token
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "string",
      "privyId": "string", 
      "walletAddress": "string",
      "email": "string|null",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string", 
      "expiresAt": "2024-01-01T00:00:00.000Z",
      "expiresIn": 900, // seconds
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid request (missing privyToken)
- `401`: Invalid or expired Privy token
- `429`: Too many login attempts (rate limited)
- `500`: Internal server error

---

### POST `/api/v1/auth/refresh`
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "privyId": "string",
      "walletAddress": "string", 
      "email": "string|null",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresAt": "2024-01-01T00:00:00.000Z", 
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid request (missing refreshToken)
- `401`: Invalid or expired refresh token
- `500`: Internal server error

---

### POST `/api/v1/auth/logout`
**Authentication Required**

Logout current session and invalidate tokens.

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- `401`: Unauthorized (invalid or missing token)
- `500`: Internal server error

---

### GET `/api/v1/auth/verify`
**Authentication Required**

Verify token validity and get current user info.

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "privyId": "string",
      "walletAddress": "string",
      "email": "string|null", 
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "valid": true
  }
}
```

**Error Responses:**
- `401`: Unauthorized (invalid token or user deactivated)
- `500`: Internal server error

---

## 📋 Session Management Endpoints (`/api/v1/session`)

### GET `/api/v1/session/list`
**Authentication Required**

Get paginated list of user sessions.

**Query Parameters:**
- `limit` (optional): Number of sessions per page (1-100, default: 10)
- `offset` (optional): Number of sessions to skip (default: 0)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "string",
        "sessionToken": "abc12345...", // Masked for security
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z", 
        "expiresAt": "2024-01-01T00:00:00.000Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "isActive": true
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 10,
      "offset": 0, 
      "hasMore": false
    }
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `429`: Rate limited (too many requests)
- `500`: Internal server error

---

### DELETE `/api/v1/session/revoke/:sessionId`
**Authentication Required**

Revoke a specific session.

**Path Parameters:**
- `sessionId`: Session ID to revoke

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: Session not found
- `429`: Rate limited
- `500`: Internal server error

---

### POST `/api/v1/session/revoke-others`
**Authentication Required**

Revoke all other sessions except current one.

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "message": "3 other sessions revoked successfully",
  "data": {
    "revokedCount": 3
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `429`: Rate limited (strict limit)
- `500`: Internal server error

---

### GET `/api/v1/session/current`
**Authentication Required**

Get current session information.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "string",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-01-01T00:00:00.000Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "isActive": true
    },
    "token": {
      "issuedAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-01-01T00:00:00.000Z", 
      "tokenId": "abc12345..." // Masked
    }
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: Session not found
- `500`: Internal server error

---

## 👤 User Management Endpoints (`/api/v1/user`)

### GET `/api/v1/user/profile`
**Authentication Required**

Get user profile information.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "string|null",
      "hasWallet": true,
      "hasSocialAccount": true,
      "primarySocialProvider": "google", // google|tiktok|telegram|x|farcaster
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z",
      "isActive": true
    }
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: User not found
- `429`: Rate limited
- `500`: Internal server error

---

### PUT `/api/v1/user/profile`
**Authentication Required**

Update user profile (email only).

**Request:**
```json
{
  "email": "string|null" // Valid email or null
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "string",
      "email": "new-email@example.com",
      "hasWallet": true,
      "hasSocialAccount": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z",
      "isActive": true
    }
  }
}
```

**Error Responses:**
- `400`: Invalid email format or no fields to update
- `401`: Unauthorized
- `429`: Rate limited
- `500`: Internal server error

---

### GET `/api/v1/user/stats`
**Authentication Required**

Get user account statistics.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "activeSessions": 3,
      "accountAge": 45, // days since account creation
      "lastLogin": "2024-01-01T00:00:00.000Z",
      "isActive": true
    }
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `404`: User not found
- `429`: Rate limited
- `500`: Internal server error

---

### POST `/api/v1/user/deactivate`
**Authentication Required**

Deactivate user account (soft delete).

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account deactivated successfully"
}
```

**Error Responses:**
- `401`: Unauthorized
- `429`: Rate limited (very strict - once per day)
- `500`: Internal server error

---

## 🏥 Health Monitoring

### GET `/health`
Service health check (no authentication required).

**Success Response (200):**
```json
{
  "status": "ok", // ok|degraded
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "auth-service",
  "version": "1.0.0",
  "services": {
    "database": "healthy", // healthy|unhealthy
    "redis": "healthy",
    "jwt": "healthy"
  },
  "poolStats": {
    "totalCount": 10,
    "idleCount": 8,
    "waitingCount": 0
  }
}
```

---

## 🔧 Integration Examples

### JavaScript/TypeScript Example

```javascript
// Login
const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    privyToken: 'your-privy-token'
  })
});

const loginData = await loginResponse.json();
const { accessToken, refreshToken } = loginData.data.tokens;

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Authenticated requests
const profileResponse = await fetch('http://localhost:3001/api/v1/user/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
});

// Token refresh
const refreshResponse = await fetch('http://localhost:3001/api/v1/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    refreshToken: refreshToken
  })
});
```

### Python Example

```python
import requests

# Login
login_response = requests.post('http://localhost:3001/api/v1/auth/login', json={
    'privyToken': 'your-privy-token'
})

login_data = login_response.json()
access_token = login_data['data']['tokens']['accessToken']

# Authenticated request
headers = {'Authorization': f'Bearer {access_token}'}
profile_response = requests.get('http://localhost:3001/api/v1/user/profile', headers=headers)
```

---

## ⚠️ Rate Limiting

All endpoints have rate limiting to prevent abuse:

- **Login**: 5 attempts per 15 minutes per IP
- **Session List**: 10 requests per minute per user
- **Session Revoke**: 20 requests per 5 minutes per user  
- **Session Revoke Others**: 5 requests per hour per user
- **Profile Access**: 30 requests per minute per user
- **Profile Updates**: 5 requests per 5 minutes per user
- **User Stats**: 10 requests per 5 minutes per user
- **Account Deactivation**: 1 request per day per user

Rate limit exceeded responses return HTTP 429 with retry information.

---

## 🔐 Security Notes

1. **Token Storage**: Store JWT tokens securely (httpOnly cookies recommended for web apps)
2. **Token Expiry**: Access tokens expire in 15 minutes, refresh tokens in 7 days
3. **Session Management**: Each login creates a new session; logout invalidates tokens
4. **Rate Limiting**: Aggressive rate limiting on sensitive operations
5. **Data Exposure**: API responses never expose sensitive internal data
6. **Audit Logging**: All authentication events are logged for security monitoring

---

## 🚨 Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "retryAfter": 60 // Present for rate limiting errors (seconds)
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (authentication required/failed)
- `404`: Not Found
- `429`: Rate Limited
- `500`: Internal Server Error