import { DatabaseManager, createDatabase } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { config } from '@/config';
import { randomUUID } from 'crypto';
import { MongoSyncService } from './mongoSyncService';

const logger = createLoggerForAnyService('database-service');

export interface TokenHolding {
  id?: string; // UUID, optional for new records
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: string;
  balanceFormatted: number;
  priceUSD: number;
  valueUSD: number;
  logoUrl?: string;
  isSpam?: boolean;
  isVerified?: boolean;
  lastUpdated: Date;
  alchemyData?: any;
}

export interface SyncOperation {
  id: string; // UUID
  userId: string;
  walletAddress: string;
  type: 'portfolio' | 'trades' | 'metadata' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  startedAt: Date;
  completedAt?: Date | undefined;
  duration?: number | undefined;
  tokensSync?: number | undefined;
  chainsSync?: number | undefined;
  totalValueUsd?: number | undefined;
  error?: string | undefined;
  retryCount: number;
  workerId?: string | undefined;
  workerVersion?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export class DatabaseService {
  private db: DatabaseManager;
  public mongoSyncService: MongoSyncService; // Made public for access from SyncProcessor
  private isConnected = false;
  private isMongoConnected = false;

  constructor() {
    this.db = createDatabase({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl,
      maxConnections: config.database.max,
      minConnections: config.database.min,
      idleTimeoutMs: config.database.idle
    });
    
    // Initialize MongoDB sync service for high-performance user sync status operations
    this.mongoSyncService = new MongoSyncService();
    
    logger.info('DatabaseService initialized for sync worker with MongoDB integration');
  }

  /**
   * Initialize database connections (PostgreSQL + MongoDB)
   */
  async initialize(): Promise<void> {
    if (this.isConnected && this.isMongoConnected) return;

    try {
      // Initialize PostgreSQL connection
      if (!this.isConnected) {
        await this.db.connect();
        this.isConnected = true;
        logger.info('✅ PostgreSQL connected successfully');
      }

      // Initialize MongoDB connection
      if (!this.isMongoConnected) {
        await this.mongoSyncService.initialize();
        this.isMongoConnected = true;
        logger.info('✅ MongoDB connected successfully');
      }

      logger.info('✅ All database services connected successfully');
    } catch (error) {
      logger.error('❌ Database connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Disconnect from databases (PostgreSQL + MongoDB)
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect PostgreSQL
      if (this.isConnected) {
        await this.db.disconnect();
        this.isConnected = false;
        logger.info('PostgreSQL disconnected');
      }

      // Disconnect MongoDB
      if (this.isMongoConnected) {
        await this.mongoSyncService.shutdown();
        this.isMongoConnected = false;
        logger.info('MongoDB disconnected');
      }

      logger.info('All database services disconnected');
    } catch (error) {
      logger.error('Error disconnecting databases', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check health of both PostgreSQL and MongoDB
   */
  async healthCheck(): Promise<{ 
    connected: boolean; 
    responseTime?: number;
    mongodb?: boolean;
    postgresql?: boolean;
  }> {
    try {
      const startTime = Date.now();
      
      // Check PostgreSQL health
      let postgresqlHealthy = false;
      if (this.isConnected) {
        try {
          await this.db.query('SELECT 1');
          postgresqlHealthy = true;
        } catch (error) {
          logger.error('PostgreSQL health check failed', { error });
        }
      }

      // Check MongoDB health
      const mongodbHealthy = this.isMongoConnected && await this.mongoSyncService.isHealthy();
      
      const responseTime = Date.now() - startTime;
      const overallConnected = postgresqlHealthy && mongodbHealthy;
      
      return {
        connected: overallConnected,
        responseTime,
        postgresql: postgresqlHealthy,
        mongodb: mongodbHealthy
      };
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { 
        connected: false,
        postgresql: false,
        mongodb: false
      };
    }
  }

  /**
   * Save portfolio holdings to database
   */
  async savePortfolioHoldings(
    userId: string, 
    walletAddress: string, 
    holdings: TokenHolding[]
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      logger.info('💾 Starting database save operation', {
        userId,
        walletAddress,
        holdingsToSave: holdings.length,
        holdingsSample: holdings.slice(0, 3).map(h => ({
          symbol: h.tokenSymbol,
          value: h.valueUSD,
          chainId: h.chainId
        }))
      });

      if (holdings.length === 0) {
        // If no holdings, clear existing data
        const deleteQuery = 'DELETE FROM user_token_holdings WHERE user_id = $1 AND wallet_address = $2';
        await this.db.query(deleteQuery, [userId, walletAddress]);
        logger.info('🗑️ Cleared existing holdings (no new holdings to save)', {
          userId,
          walletAddress
        });
        return;
      }

      // Use UPSERT (ON CONFLICT) to avoid duplicate key violations
      const queries = [];
      
      // First, clear existing holdings for this user/wallet
      const deleteQuery = {
        text: 'DELETE FROM user_token_holdings WHERE user_id = $1 AND wallet_address = $2',
        params: [userId, walletAddress]
      };
      queries.push(deleteQuery);

      logger.info('🗑️ Prepared delete query for existing holdings', {
        userId,
        walletAddress
      });

      // Insert new holdings with UPSERT
      for (const [index, holding] of holdings.entries()) {
        const upsertQuery = {
          text: `
            INSERT INTO user_token_holdings (
              id, user_id, wallet_address, chain_id, token_address, 
              token_symbol, token_name, token_decimals, balance, 
              balance_formatted, price_usd, value_usd, logo_url, 
              is_spam, is_verified, last_updated, alchemy_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (user_id, wallet_address, chain_id, token_address) 
            DO UPDATE SET
              token_symbol = EXCLUDED.token_symbol,
              token_name = EXCLUDED.token_name,
              token_decimals = EXCLUDED.token_decimals,
              balance = EXCLUDED.balance,
              balance_formatted = EXCLUDED.balance_formatted,
              price_usd = EXCLUDED.price_usd,
              value_usd = EXCLUDED.value_usd,
              logo_url = EXCLUDED.logo_url,
              is_spam = EXCLUDED.is_spam,
              is_verified = EXCLUDED.is_verified,
              last_updated = EXCLUDED.last_updated,
              alchemy_data = EXCLUDED.alchemy_data
          `,
          params: [
            holding.id || randomUUID(),
            holding.userId,
            holding.walletAddress,
            holding.chainId,
            holding.tokenAddress,
            holding.tokenSymbol,
            holding.tokenName,
            holding.tokenDecimals,
            holding.balance,
            holding.balanceFormatted,
            holding.priceUSD,
            holding.valueUSD,
            holding.logoUrl || null,
            holding.isSpam || false,
            holding.isVerified || false,
            holding.lastUpdated,
            holding.alchemyData ? JSON.stringify(holding.alchemyData) : null
          ]
        };
        queries.push(upsertQuery);

        // Log first few queries for debugging
        if (index < 3) {
          logger.info(`📝 Prepared upsert query ${index + 1}`, {
            userId,
            walletAddress,
            symbol: holding.tokenSymbol,
            value: holding.valueUSD,
            chainId: holding.chainId,
            tokenAddress: holding.tokenAddress
          });
        }
      }

      logger.info('🔄 Executing batch transaction with UPSERT', {
        userId,
        walletAddress,
        totalQueries: queries.length,
        deleteQueries: 1,
        upsertQueries: queries.length - 1
      });

      // Execute batch transaction
      await this.db.batch(queries);

      logger.info('✅ Database save operation completed successfully', {
        userId,
        walletAddress,
        savedHoldings: holdings.length,
        totalQueries: queries.length,
        totalValue: holdings.length > 0 ? 
          Number(holdings.reduce((sum, h) => sum + (Number(h.valueUSD) || 0), 0)).toFixed(2) : 
          '0.00'
      });

    } catch (error) {
      logger.error('❌ Failed to save portfolio holdings', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
        holdingsCount: holdings.length
      });
      throw error;
    }
  }

  /**
   * Save sync operation record
   */
  async saveSyncOperation(operation: SyncOperation): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        INSERT INTO sync_operations (
          id, user_id, wallet_address, type, status, priority,
          started_at, completed_at, duration_ms, tokens_synced,
          chains_synced, total_value_usd, error_message, retry_count,
          worker_id, worker_version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          duration_ms = EXCLUDED.duration_ms,
          tokens_synced = EXCLUDED.tokens_synced,
          chains_synced = EXCLUDED.chains_synced,
          total_value_usd = EXCLUDED.total_value_usd,
          error_message = EXCLUDED.error_message,
          retry_count = EXCLUDED.retry_count,
          worker_id = EXCLUDED.worker_id,
          worker_version = EXCLUDED.worker_version,
          metadata = EXCLUDED.metadata
      `;

      const values = [
        operation.id,
        operation.userId,
        operation.walletAddress,
        operation.type,
        operation.status,
        operation.priority,
        operation.startedAt,
        operation.completedAt || null,
        operation.duration || null,
        operation.tokensSync || null,
        operation.chainsSync || null,
        operation.totalValueUsd || null,
        operation.error || null,
        operation.retryCount,
        operation.workerId || null,
        operation.workerVersion || null,
        operation.metadata ? JSON.stringify(operation.metadata) : null
      ];

      await this.db.query(query, values);

      logger.debug('📝 Sync operation saved', {
        operationId: operation.id,
        status: operation.status,
        userId: operation.userId
      });

    } catch (error) {
      logger.error('❌ Failed to save sync operation', {
        operationId: operation.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get sync operation by ID
   */
  async getSyncOperation(operationId: string): Promise<SyncOperation | null> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT 
          id, user_id, wallet_address, type, status, priority,
          started_at, completed_at, duration_ms, tokens_synced,
          chains_synced, total_value_usd, error_message, retry_count, metadata
        FROM sync_operations 
        WHERE id = $1
      `;

      const result = await this.db.query(query, [operationId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        type: row.type,
        status: row.status,
        priority: row.priority,
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        duration: row.duration_ms,
        tokensSync: row.tokens_synced,
        chainsSync: row.chains_synced,
        totalValueUsd: row.total_value_usd ? parseFloat(row.total_value_usd) : undefined,
        error: row.error_message,
        retryCount: row.retry_count,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };

    } catch (error) {
      logger.error('❌ Failed to get sync operation', {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user portfolio summary from database
   */
  async getUserPortfolioSummary(userId: string, walletAddress: string): Promise<{
    totalValueUSD: number;
    tokenCount: number;
    chainCount: number;
    lastUpdated: Date | null;
  }> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT 
          COALESCE(SUM(value_usd), 0) as total_value_usd,
          COUNT(*) as token_count,
          COUNT(DISTINCT chain_id) as chain_count,
          MAX(last_updated) as last_updated
        FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2
      `;

      const result = await this.db.query(query, [userId, walletAddress]);
      const row = result.rows[0];

      return {
        totalValueUSD: parseFloat(row.total_value_usd) || 0,
        tokenCount: parseInt(row.token_count) || 0,
        chainCount: parseInt(row.chain_count) || 0,
        lastUpdated: row.last_updated ? new Date(row.last_updated) : null
      };

    } catch (error) {
      logger.error('❌ Failed to get portfolio summary', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get users with stale data (older than threshold) - now using MongoDB
   */
  async getUsersWithStaleData(staleThresholdMs: number, limit: number = 50): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastUpdated: Date;
    totalValueUSD: number;
  }>> {
    if (!this.isMongoConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      logger.info('🔍 Loading users with stale data from MongoDB user_sync_status', {
        staleThresholdMs,
        limit
      });

      const results = await this.mongoSyncService.getUsersWithStaleData(staleThresholdMs, limit);

      logger.info('📊 Users with stale data from MongoDB', {
        foundUsers: results.length,
        sampleUsers: results.slice(0, 3).map(user => ({
          userId: user.userId,
          lastSyncAt: user.lastSyncAt,
          totalValue: user.totalValueUsd
        }))
      });

      return results.map(user => ({
        userId: user.userId,
        walletAddress: user.walletAddress,
        lastUpdated: user.lastSyncAt,
        totalValueUSD: user.totalValueUsd
      }));

    } catch (error) {
      logger.error('❌ Failed to get users with stale data from MongoDB', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get users with activity within specified timeframe (for periodic sync)
   */
  async getUsersWithActivity(activityThresholdMs: number, limit: number = 1000): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastUpdated: Date;
    totalValueUSD: number;
  }>> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const activityThreshold = new Date(Date.now() - activityThresholdMs);
      
      logger.info('🔍 Loading users with recent activity from user_sync_status', {
        activityThreshold: activityThreshold.toISOString(),
        activityThresholdMs,
        limit
      });

      const query = `
        SELECT 
          user_id,
          wallet_address,
          last_sync_at as last_updated,
          total_value_usd
        FROM user_sync_status 
        WHERE last_sync_at >= $1 
          AND is_sync_enabled = true
        ORDER BY last_sync_at DESC
        LIMIT $2
      `;

      const result = await this.db.query(query, [activityThreshold, limit]);

      logger.info('📊 Users with recent activity query result', {
        foundUsers: result.rows.length,
        activityThreshold: activityThreshold.toISOString(),
        sampleUsers: result.rows.slice(0, 3).map(row => ({
          userId: row.user_id,
          lastUpdated: row.last_updated,
          totalValue: row.total_value_usd
        }))
      });

      return result.rows.map(row => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastUpdated: new Date(row.last_updated),
        totalValueUSD: parseFloat(row.total_value_usd) || 0
      }));

    } catch (error) {
      logger.error('❌ Failed to get users with recent activity', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all users with sync enabled (for periodic sync scheduler) - now using MongoDB
   */
  async getAllEnabledUsers(limit?: number): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastUpdated: Date;
    totalValueUSD: number;
  }>> {
    if (!this.isMongoConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      logger.info('🔍 Loading all enabled users from MongoDB user_sync_status', {
        limit: limit || 'unlimited'
      });

      const results = await this.mongoSyncService.getAllEnabledUsers(limit);

      logger.info('📊 All enabled users from MongoDB', {
        foundUsers: results.length,
        limitApplied: limit || 'none',
        sampleUsers: results.slice(0, 3).map(user => ({
          userId: user.userId,
          lastSyncAt: user.lastSyncAt,
          totalValue: user.totalValueUsd
        }))
      });

      return results.map(user => ({
        userId: user.userId,
        walletAddress: user.walletAddress,
        lastUpdated: user.lastSyncAt,
        totalValueUSD: user.totalValueUsd
      }));

    } catch (error) {
      logger.error('❌ Failed to get enabled users from MongoDB', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute raw query (for advanced operations)
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return this.db.query(text, params);
  }

  /**
   * DEPRECATED: Function moved to MongoDB - use mongoSyncService.getUserSyncStatus instead
   * Get user sync status from MongoDB (simplified for backward compatibility)
   */
  async getUserSyncStatus(userId: string, walletAddress?: string): Promise<{
    userId: string;
    lastSyncAt: Date | null;
    totalSyncs: number;
    successfulSyncs: number;
    lastSyncDuration: number | null;
  } | null> {
    if (!this.isMongoConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      // If walletAddress is provided, use it directly
      if (walletAddress) {
        const result = await this.mongoSyncService.getUserSyncStatus(userId, walletAddress);
        
        if (!result) {
          return null;
        }

        return {
          userId: result.userId,
          lastSyncAt: result.lastSyncAt,
          totalSyncs: result.totalSyncs,
          successfulSyncs: result.successfulSyncs,
          lastSyncDuration: result.syncDurationMs ?? null,
        };
      }

      // If no walletAddress provided, get from token holdings
      const userTokenHoldings = await this.getUserTokenHoldings(userId);
      if (userTokenHoldings.length === 0) {
        return null;
      }

      const firstWalletAddress = userTokenHoldings[0]?.walletAddress;
      if (!firstWalletAddress) {
        return null;
      }

      const result = await this.mongoSyncService.getUserSyncStatus(userId, firstWalletAddress);

      if (!result) {
        return null;
      }

      return {
        userId: result.userId,
        lastSyncAt: result.lastSyncAt,
        totalSyncs: result.totalSyncs,
        successfulSyncs: result.successfulSyncs,
        lastSyncDuration: result.syncDurationMs ?? null,
      };
    } catch (error) {
      logger.error('Error getting user sync status from MongoDB', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get active sync operations for a user
   */
  async getActiveSyncOperations(userId: string): Promise<SyncOperation[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.db.query(`
        SELECT 
          id, user_id, wallet_address, type, status, priority,
          started_at, completed_at, duration_ms, tokens_synced, chains_synced,
          total_value_usd, error_message, retry_count, worker_id, worker_version,
          metadata
        FROM sync_operations 
        WHERE user_id = $1 AND status IN ('pending', 'running')
        ORDER BY started_at DESC
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        type: row.type,
        status: row.status,
        priority: row.priority,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        duration: row.duration_ms, // Map duration_ms to duration
        tokensSync: row.tokens_synced,
        chainsSync: row.chains_synced,
        totalValueUsd: row.total_value_usd,
        error: row.error_message,
        retryCount: row.retry_count,
        workerId: row.worker_id,
        workerVersion: row.worker_version,
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Error getting active sync operations', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user token holdings
   */
  async getUserTokenHoldings(userId: string): Promise<TokenHolding[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      logger.info('🔍 Querying database for user token holdings', {
        userId
      });

      const result = await this.db.query(`
        SELECT 
          id, user_id, wallet_address, chain_id, token_address,
          token_symbol, token_name, token_decimals, balance,
          balance_formatted, price_usd, value_usd, logo_url,
          is_spam, is_verified, last_updated, alchemy_data
        FROM user_token_holdings 
        WHERE user_id = $1
        ORDER BY value_usd DESC
      `, [userId]);

      logger.info('📊 Database query completed', {
        userId,
        rowsReturned: result.rows.length,
        sampleData: result.rows.slice(0, 3).map(row => ({
          symbol: row.token_symbol,
          value: row.value_usd,
          chainId: row.chain_id
        }))
      });

      const holdings = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        chainId: row.chain_id,
        tokenAddress: row.token_address,
        tokenSymbol: row.token_symbol,
        tokenName: row.token_name,
        tokenDecimals: row.token_decimals,
        balance: row.balance,
        balanceFormatted: row.balance_formatted,
        priceUSD: row.price_usd,
        valueUSD: row.value_usd,
        logoUrl: row.logo_url,
        isSpam: row.is_spam,
        isVerified: row.is_verified,
        lastUpdated: row.last_updated,
        alchemyData: row.alchemy_data,
      }));

      logger.info('✅ User token holdings retrieved successfully', {
        userId,
        holdingsCount: holdings.length,
        totalValue: holdings.length > 0 ? 
          Number(holdings.reduce((sum, h) => sum + (Number(h.valueUSD) || 0), 0)).toFixed(2) : 
          '0.00',
        topHoldings: holdings.slice(0, 3).map(h => ({
          symbol: h.tokenSymbol,
          value: (Number(h.valueUSD) || 0).toFixed(2)
        }))
      });

      return holdings;
    } catch (error) {
      logger.error('❌ Error getting user token holdings', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get sync operations with filters
   */
  async getSyncOperations(
    conditions: any,
    options: {
      limit?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<SyncOperation[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const {
        limit = 50,
        orderBy = 'started_at',
        orderDirection = 'desc'
      } = options;

      // Build WHERE clause
      const whereConditions = [];
      const params = [];
      let paramIndex = 1;

      if (conditions.userId) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        params.push(conditions.userId);
      }

      if (conditions.walletAddress) {
        whereConditions.push(`wallet_address = $${paramIndex++}`);
        params.push(conditions.walletAddress);
      }

      if (conditions.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        params.push(conditions.status);
      }

      if (conditions.type) {
        whereConditions.push(`type = $${paramIndex++}`);
        params.push(conditions.type);
      }

      if (conditions.startedAt?.$gte) {
        whereConditions.push(`started_at >= $${paramIndex++}`);
        params.push(conditions.startedAt.$gte);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const query = `
        SELECT 
          id, user_id, wallet_address, type, status, priority,
          started_at, completed_at, duration_ms, tokens_synced, chains_synced,
          total_value_usd, error_message, retry_count, worker_id, worker_version,
          metadata
        FROM sync_operations 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection.toUpperCase()}
        LIMIT $${paramIndex}
      `;

      params.push(limit);

      const result = await this.db.query(query, params);

      // Map database columns to interface properties
      const operations = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        type: row.type,
        status: row.status,
        priority: row.priority,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        duration: row.duration_ms, // Map duration_ms to duration
        tokensSync: row.tokens_synced,
        chainsSync: row.chains_synced,
        totalValueUsd: row.total_value_usd,
        error: row.error_message,
        retryCount: row.retry_count,
        workerId: row.worker_id,
        workerVersion: row.worker_version,
        metadata: row.metadata
      }));

      logger.debug('Sync operations retrieved', {
        conditions,
        operationsCount: operations.length,
        limit
      });

      return operations;

    } catch (error) {
      logger.error('Error getting sync operations', {
        conditions,
        options,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 