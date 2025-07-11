import { createLogger } from '@moonx-farm/common';
import { DatabaseService } from './databaseService';
import { TemplateService } from './templateService';
import { WebSocketProvider } from '../channels/websocketProvider';
import { FCMProvider } from '../channels/fcmProvider';
import { EmailProvider } from '../channels/emailProvider';
import { TelegramProvider } from '../channels/telegramProvider';
import {
  Notification,
  CreateNotificationRequest,
  NotificationListResponse,
  BatchDeliveryResult,
  DeliveryResult,
  NotificationChannel,
  UserNotificationPreferences,
  INotificationService,
  IChannelProvider,
  NotificationTemplate,
  DeliveryStatus
} from '../types';

const logger = createLogger('notification-service');

export class NotificationService implements INotificationService {
  private db: DatabaseService;
  private templateService: TemplateService;
  private channelProviders: Map<NotificationChannel, IChannelProvider> = new Map();
  private isInitialized = false;

  constructor(
    databaseService: DatabaseService,
    templateService: TemplateService
  ) {
    this.db = databaseService;
    this.templateService = templateService;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize channel providers
      this.channelProviders.set(NotificationChannel.WEBSOCKET, new WebSocketProvider());
      this.channelProviders.set(NotificationChannel.FCM, new FCMProvider());
      this.channelProviders.set(NotificationChannel.EMAIL, new EmailProvider());
      this.channelProviders.set(NotificationChannel.TELEGRAM, new TelegramProvider());

      // Wait for all providers to be available
      const providerChecks = Array.from(this.channelProviders.entries()).map(
        async ([channel, provider]) => {
          const isAvailable = await provider.isAvailable();
          logger.info(`Channel provider ${channel} availability: ${isAvailable}`);
          return { channel, isAvailable };
        }
      );

      await Promise.all(providerChecks);
      this.isInitialized = true;
      
      logger.info('Notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize notification service', { error });
    }
  }

  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    try {
      // Validate request
      if (!request.userId || !request.title || !request.content) {
        throw new Error('Invalid notification request: missing required fields');
      }

      // Create notification in database
      const notification = await this.db.createNotification(request);
      
      logger.info('Notification created', {
        notificationId: notification.id,
        userId: request.userId,
        type: request.notificationType
      });

      // If scheduled, add to queue for later processing
      if (request.scheduledAt && request.scheduledAt > new Date()) {
        await this.scheduleNotification(notification, request.channels);
      } else {
        // Send immediately
        await this.sendNotification(notification.id, request.channels);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', { error, request });
      throw error;
    }
  }

  async sendNotification(
    notificationId: number,
    channels?: NotificationChannel[]
  ): Promise<BatchDeliveryResult> {
    try {
      // Get notification from database
      const notification = await this.db.getNotification(notificationId);
      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Check if notification is expired
      if (notification.expiresAt && notification.expiresAt < new Date()) {
        logger.warn('Notification expired, skipping send', { notificationId });
        return {
          results: [],
          successCount: 0,
          failureCount: 0,
          totalDeliveryTime: 0
        };
      }

      // Get user preferences
      const preferences = await this.db.getUserPreferences(notification.userId);
      if (!preferences) {
        logger.warn('User preferences not found, creating defaults', { userId: notification.userId });
        await this.db.createUserPreferences(notification.userId);
        const newPreferences = await this.db.getUserPreferences(notification.userId);
        if (!newPreferences) {
          throw new Error('Failed to create user preferences');
        }
      }

      // Determine which channels to use
      const targetChannels = this.determineTargetChannels(channels, preferences!);
      
      if (targetChannels.length === 0) {
        logger.info('No enabled channels for user', { userId: notification.userId });
        return {
          results: [],
          successCount: 0,
          failureCount: 0,
          totalDeliveryTime: 0
        };
      }

      // Send to each channel
      const deliveryPromises = targetChannels.map(channel => 
        this.sendToChannel(notification, channel, preferences!)
      );

      const results = await Promise.allSettled(deliveryPromises);
      const deliveryResults: DeliveryResult[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deliveryResults.push(result.value);
        } else {
          deliveryResults.push({
            success: false,
            channel: targetChannels[index],
            error: result.reason?.message || 'Unknown error',
            deliveryTime: 0
          });
        }
      });

      const successCount = deliveryResults.filter(r => r.success).length;
      const failureCount = deliveryResults.filter(r => !r.success).length;
      const totalDeliveryTime = deliveryResults.reduce((sum, r) => sum + (r.deliveryTime || 0), 0);

      logger.info('Notification delivery completed', {
        notificationId,
        successCount,
        failureCount,
        totalDeliveryTime
      });

      return {
        results: deliveryResults,
        successCount,
        failureCount,
        totalDeliveryTime
      };
    } catch (error) {
      logger.error('Failed to send notification', { error, notificationId });
      throw error;
    }
  }

  private async sendToChannel(
    notification: Notification,
    channel: NotificationChannel,
    preferences: UserNotificationPreferences
  ): Promise<DeliveryResult> {
    try {
      const provider = this.channelProviders.get(channel);
      if (!provider) {
        throw new Error(`Channel provider ${channel} not found`);
      }

      // Check if provider is available
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw new Error(`Channel provider ${channel} is not available`);
      }

      // Get recipient for this channel
      const recipient = provider.getRecipient(preferences);
      if (!recipient) {
        throw new Error(`No recipient configured for channel ${channel}`);
      }

      // Create delivery attempt record
      const deliveryAttempt = await this.db.createDeliveryAttempt(
        notification.id,
        channel,
        recipient
      );

      // Get template for this channel
      const template = await this.getTemplateForChannel(notification, channel);
      if (!template) {
        throw new Error(`No template found for ${channel}`);
      }

      // Send notification
      const result = await provider.send(notification, recipient, template);

      // Update delivery status
      await this.db.updateDeliveryStatus(
        deliveryAttempt.id,
        result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        { messageId: result.messageId, deliveryTime: result.deliveryTime },
        result.error
      );

      return result;
    } catch (error) {
      logger.error('Failed to send to channel', { error, channel, notificationId: notification.id });
      throw error;
    }
  }

  private async getTemplateForChannel(
    notification: Notification,
    channel: NotificationChannel
  ): Promise<NotificationTemplate | null> {
    // Try to get specific template for this notification
    if (notification.templateKey) {
      const template = await this.templateService.getTemplate(notification.templateKey, channel);
      if (template) {
        return template;
      }
    }

    // Fallback to default template for notification type
    const defaultTemplateKey = `${notification.notificationType}_default`;
    const template = await this.templateService.getTemplate(defaultTemplateKey, channel);
    
    if (template) {
      return template;
    }

    // Create a fallback template
    return {
      id: 0,
      templateKey: 'fallback',
      templateName: 'Fallback Template',
      channel,
      contentTemplate: notification.content,
      subjectTemplate: notification.title,
      variables: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private determineTargetChannels(
    requestedChannels: NotificationChannel[] | undefined,
    preferences: UserNotificationPreferences
  ): NotificationChannel[] {
    const enabledChannels: NotificationChannel[] = [];

    // Check each channel's preference
    if (preferences.websocketEnabled) {
      enabledChannels.push(NotificationChannel.WEBSOCKET);
    }
    if (preferences.fcmEnabled) {
      enabledChannels.push(NotificationChannel.FCM);
    }
    if (preferences.emailEnabled) {
      enabledChannels.push(NotificationChannel.EMAIL);
    }
    if (preferences.telegramEnabled) {
      enabledChannels.push(NotificationChannel.TELEGRAM);
    }

    // If specific channels requested, filter enabled channels
    if (requestedChannels && requestedChannels.length > 0) {
      return enabledChannels.filter(channel => requestedChannels.includes(channel));
    }

    return enabledChannels;
  }

  private async scheduleNotification(
    notification: Notification,
    channels?: NotificationChannel[]
  ): Promise<void> {
    try {
      const preferences = await this.db.getUserPreferences(notification.userId);
      if (!preferences) {
        return;
      }

      const targetChannels = this.determineTargetChannels(channels, preferences);
      
      for (const channel of targetChannels) {
        await this.db.addToQueue(
          notification.id,
          channel,
          this.getPriorityValue(notification.priority),
          notification.expiresAt
        );
      }

      logger.info('Notification scheduled', {
        notificationId: notification.id,
        channels: targetChannels,
        scheduledAt: notification.expiresAt
      });
    } catch (error) {
      logger.error('Failed to schedule notification', { error, notificationId: notification.id });
      throw error;
    }
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 100;
      case 'high': return 75;
      case 'normal': return 50;
      case 'low': return 25;
      default: return 50;
    }
  }

  async getUserNotifications(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      isRead?: boolean;
      priority?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<NotificationListResponse> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      
      const filters = {
        type: query.type as any,
        isRead: query.isRead,
        priority: query.priority as any,
        fromDate: query.fromDate,
        toDate: query.toDate
      };

      const result = await this.db.getUserNotifications(
        userId,
        filters,
        { page, limit }
      );

      return {
        notifications: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user notifications', { error, userId });
      throw error;
    }
  }

  async markAsRead(notificationId: number, userId: string): Promise<void> {
    try {
      await this.db.markAsRead(notificationId, userId);
      logger.info('Notification marked as read', { notificationId, userId });
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId, userId });
      throw error;
    }
  }

  async deleteNotification(notificationId: number, userId: string): Promise<void> {
    try {
      await this.db.deleteNotification(notificationId, userId);
      logger.info('Notification deleted', { notificationId, userId });
    } catch (error) {
      logger.error('Failed to delete notification', { error, notificationId, userId });
      throw error;
    }
  }

  async processQueuedNotifications(): Promise<void> {
    try {
      if (!this.isInitialized) {
        logger.warn('Notification service not initialized, skipping queue processing');
        return;
      }

      const queuedNotifications = await this.db.getQueuedNotifications();
      
      if (queuedNotifications.length === 0) {
        return;
      }

      logger.info('Processing queued notifications', { count: queuedNotifications.length });

      for (const queueItem of queuedNotifications) {
        try {
          await this.db.markQueueItemAsProcessing(queueItem.id);
          
          const notification = await this.db.getNotification(queueItem.notificationId);
          if (!notification) {
            await this.db.markQueueItemAsFailed(queueItem.id, 'Notification not found');
            continue;
          }

          await this.sendNotification(notification.id, [queueItem.channel]);
          await this.db.markQueueItemAsProcessed(queueItem.id);
        } catch (error) {
          logger.error('Failed to process queued notification', { error, queueItem });
          await this.db.markQueueItemAsFailed(queueItem.id, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    } catch (error) {
      logger.error('Failed to process notification queue', { error });
    }
  }

  async retryFailedDeliveries(): Promise<void> {
    try {
      const failedDeliveries = await this.db.getFailedDeliveries();
      
      if (failedDeliveries.length === 0) {
        return;
      }

      logger.info('Retrying failed deliveries', { count: failedDeliveries.length });

      for (const delivery of failedDeliveries) {
        try {
          const notification = await this.db.getNotification(delivery.notificationId);
          if (!notification) {
            continue;
          }

          // Calculate next retry time with exponential backoff
          const nextRetryAt = new Date(Date.now() + Math.pow(2, delivery.retryCount) * 60 * 1000);
          await this.db.incrementRetryCount(delivery.id, nextRetryAt);

          await this.sendNotification(notification.id, [delivery.channel]);
        } catch (error) {
          logger.error('Failed to retry delivery', { error, delivery });
        }
      }
    } catch (error) {
      logger.error('Failed to retry failed deliveries', { error });
    }
  }

  async cleanupExpiredNotifications(): Promise<void> {
    try {
      const cleanedCount = await this.db.cleanupExpiredNotifications();
      if (cleanedCount > 0) {
        logger.info('Cleaned up expired notifications', { count: cleanedCount });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired notifications', { error });
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    timestamp: Date;
  }> {
    try {
      const dbHealthy = await this.db.healthCheck();
      const servicesHealth: Record<string, boolean> = {
        database: dbHealthy
      };

      // Check each channel provider
      for (const [channel, provider] of this.channelProviders) {
        servicesHealth[channel] = await provider.isAvailable();
      }

      const allHealthy = Object.values(servicesHealth).every(health => health);

      return {
        healthy: allHealthy,
        services: servicesHealth,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        healthy: false,
        services: {},
        timestamp: new Date()
      };
    }
  }
} 