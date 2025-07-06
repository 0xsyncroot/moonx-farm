import { randomUUID } from 'crypto';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AlchemyService, TokenBalance } from '@/services/alchemyService';
import { DatabaseService, TokenHolding, SyncOperation } from '@/services/databaseService';
import { KafkaEventPublisher } from '@/services/kafkaEventPublisher';
import { SyncJobData, SyncJobResult, CircuitBreakerState, RateLimitInfo } from '@/types';

export class SyncProcessor {
  private alchemyService: AlchemyService;
  private databaseService: DatabaseService;
  private kafkaEventPublisher: KafkaEventPublisher | undefined;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();

  // Worker identification
  private readonly workerId: string;
  private readonly workerVersion: string;

  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 sync requests per user
  private readonly MIN_SYNC_INTERVAL = 5 * 60 * 1000; // Minimum 5 minutes between syncs

  constructor(
    alchemyService: AlchemyService, 
    databaseService: DatabaseService,
    kafkaEventPublisher?: KafkaEventPublisher
  ) {
    this.alchemyService = alchemyService;
    this.databaseService = databaseService;
    this.kafkaEventPublisher = kafkaEventPublisher;
    
    // Set worker identification
    this.workerId = `sync-worker-${randomUUID().substring(0, 8)}`;
    this.workerVersion = process.env.npm_package_version || '1.0.0';
    
    logger.info('🔄 Sync processor initialized', {
      workerId: this.workerId,
      workerVersion: this.workerVersion,
      kafkaEnabled: !!this.kafkaEventPublisher,
    });
  }

  /**
   * Initialize and recover states from database
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔄 Initializing sync processor and recovering states from database...');
      
      // Load circuit breaker states from database
      await this.loadCircuitBreakerStates();
      
      // Load rate limiting states from database
      await this.loadRateLimitStates();
      
      logger.info('✅ Sync processor initialized with state recovery', {
        circuitBreakers: this.circuitBreaker.size,
        rateLimits: this.rateLimitMap.size,
        workerId: this.workerId,
      });
    } catch (error) {
      logger.error('❌ Failed to initialize sync processor state recovery', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load circuit breaker states from database
   */
  private async loadCircuitBreakerStates(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Get recent failed sync operations grouped by user
      const query = `
        SELECT 
          user_id,
          COUNT(*) as failure_count,
          MAX(completed_at) as last_failure_time,
          array_agg(error_message ORDER BY completed_at DESC) as recent_errors
        FROM sync_operations 
        WHERE status = 'failed' 
        AND completed_at >= $1
        GROUP BY user_id
        HAVING COUNT(*) >= 3
      `;
      
      const result = await this.databaseService.query(query, [oneHourAgo]);
      
      // Rebuild circuit breaker states
      for (const row of result.rows) {
        const userId = row.user_id;
        const failureCount = parseInt(row.failure_count);
        const lastFailureTime = new Date(row.last_failure_time);
        
        const circuitBreakerState: CircuitBreakerState = {
          state: 'open',
          failureCount,
          lastFailureTime,
          nextAttemptTime: new Date(lastFailureTime.getTime() + 15 * 60 * 1000), // 15 minutes timeout
          successCount: 0,
        };
        
        this.circuitBreaker.set(userId, circuitBreakerState);
        
        logger.warn('🔴 Circuit breaker restored as OPEN', {
          userId,
          failureCount,
          lastFailureTime,
          nextAttemptTime: circuitBreakerState.nextAttemptTime,
        });
      }

      // Also check user_sync_status for additional context
      const statusQuery = `
        SELECT user_id, consecutive_failures, last_error_at, is_sync_enabled
        FROM user_sync_status 
        WHERE consecutive_failures >= 3 
        AND last_error_at >= $1
        AND is_sync_enabled = true
      `;
      
      const statusResult = await this.databaseService.query(statusQuery, [oneHourAgo]);
      
      for (const row of statusResult.rows) {
        const userId = row.user_id;
        const consecutiveFailures = row.consecutive_failures;
        const lastErrorAt = new Date(row.last_error_at);
        
        // Only update if not already set or has higher failure count
        const existing = this.circuitBreaker.get(userId);
        if (!existing || existing.failureCount < consecutiveFailures) {
          const circuitBreakerState: CircuitBreakerState = {
            state: 'open',
            failureCount: consecutiveFailures,
            lastFailureTime: lastErrorAt,
            nextAttemptTime: new Date(lastErrorAt.getTime() + 15 * 60 * 1000),
            successCount: 0,
          };
          
          this.circuitBreaker.set(userId, circuitBreakerState);
          
          logger.warn('🔴 Circuit breaker updated from sync status', {
            userId,
            consecutiveFailures,
            lastErrorAt,
          });
        }
      }

      logger.info('📊 Circuit breaker states loaded', {
        activeCircuitBreakers: this.circuitBreaker.size,
      });
      
    } catch (error) {
      logger.error('❌ Failed to load circuit breaker states', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load rate limiting states from database
   */
  private async loadRateLimitStates(): Promise<void> {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - this.RATE_LIMIT_WINDOW);
      
      // Get recent sync operations per user within rate limit window
      const query = `
        SELECT 
          user_id,
          COUNT(*) as recent_requests,
          MIN(started_at) as window_start,
          MAX(started_at) as last_request_time
        FROM sync_operations 
        WHERE started_at >= $1
        GROUP BY user_id
        HAVING COUNT(*) >= 1
      `;
      
      const result = await this.databaseService.query(query, [fifteenMinutesAgo]);
      
      for (const row of result.rows) {
        const userId = row.user_id;
        const recentRequests = parseInt(row.recent_requests);
        const windowStart = new Date(row.window_start);
        const lastRequestTime = new Date(row.last_request_time);
        
        const rateLimitInfo: RateLimitInfo = {
          userId,
          requests: recentRequests,
          resetTime: new Date(windowStart.getTime() + this.RATE_LIMIT_WINDOW),
          isLimited: recentRequests >= this.RATE_LIMIT_MAX_REQUESTS,
        };
        
        this.rateLimitMap.set(userId, rateLimitInfo);
        
        if (rateLimitInfo.isLimited) {
          logger.warn('🚫 Rate limit restored as LIMITED', {
            userId,
            requestCount: recentRequests,
            maxRequests: this.RATE_LIMIT_MAX_REQUESTS,
            windowStart,
          });
        }
      }

      logger.info('📊 Rate limit states loaded', {
        trackedUsers: this.rateLimitMap.size,
        limitedUsers: Array.from(this.rateLimitMap.values()).filter(r => r.isLimited).length,
      });
      
    } catch (error) {
      logger.error('❌ Failed to load rate limit states', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save circuit breaker state to database
   */
  private async saveCircuitBreakerState(userId: string, state: CircuitBreakerState): Promise<void> {
    try {
      // Update user_sync_status with circuit breaker information
      const query = `
        INSERT INTO user_sync_status (
          user_id, wallet_address, last_sync_at, sync_reason, sync_type, sync_status,
          consecutive_failures, last_error_at, is_sync_enabled, sync_metadata
        ) 
        SELECT DISTINCT 
          $1 as user_id,
          wallet_address,
          $2 as last_sync_at,
          'circuit_breaker' as sync_reason,
          'portfolio' as sync_type,
          'failed' as sync_status,
          $3 as consecutive_failures,
          $4 as last_error_at,
          CASE WHEN $5 = 'open' THEN false ELSE true END as is_sync_enabled,
          $6 as sync_metadata
        FROM sync_operations 
        WHERE user_id = $1 
        LIMIT 1
        ON CONFLICT (user_id, wallet_address) DO UPDATE SET
          consecutive_failures = $3,
          last_error_at = $4,
          is_sync_enabled = CASE WHEN $5 = 'open' THEN false ELSE true END,
          sync_metadata = sync_metadata || $6,
          updated_at = NOW()
      `;
      
      const metadata = {
        circuit_breaker_state: state.state,
        failure_count: state.failureCount,
        next_attempt_time: state.nextAttemptTime?.toISOString(),
        worker_id: this.workerId,
        updated_by: 'sync_processor'
      };
      
      await this.databaseService.query(query, [
        userId,
        state.lastFailureTime,
        state.failureCount,
        state.lastFailureTime,
        state.state,
        JSON.stringify(metadata)
      ]);
      
      logger.debug('💾 Circuit breaker state saved to database', {
        userId,
        state: state.state,
        failureCount: state.failureCount,
      });
      
    } catch (error) {
      logger.error('❌ Failed to save circuit breaker state', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save rate limiting state to database  
   */
  private async saveRateLimitState(userId: string, rateLimitInfo: RateLimitInfo): Promise<void> {
    try {
      // We'll use sync_operations metadata to track rate limiting
      // Find the most recent sync operation for this user and update its metadata
      const query = `
        UPDATE sync_operations 
        SET metadata = metadata || $2,
            updated_at = NOW()
        WHERE user_id = $1 
        AND id = (
          SELECT id FROM sync_operations 
          WHERE user_id = $1 
          ORDER BY started_at DESC 
          LIMIT 1
        )
      `;
      
      const metadata = {
        rate_limit_info: {
          request_count: rateLimitInfo.requests,
          reset_time: rateLimitInfo.resetTime.toISOString(),
          is_limited: rateLimitInfo.isLimited,
          max_requests: this.RATE_LIMIT_MAX_REQUESTS,
          window_duration_ms: this.RATE_LIMIT_WINDOW,
          updated_by: 'sync_processor',
          worker_id: this.workerId
        }
      };
      
      await this.databaseService.query(query, [
        userId,
        JSON.stringify(metadata)
      ]);
      
      logger.debug('💾 Rate limit state saved to database', {
        userId,
        requestCount: rateLimitInfo.requests,
        isLimited: rateLimitInfo.isLimited,
      });
      
    } catch (error) {
      logger.error('❌ Failed to save rate limit state', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
    const syncOperationId = randomUUID();
    
    try {
      logger.info('🔄 Starting sync job', {
        jobId: job.id,
        syncOperationId,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        priority: job.priority,
      });

      // Create sync operation record
      const syncOperation: SyncOperation = {
        id: syncOperationId,
        userId: job.data.userId,
        walletAddress: job.data.walletAddress,
        type: 'portfolio',
        status: 'running',
        priority: job.priority,
        startedAt: new Date(),
        retryCount: 0,
        workerId: this.workerId,
        workerVersion: this.workerVersion,
        metadata: {
          jobId: job.id,
          chainIds: job.data.chainIds || []
        }
      };

      await this.databaseService.saveSyncOperation(syncOperation);

      // Check rate limiting
      const rateLimitCheck = this.checkRateLimit(job.data.userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded for user ${job.data.userId}`);
      }

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(job.data.userId)) {
        throw new Error(`Circuit breaker open for user ${job.data.userId}`);
      }

      // Perform the actual sync
      const result = await this.performPortfolioSync(job.data);

      // Record success for circuit breaker
      this.recordSuccess(job.data.userId);

      // Update rate limit
      this.updateRateLimit(job.data.userId);

      const processingTime = Date.now() - startTime;

      // Update sync operation with success
      const completedSyncOperation: SyncOperation = {
        ...syncOperation,
        status: 'completed',
        completedAt: new Date(),
        duration: processingTime,
        tokensSync: result.tokensSync,
        chainsSync: result.chainsSync,
        totalValueUsd: result.totalValueUsd
      };

      await this.databaseService.saveSyncOperation(completedSyncOperation);

      logger.info('✅ Sync job completed', {
        jobId: job.id,
        syncOperationId,
        userId: job.data.userId,
        processingTime: `${processingTime}ms`,
        tokensSync: result.tokensSync,
        totalValueUsd: result.totalValueUsd,
      });

      // Publish event after sync completion
      if (this.kafkaEventPublisher) {
        await this.kafkaEventPublisher.publishSyncCompleted(
          job.data.userId,
          job.data.walletAddress,
          {
            syncOperationId,
            processingTime,
            tokensSync: result.tokensSync,
            chainsSync: result.chainsSync,
            totalValueUsd: result.totalValueUsd,
          }
        );

        // Get token holdings for portfolio update event
        try {
          const tokenHoldings = await this.databaseService.getUserTokenHoldings(job.data.userId);
          const tokens = tokenHoldings.map((h: any) => ({
            symbol: h.tokenSymbol,
            valueUsd: h.valueUSD || 0,
            change24h: 0, // TODO: Calculate price change if needed
          }));

          await this.kafkaEventPublisher.publishPortfolioUpdated(
            job.data.userId,
            job.data.walletAddress,
            {
              totalValueUsd: result.totalValueUsd,
              totalTokens: result.tokensSync,
              totalChains: result.chainsSync,
              tokens,
              syncDuration: processingTime,
              syncOperationId,
            }
          );
        } catch (eventError) {
          logger.warn('Failed to publish portfolio update event', {
            syncOperationId,
            userId: job.data.userId,
            error: eventError instanceof Error ? eventError.message : String(eventError),
          });
        }
      }

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

      // Update sync operation with failure
      try {
        const failedSyncOperation: SyncOperation = {
          id: syncOperationId,
          userId: job.data.userId,
          walletAddress: job.data.walletAddress,
          type: 'portfolio',
          status: 'failed',
          priority: job.priority,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration: processingTime,
          retryCount: 0,
          error: errorMessage,
          workerId: this.workerId,
          workerVersion: this.workerVersion,
          metadata: {
            jobId: job.id,
            chainIds: job.data.chainIds || []
          }
        };

        await this.databaseService.saveSyncOperation(failedSyncOperation);
      } catch (dbError) {
        logger.error('Failed to save failed sync operation', {
          syncOperationId,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }

      // Publish sync failed event
      if (this.kafkaEventPublisher) {
        try {
          await this.kafkaEventPublisher.publishSyncFailed(
            job.data.userId,
            job.data.walletAddress,
            {
              syncOperationId,
              error: errorMessage,
              processingTime,
              retryCount: 0, // TODO: Get actual retry count from job
            }
          );
        } catch (eventError) {
          logger.warn('Failed to publish sync failed event', {
            syncOperationId,
            userId: job.data.userId,
            error: eventError instanceof Error ? eventError.message : String(eventError),
          });
        }
      }

      logger.error('❌ Sync job failed', {
        jobId: job.id,
        syncOperationId,
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
    jobData: SyncJobData
  ): Promise<{
    tokensSync: number;
    chainsSync: number;
    totalValueUsd: number;
  }> {
    try {
      const { userId, walletAddress, chainIds } = jobData;

      // Use provided chain IDs or default to all supported chains
      const chainsToSync = chainIds || this.alchemyService.getSupportedChains();

      logger.info('🔄 Starting portfolio sync', {
        userId,
        walletAddress,
        chainsCount: chainsToSync.length,
      });

      // Get full portfolio from Alchemy
      const portfolio = await this.alchemyService.getFullPortfolio(
        walletAddress,
        chainsToSync
      );

      const tokensSync = portfolio.length;
      const chainsSync = chainsToSync.length;
      const totalValueUsd = portfolio.reduce((sum, token) => sum + token.valueUSD, 0);

      // Transform Alchemy data to TokenHolding format
      const holdings: TokenHolding[] = portfolio.map(token => ({
        id: randomUUID(), // Generate UUID for each holding
        userId,
        walletAddress,
        chainId: typeof token.chainId === 'string' ? parseInt(token.chainId) : token.chainId,
        tokenAddress: token.tokenAddress,
        tokenSymbol: token.tokenSymbol,
        tokenName: token.tokenName,
        tokenDecimals: token.tokenDecimals,
        balance: token.balance,
        balanceFormatted: token.balanceFormatted,
        priceUSD: token.priceUSD,
        valueUSD: token.valueUSD,
        logoUrl: token.alchemyData?.logo,
        isSpam: token.alchemyData?.isSpam || false,
        isVerified: token.alchemyData?.verifiedContract || false,
        lastUpdated: new Date(),
        alchemyData: token.alchemyData
      }));

      // Save portfolio holdings to database
      await this.databaseService.savePortfolioHoldings(userId, walletAddress, holdings);

      logger.info('📊 Portfolio sync completed and saved to database', {
        userId,
        walletAddress,
        tokensSync,
        chainsSync,
        totalValueUsd: totalValueUsd.toFixed(2),
      });

      return {
        tokensSync,
        chainsSync,
        totalValueUsd,
      };

    } catch (error) {
      logger.error('❌ Portfolio sync failed', {
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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
        const newRateLimit = {
          userId,
          requests: 1,
          resetTime,
          isLimited: false
        };
        this.rateLimitMap.set(userId, newRateLimit);
        
        // Save to database (async, don't block main flow)
        this.saveRateLimitState(userId, newRateLimit).catch(error => {
          logger.warn('Failed to save new rate limit state', { userId, error });
        });
      } else {
        // Update existing rate limit
        userRateLimit.requests++;
        userRateLimit.isLimited = userRateLimit.requests >= this.RATE_LIMIT_MAX_REQUESTS;
        this.rateLimitMap.set(userId, userRateLimit);
        
        // Save to database (async, don't block main flow)
        this.saveRateLimitState(userId, userRateLimit).catch(error => {
          logger.warn('Failed to save updated rate limit state', { userId, error });
        });
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
          
          // Save state change to database (async, don't block main flow)
          this.saveCircuitBreakerState(userId, circuitState).catch(error => {
            logger.warn('Failed to save circuit breaker half-open state', { userId, error });
          });
          
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

      // Save to database (async, don't block main flow)
      this.saveCircuitBreakerState(userId, circuitState).catch(error => {
        logger.warn('Failed to save circuit breaker failure state', { userId, error });
      });

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
      let stateChanged = false;

      if (circuitState.state === 'half-open') {
        // Reset circuit breaker to closed state
        circuitState.state = 'closed';
        circuitState.failureCount = 0;
        circuitState.successCount = 0;
        delete circuitState.lastFailureTime;
        delete circuitState.nextAttemptTime;
        stateChanged = true;

        logger.info('✅ Circuit breaker closed', { userId });
      }

      this.circuitBreaker.set(userId, circuitState);

      // Save to database only if state actually changed (async, don't block main flow)
      if (stateChanged) {
        this.saveCircuitBreakerState(userId, circuitState).catch(error => {
          logger.warn('Failed to save circuit breaker success state', { userId, error });
        });
      }

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

  /**
   * Get user sync status for Core Service
   */
  async getUserSyncStatus(userId: string, walletAddress: string): Promise<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date | null;
    syncStatus: 'current' | 'recent' | 'stale' | 'never';
    isRunning: boolean;
    activeSyncOperations: number;
    totalTokens: number;
    totalValueUsd: number;
    syncFrequency: number;
    nextScheduledSync: Date | null;
  }> {
    try {
      // Get user sync status from database
      const syncStatusData = await this.databaseService.getUserSyncStatus(userId);
      
      // Get active sync operations
      const activeSyncOperations = await this.databaseService.getActiveSyncOperations(userId);
      
      // Get latest token holdings
      const tokenHoldings = await this.databaseService.getUserTokenHoldings(userId);
      
      // Calculate sync status
      const now = new Date();
      let syncStatus: 'current' | 'recent' | 'stale' | 'never' = 'never';
      
      if (syncStatusData?.lastSyncAt) {
        const timeSinceLastSync = now.getTime() - syncStatusData.lastSyncAt.getTime();
        
        if (timeSinceLastSync < 5 * 60 * 1000) { // < 5 minutes
          syncStatus = 'current';
        } else if (timeSinceLastSync < 30 * 60 * 1000) { // < 30 minutes
          syncStatus = 'recent';
        } else {
          syncStatus = 'stale';
        }
      }
      
      // Calculate total values
      const totalTokens = tokenHoldings.length;
      const totalValueUsd = tokenHoldings.reduce((sum: number, token: any) => sum + (token.valueUsd || 0), 0);
      
      // Determine next scheduled sync (based on periodic sync config)
      const nextScheduledSync = syncStatusData?.lastSyncAt 
        ? new Date(syncStatusData.lastSyncAt.getTime() + 15 * 60 * 1000) // 15 minutes from last sync
        : null;

      return {
        userId,
        walletAddress,
        lastSyncAt: syncStatusData?.lastSyncAt || null,
        syncStatus,
        isRunning: activeSyncOperations.length > 0,
        activeSyncOperations: activeSyncOperations.length,
        totalTokens,
        totalValueUsd,
        syncFrequency: 15, // 15 minutes default
        nextScheduledSync,
      };

    } catch (error) {
      logger.error('Error getting user sync status', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default response
      return {
        userId,
        walletAddress,
        lastSyncAt: null,
        syncStatus: 'never',
        isRunning: false,
        activeSyncOperations: 0,
        totalTokens: 0,
        totalValueUsd: 0,
        syncFrequency: 15,
        nextScheduledSync: null,
      };
    }
  }

  /**
   * Get user sync operations for Core Service
   */
  async getUserSyncOperations(
    userId: string,
    walletAddress: string,
    filters: {
      limit?: number;
      status?: string;
      type?: string;
      days?: number;
    } = {}
  ): Promise<any[]> {
    try {
      // Set default filters
      const {
        limit = 50,
        status,
        type,
        days = 7,
      } = filters;

      // Build query conditions
      const conditions: any = {
        userId,
        walletAddress,
      };

      if (status) {
        conditions.status = status;
      }

      if (type) {
        conditions.type = type;
      }

      if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        conditions.startedAt = { $gte: daysAgo };
      }

      // Get sync operations from database
      const operations = await this.databaseService.getSyncOperations(conditions, {
        limit,
        orderBy: 'startedAt',
        orderDirection: 'desc',
      });

      // Format operations for Core Service
      const formattedOperations = operations.map((op: any) => ({
        id: op.id,
        userId: op.userId,
        walletAddress: op.walletAddress,
        type: op.type,
        status: op.status,
        priority: op.priority,
        startedAt: op.startedAt,
        completedAt: op.completedAt,
        duration: op.duration,
        tokensSync: op.tokensSync,
        chainsSync: op.chainsSync,
        totalValueUsd: op.totalValueUsd,
        error: op.error,
        workerId: op.workerId,
        workerVersion: op.workerVersion,
        metadata: op.metadata,
      }));

      logger.info('User sync operations retrieved', {
        userId,
        walletAddress,
        operationsCount: formattedOperations.length,
        filters,
      });

      return formattedOperations;

    } catch (error) {
      logger.error('Error getting user sync operations', {
        userId,
        walletAddress,
        filters,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }
} 