# MoonX Farm WebSocket Service - Development Guide

## Tổng quan

Hướng dẫn này dành cho developers cần mở rộng WebSocket service với các message types mới, handlers mới, và tích hợp mới. Document này bao gồm best practices, code examples, và step-by-step instructions.

## Cấu trúc dự án

```
services/websocket-service/
├── src/
│   ├── config/
│   │   └── index.ts              # Service configuration
│   ├── handlers/
│   │   └── messageHandlers.ts    # Message routing và handlers
│   ├── middleware/
│   │   ├── authMiddleware.ts     # Authentication middleware
│   │   └── rateLimitMiddleware.ts # Rate limiting
│   ├── services/
│   │   ├── connectionManager.ts  # Connection management
│   │   └── kafkaConsumer.ts     # Kafka integration
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── server.ts                # Main server setup
│   └── index.ts                 # Entry point
├── tests/                       # Test files
├── docs/                        # Documentation
└── package.json
```

## Cách thêm Message Type mới

### 1. Update Type Definitions

Thêm message type mới vào `src/types/index.ts`:

```typescript
// Thêm vào MessageType union
export type MessageType = 
  | 'price_update'
  | 'order_update'
  | 'portfolio_update'
  | 'trade_update'
  | 'authenticate'      // Client authentication
  | 'auth_required'     // Server requests auth
  | 'auth_success'      // Auth successful
  | 'auth_failed'       // Auth failed
  | 'subscribe'         // Subscribe to channel
  | 'subscribed'        // Subscription confirmed
  | 'unsubscribe'       // Unsubscribe from channel
  | 'unsubscribed'      // Unsubscription confirmed
  | 'ping'              // Client heartbeat
  | 'pong'              // Server heartbeat response
  | 'error'             // Error message
  | 'notification'      // 🆕 Message type mới
  | 'user_action';      // 🆕 Message type mới

// Thêm interface cho message data
export interface NotificationMessage {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionUrl?: string;
  userId?: string;
  timestamp: number;
}

export interface UserActionMessage {
  action: 'like' | 'comment' | 'share' | 'follow';
  targetId: string;
  targetType: 'post' | 'user' | 'token';
  userId: string;
  metadata?: Record<string, any>;
  timestamp: number;
}
```

### 2. Create Message Handler

Thêm handler function trong `src/handlers/messageHandlers.ts`:

```typescript
/**
 * Handle notification messages
 */
export async function handleNotification(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  try {
    const notificationData = message.data as NotificationMessage;
    
    // Validate message data
    if (!notificationData.type || !notificationData.title || !notificationData.message) {
      await sendErrorMessage(context, 'INVALID_NOTIFICATION_DATA', 'Invalid notification format');
      return;
    }
    
    // Process notification based on type
    switch (notificationData.type) {
      case 'info':
        await processInfoNotification(notificationData, context);
        break;
      case 'warning':
        await processWarningNotification(notificationData, context);
        break;
      case 'error':
        await processErrorNotification(notificationData, context);
        break;
      case 'success':
        await processSuccessNotification(notificationData, context);
        break;
      default:
        logger.warn('Unknown notification type', { type: notificationData.type });
    }
    
    // Send confirmation
    await sendSuccessMessage(context, 'NOTIFICATION_RECEIVED', {
      id: message.id,
      processed: true,
      timestamp: Date.now()
    });
    
    logger.info('Notification processed', {
      notificationType: notificationData.type,
      userId: context.client.userId,
      messageId: message.id
    });
    
  } catch (error) {
    logger.error('Failed to handle notification', { error, clientId: context.client.id });
    await sendErrorMessage(context, 'NOTIFICATION_PROCESSING_ERROR', 'Failed to process notification');
  }
}

/**
 * Handle user action messages
 */
export async function handleUserAction(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  try {
    const actionData = message.data as UserActionMessage;
    
    // Validate action data
    if (!actionData.action || !actionData.targetId || !actionData.targetType) {
      await sendErrorMessage(context, 'INVALID_ACTION_DATA', 'Invalid action format');
      return;
    }
    
    // Process action
    const result = await processUserAction(actionData, context);
    
    if (result.success) {
      // Broadcast to relevant subscribers
      await broadcastUserAction(actionData, context);
      
      // Send confirmation
      await sendSuccessMessage(context, 'ACTION_COMPLETED', {
        action: actionData.action,
        targetId: actionData.targetId,
        result: result.data,
        timestamp: Date.now()
      });
    } else {
      await sendErrorMessage(context, 'ACTION_FAILED', result.error || 'Action failed');
    }
    
    logger.info('User action processed', {
      action: actionData.action,
      targetId: actionData.targetId,
      userId: context.client.userId,
      success: result.success
    });
    
  } catch (error) {
    logger.error('Failed to handle user action', { error, clientId: context.client.id });
    await sendErrorMessage(context, 'ACTION_PROCESSING_ERROR', 'Failed to process action');
  }
}

// Helper functions
async function processInfoNotification(data: NotificationMessage, context: WebSocketContext): Promise<void> {
  // Implementation logic
}

async function processWarningNotification(data: NotificationMessage, context: WebSocketContext): Promise<void> {
  // Implementation logic
}

async function processUserAction(data: UserActionMessage, context: WebSocketContext): Promise<{success: boolean, data?: any, error?: string}> {
  // Implementation logic
  return { success: true, data: { processed: true } };
}

async function broadcastUserAction(data: UserActionMessage, context: WebSocketContext): Promise<void> {
  // Broadcast to relevant subscribers
  const broadcastMessage: WebSocketMessage = {
    id: uuidv4(),
    type: 'user_action',
    timestamp: Date.now(),
    data: {
      action: data.action,
      targetId: data.targetId,
      targetType: data.targetType,
      userId: data.userId,
      metadata: data.metadata
    }
  };
  
  // Send to all subscribers of user actions
  await connectionManager.sendToSubscribers('user_actions', broadcastMessage);
}
```

### 3. Register Message Handler

Thêm vào `messageHandlers` registry trong `src/handlers/messageHandlers.ts`:

```typescript
export const messageHandlers: Record<MessageType, MessageHandler> = {
  // ... existing handlers
  notification: handleNotification,
  user_action: handleUserAction
};
```

### 4. Update Subscription Channels (nếu cần)

Thêm subscription channel mới vào `src/types/index.ts`:

```typescript
export type SubscriptionChannel = 
  | 'prices'           // Price updates từ Kafka
  | 'orders'           // Order updates cho user
  | 'portfolio'        // Portfolio updates cho user
  | 'trades'           // Trade updates cho user
  | 'user_specific'    // User-specific messages
  | 'notifications'    // 🆕 Channel mới
  | 'user_actions';    // 🆕 Channel mới
```

## Cách tích hợp với Kafka

### 1. Thêm Kafka Topic mới

Thêm topic config vào `src/config/index.ts`:

```typescript
const WebSocketServiceSchema = BaseConfigSchema
  .merge(/* ... existing schemas */)
  .extend({
    // ... existing config
    
    // Kafka topics (existing)
    KAFKA_TOPIC_PRICES: z.string().default('price.updates'),
    KAFKA_TOPIC_ORDERS: z.string().default('order.updates'),
    KAFKA_TOPIC_PORTFOLIO: z.string().default('portfolio.updates'),
    KAFKA_TOPIC_TRADES: z.string().default('trade.updates'),
    
    // New Kafka topics
    KAFKA_TOPIC_NOTIFICATIONS: z.string().default('notification.updates'),
    KAFKA_TOPIC_USER_ACTIONS: z.string().default('user-action.updates'),
  });

export const websocketConfig = {
  // ... existing config
  kafka: {
    brokers: config.get('KAFKA_BROKERS'),
    clientId: config.get('KAFKA_CLIENT_ID'),
    consumerGroup: config.get('KAFKA_CONSUMER_GROUP_ID'),
    topics: {
      prices: config.get('KAFKA_TOPIC_PRICES'),
      orders: config.get('KAFKA_TOPIC_ORDERS'),
      portfolio: config.get('KAFKA_TOPIC_PORTFOLIO'),
      trades: config.get('KAFKA_TOPIC_TRADES'),
      notifications: config.get('KAFKA_TOPIC_NOTIFICATIONS'),  // 🆕
      userActions: config.get('KAFKA_TOPIC_USER_ACTIONS'),     // 🆕
    },
  },
};
```

### 2. Thêm Kafka Consumer Handler

Thêm handler trong `src/services/kafkaConsumer.ts`:

```typescript
/**
 * Main message handler for all topics
 */
private async messageHandler(topic: string, message: any, rawMessage: any): Promise<void> {
  try {
    // ... existing topic handlers
    
    switch (topic) {
      // ... existing cases
      case this.topics.notifications:
        await this.handleNotificationUpdate(message as NotificationMessage);
        break;
      case this.topics.userActions:
        await this.handleUserActionUpdate(message as UserActionMessage);
        break;
      default:
        logger.warn('Unknown topic received', { topic });
    }
    
  } catch (error) {
    logger.error('Failed to handle Kafka message', { error, topic });
  }
}

/**
 * Handle notification updates from Kafka
 */
private async handleNotificationUpdate(data: NotificationMessage): Promise<void> {
  try {
    const message: WebSocketMessage = {
      id: `notification_${data.userId || 'system'}_${Date.now()}`,
      type: 'notification',
      timestamp: Date.now(),
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl,
        timestamp: data.timestamp
      }
    };

    // Send to specific user if userId is provided
    if (data.userId) {
      await connectionManager.sendToUser(data.userId, message);
    } else {
      // Broadcast to all subscribers of notifications channel
      await connectionManager.sendToSubscribers('notifications', message);
    }
    
    logger.debug('Notification update sent', {
      type: data.type,
      userId: data.userId,
      title: data.title
    });
    
  } catch (error) {
    logger.error('Failed to handle notification update', { error, data });
  }
}

/**
 * Handle user action updates from Kafka
 */
private async handleUserActionUpdate(data: UserActionMessage): Promise<void> {
  try {
    const message: WebSocketMessage = {
      id: `user_action_${data.userId}_${Date.now()}`,
      type: 'user_action',
      timestamp: Date.now(),
      data: {
        action: data.action,
        targetId: data.targetId,
        targetType: data.targetType,
        userId: data.userId,
        metadata: data.metadata,
        timestamp: data.timestamp
      }
    };

    // Send to users who might be interested in this action
    await connectionManager.sendToSubscribers('user_actions', message);
    
    logger.debug('User action update sent', {
      action: data.action,
      targetId: data.targetId,
      userId: data.userId
    });
    
  } catch (error) {
    logger.error('Failed to handle user action update', { error, data });
  }
}
```

## Cách thêm Middleware mới

### 1. Tạo Middleware file

Tạo file `src/middleware/customMiddleware.ts`:

```typescript
import { FastifyRequest } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { WebSocketClient, WebSocketContext } from '../types';

const logger = createLogger('custom-middleware');

export interface CustomMiddlewareOptions {
  enabled: boolean;
  timeout: number;
  retries: number;
}

export class CustomMiddleware {
  private readonly options: CustomMiddlewareOptions;
  
  constructor(options: CustomMiddlewareOptions) {
    this.options = options;
  }
  
  /**
   * Middleware for incoming WebSocket connections
   */
  async onConnection(request: FastifyRequest): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.options.enabled) {
      return { allowed: true };
    }
    
    try {
      // Custom logic for connection validation
      const isValid = await this.validateConnection(request);
      
      if (!isValid) {
        return { allowed: false, reason: 'Custom validation failed' };
      }
      
      return { allowed: true };
      
    } catch (error) {
      logger.error('Custom middleware error', { error });
      return { allowed: false, reason: 'Middleware error' };
    }
  }
  
  /**
   * Middleware for incoming messages
   */
  async onMessage(message: any, context: WebSocketContext): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.options.enabled) {
      return { allowed: true };
    }
    
    try {
      // Custom logic for message validation
      const isValid = await this.validateMessage(message, context);
      
      if (!isValid) {
        return { allowed: false, reason: 'Message validation failed' };
      }
      
      return { allowed: true };
      
    } catch (error) {
      logger.error('Message middleware error', { error });
      return { allowed: false, reason: 'Message middleware error' };
    }
  }
  
  private async validateConnection(request: FastifyRequest): Promise<boolean> {
    // Implementation logic
    return true;
  }
  
  private async validateMessage(message: any, context: WebSocketContext): Promise<boolean> {
    // Implementation logic
    return true;
  }
}

// Export middleware instance
export const customMiddleware = new CustomMiddleware({
  enabled: true,
  timeout: 5000,
  retries: 3
});
```

### 2. Tích hợp Middleware vào Server

Thêm middleware vào `src/server.ts`:

```typescript
import { customMiddleware } from './middleware/customMiddleware';

// Trong handleWebSocketConnection method
private async handleWebSocketConnection(connection: any, request: any): Promise<void> {
  try {
    // Apply rate limiting middleware
    await connectionRateLimitMiddleware(request);
    
    // Add custom middleware
    const customCheck = await customMiddleware.onConnection(request);
    if (!customCheck.allowed) {
      connection.socket.close(1008, customCheck.reason || 'Custom validation failed');
      return;
    }
    
    // Register client (without authentication yet)
    const client = await connectionManager.addClient(connection.socket, request);
    
    // Start authentication process
    const authRequiredMessage = {
      id: uuidv4(),
      type: 'auth_required',
      timestamp: Date.now(),
      data: { timeout: 10000 }
    };
    
    connection.socket.send(JSON.stringify(authRequiredMessage));
    
    // Set authentication timeout
    setTimeout(() => {
      if (!client.authenticated) {
        connection.socket.close(1008, 'Authentication timeout');
      }
    }, 10000);
    
  } catch (error) {
    // Error handling
  }
}

// Trong handleWebSocketMessage method
private async handleWebSocketMessage(data: Buffer, client: WebSocketClient, request: any): Promise<void> {
  try {
    const rawMessage = data.toString();
    const message = JSON.parse(rawMessage);
    
    const context = { client, request };
    
    // Apply message rate limiting
    await messageRateLimitMiddleware(client, message);
    
    // Apply custom message middleware
    const customCheck = await customMiddleware.onMessage(message, context);
    if (!customCheck.allowed) {
      const errorMessage = {
        id: uuidv4(),
        type: 'error',
        timestamp: Date.now(),
        data: {
          code: 'MIDDLEWARE_REJECTED',
          message: customCheck.reason || 'Message rejected by middleware'
        }
      };
      client.socket.send(JSON.stringify(errorMessage));
      return;
    }
    
    // Route message to appropriate handler
    await routeMessage(message, context);
    
  } catch (error) {
    logger.error('Message handling error', { error, clientId: client.id });
    const errorMessage = {
      id: uuidv4(),
      type: 'error',
      timestamp: Date.now(),
      data: {
        code: 'MESSAGE_PROCESSING_ERROR',
        message: 'Failed to process message'
      }
    };
    client.socket.send(JSON.stringify(errorMessage));
  }
}
```

## Cách thêm External Service Integration

### 1. Tạo Service Client

Tạo file `src/services/externalService.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';

const logger = createLogger('external-service');

export interface ExternalServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  apiKey?: string;
}

export interface ExternalServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ExternalService {
  private readonly client: AxiosInstance;
  private readonly config: ExternalServiceConfig;
  
  constructor(config: ExternalServiceConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('External service request', {
          url: config.url,
          method: config.method
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );
    
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('External service response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Response interceptor error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }
  
  async getData(endpoint: string, params?: any): Promise<ExternalServiceResponse> {
    try {
      const response = await this.client.get(endpoint, { params });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to get data from external service', { error, endpoint });
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async postData(endpoint: string, data: any): Promise<ExternalServiceResponse> {
    try {
      const response = await this.client.post(endpoint, data);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to post data to external service', { error, endpoint });
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('External service health check failed', { error });
      return false;
    }
  }
}

// Export service instance
export const externalService = new ExternalService({
  baseUrl: process.env.EXTERNAL_SERVICE_URL || 'http://localhost:3010',
  timeout: 5000,
  retries: 3,
  apiKey: process.env.EXTERNAL_SERVICE_API_KEY
});
```

### 2. Tích hợp vào Message Handlers

Sử dụng external service trong message handlers:

```typescript
// Trong handleNotification function
export async function handleNotification(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  try {
    const notificationData = message.data as NotificationMessage;
    
    // Call external service to enrich notification data
    const enrichedData = await externalService.getData('/notifications/enrich', {
      userId: context.client.userId,
      type: notificationData.type
    });
    
    if (enrichedData.success) {
      // Use enriched data
      notificationData.metadata = enrichedData.data;
    }
    
    // Continue with processing...
    
  } catch (error) {
    logger.error('Failed to handle notification', { error });
  }
}
```

## Testing

### 1. Unit Tests

Tạo file `tests/handlers/messageHandlers.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { handleNotification, handleUserAction } from '../../src/handlers/messageHandlers';
import { WebSocketMessage, WebSocketContext } from '../../src/types';

describe('Message Handlers', () => {
  let mockContext: WebSocketContext;
  
  beforeEach(() => {
    mockContext = {
      client: {
        id: 'test-client-id',
        userId: 'test-user-id',
        socket: {
          send: jest.fn(),
          readyState: 1
        }
      },
      request: {}
    } as any;
  });
  
  describe('handleNotification', () => {
    it('should process valid notification message', async () => {
      const message: WebSocketMessage = {
        id: 'test-message-id',
        type: 'notification',
        timestamp: Date.now(),
        data: {
          type: 'info',
          title: 'Test Notification',
          message: 'This is a test notification',
          userId: 'test-user-id'
        }
      };
      
      await expect(handleNotification(message, mockContext)).resolves.not.toThrow();
      expect(mockContext.client.socket.send).toHaveBeenCalled();
    });
    
    it('should handle invalid notification data', async () => {
      const message: WebSocketMessage = {
        id: 'test-message-id',
        type: 'notification',
        timestamp: Date.now(),
        data: {} // Invalid data
      };
      
      await handleNotification(message, mockContext);
      
      const sentMessage = JSON.parse(mockContext.client.socket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.data.code).toBe('INVALID_NOTIFICATION_DATA');
    });
  });
  
  describe('handleUserAction', () => {
    it('should process valid user action', async () => {
      const message: WebSocketMessage = {
        id: 'test-message-id',
        type: 'user_action',
        timestamp: Date.now(),
        data: {
          action: 'like',
          targetId: 'post-123',
          targetType: 'post',
          userId: 'test-user-id'
        }
      };
      
      await expect(handleUserAction(message, mockContext)).resolves.not.toThrow();
    });
  });
});
```

### 2. Integration Tests

Tạo file `tests/integration/websocket.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import WebSocket from 'ws';
import { server } from '../../src/server';

describe('WebSocket Integration', () => {
  let ws: WebSocket;
  
  beforeAll(async () => {
    await server.start();
  });
  
  afterAll(async () => {
    await server.shutdown();
  });
  
  beforeEach(() => {
    ws = new WebSocket('ws://localhost:3008/ws', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
  });
  
  it('should handle notification message', (done) => {
    ws.on('open', () => {
      const message = {
        id: 'test-id',
        type: 'notification',
        timestamp: Date.now(),
        data: {
          type: 'info',
          title: 'Test',
          message: 'Test message'
        }
      };
      
      ws.send(JSON.stringify(message));
    });
    
    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      expect(response.type).toBe('notification_received');
      done();
    });
  });
});
```

## Debugging và Monitoring

### 1. Thêm Logging

Sử dụng structured logging:

```typescript
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('your-module', {
  level: 'debug',
  additionalFields: {
    service: 'websocket-service',
    version: '1.0.0'
  }
});

// Usage
logger.info('Processing message', {
  messageId: message.id,
  messageType: message.type,
  userId: context.client.userId,
  timestamp: Date.now()
});
```

### 2. Metrics Collection

Thêm metrics cho message types mới:

```typescript
// Trong message handler
export async function handleNotification(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Process message
    
    // Record success metrics
    metrics.increment('notification.processed', {
      type: message.data.type,
      userId: context.client.userId
    });
    
    metrics.timing('notification.processing_time', Date.now() - startTime);
    
  } catch (error) {
    // Record error metrics
    metrics.increment('notification.error', {
      error: error.message,
      type: message.data.type
    });
    
    throw error;
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
// Always wrap message handlers in try-catch
export async function handleCustomMessage(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  try {
    // Validate input
    if (!message.data || !message.data.requiredField) {
      await sendErrorMessage(context, 'INVALID_INPUT', 'Required field missing');
      return;
    }
    
    // Process message
    const result = await processMessage(message.data);
    
    // Send response
    await sendSuccessMessage(context, 'MESSAGE_PROCESSED', result);
    
  } catch (error) {
    logger.error('Message handler error', { 
      error, 
      messageType: message.type,
      clientId: context.client.id 
    });
    
    await sendErrorMessage(context, 'PROCESSING_ERROR', 'Failed to process message');
  }
}
```

### 2. Performance Optimization

```typescript
// Use batching for multiple operations
export async function handleBatchMessages(messages: WebSocketMessage[], context: WebSocketContext): Promise<void> {
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    await Promise.all(batch.map(msg => handleMessage(msg, context)));
  }
}
```

### 3. Security

```typescript
// Validate message source and permissions
export async function handleSensitiveMessage(message: WebSocketMessage, context: WebSocketContext): Promise<void> {
  // Check user permissions
  const hasPermission = await checkUserPermission(context.client.userId, 'sensitive_action');
  if (!hasPermission) {
    await sendErrorMessage(context, 'PERMISSION_DENIED', 'Insufficient permissions');
    return;
  }
  
  // Sanitize input
  const sanitizedData = sanitizeInput(message.data);
  
  // Process with sanitized data
  await processMessage(sanitizedData);
}
```

## Deployment

### 1. Docker Configuration

Thêm dependencies mới vào `Dockerfile`:

```dockerfile
# Install additional dependencies
RUN npm install new-dependency

# Copy new files
COPY src/services/externalService.ts /app/src/services/
COPY src/middleware/customMiddleware.ts /app/src/middleware/
```

### 2. Environment Variables

Thêm vào `.env`:

```env
# New service integration
EXTERNAL_SERVICE_URL=http://external-service:3010
EXTERNAL_SERVICE_API_KEY=your-api-key
EXTERNAL_SERVICE_TIMEOUT=5000

# New Kafka topics
KAFKA_TOPIC_NOTIFICATIONS=notification.updates
KAFKA_TOPIC_USER_ACTIONS=user-action.updates

# Custom middleware
CUSTOM_MIDDLEWARE_ENABLED=true
CUSTOM_MIDDLEWARE_TIMEOUT=5000
```

### 3. Monitoring

Thêm health checks cho services mới:

```typescript
// Trong performHealthCheck method
private async performHealthCheck(): Promise<HealthCheckResult> {
  const services = {
    redis: false,
    kafka: false,
    auth: false,
    external: false // 🆕 New service
  };
  
  try {
    // Existing health checks...
    
    // Check external service
    try {
      services.external = await externalService.healthCheck();
    } catch (error) {
      logger.error('External service health check failed', { error });
    }
    
    // Return health status
    const allHealthy = Object.values(services).every(status => status);
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      services,
      metrics: connectionManager.getMetrics()
    };
  } catch (error) {
    // Error handling
  }
}
```

## Troubleshooting

### Common Issues

1. **Message handler not found**: Kiểm tra xem message type đã được thêm vào `messageHandlers` registry chưa
2. **TypeScript compilation errors**: Đảm bảo tất cả types đã được export từ `src/types/index.ts`
3. **Kafka consumer not receiving messages**: Verify topic configuration và broker connectivity
4. **Rate limiting issues**: Kiểm tra rate limit config cho message types mới
5. **Authentication failures**: Verify middleware integration order

### Debug Commands

```bash
# Check message handler registration
curl -s http://localhost:3008/debug/handlers | jq

# Check active subscriptions
curl -s http://localhost:3008/debug/subscriptions | jq

# Check Kafka consumer status
curl -s http://localhost:3008/debug/kafka | jq
```

## Conclusion

Khi thêm tính năng mới vào WebSocket service, hãy luôn:

1. **Update types** trước khi viết code
2. **Test thoroughly** với unit và integration tests
3. **Add proper logging** để dễ debug
4. **Document API changes** cho client developers
5. **Monitor performance** sau khi deploy
6. **Follow security best practices** cho sensitive operations

Tham khảo code examples trong repository để biết thêm chi tiết cách implement. 