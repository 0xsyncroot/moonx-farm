import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { createLogger, ServiceUnavailableError, isDevelopment } from '@moonx/common';

const logger = createLogger('redis');

/**
 * Redis configuration options
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

/**
 * Cache options for set operations
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  ex?: boolean; // Use EX instead of PX for TTL
}

/**
 * Redis manager class with caching utilities
 */
export class RedisManager {
  private client: RedisClient;
  private isConnected = false;

  constructor(config: RedisConfig) {
    const options: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'moonx:',
      enableReadyCheck: config.enableReadyCheck !== false,
      lazyConnect: config.lazyConnect !== false,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      connectTimeout: config.connectTimeout || 10000,
      commandTimeout: config.commandTimeout || 5000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(options);
    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error', { error: error.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      logger.info('Redis reconnecting', { delay });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis connection ended');
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Redis connection failed', { error: err.message });
      throw new ServiceUnavailableError('Failed to connect to Redis', {
        originalError: err.message,
      });
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Redis disconnection failed', { error: err.message });
    }
  }

  /**
   * Get value by key
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) return null;

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Redis GET failed', { key, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'GET',
        key,
        originalError: err.message,
      });
    }
  }

  /**
   * Set value with optional TTL
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (options.ttl) {
        if (options.nx) {
          await this.client.set(key, serializedValue, 'EX', options.ttl, 'NX');
        } else {
          await this.client.setex(key, options.ttl, serializedValue);
        }
      } else {
        if (options.nx) {
          await this.client.set(key, serializedValue, 'NX');
        } else {
          await this.client.set(key, serializedValue);
        }
      }

      logger.debug('Redis SET successful', { key, ttl: options.ttl });
    } catch (error) {
      const err = error as Error;
      logger.error('Redis SET failed', { key, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'SET',
        key,
        originalError: err.message,
      });
    }
  }

  /**
   * Delete key(s)
   */
  async del(...keys: string[]): Promise<number> {
    try {
      const result = await this.client.del(...keys);
      logger.debug('Redis DEL successful', { keys, deleted: result });
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Redis DEL failed', { keys, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'DEL',
        keys,
        originalError: err.message,
      });
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      const err = error as Error;
      logger.error('Redis EXISTS failed', { key, error: err.message });
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      const err = error as Error;
      logger.error('Redis EXPIRE failed', { key, ttl, error: err.message });
      return false;
    }
  }

  /**
   * Get multiple values by pattern
   */
  async getByPattern(pattern: string): Promise<Record<string, any>> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return {};

      const values = await this.client.mget(...keys);
      const result: Record<string, any> = {};

      keys.forEach((key, index) => {
        const value = values[index];
        if (value !== null) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Redis pattern GET failed', { pattern, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'GET_PATTERN',
        pattern,
        originalError: err.message,
      });
    }
  }

  /**
   * Delete keys by pattern
   */
  async delByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      const result = await this.client.del(...keys);
      logger.debug('Redis pattern DEL successful', { pattern, deleted: result });
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Redis pattern DEL failed', { pattern, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'DEL_PATTERN',
        pattern,
        originalError: err.message,
      });
    }
  }

  /**
   * Hash operations
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      const err = error as Error;
      logger.error('Redis HGET failed', { key, field, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'HGET',
        key,
        field,
        originalError: err.message,
      });
    }
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.hset(key, field, serializedValue);
    } catch (error) {
      const err = error as Error;
      logger.error('Redis HSET failed', { key, field, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'HSET',
        key,
        field,
        originalError: err.message,
      });
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      const err = error as Error;
      logger.error('Redis HGETALL failed', { key, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'HGETALL',
        key,
        originalError: err.message,
      });
    }
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const serializedValues = values.map(v => 
        typeof v === 'string' ? v : JSON.stringify(v)
      );
      return await this.client.lpush(key, ...serializedValues);
    } catch (error) {
      const err = error as Error;
      logger.error('Redis LPUSH failed', { key, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'LPUSH',
        key,
        originalError: err.message,
      });
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      const err = error as Error;
      logger.error('Redis RPOP failed', { key, error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'RPOP',
        key,
        originalError: err.message,
      });
    }
  }

  /**
   * Check if Redis is healthy
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      const err = error as Error;
      logger.error('Redis INFO failed', { error: err.message });
      throw new ServiceUnavailableError('Redis operation failed', {
        operation: 'INFO',
        originalError: err.message,
      });
    }
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getClient(): RedisClient {
    return this.client;
  }
}

/**
 * Create a Redis manager instance
 */
export function createRedis(config: RedisConfig): RedisManager {
  return new RedisManager(config);
}

/**
 * Create Redis configuration from environment
 */
export function createRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1)) : 0,
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'moonx:',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
  };
} 