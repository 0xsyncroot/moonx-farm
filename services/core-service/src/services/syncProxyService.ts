import { RedisManager, createRedisConfig } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { MessageQueueService, SyncJobRequest, SyncJobResponse, SyncStatusRequest, SyncStatusResponse } from './messageQueueService';
import { DatabaseService } from './databaseService';
import { MongoSyncService } from './mongoSyncService';
import { randomUUID } from 'crypto';

const logger = createLoggerForAnyService('sync-proxy');

export class SyncProxyService {
  private messageQueue: MessageQueueService;
  private redis: RedisManager;
  private databaseService: DatabaseService | null = null;
  private mongoSyncService: MongoSyncService;
  private isInitialized = false;

  // Rate limiting for user sync requests
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 sync requests per 15 minutes per user

  constructor(databaseService?: DatabaseService) {
    // Initialize Redis connection
    const redisConfig = createRedisConfig();
    this.redis = new RedisManager({
      ...redisConfig,
      keyPrefix: 'moonx:sync-proxy:',
    });

    // Initialize message queue
    this.messageQueue = new MessageQueueService(this.redis);
    
    // Store database service for sync operations (still needed for other operations)
    this.databaseService = databaseService || null;

    // Initialize MongoDB sync service for high-performance user sync status operations
    this.mongoSyncService = new MongoSyncService();

    logger.info('SyncProxyService initialized with MongoDB sync service');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.messageQueue.connect();
      await this.mongoSyncService.initialize();
      this.isInitialized = true;
      logger.info('SyncProxyService connected to message queue and MongoDB');
    } catch (error) {
      logger.error('Failed to initialize SyncProxyService', { error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.messageQueue.disconnect();
      await this.mongoSyncService.shutdown();
      this.isInitialized = false;
      logger.info('SyncProxyService disconnected from message queue and MongoDB');
    } catch (error) {
      logger.error('Failed to shutdown SyncProxyService', { error });
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return this.isInitialized && 
             await this.messageQueue.isHealthy() && 
             await this.mongoSyncService.isHealthy();
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Trigger user sync with rate limiting
   */
  async triggerUserSync(
    userId: string, 
    walletAddress: string, 
    priority: 'high' | 'medium' | 'low' = 'medium',
    options: {
      source?: string;
      bypassRateLimit?: boolean;
      forceRefresh?: boolean;
      metadata?: any;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    syncOperationId?: string;
    rateLimitInfo?: { remainingRequests: number; resetTime?: Date };
  }> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      const { source = 'manual_trigger', bypassRateLimit = false, forceRefresh = false, metadata = {} } = options;

      // ✅ DEDUPLICATION: Check for active sync operations first (unless force refresh)
      if (!forceRefresh) {
        const activeOperations = await this.mongoSyncService.getActiveSyncOperations(userId);
        const userActiveOps = activeOperations.filter(op => 
          op.userId === userId && op.walletAddress === walletAddress
        );

        if (userActiveOps.length > 0) {
          const activeOp = userActiveOps[0];
          logger.info('🔄 Manual sync blocked - active operation found', {
            userId,
            walletAddress,
            activeOpId: (activeOp as any)._id?.toString() || 'unknown',
            activeOpStatus: activeOp.status,
            source
          });
          
          return {
            success: false,
            message: `Sync already in progress for user ${userId}. Please wait for current sync to complete.`,
            syncOperationId: (activeOp as any)._id?.toString() || 'unknown',
            rateLimitInfo: {
              remainingRequests: 0,
              resetTime: new Date(Date.now() + 60000) // 1 minute
            }
          };
        }
      }

      // Check rate limit only if not bypassed (for internal calls) and not force refresh
      if (!bypassRateLimit && !forceRefresh) {
        const rateLimitCheck = this.checkRateLimit(userId);
        if (!rateLimitCheck.allowed) {
          return {
            success: false,
            message: 'Rate limit exceeded. Please wait before triggering another sync.',
            rateLimitInfo: {
              remainingRequests: rateLimitCheck.remainingRequests || 0,
              resetTime: rateLimitCheck.resetTime
            }
          };
        }
      }

      // CRITICAL: Ensure user_sync_status record exists for periodic scheduler tracking
      await this.ensureUserSyncStatus(userId, walletAddress, source);

      // Generate job ID for tracking (but don't create sync_operations record)
      const jobId = randomUUID();

      // Create sync job request (Sync Worker will create sync_operations record)
      const syncRequest: SyncJobRequest = {
        jobId,
        userId,
        walletAddress,
        priority,
        syncType: 'portfolio',
        forceRefresh,
        triggeredAt: new Date(),
        metadata: {
          source,
          forceRefresh,
          deduplication_check: 'passed',
          trigger_type: 'manual',
          ...metadata
        }
      };

      // Send to sync worker via Redis (not Kafka)
      const response = await this.messageQueue.sendSyncRequest(syncRequest);

      // Update rate limit tracking only if not bypassed and not force refresh
      if (!bypassRateLimit && !forceRefresh) {
        this.updateRateLimit(userId);
      }

      if (response.status === 'failed') {
        return {
          success: false,
          message: response.error || 'Sync request failed',
          syncOperationId: jobId,
          rateLimitInfo: (!bypassRateLimit && !forceRefresh) ? {
            remainingRequests: 0
          } : undefined
        };
      }

      const successMessage = forceRefresh 
        ? 'Force sync triggered successfully (bypassing rate limits and deduplication)'
        : 'Sync triggered successfully (passed deduplication check)';

      return {
        success: true,
        message: successMessage,
        syncOperationId: jobId,
        rateLimitInfo: (!bypassRateLimit && !forceRefresh) ? {
          remainingRequests: 0
        } : undefined
      };

    } catch (error) {
      logger.error('Error triggering user sync', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to trigger sync due to internal error'
      };
    }
  }

  /**
   * Get user sync status
   */
  async getUserSyncStatus(userId: string, walletAddress: string): Promise<SyncStatusResponse> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      const statusRequest: SyncStatusRequest = {
        userId,
        walletAddress
      };

      const response = await this.messageQueue.getSyncStatus(statusRequest);

      logger.info('User sync status retrieved', {
        userId,
        syncStatus: response.syncStatus,
        lastSyncAt: response.lastSyncAt
      });

      return response;

    } catch (error) {
      logger.error('Error getting user sync status', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return default status on error
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
        nextScheduledSync: null
      };
    }
  }

  /**
   * Get user sync operations
   */
  async getUserSyncOperations(
    userId: string, 
    walletAddress: string, 
    filters: {
      limit?: number;
      status?: string;
      type?: string;
      days?: number;
    }
  ): Promise<any[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      const operations = await this.messageQueue.getSyncOperations(userId, walletAddress, filters);

      logger.info('User sync operations retrieved', {
        userId,
        operationsCount: operations.length,
        filters
      });

      return operations;

    } catch (error) {
      logger.error('Error getting user sync operations', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /**
   * Cancel sync operation
   */
  async cancelSyncOperation(
    operationId: string, 
    userId: string
  ): Promise<{ found: boolean; cancelled: boolean; previousStatus?: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      const result = await this.messageQueue.cancelSyncOperation(operationId, userId);

      logger.info('Sync operation cancel requested', {
        operationId,
        userId,
        result
      });

      return result;

    } catch (error) {
      logger.error('Error cancelling sync operation', {
        operationId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return { found: false, cancelled: false };
    }
  }

  /**
   * Admin methods - get sync stats from sync worker
   */
  async getSyncStats(): Promise<{
    totalUsers: number;
    usersNeedingSync: number;
    stalePortfolios: number;
    isRunning: boolean;
    lastProcessedAt: Date | null;
    syncErrors: number;
  }> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      // For admin stats, we'd need to implement a separate queue or use the same pattern
      // For now, return mock data until sync worker admin endpoints are implemented
      return {
        totalUsers: 0,
        usersNeedingSync: 0,
        stalePortfolios: 0,
        isRunning: true,
        lastProcessedAt: new Date(),
        syncErrors: 0
      };

    } catch (error) {
      logger.error('Error getting sync stats', { error });
      return {
        totalUsers: 0,
        usersNeedingSync: 0,
        stalePortfolios: 0,
        isRunning: false,
        lastProcessedAt: null,
        syncErrors: 0
      };
    }
  }

  /**
   * Admin methods - pause/resume sync service
   */
  async pauseService(reason?: string): Promise<{ success: boolean; previousState: boolean; currentState: boolean }> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      // TODO: Implement pause/resume communication with sync worker
      logger.info('Sync service pause requested', { reason });
      
      return {
        success: true,
        previousState: true,
        currentState: false
      };

    } catch (error) {
      logger.error('Error pausing sync service', { error });
      return {
        success: false,
        previousState: true,
        currentState: true
      };
    }
  }

  async resumeService(): Promise<{ success: boolean; previousState: boolean; currentState: boolean }> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      // TODO: Implement pause/resume communication with sync worker
      logger.info('Sync service resume requested');
      
      return {
        success: true,
        previousState: false,
        currentState: true
      };

    } catch (error) {
      logger.error('Error resuming sync service', { error });
      return {
        success: false,
        previousState: false,
        currentState: false
      };
    }
  }

  /**
   * Get detailed sync statistics
   */
  async getDetailedSyncStats(timeframe: string, breakdown: string): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncProxyService not initialized');
      }

      // TODO: Implement detailed stats communication with sync worker
      logger.info('Detailed sync stats requested', { timeframe, breakdown });
      
      return {
        timeframe,
        breakdown,
        summary: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          averageDuration: 0,
          totalTokensSynced: 0,
          totalValueSynced: 0
        },
        breakdownData: [],
        serviceStatus: {
          isRunning: true,
          lastProcessedAt: new Date(),
          queueLength: 0
        }
      };

    } catch (error) {
      logger.error('Error getting detailed sync stats', { error });
      return {
        timeframe,
        breakdown,
        summary: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          averageDuration: 0,
          totalTokensSynced: 0,
          totalValueSynced: 0
        },
        breakdownData: [],
        serviceStatus: {
          isRunning: false,
          lastProcessedAt: null,
          queueLength: 0
        }
      };
    }
  }

  /**
   * Rate limiting helpers
   */
  private checkRateLimit(userId: string): { allowed: boolean; remainingRequests?: number; resetTime?: Date } {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit) {
      return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
    }

    // Check if window has expired
    if (now - userLimit.windowStart > this.RATE_LIMIT_WINDOW) {
      // Reset window
      this.rateLimitMap.delete(userId);
      return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
    }

    // Check if limit exceeded
    if (userLimit.requestCount >= this.RATE_LIMIT_MAX_REQUESTS) {
      const resetTime = new Date(userLimit.windowStart + this.RATE_LIMIT_WINDOW);
      return { 
        allowed: false, 
        remainingRequests: 0, 
        resetTime 
      };
    }

    return { 
      allowed: true, 
      remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - userLimit.requestCount - 1 
    };
  }

  private updateRateLimit(userId: string): void {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit) {
      this.rateLimitMap.set(userId, {
        windowStart: now,
        requestCount: 1
      });
    } else {
      // Check if window has expired
      if (now - userLimit.windowStart > this.RATE_LIMIT_WINDOW) {
        // Reset window
        this.rateLimitMap.set(userId, {
          windowStart: now,
          requestCount: 1
        });
      } else {
        // Increment count
        userLimit.requestCount++;
      }
    }
  }

  /**
   * Ensure user_sync_status record exists for periodic scheduler tracking
   * Now using MongoDB for high performance instead of PostgreSQL
   */
  private async ensureUserSyncStatus(
    userId: string, 
    walletAddress: string, 
    source: string
  ): Promise<void> {
    try {
      if (!this.mongoSyncService) {
        logger.warn('MongoDB sync service not available, skipping user sync status creation');
        return;
      }

      // Use MongoDB upsert operation for high performance
      await this.mongoSyncService.ensureUserSyncStatus(userId, walletAddress, source);

      logger.debug('User sync status ensured in MongoDB', {
        userId,
        walletAddress,
        source
      });
    } catch (error) {
      logger.error('Failed to ensure user sync status in MongoDB', {
        userId,
        walletAddress,
        source,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - this is not critical for sync operation
    }
  }
}

interface RateLimitInfo {
  windowStart: number;
  requestCount: number;
} 