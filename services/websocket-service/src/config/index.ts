import { createConfig, BaseConfigSchema, RedisConfigSchema, KafkaConfigSchema, LoggerConfigSchema } from '@moonx-farm/configs';
import { z } from 'zod';

// Tạo schema cho WebSocket service theo pattern khuyên dùng
const WebSocketServiceSchema = BaseConfigSchema
  .merge(RedisConfigSchema)
  .merge(KafkaConfigSchema)
  .merge(LoggerConfigSchema)
  .extend({
    // Server configuration
    PORT: z.coerce.number().default(3008),
    HOST: z.string().default('0.0.0.0'),
    
    // Auth service integration
    AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),
    AUTH_SERVICE_VERIFY_ENDPOINT: z.string().default('/api/v1/auth/verify'),
    AUTH_SERVICE_TIMEOUT: z.coerce.number().default(5000),
    
    // Rate limiting (DISABLED for maximum performance)
    RATE_LIMIT_ENABLED: z.string().transform((val: string) => val === 'true').default('false'),
    RATE_LIMIT_MAX_CONNECTIONS_PER_IP: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW_SIZE: z.coerce.number().default(60000),
    RATE_LIMIT_MAX_MESSAGES_PER_MINUTE: z.coerce.number().default(120),
    
    // WebSocket configuration (OPTIMIZED for maximum performance)
    WS_PING_INTERVAL: z.coerce.number().default(30000),
    WS_PONG_TIMEOUT: z.coerce.number().default(5000),
    WS_MAX_CONNECTIONS: z.coerce.number().default(100000), // ✅ Increased from 10K to 100K
    WS_HEARTBEAT_INTERVAL: z.coerce.number().default(60000),
    
    // Kafka configuration - Single topic approach
    KAFKA_CONSUMER_GROUP_ID: z.string().default('websocket-consumers'),
    KAFKA_MAIN_TOPIC: z.string().default('moonx.ws.events'),
    
    // Legacy topics removed - using single topic pattern
    
    // Event processing configuration
    EVENT_PROCESSING_ENABLED: z.string().transform((val: string) => val === 'true').default('true'),
    EVENT_VALIDATION_ENABLED: z.string().transform((val: string) => val === 'true').default('false'),
    EVENT_DEAD_LETTER_QUEUE_ENABLED: z.string().transform((val: string) => val === 'true').default('true'),
    EVENT_DEAD_LETTER_QUEUE_TOPIC: z.string().default('moonx.ws.events.dlq'),
    EVENT_RETRY_ATTEMPTS: z.coerce.number().default(3),
    EVENT_RETRY_DELAY: z.coerce.number().default(1000),
    
    // CORS configuration
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    CORS_CREDENTIALS: z.string().transform((val: string) => val === 'true').default('true'),
    
    // Health check
    HEALTH_CHECK_ENABLED: z.string().transform((val: string) => val === 'true').default('true'),
    HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
    
    // Swagger documentation
    SWAGGER_ENABLED: z.string().transform((val: string) => val === 'true').default('true'),
    SWAGGER_PATH: z.string().default('/docs'),
    
    // Clustering
    CLUSTER_ENABLED: z.string().transform((val: string) => val === 'true').default('false'),
    CLUSTER_WORKERS: z.string().default('auto'),
    
    // Additional missing keys
    REDIS_URL: z.string().default('redis://localhost:6379'),
    REDIS_KEY_PREFIX: z.string().default('moonx:ws:'),
    SERVICE_NAME: z.string().default('websocket-service'),
  });

// Tạo config instance theo pattern khuyên dùng
const config = createConfig(WebSocketServiceSchema);

// Export typed config object
export const websocketConfig = {
  // Server
  port: config.get('PORT'),
  host: config.get('HOST'),
  environment: config.get('NODE_ENV'),
  
  // Auth service
  auth: {
    serviceUrl: config.get('AUTH_SERVICE_URL'),
    verifyEndpoint: config.get('AUTH_SERVICE_VERIFY_ENDPOINT'),
    timeout: config.get('AUTH_SERVICE_TIMEOUT'),
  },
  
  // Rate limiting
  rateLimit: {
    enabled: config.get('RATE_LIMIT_ENABLED'),
    maxConnectionsPerIp: config.get('RATE_LIMIT_MAX_CONNECTIONS_PER_IP'),
    windowSize: config.get('RATE_LIMIT_WINDOW_SIZE'),
    maxMessagesPerMinute: config.get('RATE_LIMIT_MAX_MESSAGES_PER_MINUTE'),
  },
  
  // WebSocket
  websocket: {
    pingInterval: config.get('WS_PING_INTERVAL'),
    pongTimeout: config.get('WS_PONG_TIMEOUT'),
    maxConnections: config.get('WS_MAX_CONNECTIONS'),
    heartbeatInterval: config.get('WS_HEARTBEAT_INTERVAL'),
  },
  
  // Kafka - Single topic approach
  kafka: {
    brokers: config.get('KAFKA_BROKERS'),
    clientId: config.get('KAFKA_CLIENT_ID'),
    consumerGroup: config.get('KAFKA_CONSUMER_GROUP_ID'),
    
    // Main topic for all events
    mainTopic: config.get('KAFKA_MAIN_TOPIC'),
    
    // Event processing
    eventProcessing: {
      enabled: config.get('EVENT_PROCESSING_ENABLED'),
      validationEnabled: config.get('EVENT_VALIDATION_ENABLED'),
      deadLetterQueueEnabled: config.get('EVENT_DEAD_LETTER_QUEUE_ENABLED'),
      deadLetterQueueTopic: config.get('EVENT_DEAD_LETTER_QUEUE_TOPIC'),
      retryAttempts: config.get('EVENT_RETRY_ATTEMPTS'),
      retryDelay: config.get('EVENT_RETRY_DELAY'),
    },
    
    // Legacy topics removed - using single topic pattern
  },
  
  // Redis
  redis: {
    url: config.get('REDIS_URL'),
    keyPrefix: config.get('REDIS_KEY_PREFIX'),
  },
  
  // CORS
  cors: {
    origin: config.get('CORS_ORIGIN'),
    credentials: config.get('CORS_CREDENTIALS'),
  },
  
  // Health check
  healthCheck: {
    enabled: config.get('HEALTH_CHECK_ENABLED'),
    interval: config.get('HEALTH_CHECK_INTERVAL'),
  },
  
  // Swagger
  swagger: {
    enabled: config.get('SWAGGER_ENABLED'),
    path: config.get('SWAGGER_PATH'),
  },
  
  // Clustering
  cluster: {
    enabled: config.get('CLUSTER_ENABLED'),
    workers: config.get('CLUSTER_WORKERS'),
  },
  
  // Logging
  logging: {
    level: config.get('LOG_LEVEL'),
    service: config.get('SERVICE_NAME'),
  },
  
  // Utilities
  isDevelopment: config.isDevelopment(),
  isProduction: config.isProduction(),
  isTest: config.isTest(),
} as const;

// Type exports
export type WebSocketConfig = typeof websocketConfig; 