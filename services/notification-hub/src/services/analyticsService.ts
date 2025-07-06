import { DatabaseService } from './databaseService';
import { RedisManager } from './redisManager';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('AnalyticsService');

export class AnalyticsService {
  private databaseService: DatabaseService;
  private redisManager: RedisManager;

  constructor(databaseService: DatabaseService, redisManager: RedisManager) {
    this.databaseService = databaseService;
    this.redisManager = redisManager;
  }

  async trackConnection(userId: string, action: 'connect' | 'disconnect'): Promise<void> {
    try {
      const key = `analytics:connections:${userId}`;
      const timestamp = Date.now();
      
      await this.redisManager.addToDeliveryQueue({
        action,
        timestamp,
        userId
      }, 'analytics');
      
      // Use a dedicated analytics tracking approach
      await this.trackAnalyticsEvent(userId, 'connection', { action, timestamp });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error tracking connection for ${userId}:`, { error: errorMessage });
    }
  }

  async trackDelivery(messageId: string, channel: string, status: string): Promise<void> {
    try {
      const key = `analytics:deliveries:${messageId}`;
      
      // Use the notification status update method
      await this.redisManager.updateNotificationStatus(messageId, status, {
        channel,
        timestamp: Date.now()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error tracking delivery for ${messageId}:`, { error: errorMessage });
    }
  }

  private async trackAnalyticsEvent(userId: string, eventType: string, data: any): Promise<void> {
    try {
      // Store analytics event using available RedisManager methods
      await this.redisManager.cacheNotification({
        id: `analytics_${userId}_${eventType}_${Date.now()}`,
        userId,
        type: eventType,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error tracking analytics event for ${userId}:`, { error: errorMessage });
    }
  }

  async getAnalytics(period: string): Promise<any> {
    try {
      const stats = await this.databaseService.getNotificationStats(period);
      
      return {
        period,
        notifications: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting analytics:', { error: errorMessage });
      return { error: 'Failed to get analytics' };
    }
  }
} 