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

const logger = createLoggerForAnyService('mongo-sync-service');

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

    logger.info('MongoSyncService initialized');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.mongoManager.connect();
      await this.createIndexes();
      this.isInitialized = true;
      logger.info('MongoSyncService connected to MongoDB');
    } catch (error) {
      logger.error('Failed to initialize MongoSyncService', { error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.mongoManager.disconnect();
      this.isInitialized = false;
      logger.info('MongoSyncService disconnected from MongoDB');
    } catch (error) {
      logger.error('Failed to shutdown MongoSyncService', { error });
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return this.isInitialized && await this.mongoManager.healthCheck();
    } catch (error) {
      logger.error('MongoSyncService health check failed', { error });
      return false;
    }
  }

  /**
   * Create indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('🔧 Creating MongoDB indexes for optimal performance...');

      // Get native MongoDB collection for index operations
      const connection = this.mongoManager.getConnection();
      if (!connection || !connection.db) {
        throw new Error('MongoDB connection not available for index creation');
      }

      // Debug: Check if getConnection() method exists and what it returns
      logger.debug('🔍 MongoManager getConnection() debug:', {
        connectionExists: !!connection,
        hasDb: !!connection?.db,
        connectionType: typeof connection,
        dbType: typeof connection?.db,
        mongoManagerType: typeof this.mongoManager,
        mongoManagerMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.mongoManager))
      });

      const userSyncStatusCollection = connection.db.collection('user_sync_status');
      const syncOperationCollection = connection.db.collection('sync_operations');

      // Debug: Verify collections are accessible
      logger.debug('🔍 Verifying MongoDB collections accessibility:', {
        userSyncCollection: userSyncStatusCollection.collectionName,
        syncOperationCollection: syncOperationCollection.collectionName,
        dbName: connection.db.databaseName
      });

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
          logger.debug(`🔍 Checking index '${options.name}' on collection '${collection.collectionName}'`);
          
          const existingIndexes = await collection.listIndexes().toArray();
          const indexExists = existingIndexes.some((idx: any) => idx.name === options.name);
          
          if (indexExists) {
            logger.debug(`📋 Index '${options.name}' already exists, skipping...`);
            return;
          }
          
          logger.debug(`🔧 Creating index '${options.name}' with keys:`, keys);
          await collection.createIndex(keys, options);
          logger.debug(`✅ Created index '${options.name}'`);
        } catch (error) {
          // If error is "index already exists", it's OK
          if (error instanceof Error && error.message.includes('already exists')) {
            logger.debug(`📋 Index '${options.name}' already exists (caught error)`);
            return;
          }
          
          // Enhanced error logging for index creation
          logger.error(`❌ Failed to create index '${options.name}':`, {
            error: error instanceof Error ? error.message : String(error),
            collectionName: collection.collectionName,
            keys: keys,
            options: options
          });
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

      // 2. Compound index for stale data queries (getStaleRecords)
      await createIndexIfNotExists(
        userSyncStatusCollection,
        { lastSyncAt: 1, isSyncEnabled: 1 },
        { 
          name: 'idx_lastSync_enabled',
          background: true
        }
      );

      // 3. Compound index for enabled users queries
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

      // 5. Index for aggregation queries
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

      // 1. Primary compound index for sync operations
      await createIndexIfNotExists(
        syncOperationCollection,
        { userId: 1, walletAddress: 1 },
        { 
          name: 'idx_user_wallet_ops',
          background: true
        }
      );

      // 2. Index for status-based queries
      await createIndexIfNotExists(
        syncOperationCollection,
        { status: 1, startedAt: -1 },
        { 
          name: 'idx_status_started',
          background: true
        }
      );

      // 3. Index for time-based queries
      await createIndexIfNotExists(
        syncOperationCollection,
        { startedAt: -1, completedAt: -1 },
        { 
          name: 'idx_time_range',
          background: true
        }
      );

      // 4. Index for priority-based processing
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
        userSyncStatusIndexes: userSyncIndexes.map((idx: any) => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        })),
        syncOperationIndexes: syncOpIndexes.map((idx: any) => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        }))
      });

    } catch (error) {
      // Enhanced error logging for debugging
      logger.error('❌ Failed to create MongoDB indexes - DETAILED ERROR:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mongoManagerConnected: !!this.mongoManager,
        isInitialized: this.isInitialized
      });
      
      // Additional debugging info
      try {
        const connection = this.mongoManager.getConnection();
        logger.error('🔍 MongoDB connection debug info:', {
          connectionExists: !!connection,
          hasDb: connection?.db ? true : false,
          dbName: connection?.db?.databaseName || 'unknown',
          mongoManagerHealthy: await this.mongoManager.healthCheck()
        });
      } catch (debugError) {
        logger.error('❌ Failed to get MongoDB connection debug info:', {
          debugError: debugError instanceof Error ? debugError.message : String(debugError)
        });
      }
      
      // Log warning that performance might be impacted
      logger.warn('⚠️  MongoDB indexes creation failed - performance may be impacted for large datasets');
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

      logger.debug('User sync status ensured', {
        userId,
        walletAddress,
        source,
        isNew: !result.modifiedCount
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
   * Update user sync status
   */
  async updateUserSyncStatus(
    userId: string,
    walletAddress: string,
    updates: Partial<IUserSyncStatus>
  ): Promise<IUserSyncStatus | null> {
    try {
      const result = await this.mongoManager.updateOne(
        this.userSyncStatusModel,
        { userId, walletAddress },
        { $set: updates }
      );

      logger.debug('User sync status updated', {
        userId,
        walletAddress,
        updates: Object.keys(updates)
      });

      return result;
    } catch (error) {
      logger.error('Failed to update user sync status', {
        userId,
        walletAddress,
        updates: Object.keys(updates),
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
    syncType: string = 'portfolio',
    syncReason: string = 'manual'
  ): Promise<IUserSyncStatus | null> {
    try {
             const updates = {
         syncStatus: 'running' as const,
         syncType: syncType as any,
         syncReason: syncReason as any,
         lastSyncAt: new Date()
       };

      const result = await this.updateUserSyncStatus(userId, walletAddress, updates);

      logger.info('Sync marked as started', {
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
      syncOperationId?: string;
    }
  ): Promise<IUserSyncStatus | null> {
    try {
      const currentStatus = await this.getUserSyncStatus(userId, walletAddress);
      
      if (!currentStatus) {
        throw new Error('User sync status not found');
      }

      // Calculate updated statistics
      const newTotalSyncs = currentStatus.totalSyncs + 1;
      const newSuccessfulSyncs = currentStatus.successfulSyncs + 1;
      const newAvgDuration = Math.round(
        (currentStatus.avgSyncDurationMs * currentStatus.totalSyncs + syncResults.syncDurationMs) / newTotalSyncs
      );

             const updates = {
         syncStatus: 'completed' as const,
         tokensCount: syncResults.tokensCount,
         chainsCount: syncResults.chainsCount,
         totalValueUsd: syncResults.totalValueUsd,
         syncDurationMs: syncResults.syncDurationMs,
         totalSyncs: newTotalSyncs,
         successfulSyncs: newSuccessfulSyncs,
         avgSyncDurationMs: newAvgDuration,
         consecutiveFailures: 0,
         lastErrorMessage: undefined,
         lastErrorAt: undefined,
         ...(syncResults.syncOperationId && { lastSyncOperationId: syncResults.syncOperationId })
       };

      const result = await this.updateUserSyncStatus(userId, walletAddress, updates);

      logger.info('Sync marked as completed', {
        userId,
        walletAddress,
        tokensCount: syncResults.tokensCount,
        chainsCount: syncResults.chainsCount,
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
      const currentStatus = await this.getUserSyncStatus(userId, walletAddress);
      
      if (!currentStatus) {
        throw new Error('User sync status not found');
      }

      const newTotalSyncs = currentStatus.totalSyncs + 1;
      const newFailedSyncs = currentStatus.failedSyncs + 1;
      const newConsecutiveFailures = currentStatus.consecutiveFailures + 1;

             const updates = {
         syncStatus: 'failed' as const,
         totalSyncs: newTotalSyncs,
         failedSyncs: newFailedSyncs,
         consecutiveFailures: newConsecutiveFailures,
         lastErrorMessage: errorMessage,
         lastErrorAt: new Date(),
         // Disable auto-sync if too many consecutive failures
         ...(newConsecutiveFailures >= 5 && { isSyncEnabled: false })
       };

      const result = await this.updateUserSyncStatus(userId, walletAddress, updates);

      logger.warn('Sync marked as failed', {
        userId,
        walletAddress,
        errorMessage,
        consecutiveFailures: newConsecutiveFailures
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
   * Get stale sync records (for periodic scheduler)
   */
  async getStaleRecords(minutesAgo: number = 30): Promise<IUserSyncStatus[]> {
    try {
      const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000);
      
      const results = await this.mongoManager.findMany(
        this.userSyncStatusModel,
        {
          lastSyncAt: { $lt: cutoff },
          isSyncEnabled: true,
          syncStatus: { $ne: 'running' }
        },
        {
          sort: { lastSyncAt: 1 },
          limit: 100
        }
      );

      logger.debug('Stale sync records retrieved', {
        count: results.length,
        minutesAgo,
        cutoffTime: cutoff
      });

      return results;
    } catch (error) {
      logger.error('Failed to get stale sync records', {
        minutesAgo,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Create sync operation record
   */
  async createSyncOperation(
    operationData: CreateSyncOperationInput
  ): Promise<ISyncOperation> {
    try {
      const result = await this.mongoManager.create(
        this.syncOperationModel,
        operationData
      );

      logger.debug('Sync operation created', {
        operationId: result._id,
        userId: operationData.userId,
        type: operationData.type
      });

      return result;
    } catch (error) {
      logger.error('Failed to create sync operation', {
        operationData,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update sync operation
   */
  async updateSyncOperation(
    operationId: string,
    updates: Partial<ISyncOperation>
  ): Promise<ISyncOperation | null> {
    try {
      const result = await this.mongoManager.updateOne(
        this.syncOperationModel,
        { _id: operationId },
        { $set: updates }
      );

      logger.debug('Sync operation updated', {
        operationId,
        updates: Object.keys(updates)
      });

      return result;
    } catch (error) {
      logger.error('Failed to update sync operation', {
        operationId,
        updates: Object.keys(updates),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get sync operations for user
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
  ): Promise<ISyncOperation[]> {
    try {
      const { limit = 50, status, type, days = 7 } = filters;
      
      const query: any = { userId, walletAddress };
      
      if (status) query.status = status;
      if (type) query.type = type;
      if (days) {
        const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startedAt = { $gte: daysAgo };
      }

      const results = await this.mongoManager.findMany(
        this.syncOperationModel,
        query,
        {
          sort: { startedAt: -1 },
          limit
        }
      );

      logger.debug('User sync operations retrieved', {
        userId,
        walletAddress,
        count: results.length,
        filters
      });

      return results;
    } catch (error) {
      logger.error('Failed to get user sync operations', {
        userId,
        walletAddress,
        filters,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get active sync operations (for a specific user or all users)
   */
  async getActiveSyncOperations(userId?: string): Promise<ISyncOperation[]> {
    try {
      const query: any = { status: { $in: ['pending', 'running'] } };
      
      // Only filter by userId if it's provided and not empty
      if (userId && userId.trim() !== '') {
        query.userId = userId;
      }

      const results = await this.mongoManager.findMany(
        this.syncOperationModel,
        query,
        {
          sort: { startedAt: -1 },
          limit: 100
        }
      );

      logger.debug('Active sync operations retrieved', {
        userId: userId || 'all_users',
        count: results.length
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
   * Get metrics for monitoring
   */
  async getMetrics(): Promise<any> {
    try {
      const metrics = this.mongoManager.getMetrics();
      
      return {
        mongodb: metrics,
        isHealthy: await this.isHealthy(),
        collections: {
          userSyncStatus: this.userSyncStatusModel.modelName,
          syncOperations: this.syncOperationModel.modelName
        }
      };
    } catch (error) {
      logger.error('Failed to get MongoDB metrics', { error });
      return {
        mongodb: null,
        isHealthy: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 