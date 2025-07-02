import { RedisManager, createRedisConfig } from '@moonx-farm/infrastructure';

export class CacheService {
  private redis: RedisManager;
  private defaultTTL: number;
  private isConnected: boolean = false;

  constructor() {
    // Get Redis configuration from @moonx/infrastructure (same as Auth Service)
    const redisConfig = createRedisConfig();
    
    // Use infrastructure Redis config directly
    const config = {
      ...redisConfig,
      keyPrefix: 'moonx:core:',  // Core Service specific prefix
    };
    
    this.redis = new RedisManager(config);
    this.defaultTTL = 300; // 5 minutes default
    
    console.log('✅ CacheService initialized with infrastructure Redis config');
    console.log('🔧 Redis config:', { host: config.host, port: config.port, db: config.db });
  }

  /**
   * Connect to Redis with error handling
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.isConnected = true;
      console.log('✅ CacheService connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Redis gracefully
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      console.log('⏹️ CacheService disconnected from Redis');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Get value from cache with proper error handling
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (!data) {
        return null;
      }
      
      // Handle JSON parsing safely
      try {
        // Check if data is already a string representation of "[object Object]"
        if (data === '[object Object]') {
          console.warn(`Found invalid cached data (stringified object) for key ${key}, clearing...`);
          await this.del(key);
          return null;
        }
        
        return JSON.parse(data) as T;
      } catch (parseError) {
        const dataPreview = typeof data === 'string' ? data.substring(0, 100) : String(data).substring(0, 100);
        console.warn(`Failed to parse cached data for key ${key}: ${parseError instanceof Error ? parseError.message : String(parseError)}, data preview: ${dataPreview}...`);
        // Clear invalid cached data
        await this.del(key);
        return null;
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL support
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;
      
      // Use Redis SET with EX option for TTL
      await this.redis.set(key, serialized);
      
      // Set expiration separately if TTL is provided
      if (expiration > 0) {
        await this.redis.expire(key, expiration);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache delete');
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('Redis not connected, assuming key does not exist');
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping expire');
      return false;
    }

    try {
      await this.redis.expire(key, seconds);
      return true; // Assume success if no error thrown
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL (time to live) for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      console.warn('Redis not connected, returning -1 for TTL');
      return -1;
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Test with a simple set/get operation
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'ok';
      
      await this.redis.set(testKey, testValue);
      const result = await this.redis.get(testKey);
      await this.redis.del(testKey);
      
      return result === testValue;
    } catch (error) {
      console.error('Redis health check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Clear multiple keys matching a pattern (use with caution)
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping pattern delete');
      return 0;
    }

    try {
      // Pattern deletion not implemented - would require Redis SCAN
      console.warn(`Pattern deletion requested for: ${pattern} - implementation needed`);
      return 0;
    } catch (error) {
      console.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all P&L cache for a specific user
   */
  async clearUserPnLCache(userId: string): Promise<void> {
    try {
      const pattern = `pnl:${userId}:*`;
      const deletedCount = await this.deletePattern(pattern);
      console.log(`🧹 Cleared ${deletedCount} P&L cache entries for user ${userId}`);
    } catch (error) {
      console.error(`Error clearing P&L cache for user ${userId}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    const baseStats = {
      connected: this.isConnected,
      keyCount: 0,
      memoryUsage: 'unknown'
    };

    if (!this.isConnected) {
      return baseStats;
    }

    try {
      // Simplified stats - in production you'd use Redis INFO command
      console.log('Cache stats requested - using simplified implementation');
      return {
        connected: this.isConnected,
        keyCount: 0, // Would need DBSIZE command
        memoryUsage: 'unknown' // Would need INFO memory command
      };
    } catch (error) {
      console.warn('Error getting Redis stats:', error);
      return baseStats;
    }
  }

  // Cache key generators with consistent patterns
  getUserPortfolioKey(userId: string): string {
    return `portfolio:${userId}`;
  }

  getUserTradesKey(userId: string, page: number, filters?: string): string {
    const filterHash = filters ? `:${Buffer.from(filters).toString('base64').slice(0, 8)}` : '';
    return `trades:${userId}:${page}${filterHash}`;
  }

  getUserAnalyticsKey(userId: string, timeframe: string): string {
    return `analytics:${userId}:${timeframe}`;
  }

  getTokenPriceKey(tokenAddress: string, chainId: number): string {
    return `price:${chainId}:${tokenAddress.toLowerCase()}`;
  }

  getUserOrdersKey(userId: string, filters?: string): string {
    const filterHash = filters ? `:${Buffer.from(filters).toString('base64').slice(0, 8)}` : '';
    return `orders:${userId}${filterHash}`;
  }

  getOrderKey(orderId: string): string {
    return `order:${orderId}`;
  }

  getSyncLockKey(userId: string, walletAddress: string): string {
    return `sync_lock:${userId}:${walletAddress}`;
  }

  /**
   * Batch get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const results = await this.redis.mget(...keys);
      return results.map(result => {
        if (!result) return null;
        
        try {
          return JSON.parse(result) as T;
        } catch (parseError) {
          console.warn('Failed to parse batch cached data:', parseError);
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    if (!this.isConnected || keyValuePairs.length === 0) {
      return;
    }

    try {
      // Set all values first
      const setPromises = keyValuePairs.map(async ({ key, value, ttl }) => {
        const serialized = JSON.stringify(value);
        await this.redis.set(key, serialized);
        
        // Set expiration if TTL is provided
        if (ttl && ttl > 0) {
          await this.redis.expire(key, ttl);
        }
      });

      await Promise.allSettled(setPromises);
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  /**
   * Check connection status
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Reconnect to Redis if disconnected
   */
  async reconnect(): Promise<void> {
    if (this.isConnected) {
      console.log('Redis already connected');
      return;
    }

    console.log('Attempting to reconnect to Redis...');
    await this.connect();
  }
} 