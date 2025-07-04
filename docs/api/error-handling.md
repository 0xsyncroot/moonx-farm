# Error Handling Guide - MoonXFarm DEX

**Status**: Production Ready  
**Standard**: MoonXFarm API Error Format v1  
**Last Updated**: January 2025

## 🎯 Overview

MoonXFarm DEX implements standardized error handling across all services with consistent response formats, error codes, and recovery strategies. This guide covers error patterns, handling strategies, and best practices for developers.

## 📋 Standard Error Response Format

### Base Error Structure
```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",           // Machine-readable error identifier
    "message": "Human readable error message",
    "details"?: {                   // Optional additional context
      // Service-specific error details
    },
    "field"?: "fieldName",          // For validation errors
    "retryable"?: boolean,          // Whether client should retry
    "retryAfter"?: number          // Seconds to wait before retry
  },
  "timestamp": "2025-01-16T10:30:00.000Z",
  "requestId"?: "uuid"             // For error tracking
}
```

### HTTP Status Code Mapping
| HTTP Status | Category | Description |
|-------------|----------|-------------|
| **400** | Client Error | Bad request, validation failure |
| **401** | Authentication | Invalid or missing authentication |
| **403** | Authorization | Insufficient permissions |
| **404** | Not Found | Resource does not exist |
| **409** | Conflict | Resource conflict (duplicate, state mismatch) |
| **422** | Validation | Semantic validation failure |
| **429** | Rate Limit | Too many requests |
| **500** | Server Error | Internal server error |
| **502** | Bad Gateway | External service error |
| **503** | Service Unavailable | Service temporarily down |
| **504** | Gateway Timeout | External service timeout |

## 🔧 Service-Specific Error Codes

### Core Service Errors

#### Order Management
```typescript
// Invalid Order Parameters
{
  "success": false,
  "error": {
    "code": "INVALID_ORDER_PARAMETERS",
    "message": "Order parameters are invalid",
    "details": {
      "invalidFields": ["limitPrice", "fromAmount"],
      "limitPrice": "Must be greater than 0",
      "fromAmount": "Must be a valid number"
    },
    "retryable": false
  }
}

// Order Not Found
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with specified ID does not exist",
    "details": {
      "orderId": "uuid",
      "userId": "uuid"
    },
    "retryable": false
  }
}

// Order Cannot Be Modified
{
  "success": false,
  "error": {
    "code": "ORDER_CANNOT_BE_MODIFIED",
    "message": "Order cannot be modified in current state",
    "details": {
      "orderId": "uuid",
      "currentStatus": "COMPLETED",
      "allowedStates": ["PENDING", "ACTIVE"]
    },
    "retryable": false
  }
}
```

#### Portfolio Management
```typescript
// Portfolio Sync Failed
{
  "success": false,
  "error": {
    "code": "PORTFOLIO_SYNC_FAILED",
    "message": "Failed to sync portfolio data",
    "details": {
      "failedChains": ["ethereum", "polygon"],
      "successfulChains": ["base"],
      "alchemyError": "Rate limit exceeded"
    },
    "retryable": true,
    "retryAfter": 60
  }
}

// Insufficient Portfolio Data
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PORTFOLIO_DATA",
    "message": "Not enough data to calculate P&L",
    "details": {
      "minimumTrades": 1,
      "currentTrades": 0,
      "dataAge": "5 days"
    },
    "retryable": false
  }
}
```

### Auth Service Errors

#### Authentication
```typescript
// Invalid Privy Token
{
  "success": false,
  "error": {
    "code": "INVALID_PRIVY_TOKEN",
    "message": "Privy token is invalid or expired",
    "details": {
      "tokenExpired": true,
      "expiredAt": "2025-01-16T09:30:00.000Z"
    },
    "retryable": false
  }
}

// JWT Token Expired
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "JWT token has expired",
    "details": {
      "expiredAt": "2025-01-16T09:30:00.000Z",
      "expiredFor": 3600,
      "refreshTokenAvailable": true
    },
    "retryable": true
  }
}

// User Not Found
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User account not found",
    "details": {
      "privyId": "did:privy:...",
      "canRegister": true
    },
    "retryable": false
  }
}
```

### Aggregator Service Errors

#### Quote Aggregation
```typescript
// Insufficient Liquidity
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_LIQUIDITY",
    "message": "Insufficient liquidity for requested swap amount",
    "details": {
      "fromToken": "USDbC",
      "toToken": "USDC",
      "requestedAmount": "10000000000000000000000",
      "maxAvailable": "5000000000000000000000",
      "suggestedAmount": "5000000000000000000000"
    },
    "retryable": false
  }
}

// All Aggregators Unavailable
{
  "success": false,
  "error": {
    "code": "ALL_AGGREGATORS_UNAVAILABLE",
    "message": "All aggregators are currently unavailable",
    "details": {
      "circuitStates": {
        "lifi": "open",
        "oneinch": "open",
        "relay": "open"
      },
      "estimatedRecovery": "2025-01-16T10:35:00.000Z"
    },
    "retryable": true,
    "retryAfter": 300
  }
}

// Unsupported Route
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_ROUTE",
    "message": "No route found for requested token pair",
    "details": {
      "fromChainId": 8453,
      "toChainId": 137,
      "fromToken": "0x...",
      "toToken": "0x...",
      "availableAggregators": ["lifi"],
      "supportedRoutes": [
        { "fromChainId": 8453, "toChainId": 8453 },
        { "fromChainId": 8453, "toChainId": 1 }
      ]
    },
    "retryable": false
  }
}
```

## 🔄 Retry Strategies

### Automatic Retry Logic
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;      // milliseconds
  maxDelay: number;       // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
}

const retryConfigs = {
  "portfolio": {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      "PORTFOLIO_SYNC_FAILED",
      "ALCHEMY_RATE_LIMIT",
      "NETWORK_ERROR"
    ]
  },
  "aggregator": {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: [
      "SERVICE_TIMEOUT",
      "AGGREGATOR_ERROR",
      "CIRCUIT_BREAKER_OPEN"
    ]
  },
  "auth": {
    maxAttempts: 1,        // No retry for auth errors
    retryableErrors: []
  }
};
```

### Client-Side Retry Implementation
```typescript
async function apiRequest(url: string, options: RequestInit, retryConfig: RetryConfig) {
  let lastError: any;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        const error = data.error;
        
        // Check if error is retryable
        if (!error.retryable || !retryConfig.retryableErrors.includes(error.code)) {
          throw new ApiError(error);
        }
        
        if (attempt === retryConfig.maxAttempts) {
          throw new ApiError(error);
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );
        
        // Use retryAfter if provided by server
        const waitTime = error.retryAfter ? error.retryAfter * 1000 : delay;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return data;
    } catch (error) {
      lastError = error;
      if (attempt === retryConfig.maxAttempts) {
        throw error;
      }
    }
  }
}
```

## 🔒 Security Error Handling

### Authentication Errors
```typescript
// Rate Limit for Auth Endpoints
{
  "success": false,
  "error": {
    "code": "AUTH_RATE_LIMIT_EXCEEDED",
    "message": "Too many authentication attempts",
    "details": {
      "limit": 10,
      "window": "15 minutes",
      "remainingTime": 847
    },
    "retryable": true,
    "retryAfter": 847
  }
}

// Suspicious Activity Detected
{
  "success": false,
  "error": {
    "code": "SUSPICIOUS_ACTIVITY_DETECTED",
    "message": "Account temporarily locked due to suspicious activity",
    "details": {
      "lockDuration": "1 hour",
      "reason": "multiple_failed_attempts",
      "unlockAt": "2025-01-16T11:30:00.000Z"
    },
    "retryable": false
  }
}
```

### Security Best Practices
- **No Sensitive Data**: Never include sensitive information in error messages
- **Generic Messages**: Use generic messages for security-related errors
- **Rate Limiting**: Implement progressive delays for repeated failures
- **Audit Logging**: Log all security-related errors for monitoring

## 🔧 Validation Error Handling

### Field-Level Validation
```typescript
// Single Field Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email",
    "details": {
      "expectedFormat": "email",
      "providedValue": "invalid-email"
    },
    "retryable": false
  }
}

// Multiple Field Errors
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Multiple validation errors",
    "details": {
      "errors": [
        {
          "field": "fromAmount",
          "code": "AMOUNT_TOO_SMALL",
          "message": "Amount must be greater than 0.001 ETH"
        },
        {
          "field": "toToken",
          "code": "INVALID_TOKEN_ADDRESS",
          "message": "Invalid Ethereum address format"
        }
      ]
    },
    "retryable": false
  }
}
```

### Business Logic Validation
```typescript
// Order Size Limits
{
  "success": false,
  "error": {
    "code": "ORDER_SIZE_EXCEEDED",
    "message": "Order size exceeds maximum allowed limit",
    "details": {
      "requestedAmount": "10000",
      "maxAllowed": "5000",
      "userTier": "basic",
      "upgradeRequired": true
    },
    "retryable": false
  }
}

// Insufficient Balance
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient token balance for order",
    "details": {
      "requiredAmount": "1000000000000000000",
      "availableBalance": "500000000000000000",
      "token": "USDC",
      "chainId": 8453
    },
    "retryable": false
  }
}
```

## 🔄 Circuit Breaker Error Handling

### Circuit States
```typescript
// Circuit Breaker Open
{
  "success": false,
  "error": {
    "code": "CIRCUIT_BREAKER_OPEN",
    "message": "Service temporarily unavailable due to high failure rate",
    "details": {
      "service": "lifi",
      "failureRate": "78%",
      "circuitState": "open",
      "retryAt": "2025-01-16T10:35:00.000Z"
    },
    "retryable": true,
    "retryAfter": 300
  }
}

// Degraded Service
{
  "success": false,
  "error": {
    "code": "SERVICE_DEGRADED",
    "message": "Service is experiencing degraded performance",
    "details": {
      "service": "relay",
      "averageResponseTime": "1200ms",
      "normalResponseTime": "400ms",
      "fallbackUsed": true
    },
    "retryable": true,
    "retryAfter": 30
  }
}
```

## 📊 Error Monitoring & Logging

### Error Categories for Monitoring
```typescript
interface ErrorMetrics {
  category: 'client' | 'server' | 'external' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  errorCode: string;
  count: number;
  lastOccurrence: string;
}

const errorCategories = {
  client: {
    description: "4xx errors, user input problems",
    examples: ["VALIDATION_ERROR", "INSUFFICIENT_BALANCE"],
    alertThreshold: 100  // errors per hour
  },
  server: {
    description: "5xx errors, internal service problems",
    examples: ["INTERNAL_ERROR", "DATABASE_CONNECTION_FAILED"],
    alertThreshold: 10   // errors per hour
  },
  external: {
    description: "External service failures",
    examples: ["ALCHEMY_API_ERROR", "AGGREGATOR_TIMEOUT"],
    alertThreshold: 50   // errors per hour
  },
  security: {
    description: "Security-related errors",
    examples: ["INVALID_TOKEN", "SUSPICIOUS_ACTIVITY"],
    alertThreshold: 5    // errors per hour
  }
};
```

### Error Logging Format
```typescript
{
  "timestamp": "2025-01-16T10:30:00.000Z",
  "level": "error",
  "service": "core-service",
  "requestId": "uuid",
  "userId": "uuid",
  "error": {
    "code": "PORTFOLIO_SYNC_FAILED",
    "message": "Failed to sync portfolio data",
    "stack": "Error stack trace...",
    "context": {
      "userId": "uuid",
      "chainId": 1,
      "endpoint": "/api/v1/portfolio/sync"
    }
  },
  "request": {
    "method": "POST",
    "url": "/api/v1/portfolio/sync",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  },
  "response": {
    "statusCode": 502,
    "responseTime": 5000
  }
}
```

## 🎯 Frontend Error Handling

### Error Display Components
```typescript
// Toast Notifications for Different Error Types
const ErrorToast = ({ error }: { error: ApiError }) => {
  const getToastConfig = (errorCode: string) => {
    switch (errorCode) {
      case 'TOKEN_EXPIRED':
        return {
          type: 'warning',
          title: 'Session Expired',
          message: 'Please log in again to continue',
          action: { label: 'Login', onClick: () => redirectToLogin() }
        };
      
      case 'INSUFFICIENT_LIQUIDITY':
        return {
          type: 'error',
          title: 'Insufficient Liquidity',
          message: 'Try a smaller amount or different token pair',
          action: { label: 'Retry', onClick: () => retryRequest() }
        };
      
      case 'NETWORK_ERROR':
        return {
          type: 'error',
          title: 'Network Error',
          message: 'Please check your connection and try again',
          action: { label: 'Retry', onClick: () => retryRequest() }
        };
        
      default:
        return {
          type: 'error',
          title: 'Something went wrong',
          message: error.message,
          action: error.retryable ? { label: 'Retry', onClick: () => retryRequest() } : undefined
        };
    }
  };
  
  return <Toast {...getToastConfig(error.code)} />;
};
```

### Error Boundary Implementation
```typescript
class ApiErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    logError(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

## 📱 Mobile Error Handling

### Mobile-Specific Error Messages
```typescript
const mobileErrorMessages = {
  NETWORK_ERROR: {
    title: "Connection Issue",
    message: "Check your internet connection",
    suggestion: "Switch to WiFi or try again later"
  },
  WALLET_CONNECTION_FAILED: {
    title: "Wallet Connection Failed",
    message: "Cannot connect to your wallet",
    suggestion: "Make sure your wallet app is open"
  },
  TRANSACTION_FAILED: {
    title: "Transaction Failed",
    message: "Your transaction could not be completed",
    suggestion: "Check transaction details and try again"
  }
};
```

---

**Comprehensive error handling ensures robust user experience and efficient debugging across the MoonXFarm DEX platform.** 