import cluster, { Worker } from 'cluster';
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
import { MongoManager } from '@moonx-farm/infrastructure';

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

/**
 * Worker metadata for cluster management
 */
interface WorkerMetadata {
  id: number;
  pid: number;
  isScheduler: boolean;
  startTime: number;
  lastHeartbeat: number;
}

/**
 * Worker leader election via master process coordination
 */
class WorkerLeaderElection {
  private workerId: string;
  private isLeader: boolean = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private messagingSetup = false;

  constructor(workerId: string, shouldBeLeader: boolean = false) {
    this.workerId = workerId;
    this.isLeader = shouldBeLeader;
  }

  async start(): Promise<void> {
    if (!this.messagingSetup) {
      this.setupWorkerMessaging();
    }
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Start periodic heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 10000); // Every 10 seconds
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Notify master that we're stopping
    if (process.send) {
      process.send({
        type: 'worker_stopping',
        workerId: this.workerId,
        isScheduler: this.isLeader
      });
    }
  }

  private setupWorkerMessaging(): void {
    // Listen for messages from master
    process.on('message', (message: any) => {
      if (message.type === 'become_scheduler') {
        this.isLeader = true;
        logger.info('🚀 Promoted to scheduler leader', {
          workerId: this.workerId
        });
      } else if (message.type === 'stop_scheduler') {
        this.isLeader = false;
        logger.info('🛑 Demoted from scheduler leader', {
          workerId: this.workerId
        });
      }
    });
    
    this.messagingSetup = true;
  }

  private sendHeartbeat(): void {
    if (process.send) {
      process.send({
        type: 'heartbeat',
        workerId: this.workerId,
        isScheduler: this.isLeader,
        timestamp: Date.now()
      });
    }
  }

  getIsLeader(): boolean {
    return this.isLeader;
  }
}

class StatsWorkerApp {
  private aggregator: StatsAggregator;
  private scheduler?: StatsScheduler;
  private isShuttingDown = false;
  private leaderElection?: WorkerLeaderElection;
  private mongoManager: MongoManager;
  private workerId: string;

  constructor() {
    this.workerId = `${process.pid}-${cluster.worker?.id || 0}`;
    this.mongoManager = new MongoManager(config.mongodb);
    this.aggregator = new StatsAggregator(config);
  }

  /**
   * Initialize and start the stats worker
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting stats worker', {
        processId: process.pid,
        workerId: this.workerId,
        nodeEnv: process.env.NODE_ENV,
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion
      });

      // Initialize MongoDB for leader election
      await this.mongoManager.connect();
      
      // Initialize aggregator
      await this.aggregator.initialize();

      // Start leader election in cluster mode
      if (CLUSTER_WORKERS > 1) {
        // First worker becomes scheduler initially
        const isInitialScheduler = cluster.worker?.id === 1;
        this.leaderElection = new WorkerLeaderElection(this.workerId, isInitialScheduler);
        await this.leaderElection.start();
        
        // Check leadership status every 10 seconds
        setInterval(() => {
          this.checkLeadershipStatus();
        }, 10000);
      } else {
        // Single worker mode - always be leader
        this.startScheduler();
      }

      // Setup health check interval
      this.setupHealthCheck();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Stats worker started successfully', {
        processId: process.pid,
        workerId: this.workerId,
        clusterMode: CLUSTER_WORKERS > 1,
        activeJobs: this.scheduler?.getActiveJobs().length || 0
      });

    } catch (error) {
      logger.error('Failed to start stats worker', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processId: process.pid,
        workerId: this.workerId
      });
      process.exit(1);
    }
  }

  /**
   * Check leadership status and start/stop scheduler accordingly
   */
  private checkLeadershipStatus(): void {
    if (!this.leaderElection) return;

    const isLeader = this.leaderElection.getIsLeader();
    const hasScheduler = !!this.scheduler;

    if (isLeader && !hasScheduler) {
      this.startScheduler();
    } else if (!isLeader && hasScheduler) {
      this.stopScheduler();
    }
  }

  /**
   * Start scheduler
   */
  private async startScheduler(): Promise<void> {
    try {
      if (this.scheduler) return;
      
      this.scheduler = new StatsScheduler(this.aggregator, config);
      await this.scheduler.start();
      
      logger.info('🎯 Scheduler started - This worker is now handling jobs', {
        workerId: this.workerId,
        activeJobs: this.scheduler.getActiveJobs().length
      });
    } catch (error) {
      logger.error('Failed to start scheduler', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Stop scheduler
   */
  private async stopScheduler(): Promise<void> {
    try {
      if (!this.scheduler) return;
      
      await this.scheduler.stop();
      this.scheduler = undefined;
      
      logger.info('🛑 Scheduler stopped - This worker is no longer handling jobs', {
        workerId: this.workerId
      });
    } catch (error) {
      logger.error('Failed to stop scheduler', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
          error: error instanceof Error ? error.message : 'Unknown error',
          workerId: this.workerId
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
        logger.info('Graceful shutdown initiated', { 
          signal,
          workerId: this.workerId
        });

        try {
          // Stop leader election
          if (this.leaderElection) {
            await this.leaderElection.stop();
          }
          
          // Stop scheduler first (only if this is scheduler worker)
          if (this.scheduler) {
            await this.scheduler.stop();
            logger.info('Scheduler stopped');
          }

          // Cleanup aggregator
          await this.aggregator.cleanup();
          logger.info('Aggregator cleaned up');

          // Cleanup MongoDB
          await this.mongoManager.cleanup();
          logger.info('MongoDB cleaned up');

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
    logger.info('Stopping stats worker', { workerId: this.workerId });

    try {
      // Stop leader election
      if (this.leaderElection) {
        await this.leaderElection.stop();
      }
      
      // Stop scheduler only if this worker has it
      if (this.scheduler) {
        await this.scheduler.stop();
        logger.info('Scheduler stopped');
      }
      
      await this.aggregator.cleanup();
      await this.mongoManager.cleanup();
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
 * Cluster management with leader election
 */
if (cluster.isPrimary) {
  // Master process
  const workerMetadata = new Map<number, WorkerMetadata>();
  let currentSchedulerWorkerId: number | null = null;
  
  logger.info('Starting stats worker in cluster mode', {
    workers: CLUSTER_WORKERS,
    nodeEnv: process.env.NODE_ENV
  });

  /**
   * Find the best worker to become scheduler
   */
  function findBestSchedulerWorker(): number | null {
    const activeWorkers = Array.from(workerMetadata.values())
      .filter(w => Date.now() - w.lastHeartbeat < 30000) // Active in last 30 seconds
      .sort((a, b) => a.id - b.id); // Prefer lower ID
    
    return activeWorkers.length > 0 ? activeWorkers[0].id : null;
  }

  /**
   * Promote a worker to scheduler
   */
  function promoteWorkerToScheduler(workerId: number): void {
    const worker = cluster.workers?.[workerId];
    if (worker) {
      // Demote current scheduler
      if (currentSchedulerWorkerId && currentSchedulerWorkerId !== workerId) {
        const currentWorker = cluster.workers?.[currentSchedulerWorkerId];
        if (currentWorker) {
          currentWorker.send({ type: 'stop_scheduler' });
        }
      }
      
      // Promote new scheduler
      worker.send({ type: 'become_scheduler' });
      currentSchedulerWorkerId = workerId;
      
      logger.info('Promoted worker to scheduler', {
        workerId,
        workerPid: worker.process.pid
      });
    }
  }

  /**
   * Handle worker messages
   */
  function handleWorkerMessage(worker: Worker, message: any): void {
    if (message.type === 'heartbeat') {
      // Update worker metadata
      workerMetadata.set(worker.id, {
        id: worker.id,
        pid: worker.process.pid || 0,
        isScheduler: message.isScheduler,
        startTime: workerMetadata.get(worker.id)?.startTime || Date.now(),
        lastHeartbeat: Date.now()
      });
      
      // Check if we need to elect a new scheduler
      if (!currentSchedulerWorkerId || !message.isScheduler) {
        const bestWorker = findBestSchedulerWorker();
        if (bestWorker && bestWorker !== currentSchedulerWorkerId) {
          promoteWorkerToScheduler(bestWorker);
        }
      }
    } else if (message.type === 'worker_stopping') {
      // Worker is stopping
      if (message.isScheduler) {
        currentSchedulerWorkerId = null;
        // Elect new scheduler
        const bestWorker = findBestSchedulerWorker();
        if (bestWorker) {
          promoteWorkerToScheduler(bestWorker);
        }
      }
    }
  }

  // Fork workers
  for (let i = 0; i < CLUSTER_WORKERS; i++) {
    cluster.fork();
  }

  // Handle worker events
  cluster.on('fork', (worker) => {
    logger.info('Worker forked', {
      workerId: worker.id,
      workerPid: worker.process.pid
    });
    
    // Setup message handler
    worker.on('message', (message) => {
      handleWorkerMessage(worker, message);
    });
  });

  cluster.on('online', (worker) => {
    logger.info('Worker online', {
      workerId: worker.id,
      workerPid: worker.process.pid
    });
  });

  // Handle worker exits
  cluster.on('exit', (worker, code, signal) => {
    logger.warn('Worker died', {
      workerId: worker.id,
      workerPid: worker.process.pid,
      code,
      signal
    });

    // Remove from metadata
    workerMetadata.delete(worker.id);
    
    // If this was the scheduler, elect a new one
    if (currentSchedulerWorkerId === worker.id) {
      currentSchedulerWorkerId = null;
      const bestWorker = findBestSchedulerWorker();
      if (bestWorker) {
        promoteWorkerToScheduler(bestWorker);
      }
    }

    // Restart worker if not graceful shutdown
    if (!worker.exitedAfterDisconnect) {
      logger.info('Restarting worker');
      cluster.fork();
    }
  });

  // Periodic scheduler health check
  setInterval(() => {
    const now = Date.now();
    const activeWorkers = Array.from(workerMetadata.values())
      .filter(w => now - w.lastHeartbeat < 30000);
    
    // If no scheduler or scheduler is inactive, elect a new one
    if (!currentSchedulerWorkerId || 
        !activeWorkers.some(w => w.id === currentSchedulerWorkerId)) {
      const bestWorker = findBestSchedulerWorker();
      if (bestWorker) {
        promoteWorkerToScheduler(bestWorker);
      }
    }
  }, 15000); // Check every 15 seconds

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
  // Worker process - only first worker handles scheduling
  const workerId = cluster.worker?.id || 0;
  const isSchedulerWorker = workerId === 1; // First worker handles scheduling
  
  const app = new StatsWorkerApp();
  
  // Start the worker
  app.start().catch((error) => {
    logger.error('Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workerId: process.pid,
      isSchedulerWorker
    });
    process.exit(1);
  });

  // Handle worker disconnect
  process.on('disconnect', async () => {
    logger.info('Worker disconnected, shutting down', {
      workerId: process.pid,
      isSchedulerWorker
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