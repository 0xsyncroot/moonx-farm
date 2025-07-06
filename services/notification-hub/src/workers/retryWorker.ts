import { createLogger } from '@moonx-farm/common';
import { BaseWorker, WorkerJob, WorkerOptions } from './baseWorker';
import { DeliveryService } from '../services/deliveryService';
import { DatabaseService } from '../services/databaseService';
import { RedisManager } from '../services/redisManager';

const logger = createLogger('RetryWorker');

export interface RetryJobPayload {
  originalNotification: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    priority: 'high' | 'medium' | 'low';
    channels: string[];
    data: any;
  };
  failedChannels: string[];
  originalError: string;
  retryReason: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt: Date;
}

export interface RetryStrategy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class RetryWorker extends BaseWorker {
  private deliveryService: DeliveryService;
  private databaseService: DatabaseService;
  private redisManager: RedisManager;
  private retryStrategies: Map<string, RetryStrategy> = new Map();

  constructor(
    deliveryService: DeliveryService,
    databaseService: DatabaseService,
    redisManager: RedisManager,
    options?: Partial<WorkerOptions>
  ) {
    super({
      name: 'RetryWorker',
      concurrency: 4,
      pollInterval: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 60000,
      deadLetterQueue: 'retry:dlq',
      ...options
    });

    this.deliveryService = deliveryService;
    this.databaseService = databaseService;
    this.redisManager = redisManager;
    
    this.setupRetryStrategies();
  }

  getQueueName(): string {
    return 'notifications:retry';
  }

  private setupRetryStrategies(): void {
    // Production-grade retry strategies
    this.retryStrategies.set('high', {
      maxAttempts: 5,
      baseDelayMs: 30000, // 30 seconds
      maxDelayMs: 300000  // 5 minutes
    });

    this.retryStrategies.set('medium', {
      maxAttempts: 3,
      baseDelayMs: 60000, // 1 minute
      maxDelayMs: 600000  // 10 minutes
    });

    this.retryStrategies.set('low', {
      maxAttempts: 2,
      baseDelayMs: 300000, // 5 minutes
      maxDelayMs: 1800000  // 30 minutes
    });

    // Channel-specific strategies
    this.retryStrategies.set('email', {
      maxAttempts: 4,
      baseDelayMs: 120000, // 2 minutes
      maxDelayMs: 1800000  // 30 minutes
    });

    this.retryStrategies.set('push', {
      maxAttempts: 3,
      baseDelayMs: 30000, // 30 seconds
      maxDelayMs: 180000  // 3 minutes
    });

    this.retryStrategies.set('websocket', {
      maxAttempts: 2,
      baseDelayMs: 5000, // 5 seconds
      maxDelayMs: 15000  // 15 seconds
    });
  }

  async processJob(job: WorkerJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      const retryData = job.payload as RetryJobPayload;
      
      // Validate retry data
      this.validateRetryData(retryData);
      
      // Check if we should process this retry now
      if (new Date() < retryData.nextRetryAt) {
        logger.info(`Retry job ${job.id} not ready yet, rescheduling`);
        await this.rescheduleRetry(retryData);
        return;
      }
      
      // Check if exceeded max attempts
      if (retryData.attemptNumber >= retryData.maxAttempts) {
        logger.warn(`Notification ${retryData.originalNotification.id} exceeded max retries`);
        await this.handleMaxRetriesExceeded(retryData);
        return;
      }
      
      // Attempt retry delivery
      const retryResult = await this.attemptRetryDelivery(retryData);
      
      if (retryResult.success) {
        logger.info(`Retry successful for notification ${retryData.originalNotification.id} after ${Date.now() - startTime}ms`);
        await this.recordSuccessfulRetry(retryData);
      } else {
        logger.warn(`Retry failed for notification ${retryData.originalNotification.id}: ${retryResult.error || 'Unknown error'}`);
        await this.handleRetryFailure(retryData, retryResult);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error processing retry job ${job.id}:`, { error: errorMessage });
      throw error;
    }
  }

  private validateRetryData(data: RetryJobPayload): void {
    if (!data.originalNotification?.id) {
      throw new Error('Original notification ID is required');
    }
    
    if (!data.failedChannels?.length) {
      throw new Error('Failed channels are required');
    }
    
    if (!data.retryReason) {
      throw new Error('Retry reason is required');
    }
  }

  private async attemptRetryDelivery(retryData: RetryJobPayload): Promise<{
    success: boolean;
    error?: string;
    successfulChannels: string[];
    stillFailedChannels: string[];
  }> {
    try {
      // Create notification object for retry
      const retryNotification = {
        ...retryData.originalNotification,
        channels: retryData.failedChannels,
        metadata: {
          createdAt: new Date(),
          scheduledAt: new Date(),
          attempts: retryData.attemptNumber,
          isRetry: true,
          originalFailure: retryData.originalError
        }
      };
      
      // Attempt delivery
      const deliveryResults = await this.deliveryService.deliverNotification(retryNotification);
      
      // Analyze results
      const successfulChannels = deliveryResults.filter(r => r.success).map(r => r.channel);
      const stillFailedChannels = deliveryResults.filter(r => !r.success).map(r => r.channel);
      
      const allSuccessful = stillFailedChannels.length === 0;
      
      return {
        success: allSuccessful,
        ...(allSuccessful ? {} : { error: `Failed channels: ${stillFailedChannels.join(', ')}` }),
        successfulChannels,
        stillFailedChannels
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during retry delivery:', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
        successfulChannels: [],
        stillFailedChannels: retryData.failedChannels
      };
    }
  }

  private async recordSuccessfulRetry(retryData: RetryJobPayload): Promise<void> {
    try {
      // Update notification status in database
      await this.databaseService.updateNotificationStatus(
        retryData.originalNotification.id, 
        'delivered'
      );

      // Log successful delivery for each channel
      for (const channel of retryData.failedChannels) {
        await this.databaseService.updateDeliveryLog({
          notificationId: retryData.originalNotification.id,
          channel,
          deliveryStatus: 'delivered',
          attemptCount: retryData.attemptNumber
        });
      }

      logger.info(`Retry successful for notification ${retryData.originalNotification.id} after ${retryData.attemptNumber} attempts`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error recording successful retry:', { error: errorMessage });
    }
  }

  private async handleRetryFailure(retryData: RetryJobPayload, result: any): Promise<void> {
    try {
      // Log failed delivery attempts to database
      for (const channel of result.stillFailedChannels) {
        await this.databaseService.updateDeliveryLog({
          notificationId: retryData.originalNotification.id,
          channel,
          deliveryStatus: 'failed',
          attemptCount: retryData.attemptNumber,
          providerResponse: { error: result.error }
        });
      }

      const nextAttempt = retryData.attemptNumber + 1;
      
      if (nextAttempt >= retryData.maxAttempts) {
        await this.handleMaxRetriesExceeded(retryData);
        return;
      }
      
      // Update notification status to retrying
      await this.databaseService.updateNotificationStatus(
        retryData.originalNotification.id, 
        'retrying'
      );

      // Calculate next retry delay with exponential backoff
      const strategy = this.getRetryStrategy(retryData.originalNotification.priority);
      const nextRetryDelay = this.calculateRetryDelayWithStrategy(nextAttempt, strategy);
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);
      
      // Update retry data for next attempt
      const updatedRetryData: RetryJobPayload = {
        ...retryData,
        failedChannels: result.stillFailedChannels.length > 0 ? result.stillFailedChannels : retryData.failedChannels,
        originalError: result.error || retryData.originalError,
        attemptNumber: nextAttempt,
        nextRetryAt
      };
      
      // Schedule next retry
      logger.info(`Scheduling next retry for notification ${retryData.originalNotification.id} in ${nextRetryDelay}ms (attempt ${nextAttempt}/${retryData.maxAttempts})`);
      await this.scheduleNextRetry(updatedRetryData);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error handling retry failure:', { error: errorMessage });
      await this.handleMaxRetriesExceeded(retryData);
    }
  }

  private getRetryStrategy(priority: 'high' | 'medium' | 'low'): RetryStrategy {
    return this.retryStrategies.get(priority) || this.retryStrategies.get('medium')!;
  }

  private calculateRetryDelayWithStrategy(attempt: number, strategy: RetryStrategy): number {
    // Simple exponential backoff
    const exponentialDelay = strategy.baseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(exponentialDelay, strategy.maxDelayMs);
  }

  private async scheduleNextRetry(retryData: RetryJobPayload): Promise<void> {
    try {
      // Add to retry queue with delay
      await this.redisManager.addToRetryQueue(retryData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error scheduling next retry:', { error: errorMessage });
      throw error;
    }
  }

  private async rescheduleRetry(retryData: RetryJobPayload): Promise<void> {
    try {
      await this.redisManager.addToRetryQueue(retryData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error rescheduling retry:', { error: errorMessage });
      throw error;
    }
  }

  private async handleMaxRetriesExceeded(retryData: RetryJobPayload): Promise<void> {
    try {
      // Update notification status to permanently failed
      await this.databaseService.updateNotificationStatus(
        retryData.originalNotification.id, 
        'failed_permanent'
      );

      // Log final failure for each channel
      for (const channel of retryData.failedChannels) {
        await this.databaseService.updateDeliveryLog({
          notificationId: retryData.originalNotification.id,
          channel,
          deliveryStatus: 'failed_permanent',
          attemptCount: retryData.attemptNumber,
          providerResponse: { 
            error: retryData.originalError,
            reason: 'Max retries exceeded'
          }
        });
      }

      logger.error(`Max retries exceeded for notification ${retryData.originalNotification.id}`, {
        attempts: retryData.attemptNumber,
        maxAttempts: retryData.maxAttempts,
        failedChannels: retryData.failedChannels,
        originalError: retryData.originalError
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error handling max retries exceeded:', { error: errorMessage });
    }
  }

  // Public methods for retry management
  async addRetryJob(
    originalNotification: RetryJobPayload['originalNotification'],
    failedChannels: string[],
    originalError: string,
    retryReason: string = 'delivery_failure'
  ): Promise<void> {
    const priority = originalNotification.priority;
    const strategy = this.getRetryStrategy(priority);
    
    const nextRetryDelay = this.calculateRetryDelayWithStrategy(1, strategy);
    const nextRetryAt = new Date(Date.now() + nextRetryDelay);
    
    const retryData: RetryJobPayload = {
      originalNotification,
      failedChannels,
      originalError,
      retryReason,
      attemptNumber: 1,
      maxAttempts: strategy.maxAttempts,
      nextRetryAt
    };
    
    await this.addJob({
      type: 'retry_notification',
      payload: retryData,
      priority: originalNotification.priority,
      maxAttempts: 2
    });
    
    logger.info(`Added retry job for notification ${originalNotification.id}, next retry at ${nextRetryAt.toISOString()}`);
  }

  async getRetryStats(): Promise<{
    activeRetries: number;
    pendingRetries: number;
    successfulRetries: number;
    failedRetries: number;
    totalRetryAttempts: number;
    avgRetryTime: number;
  }> {
    try {
      // Get stats from database
      const stats = await this.databaseService.getNotificationStats('24h');
      
      // Get additional retry-specific stats using existing methods
      const retryData = {
        active_retries: 0,
        failed_retries: 0,
        successful_retries: 0,
        total_retry_attempts: 0,
        avg_retry_time: 0
      };

      // TODO: Add specialized methods to DatabaseService for retry stats
      // For now, use basic stats from existing method

      return {
        activeRetries: retryData.active_retries || 0,
        pendingRetries: 0, // TODO: Get from Redis queue
        successfulRetries: retryData.successful_retries || 0,
        failedRetries: retryData.failed_retries || 0,
        totalRetryAttempts: retryData.total_retry_attempts || 0,
        avgRetryTime: retryData.avg_retry_time || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting retry stats:', { error: errorMessage });
      return {
        activeRetries: 0,
        pendingRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        totalRetryAttempts: 0,
        avgRetryTime: 0
      };
    }
  }

  async getRetryHistory(notificationId: string): Promise<any[]> {
    try {
      // TODO: Add method to DatabaseService for retry history
      // For now, return empty array - to be implemented with proper DatabaseService method
      logger.info(`Getting retry history for notification ${notificationId}`);
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting retry history:', { error: errorMessage });
      return [];
    }
  }

  async cleanupOldRetryData(daysOld: number = 30): Promise<number> {
    try {
      // TODO: Add method to DatabaseService for cleanup
      // For now, return 0 - to be implemented with proper DatabaseService method
      logger.info(`Cleaning up retry data older than ${daysOld} days`);
      return 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error cleaning up old retry data:', { error: errorMessage });
      return 0;
    }
  }
} 