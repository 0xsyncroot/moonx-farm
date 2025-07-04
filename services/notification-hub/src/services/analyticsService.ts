import { DatabaseService } from './databaseService';
import { RedisManager } from './redisManager';
import { logger } from '../utils/logger';

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
      
      await this.redisManager.client.lPush(key, JSON.stringify({
        action,
        timestamp,
        userId
      }));
      
      // Keep only last 100 connection events
      await this.redisManager.client.lTrim(key, 0, 99);
    } catch (error) {
      logger.error(`Error tracking connection for ${userId}:`, error);
    }
  }

  async trackDelivery(messageId: string, channel: string, status: string): Promise<void> {
    try {
      const key = `analytics:deliveries:${messageId}`;
      
      await this.redisManager.client.hSet(key, {
        channel,
        status,
        timestamp: Date.now()
      });
      
      await this.redisManager.client.expire(key, 86400); // 24 hours
    } catch (error) {
      logger.error(`Error tracking delivery for ${messageId}:`, error);
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
      logger.error('Error getting analytics:', error);
      return { error: 'Failed to get analytics' };
    }
  }
} 