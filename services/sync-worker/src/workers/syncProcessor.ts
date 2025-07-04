import { randomUUID } from 'crypto';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { DatabaseService } from '@/services/databaseService';
import { CacheService } from '@/services/cacheService';
import { SyncJobData, SyncJobResult, CircuitBreakerState, RateLimitInfo } from '@/types';

// Mock Alchemy service interface for now
interface AlchemyService {
  getFullPortfolio(walletAddress: string, chainIds: string[]): Promise<any[]>;
  getSupportedChains(): string[];
}

// Mock implementation - replace with actual Alchemy service
class MockAlchemyService implements AlchemyService {
  getSupportedChains(): string[] {
    return ['1', '137', '42161', '56']; // Ethereum, Polygon, Arbitrum, BSC
  }

  async getFullPortfolio(walletAddress: string, chainIds: string[]): Promise<any[]> {
    // Mock portfolio data - replace with actual Alchemy integration
    return [
      {
        id: randomUUID(),
        chainId: '1',
        tokenAddress: '0xa0b86a33e6441c8c6b67a8b5b6c8c5b7a5d5a5d5',
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        tokenDecimals: 6,
        balance: '1000000000',
        balanceFormatted: 1000,
        priceUSD: 1.0,
        valueUSD: 1000,
        alchemyData: {}
      }
    ];
  }
}

export class SyncProcessor {
  private databaseService: DatabaseService;
  private cacheService: CacheService;
  private alchemyService: AlchemyService;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();

  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 sync requests per user
  private readonly MIN_SYNC_INTERVAL = 5 * 60 * 1000; // Minimum 5 minutes between syncs

  constructor(
    databaseService: DatabaseService,
    cacheService: CacheService
  ) {
    this.databaseService = databaseService;
    this.cacheService = cacheService;
    this.alchemyService = new MockAlchemyService(); // Replace with actual service
    
    logger.info('🔄 Sync processor initialized');
  }

  /**
   * Process sync job
   */
  async processJob(job: {
    id: string;
    data: SyncJobData;
    priority: 'high' | 'medium' | 'low';
  }): Promise<SyncJobResult> {
    const startTime = Date.now();
    
    try {
      logger.info('🔄 Starting sync job', {
        jobId: job.id,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        priority: job.priority,
      });

      // Check rate limiting
      const rateLimitCheck = this.checkRateLimit(job.data.userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded for user ${job.data.userId}`);
      }

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(job.data.userId)) {
        throw new Error(`Circuit breaker open for user ${job.data.userId}`);
      }

      // Create sync operation record
      const syncId = randomUUID();
      const syncOperation: {
        id: string;
        userId: string;
        walletAddress: string;
        type: string;
        status: string;
        startedAt: Date;
        completedAt?: Date;
        error?: string;
        metadata?: Record<string, any>;
      } = {
        id: syncId,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        type: 'portfolio',
        status: 'running',
        startedAt: new Date(),
        metadata: {
          chainsCount: job.data.chainIds?.length || this.alchemyService.getSupportedChains().length,
          priority: job.priority,
          jobId: job.id,
        }
      };

      await this.databaseService.saveSyncOperation(syncOperation);

      // Perform the actual sync
      const result = await this.performPortfolioSync(job.data, syncId);

      // Update sync operation as completed
      syncOperation.status = 'completed';
      syncOperation.completedAt = new Date();
      syncOperation.metadata = {
        ...syncOperation.metadata,
        tokensCount: result.tokensSync,
        totalValueUsd: result.totalValueUsd,
      };

      await this.databaseService.saveSyncOperation(syncOperation);

      // Update user sync status
      await this.databaseService.updateUserSyncStatus(
        job.data.userId,
        job.data.walletAddress,
        job.priority
      );

      // Record success for circuit breaker
      this.recordSuccess(job.data.userId);

      // Update rate limit
      this.updateRateLimit(job.data.userId);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Sync job completed', {
        jobId: job.id,
        userId: job.data.userId,
        processingTime: `${processingTime}ms`,
        tokensSync: result.tokensSync,
        totalValueUsd: result.totalValueUsd,
      });

      return {
        success: true,
        jobId: job.id,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        processingTime,
        tokensSync: result.tokensSync,
        chainsSync: result.chainsSync,
        totalValueUsd: result.totalValueUsd,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure for circuit breaker
      this.recordFailure(job.data.userId);

      // Update sync operation as failed
      const syncOperation = {
        id: randomUUID(),
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        type: 'portfolio',
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        error: errorMessage,
        metadata: {
          jobId: job.id,
          priority: job.priority,
        }
      };

      await this.databaseService.saveSyncOperation(syncOperation);

      logger.error('❌ Sync job failed', {
        jobId: job.id,
        userId: job.data.userId,
        error: errorMessage,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: false,
        jobId: job.id,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        processingTime,
        tokensSync: 0,
        chainsSync: 0,
        totalValueUsd: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Perform actual portfolio sync
   */
  private async performPortfolioSync(
    jobData: SyncJobData,
    syncId: string
  ): Promise<{
    tokensSync: number;
    chainsSync: number;
    totalValueUsd: number;
  }> {
    try {
      const { userId, walletAddress, chainIds, forceRefresh } = jobData;

      // Check cache first (if not force refresh)
      if (!forceRefresh) {
        const cacheKey = `portfolio:${userId}:${walletAddress}`;
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached && this.isCacheValid(cached.lastSynced)) {
          logger.info('📦 Using cached portfolio data', {
            userId,
            walletAddress,
            syncId,
          });

          return {
            tokensSync: cached.holdings?.length || 0,
            chainsSync: chainIds?.length || this.alchemyService.getSupportedChains().length,
            totalValueUsd: cached.totalValueUSD || 0,
          };
        }
      }

      const chainsToSync = chainIds || this.alchemyService.getSupportedChains();

      // Fetch fresh data from Alchemy
      logger.info('🔄 Fetching portfolio from Alchemy', {
        userId,
        walletAddress,
        chains: chainsToSync.length,
        syncId,
      });

      const holdings = await this.alchemyService.getFullPortfolio(
        walletAddress,
        chainsToSync
      );

      // Add userId to all holdings
      const holdingsWithUser = holdings.map(holding => ({
        ...holding,
        userId,
        id: holding.id || randomUUID(),
      }));

      // Save to database
      await this.databaseService.savePortfolioHoldings(
        userId,
        walletAddress,
        holdingsWithUser
      );

      // Calculate total value
      const totalValueUsd = holdingsWithUser.reduce((sum, h) => sum + (h.valueUSD || 0), 0);

      // Cache the portfolio
      const portfolioData = {
        id: `${userId}_${walletAddress}`,
        userId,
        walletAddress,
        chainId: 0, // Multi-chain portfolio
        totalValueUSD: totalValueUsd,
        holdings: holdingsWithUser,
        lastSynced: new Date(),
        syncStatus: 'completed'
      };

      const cacheKey = `portfolio:${userId}:${walletAddress}`;
      await this.cacheService.set(cacheKey, portfolioData, 300); // 5 minutes TTL

      logger.info('💾 Portfolio sync completed', {
        userId,
        walletAddress,
        tokensCount: holdingsWithUser.length,
        chainsCount: chainsToSync.length,
        totalValueUsd,
        syncId,
      });

      return {
        tokensSync: holdingsWithUser.length,
        chainsSync: chainsToSync.length,
        totalValueUsd,
      };

    } catch (error) {
      logger.error('Error performing portfolio sync', {
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        error: error instanceof Error ? error.message : String(error),
        syncId,
      });
      throw error;
    }
  }

  /**
   * Check if cache data is valid (within acceptable age)
   */
  private isCacheValid(lastSynced: string | Date): boolean {
    try {
      const syncTime = new Date(lastSynced);
      const now = new Date();
      const diffMinutes = (now.getTime() - syncTime.getTime()) / (1000 * 60);
      
      // Cache is valid if last sync was less than 5 minutes ago
      return diffMinutes < 5;
    } catch {
      return false;
    }
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(userId: string): { allowed: boolean; remainingRequests?: number; resetTime?: Date } {
    try {
      const now = Date.now();
      const userRateLimit = this.rateLimitMap.get(userId);

      if (!userRateLimit) {
        return { allowed: true };
      }

      // Check if rate limit window has expired
      if (now > userRateLimit.resetTime.getTime()) {
        // Reset rate limit
        this.rateLimitMap.delete(userId);
        return { allowed: true };
      }

      // Check if user has exceeded rate limit
      if (userRateLimit.requests >= this.RATE_LIMIT_MAX_REQUESTS) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: userRateLimit.resetTime
        };
      }

      return {
        allowed: true,
        remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - userRateLimit.requests,
        resetTime: userRateLimit.resetTime
      };

    } catch (error) {
      logger.error('Error checking rate limit', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true }; // Allow on error
    }
  }

  /**
   * Update rate limit for user
   */
  private updateRateLimit(userId: string): void {
    try {
      const now = Date.now();
      const resetTime = new Date(now + this.RATE_LIMIT_WINDOW);
      const userRateLimit = this.rateLimitMap.get(userId);

      if (!userRateLimit || now > userRateLimit.resetTime.getTime()) {
        // Create new rate limit entry
        this.rateLimitMap.set(userId, {
          userId,
          requests: 1,
          resetTime,
          isLimited: false
        });
      } else {
        // Update existing rate limit
        userRateLimit.requests++;
        userRateLimit.isLimited = userRateLimit.requests >= this.RATE_LIMIT_MAX_REQUESTS;
        this.rateLimitMap.set(userId, userRateLimit);
      }

    } catch (error) {
      logger.error('Error updating rate limit', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Circuit breaker check
   */
  private isCircuitBreakerOpen(userId: string): boolean {
    if (!config.performance.enableCircuitBreaker) {
      return false;
    }

    try {
      const circuitState = this.circuitBreaker.get(userId);
      
      if (!circuitState) {
        return false;
      }

      if (circuitState.state === 'open') {
        // Check if enough time has passed to try half-open
        const now = Date.now();
        if (circuitState.nextAttemptTime && now > circuitState.nextAttemptTime.getTime()) {
          circuitState.state = 'half-open';
          this.circuitBreaker.set(userId, circuitState);
          return false;
        }
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Error checking circuit breaker', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(userId: string): void {
    if (!config.performance.enableCircuitBreaker) {
      return;
    }

    try {
      const circuitState = this.circuitBreaker.get(userId) || {
        state: 'closed' as const,
        failureCount: 0,
        successCount: 0
      };

      circuitState.failureCount++;
      circuitState.lastFailureTime = new Date();

      if (circuitState.failureCount >= config.worker.circuitBreakerThreshold) {
        circuitState.state = 'open';
        circuitState.nextAttemptTime = new Date(
          Date.now() + config.worker.circuitBreakerTimeout
        );

        logger.warn('🚨 Circuit breaker opened', {
          userId,
          failureCount: circuitState.failureCount,
          nextAttemptTime: circuitState.nextAttemptTime,
        });
      }

      this.circuitBreaker.set(userId, circuitState);

    } catch (error) {
      logger.error('Error recording circuit breaker failure', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(userId: string): void {
    if (!config.performance.enableCircuitBreaker) {
      return;
    }

    try {
      const circuitState = this.circuitBreaker.get(userId);
      
      if (!circuitState) {
        return;
      }

      circuitState.successCount++;

      if (circuitState.state === 'half-open') {
        // Reset circuit breaker to closed state
        circuitState.state = 'closed';
        circuitState.failureCount = 0;
        circuitState.successCount = 0;
        delete circuitState.lastFailureTime;
        delete circuitState.nextAttemptTime;

        logger.info('✅ Circuit breaker closed', { userId });
      }

      this.circuitBreaker.set(userId, circuitState);

    } catch (error) {
      logger.error('Error recording circuit breaker success', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    circuitBreakers: number;
    rateLimits: number;
    activeCircuitBreakers: number;
  } {
    try {
      let activeCircuitBreakers = 0;
      
      for (const [, state] of this.circuitBreaker.entries()) {
        if (state.state === 'open') {
          activeCircuitBreakers++;
        }
      }

      return {
        circuitBreakers: this.circuitBreaker.size,
        rateLimits: this.rateLimitMap.size,
        activeCircuitBreakers,
      };

    } catch (error) {
      logger.error('Error getting processor stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        circuitBreakers: 0,
        rateLimits: 0,
        activeCircuitBreakers: 0,
      };
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    try {
      const now = Date.now();
      
      // Clean up expired rate limits
      for (const [userId, rateLimit] of this.rateLimitMap.entries()) {
        if (now > rateLimit.resetTime.getTime()) {
          this.rateLimitMap.delete(userId);
        }
      }

      // Clean up old circuit breaker states
      for (const [userId, circuitState] of this.circuitBreaker.entries()) {
        if (circuitState.nextAttemptTime && now > circuitState.nextAttemptTime.getTime() + (24 * 60 * 60 * 1000)) {
          // Remove circuit breaker states older than 24 hours
          this.circuitBreaker.delete(userId);
        }
      }

      logger.debug('Cleanup completed', {
        rateLimits: this.rateLimitMap.size,
        circuitBreakers: this.circuitBreaker.size,
      });

    } catch (error) {
      logger.error('Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
} 