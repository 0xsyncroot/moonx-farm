import { RedisManager, createRedisConfig } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { Queue, Worker, Job } from 'bullmq';
import { SyncProcessor } from '@/workers/syncProcessor';
import { SyncJobData, SyncJobResult } from '@/types';
import { config } from '@/config';

const logger = createLoggerForAnyService('message-queue-listener');

// Core Service message interfaces (from Core Service)
interface CoreServiceMessage {
  type: 'sync_request' | 'sync_status' | 'sync_operations' | 'cancel_operation';
  data: any;
  timestamp: string;
  responseQueue: string;
  requestId?: string;
}

interface SyncJobRequest {
  jobId: string;
  userId: string;
  walletAddress: string;
  priority: 'high' | 'medium' | 'low';
  syncType: 'portfolio' | 'trades' | 'full';
  forceRefresh?: boolean;
  triggeredAt: Date;
  metadata?: Record<string, any>;
}

interface SyncJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class MessageQueueListener {
  private redis: RedisManager;
  private syncProcessor: SyncProcessor;
  private syncQueue: Queue;
  private syncWorker: Worker;
  private isRunning = false;
  private messageListeners: Map<string, NodeJS.Timeout> = new Map();

  // Core Service queue names (must match Core Service)
  private readonly SYNC_REQUEST_QUEUE = 'sync:requests';
  private readonly SYNC_RESPONSE_QUEUE = 'sync:responses';
  private readonly SYNC_STATUS_QUEUE = 'sync:status';
  private readonly SYNC_OPERATIONS_QUEUE = 'sync:operations';
  private readonly SYNC_CANCEL_QUEUE = 'sync:cancel';

  constructor(syncProcessor: SyncProcessor) {
    this.syncProcessor = syncProcessor;
    
    // Initialize Redis connection
    const redisConfig = createRedisConfig();
    this.redis = new RedisManager({
      ...redisConfig,
      keyPrefix: 'moonx:sync-worker:',
    });

    // Create BullMQ connection config
    const bullmqConnection = this.createBullMQConnection(redisConfig);

    // Initialize BullMQ queue for job processing
    this.syncQueue = new Queue('sync-jobs', {
      connection: bullmqConnection,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: config.worker.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.worker.retryDelay,
        },
      },
    });

    // Initialize BullMQ worker
    this.syncWorker = new Worker('sync-jobs', this.processSyncJob.bind(this), {
      connection: bullmqConnection,
      concurrency: config.worker.concurrency,
      maxStalledCount: 1,
      stalledInterval: 30000,
    });

    this.setupWorkerEvents();
    logger.info('MessageQueueListener initialized');
  }

  private createBullMQConnection(redisConfig: any): any {
    const connection: any = {
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      db: redisConfig.db || 0,
    };

    // Only add password if it exists
    if (redisConfig.password) {
      connection.password = redisConfig.password;
    }

    return connection;
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to initialize Redis connection', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MessageQueueListener already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Start listening to Core Service queues
      this.startListening();
      
      logger.info('MessageQueueListener started', {
        queues: [
          this.SYNC_REQUEST_QUEUE,
          this.SYNC_STATUS_QUEUE,
          this.SYNC_OPERATIONS_QUEUE,
          this.SYNC_CANCEL_QUEUE,
        ],
      });
    } catch (error) {
      logger.error('Failed to start MessageQueueListener', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('MessageQueueListener not running');
      return;
    }

    try {
      this.isRunning = false;
      
      // Stop all message listeners
      this.messageListeners.forEach((timeout) => clearTimeout(timeout));
      this.messageListeners.clear();
      
      // Close BullMQ worker
      await this.syncWorker.close();
      
      // Close BullMQ queue
      await this.syncQueue.close();
      
      // Disconnect Redis
      await this.redis.disconnect();
      
      logger.info('MessageQueueListener stopped');
    } catch (error) {
      logger.error('Error stopping MessageQueueListener', { error });
    }
  }

  private startListening(): void {
    // Listen to sync requests
    this.listenToQueue(this.SYNC_REQUEST_QUEUE, this.handleSyncRequest.bind(this));
    
    // Listen to sync status requests
    this.listenToQueue(this.SYNC_STATUS_QUEUE, this.handleSyncStatus.bind(this));
    
    // Listen to sync operations requests
    this.listenToQueue(this.SYNC_OPERATIONS_QUEUE, this.handleSyncOperations.bind(this));
    
    // Listen to cancel requests
    this.listenToQueue(this.SYNC_CANCEL_QUEUE, this.handleCancelOperation.bind(this));
  }

  private listenToQueue(queueName: string, handler: (message: CoreServiceMessage) => Promise<void>): void {
    const pollQueue = async () => {
      if (!this.isRunning) return;

      try {
        const result = await this.redis.getClient().brpop(queueName, 1);
        if (result) {
          const message: CoreServiceMessage = JSON.parse(result[1]);
          await handler(message);
        }
      } catch (error) {
        logger.error(`Error polling queue ${queueName}`, { error });
      }
      
      // Continue polling
      const timeout = setTimeout(pollQueue, 100);
      this.messageListeners.set(queueName, timeout);
    };

    pollQueue();
  }

  private async handleSyncRequest(message: CoreServiceMessage): Promise<void> {
    try {
      const request: SyncJobRequest = message.data;
      
      logger.info('Received sync request', {
        jobId: request.jobId,
        userId: request.userId,
        priority: request.priority,
      });

      // Add job to BullMQ queue
      const job = await this.syncQueue.add('sync-job', {
        ...request,
        requestId: request.jobId,
        responseQueue: message.responseQueue,
      }, {
        priority: this.getPriorityValue(request.priority),
        jobId: request.jobId,
      });

      logger.debug('Sync job queued', {
        jobId: request.jobId,
        bullmqJobId: job.id,
      });
      
    } catch (error) {
      logger.error('Error handling sync request', { error });
      
      // Send error response
      const response: SyncJobResponse = {
        jobId: message.data.jobId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      };
      
      await this.sendResponse(message.responseQueue, response);
    }
  }

  private async handleSyncStatus(message: CoreServiceMessage): Promise<void> {
    try {
      const { userId, walletAddress } = message.data;
      
      // Get user sync status from database
      const syncStatus = await this.syncProcessor.getUserSyncStatus(userId, walletAddress);
      
      logger.info('Sync status retrieved', {
        userId,
        requestId: message.requestId,
        status: syncStatus.syncStatus,
      });

      await this.sendResponse(message.responseQueue, syncStatus);
      
    } catch (error) {
      logger.error('Error handling sync status request', { error });
      
      // Send default response
      const defaultResponse = {
        userId: message.data.userId,
        walletAddress: message.data.walletAddress,
        lastSyncAt: null,
        syncStatus: 'never',
        isRunning: false,
        activeSyncOperations: 0,
        totalTokens: 0,
        totalValueUsd: 0,
        syncFrequency: 15,
        nextScheduledSync: null,
      };
      
      await this.sendResponse(message.responseQueue, defaultResponse);
    }
  }

  private async handleSyncOperations(message: CoreServiceMessage): Promise<void> {
    try {
      const { userId, walletAddress, filters } = message.data;
      
      // Get user sync operations from database
      const operations = await this.syncProcessor.getUserSyncOperations(userId, walletAddress, filters);
      
      logger.info('Sync operations retrieved', {
        userId,
        requestId: message.requestId,
        operationsCount: operations.length,
      });

      await this.sendResponse(message.responseQueue, operations);
      
    } catch (error) {
      logger.error('Error handling sync operations request', { error });
      await this.sendResponse(message.responseQueue, []);
    }
  }

  private async handleCancelOperation(message: CoreServiceMessage): Promise<void> {
    try {
      const { operationId, userId } = message.data;
      
      // Try to cancel BullMQ job
      const job = await this.syncQueue.getJob(operationId);
      const result = {
        found: !!job,
        cancelled: false,
        previousStatus: job?.opts.attempts ? 'processing' : 'waiting',
      };
      
      if (job) {
        await job.remove();
        result.cancelled = true;
        logger.info('Sync operation cancelled', { operationId, userId });
      }

      await this.sendResponse(message.responseQueue, result);
      
    } catch (error) {
      logger.error('Error handling cancel operation request', { error });
      await this.sendResponse(message.responseQueue, {
        found: false,
        cancelled: false,
      });
    }
  }

  private async sendResponse(responseQueue: string, data: any): Promise<void> {
    try {
      await this.redis.getClient().lpush(responseQueue, JSON.stringify(data));
    } catch (error) {
      logger.error('Error sending response', { responseQueue, error });
    }
  }

  private async processSyncJob(job: Job): Promise<SyncJobResult> {
    const startTime = Date.now();
    
    try {
      const jobData = job.data as SyncJobData & { responseQueue: string };
      
      logger.info('Processing sync job', {
        jobId: job.id,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
      });

      // Process the sync job
      const result = await this.syncProcessor.processJob({
        id: job.id as string,
        data: jobData,
        priority: jobData.priority || 'medium',
      });

      // Send success response to Core Service
      const response: SyncJobResponse = {
        jobId: job.id as string,
        status: 'completed',
        result,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        metadata: {
          processingTime: Date.now() - startTime,
          bullmqJobId: job.id,
        },
      };

      await this.sendResponse(jobData.responseQueue, response);
      
      logger.info('Sync job completed', {
        jobId: job.id,
        userId: jobData.userId,
        tokensSync: result.tokensSync,
        totalValueUsd: result.totalValueUsd,
        processingTime: Date.now() - startTime,
      });

      return result;
      
    } catch (error) {
      logger.error('Error processing sync job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Send error response to Core Service
      const jobData = job.data as SyncJobData & { responseQueue: string };
      const response: SyncJobResponse = {
        jobId: job.id as string,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        metadata: {
          processingTime: Date.now() - startTime,
          bullmqJobId: job.id,
        },
      };

      await this.sendResponse(jobData.responseQueue, response);
      
      throw error;
    }
  }

  private setupWorkerEvents(): void {
    this.syncWorker.on('completed', (job) => {
      logger.debug('Job completed', { jobId: job.id });
    });

    this.syncWorker.on('failed', (job, err) => {
      logger.error('Job failed', { 
        jobId: job?.id, 
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.syncWorker.on('stalled', (jobId) => {
      logger.warn('Job stalled', { jobId });
    });

    this.syncWorker.on('error', (err) => {
      logger.error('Worker error', { error: err.message });
    });
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    const priorityMap = {
      high: 1,
      medium: 5,
      low: 10,
    };
    return priorityMap[priority];
  }

  // Health check methods
  async isHealthy(): Promise<boolean> {
    try {
      return this.isRunning && await this.redis.isHealthy();
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  async getStats(): Promise<{
    isRunning: boolean;
    queueStats: any;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  }> {
    try {
      const waiting = await this.syncQueue.getWaiting();
      const active = await this.syncQueue.getActive();
      const completed = await this.syncQueue.getCompleted();
      const failed = await this.syncQueue.getFailed();

      return {
        isRunning: this.isRunning,
        queueStats: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
        },
        activeJobs: active.length,
        completedJobs: completed.length,
        failedJobs: failed.length,
      };
    } catch (error) {
      logger.error('Error getting stats', { error });
      return {
        isRunning: false,
        queueStats: { waiting: 0, active: 0, completed: 0, failed: 0 },
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
      };
    }
  }

  // Graceful shutdown
  async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown...');
    
    try {
      // Stop accepting new jobs
      await this.syncWorker.pause();
      
      // Wait for active jobs to complete (max 30 seconds)
      const activeJobs = await this.syncQueue.getActive();
      if (activeJobs.length > 0) {
        logger.info(`Waiting for ${activeJobs.length} active jobs to complete...`);
        
        const timeout = setTimeout(() => {
          logger.warn('Shutdown timeout reached, forcing shutdown');
        }, 30000);
        
        await Promise.race([
          this.waitForJobsToComplete(),
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
        
        clearTimeout(timeout);
      }
      
      // Stop the service
      await this.stop();
      
      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      throw error;
    }
  }

  private async waitForJobsToComplete(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const activeJobs = await this.syncQueue.getActive();
        if (activeJobs.length === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }
} 