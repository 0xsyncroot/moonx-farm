import Fastify from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { getServerConfig } from '@moonx-farm/configs';
import { DatabaseService } from './services/databaseService';
import { TemplateService } from './services/templateService';
import { NotificationService } from './services/notificationService';
import { PreferencesService } from './services/preferencesService';
import {
  CreateNotificationRequest,
  UpdatePreferencesRequest,
  LinkTelegramRequest,
  CreateNotificationSchema,
  UpdatePreferencesSchema,
  LinkTelegramSchema
} from './types';

const logger = createLogger('notify-service');

// Create Fastify instance
const fastify = Fastify({
  logger: false,
  bodyLimit: 1024 * 1024 * 10 // 10MB
});

// Register plugins
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: false
});

fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute'
});

fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'MoonX Farm Notification Service',
      description: 'Multi-channel notification service for MoonX Farm DEX',
      version: '1.0.0'
    },
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
      { name: 'notifications', description: 'Notification management' },
      { name: 'preferences', description: 'User notification preferences' },
      { name: 'health', description: 'Service health checks' }
    ]
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: error.message || 'Internal Server Error',
    statusCode,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
fastify.get('/health', {
  schema: {
    tags: ['health'],
    description: 'Service health check',
    response: {
      200: {
        type: 'object',
        properties: {
          healthy: { type: 'boolean' },
          services: { type: 'object' },
          timestamp: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  try {
    const healthStatus = await fastify.notificationService.getHealthStatus();
    reply.send(healthStatus);
  } catch (error) {
    reply.status(500).send({
      healthy: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== Notification Routes ====================

// Create notification
fastify.post('/notifications', {
  schema: {
    tags: ['notifications'],
    description: 'Create a new notification',
    body: CreateNotificationSchema,
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          userId: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          notificationType: { type: 'string' },
          priority: { type: 'string' },
          createdAt: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const notification = await fastify.notificationService.createNotification(
    request.body as CreateNotificationRequest
  );
  reply.status(201).send(notification);
});

// Get user notifications
fastify.get('/notifications/user/:userId', {
  schema: {
    tags: ['notifications'],
    description: 'Get notifications for a user',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    },
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 1, default: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        type: { type: 'string' },
        isRead: { type: 'boolean' },
        priority: { type: 'string' },
        fromDate: { type: 'string', format: 'date-time' },
        toDate: { type: 'string', format: 'date-time' }
      }
    }
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const query = request.query as any;
  
  const result = await fastify.notificationService.getUserNotifications(userId, query);
  reply.send(result);
});

// Mark notification as read
fastify.patch('/notifications/:id/read', {
  schema: {
    tags: ['notifications'],
    description: 'Mark notification as read',
    params: {
      type: 'object',
      properties: {
        id: { type: 'number' }
      },
      required: ['id']
    },
    body: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    }
  }
}, async (request, reply) => {
  const { id } = request.params as { id: number };
  const { userId } = request.body as { userId: string };
  
  await fastify.notificationService.markAsRead(id, userId);
  reply.status(204).send();
});

// Delete notification
fastify.delete('/notifications/:id', {
  schema: {
    tags: ['notifications'],
    description: 'Delete a notification',
    params: {
      type: 'object',
      properties: {
        id: { type: 'number' }
      },
      required: ['id']
    },
    body: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    }
  }
}, async (request, reply) => {
  const { id } = request.params as { id: number };
  const { userId } = request.body as { userId: string };
  
  await fastify.notificationService.deleteNotification(id, userId);
  reply.status(204).send();
});

// Send notification manually
fastify.post('/notifications/:id/send', {
  schema: {
    tags: ['notifications'],
    description: 'Send a notification manually',
    params: {
      type: 'object',
      properties: {
        id: { type: 'number' }
      },
      required: ['id']
    },
    body: {
      type: 'object',
      properties: {
        channels: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const { id } = request.params as { id: number };
  const { channels } = request.body as { channels?: string[] };
  
  const result = await fastify.notificationService.sendNotification(id, channels as any);
  reply.send(result);
});

// ==================== Preferences Routes ====================

// Get user preferences
fastify.get('/preferences/:userId', {
  schema: {
    tags: ['preferences'],
    description: 'Get user notification preferences',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    }
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const preferences = await fastify.preferencesService.getUserPreferences(userId);
  reply.send(preferences);
});

// Update user preferences
fastify.patch('/preferences/:userId', {
  schema: {
    tags: ['preferences'],
    description: 'Update user notification preferences',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    },
    body: UpdatePreferencesSchema
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const updates = request.body as UpdatePreferencesRequest;
  
  const preferences = await fastify.preferencesService.updatePreferences(userId, updates);
  reply.send(preferences);
});

// Link Telegram account
fastify.post('/preferences/:userId/telegram/link', {
  schema: {
    tags: ['preferences'],
    description: 'Link Telegram account to user',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    },
    body: LinkTelegramSchema
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const telegramData = request.body as LinkTelegramRequest;
  
  await fastify.preferencesService.linkTelegram(userId, telegramData);
  reply.status(204).send();
});

// Unlink Telegram account
fastify.delete('/preferences/:userId/telegram', {
  schema: {
    tags: ['preferences'],
    description: 'Unlink Telegram account from user',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    }
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  await fastify.preferencesService.unlinkTelegram(userId);
  reply.status(204).send();
});

// Get channel statuses
fastify.get('/preferences/:userId/channels', {
  schema: {
    tags: ['preferences'],
    description: 'Get channel configuration statuses',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId']
    }
  }
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const statuses = await fastify.preferencesService.getChannelStatuses(userId);
  reply.send(statuses);
});

// Enable/disable channel
fastify.patch('/preferences/:userId/channels/:channel', {
  schema: {
    tags: ['preferences'],
    description: 'Enable or disable a notification channel',
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        channel: { type: 'string', enum: ['websocket', 'fcm', 'email', 'telegram'] }
      },
      required: ['userId', 'channel']
    },
    body: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }
      },
      required: ['enabled']
    }
  }
}, async (request, reply) => {
  const { userId, channel } = request.params as { userId: string; channel: string };
  const { enabled } = request.body as { enabled: boolean };
  
  const preferences = enabled 
    ? await fastify.preferencesService.enableChannel(userId, channel)
    : await fastify.preferencesService.disableChannel(userId, channel);
    
  reply.send(preferences);
});

// Startup function
async function start() {
  try {
    // Get server configuration
    const config = getServerConfig('notify-service');
    
    // Initialize services
    const databaseService = new DatabaseService();
    await databaseService.initialize();
    
    const templateService = new TemplateService(databaseService);
    const notificationService = new NotificationService(databaseService, templateService);
    const preferencesService = new PreferencesService(databaseService);
    
    // Register services with Fastify
    fastify.decorate('notificationService', notificationService);
    fastify.decorate('preferencesService', preferencesService);
    fastify.decorate('templateService', templateService);
    
    // Start background jobs
    setInterval(async () => {
      try {
        await notificationService.processQueuedNotifications();
        await notificationService.retryFailedDeliveries();
        await notificationService.cleanupExpiredNotifications();
      } catch (error) {
        logger.error('Background job error', { error });
      }
    }, 60000); // Run every minute
    
    // Start server
    const port = config.port || 3004;
    const host = config.host || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    logger.info('Notification service started', {
      port,
      host,
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    logger.error('Failed to start notification service', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

// Start the service
if (require.main === module) {
  start();
}

export default fastify; 