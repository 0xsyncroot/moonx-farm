import cluster from 'cluster';
import { cpus } from 'os';
import { StatsAggregator } from './services/statsAggregator';
import { StatsScheduler } from './jobs/scheduler';
import { logger } from './utils/logger';
import { StatsWorkerConfig } from './types/index';
import { 
  getMongoConfig, 
  getKafkaConfig, 
  getChainConfigs, 
  getBridgeConfigs, 
  getJobConfigs, 
  getApiConfigs, 
  getClusterConfig 
} from './config';

// Configuration using helper functions
const config: StatsWorkerConfig = {
  serviceName: process.env.SERVICE_NAME || 'stats-worker',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  mongodb: getMongoConfig(),
  kafka: getKafkaConfig(),
  chains: getChainConfigs(),
  bridges: getBridgeConfigs(),
  jobs: getJobConfigs(),
  apis: getApiConfigs(),
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  }
};

const clusterConfig = getClusterConfig();
const CLUSTER_WORKERS = clusterConfig.workers || Math.min(cpus().length, 4); // Max 4 workers

class StatsWorkerApp {
  private aggregator: StatsAggregator;
  private scheduler: StatsScheduler;
  private isShuttingDown = false;

  constructor() {
    this.aggregator = new StatsAggregator(config);
    this.scheduler = new StatsScheduler(this.aggregator, config);
  }

  /**
   * Initialize and start the stats worker
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting stats worker', {
        processId: process.pid,
        nodeEnv: process.env.NODE_ENV,
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion
      });

      // Initialize aggregator
      await this.aggregator.initialize();

      // Start scheduler
      await this.scheduler.start();

      // Setup health check interval
      this.setupHealthCheck();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Stats worker started successfully', {
        processId: process.pid,
        activeJobs: this.scheduler.getActiveJobs().length
      });

    } catch (error) {
      logger.error('Failed to start stats worker', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processId: process.pid
      });
      process.exit(1);
    }
  }

  /**
   * Setup periodic health check
   */
  private setupHealthCheck(): void {
    setInterval(async () => {
      try {
        await this.aggregator.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) {
          logger.warn('Force shutdown initiated');
          process.exit(1);
        }

        this.isShuttingDown = true;
        logger.info('Graceful shutdown initiated', { signal });

        try {
          // Stop scheduler first
          await this.scheduler.stop();
          logger.info('Scheduler stopped');

          // Cleanup aggregator
          await this.aggregator.cleanup();
          logger.info('Aggregator cleaned up');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          process.exit(1);
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        promise: promise.toString()
      });
      process.exit(1);
    });
  }

  /**
   * Stop the stats worker
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('Stopping stats worker');

    try {
      await this.scheduler.stop();
      await this.aggregator.cleanup();
      logger.info('Stats worker stopped successfully');
    } catch (error) {
      logger.error('Error stopping stats worker', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

/**
 * Cluster management
 */
if (cluster.isPrimary) {
  // Master process
  logger.info('Starting stats worker in cluster mode', {
    workers: CLUSTER_WORKERS,
    nodeEnv: process.env.NODE_ENV
  });

  // Fork workers
  for (let i = 0; i < CLUSTER_WORKERS; i++) {
    cluster.fork();
  }

  // Handle worker exits
  cluster.on('exit', (worker, code, signal) => {
    logger.warn('Worker died', {
      workerId: worker.process.pid,
      code,
      signal
    });

    // Restart worker if not graceful shutdown
    if (!worker.exitedAfterDisconnect) {
      logger.info('Restarting worker');
      cluster.fork();
    }
  });

  // Handle graceful shutdown for master
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  signals.forEach(signal => {
    process.on(signal, () => {
      logger.info('Master process shutting down', { signal });
      
      // Disconnect all workers
      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.disconnect();
        }
      }

      // Force exit after timeout
      setTimeout(() => {
        logger.warn('Force exit after timeout');
        process.exit(1);
      }, 30000); // 30 seconds timeout
    });
  });

} else {
  // Worker process
  const app = new StatsWorkerApp();
  
  // Start the worker
  app.start().catch((error) => {
    logger.error('Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workerId: process.pid
    });
    process.exit(1);
  });

  // Handle worker disconnect
  process.on('disconnect', async () => {
    logger.info('Worker disconnected, shutting down', {
      workerId: process.pid
    });
    
    try {
      await app.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during worker shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  });
}

export default StatsWorkerApp; 