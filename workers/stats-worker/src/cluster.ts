import cluster from 'cluster';
import { cpus } from 'os';
import { logger } from './utils/logger';
import { getOptimalWorkerCount } from './utils/helpers';

interface WorkerMetrics {
  id: number;
  pid: number;
  startTime: number;
  restarts: number;
  lastRestart?: number;
  memoryUsage: number;
  cpuUsage: number;
  isHealthy: boolean;
}

export class ClusterManager {
  private workerCount: number;
  private workers: Map<number, WorkerMetrics> = new Map();
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private restartThreshold = 5; // Max restarts per worker
  private restartWindow = 300000; // 5 minutes

  constructor(workerCount?: number) {
    this.workerCount = workerCount || getOptimalWorkerCount();
  }

  /**
   * Start the cluster
   */
  start(): void {
    if (!cluster.isPrimary) {
      throw new Error('ClusterManager can only be used in primary process');
    }

    logger.info('Starting cluster manager', {
      workerCount: this.workerCount,
      nodeEnv: process.env.NODE_ENV
    });

    // Setup cluster events
    this.setupClusterEvents();

    // Fork workers
    this.forkWorkers();

    // Start health monitoring
    this.startHealthMonitoring();

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    logger.info('Cluster manager started successfully', {
      activeWorkers: Object.keys(cluster.workers || {}).length
    });
  }

  /**
   * Setup cluster event handlers
   */
  private setupClusterEvents(): void {
    cluster.on('fork', (worker) => {
      logger.info('Worker forked', {
        workerId: worker.id,
        workerPid: worker.process.pid
      });

      this.workers.set(worker.id, {
        id: worker.id,
        pid: worker.process.pid || 0,
        startTime: Date.now(),
        restarts: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        isHealthy: true
      });
    });

    cluster.on('online', (worker) => {
      logger.info('Worker online', {
        workerId: worker.id,
        workerPid: worker.process.pid
      });
    });

    cluster.on('listening', (worker, address) => {
      logger.info('Worker listening', {
        workerId: worker.id,
        workerPid: worker.process.pid,
        address: `${address.address}:${address.port}`
      });
    });

    cluster.on('disconnect', (worker) => {
      logger.warn('Worker disconnected', {
        workerId: worker.id,
        workerPid: worker.process.pid
      });
    });

    cluster.on('exit', (worker, code, signal) => {
      const workerMetrics = this.workers.get(worker.id);
      
      logger.warn('Worker died', {
        workerId: worker.id,
        workerPid: worker.process.pid,
        exitCode: code,
        signal,
        restarts: workerMetrics?.restarts || 0
      });

      // Clean up worker metrics
      this.workers.delete(worker.id);

      // Restart worker if not shutting down
      if (!this.isShuttingDown && !worker.exitedAfterDisconnect) {
        this.restartWorker(worker.id, workerMetrics);
      }
    });
  }

  /**
   * Fork initial workers
   */
  private forkWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      cluster.fork();
    }
  }

  /**
   * Restart a worker with throttling
   */
  private restartWorker(workerId: number, metrics?: WorkerMetrics): void {
    const now = Date.now();
    
    // Check restart threshold
    if (metrics) {
      const restartCount = metrics.restarts + 1;
      const timeSinceFirstRestart = now - metrics.startTime;
      
      if (restartCount > this.restartThreshold && timeSinceFirstRestart < this.restartWindow) {
        logger.error('Worker restart threshold exceeded', {
          workerId,
          restarts: restartCount,
          threshold: this.restartThreshold,
          timeWindow: this.restartWindow
        });
        return;
      }
    }

    // Fork new worker
    const newWorker = cluster.fork();
    
    // Update metrics
    if (metrics) {
      this.workers.set(newWorker.id, {
        ...metrics,
        id: newWorker.id,
        pid: newWorker.process.pid || 0,
        restarts: metrics.restarts + 1,
        lastRestart: now,
        isHealthy: true
      });
    }

    logger.info('Worker restarted', {
      oldWorkerId: workerId,
      newWorkerId: newWorker.id,
      newWorkerPid: newWorker.process.pid
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkWorkersHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check health of all workers
   */
  private async checkWorkersHealth(): Promise<void> {
    const activeWorkers = Object.values(cluster.workers || {});
    
    for (const worker of activeWorkers) {
      if (!worker) continue;
      
      const metrics = this.workers.get(worker.id);
      if (!metrics) continue;

      try {
        // Send health check message to worker
        worker.send({ type: 'health-check', timestamp: Date.now() });
        
        // Update metrics if we have them
        if (worker.process.pid) {
          // In a real implementation, you'd collect actual metrics
          metrics.memoryUsage = process.memoryUsage().heapUsed;
          metrics.cpuUsage = 0; // Simplified
          metrics.isHealthy = true;
        }
      } catch (error) {
        logger.warn('Failed to send health check to worker', {
          workerId: worker.id,
          workerPid: worker.process.pid,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        if (metrics) {
          metrics.isHealthy = false;
        }
      }
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info('Cluster manager shutting down', { signal });
        await this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in cluster manager', {
        error: error.message,
        stack: error.stack
      });
      
      // Shutdown gracefully
      this.shutdown().finally(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection in cluster manager', {
        reason: reason instanceof Error ? reason.message : reason,
        promise: promise.toString()
      });
      
      // Shutdown gracefully
      this.shutdown().finally(() => {
        process.exit(1);
      });
    });
  }

  /**
   * Gracefully shutdown the cluster
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Disconnect all workers
      logger.info('Disconnecting all workers');
      const activeWorkers = Object.values(cluster.workers || {});
      
      for (const worker of activeWorkers) {
        if (worker) {
          worker.disconnect();
        }
      }

      // Wait for workers to exit gracefully
      await this.waitForWorkersToExit(30000); // 30 seconds timeout

      // Force kill any remaining workers
      await this.forceKillWorkers();

      logger.info('Cluster manager shutdown completed');
    } catch (error) {
      logger.error('Error during cluster shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Wait for all workers to exit
   */
  private async waitForWorkersToExit(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const activeWorkers = Object.values(cluster.workers || {});
      
      if (activeWorkers.length === 0) {
        return;
      }

      logger.debug('Waiting for workers to exit', {
        remainingWorkers: activeWorkers.length
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn('Timeout waiting for workers to exit gracefully');
  }

  /**
   * Force kill any remaining workers
   */
  private async forceKillWorkers(): Promise<void> {
    const activeWorkers = Object.values(cluster.workers || {});
    
    for (const worker of activeWorkers) {
      if (worker && !worker.isDead()) {
        logger.warn('Force killing worker', {
          workerId: worker.id,
          workerPid: worker.process.pid
        });
        
        worker.kill('SIGKILL');
      }
    }
  }

  /**
   * Get cluster statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    healthyWorkers: number;
    totalRestarts: number;
    workers: WorkerMetrics[];
  } {
    const workers = Array.from(this.workers.values());
    
    return {
      totalWorkers: this.workerCount,
      activeWorkers: Object.keys(cluster.workers || {}).length,
      healthyWorkers: workers.filter(w => w.isHealthy).length,
      totalRestarts: workers.reduce((sum, w) => sum + w.restarts, 0),
      workers: workers
    };
  }

  /**
   * Add a worker dynamically
   */
  addWorker(): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot add worker during shutdown');
      return;
    }

    const newWorker = cluster.fork();
    this.workerCount++;

    logger.info('Worker added dynamically', {
      workerId: newWorker.id,
      totalWorkers: this.workerCount
    });
  }

  /**
   * Remove a worker gracefully
   */
  removeWorker(workerId?: number): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot remove worker during shutdown');
      return;
    }

    const workers = Object.values(cluster.workers || {});
    const targetWorker = workerId 
      ? workers.find(w => w && w.id === workerId)
      : workers[0];

    if (!targetWorker) {
      logger.warn('No worker found to remove', { workerId });
      return;
    }

    logger.info('Removing worker', {
      workerId: targetWorker.id,
      workerPid: targetWorker.process.pid
    });

    targetWorker.disconnect();
    this.workerCount = Math.max(1, this.workerCount - 1);
  }
}

// Export singleton instance
export const clusterManager = new ClusterManager(); 