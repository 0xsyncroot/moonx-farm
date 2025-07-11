import { FastifyRequest } from 'fastify';
import { createRedis, createRedisConfig } from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';
import { WebSocketClient } from '../types';

const logger = createLogger('rate-limit-middleware');

export class WebSocketRateLimiter {
  private readonly redis;
  private readonly keyPrefix = `${websocketConfig.redis.keyPrefix}ratelimit:`;
  private readonly config = websocketConfig.rateLimit;
  private readonly connectionCounts = new Map<string, number>();
  private readonly messageCounts = new Map<string, Map<string, number>>();

  constructor() {
    const config = createRedisConfig();
    this.redis = createRedis(config);
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Rate limiter initialized with Redis');
      
      // Start cleanup interval for local counters
      setInterval(() => {
        this.cleanupLocalCounters();
      }, 60000); // Cleanup every minute
      
    } catch (error) {
      logger.error('Failed to initialize rate limiter', { error });
      throw error;
    }
  }

  /**
   * Check if connection is allowed based on IP address
   */
  async checkConnectionLimit(request: FastifyRequest): Promise<{ allowed: boolean; error?: string }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    try {
      const clientIp = this.getClientIp(request);
      const connectionKey = `conn:${clientIp}`;
      
      // Get current connection count for this IP
      const currentConnections = await this.redis.get<number>(connectionKey) || 0;
      
      if (currentConnections >= this.config.maxConnectionsPerIp) {
        logger.warn('Connection limit exceeded', {
          clientIp,
          currentConnections,
          maxAllowed: this.config.maxConnectionsPerIp
        });
        
        return {
          allowed: false,
          error: `Too many connections from IP. Maximum ${this.config.maxConnectionsPerIp} connections allowed.`
        };
      }

      // Increment connection count
      await this.redis.incr(connectionKey);
      await this.redis.expire(connectionKey, Math.ceil(this.config.windowSize / 1000));

      // Track locally for cleanup
      this.connectionCounts.set(clientIp, (this.connectionCounts.get(clientIp) || 0) + 1);

      logger.debug('Connection allowed', {
        clientIp,
        currentConnections: currentConnections + 1,
        maxAllowed: this.config.maxConnectionsPerIp
      });

      return { allowed: true };
      
    } catch (error) {
      logger.error('Failed to check connection limit', { error });
      // Allow connection on Redis failure (fail open)
      return { allowed: true };
    }
  }

  /**
   * Check if message is allowed based on rate limits
   */
  async checkMessageLimit(client: WebSocketClient): Promise<{ allowed: boolean; error?: string }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    try {
      const clientIp = client.metadata.ip || 'unknown';
      const userId = client.userId;
      const now = Date.now();
      const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window
      
      // Check IP-based rate limit
      const ipKey = `msg:ip:${clientIp}:${windowStart}`;
      const ipMessages = await this.redis.get<number>(ipKey) || 0;
      
      if (ipMessages >= this.config.maxMessagesPerMinute) {
        logger.warn('IP message rate limit exceeded', {
          clientIp,
          userId,
          currentMessages: ipMessages,
          maxAllowed: this.config.maxMessagesPerMinute
        });
        
        return {
          allowed: false,
          error: `Too many messages from IP. Maximum ${this.config.maxMessagesPerMinute} messages per minute allowed.`
        };
      }

      // Check user-based rate limit (stricter)
      const userKey = `msg:user:${userId}:${windowStart}`;
      const userMessages = await this.redis.get<number>(userKey) || 0;
      const userLimit = Math.floor(this.config.maxMessagesPerMinute * 0.8); // 80% of IP limit per user
      
      if (userMessages >= userLimit) {
        logger.warn('User message rate limit exceeded', {
          clientIp,
          userId,
          currentMessages: userMessages,
          maxAllowed: userLimit
        });
        
        return {
          allowed: false,
          error: `Too many messages from user. Maximum ${userLimit} messages per minute allowed.`
        };
      }

      // Increment counters
      await Promise.all([
        this.incrementMessageCounter(ipKey),
        this.incrementMessageCounter(userKey)
      ]);

      // Track locally for metrics
      this.updateLocalMessageCount(clientIp, userId);

      logger.debug('Message allowed', {
        clientIp,
        userId,
        ipMessages: ipMessages + 1,
        userMessages: userMessages + 1
      });

      return { allowed: true };
      
    } catch (error) {
      logger.error('Failed to check message limit', { error, userId: client.userId });
      // Allow message on Redis failure (fail open)
      return { allowed: true };
    }
  }

  /**
   * Release connection when client disconnects
   */
  async releaseConnection(request: FastifyRequest): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const clientIp = this.getClientIp(request);
      const connectionKey = `conn:${clientIp}`;
      
      // Decrement connection count
      const current = await this.redis.get<number>(connectionKey) || 0;
      if (current > 0) {
        await this.redis.decr(connectionKey);
      }

      // Update local tracking
      const localCount = this.connectionCounts.get(clientIp) || 0;
      if (localCount > 0) {
        this.connectionCounts.set(clientIp, localCount - 1);
      }

      logger.debug('Connection released', {
        clientIp,
        remainingConnections: Math.max(0, current - 1)
      });
      
    } catch (error) {
      logger.error('Failed to release connection', { error });
    }
  }

  /**
   * Get rate limit status for monitoring
   */
  async getRateLimitStatus(clientIp?: string, userId?: string): Promise<{
    enabled: boolean;
    connections?: number;
    messageRate?: number;
    limits: {
      maxConnections: number;
      maxMessagesPerMinute: number;
      windowSize: number;
    };
  }> {
    const status = {
      enabled: this.config.enabled,
      limits: {
        maxConnections: this.config.maxConnectionsPerIp,
        maxMessagesPerMinute: this.config.maxMessagesPerMinute,
        windowSize: this.config.windowSize
      }
    };

    if (!this.config.enabled) {
      return status;
    }

    try {
      if (clientIp) {
        const connectionKey = `conn:${clientIp}`;
        const connections = await this.redis.get<number>(connectionKey) || 0;
        
        const now = Date.now();
        const windowStart = Math.floor(now / 60000) * 60000;
        const messageKey = `msg:ip:${clientIp}:${windowStart}`;
        const messageRate = await this.redis.get<number>(messageKey) || 0;
        
        return {
          ...status,
          connections,
          messageRate
        };
      }
    } catch (error) {
      logger.error('Failed to get rate limit status', { error });
    }

    return status;
  }

  /**
   * Reset rate limits for testing purposes
   */
  async resetRateLimits(clientIp?: string, userId?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      if (clientIp) {
        // Clear IP-based limits
        const connectionKey = `conn:${clientIp}`;
        await this.redis.del(connectionKey);
        
        // Clear message limits (current window)
        const now = Date.now();
        const windowStart = Math.floor(now / 60000) * 60000;
        const messageKey = `msg:ip:${clientIp}:${windowStart}`;
        await this.redis.del(messageKey);
        
        this.connectionCounts.delete(clientIp);
      }

      if (userId) {
        // Clear user-based message limits
        const now = Date.now();
        const windowStart = Math.floor(now / 60000) * 60000;
        const userMessageKey = `msg:user:${userId}:${windowStart}`;
        await this.redis.del(userMessageKey);
      }

      logger.info('Rate limits reset', { clientIp, userId });
      
    } catch (error) {
      logger.error('Failed to reset rate limits', { error });
    }
  }

  /**
   * Helper methods
   */
  private getClientIp(request: FastifyRequest): string {
    // Priority 1: X-Real-IP (set by nginx with $remote_addr - real client IP)
    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp && typeof xRealIp === 'string') {
      return xRealIp.trim();
    }

    // Priority 2: X-Forwarded-For (may contain chain of IPs, take the first one)
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // Handle both string and array cases
      const forwardedIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      if (typeof forwardedIp === 'string' && forwardedIp.trim()) {
        // Take the first IP in the chain (original client IP)
        const firstIp = forwardedIp.split(',')[0];
        if (firstIp) {
          return firstIp.trim();
        }
      }
    }

    // Priority 3: X-Forwarded (less common but sometimes used)
    const xForwarded = request.headers['x-forwarded'];
    if (xForwarded && typeof xForwarded === 'string') {
      const match = xForwarded.match(/for=([^;,\s]+)/);
      if (match && match[1]) {
        return match[1].replace(/"/g, '').trim();
      }
    }

    // Priority 4: Fastify's parsed IP (fallback)
    return request.ip || 'unknown';
  }

  private async incrementMessageCounter(key: string): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      // Set expiration on first increment
      await this.redis.expire(key, 120); // 2 minutes TTL
    }
  }

  private updateLocalMessageCount(clientIp: string, userId: string): void {
    // Update IP counter
    if (!this.messageCounts.has(clientIp)) {
      this.messageCounts.set(clientIp, new Map());
    }
    const ipCounts = this.messageCounts.get(clientIp)!; // Safe because we just set it above
    const now = Math.floor(Date.now() / 60000);
    ipCounts.set(userId, (ipCounts.get(userId) || 0) + 1);
  }

  private cleanupLocalCounters(): void {
    // Clean up old message counts (older than 2 minutes)
    const cutoff = Math.floor(Date.now() / 60000) - 2;
    
    for (const [ip, userCounts] of this.messageCounts) {
      for (const [userId, count] of userCounts) {
        // Check if count is older than cutoff (this logic needs to be different)
        // For now, just remove entries with count 0
        if (count <= 0) {
          userCounts.delete(userId);
        }
      }
      if (userCounts.size === 0) {
        this.messageCounts.delete(ip);
      }
    }

    // Clean up connection counts with no connections
    for (const [ip, count] of this.connectionCounts) {
      if (count <= 0) {
        this.connectionCounts.delete(ip);
      }
    }
  }

  /**
   * Shutdown rate limiter
   */
  async shutdown(): Promise<void> {
    try {
      // Clear local state first
      this.connectionCounts.clear();
      this.messageCounts.clear();
      
      // Safely disconnect Redis
      try {
        await this.redis.disconnect();
        logger.debug('Rate limiter Redis disconnected');
      } catch (error) {
        logger.warn('Rate limiter Redis disconnect failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      logger.info('Rate limiter shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown rate limiter', { error });
    }
  }
}

// Export singleton instance
export const rateLimiter = new WebSocketRateLimiter();

/**
 * Middleware functions for Fastify integration
 */
export async function connectionRateLimitMiddleware(request: FastifyRequest): Promise<void> {
  const result = await rateLimiter.checkConnectionLimit(request);
  
  if (!result.allowed) {
    throw new Error(result.error || 'Connection rate limit exceeded');
  }
}

export async function messageRateLimitMiddleware(client: WebSocketClient): Promise<void> {
  const result = await rateLimiter.checkMessageLimit(client);
  
  if (!result.allowed) {
    throw new Error(result.error || 'Message rate limit exceeded');
  }
} 