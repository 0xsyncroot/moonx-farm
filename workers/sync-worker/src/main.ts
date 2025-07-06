import cluster from 'cluster';
import os from 'os';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { MetricsCollector } from '@/monitoring/metricsCollector';
import { AlchemyService } from '@/services/alchemyService';
import { DatabaseService } from '@/services/databaseService';
import { KafkaEventPublisher } from '@/services/kafkaEventPublisher';
import { MessageQueueListener } from '@/services/messageQueueListener';
import { SyncProcessor } from '@/workers/syncProcessor';
import { PeriodicSyncScheduler } from '@/scheduler/periodicSyncScheduler';

// Main application class
class SyncWorkerApp {
  private metricsCollector?: MetricsCollector;
  private alchemyService?: AlchemyService;
  private databaseService?: DatabaseService;
  private kafkaEventPublisher?: KafkaEventPublisher;
  private messageQueueListener?: MessageQueueListener;
  private syncProcessor?: SyncProcessor;
  private periodicSyncScheduler?: PeriodicSyncScheduler;
  private isShuttingDown = false;

  constructor() {
    logger.info('🚀 Sync Worker App initializing...', {
      pid: process.pid,
      workerId: cluster.worker?.id,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    });
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Initializing services...');

      // Initialize Alchemy service
      this.alchemyService = new AlchemyService();

      // Initialize Database service
      this.databaseService = new DatabaseService();
      await this.databaseService.initialize();

      // Initialize Kafka event publisher
      this.kafkaEventPublisher = new KafkaEventPublisher();
      await this.kafkaEventPublisher.initialize();

      // Initialize sync processor with Kafka event publisher
      this.syncProcessor = new SyncProcessor(
        this.alchemyService, 
        this.databaseService,
        this.kafkaEventPublisher
      );
      
      // Initialize sync processor (for state recovery)
      await this.syncProcessor.initialize();

      // Initialize Redis-based message queue listener
      this.messageQueueListener = new MessageQueueListener(this.syncProcessor);
      await this.messageQueueListener.initialize();

      // Initialize periodic sync scheduler with database service
      this.periodicSyncScheduler = new PeriodicSyncScheduler(this.databaseService);

      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector();

      logger.info('✅ All services initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize services', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting sync worker app...');

      // Start metrics collector
      if (this.metricsCollector) {
        await this.metricsCollector.start();
      }

      // Start message queue listener (Redis-based)
      if (this.messageQueueListener) {
        await this.messageQueueListener.start();
      }

      // Start periodic sync scheduler
      if (this.periodicSyncScheduler) {
        await this.periodicSyncScheduler.start();
      }

      logger.info('✅ Sync worker app started successfully', {
        workerId: cluster.worker?.id,
        pid: process.pid,
      });

    } catch (error) {
      logger.error('❌ Failed to start sync worker app', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop all services
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('⚠️ Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    try {
      logger.info('🛑 Stopping sync worker app...');

      // Stop periodic sync scheduler
      if (this.periodicSyncScheduler) {
        await this.periodicSyncScheduler.stop();
      }

      // Stop message queue listener
      if (this.messageQueueListener) {
        await this.messageQueueListener.stop();
      }

      // Stop metrics collector
      if (this.metricsCollector) {
        await this.metricsCollector.stop();
      }

      // Disconnect Kafka event publisher
      if (this.kafkaEventPublisher) {
        await this.kafkaEventPublisher.disconnect();
      }

      // Disconnect database service
      if (this.databaseService) {
        await this.databaseService.disconnect();
      }

      logger.info('✅ Sync worker app stopped successfully');

    } catch (error) {
      logger.error('❌ Error stopping sync worker app', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const healthChecks = await Promise.all([
        this.databaseService?.healthCheck(),
        this.kafkaEventPublisher?.isHealthy(),
        this.messageQueueListener?.isHealthy(),
        this.periodicSyncScheduler?.isHealthy(),
      ]);

      return healthChecks.every(check => 
        check === true || (check && check.connected === true)
      );
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<any> {
    try {
      const [queueStats, schedulerStats, kafkaStats] = await Promise.all([
        this.messageQueueListener?.getStats(),
        this.periodicSyncScheduler?.getStats(),
        this.kafkaEventPublisher?.getStats(),
      ]);

      return {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        workerId: cluster.worker?.id,
        queue: queueStats,
        scheduler: schedulerStats,
        kafka: kafkaStats,
        isHealthy: await this.isHealthy(),
      };
    } catch (error) {
      logger.error('Error getting stats', { error });
      return {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    logger.info('🔄 Starting graceful shutdown...');
    
    try {
      // Set shutdown timeout
      const shutdownTimeout = setTimeout(() => {
        logger.error('⏰ Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout

      // Graceful shutdown of each component
      if (this.messageQueueListener) {
        await this.messageQueueListener.gracefulShutdown();
      }

      if (this.periodicSyncScheduler) {
        await this.periodicSyncScheduler.gracefulShutdown();
      }

      if (this.kafkaEventPublisher) {
        await this.kafkaEventPublisher.gracefulShutdown();
      }

      // Clear timeout
      clearTimeout(shutdownTimeout);

      // Stop the app
      await this.stop();
      
      logger.info('✅ Graceful shutdown completed');
    } catch (error) {
      logger.error('❌ Error during graceful shutdown', { error });
      throw error;
    }
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  
  process.exit(1);
});

// Graceful shutdown handlers
const app = new SyncWorkerApp();

process.on('SIGTERM', async () => {
  logger.info('📨 SIGTERM received, starting graceful shutdown...');
  try {
    await app.gracefulShutdown();
    process.exit(0);
  } catch (error) {
    logger.error('💥 Error during SIGTERM shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('📨 SIGINT received, starting graceful shutdown...');
  try {
    await app.gracefulShutdown();
    process.exit(0);
  } catch (error) {
    logger.error('💥 Error during SIGINT shutdown', { error });
    process.exit(1);
  }
});

// Cluster management for production scaling
async function startWorker(): Promise<void> {
  try {
    await app.initialize();
    await app.start();
    
    logger.info('🎯 Worker ready for processing', {
      workerId: cluster.worker?.id,
      pid: process.pid,
    });
    
    // Health check endpoint simulation (in production, use HTTP server)
    setInterval(async () => {
      const isHealthy = await app.isHealthy();
      if (!isHealthy) {
        logger.error('🚨 Worker health check failed');
      }
    }, 30000); // Check every 30 seconds
    
  } catch (error) {
    logger.error('💥 Failed to start worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Main entry point
if (cluster.isPrimary) {
  const workerCount = config.cluster.workers;
  const numCPUs = workerCount === 0
    ? os.cpus().length 
    : Math.min(Number(workerCount) || 1, os.cpus().length);

  logger.info('🏭 Starting cluster master', {
    workers: numCPUs,
    maxMemory: config.cluster.maxMemory,
    cpuThreshold: config.cluster.cpuThreshold,
  });

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    logger.warn('💀 Worker died', {
      workerId: worker.id,
      pid: worker.process.pid,
      code,
      signal,
    });

    // Restart worker if not intentional shutdown
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      logger.info('🔄 Restarting worker...');
      cluster.fork();
    }
  });

  // Graceful cluster shutdown
  const shutdownCluster = async () => {
    logger.info('🛑 Shutting down cluster...');
    
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker) {
        worker.disconnect();
        
        // Force kill after timeout
        setTimeout(() => {
          if (!worker.isDead()) {
            logger.warn('⚡ Force killing worker', { workerId: worker.id });
            worker.kill();
          }
        }, 10000);
      }
    }
  };

  process.on('SIGTERM', shutdownCluster);
  process.on('SIGINT', shutdownCluster);

} else {
  // Worker process
  startWorker();
} 