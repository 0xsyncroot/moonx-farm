import { config } from '@/config';
import { logger } from '@/utils/logger';
import { DatabaseService } from '@/services/databaseService';
import { CacheService } from '@/services/cacheService';
import { SyncQueue } from '@/queues/syncQueue';
import { SyncProcessor } from '@/workers/syncProcessor';

class SyncWorkerService {
  private databaseService: DatabaseService;
  private cacheService: CacheService;
  private syncQueue: SyncQueue;
  private syncProcessor: SyncProcessor;
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    logger.info('🚀 Initializing MoonXFarm Sync Worker', {
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: config.app.nodeEnv,
      port: config.app.port,
    });

    // Initialize services
    this.databaseService = new DatabaseService();
    this.cacheService = new CacheService();
    this.syncQueue = new SyncQueue('moonx-sync-queue');
    this.syncProcessor = new SyncProcessor(this.databaseService, this.cacheService);

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Initialize all services and start the worker
   */
  async start(): Promise<void> {
    try {
      logger.info('🔧 Starting sync worker services...');

      // Initialize services in order
      await this.databaseService.initialize();
      await this.cacheService.initialize();

      // Warm cache if enabled
      await this.cacheService.warmCache();

      // Initialize queue with job processor
      this.syncQueue.initializeWorker(async (job) => {
        return await this.syncProcessor.processJob({
          id: job.id,
          data: job.data,
          priority: job.priority,
        });
      });

      // Start the queue
      await this.syncQueue.start();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start cleanup tasks
      this.startCleanupTasks();

      logger.info('✅ Sync worker started successfully', {
        concurrency: config.worker.concurrency,
        retryAttempts: config.worker.retryAttempts,
        timeout: config.worker.timeout,
      });

      // Keep the process running
      this.keepAlive();

    } catch (error) {
      logger.error('❌ Failed to start sync worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const [dbHealthy, cacheHealthy] = await Promise.all([
          this.databaseService.isHealthy(),
          this.cacheService.isHealthy(),
        ]);

        const queueStats = await this.syncQueue.getQueueStats();
        const processorStats = this.syncProcessor.getStats();
        const cacheStats = await this.cacheService.getStats();

        if (!dbHealthy || !cacheHealthy) {
          logger.error('🚨 Health check failed', {
            database: dbHealthy,
            cache: cacheHealthy,
          });
        } else {
          logger.debug('💓 Health check passed', {
            queue: {
              waiting: queueStats.waiting,
              active: queueStats.active,
              completed: queueStats.completed,
              failed: queueStats.failed,
            },
            processor: {
              circuitBreakers: processorStats.circuitBreakers,
              rateLimits: processorStats.rateLimits,
              activeCircuitBreakers: processorStats.activeCircuitBreakers,
            },
            cache: {
              size: cacheStats.size,
              maxSize: cacheStats.maxSize,
              expiredEntries: cacheStats.expiredEntries,
            },
          });
        }
      } catch (error) {
        logger.error('Health check error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, config.monitoring.healthCheckInterval);
  }

  /**
   * Cleanup tasks
   */
  private startCleanupTasks(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        logger.debug('🧹 Running cleanup tasks...');

        // Clean old jobs
        await this.syncQueue.cleanJobs();

        // Clean processor state
        this.syncProcessor.cleanup();

        logger.debug('✅ Cleanup tasks completed');
      } catch (error) {
        logger.error('Cleanup error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, config.monitoring.cleanupInterval);
  }

  /**
   * Keep the service running
   */
  private keepAlive(): void {
    if (!this.isShuttingDown) {
      setTimeout(() => this.keepAlive(), 5000);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info('🛑 Starting graceful shutdown...');

    try {
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Stop services in reverse order
      logger.info('Stopping sync queue...');
      await this.syncQueue.stop();

      logger.info('Closing cache service...');
      await this.cacheService.close();

      logger.info('Closing database service...');
      await this.databaseService.close();

      logger.info('✅ Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`📡 Received ${signal} signal, starting graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      this.shutdown().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString(),
      });
      this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    version: string;
    uptime: number;
    services: {
      database: boolean;
      cache: boolean;
      queue: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        paused: boolean;
      };
      processor: {
        circuitBreakers: number;
        rateLimits: number;
        activeCircuitBreakers: number;
      };
    };
    memory: {
      used: number;
      free: number;
      total: number;
    };
  }> {
    try {
      const [dbHealthy, cacheHealthy] = await Promise.all([
        this.databaseService.isHealthy(),
        this.cacheService.isHealthy(),
      ]);

      const queueStats = await this.syncQueue.getQueueStats();
      const processorStats = this.syncProcessor.getStats();
      const memoryUsage = process.memoryUsage();

      const isHealthy = dbHealthy && cacheHealthy && !this.isShuttingDown;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {
          database: dbHealthy,
          cache: cacheHealthy,
          queue: {
            waiting: queueStats.waiting,
            active: queueStats.active,
            completed: queueStats.completed,
            failed: queueStats.failed,
            paused: queueStats.paused,
          },
          processor: {
            circuitBreakers: processorStats.circuitBreakers,
            rateLimits: processorStats.rateLimits,
            activeCircuitBreakers: processorStats.activeCircuitBreakers,
          },
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          free: Math.round(memoryUsage.heapTotal - memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      logger.error('Error getting service status', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: 'unhealthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {
          database: false,
          cache: false,
          queue: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            paused: true,
          },
          processor: {
            circuitBreakers: 0,
            rateLimits: 0,
            activeCircuitBreakers: 0,
          },
        },
        memory: {
          used: 0,
          free: 0,
          total: 0,
        },
      };
    }
  }
}

// Create and start the sync worker
const syncWorker = new SyncWorkerService();

// Start the service
syncWorker.start().catch((error) => {
  logger.error('Failed to start sync worker service', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

// Export for testing
export { SyncWorkerService };
export default syncWorker; 