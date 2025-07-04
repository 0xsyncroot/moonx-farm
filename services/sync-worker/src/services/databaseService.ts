import { config } from '@/config';
import { logger } from '@/utils/logger';

interface QueryResult {
  rows: any[];
  rowCount: number;
}

export class DatabaseService {
  private isConnected = false;

  constructor() {
    logger.info('🐘 Database service created');
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      // For now, just mark as connected
      // In a real implementation, you would establish database connection here
      this.isConnected = true;
      
      logger.info('🐘 Database service initialized', {
        host: config.database.host,
        database: config.database.database,
      });
    } catch (error) {
      logger.error('Failed to initialize database service', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute query with error handling and logging
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - replace with actual database query
      const result: QueryResult = {
        rows: [],
        rowCount: 0
      };
      
      const duration = Date.now() - startTime;
      
      logger.debug('Database query executed', {
        duration: `${duration}ms`,
        rows: result.rowCount,
        command: text.split(' ')[0]?.toUpperCase() || 'UNKNOWN',
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Database query failed', {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        query: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params).slice(0, 200) : undefined,
      });
      
      throw error;
    }
  }

  /**
   * Get users needing sync from database
   */
  async getUsersNeedingSync(): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date;
  }>> {
    try {
      const query = `
        SELECT DISTINCT user_id, wallet_address, MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE last_updated < NOW() - INTERVAL '15 minutes'
        GROUP BY user_id, wallet_address
        ORDER BY last_sync ASC
        LIMIT 20
      `;
      
      const result = await this.query(query);
      
      return result.rows.map((row: any) => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastSyncAt: new Date(row.last_sync),
      }));
    } catch (error) {
      logger.error('Error getting users needing sync', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get stale portfolios from database
   */
  async getStalePortfolios(): Promise<Array<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date;
  }>> {
    try {
      const query = `
        SELECT DISTINCT user_id, wallet_address, MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE last_updated < NOW() - INTERVAL '2 hours'
        GROUP BY user_id, wallet_address
        ORDER BY last_sync ASC
        LIMIT 10
      `;
      
      const result = await this.query(query);
      
      return result.rows.map((row: any) => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastSyncAt: new Date(row.last_sync),
      }));
    } catch (error) {
      logger.error('Error getting stale portfolios', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update user sync status in database
   */
  async updateUserSyncStatus(
    userId: string,
    walletAddress: string,
    reason: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO user_sync_status (
          user_id, wallet_address, last_sync_reason, sync_type, 
          status, tokens_synced, chains_synced, total_value_usd, 
          error, metadata, last_sync_at
        ) VALUES ($1, $2, $3, 'portfolio', 'completed', 0, 0, 0, NULL, '{}', NOW())
        ON CONFLICT (user_id, wallet_address) 
        DO UPDATE SET
          last_sync_reason = $3,
          status = 'completed',
          last_sync_at = NOW()
      `;
      
      await this.query(query, [userId, walletAddress, reason]);
      
      logger.debug('Updated sync status', {
        userId,
        walletAddress,
        reason,
      });
    } catch (error) {
      logger.warn('Error updating sync status', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save portfolio holdings to database
   */
  async savePortfolioHoldings(
    userId: string,
    walletAddress: string,
    holdings: any[]
  ): Promise<void> {
    try {
      // Delete existing holdings for this wallet
      await this.query(
        'DELETE FROM user_token_holdings WHERE user_id = $1 AND wallet_address = $2',
        [userId, walletAddress]
      );

      // Insert new holdings
      for (const holding of holdings) {
        const insertQuery = `
          INSERT INTO user_token_holdings (
            id, user_id, wallet_address, chain_id, token_address,
            token_symbol, token_name, token_decimals, balance,
            balance_formatted, price_usd, value_usd, last_updated, alchemy_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `;

        await this.query(insertQuery, [
          holding.id,
          userId,
          walletAddress,
          holding.chainId,
          holding.tokenAddress,
          holding.tokenSymbol,
          holding.tokenName,
          holding.tokenDecimals,
          holding.balance,
          holding.balanceFormatted,
          holding.priceUSD,
          holding.valueUSD,
          new Date(),
          holding.alchemyData ? JSON.stringify(holding.alchemyData) : null,
        ]);
      }

      logger.info('Saved portfolio holdings', {
        userId,
        walletAddress,
        holdingsCount: holdings.length,
        totalValue: holdings.reduce((sum, h) => sum + (h.valueUSD || 0), 0),
      });
    } catch (error) {
      logger.error('Error saving portfolio holdings', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Save sync operation to database
   */
  async saveSyncOperation(syncOp: {
    id: string;
    userId: string;
    walletAddress: string;
    type: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO sync_operations (
          id, user_id, wallet_address, type, status, started_at, 
          completed_at, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          status = $5, completed_at = $7, error = $8, metadata = $9
      `;

      await this.query(query, [
        syncOp.id,
        syncOp.userId,
        syncOp.walletAddress,
        syncOp.type,
        syncOp.status,
        syncOp.startedAt,
        syncOp.completedAt,
        syncOp.error,
        syncOp.metadata ? JSON.stringify(syncOp.metadata) : null,
      ]);

      logger.debug('Saved sync operation', {
        id: syncOp.id,
        userId: syncOp.userId,
        status: syncOp.status,
      });
    } catch (error) {
      logger.error('Error saving sync operation', {
        id: syncOp.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get last sync time for a user
   */
  async getLastSyncTime(userId: string, walletAddress: string): Promise<Date | null> {
    try {
      const query = `
        SELECT MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      
      const result = await this.query(query, [userId, walletAddress]);
      return result.rows[0]?.last_sync ? new Date(result.rows[0].last_sync) : null;
    } catch (error) {
      logger.error('Error getting last sync time', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get total users count
   */
  async getTotalUsersCount(): Promise<number> {
    try {
      const query = 'SELECT COUNT(DISTINCT user_id) as count FROM user_token_holdings';
      const result = await this.query(query);
      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Error getting total users count', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Check if database connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      this.isConnected = false;
      logger.info('🐘 Database service closed');
    } catch (error) {
      logger.error('Error closing database service', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
} 