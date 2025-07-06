import { createLogger } from '@moonx-farm/common';
import { RedisManager as InfraRedisManager } from '@moonx-farm/infrastructure';
import { redisService } from './redisService';

const logger = createLogger('RedisManager');

export class RedisManager {
  private redis: InfraRedisManager;

  constructor() {
    this.redis = redisService.getRedis();
  }

  // Ensure Redis service is initialized
  private async ensureInitialized(): Promise<void> {
    if (!redisService.isInitialized()) {
      await redisService.initialize();
    }
  }

  // User connection management
  async getUserConnections(userId: string): Promise<string[]> {
    try {
      await this.ensureInitialized();
      const connections = await this.redis.smembers(`user:${userId}:connections`);
      return connections || [];
    } catch (error) {
      logger.error(`Error getting user connections for ${userId}: ${error}`);
      return [];
    }
  }

  async addUserConnection(userId: string, connectionId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.sadd(`user:${userId}:connections`, connectionId);
      await this.redis.expire(`user:${userId}:connections`, 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`Error adding connection for ${userId}: ${error}`);
    }
  }

  async removeUserConnection(userId: string, connectionId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.srem(`user:${userId}:connections`, connectionId);
    } catch (error) {
      logger.error(`Error removing connection for ${userId}: ${error}`);
    }
  }

  // Room management
  async getRoomConnections(roomId: string): Promise<string[]> {
    try {
      await this.ensureInitialized();
      const connections = await this.redis.smembers(`room:${roomId}:connections`);
      return connections || [];
    } catch (error) {
      logger.error(`Error getting room connections for ${roomId}: ${error}`);
      return [];
    }
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<any> {
    try {
      await this.ensureInitialized();
      const prefs = await this.redis.hgetall(`user:${userId}:preferences`);
      return prefs['data'] ? JSON.parse(prefs['data']) : null;
    } catch (error) {
      logger.error(`Error getting preferences for ${userId}: ${error}`);
      return null;
    }
  }

  async cacheUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.hset(`user:${userId}:preferences`, 'data', JSON.stringify(preferences));
      await this.redis.expire(`user:${userId}:preferences`, 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`Error caching preferences for ${userId}: ${error}`);
    }
  }

  // FCM tokens
  async getUserFCMTokens(userId: string): Promise<string[]> {
    try {
      await this.ensureInitialized();
      const tokens = await this.redis.smembers(`user:${userId}:fcm_tokens`);
      return tokens || [];
    } catch (error) {
      logger.error(`Error getting FCM tokens for ${userId}: ${error}`);
      return [];
    }
  }

  // User contact info
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      return await this.redis.hget(`user:${userId}:contact`, 'email');
    } catch (error) {
      logger.error(`Error getting email for ${userId}: ${error}`);
      return null;
    }
  }

  async getUserPhoneNumber(userId: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      return await this.redis.hget(`user:${userId}:contact`, 'phone');
    } catch (error) {
      logger.error(`Error getting phone for ${userId}: ${error}`);
      return null;
    }
  }

  // Rate limiting
  async getRateLimitCounter(userId: string, type: string): Promise<number> {
    try {
      await this.ensureInitialized();
      const count = await this.redis.get<string>(`rate_limit:${userId}:${type}`);
      return parseInt(count || '0', 10);
    } catch (error) {
      logger.error(`Error getting rate limit for ${userId}: ${error}`);
      return 0;
    }
  }

  async incrementRateLimitCounter(userId: string, type: string, windowSeconds: number): Promise<void> {
    try {
      await this.ensureInitialized();
      const key = `rate_limit:${userId}:${type}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }
    } catch (error) {
      logger.error(`Error incrementing rate limit for ${userId}: ${error}`);
    }
  }

  async getRateLimitResetTime(userId: string, type: string): Promise<number> {
    try {
      await this.ensureInitialized();
      const key = `rate_limit:${userId}:${type}`;
      const ttl = await this.redis.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (error) {
      logger.error(`Error getting rate limit reset time for ${userId}: ${error}`);
      return 0;
    }
  }

  // Notification caching
  async cacheNotification(notification: any): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.set(
        `notification:${notification.id}`,
        JSON.stringify(notification),
        { ttl: 3600 } // 1 hour TTL
      );
    } catch (error) {
      logger.error(`Error caching notification ${notification.id}: ${error}`);
    }
  }

  // Offline notifications
  async storeOfflineNotification(notification: any): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.lpush(
        `user:${notification.userId}:offline_notifications`,
        JSON.stringify(notification)
      );
      // Keep only last 100 notifications
      await this.redis.command('LTRIM', `user:${notification.userId}:offline_notifications`, 0, 99);
    } catch (error) {
      logger.error(`Error storing offline notification for ${notification.userId}: ${error}`);
    }
  }

  // Delivery queues
  async addToDeliveryQueue(notification: any, priority: string): Promise<void> {
    try {
      await this.ensureInitialized();
      const queueName = `delivery_queue:${priority}`;
      await this.redis.lpush(queueName, JSON.stringify(notification));
    } catch (error) {
      logger.error(`Error adding to delivery queue: ${error}`);
    }
  }

  async addToRetryQueue(notification: any): Promise<void> {
    try {
      await this.ensureInitialized();
      const retryDelay = this.calculateRetryDelay(notification.metadata.attempts);
      const scheduleTime = Date.now() + retryDelay;
      
      await this.redis.command('ZADD', 'retry_queue', scheduleTime, JSON.stringify(notification));
    } catch (error) {
      logger.error(`Error adding to retry queue: ${error}`);
    }
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, ...
    return Math.min(1000 * Math.pow(2, attempts), 300000); // Max 5 minutes
  }

  // User status
  async updateUserStatus(userId: string, status: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.hset(`user:${userId}:status`, 'status', status);
      await this.redis.hset(`user:${userId}:status`, 'lastSeen', Date.now().toString());
      await this.redis.expire(`user:${userId}:status`, 3600);
    } catch (error) {
      logger.error(`Error updating user status for ${userId}: ${error}`);
    }
  }

  async updateUserActivity(userId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.hset(`user:${userId}:activity`, 'lastActivity', Date.now().toString());
      await this.redis.expire(`user:${userId}:activity`, 3600);
    } catch (error) {
      logger.error(`Error updating user activity for ${userId}: ${error}`);
    }
  }

  // Notification status
  async updateNotificationStatus(notificationId: string, status: string, results?: any): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.hset(`notification:${notificationId}:status`, 'status', status);
      await this.redis.hset(`notification:${notificationId}:status`, 'updatedAt', Date.now().toString());
      if (results) {
        await this.redis.hset(`notification:${notificationId}:status`, 'results', JSON.stringify(results));
      }
      await this.redis.expire(`notification:${notificationId}:status`, 86400); // 24 hours
    } catch (error) {
      logger.error(`Error updating notification status for ${notificationId}: ${error}`);
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      return await redisService.healthCheck();
    } catch (error) {
      logger.error(`Redis health check failed: ${error}`);
      return false;
    }
  }

  // Get metrics
  getMetrics() {
    return redisService.getMetrics();
  }

  // Additional utility methods following infrastructure pattern
  async getNotification(notificationId: string): Promise<any | null> {
    try {
      await this.ensureInitialized();
      const notification = await this.redis.get<string>(`notification:${notificationId}`);
      return notification ? JSON.parse(notification) : null;
    } catch (error) {
      logger.error(`Error getting notification ${notificationId}: ${error}`);
      return null;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.del(`notification:${notificationId}`);
    } catch (error) {
      logger.error(`Error deleting notification ${notificationId}: ${error}`);
    }
  }

  async getOfflineNotifications(userId: string, limit: number = 100): Promise<any[]> {
    try {
      await this.ensureInitialized();
      const notifications = await this.redis.command('LRANGE', `user:${userId}:offline_notifications`, 0, limit - 1);
      return notifications.map((n: string) => JSON.parse(n));
    } catch (error) {
      logger.error(`Error getting offline notifications for ${userId}: ${error}`);
      return [];
    }
  }

  async clearOfflineNotifications(userId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.redis.del(`user:${userId}:offline_notifications`);
    } catch (error) {
      logger.error(`Error clearing offline notifications for ${userId}: ${error}`);
    }
  }
} 