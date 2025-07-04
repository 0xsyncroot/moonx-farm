import { RealTrade, TradeFilters } from '../types';
import { DatabaseService } from './databaseService';
import { CacheService } from './cacheService';

export class TradesService {
  private db: DatabaseService;
  private cacheService: CacheService;

  constructor(databaseService: DatabaseService, cacheService: CacheService) {
    this.db = databaseService;
    this.cacheService = cacheService;
  }

  /**
   * Get recent trades for a user with caching and filtering
   */
  async getRecentTrades(userId: string, filters?: {
    limit?: number;
    chainIds?: number[];
    days?: number;
  }): Promise<RealTrade[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const limit = Math.min(filters?.limit || 50, 500); // Cap at 500 for performance
    const days = Math.min(filters?.days || 30, 365); // Cap at 1 year
    const chainIds = filters?.chainIds?.filter(id => id > 0) || []; // Validate chain IDs
    
    const cacheKey = `recent_trades:${userId}:${limit}:${days}:${chainIds.join(',') || 'all'}`;
    
    try {
      // Try cache first (5 minutes TTL for recent trades)
      const cached = await this.cacheService.get<RealTrade[]>(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached;
      }

      // Fetch from database with validation
      const fetchFilters: { limit: number; days: number; chainIds?: number[] } = {
        limit,
        days
      };
      
      if (chainIds.length > 0) {
        fetchFilters.chainIds = chainIds;
      }
      
      const trades = await this.fetchRecentTrades(userId, fetchFilters);
      
      // Cache successful results
      if (trades.length >= 0) {
        await this.cacheService.set(cacheKey, trades, 300); // 5 minutes TTL
      }
      
      return trades;
    } catch (error) {
      console.error(`Failed to get recent trades for user ${userId}:`, error);
      
      // Try to return cached data even if expired in case of database issues
      try {
        const cached = await this.cacheService.get<RealTrade[]>(cacheKey);
        if (cached && Array.isArray(cached)) {
          console.warn(`Returning stale cached data for user ${userId} due to database error`);
          return cached;
        }
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
      
      throw new Error(`Failed to retrieve recent trades: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch trades from database with proper error handling and validation
   */
  private async fetchRecentTrades(userId: string, filters?: {
    limit?: number;
    chainIds?: number[];
    days?: number;
  }): Promise<RealTrade[]> {
    try {
      const limit = filters?.limit || 50;
      const days = filters?.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Build parameterized query to prevent SQL injection
      let query = `
        SELECT 
          id, user_id, wallet_address, tx_hash, chain_id, block_number, 
          timestamp, type as trade_type, status, from_token, to_token, 
          gas_fee_eth, gas_fee_usd, protocol_fee_usd, slippage, 
          price_impact, dex_name, router_address, aggregator, pnl,
          created_at, updated_at
        FROM user_trades 
        WHERE user_id = $1 AND timestamp >= $2
      `;
      const params: any[] = [userId, startDate];

      // Add chain filter if specified
      if (filters?.chainIds && filters.chainIds.length > 0) {
        query += ` AND chain_id = ANY($3)`;
        params.push(filters.chainIds);
      }

      // Add ordering and limit
      query += ` ORDER BY timestamp DESC, created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.db.query(query, params);
      
      if (!result || !result.rows) {
        console.warn(`No trades found for user ${userId} in last ${days} days`);
        return [];
      }

      // Map database rows to RealTrade objects with proper validation
      const trades = result.rows
        .map((row: any) => this.mapRowToRealTrade(row))
        .filter((trade: RealTrade | null): trade is RealTrade => trade !== null);

      console.log(`Retrieved ${trades.length} trades for user ${userId}`);
      return trades;

    } catch (error) {
      console.error(`Database error fetching trades for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Map database row to RealTrade with proper type safety and validation
   */
  private mapRowToRealTrade(row: any): RealTrade | null {
    try {
      // Validate required fields
      if (!row.id || !row.user_id || !row.tx_hash || !row.timestamp) {
        console.warn('Skipping invalid trade row - missing required fields:', row.id);
        return null;
      }

      // Parse JSON fields safely
      let fromToken, toToken, pnl;
      
      try {
        // Handle JSONB fields - they may already be parsed objects or JSON strings
        fromToken = row.from_token 
          ? (typeof row.from_token === 'object' ? row.from_token : JSON.parse(row.from_token))
          : null;
        toToken = row.to_token 
          ? (typeof row.to_token === 'object' ? row.to_token : JSON.parse(row.to_token))
          : null;
        pnl = row.pnl 
          ? (typeof row.pnl === 'object' ? row.pnl : JSON.parse(row.pnl))
          : null;
      } catch (parseError) {
        console.error(`Failed to parse JSON fields for trade ${row.id}:`, parseError);
        console.error('Raw data:', { from_token: row.from_token, to_token: row.to_token });
        return null;
      }

      if (!fromToken || !toToken) {
        console.warn(`Invalid token data for trade ${row.id}`);
        return null;
      }

      // Build trade object with proper optional property handling
      const trade: RealTrade = {
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        txHash: row.tx_hash,
        chainId: parseInt(row.chain_id),
        blockNumber: parseInt(row.block_number) || 0,
        timestamp: new Date(row.timestamp),
        type: row.trade_type || 'swap',
        status: row.status || 'completed',
        fromToken: {
          address: fromToken.address || '',
          symbol: fromToken.symbol || 'UNKNOWN',
          name: fromToken.name || 'Unknown Token',
          decimals: parseInt(fromToken.decimals) || 18,
          amount: fromToken.amount || '0',
          amountFormatted: parseFloat(fromToken.amountFormatted) || 0,
          priceUSD: parseFloat(fromToken.priceUSD) || 0,
          valueUSD: parseFloat(fromToken.valueUSD) || 0
        },
        toToken: {
          address: toToken.address || '',
          symbol: toToken.symbol || 'UNKNOWN', 
          name: toToken.name || 'Unknown Token',
          decimals: parseInt(toToken.decimals) || 18,
          amount: toToken.amount || '0',
          amountFormatted: parseFloat(toToken.amountFormatted) || 0,
          priceUSD: parseFloat(toToken.priceUSD) || 0,
          valueUSD: parseFloat(toToken.valueUSD) || 0
        },
        gasFeeETH: parseFloat(row.gas_fee_eth) || 0,
        gasFeeUSD: parseFloat(row.gas_fee_usd) || 0
      };

      // Add optional properties only if they have valid values
      if (row.protocol_fee_usd !== null && row.protocol_fee_usd !== undefined) {
        const protocolFee = parseFloat(row.protocol_fee_usd);
        if (!isNaN(protocolFee)) {
          trade.protocolFeeUSD = protocolFee;
        }
      }

      if (row.slippage !== null && row.slippage !== undefined) {
        const slippage = parseFloat(row.slippage);
        if (!isNaN(slippage)) {
          trade.slippage = slippage;
        }
      }

      if (row.price_impact !== null && row.price_impact !== undefined) {
        const priceImpact = parseFloat(row.price_impact);
        if (!isNaN(priceImpact)) {
          trade.priceImpact = priceImpact;
        }
      }

      if (row.dex_name) {
        trade.dexName = row.dex_name;
      }

      if (row.router_address) {
        trade.routerAddress = row.router_address;
      }

      if (row.aggregator && ['lifi', '1inch', 'relay', 'jupiter'].includes(row.aggregator)) {
        trade.aggregator = row.aggregator as 'lifi' | '1inch' | 'relay' | 'jupiter';
      }

      if (pnl && typeof pnl === 'object') {
        trade.pnl = {
          realizedPnlUSD: parseFloat(pnl.realizedPnlUSD) || 0,
          feesPaidUSD: parseFloat(pnl.feesPaidUSD) || 0,
          netPnlUSD: parseFloat(pnl.netPnlUSD) || 0
        };

        // Add unrealizedPnlUSD only if it has a valid value
        if (pnl.unrealizedPnlUSD !== null && pnl.unrealizedPnlUSD !== undefined) {
          const unrealizedPnl = parseFloat(pnl.unrealizedPnlUSD);
          if (!isNaN(unrealizedPnl)) {
            trade.pnl.unrealizedPnlUSD = unrealizedPnl;
          }
        }
      }

      return trade;

    } catch (error) {
      console.error(`Error mapping trade row ${row.id}:`, error);
      return null;
    }
  }

  /**
   * Clear trades cache for user - production-ready cache invalidation
   */
  async clearTradesCache(userId: string): Promise<void> {
    if (!userId) {
      console.warn('Cannot clear trades cache - userId is required');
      return;
    }

    try {
      // Clear all possible cache combinations for this user
      const cachePatterns = [];
      
      // Common limit/days combinations
      const limits = [20, 50, 100, 200, 500];
      const dayOptions = [1, 7, 14, 30, 60, 90, 180, 365];
      
      for (const limit of limits) {
        for (const days of dayOptions) {
          // Clear for all chains
          cachePatterns.push(`recent_trades:${userId}:${limit}:${days}:all`);
          
          // Clear for specific popular chain combinations
          const popularChains = [
            [1], // Ethereum
            [137], // Polygon  
            [10], // Optimism
            [42161], // Arbitrum
            [8453], // Base
            [1, 137], // ETH + Polygon
            [1, 10, 42161], // ETH + L2s
          ];
          
          for (const chainIds of popularChains) {
            cachePatterns.push(`recent_trades:${userId}:${limit}:${days}:${chainIds.join(',')}`);
          }
        }
      }

      // Delete all cache keys in parallel for better performance
      const deletePromises = cachePatterns.map(key => 
        this.cacheService.del(key).catch(error => 
          console.warn(`Failed to delete cache key ${key}:`, error)
        )
      );

      await Promise.allSettled(deletePromises);
      console.log(`Cleared ${cachePatterns.length} trades cache patterns for user ${userId}`);

    } catch (error) {
      console.error(`Error clearing trades cache for user ${userId}:`, error);
      // Don't throw - cache clearing failure shouldn't break the application
    }
  }

  /**
   * Get trades count for user (for pagination)
   */
  async getTradesCount(userId: string, filters?: {
    chainIds?: number[];
    days?: number;
  }): Promise<number> {
    try {
      const days = filters?.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = `
        SELECT COUNT(*) as count
        FROM user_trades 
        WHERE user_id = $1 AND timestamp >= $2
      `;
      const params: any[] = [userId, startDate];

      if (filters?.chainIds && filters.chainIds.length > 0) {
        query += ` AND chain_id = ANY($3)`;
        params.push(filters.chainIds);
      }

      const result = await this.db.query(query, params);
      return parseInt(result.rows[0]?.count) || 0;

    } catch (error) {
      console.error(`Error getting trades count for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Health check for trades service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    database: boolean;
    cache: boolean;
    lastTradeTimestamp?: Date;
  }> {
    const health: {
      status: 'healthy' | 'unhealthy';
      database: boolean;
      cache: boolean;
      lastTradeTimestamp?: Date;
    } = {
      status: 'healthy',
      database: false,
      cache: false
    };

    try {
      // Check database connectivity
      const dbResult = await this.db.query('SELECT 1 as health_check');
      health.database = dbResult.rows.length > 0;

      // Check cache connectivity  
      await this.cacheService.set('health_check', 'ok', 10);
      const cacheResult = await this.cacheService.get('health_check');
      health.cache = cacheResult === 'ok';

      // Check latest trade
      const latestTradeResult = await this.db.query(
        'SELECT MAX(timestamp) as latest FROM user_trades LIMIT 1'
      );
      if (latestTradeResult.rows[0]?.latest) {
        health.lastTradeTimestamp = new Date(latestTradeResult.rows[0].latest);
      }

      health.status = health.database && health.cache ? 'healthy' : 'unhealthy';

    } catch (error) {
      console.error('Trades service health check failed:', error);
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Add a new trade to the database
   */
  async addTrade(tradeData: {
    userId: string;
    walletAddress: string;
    txHash: string;
    chainId: number;
    blockNumber?: number;
    timestamp?: Date;
    type: 'swap' | 'buy' | 'sell';
    status: 'pending' | 'completed' | 'failed';
    fromToken: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      amount: string;
      amountFormatted: number;
      priceUSD: number;
      valueUSD: number;
    };
    toToken: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      amount: string;
      amountFormatted: number;
      priceUSD: number;
      valueUSD: number;
    };
    gasFeeETH?: number;
    gasFeeUSD: number;
    protocolFeeUSD?: number;
    slippage?: number;
    priceImpact?: number;
    dexName?: string;
    routerAddress?: string;
    aggregator?: 'lifi' | '1inch' | 'relay' | 'jupiter';
  }): Promise<RealTrade> {
    if (!tradeData.userId || !tradeData.walletAddress || !tradeData.txHash) {
      throw new Error('User ID, wallet address, and transaction hash are required');
    }

    try {
      // Check if trade already exists
      const existingTrade = await this.getTradeByTxHash(tradeData.txHash, tradeData.userId);
      if (existingTrade) {
        throw new Error(`Trade with txHash ${tradeData.txHash} already exists for user ${tradeData.userId}`);
      }

      // Ensure tokens are objects before stringifying
      const fromTokenStr = typeof tradeData.fromToken === 'object' ? JSON.stringify(tradeData.fromToken) : String(tradeData.fromToken);
      const toTokenStr = typeof tradeData.toToken === 'object' ? JSON.stringify(tradeData.toToken) : String(tradeData.toToken);

      // Insert trade into database (let PostgreSQL generate UUID for id)
      const insertQuery = `
        INSERT INTO user_trades (
          user_id, wallet_address, tx_hash, chain_id, block_number,
          timestamp, type, status, from_token, to_token,
          gas_fee_eth, gas_fee_usd, protocol_fee_usd, slippage, price_impact,
          dex_name, router_address, aggregator, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING *
      `;

      const params = [
        tradeData.userId,
        tradeData.walletAddress,
        tradeData.txHash,
        tradeData.chainId,
        tradeData.blockNumber || 0,
        tradeData.timestamp || new Date(),
        tradeData.type,
        tradeData.status,
        fromTokenStr,
        toTokenStr,
        tradeData.gasFeeETH || 0,
        tradeData.gasFeeUSD,
        tradeData.protocolFeeUSD || null,
        tradeData.slippage || null,
        tradeData.priceImpact || null,
        tradeData.dexName || null,
        tradeData.routerAddress || null,
        tradeData.aggregator || null
      ];

      const result = await this.db.query(insertQuery, params);
      
      if (!result.rows[0]) {
        throw new Error('Failed to insert trade');
      }

      // Map result to RealTrade
      const savedTrade = this.mapRowToRealTrade(result.rows[0]);
      
      if (!savedTrade) {
        throw new Error('Failed to map saved trade data');
      }

      // Clear cache for this user
      await this.clearTradesCache(tradeData.userId);

      console.log(`✅ Added new trade ${savedTrade.id} for user ${tradeData.userId}`);
      return savedTrade;

    } catch (error) {
      console.error(`❌ Failed to add trade for user ${tradeData.userId}:`, error);
      throw error;
    }
  }

  /**
   * Get trade by transaction hash
   */
  async getTradeByTxHash(txHash: string, userId: string): Promise<RealTrade | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_trades WHERE tx_hash = $1 AND user_id = $2',
        [txHash, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToRealTrade(result.rows[0]);
    } catch (error) {
      console.error(`❌ Error fetching trade by txHash ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Update trade status (e.g., from pending to completed)
   */
  async updateTradeStatus(
    txHash: string, 
    userId: string, 
    updates: {
      status?: 'pending' | 'completed' | 'failed';
      blockNumber?: number;
      timestamp?: Date;
      gasFeeETH?: number;
      gasFeeUSD?: number;
      pnl?: {
        realizedPnlUSD: number;
        feesPaidUSD: number;
        netPnlUSD: number;
        unrealizedPnlUSD?: number;
      };
    }
  ): Promise<RealTrade | null> {
    try {
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateParams.push(updates.status);
      }

      if (updates.blockNumber !== undefined) {
        updateFields.push(`block_number = $${paramIndex++}`);
        updateParams.push(updates.blockNumber);
      }

      if (updates.timestamp !== undefined) {
        updateFields.push(`timestamp = $${paramIndex++}`);
        updateParams.push(updates.timestamp);
      }

      if (updates.gasFeeETH !== undefined) {
        updateFields.push(`gas_fee_eth = $${paramIndex++}`);
        updateParams.push(updates.gasFeeETH);
      }

      if (updates.gasFeeUSD !== undefined) {
        updateFields.push(`gas_fee_usd = $${paramIndex++}`);
        updateParams.push(updates.gasFeeUSD);
      }

      if (updates.pnl !== undefined) {
        updateFields.push(`pnl = $${paramIndex++}`);
        updateParams.push(JSON.stringify(updates.pnl));
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push('updated_at = NOW()');

      const query = `
        UPDATE user_trades 
        SET ${updateFields.join(', ')} 
        WHERE tx_hash = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
      `;

      updateParams.push(txHash, userId);

      const result = await this.db.query(query, updateParams);

      if (result.rows.length === 0) {
        return null;
      }

      // Clear cache for this user
      await this.clearTradesCache(userId);

      console.log(`✅ Updated trade ${txHash} for user ${userId}`);
      return this.mapRowToRealTrade(result.rows[0]);

    } catch (error) {
      console.error(`❌ Failed to update trade ${txHash}:`, error);
      throw error;
    }
  }
} 