import { DatabaseManager, createDatabase } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { config } from '@/config';
import { randomUUID } from 'crypto';

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
  private isConnected = false;

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
    logger.info('DatabaseService initialized for sync worker');
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.db.connect();
      this.isConnected = true;
      logger.info('✅ Database connected successfully');
    } catch (error) {
      logger.error('❌ Database connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.db.disconnect();
      this.isConnected = false;
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting database', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{ connected: boolean; responseTime?: number }> {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const startTime = Date.now();
      await this.db.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return { connected: true, responseTime };
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { connected: false };
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
      // Prepare batch queries
      const queries = [];
      
      // Clear existing holdings for this user/wallet
      queries.push({
        text: 'DELETE FROM user_token_holdings WHERE user_id = $1 AND wallet_address = $2',
        params: [userId, walletAddress]
      });

      // Insert new holdings
      if (holdings.length > 0) {
        for (const holding of holdings) {
          queries.push({
            text: `
              INSERT INTO user_token_holdings (
                id, user_id, wallet_address, chain_id, token_address, 
                token_symbol, token_name, token_decimals, balance, 
                balance_formatted, price_usd, value_usd, logo_url, 
                is_spam, is_verified, last_updated, alchemy_data
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `,
            params: [
              holding.id || randomUUID(), // Use UUID instead of string concat
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
          });
        }
      }

      // Execute batch transaction
      await this.db.batch(queries);

      logger.info('💾 Portfolio holdings saved to database', {
        userId,
        walletAddress,
        holdingsCount: holdings.length,
        totalValue: holdings.reduce((sum, h) => sum + h.valueUSD, 0).toFixed(2)
      });

    } catch (error) {
      logger.error('❌ Failed to save portfolio holdings', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error)
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
   * Get users with stale portfolio data
   */
  async getUsersWithStaleData(staleThresholdMs: number, limit: number = 50): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastUpdated: Date;
    totalValueUSD: number;
  }>> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const staleThreshold = new Date(Date.now() - staleThresholdMs);
      
      const query = `
        SELECT 
          user_id,
          wallet_address,
          MAX(last_updated) as last_updated,
          SUM(value_usd) as total_value_usd
        FROM user_token_holdings 
        WHERE last_updated < $1
        GROUP BY user_id, wallet_address
        ORDER BY last_updated ASC
        LIMIT $2
      `;

      const result = await this.db.query(query, [staleThreshold, limit]);

      return result.rows.map(row => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastUpdated: new Date(row.last_updated),
        totalValueUSD: parseFloat(row.total_value_usd) || 0
      }));

    } catch (error) {
      logger.error('❌ Failed to get users with stale data', {
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
   * Get user sync status
   */
  async getUserSyncStatus(userId: string): Promise<{
    userId: string;
    lastSyncAt: Date | null;
    totalSyncs: number;
    successfulSyncs: number;
    lastSyncDuration: number | null;
  } | null> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.db.query(`
        SELECT 
          user_id,
          last_sync_at,
          total_syncs,
          successful_syncs,
          last_sync_duration
        FROM user_sync_status 
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        lastSyncAt: row.last_sync_at,
        totalSyncs: row.total_syncs,
        successfulSyncs: row.successful_syncs,
        lastSyncDuration: row.last_sync_duration,
      };
    } catch (error) {
      logger.error('Error getting user sync status', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get active sync operations for user
   */
  async getActiveSyncOperations(userId: string): Promise<SyncOperation[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.db.query(`
        SELECT 
          id, user_id, wallet_address, type, status, priority,
          started_at, completed_at, duration, tokens_sync, chains_sync,
          total_value_usd, error, retry_count, worker_id, worker_version,
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
        duration: row.duration,
        tokensSync: row.tokens_sync,
        chainsSync: row.chains_sync,
        totalValueUsd: row.total_value_usd,
        error: row.error,
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

      return result.rows.map(row => ({
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
    } catch (error) {
      logger.error('Error getting user token holdings', {
        userId,
        error: error instanceof Error ? error.message : String(error)
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
          started_at, completed_at, duration, tokens_sync, chains_sync,
          total_value_usd, error, retry_count, worker_id, worker_version,
          metadata
        FROM sync_operations 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection.toUpperCase()}
        LIMIT $${paramIndex}
      `;

      params.push(limit);

      const result = await this.db.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        type: row.type,
        status: row.status,
        priority: row.priority,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        duration: row.duration,
        tokensSync: row.tokens_sync,
        chainsSync: row.chains_sync,
        totalValueUsd: row.total_value_usd,
        error: row.error,
        retryCount: row.retry_count,
        workerId: row.worker_id,
        workerVersion: row.worker_version,
        metadata: row.metadata,
      }));
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