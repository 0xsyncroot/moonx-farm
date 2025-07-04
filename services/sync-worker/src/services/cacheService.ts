import { config } from '@/config';
import { logger } from '@/utils/logger';

interface CacheEntry {
  value: any;
  expiry: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private isConnected = false;

  constructor() {
    logger.info('🗄️ Cache service created');
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize cache service
   */
  async initialize(): Promise<void> {
    try {
      this.isConnected = true;
      
      logger.info('🗄️ Cache service initialized', {
        type: 'in-memory',
        maxSize: config.performance.cacheMaxSize,
      });
    } catch (error) {
      logger.error('Failed to initialize cache service', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = config.performance.cacheTtl): Promise<void> {
    try {
      // Check if cache is at max size
      if (this.cache.size >= config.performance.cacheMaxSize) {
        // Remove oldest entries (simple LRU approximation)
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      const expiry = Date.now() + (ttlSeconds * 1000);
      
      // Handle [object Object] issue by ensuring proper serialization
      let serializedValue = value;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        serializedValue = JSON.stringify(value);
      }
      
      this.cache.set(key, {
        value: serializedValue,
        expiry
      });

      logger.debug('Cache set', {
        key,
        ttl: ttlSeconds,
        size: this.cache.size,
      });
    } catch (error) {
      logger.error('Error setting cache value', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache value
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        logger.debug('Cache miss', { key });
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiry) {
        this.cache.delete(key);
        logger.debug('Cache expired', { key });
        return null;
      }

      // Handle corrupted cache data
      if (typeof entry.value === 'string' && entry.value === '[object Object]') {
        logger.warn('Corrupted cache data detected, removing', { key });
        this.cache.delete(key);
        return null;
      }

      // Deserialize if it's a JSON string
      let value = entry.value;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // If parsing fails, return the string value
        }
      }

      logger.debug('Cache hit', { key });
      return value as T;
    } catch (error) {
      logger.error('Error getting cache value', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete cache value
   */
  async del(key: string): Promise<void> {
    try {
      const deleted = this.cache.delete(key);
      
      logger.debug('Cache delete', {
        key,
        existed: deleted,
        size: this.cache.size,
      });
    } catch (error) {
      logger.error('Error deleting cache value', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return false;
      }

      // Check if expired
      if (Date.now() > entry.expiry) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking cache key existence', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const size = this.cache.size;
      this.cache.clear();
      
      logger.info('Cache cleared', { previousSize: size });
    } catch (error) {
      logger.error('Error clearing cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate?: number;
    expiredEntries: number;
  }> {
    try {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiry) {
          expiredCount++;
        }
      }

      return {
        size: this.cache.size,
        maxSize: config.performance.cacheMaxSize,
        expiredEntries: expiredCount,
      };
    } catch (error) {
      logger.error('Error getting cache stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        size: 0,
        maxSize: config.performance.cacheMaxSize,
        expiredEntries: 0,
      };
    }
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  async warmCache(): Promise<void> {
    if (!config.performance.enableCacheWarming) {
      return;
    }

    try {
      logger.info('🔥 Starting cache warming');
      
      // Add cache warming logic here
      // For example, preload common token metadata, price data, etc.
      
      logger.info('🔥 Cache warming completed');
    } catch (error) {
      logger.error('Error during cache warming', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if cache service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testKey = 'health_check';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 1);
      const retrieved = await this.get(testKey);
      await this.del(testKey);
      
      return retrieved !== null;
    } catch (error) {
      logger.error('Cache health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close cache service
   */
  async close(): Promise<void> {
    try {
      await this.clear();
      this.isConnected = false;
      
      logger.info('🗄️ Cache service closed');
    } catch (error) {
      logger.error('Error closing cache service', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiry) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.debug('Cleaned up expired cache entries', {
          cleanedCount,
          remainingSize: this.cache.size,
        });
      }
    } catch (error) {
      logger.error('Error cleaning up expired cache entries', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
} 