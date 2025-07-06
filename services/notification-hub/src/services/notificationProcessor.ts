import { RedisManager } from './redisManager';
import { DatabaseService } from './databaseService';
import { PrometheusService } from './prometheusService';
import { createLogger } from '@moonx-farm/common';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('NotificationProcessor');

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  channels: string[];
  data?: any;
  scheduledAt?: Date;
  expiresAt?: Date;
}

interface ProcessedNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  channels: string[];
  data: any;
  metadata: {
    createdAt: Date;
    scheduledAt?: Date;
    expiresAt?: Date;
    attempts: number;
    lastAttempt?: Date;
  };
}

export class NotificationProcessor {
  private redisManager: RedisManager;
  private databaseService: DatabaseService;
  private prometheusService: PrometheusService;

  constructor(
    redisManager: RedisManager,
    databaseService: DatabaseService,
    prometheusService: PrometheusService
  ) {
    this.redisManager = redisManager;
    this.databaseService = databaseService;
    this.prometheusService = prometheusService;
  }

  async createNotification(data: NotificationData): Promise<ProcessedNotification> {
    const startTime = Date.now();
    
    try {
      // Generate unique ID
      const notificationId = uuidv4();

      // Check user preferences
      const userPreferences = await this.getUserPreferences(data.userId);
      const filteredChannels = this.filterChannelsByPreferences(
        data.channels,
        userPreferences,
        data.type
      );

      // Apply rate limiting
      const rateLimitResult = await this.checkRateLimit(data.userId, data.type);
      if (!rateLimitResult.allowed) {
        logger.warn(`Rate limit exceeded for user ${data.userId}, type ${data.type}`);
        return this.createRateLimitedNotification(data, notificationId);
      }

      // Create processed notification
      const notification: ProcessedNotification = {
        id: notificationId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        priority: data.priority,
        channels: filteredChannels,
        data: data.data || {},
        metadata: {
          createdAt: new Date(),
          ...(data.scheduledAt && { scheduledAt: data.scheduledAt }),
          expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
          attempts: 0
        }
      };

      // Save to database
      await this.databaseService.saveNotification(notification);

      // Cache for quick access
      await this.redisManager.cacheNotification(notification);

      // Update rate limit counters
      await this.updateRateLimit(data.userId, data.type);

      // Track metrics
      const processingTime = Date.now() - startTime;
      await this.prometheusService.recordNotificationCreated(
        data.type,
        data.priority,
        processingTime
      );

      logger.info(`Notification created: ${notificationId} for user ${data.userId}`);
      return notification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating notification:', { error: errorMessage });
      await this.prometheusService.recordNotificationError(data.type, 'creation_failed');
      throw error;
    }
  }

  private async getUserPreferences(userId: string): Promise<any> {
    try {
      // Try cache first
      const cached = await this.redisManager.getUserPreferences(userId);
      if (cached) return cached;

      // Fetch from database
      const preferences = await this.databaseService.getUserPreferences(userId);
      
      // Cache for future use
      await this.redisManager.cacheUserPreferences(userId, preferences);
      
      return preferences;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting user preferences for ${userId}:`, { error: errorMessage });
      return this.getDefaultPreferences();
    }
  }

  private filterChannelsByPreferences(
    channels: string[],
    preferences: any,
    notificationType: string
  ): string[] {
    const defaultChannels = ['websocket']; // Always include websocket
    
    if (!preferences || !preferences.channels) {
      return channels;
    }

    const filteredChannels = channels.filter(channel => {
      // Check global channel preference
      if (preferences.channels[channel] === false) {
        return false;
      }

      // Check notification type specific preference
      if (preferences.notificationTypes && 
          preferences.notificationTypes[notificationType] &&
          preferences.notificationTypes[notificationType].channels) {
        return preferences.notificationTypes[notificationType].channels.includes(channel);
      }

      return true;
    });

    // Always include websocket unless explicitly disabled
    if (!filteredChannels.includes('websocket') && preferences.channels.websocket !== false) {
      filteredChannels.push('websocket');
    }

    return filteredChannels.length > 0 ? filteredChannels : defaultChannels;
  }

  private async checkRateLimit(userId: string, type: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    try {
      const rateLimits = await this.getRateLimits(type);
      const current = await this.redisManager.getRateLimitCounter(userId, type);
      
      if (current >= rateLimits.max) {
        const retryAfter = await this.redisManager.getRateLimitResetTime(userId, type);
        return { allowed: false, retryAfter };
      }

      return { allowed: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error checking rate limit for ${userId}:`, { error: errorMessage });
      return { allowed: true }; // Allow by default on error
    }
  }

  private async updateRateLimit(userId: string, type: string): Promise<void> {
    try {
      const rateLimits = await this.getRateLimits(type);
      await this.redisManager.incrementRateLimitCounter(userId, type, rateLimits.window);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error updating rate limit for ${userId}:`, { error: errorMessage });
    }
  }

  private async getRateLimits(type: string): Promise<{ max: number; window: number }> {
    // Rate limits by notification type (requests per window in seconds)
    const rateLimits: { [key: string]: { max: number; window: number } } = {
      'price_alert': { max: 5, window: 60 }, // 5 per minute
      'swap_completed': { max: 10, window: 300 }, // 10 per 5 minutes
      'order_filled': { max: 20, window: 300 }, // 20 per 5 minutes
      'system_message': { max: 3, window: 3600 }, // 3 per hour
      'default': { max: 100, window: 3600 } // 100 per hour default
    };

    return rateLimits[type] ?? rateLimits['default'] ?? { max: 100, window: 3600 };
  }

  private createRateLimitedNotification(
    data: NotificationData,
    id: string
  ): ProcessedNotification {
    return {
      id,
      userId: data.userId,
      type: 'rate_limited',
      title: 'Rate Limited',
      body: 'Too many notifications. Please try again later.',
      priority: 'low',
      channels: ['websocket'],
      data: { originalType: data.type },
      metadata: {
        createdAt: new Date(),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    };
  }

  private getDefaultPreferences(): any {
    return {
      channels: {
        websocket: true,
        push: true,
        email: false,
        sms: false
      },
      notificationTypes: {
        price_alert: { enabled: true, channels: ['websocket', 'push'] },
        swap_completed: { enabled: true, channels: ['websocket', 'push'] },
        order_filled: { enabled: true, channels: ['websocket', 'push', 'email'] },
        system_message: { enabled: true, channels: ['websocket', 'email'] }
      }
    };
  }

  async trackProcessedMessage(
    topic: string,
    status: 'success' | 'error',
    processingTime: number
  ): Promise<void> {
    try {
      await this.prometheusService.recordMessageProcessed(topic, status, processingTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error tracking processed message:', { error: errorMessage });
    }
  }

  async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await this.databaseService.getScheduledNotifications();
      
      for (const notification of scheduledNotifications) {
        if (new Date() >= notification.metadata.scheduledAt!) {
          // Move to delivery queue
          await this.redisManager.addToDeliveryQueue(notification, notification.priority);
          
          // Mark as queued
          await this.databaseService.updateNotificationStatus(notification.id, 'queued');
          
          logger.info(`Scheduled notification queued: ${notification.id}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing scheduled notifications:', { error: errorMessage });
    }
  }
} 