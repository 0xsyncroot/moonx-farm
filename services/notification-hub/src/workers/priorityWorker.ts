import { createLogger } from '@moonx-farm/common';
import { BaseWorker, WorkerJob, WorkerOptions } from './baseWorker';
import { DeliveryService } from '../services/deliveryService';
import { NotificationProcessor } from '../services/notificationProcessor';
import { redisService } from '../services/redisService';

const logger = createLogger('PriorityWorker');

export interface PriorityNotificationJob {
  userId: string;
  type: string;
  title: string;
  body: string;
  channels: string[];
  data: any;
  priority: 'high' | 'medium' | 'low';
  expiresAt?: Date;
  scheduleFor?: Date;
}

export class PriorityWorker extends BaseWorker {
  private deliveryService: DeliveryService;
  private notificationProcessor: NotificationProcessor;

  constructor(
    deliveryService: DeliveryService,
    notificationProcessor: NotificationProcessor,
    options?: Partial<WorkerOptions>
  ) {
    super({
      name: 'PriorityWorker',
      concurrency: 8, // High concurrency for urgent notifications
      pollInterval: 100, // Check every 100ms
      maxRetries: 3,
      retryDelay: 1000, // 1 second base delay
      deadLetterQueue: 'priority:dlq',
      ...options
    });

    this.deliveryService = deliveryService;
    this.notificationProcessor = notificationProcessor;
  }

  getQueueName(): string {
    return 'notifications:priority';
  }

  async processJob(job: WorkerJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      const notificationData = job.payload as PriorityNotificationJob;
      
      // Validate notification data
      this.validateNotificationData(notificationData);
      
      // Check if notification has expired
      if (notificationData.expiresAt && new Date() > notificationData.expiresAt) {
        logger.warn(`Notification ${job.id} has expired, skipping`);
        return;
      }
      
      // Check if notification should be scheduled for later
      if (notificationData.scheduleFor && new Date() < notificationData.scheduleFor) {
        logger.info(`Notification ${job.id} scheduled for later, rescheduling`);
        await this.rescheduleJob(job, notificationData.scheduleFor);
        return;
      }
      
      // Process notification through notification processor
      const processedNotification: any = {
        id: job.id,
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        body: notificationData.body,
        priority: notificationData.priority,
        channels: notificationData.channels,
        data: notificationData.data,
        metadata: {
          createdAt: job.createdAt,
          scheduledAt: job.scheduledAt || new Date(),
          attempts: job.attempts
        }
      };
      
      // TODO: Use proper notification processor method
      // const processedNotification = await this.notificationProcessor.processNotification(...);
      
      // Deliver notification
      const deliveryResults = await this.deliveryService.deliverNotification(processedNotification);
      
      // Log delivery results
      const processingTime = Date.now() - startTime;
      const successfulDeliveries = deliveryResults.filter(r => r.success).length;
      const failedDeliveries = deliveryResults.filter(r => !r.success).length;
      
      logger.info(`Priority notification ${job.id} processed in ${processingTime}ms: ${successfulDeliveries} successful, ${failedDeliveries} failed`);
      
      // Handle partial failures
      if (failedDeliveries > 0) {
        await this.handlePartialFailure(job, deliveryResults, notificationData);
      }
      
    } catch (error) {
      logger.error(`Error processing priority notification ${job.id}: ${error}`);
      throw error;
    }
  }

  private validateNotificationData(data: PriorityNotificationJob): void {
    if (!data.userId) {
      throw new Error('userId is required');
    }
    
    if (!data.type) {
      throw new Error('type is required');
    }
    
    if (!data.title) {
      throw new Error('title is required');
    }
    
    if (!data.body) {
      throw new Error('body is required');
    }
    
    if (!data.channels || data.channels.length === 0) {
      throw new Error('At least one channel is required');
    }
    
    if (!['high', 'medium', 'low'].includes(data.priority)) {
      throw new Error('Invalid priority level');
    }
  }

  private async rescheduleJob(job: WorkerJob, scheduleFor: Date): Promise<void> {
    try {
      // Add job to scheduled queue
      const scheduledJob = {
        ...job,
        scheduledAt: scheduleFor,
        metadata: {
          ...job.metadata,
          rescheduledAt: new Date(),
          rescheduledFrom: 'priority-worker'
        }
      };
      
      await this.addJobToScheduledQueue(scheduledJob);
      
    } catch (error) {
      logger.error(`Error rescheduling job ${job.id}: ${error}`);
      throw error;
    }
  }

  private async addJobToScheduledQueue(job: WorkerJob): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const scheduledTime = job.scheduledAt?.getTime() || Date.now();
      
      await redis.command('ZADD', 'notifications:scheduled', scheduledTime, JSON.stringify(job));
      
    } catch (error) {
      logger.error(`Error adding job to scheduled queue: ${error}`);
      throw error;
    }
  }

  private async handlePartialFailure(
    job: WorkerJob,
    deliveryResults: any[],
    notificationData: PriorityNotificationJob
  ): Promise<void> {
    try {
      const failedChannels = deliveryResults
        .filter(r => !r.success)
        .map(r => r.channel);
      
      if (failedChannels.length > 0) {
        logger.warn(`Partial failure for notification ${job.id}, failed channels: ${failedChannels.join(', ')}`);
        
        // For priority notifications, we might want to retry failed channels
        if (job.attempts < 3) {
          const retryJob = {
            ...job,
            payload: {
              ...notificationData,
              channels: failedChannels
            },
            metadata: {
              ...job.metadata,
              retryReason: 'partial_failure',
              originalChannels: notificationData.channels,
              failedChannels: failedChannels
            }
          };
          
          await this.addJob(retryJob);
        }
      }
      
    } catch (error) {
      logger.error(`Error handling partial failure for job ${job.id}: ${error}`);
    }
  }

  // Static factory method
  static create(
    deliveryService: DeliveryService,
    notificationProcessor: NotificationProcessor,
    options?: Partial<WorkerOptions>
  ): PriorityWorker {
    return new PriorityWorker(deliveryService, notificationProcessor, options);
  }

  // Helper methods for adding priority jobs
  async addHighPriorityJob(notification: PriorityNotificationJob): Promise<void> {
    await this.addJob({
      type: 'priority_notification',
      payload: { ...notification, priority: 'high' },
      priority: 'high',
      maxAttempts: 3
    });
  }

  async addMediumPriorityJob(notification: PriorityNotificationJob): Promise<void> {
    await this.addJob({
      type: 'priority_notification',
      payload: { ...notification, priority: 'medium' },
      priority: 'medium',
      maxAttempts: 3
    });
  }

  async addLowPriorityJob(notification: PriorityNotificationJob): Promise<void> {
    await this.addJob({
      type: 'priority_notification',
      payload: { ...notification, priority: 'low' },
      priority: 'low',
      maxAttempts: 2
    });
  }

  // Queue management methods
  async getPriorityQueueStats(): Promise<{
    high: number;
    medium: number;
    low: number;
    scheduled: number;
    failed: number;
  }> {
    try {
      const redis = redisService.getRedis();
      
      const [high, medium, low, scheduled, failed] = await Promise.all([
        redis.command('LLEN', 'notifications:priority:high'),
        redis.command('LLEN', 'notifications:priority:medium'),
        redis.command('LLEN', 'notifications:priority:low'),
        redis.command('ZCARD', 'notifications:scheduled'),
        redis.command('LLEN', 'priority:dlq')
      ]);
      
      return {
        high: high as number,
        medium: medium as number,
        low: low as number,
        scheduled: scheduled as number,
        failed: failed as number
      };
    } catch (error) {
      logger.error(`Error getting priority queue stats: ${error}`);
      return { high: 0, medium: 0, low: 0, scheduled: 0, failed: 0 };
    }
  }

  async clearFailedJobs(): Promise<number> {
    try {
      const redis = redisService.getRedis();
      return await redis.command('DEL', 'priority:dlq') as number;
    } catch (error) {
      logger.error(`Error clearing failed jobs: ${error}`);
      return 0;
    }
  }

  async retryFailedJobs(limit: number = 10): Promise<number> {
    try {
      const redis = redisService.getRedis();
      const failedJobs = await redis.command('LRANGE', 'priority:dlq', 0, limit - 1);
      
      if (Array.isArray(failedJobs)) {
        let retryCoun = 0;
        
        for (const jobData of failedJobs) {
          try {
            const job = JSON.parse(jobData as string);
            
            // Reset attempts and move back to main queue
            job.attempts = 0;
            job.lastAttempt = undefined;
            
            await this.addJob(job);
            await redis.command('LPOP', 'priority:dlq');
            retryCoun++;
          } catch (error) {
            logger.error(`Error retrying failed job: ${error}`);
          }
        }
        
        return retryCoun;
      }
      
      return 0;
    } catch (error) {
      logger.error(`Error retrying failed jobs: ${error}`);
      return 0;
    }
  }
} 