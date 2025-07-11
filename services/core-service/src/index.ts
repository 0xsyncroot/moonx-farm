import Fastify from 'fastify';
import { createCoreServiceConfig, getServerConfig } from '@moonx-farm/configs';
import { createLogger } from '@moonx-farm/common';
import { DatabaseService } from './services/databaseService';
import { CacheService } from './services/cacheService';
import { AuthMiddleware } from './middleware/authMiddleware';
import { orderRoutes } from './routes/orders';
import { portfolioRoutes } from './routes/portfolio';
import { bitqueryRoutes } from './routes/bitquery';
import { chainRoutes } from './routes/chains';
import { syncRoutes } from './routes/sync';
import { statsRoutes } from './routes/stats';

const logger = createLogger('core-service');

const startServer = async () => {
  // Load configuration from @moonx-farm/configs
  const config = createCoreServiceConfig();
  const serverConfig = getServerConfig('core-service');

  // Initialize Fastify with proper logger configuration
  const fastify = Fastify({
    logger: config.isDevelopment() ? {
      level: config.get('LOG_LEVEL'),
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: config.get('LOG_LEVEL'),
    },
    ajv: {
      customOptions: {
        strict: false
      }
    }
  });

  // Register plugins
  await fastify.register(import('@fastify/cors'), {
    origin: serverConfig.cors.origin,
    credentials: serverConfig.cors.credentials
  });

  await fastify.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false
  });

  await fastify.register(import('@fastify/rate-limit'), {
    max: 1000, // 1000 requests per hour per user
    timeWindow: '1 hour',
    keyGenerator: (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader) {
        // Use user ID from token for rate limiting
        return authHeader;
      }
      // Priority 1: X-Real-IP (set by nginx with $remote_addr - real client IP)
      const xRealIp = request.headers['x-real-ip'];
      if (xRealIp && typeof xRealIp === 'string') {
        return xRealIp.trim();
      }

      // Priority 2: X-Forwarded-For (may contain chain of IPs, take the first one)
      const xForwardedFor = request.headers['x-forwarded-for'];
      if (xForwardedFor) {
        // Handle both string and array cases
        const forwardedIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
        if (typeof forwardedIp === 'string' && forwardedIp.trim()) {
          // Take the first IP in the chain (original client IP)
          const firstIp = forwardedIp.split(',')[0];
          if (firstIp) {
            return firstIp.trim();
          }
        }
      }

      // Priority 3: X-Forwarded (less common but sometimes used)
      const xForwarded = request.headers['x-forwarded'];
      if (xForwarded && typeof xForwarded === 'string') {
        const match = xForwarded.match(/for=([^;,\s]+)/);
        if (match && match[1]) {
          return match[1].replace(/"/g, '').trim();
        }
      }

      // Priority 4: Fastify's parsed IP (fallback)
      return request.ip || 'unknown';
    }
  });

  // Register Swagger for development only
  if (config.isDevelopment()) {
    await fastify.register(import('@fastify/swagger'), {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'MoonXFarm Core Service API',
          description: 'Core platform APIs with portfolio management and analytics (sync delegated to sync worker)',
          version: '1.0.0'
        },
        servers: [
          {
            url: `http://${serverConfig.host}:${serverConfig.port}/api/v1`,
            description: 'Development server'
          }
        ]
      }
    });

    await fastify.register(import('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    });
  }

  // Initialize infrastructure services
  const databaseService = new DatabaseService();
  const cacheService = new CacheService();
  const authMiddleware = new AuthMiddleware();

  // Connect to infrastructure
  await databaseService.connect();
  await cacheService.connect();

  logger.info('Connected to database and cache');

  // Initialize portfolio service for portfolio routes
  const { PortfolioService } = await import('./services/portfolioService');
  const { SyncProxyService } = await import('./services/syncProxyService');
  const portfolioService = new PortfolioService(databaseService, cacheService);
  const syncProxyService = new SyncProxyService(databaseService);

  // Initialize sync proxy service
  await syncProxyService.initialize();

  logger.info('📦 Portfolio service initialized with auto-sync trigger');

  // Health check routes
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await databaseService.healthCheck();
    const cacheHealth = await cacheService.healthCheck();

    const status = dbHealth.connected && cacheHealth ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    return reply.code(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.connected ? 'up' : 'down',
        cache: cacheHealth ? 'up' : 'down',
        syncWorker: 'delegated' // Sync is now handled by sync worker
      },
      responseTime: {
        database: dbHealth.responseTime
      }
    });
  });

  // API v1 Routes
  fastify.register(async function (fastify) {
    // Portfolio Routes with authentication
    fastify.register(async function (fastify) {
      // Add auth middleware to all routes in this context
      fastify.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));

      // Register portfolio routes with shared services including syncProxyService
      await portfolioRoutes(fastify, {
        databaseService,
        cacheService,
        portfolioService,
        syncProxyService
      });
    });

    // Sync Management Routes (mixed: user routes need auth, admin routes need admin auth)
    // Note: Sync logic now handled by sync worker via message queue
    fastify.register(async function (fastify) {
      // Register sync routes - they handle their own authentication internally
      await syncRoutes(fastify, {
        databaseService,
        cacheService,
        portfolioService
      });
    }, { prefix: '/sync' });

    // Order Management Routes with authentication
    fastify.register(async function (fastify) {
      // Add auth middleware to all routes in this context
      fastify.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));

      // Register order routes
      await orderRoutes(fastify);
    });

    // Chain Management Routes (mixed: public read, admin CRUD)
    fastify.register(async function (fastify) {
      // Register chain routes - they handle their own authentication internally
      await chainRoutes(fastify, {
        databaseService,
        cacheService
      });
    });

    // Bitquery API Routes (no authentication required)
    fastify.register(async function (fastify) {
      await bitqueryRoutes(fastify);
    }, { prefix: '/bitquery' });

    // Stats API Routes (no authentication required for read-only stats)
    fastify.register(async function (fastify) {
      await statsRoutes(fastify, {
        databaseService,
        cacheService
      });
    });
  }, { prefix: '/api/v1' });

  // Error handling
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method
    });

    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: 'Validation error',
        details: error.validation,
        timestamp: new Date().toISOString()
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await syncProxyService.shutdown();
      await databaseService.disconnect();
      await cacheService.disconnect();
      await fastify.close();
      logger.info('Server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Start server with config-based settings
  try {
    await fastify.listen({
      port: serverConfig.port,
      host: serverConfig.host
    });

    logger.info(`🚀 Core Service running on ${serverConfig.host}:${serverConfig.port}`);
    logger.info(`📦 Portfolio management active (sync delegated to sync worker)`);
    // Swagger temporarily disabled
    // if (config.isDevelopment()) {
    //   logger.info(`📝 API Documentation: http://${serverConfig.host}:${serverConfig.port}/docs`);
    // }
    logger.info(`🔧 Environment: ${config.get('NODE_ENV')}`);
  } catch (err) {
    logger.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }
};

// Start the server
startServer().catch((err) => {
  logger.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
}); 