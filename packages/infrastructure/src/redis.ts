import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { createLogger, ServiceUnavailableError } from '@moonx-farm/common';

const logger = createLogger('redis-infrastructure');

/**
 * Redis configuration options - simplified but extensible
 */
export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  // Connection settings
  family?: 4 | 6;
  keepAlive?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
  // Features
  enableMetrics?: boolean;
  enableOfflineQueue?: boolean;
}

/**
 * Cache options for set operations
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
  keepTtl?: boolean; // Keep existing TTL
}

/**
 * Redis metrics interface
 */
export interface RedisMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageLatency: number;
  connectionCount: number;
  isConnected: boolean;
  lastError?: string;
}

/**
 * Pipeline operation interface
 */
export interface PipelineOperation {
  command: string;
  args: any[];
}

/**
 * Redis manager class - simplified but robust
 */
export class RedisManager {
  private client!: RedisClient;
  private isConnected = false;
  private metrics: RedisMetrics;
  private config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
    this.metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageLatency: 0,
      connectionCount: 0,
      isConnected: false
    };

    this.initializeClient();
    this.setupEventHandlers();
  }

  /**
   * Initialize Redis client with optimal settings
   */
  private initializeClient(): void {
    const options: RedisOptions = {
      host: this.config.host || 'localhost',
      port: this.config.port || 6379,
      password: this.config.password,
      db: this.config.db || 0,
      family: this.config.family || 4,
      keepAlive: this.config.keepAlive !== false ? 30000 : 0,
      keyPrefix: this.config.keyPrefix || 'moonx:',
      lazyConnect: this.config.lazyConnect !== false,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
      connectTimeout: this.config.connectTimeout || 10000,
      commandTimeout: this.config.commandTimeout || 5000,
      enableOfflineQueue: this.config.enableOfflineQueue !== false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(options);
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis connection established', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      });
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.metrics.connectionCount++;
      this.metrics.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.metrics.isConnected = false;
      this.metrics.lastError = error.message;
      logger.error('Redis connection error', { error: error.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.metrics.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      logger.info('Redis reconnecting', { delay });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.metrics.isConnected = false;
      logger.info('Redis connection ended');
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  /**
   * Execute command with metrics tracking
   */
  private async executeCommand<T>(
    operation: string,
    command: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalCommands++;

    try {
      const result = await command();
      
      const duration = Date.now() - startTime;
      this.metrics.successfulCommands++;
      this.updateAverageLatency(duration);

      if (this.config.enableMetrics) {
        logger.debug(`Redis ${operation} completed`, { duration });
      }

      return result;
    } catch (error) {
      this.metrics.failedCommands++;
      const err = error as Error;
      this.metrics.lastError = err.message;
      
      logger.error(`Redis ${operation} failed`, { error: err.message });
      throw new ServiceUnavailableError(`Redis operation failed: ${operation}`, {
        operation,
        originalError: err.message,
      });
    }
  }

  /**
   * Update average latency metric
   */
  private updateAverageLatency(duration: number): void {
    const total = this.metrics.successfulCommands;
    this.metrics.averageLatency = 
      ((this.metrics.averageLatency * (total - 1)) + duration) / total;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    return this.executeCommand('CONNECT', async () => {
      await this.client.ping();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });
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
   * Get value by key with type safety
   */
  async get<T = string>(key: string): Promise<T | null> {
    return this.executeCommand('GET', async () => {
      const value = await this.client.get(key);
      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    });
  }

  /**
   * Set value with options
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<string> {
    return this.executeCommand('SET', async () => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Use a simple set command for compatibility
      if (options.ttl && !options.nx && !options.xx) {
        return await this.client.setex(key, options.ttl, serializedValue);
      } else if (options.nx && !options.ttl) {
        const result = await this.client.setnx(key, serializedValue);
        return result ? 'OK' : 'null';
      } else {
        return await this.client.set(key, serializedValue);
      }
    });
  }

  /**
   * Multiple get operations
   */
  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    return this.executeCommand('MGET', async () => {
      const values = await this.client.mget(...keys);
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      });
    });
  }

  /**
   * Multiple set operations
   */
  async mset(keyValues: Record<string, any>): Promise<string> {
    return this.executeCommand('MSET', async () => {
      const args: any[] = [];
      for (const [key, value] of Object.entries(keyValues)) {
        args.push(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      return await this.client.mset(...args);
    });
  }

  /**
   * Delete key(s)
   */
  async del(...keys: string[]): Promise<number> {
    return this.executeCommand('DEL', async () => {
      const result = await this.client.del(...keys);
      logger.debug('Redis DEL successful', { keys, deleted: result });
      return result;
    });
  }

  /**
   * Check if key exists
   */
  async exists(...keys: string[]): Promise<number> {
    return this.executeCommand('EXISTS', async () => {
      return await this.client.exists(...keys);
    });
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    return this.executeCommand('EXPIRE', async () => {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    });
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    return this.executeCommand('TTL', async () => {
      return await this.client.ttl(key);
    });
  }

  /**
   * Increment operations
   */
  async incr(key: string): Promise<number> {
    return this.executeCommand('INCR', async () => {
      return await this.client.incr(key);
    });
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.executeCommand('INCRBY', async () => {
      return await this.client.incrby(key, increment);
    });
  }

  async decr(key: string): Promise<number> {
    return this.executeCommand('DECR', async () => {
      return await this.client.decr(key);
    });
  }

  /**
   * Hash operations
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.executeCommand('HGET', async () => {
      return await this.client.hget(key, field);
    });
  }

  async hset(key: string, field: string, value: any): Promise<number> {
    return this.executeCommand('HSET', async () => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.hset(key, field, serializedValue);
    });
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.executeCommand('HGETALL', async () => {
      return await this.client.hgetall(key);
    });
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.executeCommand('HDEL', async () => {
      return await this.client.hdel(key, ...fields);
    });
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: any[]): Promise<number> {
    return this.executeCommand('LPUSH', async () => {
      const serializedValues = values.map(v => 
        typeof v === 'string' ? v : JSON.stringify(v)
      );
      return await this.client.lpush(key, ...serializedValues);
    });
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    return this.executeCommand('RPUSH', async () => {
      const serializedValues = values.map(v => 
        typeof v === 'string' ? v : JSON.stringify(v)
      );
      return await this.client.rpush(key, ...serializedValues);
    });
  }

  async lpop(key: string): Promise<string | null> {
    return this.executeCommand('LPOP', async () => {
      return await this.client.lpop(key);
    });
  }

  async rpop(key: string): Promise<string | null> {
    return this.executeCommand('RPOP', async () => {
      return await this.client.rpop(key);
    });
  }

  async llen(key: string): Promise<number> {
    return this.executeCommand('LLEN', async () => {
      return await this.client.llen(key);
    });
  }

  /**
   * Set operations
   */
  async sadd(key: string, ...members: any[]): Promise<number> {
    return this.executeCommand('SADD', async () => {
      const serializedMembers = members.map(m => 
        typeof m === 'string' ? m : JSON.stringify(m)
      );
      return await this.client.sadd(key, ...serializedMembers);
    });
  }

  async srem(key: string, ...members: any[]): Promise<number> {
    return this.executeCommand('SREM', async () => {
      const serializedMembers = members.map(m => 
        typeof m === 'string' ? m : JSON.stringify(m)
      );
      return await this.client.srem(key, ...serializedMembers);
    });
  }

  async smembers(key: string): Promise<string[]> {
    return this.executeCommand('SMEMBERS', async () => {
      return await this.client.smembers(key);
    });
  }

  async sismember(key: string, member: any): Promise<boolean> {
    return this.executeCommand('SISMEMBER', async () => {
      const serializedMember = typeof member === 'string' ? member : JSON.stringify(member);
      const result = await this.client.sismember(key, serializedMember);
      return result === 1;
    });
  }

  /**
   * Pipeline operations for batch processing
   */
  async pipeline(operations: PipelineOperation[]): Promise<any[]> {
    return this.executeCommand('PIPELINE', async () => {
      const pipeline = this.client.pipeline();
      
      for (const op of operations) {
        (pipeline as any)[op.command](...op.args);
      }
      
      const results = await pipeline.exec();
      return results?.map(([err, result]) => {
        if (err) throw err;
        return result;
      }) || [];
    });
  }

  /**
   * Scan keys safely (replaces KEYS for production)
   */
  async scan(pattern: string, count = 100): Promise<string[]> {
    return this.executeCommand('SCAN', async () => {
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      return keys;
    });
  }

  /**
   * Flush database (use with caution)
   */
  async flushdb(): Promise<string> {
    return this.executeCommand('FLUSHDB', async () => {
      logger.warn('Flushing Redis database');
      return await this.client.flushdb();
    });
  }

  /**
   * Get Redis info
   */
  async getInfo(section?: string): Promise<string> {
    return this.executeCommand('INFO', async () => {
      return section ? await this.client.info(section) : await this.client.info();
    });
  }

  /**
   * Execute custom Redis command
   */
  async command(command: string, ...args: any[]): Promise<any> {
    return this.executeCommand('COMMAND', async () => {
      return await (this.client as any).call(command, ...args);
    });
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get metrics
   */
  getMetrics(): RedisMetrics {
    return { ...this.metrics };
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
  // Parse Redis URL if provided (priority)
  const redisUrl = process.env.REDIS_URL;
  let baseConfig: Partial<RedisConfig> = {};
  
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      baseConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        db: url.pathname ? parseInt(url.pathname.slice(1)) : 0,
      };
    } catch (error) {
      logger.error('Invalid REDIS_URL format, falling back to individual settings');
    }
  }

  // Merge with individual environment variables (can override URL settings)
  return {
    host: process.env.REDIS_HOST || baseConfig.host || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '') || baseConfig.port || 6379,
    password: process.env.REDIS_PASSWORD || baseConfig.password || undefined,
    db: parseInt(process.env.REDIS_DB || '') || baseConfig.db || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'moonx:',
    family: parseInt(process.env.REDIS_FAMILY || '4') as 4 | 6,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
    enableMetrics: process.env.REDIS_ENABLE_METRICS !== 'false',
    enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== 'false',
  };
} 