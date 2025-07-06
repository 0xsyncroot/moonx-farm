import { createLogger } from '@moonx-farm/common';
import { BaseWorker, WorkerJob, WorkerOptions } from './baseWorker';
import { DeliveryService } from '../services/deliveryService';
import { DatabaseService } from '../services/databaseService';
import { redisService } from '../services/redisService';

const logger = createLogger('BatchWorker');

export interface BatchNotificationJob {
  type: 'email_campaign' | 'push_broadcast' | 'system_announcement' | 'user_segment';
  title: string;
  body: string;
  template?: string;
  templateData?: any;
  targetUsers?: string[];
  segmentCriteria?: {
    userTypes?: string[];
    regions?: string[];
    activitySince?: Date;
    balanceMin?: number;
    balanceMax?: number;
    tags?: string[];
  };
  channels: string[];
  priority: 'high' | 'medium' | 'low';
  batchSize: number;
  rateLimitPerSecond?: number;
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface BatchProcessingResult {
  totalUsers: number;
  totalBatches: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  processingTime: number;
  errors: string[];
}

export class BatchWorker extends BaseWorker {
  private deliveryService: DeliveryService;
  private databaseService: DatabaseService;

  constructor(
    deliveryService: DeliveryService,
    databaseService: DatabaseService,
    options?: Partial<WorkerOptions>
  ) {
    super({
      name: 'BatchWorker',
      concurrency: 2, // Lower concurrency for batch jobs
      pollInterval: 5000, // Check every 5 seconds
      maxRetries: 2,
      retryDelay: 30000, // 30 seconds base delay
      deadLetterQueue: 'batch:dlq',
      ...options
    });

    this.deliveryService = deliveryService;
    this.databaseService = databaseService;
  }

  getQueueName(): string {
    return 'notifications:batch';
  }

  async processJob(job: WorkerJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      const batchData = job.payload as BatchNotificationJob;
      
      // Validate batch data
      this.validateBatchData(batchData);
      
      // Check if batch has expired
      if (batchData.expiresAt && new Date() > batchData.expiresAt) {
        logger.warn(`Batch job ${job.id} has expired, skipping`);
        return;
      }
      
      // Check if batch should be scheduled for later
      if (batchData.scheduledAt && new Date() < batchData.scheduledAt) {
        logger.info(`Batch job ${job.id} scheduled for later, rescheduling`);
        await this.rescheduleJob(job, batchData.scheduledAt);
        return;
      }
      
      // Get target users
      const targetUsers = await this.getTargetUsers(batchData);
      
      if (targetUsers.length === 0) {
        logger.warn(`No target users found for batch job ${job.id}`);
        return;
      }
      
      // Process batch
      const result = await this.processBatch(job, batchData, targetUsers);
      
      // Log results
      const processingTime = Date.now() - startTime;
      logger.info(`Batch job ${job.id} completed in ${processingTime}ms: ${result.successful}/${result.totalUsers} successful`);
      
      // Update job status
      await this.updateBatchStatus(job.id, result);
      
    } catch (error) {
      logger.error(`Error processing batch job ${job.id}: ${error}`);
      throw error;
    }
  }

  private validateBatchData(data: BatchNotificationJob): void {
    if (!data.type) {
      throw new Error('Batch type is required');
    }
    
    if (!data.title) {
      throw new Error('Title is required');
    }
    
    if (!data.body) {
      throw new Error('Body is required');
    }
    
    if (!data.channels || data.channels.length === 0) {
      throw new Error('At least one channel is required');
    }
    
    if (!data.batchSize || data.batchSize <= 0) {
      throw new Error('Valid batch size is required');
    }
    
    if (data.batchSize > 1000) {
      throw new Error('Batch size cannot exceed 1000');
    }
    
    if (!['high', 'medium', 'low'].includes(data.priority)) {
      throw new Error('Invalid priority level');
    }
  }

  private async getTargetUsers(batchData: BatchNotificationJob): Promise<string[]> {
    try {
      // If specific users are provided, use them
      if (batchData.targetUsers && batchData.targetUsers.length > 0) {
        return batchData.targetUsers;
      }
      
      // Otherwise, get users based on segment criteria
      if (batchData.segmentCriteria) {
        return await this.getUsersBySegment(batchData.segmentCriteria);
      }
      
      // Default to all active users
      const users = await this.databaseService.getUsersByFilters({ active: true });
      return users.map(user => user.user_id);
      
    } catch (error) {
      logger.error(`Error getting target users: ${error}`);
      throw error;
    }
  }

  private async getUsersBySegment(criteria: NonNullable<BatchNotificationJob['segmentCriteria']>): Promise<string[]> {
    try {
      const filters: any = { active: true };
      
      if (criteria.userTypes && criteria.userTypes.length > 0) {
        filters.userType = criteria.userTypes;
      }
      
      if (criteria.regions && criteria.regions.length > 0) {
        filters.region = criteria.regions;
      }
      
      if (criteria.activitySince) {
        filters.lastActiveAfter = criteria.activitySince;
      }
      
      if (criteria.balanceMin !== undefined) {
        filters.balanceMin = criteria.balanceMin;
      }
      
      if (criteria.balanceMax !== undefined) {
        filters.balanceMax = criteria.balanceMax;
      }
      
      if (criteria.tags && criteria.tags.length > 0) {
        filters.tags = criteria.tags;
      }
      
      const users = await this.databaseService.getUsersByFilters(filters);
      return users.map(user => user.user_id);
      
    } catch (error) {
      logger.error(`Error getting users by segment: ${error}`);
      throw error;
    }
  }

  private async processBatch(
    job: WorkerJob,
    batchData: BatchNotificationJob,
    targetUsers: string[]
  ): Promise<BatchProcessingResult> {
    const result: BatchProcessingResult = {
      totalUsers: targetUsers.length,
      totalBatches: Math.ceil(targetUsers.length / batchData.batchSize),
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      processingTime: 0,
      errors: []
    };
    
    const startTime = Date.now();
    
    try {
      // Process users in batches
      for (let i = 0; i < targetUsers.length; i += batchData.batchSize) {
        const batch = targetUsers.slice(i, i + batchData.batchSize);
        const batchNumber = Math.floor(i / batchData.batchSize) + 1;
        
        logger.info(`Processing batch ${batchNumber}/${result.totalBatches} (${batch.length} users)`);
        
        // Process batch
        const batchResult = await this.processBatchChunk(job, batchData, batch, batchNumber);
        
        // Update totals
        result.processed += batchResult.processed;
        result.successful += batchResult.successful;
        result.failed += batchResult.failed;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
        
                 // Rate limiting
         if (batchData.rateLimitPerSecond && batchData.rateLimitPerSecond > 0) {
           const delayMs = Math.ceil(1000 / batchData.rateLimitPerSecond);
           await new Promise(resolve => setTimeout(resolve, delayMs));
         }
        
        // Update progress
        await this.updateBatchProgress(job.id, {
          batchNumber,
          totalBatches: result.totalBatches,
          processed: result.processed,
          successful: result.successful,
          failed: result.failed
        });
      }
      
      result.processingTime = Date.now() - startTime;
      return result;
      
    } catch (error) {
      logger.error(`Error processing batch: ${error}`);
      result.errors.push(`Batch processing failed: ${error}`);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  private async processBatchChunk(
    job: WorkerJob,
    batchData: BatchNotificationJob,
    userIds: string[],
    batchNumber: number
  ): Promise<{ processed: number; successful: number; failed: number; skipped: number; errors: string[] }> {
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    try {
      // Create notifications for each user in batch
      const notifications = userIds.map(userId => ({
        id: `${job.id}-${batchNumber}-${userId}`,
        userId,
        type: batchData.type,
        title: batchData.title,
        body: batchData.body,
        priority: batchData.priority,
        channels: batchData.channels,
        data: {
          template: batchData.template,
          templateData: batchData.templateData,
          batchId: job.id,
          batchNumber,
          ...batchData.templateData
        },
        metadata: {
          createdAt: new Date(),
          scheduledAt: batchData.scheduledAt || new Date(),
          attempts: 0
        }
      }));
      
      // Process notifications in parallel (but limited concurrency)
      const concurrency = Math.min(5, notifications.length);
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.processNotificationChunk(notifications, i, concurrency, result));
      }
      
      await Promise.all(promises);
      
      return result;
      
    } catch (error) {
      logger.error(`Error processing batch chunk: ${error}`);
      result.errors.push(`Batch chunk processing failed: ${error}`);
      return result;
    }
  }

  private async processNotificationChunk(
    notifications: any[],
    startIndex: number,
    step: number,
    result: { processed: number; successful: number; failed: number; skipped: number; errors: string[] }
  ): Promise<void> {
    for (let i = startIndex; i < notifications.length; i += step) {
      const notification = notifications[i];
      
      try {
        result.processed++;
        
        // Deliver notification
        const deliveryResults = await this.deliveryService.deliverNotification(notification);
        
        // Check if all deliveries were successful
        const allSuccessful = deliveryResults.every(r => r.success);
        
        if (allSuccessful) {
          result.successful++;
        } else {
          result.failed++;
          const failedChannels = deliveryResults.filter(r => !r.success).map(r => r.channel);
          result.errors.push(`Notification ${notification.id} failed on channels: ${failedChannels.join(', ')}`);
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push(`Notification ${notification.id} failed: ${error}`);
      }
    }
  }

  private async rescheduleJob(job: WorkerJob, scheduleFor: Date): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const scheduledTime = scheduleFor.getTime();
      
      await redis.command('ZADD', 'notifications:scheduled', scheduledTime, JSON.stringify(job));
      
    } catch (error) {
      logger.error(`Error rescheduling batch job ${job.id}: ${error}`);
      throw error;
    }
  }

  private async updateBatchStatus(jobId: string, result: BatchProcessingResult): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const statusKey = `batch:status:${jobId}`;
      
      await redis.command('HSET', statusKey, 
        'totalUsers', result.totalUsers.toString(),
        'totalBatches', result.totalBatches.toString(),
        'processed', result.processed.toString(),
        'successful', result.successful.toString(),
        'failed', result.failed.toString(),
        'skipped', result.skipped.toString(),
        'processingTime', result.processingTime.toString(),
        'completedAt', new Date().toISOString(),
        'errors', JSON.stringify(result.errors)
      );
      
      // Set expiration for status (24 hours)
      await redis.command('EXPIRE', statusKey, 86400);
      
    } catch (error) {
      logger.error(`Error updating batch status: ${error}`);
    }
  }

  private async updateBatchProgress(jobId: string, progress: any): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const progressKey = `batch:progress:${jobId}`;
      
      await redis.command('HSET', progressKey,
        'batchNumber', progress.batchNumber.toString(),
        'totalBatches', progress.totalBatches.toString(),
        'processed', progress.processed.toString(),
        'successful', progress.successful.toString(),
        'failed', progress.failed.toString(),
        'updatedAt', new Date().toISOString()
      );
      
      // Set expiration for progress (1 hour)
      await redis.command('EXPIRE', progressKey, 3600);
      
    } catch (error) {
      logger.error(`Error updating batch progress: ${error}`);
    }
  }

  // Note: sleep method is inherited from BaseWorker

  // Public methods for batch job management
  async addEmailCampaign(campaign: {
    title: string;
    body: string;
    template?: string;
    templateData?: any;
    targetUsers?: string[];
    segmentCriteria?: BatchNotificationJob['segmentCriteria'];
    batchSize?: number;
    rateLimitPerSecond?: number;
    scheduledAt?: Date;
  }): Promise<void> {
    await this.addJob({
      type: 'batch_notification',
      payload: {
        type: 'email_campaign',
        title: campaign.title,
        body: campaign.body,
        template: campaign.template,
        templateData: campaign.templateData,
        targetUsers: campaign.targetUsers,
        segmentCriteria: campaign.segmentCriteria,
        channels: ['email'],
        priority: 'low',
        batchSize: campaign.batchSize || 100,
        rateLimitPerSecond: campaign.rateLimitPerSecond || 10,
        scheduledAt: campaign.scheduledAt
      },
      priority: 'low',
      maxAttempts: 2
    });
  }

  async addPushBroadcast(broadcast: {
    title: string;
    body: string;
    targetUsers?: string[];
    segmentCriteria?: BatchNotificationJob['segmentCriteria'];
    batchSize?: number;
    rateLimitPerSecond?: number;
    scheduledAt?: Date;
  }): Promise<void> {
    await this.addJob({
      type: 'batch_notification',
      payload: {
        type: 'push_broadcast',
        title: broadcast.title,
        body: broadcast.body,
        targetUsers: broadcast.targetUsers,
        segmentCriteria: broadcast.segmentCriteria,
        channels: ['push'],
        priority: 'medium',
        batchSize: broadcast.batchSize || 200,
        rateLimitPerSecond: broadcast.rateLimitPerSecond || 20,
        scheduledAt: broadcast.scheduledAt
      },
      priority: 'medium',
      maxAttempts: 2
    });
  }

  async addSystemAnnouncement(announcement: {
    title: string;
    body: string;
    channels?: string[];
    priority?: 'high' | 'medium' | 'low';
    batchSize?: number;
    scheduledAt?: Date;
  }): Promise<void> {
    await this.addJob({
      type: 'batch_notification',
      payload: {
        type: 'system_announcement',
        title: announcement.title,
        body: announcement.body,
        channels: announcement.channels || ['websocket', 'push'],
        priority: announcement.priority || 'high',
        batchSize: announcement.batchSize || 500,
        rateLimitPerSecond: 50,
        scheduledAt: announcement.scheduledAt
      },
      priority: announcement.priority || 'high',
      maxAttempts: 3
    });
  }

  // Queue management methods
  async getBatchQueueStats(): Promise<{
    waiting: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const redis = redisService.getRedis();
      
      const [waiting, failed] = await Promise.all([
        redis.command('LLEN', 'notifications:batch'),
        redis.command('LLEN', 'batch:dlq')
      ]);
      
      return {
        waiting: waiting as number,
        processing: this.activeJobCount,
        completed: 0, // TODO: Implement completed tracking
        failed: failed as number
      };
    } catch (error) {
      logger.error(`Error getting batch queue stats: ${error}`);
      return { waiting: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  async getBatchStatus(jobId: string): Promise<BatchProcessingResult | null> {
    try {
      const redis = redisService.getRedis();
      const statusKey = `batch:status:${jobId}`;
      
      const status = await redis.command('HGETALL', statusKey);
      
      if (status && typeof status === 'object' && Object.keys(status).length > 0) {
        return {
          totalUsers: parseInt(status['totalUsers'] || '0'),
          totalBatches: parseInt(status['totalBatches'] || '0'),
          processed: parseInt(status['processed'] || '0'),
          successful: parseInt(status['successful'] || '0'),
          failed: parseInt(status['failed'] || '0'),
          skipped: parseInt(status['skipped'] || '0'),
          processingTime: parseInt(status['processingTime'] || '0'),
          errors: JSON.parse(status['errors'] || '[]')
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting batch status: ${error}`);
      return null;
    }
  }

  async getBatchProgress(jobId: string): Promise<any> {
    try {
      const redis = redisService.getRedis();
      const progressKey = `batch:progress:${jobId}`;
      
      const progress = await redis.command('HGETALL', progressKey);
      
      if (progress && typeof progress === 'object' && Object.keys(progress).length > 0) {
        return {
          batchNumber: parseInt(progress['batchNumber'] || '0'),
          totalBatches: parseInt(progress['totalBatches'] || '0'),
          processed: parseInt(progress['processed'] || '0'),
          successful: parseInt(progress['successful'] || '0'),
          failed: parseInt(progress['failed'] || '0'),
          updatedAt: progress['updatedAt']
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting batch progress: ${error}`);
      return null;
    }
  }
} 