// WebSocket Gateway Configuration
// 
// This demonstrates the Generic Schema pattern:
// - Extends predefined schemas from @moonx-farm/configs
// - Adds custom WebSocket-specific configuration
// - Alternative: Could use profile pattern with createConfig('websocket-gateway')

import { z } from 'zod';
import { 
  createConfig, 
  BaseConfigSchema, 
  RedisConfigSchema, 
  LoggerConfigSchema,
  ServicesConfigSchema
} from '@moonx-farm/configs';
import { ALL_KAFKA_TOPICS } from './types';

// WebSocket Gateway custom schema - extends base schemas with WebSocket-specific config
const WebSocketGatewayConfigSchema = BaseConfigSchema
  .merge(RedisConfigSchema)
  .merge(LoggerConfigSchema)
  .merge(ServicesConfigSchema.pick({ 
    WEBSOCKET_GATEWAY_PORT: true, 
    WEBSOCKET_GATEWAY_HOST: true, 
    AUTH_SERVICE_URL: true 
  }))
  .merge(z.object({
    // Connection settings
    MAX_CONNECTIONS: z.coerce.number().default(10000),
    CONNECTION_TIMEOUT: z.coerce.number().default(30000),
    
    // Performance settings
    ENABLE_COMPRESSION: z.coerce.boolean().default(false),
    ENABLE_HEARTBEAT: z.coerce.boolean().default(true),
    HEARTBEAT_INTERVAL: z.coerce.number().default(25000),
    HEARTBEAT_TIMEOUT: z.coerce.number().default(5000),
    
    // Socket.IO settings
    PING_TIMEOUT: z.coerce.number().default(60000),
    PING_INTERVAL: z.coerce.number().default(25000),
    MAX_HTTP_BUFFER_SIZE: z.coerce.number().default(1000000),
    MAX_DISCONNECTION_DURATION: z.coerce.number().default(180000),
    TRANSPORTS: z.string().default('websocket,polling'),
    
    // CORS settings
    CORS_ORIGINS: z.string().default('*'),
    CORS_METHODS: z.string().default('GET,POST'),
    CORS_CREDENTIALS: z.coerce.boolean().default(true),
    
    // Kafka settings for event streaming
    KAFKA_BROKERS: z.string().default('localhost:9092'),
    KAFKA_CLIENT_ID: z.string().default('websocket-gateway'),
    KAFKA_GROUP_ID: z.string().default('websocket-gateway-group'),
    KAFKA_TOPICS: z.string().default(ALL_KAFKA_TOPICS.join(',')),
    KAFKA_SESSION_TIMEOUT: z.coerce.number().default(10000),
    KAFKA_HEARTBEAT_INTERVAL: z.coerce.number().default(3000),
    KAFKA_MAX_BYTES_PER_PARTITION: z.coerce.number().default(1048576), // 1MB
  }));

export type WebSocketGatewayConfig = z.infer<typeof WebSocketGatewayConfigSchema>;

// Type for config manager instance
export type WebSocketGatewayConfigManager = {
  get<K extends keyof WebSocketGatewayConfig>(key: K): WebSocketGatewayConfig[K];
  getAll(): WebSocketGatewayConfig;
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;
  reload(schema: typeof WebSocketGatewayConfigSchema): void;
};

// Create config instance với custom schema (tránh duplicate với configs package)
export const createWebSocketConfig = (): WebSocketGatewayConfigManager => {
  return createConfig(WebSocketGatewayConfigSchema);
}; 