import Fastify from 'fastify';
import { createCoreServiceConfig, getServerConfig } from '@moonx/configs';
import { DatabaseService } from './services/databaseService';
import { CacheService } from './services/cacheService';
import { PortfolioService } from './services/portfolioService';
import { PnLService } from './services/pnlService';
import { TradesService } from './services/tradesService';
import { AutoSyncService } from './services/autoSyncService';
import { AuthMiddleware } from './middleware/authMiddleware';
import { SyncMiddleware } from './middleware/syncMiddleware';
import { PortfolioController } from './controllers/portfolioController';
import { orderRoutes } from './routes/orders';

const startServer = async () => {
  // Load configuration from @moonx/configs
  const config = createCoreServiceConfig();
  const serverConfig = getServerConfig('core-service');
  
  // Initialize Fastify with config-based settings
  const fastify = Fastify({
    logger: {
      level: serverConfig.logLevel,
      prettyPrint: serverConfig.environment === 'development'
    }
  });

  // Register plugins
  await fastify.register(import('@fastify/cors'), {
    origin: true,
    credentials: true
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
        // Use user ID from token for rate limiting (simplified)
        return authHeader;
      }
      return request.ip;
    }
  });

  // Register Swagger for development only
  if (serverConfig.environment === 'development') {
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
            url: `http://${serverConfig.host}:${serverConfig.port}`,
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

  // Initialize services
  const databaseService = new DatabaseService();
  const cacheService = new CacheService();
  const authMiddleware = new AuthMiddleware();
  
  // Connect to infrastructure
  await databaseService.connect();
  await cacheService.connect();
  
  fastify.log.info('Connected to database and cache');

  // Decorate fastify with services for controller access
  fastify.decorate('databaseManager', databaseService.getDatabaseManager());
  fastify.decorate('redisManager', cacheService.getRedisManager());

  // Initialize business services
  const portfolioService = new PortfolioService(databaseService, cacheService);
  const pnlService = new PnLService(databaseService, cacheService);
  const tradesService = new TradesService(databaseService, cacheService);
  
  // Initialize auto sync service
  const autoSyncService = new AutoSyncService(portfolioService, cacheService, databaseService);
  const syncMiddleware = new SyncMiddleware(autoSyncService);

  // Initialize controllers
  const portfolioController = new PortfolioController(
    portfolioService, 
    pnlService, 
    tradesService,
    autoSyncService,
    authMiddleware
  );

  // Start auto sync service
  await autoSyncService.start();
  fastify.log.info('🔄 Auto Sync Service started');

  // Health check routes
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await databaseService.healthCheck();
    const cacheHealth = await cacheService.healthCheck();
    const syncStats = await autoSyncService.getSyncStats();
    
    const status = dbHealth && cacheHealth ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;
    
    return reply.code(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'up' : 'down',
        cache: cacheHealth ? 'up' : 'down',
        autoSync: syncStats.isRunning ? 'running' : 'stopped'
      },
      autoSync: syncStats
    });
  });

  // Portfolio Routes with auto sync
  fastify.register(async function (fastify) {
    // Add auth middleware to all routes in this context
    fastify.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));
    
    // Add auto sync trigger middleware (background)
    fastify.addHook('preHandler', syncMiddleware.autoTriggerSync.bind(syncMiddleware));

    // Portfolio Management (auto-synced)
    fastify.get('/portfolio', portfolioController.getPortfolio.bind(portfolioController));
    fastify.get('/portfolio/quick', portfolioController.getQuickPortfolio.bind(portfolioController));
    fastify.post('/portfolio/refresh', portfolioController.refreshPortfolio.bind(portfolioController));
    
    // P&L and Analytics
    fastify.get('/portfolio/pnl', portfolioController.getPnL.bind(portfolioController));
    fastify.get('/portfolio/analytics', portfolioController.getAnalytics.bind(portfolioController));
    fastify.get('/portfolio/history', portfolioController.getPortfolioHistory.bind(portfolioController));
    
    // Recent Trades (read-only)
    fastify.get('/portfolio/trades', portfolioController.getRecentTrades.bind(portfolioController));
    
    // Sync Status (for monitoring)
    fastify.get('/portfolio/sync-status', portfolioController.getSyncStatus.bind(portfolioController));
  });

  // Order Management Routes
  fastify.register(async function (fastify) {
    // Add auth middleware to all routes in this context
    fastify.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));
    
    // Register order routes
    await orderRoutes(fastify);
  });

  // Error handling
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: 'Validation error',
        details: error.validation
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      // Stop auto sync service first
      await autoSyncService.stop();
      
      await databaseService.disconnect();
      await cacheService.disconnect();
      await fastify.close();
      fastify.log.info('Server shutdown completed');
      process.exit(0);
    } catch (error) {
      fastify.log.error('Error during shutdown:', error);
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
    
    fastify.log.info(`🚀 Core Service running on ${serverConfig.host}:${serverConfig.port}`);
    fastify.log.info(`📊 Auto-sync portfolio management active`);
    fastify.log.info(`📝 API Documentation: http://${serverConfig.host}:${serverConfig.port}/docs`);
    fastify.log.info(`🔧 Environment: ${serverConfig.environment}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
}); 