import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export const createRedisClient = (): RedisClientType => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = createClient({
    url: redisUrl,
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB || '0'),
    socket: {
      connectTimeout: 5000,
      lazyConnect: true,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis connection failed after 10 retries');
          return new Error('Redis connection failed');
        }
        return Math.min(retries * 50, 1000);
      }
    }
  });

  // Error handling
  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });

  client.on('end', () => {
    logger.warn('Redis client connection ended');
  });

  return client;
};

export const REDIS_KEYS = {
  USER_CONNECTIONS: 'user:connections',
  USER_PREFERENCES: 'user:preferences',
  NOTIFICATION_QUEUE: 'notifications:queue',
  PRICE_CACHE: 'price:cache',
  CHART_CACHE: 'chart:cache',
  RATE_LIMIT: 'rate_limit',
  SESSION_KEYS: 'session:keys',
  OFFLINE_MESSAGES: 'offline:messages'
} as const;

export const REDIS_TTL = {
  USER_CONNECTIONS: 300, // 5 minutes
  USER_PREFERENCES: 3600, // 1 hour
  PRICE_CACHE: 60, // 1 minute
  CHART_CACHE: 30, // 30 seconds
  SESSION_KEYS: 86400, // 24 hours
  OFFLINE_MESSAGES: 604800 // 7 days
} as const;

export default createRedisClient; 