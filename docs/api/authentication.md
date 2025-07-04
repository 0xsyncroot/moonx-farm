# Authentication API Documentation

**Service**: Auth Service  
**Port**: 3001  
**Base URL**: `/auth`  
**Status**: ✅ Production Ready  
**Last Updated**: January 2025

## 🎯 Overview

The Auth Service provides authentication and authorization for MoonXFarm DEX using Privy integration for social login and JWT token management. It supports Web3-native authentication with traditional social login options.

## 🔐 Authentication Flow

### Standard Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Privy
    participant AuthService
    participant CoreService

    User->>Frontend: Login Request
    Frontend->>Privy: Social Login
    Privy-->>Frontend: Privy Token
    Frontend->>AuthService: POST /auth/login
    AuthService->>Privy: Verify Token
    Privy-->>AuthService: User Data
    AuthService-->>Frontend: JWT Token
    Frontend->>CoreService: API Request + JWT
    CoreService->>AuthService: Verify JWT
    AuthService-->>CoreService: User Context
    CoreService-->>Frontend: Protected Data
```

## 🔑 API Endpoints

### 1. Social Login
```typescript
POST /auth/login
```

Exchanges Privy token for MoonXFarm JWT token.

**Request Body:**
```typescript
{
  "privyToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "walletAddress"?: "0x...", // Optional for additional verification
  "chainId"?: 8453           // Optional chain context
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,         // 1 hour
    "refreshExpiresIn": 2592000, // 30 days
    "tokenType": "Bearer",
    "user": {
      "userId": "uuid",
      "privyId": "did:privy:...",
      "walletAddress": "0x...",
      "email": "user@example.com",
      "isVerified": true,
      "createdAt": "2025-01-16T10:30:00.000Z",
      "lastLoginAt": "2025-01-16T10:30:00.000Z"
    }
  },
  "message": "Login successful",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

**Error Responses:**
```typescript
// Invalid Privy Token
{
  "success": false,
  "error": {
    "code": "INVALID_PRIVY_TOKEN",
    "message": "Privy token is invalid or expired",
    "details": { "tokenExpired": true }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}

// User Not Found
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User account not found",
    "details": { "privyId": "did:privy:..." }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 2. Token Refresh
```typescript
POST /auth/refresh
```

Refreshes expired access token using refresh token.

**Request Body:**
```typescript
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  },
  "message": "Token refreshed successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

**Error Responses:**
```typescript
// Invalid Refresh Token
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token is invalid or expired",
    "details": { "tokenExpired": true }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 3. Token Verification
```typescript
GET /auth/verify
```

Verifies JWT token validity and returns user context.

**Headers:**
```typescript
Authorization: Bearer <jwt_token>
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "userId": "uuid",
      "privyId": "did:privy:...",
      "walletAddress": "0x...",
      "email": "user@example.com",
      "isVerified": true
    },
    "tokenInfo": {
      "issuedAt": "2025-01-16T10:30:00.000Z",
      "expiresAt": "2025-01-16T11:30:00.000Z",
      "timeToExpiry": 2847
    }
  },
  "message": "Token is valid",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

**Error Responses:**
```typescript
// Invalid Token
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token is invalid or malformed",
    "details": { "reason": "signature_invalid" }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}

// Expired Token
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "JWT token has expired",
    "details": { 
      "expiredAt": "2025-01-16T09:30:00.000Z",
      "expiredFor": 3600
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 4. User Profile
```typescript
GET /auth/user
```

Returns current user profile information.

**Headers:**
```typescript
Authorization: Bearer <jwt_token>
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "privyId": "did:privy:...",
      "walletAddress": "0x...",
      "email": "user@example.com",
      "isVerified": true,
      "linkedAccounts": [
        {
          "type": "email",
          "address": "user@example.com",
          "isVerified": true
        },
        {
          "type": "wallet",
          "address": "0x...",
          "chainId": 8453,
          "isVerified": true
        },
        {
          "type": "google",
          "email": "user@gmail.com",
          "isVerified": true
        }
      ],
      "preferences": {
        "currency": "USD",
        "timezone": "UTC",
        "notifications": {
          "email": true,
          "push": false
        }
      },
      "createdAt": "2025-01-16T10:30:00.000Z",
      "lastLoginAt": "2025-01-16T10:30:00.000Z",
      "lastActiveAt": "2025-01-16T10:30:00.000Z"
    }
  },
  "message": "User profile retrieved successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 5. Logout
```typescript
POST /auth/logout
```

Invalidates current session and refresh token.

**Headers:**
```typescript
Authorization: Bearer <jwt_token>
```

**Request Body:**
```typescript
{
  "allDevices"?: boolean // Optional: logout from all devices
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

### 6. Update User Preferences
```typescript
PUT /auth/user/preferences
```

Updates user preferences and settings.

**Headers:**
```typescript
Authorization: Bearer <jwt_token>
```

**Request Body:**
```typescript
{
  "currency"?: "USD" | "EUR" | "GBP",
  "timezone"?: "UTC" | "America/New_York" | "Europe/London",
  "notifications"?: {
    "email"?: boolean,
    "push"?: boolean,
    "priceAlerts"?: boolean,
    "orderExecutions"?: boolean
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "preferences": {
      "currency": "USD",
      "timezone": "UTC",
      "notifications": {
        "email": true,
        "push": false,
        "priceAlerts": true,
        "orderExecutions": true
      }
    }
  },
  "message": "Preferences updated successfully",
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## 🔒 Security Features

### JWT Token Structure
```typescript
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "uuid",              // User ID
    "privyId": "did:privy:...", // Privy ID
    "wallet": "0x...",          // Primary wallet
    "email": "user@example.com",
    "iat": 1705402200,          // Issued at
    "exp": 1705405800,          // Expires at (1 hour)
    "iss": "moonx-farm-auth",   // Issuer
    "aud": "moonx-farm-api"     // Audience
  }
}
```

### Security Measures
- **Token Expiry**: Access tokens expire in 1 hour
- **Refresh Tokens**: Valid for 30 days with rotation
- **Rate Limiting**: 100 login attempts per hour per IP
- **Session Management**: Redis-based session storage
- **Privy Integration**: Secure Web3 authentication
- **CORS Protection**: Configured for frontend domains
- **Input Validation**: All requests validated with Zod schemas

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 10 requests | 15 minutes |
| `/auth/refresh` | 20 requests | 15 minutes |
| `/auth/verify` | 100 requests | 1 minute |
| `/auth/user` | 60 requests | 1 minute |

## 🔧 Integration Guide

### Frontend Integration (Next.js)
```typescript
// 1. Install dependencies
npm install @privy-io/react-auth

// 2. Setup Privy Provider
import { PrivyProvider } from '@privy-io/react-auth';

export default function App() {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1'
        }
      }}
    >
      {/* Your app */}
    </PrivyProvider>
  );
}

// 3. Use in components
import { usePrivy } from '@privy-io/react-auth';

function LoginButton() {
  const { login, getAccessToken } = usePrivy();
  
  const handleLogin = async () => {
    await login();
    const privyToken = await getAccessToken();
    
    // Exchange for MoonXFarm JWT
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyToken })
    });
    
    const { data } = await response.json();
    localStorage.setItem('moonx_token', data.accessToken);
  };
  
  return <button onClick={handleLogin}>Login</button>;
}
```

### Backend Integration
```typescript
// Verify JWT in other services
import jwt from 'jsonwebtoken';

async function verifyToken(token: string) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, user: payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Middleware for protected routes
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Authorization token required' }
    });
  }
  
  const verification = verifyToken(token);
  if (!verification.valid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: verification.error }
    });
  }
  
  req.user = verification.user;
  next();
}
```

## 🏥 Health Check
```typescript
GET /auth/health
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
      "privy": "healthy"
    },
    "metrics": {
      "activeUsers": 1250,
      "sessionsPerMinute": 45,
      "avgResponseTime": "120ms"
    }
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

## 📊 Error Codes Reference

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_PRIVY_TOKEN` | Privy token invalid/expired | 401 |
| `USER_NOT_FOUND` | User account not found | 404 |
| `INVALID_REFRESH_TOKEN` | Refresh token invalid/expired | 401 |
| `INVALID_TOKEN` | JWT token invalid/malformed | 401 |
| `TOKEN_EXPIRED` | JWT token expired | 401 |
| `NO_TOKEN` | Authorization header missing | 401 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `PRIVY_SERVICE_ERROR` | Privy service unavailable | 502 |
| `INTERNAL_ERROR` | Server error | 500 |

## 🔧 Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=30d

# Privy Configuration
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/moonx_auth

# Redis
REDIS_URL=redis://localhost:6379

# Service Configuration
PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://app.moonx.farm,https://moonx.farm
```

---

**Production-ready authentication service with Web3-native social login and enterprise security.** 