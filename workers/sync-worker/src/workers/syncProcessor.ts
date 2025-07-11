import { randomUUID } from 'crypto';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AlchemyService, TokenBalance } from '@/services/alchemyService';
import { DatabaseService, TokenHolding } from '@/services/databaseService';
import { KafkaEventPublisher } from '@/services/kafkaEventPublisher';
import { SyncJobData, SyncJobResult, CircuitBreakerState } from '@/types';

export class SyncProcessor {
  private alchemyService: AlchemyService;
  private databaseService: DatabaseService;
  private kafkaEventPublisher: KafkaEventPublisher | undefined;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();

  // Worker identification
  private readonly workerId: string;
  private readonly workerVersion: string;

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
      
      logger.info('✅ Sync processor initialized with state recovery', {
        circuitBreakers: this.circuitBreaker.size,
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
   * Load circuit breaker states from MongoDB
   */
  private async loadCircuitBreakerStates(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      logger.info('📊 Loading circuit breaker states from MongoDB', {
        timeWindow: '1 hour ago',
        oneHourAgo
      });

      // Get recent failed sync operations from MongoDB
      logger.info('🔍 Querying failed operations for circuit breaker state recovery');
      
      // Get recent failed sync operations from MongoDB
      const recentFailedOps = await this.databaseService.mongoSyncService.getRecentFailedOperations(oneHourAgo);
      
      // Group by userId and count failures
      const userFailureCounts = new Map<string, { count: number; lastFailure: Date; errors: string[] }>();
      
      for (const op of recentFailedOps) {
        if (!userFailureCounts.has(op.userId)) {
          userFailureCounts.set(op.userId, { count: 0, lastFailure: new Date(0), errors: [] });
        }
        
        const userFailures = userFailureCounts.get(op.userId)!;
        userFailures.count++;
        
        const opCompletedAt = new Date(op.completedAt || op.startedAt);
        if (opCompletedAt > userFailures.lastFailure) {
          userFailures.lastFailure = opCompletedAt;
        }
        
        if (op.errorMessage && userFailures.errors.length < 5) {
          userFailures.errors.push(op.errorMessage);
        }
      }
      
      // Rebuild circuit breaker states for users with >= 3 failures
      for (const [userId, failures] of userFailureCounts.entries()) {
        if (failures.count >= 3) {
          const circuitBreakerState: CircuitBreakerState = {
            state: 'open',
            failureCount: failures.count,
            lastFailureTime: failures.lastFailure,
            nextAttemptTime: new Date(failures.lastFailure.getTime() + 15 * 60 * 1000), // 15 minutes timeout
            successCount: 0,
          };
          
          this.circuitBreaker.set(userId, circuitBreakerState);
          
          logger.warn('🔴 Circuit breaker restored as OPEN from database', {
            userId,
            failureCount: failures.count,
            lastFailureTime: failures.lastFailure,
            nextAttemptTime: circuitBreakerState.nextAttemptTime,
            recentErrors: failures.errors.slice(0, 3) // Show last 3 errors
          });
        }
      }

      // Get MongoDB sync statistics for additional context
      try {
        const mongoStats = await this.databaseService.mongoSyncService.getSyncStatistics();
        
        logger.info('✅ Circuit breaker state loaded from MongoDB', {
          activeCircuitBreakers: this.circuitBreaker.size,
          mongoStats: {
            recentSyncs: mongoStats.recentSyncs,
            failedSyncs: mongoStats.failedSyncs,
            avgSyncDuration: mongoStats.avgSyncDuration
          }
        });
      } catch (mongoError) {
        logger.warn('Could not load MongoDB sync statistics', {
          error: mongoError instanceof Error ? mongoError.message : String(mongoError)
        });
      }

      logger.info('📊 Circuit breaker states loaded from MongoDB', {
        activeCircuitBreakers: this.circuitBreaker.size,
        totalFailedOperations: recentFailedOps.length
      });
      
    } catch (error) {
      logger.error('❌ Failed to load circuit breaker states from MongoDB', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save circuit breaker state to MongoDB user_sync_status
   */
  private async saveCircuitBreakerState(userId: string, state: CircuitBreakerState): Promise<void> {
    try {
      // Get the user's wallet address from their most recent sync operation
      // In a production system, you might want to handle multiple wallets per user
      const recentOps = await this.databaseService.getSyncOperations(
        { userId },
        { limit: 1, orderBy: 'startedAt', orderDirection: 'desc' }
      );

      if (recentOps.length === 0) {
        logger.warn('No sync operations found for user, cannot save circuit breaker state', { userId });
        return;
      }

      const walletAddress = recentOps[0]?.walletAddress;
      if (!walletAddress) {
        logger.warn('No wallet address found in sync operation, cannot save circuit breaker state', { userId });
        return;
      }

      const isEnabled = state.state !== 'open';

      const metadata = {
        circuit_breaker_state: state.state,
        failure_count: state.failureCount,
        next_attempt_time: state.nextAttemptTime?.toISOString(),
        worker_id: this.workerId,
        updated_by: 'sync_processor',
        updated_at: new Date().toISOString()
      };

      // Use MongoDB service to update circuit breaker state
      const result = await this.databaseService.mongoSyncService.updateCircuitBreakerState(
        userId,
        walletAddress,
        isEnabled,
        state.failureCount,
        metadata
      );

      if (result) {
        logger.debug('💾 Circuit breaker state saved to MongoDB', {
          userId,
          walletAddress,
          state: state.state,
          failureCount: state.failureCount,
          isEnabled
        });
      } else {
        logger.warn('Circuit breaker state save returned null result', { userId, walletAddress });
      }
      
    } catch (error) {
      logger.error('❌ Failed to save circuit breaker state to MongoDB', {
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
        forceRefresh: job.data.forceRefresh,
      });

      // Sync operation will be created in MongoDB

      // Create sync operation in MongoDB
      try {
        await this.databaseService.mongoSyncService.createSyncOperation(
          syncOperationId,
          job.data.userId,
          job.data.walletAddress,
          'portfolio',
          job.priority,
          {
            jobId: job.id,
            chainIds: job.data.chainIds || [],
            forceRefresh: job.data.forceRefresh,
            workerId: this.workerId,
            workerVersion: this.workerVersion
          }
        );

        // Also mark sync as started in user_sync_status
        await this.databaseService.mongoSyncService.markSyncStarted(
          job.data.userId,
          job.data.walletAddress,
          'portfolio',
          'manual'
        );

        logger.info('📝 Sync operation created in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          walletAddress: job.data.walletAddress
        });
      } catch (mongoError) {
        logger.error('Failed to create sync operation in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          error: mongoError instanceof Error ? mongoError.message : String(mongoError)
        });
        throw mongoError;
      }

      // Check circuit breaker - BYPASS if forceRefresh is true
      if (!job.data.forceRefresh) {
        if (this.isCircuitBreakerOpen(job.data.userId)) {
          throw new Error(`Circuit breaker open for user ${job.data.userId}`);
        }
      } else {
        logger.info('⚡ Force refresh enabled - bypassing circuit breaker', {
          userId: job.data.userId,
          jobId: job.id
        });
      }

      // Perform the actual sync
      const result = await this.performPortfolioSync(job.data);

      // Record success for circuit breaker
      this.recordSuccess(job.data.userId);

      const processingTime = Date.now() - startTime;

      // Update sync operation and status in MongoDB
      try {
        await this.databaseService.mongoSyncService.updateSyncOperation(
          syncOperationId,
          {
            status: 'completed',
            completedAt: new Date(),
            duration: processingTime,
            tokensSync: result.tokensSync,
            chainsSync: result.chainsSync,
            totalValueUsd: result.totalValueUsd,
            workerId: this.workerId,
            workerVersion: this.workerVersion
          }
        );

        // Also mark sync as completed in user_sync_status
        await this.databaseService.mongoSyncService.markSyncCompleted(
          job.data.userId,
          job.data.walletAddress,
          {
            tokensCount: result.tokensSync,
            chainsCount: result.chainsSync,
            totalValueUsd: result.totalValueUsd,
            syncDurationMs: processingTime
          }
        );

        logger.info('📝 Sync operation updated as completed in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          walletAddress: job.data.walletAddress,
          tokensSync: result.tokensSync,
          totalValueUsd: result.totalValueUsd
        });
      } catch (mongoError) {
        logger.error('Failed to update sync operation as completed in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          error: mongoError instanceof Error ? mongoError.message : String(mongoError)
        });
      }

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

      // Update sync operation as failed in MongoDB
      try {
        await this.databaseService.mongoSyncService.updateSyncOperation(
          syncOperationId,
          {
            status: 'failed',
            completedAt: new Date(),
            duration: processingTime,
            error: errorMessage,
            workerId: this.workerId,
            workerVersion: this.workerVersion
          }
        );

        // Also mark sync as failed in user_sync_status
        await this.databaseService.mongoSyncService.markSyncFailed(
          job.data.userId,
          job.data.walletAddress,
          errorMessage
        );

        logger.info('📝 Sync operation updated as failed in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          walletAddress: job.data.walletAddress,
          error: errorMessage
        });
      } catch (mongoError) {
        logger.error('Failed to update sync operation as failed in MongoDB', {
          syncOperationId,
          userId: job.data.userId,
          error: mongoError instanceof Error ? mongoError.message : String(mongoError)
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
   * Perform actual portfolio sync with MongoDB user sync status tracking
   */
  private async performPortfolioSync(
    jobData: SyncJobData
  ): Promise<{
    tokensSync: number;
    chainsSync: number;
    totalValueUsd: number;
  }> {
    const syncStartTime = Date.now();
    try {
      const { userId, walletAddress, chainIds } = jobData;

      // Use provided chain IDs or default to all supported chains
      const chainsToSync = chainIds || this.alchemyService.getSupportedChains();

      logger.info('🔄 Starting portfolio sync', {
        userId,
        walletAddress,
        chainsCount: chainsToSync.length,
        chainsToSync,
        providedChainIds: chainIds
      });

      // Mark sync as started in MongoDB
      await this.databaseService.mongoSyncService.markSyncStarted(
        userId,
        walletAddress,
        'portfolio',
        'manual'
      );

      // Step 1: Get full portfolio from Alchemy
      logger.info('📡 Calling Alchemy API for portfolio data', {
        userId,
        walletAddress,
        chainsToSync
      });
      
      const portfolio = await this.alchemyService.getFullPortfolio(
        walletAddress,
        chainsToSync
      );

      logger.info('📡 Alchemy API response received', {
        userId,
        walletAddress,
        portfolioLength: portfolio.length,
        portfolioSample: portfolio.slice(0, 3).map(t => ({
          symbol: t.tokenSymbol,
          value: t.valueUSD,
          balance: t.balanceFormatted
        }))
      });

      const tokensSync = portfolio.length;
      const chainsSync = chainsToSync.length;
      const totalValueUsd = portfolio.reduce((sum, token) => sum + token.valueUSD, 0);

      // Step 2: Transform Alchemy data to TokenHolding format
      logger.info('🔄 Transforming Alchemy data to database format', {
        userId,
        walletAddress,
        tokensToTransform: portfolio.length
      });

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

      logger.info('✅ Transformation completed', {
        userId,
        walletAddress,
        holdingsCount: holdings.length,
        holdingsSample: holdings.slice(0, 3).map(h => ({
          symbol: h.tokenSymbol,
          value: h.valueUSD,
          chainId: h.chainId
        }))
      });

      // Step 3: Save portfolio holdings to database
      logger.info('💾 Saving portfolio holdings to database', {
        userId,
        walletAddress,
        holdingsToSave: holdings.length
      });

      await this.databaseService.savePortfolioHoldings(userId, walletAddress, holdings);

      logger.info('✅ Database save completed', {
        userId,
        walletAddress,
        savedHoldings: holdings.length
      });

      // Step 4: Mark sync as completed in MongoDB
      const syncDurationMs = Date.now() - syncStartTime;
      await this.databaseService.mongoSyncService.markSyncCompleted(
        userId,
        walletAddress,
        {
          tokensCount: tokensSync,
          chainsCount: chainsSync,
          totalValueUsd: totalValueUsd,
          syncDurationMs: syncDurationMs
        }
      );

      // Step 5: Verify saved data
      logger.info('🔍 Verifying saved data', {
        userId,
        walletAddress
      });

      const savedHoldings = await this.databaseService.getUserTokenHoldings(userId);
      
      logger.info('📊 Portfolio sync completed successfully', {
        userId,
        walletAddress,
        tokensSync,
        chainsSync,
        totalValueUsd: Number(totalValueUsd).toFixed(2),
        savedHoldingsCount: savedHoldings.length,
        savedTotalValue: savedHoldings.length > 0 ? 
          Number(savedHoldings.reduce((sum: number, h: any) => sum + (Number(h.valueUSD) || 0), 0)).toFixed(2) : 
          '0.00'
      });

      return {
        tokensSync,
        chainsSync,
        totalValueUsd,
      };

    } catch (error) {
      // Mark sync as failed in MongoDB
      try {
        await this.databaseService.mongoSyncService.markSyncFailed(
          jobData.userId,
          jobData.walletAddress,
          error instanceof Error ? error.message : String(error)
        );
      } catch (mongoError) {
        logger.error('Failed to mark sync as failed in MongoDB', {
          userId: jobData.userId,
          walletAddress: jobData.walletAddress,
          error: mongoError instanceof Error ? mongoError.message : String(mongoError)
        });
      }

      logger.error('❌ Portfolio sync failed', {
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        step: 'performPortfolioSync',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
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
        rateLimits: 0, // Rate limiting is removed
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
      
      // Clean up old circuit breaker states
      for (const [userId, circuitState] of this.circuitBreaker.entries()) {
        if (circuitState.nextAttemptTime && now > circuitState.nextAttemptTime.getTime() + (24 * 60 * 60 * 1000)) {
          // Remove circuit breaker states older than 24 hours
          this.circuitBreaker.delete(userId);
        }
      }

      logger.debug('Cleanup completed', {
        circuitBreakers: this.circuitBreaker.size,
      });

    } catch (error) {
      logger.error('Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get user sync status for Core Service - now using MongoDB
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
      // Get user sync status from MongoDB
      const syncStatusData = await this.databaseService.mongoSyncService.getUserSyncStatus(userId, walletAddress);
      
      // Get active sync operations from MongoDB
      const activeSyncOperations = await this.databaseService.mongoSyncService.getActiveSyncOperations(userId);
      
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
      logger.error('Error getting user sync status from MongoDB', {
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
   * Get user sync operations for Core Service - using MongoDB
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

      // Get sync operations from MongoDB
      const mongoFilters: any = { limit, days };
      if (status) mongoFilters.status = status;
      if (type) mongoFilters.type = type;
      
      const operations = await this.databaseService.mongoSyncService.getSyncOperations(
        userId,
        walletAddress,
        mongoFilters
      );

      // Format operations for Core Service
      const formattedOperations = operations.map((op: any) => ({
        id: op.operationId || op._id,
        userId: op.userId,
        walletAddress: op.walletAddress,
        type: op.type,
        status: op.status,
        priority: op.priority,
        startedAt: op.startedAt,
        completedAt: op.completedAt,
        duration: op.durationMs,
        tokensSync: op.tokensSync,
        chainsSync: op.chainsSync,
        totalValueUsd: op.totalValueUsd,
        error: op.errorMessage,
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