import { createLogger } from '@moonx-farm/common';
import { redisService } from './redisService';
import { DatabaseService } from './databaseService';
import { PriorityWorker } from '../workers/priorityWorker';
import { BatchWorker } from '../workers/batchWorker';
import { RetryWorker } from '../workers/retryWorker';

const logger = createLogger('SchedulerService');

export interface ScheduledNotification {
  id: string;
  type: 'single' | 'batch' | 'recurring';
  scheduledAt: Date;
  notification: {
    userId?: string;
    title: string;
    body: string;
    type: string;
    priority: 'high' | 'medium' | 'low';
    channels: string[];
    data: any;
  };
     batchData?: {
     targetUsers?: string[];
     segmentCriteria?: any;
     batchSize: number;
     rateLimitPerSecond?: number;
   };
  recurringData?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number; // for custom patterns
    endDate?: Date;
    maxOccurrences?: number;
    currentOccurrence: number;
  };
  createdAt: Date;
  createdBy: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  metadata?: any;
}

export interface SchedulerStats {
  totalScheduled: number;
  pendingScheduled: number;
  processingScheduled: number;
  completedScheduled: number;
  failedScheduled: number;
  upcomingIn1Hour: number;
  upcomingIn24Hours: number;
  overdue: number;
}

export class SchedulerService {
  private databaseService: DatabaseService;
  private priorityWorker: PriorityWorker;
  private batchWorker: BatchWorker;
  private retryWorker: RetryWorker;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    databaseService: DatabaseService,
    priorityWorker: PriorityWorker,
    batchWorker: BatchWorker,
    retryWorker: RetryWorker
  ) {
    this.databaseService = databaseService;
    this.priorityWorker = priorityWorker;
    this.batchWorker = batchWorker;
    this.retryWorker = retryWorker;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('SchedulerService is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting SchedulerService...');

    // Process scheduled notifications every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processScheduledNotifications().catch(error => {
        logger.error(`Error processing scheduled notifications: ${error}`);
      });
    }, 30000);

    // Process immediately on start
    await this.processScheduledNotifications();

    logger.info('SchedulerService started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping SchedulerService...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('SchedulerService stopped');
  }

  async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const scheduledNotification: ScheduledNotification = {
        id: this.generateNotificationId(),
        createdAt: new Date(),
        status: 'pending',
        ...notification
      };

      // Validate scheduled notification
      this.validateScheduledNotification(scheduledNotification);

      // Store in Redis sorted set for efficient time-based retrieval
      await this.storeScheduledNotification(scheduledNotification);

      // Store in database for persistence and management
      await this.persistScheduledNotification(scheduledNotification);

      logger.info(`Scheduled notification ${scheduledNotification.id} for ${scheduledNotification.scheduledAt.toISOString()}`);

      return scheduledNotification.id;

    } catch (error) {
      logger.error(`Error scheduling notification: ${error}`);
      throw error;
    }
  }

  async scheduleRecurringNotification(
    notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status' | 'type'>,
    recurringConfig: {
      pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
      interval?: number;
      endDate?: Date;
      maxOccurrences?: number;
    }
  ): Promise<string> {
    try {
      const scheduledNotification: ScheduledNotification = {
        id: this.generateNotificationId(),
        type: 'recurring',
        createdAt: new Date(),
        status: 'pending',
        recurringData: {
          ...recurringConfig,
          currentOccurrence: 0
        },
        ...notification
      };

      await this.storeScheduledNotification(scheduledNotification);
      await this.persistScheduledNotification(scheduledNotification);

      logger.info(`Scheduled recurring notification ${scheduledNotification.id} with pattern ${recurringConfig.pattern}`);

      return scheduledNotification.id;

    } catch (error) {
      logger.error(`Error scheduling recurring notification: ${error}`);
      throw error;
    }
  }

  async scheduleBatchNotification(
    notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status' | 'type'>,
    batchConfig: {
      targetUsers?: string[];
      segmentCriteria?: any;
      batchSize: number;
      rateLimitPerSecond?: number;
    }
  ): Promise<string> {
    try {
      const scheduledNotification: ScheduledNotification = {
        id: this.generateNotificationId(),
        type: 'batch',
        createdAt: new Date(),
        status: 'pending',
        batchData: batchConfig,
        ...notification
      };

      await this.storeScheduledNotification(scheduledNotification);
      await this.persistScheduledNotification(scheduledNotification);

      logger.info(`Scheduled batch notification ${scheduledNotification.id} for ${batchConfig.targetUsers?.length || 'segmented'} users`);

      return scheduledNotification.id;

    } catch (error) {
      logger.error(`Error scheduling batch notification: ${error}`);
      throw error;
    }
  }

  async cancelScheduledNotification(notificationId: string): Promise<boolean> {
    try {
      // Remove from Redis
      await this.removeScheduledNotification(notificationId);

      // Update status in database
      await this.updateNotificationStatus(notificationId, 'cancelled');

      logger.info(`Cancelled scheduled notification ${notificationId}`);
      return true;

    } catch (error) {
      logger.error(`Error cancelling scheduled notification ${notificationId}: ${error}`);
      return false;
    }
  }

  async getScheduledNotification(notificationId: string): Promise<ScheduledNotification | null> {
    try {
      const redis = redisService.getRedis();
      const notificationData = await redis.command('HGET', 'scheduled:notifications', notificationId);

      if (notificationData) {
        return JSON.parse(notificationData as string);
      }

      return null;
    } catch (error) {
      logger.error(`Error getting scheduled notification ${notificationId}: ${error}`);
      return null;
    }
  }

  async getUpcomingNotifications(hours: number = 24): Promise<ScheduledNotification[]> {
    try {
      const redis = redisService.getRedis();
      const endTime = Date.now() + (hours * 60 * 60 * 1000);

      const notifications = await redis.command('ZRANGEBYSCORE', 'scheduled:queue', '-inf', endTime);

      if (Array.isArray(notifications)) {
        const parsed = notifications.map(data => JSON.parse(data as string));
        return parsed.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      }

      return [];
    } catch (error) {
      logger.error(`Error getting upcoming notifications: ${error}`);
      return [];
    }
  }

  async getSchedulerStats(): Promise<SchedulerStats> {
    try {
      const redis = redisService.getRedis();
      const now = Date.now();

      const [
        totalScheduled,
        upcomingIn1Hour,
        upcomingIn24Hours,
        overdue
      ] = await Promise.all([
        redis.command('ZCARD', 'scheduled:queue'),
        redis.command('ZCOUNT', 'scheduled:queue', now, now + (60 * 60 * 1000)),
        redis.command('ZCOUNT', 'scheduled:queue', now, now + (24 * 60 * 60 * 1000)),
        redis.command('ZCOUNT', 'scheduled:queue', '-inf', now - 1)
      ]);

      return {
        totalScheduled: totalScheduled as number,
        pendingScheduled: totalScheduled as number, // Simplified for now
        processingScheduled: 0,
        completedScheduled: 0,
        failedScheduled: 0,
        upcomingIn1Hour: upcomingIn1Hour as number,
        upcomingIn24Hours: upcomingIn24Hours as number,
        overdue: overdue as number
      };
    } catch (error) {
      logger.error(`Error getting scheduler stats: ${error}`);
      return {
        totalScheduled: 0,
        pendingScheduled: 0,
        processingScheduled: 0,
        completedScheduled: 0,
        failedScheduled: 0,
        upcomingIn1Hour: 0,
        upcomingIn24Hours: 0,
        overdue: 0
      };
    }
  }

  private async processScheduledNotifications(): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const now = Date.now();

      // Get notifications that are due for processing
      const dueNotifications = await redis.command('ZRANGEBYSCORE', 'scheduled:queue', '-inf', now, 'LIMIT', 0, 50);

      if (!Array.isArray(dueNotifications) || dueNotifications.length === 0) {
        return;
      }

      logger.info(`Processing ${dueNotifications.length} scheduled notifications`);

      for (const notificationData of dueNotifications) {
        try {
          const scheduledNotification: ScheduledNotification = JSON.parse(notificationData as string);

          // Update status to processing
          await this.updateNotificationStatus(scheduledNotification.id, 'processing');

          // Process based on type
          await this.processNotificationByType(scheduledNotification);

          // Remove from scheduled queue
          await redis.command('ZREM', 'scheduled:queue', notificationData);

          // Handle recurring notifications
          if (scheduledNotification.type === 'recurring') {
            await this.handleRecurringNotification(scheduledNotification);
          }

        } catch (error) {
          logger.error(`Error processing scheduled notification: ${error}`);
        }
      }

    } catch (error) {
      logger.error(`Error in processScheduledNotifications: ${error}`);
    }
  }

  private async processNotificationByType(scheduledNotification: ScheduledNotification): Promise<void> {
    try {
      switch (scheduledNotification.type) {
        case 'single':
          await this.processSingleNotification(scheduledNotification);
          break;

        case 'batch':
          await this.processBatchNotification(scheduledNotification);
          break;

        case 'recurring':
          await this.processRecurringNotification(scheduledNotification);
          break;

        default:
          logger.warn(`Unknown notification type: ${scheduledNotification.type}`);
      }

      await this.updateNotificationStatus(scheduledNotification.id, 'completed');

    } catch (error) {
      logger.error(`Error processing notification ${scheduledNotification.id}: ${error}`);
      await this.updateNotificationStatus(scheduledNotification.id, 'failed');
      throw error;
    }
  }

  private async processSingleNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    if (!scheduledNotification.notification.userId) {
      throw new Error('User ID is required for single notifications');
    }

    const priority = scheduledNotification.notification.priority;

    if (priority === 'high') {
      await this.priorityWorker.addHighPriorityJob({
        userId: scheduledNotification.notification.userId,
        type: scheduledNotification.notification.type,
        title: scheduledNotification.notification.title,
        body: scheduledNotification.notification.body,
        channels: scheduledNotification.notification.channels,
        data: {
          ...scheduledNotification.notification.data,
          scheduledNotificationId: scheduledNotification.id
        },
        priority: 'high'
      });
    } else if (priority === 'medium') {
      await this.priorityWorker.addMediumPriorityJob({
        userId: scheduledNotification.notification.userId,
        type: scheduledNotification.notification.type,
        title: scheduledNotification.notification.title,
        body: scheduledNotification.notification.body,
        channels: scheduledNotification.notification.channels,
        data: {
          ...scheduledNotification.notification.data,
          scheduledNotificationId: scheduledNotification.id
        },
        priority: 'medium'
      });
    } else {
      await this.priorityWorker.addLowPriorityJob({
        userId: scheduledNotification.notification.userId,
        type: scheduledNotification.notification.type,
        title: scheduledNotification.notification.title,
        body: scheduledNotification.notification.body,
        channels: scheduledNotification.notification.channels,
        data: {
          ...scheduledNotification.notification.data,
          scheduledNotificationId: scheduledNotification.id
        },
        priority: 'low'
      });
    }
  }

  private async processBatchNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    if (!scheduledNotification.batchData) {
      throw new Error('Batch data is required for batch notifications');
    }

    const channels = scheduledNotification.notification.channels;

    if (channels.includes('email')) {
             await this.batchWorker.addEmailCampaign({
         title: scheduledNotification.notification.title,
         body: scheduledNotification.notification.body,
         targetUsers: scheduledNotification.batchData.targetUsers || [],
         segmentCriteria: scheduledNotification.batchData.segmentCriteria,
         batchSize: scheduledNotification.batchData.batchSize,
         rateLimitPerSecond: scheduledNotification.batchData.rateLimitPerSecond || 10
       });
    } else if (channels.includes('push')) {
             await this.batchWorker.addPushBroadcast({
         title: scheduledNotification.notification.title,
         body: scheduledNotification.notification.body,
         targetUsers: scheduledNotification.batchData.targetUsers || [],
         segmentCriteria: scheduledNotification.batchData.segmentCriteria,
         batchSize: scheduledNotification.batchData.batchSize,
         rateLimitPerSecond: scheduledNotification.batchData.rateLimitPerSecond || 20
       });
    } else {
      await this.batchWorker.addSystemAnnouncement({
        title: scheduledNotification.notification.title,
        body: scheduledNotification.notification.body,
        channels: channels,
        priority: scheduledNotification.notification.priority,
        batchSize: scheduledNotification.batchData.batchSize
      });
    }
  }

  private async processRecurringNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    // Process the current occurrence as a single notification
    await this.processSingleNotification(scheduledNotification);
  }

  private async handleRecurringNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    if (!scheduledNotification.recurringData) {
      return;
    }

    const recurringData = scheduledNotification.recurringData;
    recurringData.currentOccurrence++;

    // Check if we should continue recurring
    if (recurringData.maxOccurrences && recurringData.currentOccurrence >= recurringData.maxOccurrences) {
      logger.info(`Recurring notification ${scheduledNotification.id} completed after ${recurringData.currentOccurrence} occurrences`);
      return;
    }

    if (recurringData.endDate && new Date() >= recurringData.endDate) {
      logger.info(`Recurring notification ${scheduledNotification.id} ended due to end date`);
      return;
    }

    // Calculate next occurrence
    const nextScheduledAt = this.calculateNextOccurrence(scheduledNotification.scheduledAt, recurringData.pattern, recurringData.interval);

    // Schedule next occurrence
    const nextNotification: ScheduledNotification = {
      ...scheduledNotification,
      id: this.generateNotificationId(),
      scheduledAt: nextScheduledAt,
      status: 'pending',
      recurringData
    };

    await this.storeScheduledNotification(nextNotification);
    await this.persistScheduledNotification(nextNotification);

    logger.info(`Scheduled next occurrence of recurring notification ${scheduledNotification.id} for ${nextScheduledAt.toISOString()}`);
  }

  private calculateNextOccurrence(currentDate: Date, pattern: string, interval?: number): Date {
    const next = new Date(currentDate);

    switch (pattern) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;

      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;

      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;

      case 'custom':
        if (interval) {
          next.setTime(next.getTime() + (interval * 1000)); // interval in seconds
        } else {
          next.setDate(next.getDate() + 1); // Default to daily
        }
        break;

      default:
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private validateScheduledNotification(notification: ScheduledNotification): void {
    if (!notification.scheduledAt) {
      throw new Error('Scheduled date is required');
    }

    if (notification.scheduledAt < new Date()) {
      throw new Error('Scheduled date cannot be in the past');
    }

    if (!notification.notification.title) {
      throw new Error('Notification title is required');
    }

    if (!notification.notification.body) {
      throw new Error('Notification body is required');
    }

    if (!notification.notification.channels || notification.notification.channels.length === 0) {
      throw new Error('At least one notification channel is required');
    }

    if (notification.type === 'single' && !notification.notification.userId) {
      throw new Error('User ID is required for single notifications');
    }

    if (notification.type === 'batch' && !notification.batchData) {
      throw new Error('Batch data is required for batch notifications');
    }

    if (notification.type === 'recurring' && !notification.recurringData) {
      throw new Error('Recurring data is required for recurring notifications');
    }
  }

  private async storeScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const scheduledTime = notification.scheduledAt.getTime();

      // Store in sorted set for time-based retrieval
      await redis.command('ZADD', 'scheduled:queue', scheduledTime, JSON.stringify(notification));

      // Store notification details in hash
      await redis.command('HSET', 'scheduled:notifications', notification.id, JSON.stringify(notification));

    } catch (error) {
      logger.error(`Error storing scheduled notification: ${error}`);
      throw error;
    }
  }

  private async removeScheduledNotification(notificationId: string): Promise<void> {
    try {
      const redis = redisService.getRedis();

      // Get notification data
      const notificationData = await redis.command('HGET', 'scheduled:notifications', notificationId);

      if (notificationData) {
        // Remove from sorted set
        await redis.command('ZREM', 'scheduled:queue', notificationData);

        // Remove from hash
        await redis.command('HDEL', 'scheduled:notifications', notificationId);
      }

    } catch (error) {
      logger.error(`Error removing scheduled notification: ${error}`);
      throw error;
    }
  }

  private async persistScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      // TODO: Implement database persistence
      // await this.databaseService.saveScheduledNotification(notification);
      logger.debug(`Persisted scheduled notification ${notification.id}`);
    } catch (error) {
      logger.error(`Error persisting scheduled notification: ${error}`);
      // Don't throw error for persistence failures
    }
  }

  private async updateNotificationStatus(notificationId: string, status: ScheduledNotification['status']): Promise<void> {
    try {
      const redis = redisService.getRedis();

      // Get current notification
      const notificationData = await redis.command('HGET', 'scheduled:notifications', notificationId);

      if (notificationData) {
        const notification: ScheduledNotification = JSON.parse(notificationData as string);
        notification.status = status;

        // Update in Redis
        await redis.command('HSET', 'scheduled:notifications', notificationId, JSON.stringify(notification));

        // TODO: Update in database
        // await this.databaseService.updateScheduledNotificationStatus(notificationId, status);
      }

    } catch (error) {
      logger.error(`Error updating notification status: ${error}`);
    }
  }

  private generateNotificationId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getter for running status
  get isActive(): boolean {
    return this.isRunning;
  }
} 