// High Performance Configuration for WebSocket Gateway
// Rate limiting DISABLED for maximum throughput

export const performanceConfig = {
  // Rate limiting - DISABLED
  rateLimits: {
    enabled: false, // Completely disable rate limiting
    global: {
      windowMs: 60000,
      maxRequests: 999999999, // Unlimited
      skipSuccessfulRequests: true,
      skipFailedRequests: true
    },
    perIP: {
      windowMs: 60000,
      maxRequests: 999999999, // Unlimited
      skipSuccessfulRequests: true,
      skipFailedRequests: true
    },
    perUser: {
      windowMs: 60000,
      maxRequests: 999999999, // Unlimited
      skipSuccessfulRequests: true,
      skipFailedRequests: true
    },
    perEndpoint: {
      // All endpoints unlimited
      '/connect': {
        windowMs: 60000,
        maxRequests: 999999999
      },
      '/message': {
        windowMs: 60000,
        maxRequests: 999999999
      }
    }
  },

  // Connection limits - MAXIMIZED
  connections: {
    maxConnectionsPerUser: {
      admin: 10000,     // Unlimited for admin
      vip: 5000,        // Very high for VIP
      user: 1000,       // High for regular users
      default: 500      // High for default
    },
    maxConnectionsPerIP: 50000, // Very high IP limit
    maxGlobalConnections: 1000000, // 1M concurrent connections
    connectionTimeout: 30000,
    heartbeatInterval: 30000,
    maxIdleTime: 300000 // 5 minutes
  },

  // Socket.IO optimizations
  socket: {
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100MB buffer
    allowEIO3: true,
    transports: ['websocket'], // WebSocket only for best performance
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true
    },
    serveClient: false, // Don't serve client files
    allowUpgrades: false, // Disable transport upgrades
    perMessageDeflate: false, // Disable compression for speed
    compression: false
  },

  // Redis optimizations
  redis: {
    keyPrefix: 'wsg:', // Short prefix
    retryDelayOnFailover: 50, // Fast retry
    maxRetriesPerRequest: 1, // Don't retry much
    lazyConnect: true,
    maxMemoryPolicy: 'allkeys-lru',
    pipeline: true, // Use pipeline for batch operations
    enableReadyCheck: false
  },

  // Clustering and load balancing
  cluster: {
    enabled: true,
    maxWorkers: 'auto', // Use all CPU cores
    workerKillTimeout: 2000,
    restartWorkerOnMemoryUsage: 500, // MB
    maxMemoryUsage: 1000 // MB per worker
  },

  // Performance monitoring
  monitoring: {
    enabled: true,
    metricsInterval: 10000, // 10 seconds
    logLevel: 'warn', // Reduce logging overhead
    enableDetailedMetrics: false, // Disable detailed metrics
    enableRequestLogging: false // Disable request logging
  },

  // Security - MINIMAL for performance
  security: {
    enableOriginCheck: false, // Disable for performance
    enableCSRFProtection: false, // Disable for performance
    enableXSSProtection: false, // Disable for performance
    enableRateLimit: false, // Explicitly disable
    enableDDoSProtection: false, // Disable for performance
    enableIPFiltering: false, // Disable for performance
    maxPayloadSize: 1e8, // 100MB
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: true
  },

  // Error handling
  errorHandling: {
    enableDetailedErrors: false, // Disable for performance
    enableErrorReporting: false, // Disable external reporting
    enableCrashRecovery: true,
    maxErrorsPerMinute: 999999999, // Unlimited
    logErrors: false // Disable error logging
  }
};

// Helper function to check if rate limiting is enabled
export function isRateLimitingEnabled(): boolean {
  return performanceConfig.rateLimits.enabled;
}

// Helper function to get connection limit for user role
export function getConnectionLimit(role: string): number {
  const connectionLimits = performanceConfig.connections.maxConnectionsPerUser;
  return connectionLimits[role as keyof typeof connectionLimits] || connectionLimits.default;
}

// Helper function to get optimized socket config
export function getOptimizedSocketConfig() {
  return {
    ...performanceConfig.socket,
    cors: {
      origin: "*", // Allow all origins for maximum performance
      methods: performanceConfig.security.allowedMethods,
      allowedHeaders: performanceConfig.security.allowedHeaders,
      credentials: performanceConfig.security.credentials
    }
  };
}

// Export default config
export default performanceConfig; 