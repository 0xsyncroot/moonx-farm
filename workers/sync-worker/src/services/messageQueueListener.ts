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
      logger.error('Failed to initialize Redis connection', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Failed to start MessageQueueListener', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Error stopping MessageQueueListener', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    const pollQueue = async () => {
      if (!this.isRunning) {
        logger.debug(`Skipping queue ${queueName} - service not running`);
        return;
      }

      try {
        logger.debug(`Polling queue ${queueName}...`);
        
        // Check Redis connection first
        if (!this.redis.getClient()) {
          throw new Error('Redis client not available');
        }

        // Test Redis connection health before polling
        try {
          await this.redis.getClient().ping();
        } catch (pingError) {
          throw new Error(`Redis connection unhealthy: ${pingError instanceof Error ? pingError.message : String(pingError)}`);
        }

        // Use shorter timeout for brpop to avoid long hangs
        const result = await this.redis.getClient().brpop(queueName, 0.5); // 0.5 second timeout
        
        if (result) {
          logger.debug(`Received message from queue ${queueName}`, { 
            messageLength: result[1]?.length || 0,
            queueName 
          });
          
          let message: CoreServiceMessage;
          try {
            message = JSON.parse(result[1]);
          } catch (parseError) {
            logger.error(`Failed to parse message from queue ${queueName}`, {
              error: parseError instanceof Error ? parseError.message : String(parseError),
              rawMessage: result[1],
              queueName,
            });
            return;
          }

          // Validate message structure
          if (!message.type || !message.data || !message.responseQueue) {
            logger.error(`Invalid message structure from queue ${queueName}`, {
              messageType: message.type,
              hasData: !!message.data,
              hasResponseQueue: !!message.responseQueue,
              queueName,
            });
            return;
          }

          logger.debug(`Processing message from queue ${queueName}`, {
            messageType: message.type,
            responseQueue: message.responseQueue,
            requestId: message.requestId,
            queueName,
          });

          try {
            await handler(message);
            logger.debug(`Successfully processed message from queue ${queueName}`, {
              messageType: message.type,
              queueName,
            });
            
            // Reset error counter on successful processing
            consecutiveErrors = 0;
          } catch (handlerError) {
            logger.error(`Handler error for queue ${queueName}`, {
              error: handlerError instanceof Error ? handlerError.message : String(handlerError),
              stack: handlerError instanceof Error ? handlerError.stack : undefined,
              messageType: message.type,
              queueName,
            });
          }
        } else {
          logger.debug(`No message received from queue ${queueName} (timeout)`);
          // Reset error counter on successful poll (even if no message)
          consecutiveErrors = 0;
        }
      } catch (error) {
        consecutiveErrors++;
        
        // Determine error type for better logging
        let errorType = 'unknown';
        let delayMs = 1000;
        
        if (error instanceof Error) {
          if (error.message.includes('Connection') || error.message.includes('ECONNREFUSED')) {
            errorType = 'connection';
            delayMs = 5000; // Longer delay for connection errors
          } else if (error.message.includes('timeout') || error.message.includes('Command timed out')) {
            errorType = 'timeout';
            delayMs = 500; // Shorter delay for timeout errors
          } else if (error.message.includes('ENOTFOUND')) {
            errorType = 'dns_error';
            delayMs = 10000; // Very long delay for DNS errors
          } else if (error.message.includes('Redis') || error.message.includes('unhealthy')) {
            errorType = 'redis_error';
            delayMs = 3000; // Medium delay for Redis errors
          }
        }
        
        // Use exponential backoff for consecutive errors
        if (consecutiveErrors > 1) {
          delayMs = Math.min(delayMs * Math.pow(2, consecutiveErrors - 1), 30000); // Cap at 30 seconds
        }
        
        const logLevel = consecutiveErrors > 3 ? 'error' : 'warn';
        logger[logLevel](`Error polling queue ${queueName}`, { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          errorType,
          queueName,
          isRunning: this.isRunning,
          redisClientExists: !!this.redis.getClient(),
          consecutiveErrors,
          nextRetryDelayMs: delayMs,
        });
        
        // Stop polling if too many consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          logger.error(`Too many consecutive errors (${consecutiveErrors}) for queue ${queueName}, stopping polling`, {
            queueName,
            maxConsecutiveErrors,
          });
          return;
        }
        
        // Add delay based on error type and consecutive errors
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Continue polling
      if (this.isRunning) {
        const timeout = setTimeout(pollQueue, 100);
        this.messageListeners.set(queueName, timeout);
      }
    };

    logger.info(`Starting to listen to queue ${queueName}`);
    pollQueue();
  }

  private async handleSyncRequest(message: CoreServiceMessage): Promise<void> {
    try {
      const request: SyncJobRequest = message.data;
      
      logger.info('Received sync request', {
        jobId: request.jobId,
        userId: request.userId,
        priority: request.priority,
        responseQueue: message.responseQueue,
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

      logger.info('Sync job queued successfully', {
        jobId: request.jobId,
        bullmqJobId: job.id,
        responseQueue: message.responseQueue,
      });

      // Send immediate response with "queued" status
      const queuedResponse: SyncJobResponse = {
        jobId: request.jobId,
        status: 'queued',
        metadata: {
          bullmqJobId: job.id,
          queuedAt: new Date().toISOString(),
        },
      };

      await this.sendResponse(message.responseQueue, queuedResponse);
      
      logger.info('📤 Queued response sent to Core Service', {
        jobId: request.jobId,
        userId: request.userId,
        responseQueue: message.responseQueue,
        responseStatus: queuedResponse.status
      });
      
    } catch (error) {
      logger.error('Error handling sync request', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        jobId: message.data?.jobId,
        userId: message.data?.userId,
        responseQueue: message.responseQueue,
      });
      
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
      logger.error('Error handling sync status request', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: message.data?.userId,
        walletAddress: message.data?.walletAddress,
        responseQueue: message.responseQueue,
      });
      
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
      logger.error('Error handling sync operations request', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: message.data?.userId,
        walletAddress: message.data?.walletAddress,
        responseQueue: message.responseQueue,
      });
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
      logger.error('Error handling cancel operation request', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operationId: message.data?.operationId,
        userId: message.data?.userId,
        responseQueue: message.responseQueue,
      });
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
      logger.error('Error sending response', { 
        responseQueue, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        dataKeys: data ? Object.keys(data) : [],
      });
    }
  }

  private async processSyncJob(job: Job): Promise<SyncJobResult> {
    const startTime = Date.now();
    
    try {
      const jobData = job.data as SyncJobData & { responseQueue: string };
      
      logger.info('🎯 Received sync job from queue', {
        jobId: job.id,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        priority: jobData.priority,
        chainIds: jobData.chainIds,
        responseQueue: jobData.responseQueue,
        jobDataKeys: Object.keys(jobData)
      });

      // Process the sync job
      logger.info('🚀 Starting sync job processing', {
        jobId: job.id,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress
      });

      const result = await this.syncProcessor.processJob({
        id: job.id as string,
        data: jobData,
        priority: jobData.priority || 'medium',
      });

      logger.info('✅ Sync job processing completed', {
        jobId: job.id,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        tokensSync: result.tokensSync,
        chainsSync: result.chainsSync,
        totalValueUsd: result.totalValueUsd,
        processingTime: Date.now() - startTime
      });

      // NOTE: No response sent here - already sent "queued" response in handleSyncRequest
      // Core Service will poll status via separate endpoint if needed
      
      logger.info('🎉 Sync job completed successfully (no response sent)', {
        jobId: job.id,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        tokensSync: result.tokensSync,
        chainsSync: result.chainsSync,
        totalValueUsd: result.totalValueUsd,
        processingTime: Date.now() - startTime,
        note: 'Response already sent as queued status'
      });

      return result;
      
    } catch (error) {
      logger.error('❌ Sync job processing failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        note: 'No error response sent - already sent queued response'
      });

      // NOTE: No error response sent here either
      // Job failure will be tracked in sync_operations table
      // Core Service can check status via separate endpoint
      
      return {
        success: false,
        jobId: job.id as string,
        userId: (job.data as any).userId,
        walletAddress: (job.data as any).walletAddress,
        processingTime: Date.now() - startTime,
        tokensSync: 0,
        chainsSync: 0,
        totalValueUsd: 0,
        error: error instanceof Error ? error.message : String(error),
      };
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
      logger.error('Health check failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        isRunning: this.isRunning,
      });
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
      logger.error('Error getting stats', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Error during graceful shutdown', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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