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

### Authentication Endpoints

- `POST /api/v1/auth/login` - Login với Privy token
- `POST /api/v1/auth/refresh` - Refresh access token  
- `POST /api/v1/auth/logout` - Logout current session
- `GET /api/v1/auth/me` - Get current user info

### Session Management

- `GET /api/v1/session/list` - List user sessions
- `DELETE /api/v1/session/revoke/:id` - Revoke specific session
- `DELETE /api/v1/session/revoke-others` - Revoke all other sessions

### User Management

- `GET /api/v1/user/profile` - Get user profile
- `PATCH /api/v1/user/profile` - Update user profile
- `GET /api/v1/user/stats` - Get user statistics
- `POST /api/v1/user/deactivate` - Deactivate account