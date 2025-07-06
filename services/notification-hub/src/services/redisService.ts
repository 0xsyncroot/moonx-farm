import { 
  RedisManager, 
  createRedis, 
  createRedisConfig 
} from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('RedisService');

export class RedisService {
  private redis: RedisManager;
  private isConnected: boolean = false;

  constructor() {
    const config = createRedisConfig();
    this.redis = createRedis(config);
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      this.isConnected = true;
      logger.info('Redis service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Redis service: ${error}`);
      throw error;
    }
  }

  getRedis(): RedisManager {
    return this.redis;
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.isConnected && this.redis.isHealthy();
    } catch (error) {
      logger.error(`Redis health check failed: ${error}`);
      return false;
    }
  }

  getMetrics() {
    return this.redis.getMetrics();
  }

  async shutdown(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      logger.info('Redis service shutdown completed');
    } catch (error) {
      logger.error(`Error during Redis service shutdown: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const redisService = new RedisService(); 