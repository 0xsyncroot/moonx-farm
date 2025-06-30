import Fastify from 'fastify';
import { createCoreServiceConfig, getServerConfig } from '@moonx-farm/configs';
import { createLogger } from '@moonx-farm/common';
import { DatabaseService } from './services/databaseService';
import { CacheService } from './services/cacheService';
import { AutoSyncService } from './services/autoSyncService';
import { AuthMiddleware } from './middleware/authMiddleware';
import { orderRoutes } from './routes/orders';
import { portfolioRoutes } from './routes/portfolio';
import { bitqueryRoutes } from './routes/bitquery';

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
      return request.ip;
    }
  });

  // Register Swagger for development only
  if (config.isDevelopment()) {
    await fastify.register(import('@fastify/swagger'), {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'MoonXFarm Core Service API',
          description: 'Core platform APIs with auto-sync portfolio management and analytics',
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

  // Initialize auto sync service (depends on portfolio service which depends on db/cache)
  // We need to import and create PortfolioService for AutoSyncService
  const { PortfolioService } = await import('./services/portfolioService');
  const portfolioService = new PortfolioService(databaseService, cacheService);
  
  const autoSyncService = new AutoSyncService(
    portfolioService,
    cacheService,
    databaseService
  );

  // Start auto sync service
  await autoSyncService.start();
  logger.info('🔄 Auto Sync Service started');

  // Health check routes
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await databaseService.healthCheck();
    const cacheHealth = await cacheService.healthCheck();
    const syncStats = await autoSyncService.getSyncStats();
    
    const status = dbHealth.connected && cacheHealth ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;
    
    return reply.code(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.connected ? 'up' : 'down',
        cache: cacheHealth ? 'up' : 'down',
        autoSync: syncStats.isRunning ? 'running' : 'stopped'
      },
      autoSync: syncStats,
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
      
      // Register portfolio routes with shared services
      await portfolioRoutes(fastify, {
        databaseService,
        cacheService,
        portfolioService,
        autoSyncService
      });
    });

    // Order Management Routes with authentication
    fastify.register(async function (fastify) {
      // Add auth middleware to all routes in this context
      fastify.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));
      
      // Register order routes
      await orderRoutes(fastify);
    });

    // Bitquery API Routes (no authentication required)
    fastify.register(async function (fastify) {
      await bitqueryRoutes(fastify);
    }, { prefix: '/bitquery' });
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
      // Stop auto sync service first
      await autoSyncService.stop();
      
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
    logger.info(`📊 Auto-sync portfolio management active`);
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