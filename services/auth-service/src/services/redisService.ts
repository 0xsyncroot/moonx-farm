import { RedisManager } from '@moonx-farm/infrastructure';
import { createLogger, LogContext } from '@moonx-farm/common';

const logger = createLogger('auth-redis-service');

/**
 * Authentication-specific Redis service
 * Contains domain logic for auth/session/token management
 * Delegates generic Redis operations to infrastructure RedisManager
 */
export class RedisService {
  private redis: RedisManager;

  constructor(redis: RedisManager) {
    this.redis = redis;
  }

  // === TOKEN BLACKLIST OPERATIONS ===
  
  /**
   * Blacklist a JWT token (for logout/security)
   */
  async blacklistToken(tokenId: string, ttl: number): Promise<void> {
    try {
      const key = `blacklist:${tokenId}`;
      await this.redis.set(key, '1', { ttl });
      logger.debug('Token blacklisted successfully', { tokenId: tokenId.substring(0, 8) + '...' });
    } catch (error) {
      const logContext: LogContext = { 
        tokenId: tokenId.substring(0, 8) + '...', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to blacklist token', logContext);
      throw error;
    }
  }

  /**
   * Check if a JWT token is blacklisted
   */
  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const key = `blacklist:${tokenId}`;
      const result = await this.redis.exists(key);
      const blacklisted = result > 0;
      logger.debug('Token blacklist checked', { tokenId: tokenId.substring(0, 8) + '...', blacklisted });
      return blacklisted;
    } catch (error) {
      const logContext: LogContext = { 
        tokenId: tokenId.substring(0, 8) + '...', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to check token blacklist', logContext);
      return false;
    }
  }

  // === REFRESH TOKEN OPERATIONS ===
  
  /**
   * Store refresh token with user-specific namespacing
   */
  async setRefreshToken(userId: string, tokenId: string, ttl: number): Promise<void> {
    try {
      const key = `refresh:${userId}:${tokenId}`;
      await this.redis.set(key, '1', { ttl });
      logger.debug('Refresh token stored successfully', { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...' 
      });
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to store refresh token', logContext);
      throw error;
    }
  }

  /**
   * Check if refresh token exists and is valid
   */
  async isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
    try {
      const key = `refresh:${userId}:${tokenId}`;
      const result = await this.redis.exists(key);
      const valid = result > 0;
      logger.debug('Refresh token validity checked', { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...', 
        valid 
      });
      return valid;
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to check refresh token', logContext);
      return false;
    }
  }

  /**
   * Delete specific refresh token
   */
  async deleteRefreshToken(userId: string, tokenId: string): Promise<void> {
    try {
      const key = `refresh:${userId}:${tokenId}`;
      await this.redis.del(key);
      logger.debug('Refresh token deleted successfully', { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...' 
      });
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete refresh token', logContext);
      throw error;
    }
  }

  /**
   * Delete all refresh tokens for user (logout all sessions)
   */
  async deleteAllRefreshTokens(userId: string): Promise<void> {
    try {
      const pattern = `refresh:${userId}:*`;
      const keys = await this.redis.scan(pattern);
      if (keys.length > 0) {
        const deleted = await this.redis.del(...keys);
        logger.debug('All refresh tokens deleted', { userId, deletedCount: deleted });
      } else {
        logger.debug('No refresh tokens found to delete', { userId });
      }
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete all refresh tokens', logContext);
      throw error;
    }
  }

  // === RATE LIMITING OPERATIONS ===
  
  /**
   * Intelligent rate limiting with auth-specific logic
   */
  async incrementRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{
    count: number;
    ttl: number;
    exceeded: boolean;
  }> {
    try {
      const key = `ratelimit:${identifier}`;
      const windowSeconds = Math.ceil(windowMs / 1000);
      
      // Use Redis pipeline for atomic operations
      const client = this.redis.getClient();
      const pipeline = client.pipeline();
      
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      
      if (!results || results.length < 3) {
        throw new Error('Pipeline execution failed');
      }
      
      const count = results[0]?.[1] as number || 0;
      const ttl = results[2]?.[1] as number || windowSeconds;
      const exceeded = count > maxRequests;
      
      logger.debug('Rate limit checked', { identifier, count, maxRequests, exceeded });
      
      return { count, ttl, exceeded };
    } catch (error) {
      const logContext: LogContext = { 
        identifier, 
        windowMs, 
        maxRequests, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to increment rate limit', logContext);
      throw error;
    }
  }

  // === USER CACHE OPERATIONS ===
  
  /**
   * Cache user data for auth performance
   */
  async setUserCache(userId: string, userData: any, ttl: number = 300): Promise<void> {
    try {
      const key = `user:${userId}`;
      await this.redis.set(key, userData, { ttl });
      logger.debug('User cache stored successfully', { userId });
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to store user cache', logContext);
      throw error;
    }
  }

  /**
   * Get cached user data
   */
  async getUserCache(userId: string): Promise<any | null> {
    try {
      const key = `user:${userId}`;
      const data = await this.redis.get(key);
      logger.debug('User cache retrieved', { userId, found: !!data });
      return data;
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get user cache', logContext);
      return null;
    }
  }

  /**
   * Clear user cache
   */
  async deleteUserCache(userId: string): Promise<void> {
    try {
      const key = `user:${userId}`;
      await this.redis.del(key);
      logger.debug('User cache deleted successfully', { userId });
    } catch (error) {
      const logContext: LogContext = { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete user cache', logContext);
      throw error;
    }
  }

  // === SESSION OPERATIONS ===
  
  /**
   * Store session data in Redis (for fast access)
   */
  async setSession(sessionId: string, sessionData: any, ttl: number = 86400): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.redis.set(key, sessionData, { ttl });
      logger.debug('Session stored successfully', { sessionId });
    } catch (error) {
      const logContext: LogContext = { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to store session', logContext);
      throw error;
    }
  }

  /**
   * Get session data from Redis
   */
  async getSession(sessionId: string): Promise<any | null> {
    try {
      const key = `session:${sessionId}`;
      const data = await this.redis.get(key);
      logger.debug('Session retrieved', { sessionId, found: !!data });
      return data;
    } catch (error) {
      const logContext: LogContext = { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to get session', logContext);
      return null;
    }
  }

  /**
   * Delete session from Redis
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.redis.del(key);
      logger.debug('Session deleted successfully', { sessionId });
    } catch (error) {
      const logContext: LogContext = { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Failed to delete session', logContext);
      throw error;
    }
  }

  // === GENERIC OPERATIONS (Delegates to infrastructure) ===
  
  /**
   * Generic cache operations - delegates to infrastructure RedisManager
   * Use only when domain-specific methods above don't fit your needs
   */
  async set(key: string, value: any, options?: { ttl?: number }): Promise<void> {
    await this.redis.set(key, value, options);
  }

  async get(key: string): Promise<any | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result > 0;
  }

  /**
   * Health check - delegates to infrastructure layer
   */
  async ping(): Promise<boolean> {
    return this.redis.isHealthy();
  }
}