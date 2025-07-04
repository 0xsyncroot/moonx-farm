import { logger } from '../utils/logger';

export class RedisManager {
  private client: any;

  constructor(redisClient: any) {
    this.client = redisClient;
  }

  // User connection management
  async getUserConnections(userId: string): Promise<string[]> {
    try {
      const connections = await this.client.sMembers(`user:${userId}:connections`);
      return connections || [];
    } catch (error) {
      logger.error(`Error getting user connections for ${userId}:`, error);
      return [];
    }
  }

  async addUserConnection(userId: string, connectionId: string): Promise<void> {
    try {
      await this.client.sAdd(`user:${userId}:connections`, connectionId);
      await this.client.expire(`user:${userId}:connections`, 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`Error adding connection for ${userId}:`, error);
    }
  }

  async removeUserConnection(userId: string, connectionId: string): Promise<void> {
    try {
      await this.client.sRem(`user:${userId}:connections`, connectionId);
    } catch (error) {
      logger.error(`Error removing connection for ${userId}:`, error);
    }
  }

  // Room management
  async getRoomConnections(roomId: string): Promise<string[]> {
    try {
      const connections = await this.client.sMembers(`room:${roomId}:connections`);
      return connections || [];
    } catch (error) {
      logger.error(`Error getting room connections for ${roomId}:`, error);
      return [];
    }
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<any> {
    try {
      const prefs = await this.client.hGetAll(`user:${userId}:preferences`);
      return prefs ? JSON.parse(prefs.data || '{}') : null;
    } catch (error) {
      logger.error(`Error getting preferences for ${userId}:`, error);
      return null;
    }
  }

  async cacheUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await this.client.hSet(`user:${userId}:preferences`, 'data', JSON.stringify(preferences));
      await this.client.expire(`user:${userId}:preferences`, 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`Error caching preferences for ${userId}:`, error);
    }
  }

  // FCM tokens
  async getUserFCMTokens(userId: string): Promise<string[]> {
    try {
      const tokens = await this.client.sMembers(`user:${userId}:fcm_tokens`);
      return tokens || [];
    } catch (error) {
      logger.error(`Error getting FCM tokens for ${userId}:`, error);
      return [];
    }
  }

  // User contact info
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      return await this.client.hGet(`user:${userId}:contact`, 'email');
    } catch (error) {
      logger.error(`Error getting email for ${userId}:`, error);
      return null;
    }
  }

  async getUserPhoneNumber(userId: string): Promise<string | null> {
    try {
      return await this.client.hGet(`user:${userId}:contact`, 'phone');
    } catch (error) {
      logger.error(`Error getting phone for ${userId}:`, error);
      return null;
    }
  }

  // Rate limiting
  async getRateLimitCounter(userId: string, type: string): Promise<number> {
    try {
      const count = await this.client.get(`rate_limit:${userId}:${type}`);
      return parseInt(count || '0', 10);
    } catch (error) {
      logger.error(`Error getting rate limit for ${userId}:`, error);
      return 0;
    }
  }

  async incrementRateLimitCounter(userId: string, type: string, windowSeconds: number): Promise<void> {
    try {
      const key = `rate_limit:${userId}:${type}`;
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
    } catch (error) {
      logger.error(`Error incrementing rate limit for ${userId}:`, error);
    }
  }

  async getRateLimitResetTime(userId: string, type: string): Promise<number> {
    try {
      const key = `rate_limit:${userId}:${type}`;
      const ttl = await this.client.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (error) {
      logger.error(`Error getting rate limit reset time for ${userId}:`, error);
      return 0;
    }
  }

  // Notification caching
  async cacheNotification(notification: any): Promise<void> {
    try {
      await this.client.setEx(
        `notification:${notification.id}`,
        3600, // 1 hour TTL
        JSON.stringify(notification)
      );
    } catch (error) {
      logger.error(`Error caching notification ${notification.id}:`, error);
    }
  }

  // Offline notifications
  async storeOfflineNotification(notification: any): Promise<void> {
    try {
      await this.client.lPush(
        `user:${notification.userId}:offline_notifications`,
        JSON.stringify(notification)
      );
      // Keep only last 100 notifications
      await this.client.lTrim(`user:${notification.userId}:offline_notifications`, 0, 99);
    } catch (error) {
      logger.error(`Error storing offline notification for ${notification.userId}:`, error);
    }
  }

  // Delivery queues
  async addToDeliveryQueue(notification: any, priority: string): Promise<void> {
    try {
      const queueName = `delivery_queue:${priority}`;
      await this.client.lPush(queueName, JSON.stringify(notification));
    } catch (error) {
      logger.error(`Error adding to delivery queue:`, error);
    }
  }

  async addToRetryQueue(notification: any): Promise<void> {
    try {
      const retryDelay = this.calculateRetryDelay(notification.metadata.attempts);
      const scheduleTime = Date.now() + retryDelay;
      
      await this.client.zAdd('retry_queue', {
        score: scheduleTime,
        value: JSON.stringify(notification)
      });
    } catch (error) {
      logger.error(`Error adding to retry queue:`, error);
    }
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, ...
    return Math.min(1000 * Math.pow(2, attempts), 300000); // Max 5 minutes
  }

  // User status
  async updateUserStatus(userId: string, status: string): Promise<void> {
    try {
      await this.client.hSet(`user:${userId}:status`, {
        status,
        lastSeen: Date.now()
      });
      await this.client.expire(`user:${userId}:status`, 3600);
    } catch (error) {
      logger.error(`Error updating user status for ${userId}:`, error);
    }
  }

  async updateUserActivity(userId: string): Promise<void> {
    try {
      await this.client.hSet(`user:${userId}:activity`, {
        lastActivity: Date.now()
      });
      await this.client.expire(`user:${userId}:activity`, 3600);
    } catch (error) {
      logger.error(`Error updating user activity for ${userId}:`, error);
    }
  }

  // Notification status
  async updateNotificationStatus(notificationId: string, status: string, results?: any): Promise<void> {
    try {
      await this.client.hSet(`notification:${notificationId}:status`, {
        status,
        updatedAt: Date.now(),
        results: results ? JSON.stringify(results) : ''
      });
      await this.client.expire(`notification:${notificationId}:status`, 86400); // 24 hours
    } catch (error) {
      logger.error(`Error updating notification status for ${notificationId}:`, error);
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }
} 