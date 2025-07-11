import { MongoManager, createMongoConfig } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { 
  SyncSchemas, 
  UserSyncStatusModel, 
  SyncOperationModel,
  IUserSyncStatus,
  ISyncOperation,
  CreateUserSyncStatusInput,
  CreateSyncOperationInput
} from '../models/mongoSyncModels';

const logger = createLoggerForAnyService('mongo-sync-service-worker');

export class MongoSyncService {
  private mongoManager: MongoManager;
  private userSyncStatusModel: UserSyncStatusModel;
  private syncOperationModel: SyncOperationModel;
  private isInitialized = false;

  constructor() {
    // Initialize MongoDB connection
    const mongoConfig = createMongoConfig();
    this.mongoManager = new MongoManager(mongoConfig);

    // Register models
    this.userSyncStatusModel = this.mongoManager.registerModel(
      'UserSyncStatus',
      SyncSchemas.UserSyncStatus
    );
    this.syncOperationModel = this.mongoManager.registerModel(
      'SyncOperation',
      SyncSchemas.SyncOperation
    );

    logger.info('MongoSyncService initialized for sync worker');
  }

  /**
   * Initialize the MongoDB connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.mongoManager.connect();
      
      // Create performance indexes after connection
      await this.createIndexes();
      
      this.isInitialized = true;
      logger.info('✅ MongoDB connected successfully for sync worker');
    } catch (error) {
      logger.error('❌ MongoDB connection failed for sync worker', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create optimized indexes for high-performance sync operations
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('🔧 Creating MongoDB indexes for optimal performance...');

      // Get native MongoDB collection for index operations
      const connection = this.mongoManager.getConnection();
      if (!connection || !connection.db) {
        throw new Error('MongoDB connection not available for index creation');
      }

      const userSyncStatusCollection = connection.db.collection('user_sync_status');
      const syncOperationCollection = connection.db.collection('sync_operations');

      // Ensure collections exist before creating indexes
      try {
        // Check if collections exist, create if they don't
        const collections = await connection.db.listCollections().toArray();
        const existingCollectionNames = collections.map((col: any) => col.name);
        
        logger.debug('🔍 Existing collections:', existingCollectionNames);
        
        if (!existingCollectionNames.includes('user_sync_status')) {
          logger.info('📝 Creating user_sync_status collection...');
          await connection.db.createCollection('user_sync_status');
        }
        
        if (!existingCollectionNames.includes('sync_operations')) {
          logger.info('📝 Creating sync_operations collection...');
          await connection.db.createCollection('sync_operations');
        }
        
        // Test collection access
        await userSyncStatusCollection.findOne({});
        logger.debug('✅ userSyncStatusCollection accessible');
        
        await syncOperationCollection.findOne({});
        logger.debug('✅ syncOperationCollection accessible');
        
      } catch (collectionError) {
        logger.error('❌ Failed to ensure collections exist:', {
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        });
        throw collectionError;
      }

      // Helper function to create index if not exists
      const createIndexIfNotExists = async (collection: any, keys: any, options: any) => {
        try {
          const existingIndexes = await collection.listIndexes().toArray();
          const indexExists = existingIndexes.some((idx: any) => idx.name === options.name);
          
          if (indexExists) {
            logger.debug(`📋 Index '${options.name}' already exists, skipping...`);
            return;
          }
          
          await collection.createIndex(keys, options);
          logger.debug(`✅ Created index '${options.name}'`);
        } catch (error) {
          // If error is "index already exists", it's OK
          if (error instanceof Error && error.message.includes('already exists')) {
            logger.debug(`📋 Index '${options.name}' already exists (caught error)`);
            return;
          }
          throw error;
        }
      };

      // === USER SYNC STATUS INDEXES ===
      
      // 1. Primary compound index for getUserSyncStatus queries
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { userId: 1, walletAddress: 1 },
        { 
          name: 'idx_user_wallet',
          unique: true,
          background: true
        }
      );

      // 2. Compound index for stale data queries (getUsersWithStaleData)
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { lastSyncAt: 1, isSyncEnabled: 1 },
        { 
          name: 'idx_lastSync_enabled',
          background: true
        }
      );

      // 3. Compound index for enabled users queries (getAllEnabledUsers)
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { isSyncEnabled: 1, lastSyncAt: 1 },
        { 
          name: 'idx_enabled_lastSync',
          background: true
        }
      );

      // 4. Index for sync status filtering
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { syncStatus: 1, lastSyncAt: 1 },
        { 
          name: 'idx_status_lastSync',
          background: true
        }
      );

      // 5. Index for aggregation queries (getSyncStatistics)
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { isSyncEnabled: 1, failedSyncs: 1, avgSyncDurationMs: 1 },
        { 
          name: 'idx_stats_aggregation',
          background: true
        }
      );

      // 6. Index for circuit breaker queries
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { consecutiveFailures: 1, lastErrorAt: 1 },
        { 
          name: 'idx_circuit_breaker',
          background: true
        }
      );

      // === SYNC OPERATION INDEXES ===

      // 1. Primary index for operationId (unique)
      await createIndexIfNotExists(
        syncOperationCollection,
        { operationId: 1 },
        { 
          name: 'idx_operationId',
          unique: true,
          background: true
        }
      );

      // 2. Primary compound index for sync operations
      await createIndexIfNotExists(
        syncOperationCollection,
        { userId: 1, walletAddress: 1 },
        { 
          name: 'idx_user_wallet_ops',
          background: true
        }
      );

      // 3. Index for status-based queries
      await createIndexIfNotExists(
        syncOperationCollection,
        { status: 1, startedAt: -1 },
        { 
          name: 'idx_status_started',
          background: true
        }
      );

      // 4. Index for time-based queries
      await createIndexIfNotExists(
        syncOperationCollection,
        { startedAt: -1, completedAt: -1 },
        { 
          name: 'idx_time_range',
          background: true
        }
      );

      // 5. Index for priority-based processing
      await createIndexIfNotExists(
        syncOperationCollection,
        { priority: 1, status: 1, startedAt: 1 },
        { 
          name: 'idx_priority_processing',
          background: true
        }
      );

      // Log successful index creation
      const userSyncIndexes = await userSyncStatusCollection.listIndexes().toArray();
      const syncOpIndexes = await syncOperationCollection.listIndexes().toArray();

      logger.info('✅ MongoDB indexes verified/created successfully', {
        userSyncStatusIndexes: userSyncIndexes.length,
        syncOperationIndexes: syncOpIndexes.length,
        totalIndexes: userSyncIndexes.length + syncOpIndexes.length
      });

      // Log index details for verification
      logger.debug('📊 Final indexes summary', {
        userSyncStatusIndexes: userSyncIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        })),
        syncOperationIndexes: syncOpIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        }))
      });

    } catch (error) {
      // Don't throw error on index creation failure - MongoDB can still work without indexes
      logger.error('❌ Failed to create MongoDB indexes', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Log warning that performance might be impacted
      logger.warn('⚠️  MongoDB indexes creation failed - performance may be impacted for large datasets');
    }
  }

  /**
   * Shutdown the MongoDB connection
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.mongoManager.disconnect();
      this.isInitialized = false;
      logger.info('MongoDB disconnected successfully for sync worker');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Health check for MongoDB connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      return this.mongoManager.isHealthy();
    } catch (error) {
      logger.error('MongoDB health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Ensure user sync status record exists (upsert operation)
   */
  async ensureUserSyncStatus(
    userId: string,
    walletAddress: string,
    source: string
  ): Promise<IUserSyncStatus> {
    try {
      const filter = { userId, walletAddress };
      
      // First try to find existing record
      let result = await this.mongoManager.findOne(this.userSyncStatusModel, filter);
      
      if (!result) {
        // Create new record if it doesn't exist
        const newRecord = {
          userId,
          walletAddress,
          syncReason: source as 'manual' | 'scheduled' | 'triggered' | 'periodic' | 'auto' | 'no_portfolio_data',
          syncType: 'portfolio' as const,
          syncStatus: 'pending' as const,
          lastSyncAt: new Date(),
          tokensCount: 0,
          chainsCount: 0,
          totalValueUsd: 0,
          syncDurationMs: 0,
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          avgSyncDurationMs: 0,
          isSyncEnabled: true,
          autoSyncIntervalMinutes: 15,
          consecutiveFailures: 0,
          metadata: { source }
        };

        result = await this.mongoManager.create(this.userSyncStatusModel, newRecord);
      }

      if (!result) {
        throw new Error('Failed to ensure user sync status record');
      }

      logger.debug('User sync status ensured', {
        userId,
        walletAddress,
        source
      });

      return result;
    } catch (error) {
      logger.error('Failed to ensure user sync status', {
        userId,
        walletAddress,
        source,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user sync status
   */
  async getUserSyncStatus(
    userId: string,
    walletAddress: string
  ): Promise<IUserSyncStatus | null> {
    try {
      const result = await this.mongoManager.findOne(
        this.userSyncStatusModel,
        { userId, walletAddress }
      );

      logger.debug('User sync status retrieved', {
        userId,
        walletAddress,
        found: !!result
      });

      return result;
    } catch (error) {
      logger.error('Failed to get user sync status', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Mark sync as started
   */
  async markSyncStarted(
    userId: string,
    walletAddress: string,
    syncType: 'portfolio' | 'trades' | 'metadata' | 'full' = 'portfolio',
    syncReason: 'manual' | 'scheduled' | 'triggered' | 'periodic' | 'auto' = 'manual'
  ): Promise<IUserSyncStatus | null> {
    try {
      const filter = { userId, walletAddress };
      const update = {
        $set: {
          syncStatus: 'running' as const,
          syncType,
          syncReason,
          lastSyncAt: new Date()
        },
        $inc: {
          totalSyncs: 1
        }
      };

      const result = await this.mongoManager.updateOne(
        this.userSyncStatusModel,
        filter,
        update
      );

      logger.debug('Sync marked as started', {
        userId,
        walletAddress,
        syncType,
        syncReason
      });

      return result;
    } catch (error) {
      logger.error('Failed to mark sync as started', {
        userId,
        walletAddress,
        syncType,
        syncReason,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Mark sync as completed
   */
  async markSyncCompleted(
    userId: string,
    walletAddress: string,
    syncResults: {
      tokensCount: number;
      chainsCount: number;
      totalValueUsd: number;
      syncDurationMs: number;
    }
  ): Promise<IUserSyncStatus | null> {
    try {
      const filter = { userId, walletAddress };
      
      // Get current record to calculate average duration
      const current = await this.mongoManager.findOne(this.userSyncStatusModel, filter);
      
      let newAvgDuration = syncResults.syncDurationMs;
      if (current && current.successfulSyncs > 0) {
        newAvgDuration = Math.round(
          (current.avgSyncDurationMs * current.successfulSyncs + syncResults.syncDurationMs) / 
          (current.successfulSyncs + 1)
        );
      }

      const update = {
        $set: {
          syncStatus: 'completed' as const,
          lastSyncAt: new Date(),
          tokensCount: syncResults.tokensCount,
          chainsCount: syncResults.chainsCount,
          totalValueUsd: syncResults.totalValueUsd,
          syncDurationMs: syncResults.syncDurationMs,
          avgSyncDurationMs: newAvgDuration,
          consecutiveFailures: 0,
          lastErrorMessage: null,
          lastErrorAt: null
        },
        $inc: {
          successfulSyncs: 1
        }
      };

      const result = await this.mongoManager.updateOne(
        this.userSyncStatusModel,
        filter,
        update
      );

      logger.debug('Sync marked as completed', {
        userId,
        walletAddress,
        tokensCount: syncResults.tokensCount,
        totalValueUsd: syncResults.totalValueUsd,
        syncDurationMs: syncResults.syncDurationMs
      });

      return result;
    } catch (error) {
      logger.error('Failed to mark sync as completed', {
        userId,
        walletAddress,
        syncResults,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Mark sync as failed
   */
  async markSyncFailed(
    userId: string,
    walletAddress: string,
    errorMessage: string
  ): Promise<IUserSyncStatus | null> {
    try {
      const filter = { userId, walletAddress };
      const update = {
        $set: {
          syncStatus: 'failed' as const,
          lastErrorMessage: errorMessage,
          lastErrorAt: new Date()
        },
        $inc: {
          failedSyncs: 1,
          consecutiveFailures: 1
        }
      };

      const result = await this.mongoManager.updateOne(
        this.userSyncStatusModel,
        filter,
        update
      );

      logger.debug('Sync marked as failed', {
        userId,
        walletAddress,
        errorMessage
      });

      return result;
    } catch (error) {
      logger.error('Failed to mark sync as failed', {
        userId,
        walletAddress,
        errorMessage,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Create sync operation record in MongoDB
   */
  async createSyncOperation(
    operationId: string,
    userId: string,
    walletAddress: string,
    operationType: 'portfolio' | 'trades' | 'metadata' | 'full',
    priority: 'high' | 'medium' | 'low',
    metadata: Record<string, any>
  ): Promise<ISyncOperation> {
    try {
      const syncOperation = {
        operationId,
        userId,
        walletAddress,
        type: operationType, // Now properly typed
        status: 'running' as const,
        priority,
        startedAt: new Date(),
        tokensSync: 0,
        chainsSync: 0,
        totalValueUsd: 0,
        retryCount: 0,
        metadata
      };

      const result = await this.mongoManager.create(this.syncOperationModel, syncOperation);

      logger.info('✅ Sync operation created successfully', {
        operationId,
        userId,
        walletAddress,
        type: operationType,
        status: 'running',
        mongoId: result._id
      });

      return result;
    } catch (error) {
      logger.error('❌ Failed to create sync operation', {
        operationId,
        userId,
        walletAddress,
        type: operationType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update sync operation status and results
   */
  async updateSyncOperation(
    operationId: string,
    updates: {
      status?: 'running' | 'completed' | 'failed' | 'cancelled';
      completedAt?: Date;
      duration?: number;
      tokensSync?: number;
      chainsSync?: number;
      totalValueUsd?: number;
      error?: string;
      workerId?: string;
      workerVersion?: string;
    }
  ): Promise<ISyncOperation | null> {
    try {
      const filter = { operationId };
      const update: any = { $set: {} };

      if (updates.status) update.$set.status = updates.status;
      if (updates.completedAt) update.$set.completedAt = updates.completedAt;
      if (updates.duration !== undefined) update.$set.durationMs = updates.duration;
      if (updates.tokensSync !== undefined) update.$set.tokensSync = updates.tokensSync;
      if (updates.chainsSync !== undefined) update.$set.chainsSync = updates.chainsSync;
      if (updates.totalValueUsd !== undefined) update.$set.totalValueUsd = updates.totalValueUsd;
      if (updates.error) update.$set.errorMessage = updates.error;
      if (updates.workerId) update.$set.workerId = updates.workerId;
      if (updates.workerVersion) update.$set.workerVersion = updates.workerVersion;

      // Debug logging - check if record exists before update
      const existingRecord = await this.mongoManager.findOne(
        this.syncOperationModel,
        filter
      );

      if (!existingRecord) {
        logger.warn('❌ Sync operation not found for update', {
          operationId,
          filter,
          updates
        });
        return null;
      }

      logger.debug('🔍 Found existing sync operation for update', {
        operationId,
        currentStatus: existingRecord.status,
        newStatus: updates.status,
        existingRecord: {
          userId: existingRecord.userId,
          walletAddress: existingRecord.walletAddress,
          status: existingRecord.status,
          startedAt: existingRecord.startedAt
        }
      });

      const result = await this.mongoManager.updateOne(
        this.syncOperationModel,
        filter,
        update
      );

      if (result) {
        logger.info('✅ Sync operation updated successfully', {
          operationId,
          oldStatus: existingRecord.status,
          newStatus: updates.status,
          updates
        });
      } else {
        logger.warn('❌ Update operation returned null', {
          operationId,
          filter,
          updates
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to update sync operation', {
        operationId,
        updates,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get sync operations with filters
   */
  async getSyncOperations(
    userId: string,
    walletAddress: string,
    filters: {
      limit?: number;
      status?: string;
      type?: string;
      days?: number;
    } = {}
  ): Promise<ISyncOperation[]> {
    try {
      const {
        limit = 50,
        status,
        type,
        days = 7
      } = filters;

      // Build query
      const query: any = { userId, walletAddress };
      
      if (status) {
        query.status = status;
      }
      
      if (type) {
        query.type = type; // Use 'type' instead of 'operationType'
      }
      
      if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        query.startedAt = { $gte: daysAgo };
      }

      const pipeline = [
        { $match: query },
        { $sort: { startedAt: -1 as -1 } },
        { $limit: limit }
      ];

      const results = await this.mongoManager.aggregate(this.syncOperationModel, pipeline);

      logger.debug('📋 Sync operations retrieved from MongoDB', {
        userId,
        walletAddress,
        filters,
        foundOperations: results.length,
        query
      });

      return results;
    } catch (error) {
      logger.error('❌ Failed to get sync operations', {
        userId,
        walletAddress,
        filters,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get recent failed sync operations for circuit breaker
   */
  async getRecentFailedOperations(
    sinceDate: Date
  ): Promise<ISyncOperation[]> {
    try {
      const query = {
        status: 'failed',
        completedAt: { $gte: sinceDate }
      };

      const pipeline = [
        { $match: query },
        { $sort: { completedAt: -1 as -1 } },
        { $limit: 1000 }
      ];

      const results = await this.mongoManager.aggregate(this.syncOperationModel, pipeline);

      logger.debug('Recent failed operations retrieved', {
        sinceDate,
        foundOperations: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to get recent failed operations', {
        sinceDate,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get active sync operations for a user (or all users if userId is empty)
   */
  async getActiveSyncOperations(
    userId?: string
  ): Promise<ISyncOperation[]> {
    try {
      const query: any = {
        status: { $in: ['running', 'pending'] }
      };

      // Only filter by userId if it's provided and not empty
      if (userId && userId.trim() !== '') {
        query.userId = userId;
      }

      const pipeline = [
        { $match: query },
        { $sort: { startedAt: -1 as -1 } }
      ];

      const results = await this.mongoManager.aggregate(this.syncOperationModel, pipeline);

      logger.debug('Active sync operations retrieved', {
        userId: userId || 'all_users',
        foundOperations: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to get active sync operations', {
        userId: userId || 'all_users',
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get users with stale sync data (for periodic sync scheduler)
   */
  async getUsersWithStaleData(
    staleThresholdMs: number,
    limit: number = 50
  ): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date;
    totalValueUsd: number;
  }>> {
    try {
      const staleThreshold = new Date(Date.now() - staleThresholdMs);
      
      const pipeline = [
        {
          $match: {
            lastSyncAt: { $lt: staleThreshold },
            isSyncEnabled: true
          }
        },
        {
          $sort: { lastSyncAt: 1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            userId: 1,
            walletAddress: 1,
            lastSyncAt: 1,
            totalValueUsd: 1
          }
        }
      ];

      const results = await this.mongoManager.aggregate(this.userSyncStatusModel, pipeline as any[]);

      logger.debug('Retrieved users with stale data', {
        staleThresholdMs,
        staleThreshold: staleThreshold.toISOString(),
        foundUsers: results.length,
        limit
      });

      return results.map((doc: any) => ({
        userId: doc.userId,
        walletAddress: doc.walletAddress,
        lastSyncAt: doc.lastSyncAt,
        totalValueUsd: doc.totalValueUsd
      }));
    } catch (error) {
      logger.error('Failed to get users with stale data', {
        staleThresholdMs,
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all enabled users (for periodic sync scheduler)
   */
  async getAllEnabledUsers(
    limit?: number
  ): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date;
    totalValueUsd: number;
  }>> {
    try {
      const pipeline: any[] = [
        {
          $match: {
            isSyncEnabled: true
          }
        },
        {
          $sort: { lastSyncAt: 1 }
        }
      ];

      if (limit && limit > 0) {
        pipeline.push({ $limit: limit });
      }

      pipeline.push({
        $project: {
          userId: 1,
          walletAddress: 1,
          lastSyncAt: 1,
          totalValueUsd: 1
        }
      });

      const results = await this.mongoManager.aggregate(this.userSyncStatusModel, pipeline);

      logger.debug('Retrieved all enabled users', {
        foundUsers: results.length,
        limitApplied: limit || 'none'
      });

      return results.map((doc: any) => ({
        userId: doc.userId,
        walletAddress: doc.walletAddress,
        lastSyncAt: doc.lastSyncAt,
        totalValueUsd: doc.totalValueUsd
      }));
    } catch (error) {
      logger.error('Failed to get all enabled users', {
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update circuit breaker state for user
   */
  async updateCircuitBreakerState(
    userId: string,
    walletAddress: string,
    isEnabled: boolean,
    consecutiveFailures: number,
    metadata?: Record<string, any>
  ): Promise<IUserSyncStatus | null> {
    try {
      const filter = { userId, walletAddress };
      const update = {
        $set: {
          isSyncEnabled: isEnabled,
          consecutiveFailures,
          ...(metadata && { 
            metadata: {
              ...metadata,
              updatedBy: 'circuit_breaker',
              updatedAt: new Date().toISOString()
            }
          })
        }
      };

      const result = await this.mongoManager.updateOne(
        this.userSyncStatusModel,
        filter,
        update
      );

      logger.debug('Circuit breaker state updated', {
        userId,
        walletAddress,
        isEnabled,
        consecutiveFailures
      });

      return result;
    } catch (error) {
      logger.error('Failed to update circuit breaker state', {
        userId,
        walletAddress,
        isEnabled,
        consecutiveFailures,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get sync statistics for monitoring
   */
  async getSyncStatistics(): Promise<{
    totalUsers: number;
    enabledUsers: number;
    recentSyncs: number;
    failedSyncs: number;
    avgSyncDuration: number;
  }> {
    try {
      const pipeline = [
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            enabledUsers: {
              $sum: { $cond: [{ $eq: ["$isSyncEnabled", true] }, 1, 0] }
            },
            recentSyncs: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$lastSyncAt",
                      new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            failedSyncs: { $sum: "$failedSyncs" },
            totalSyncDuration: { $sum: "$avgSyncDurationMs" },
            usersWithSyncData: {
              $sum: { $cond: [{ $gt: ["$avgSyncDurationMs", 0] }, 1, 0] }
            }
          }
        }
      ];

      const results = await this.mongoManager.aggregate(this.userSyncStatusModel, pipeline);
      const stats = results[0] || {
        totalUsers: 0,
        enabledUsers: 0,
        recentSyncs: 0,
        failedSyncs: 0,
        totalSyncDuration: 0,
        usersWithSyncData: 0
      };

      const avgSyncDuration = stats.usersWithSyncData > 0
        ? Math.round(stats.totalSyncDuration / stats.usersWithSyncData)
        : 0;

      return {
        totalUsers: stats.totalUsers,
        enabledUsers: stats.enabledUsers,
        recentSyncs: stats.recentSyncs,
        failedSyncs: stats.failedSyncs,
        avgSyncDuration
      };
    } catch (error) {
      logger.error('Failed to get sync statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalUsers: 0,
        enabledUsers: 0,
        recentSyncs: 0,
        failedSyncs: 0,
        avgSyncDuration: 0
      };
    }
  }
} 