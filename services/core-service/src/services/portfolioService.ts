import { Portfolio, TokenHolding, PortfolioFilters } from '../types';
import { CacheService } from './cacheService';
import { DatabaseService } from './databaseService';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('portfolio-service');

export class PortfolioService {
  private cacheService: CacheService;
  private db: DatabaseService;

  constructor(databaseService: DatabaseService, cacheService: CacheService) {
    this.cacheService = cacheService;
    this.db = databaseService;
  }

  /**
   * Get portfolio data (cache first, then database)
   */
  async getPortfolio(userId: string, walletAddress: string, filters?: PortfolioFilters): Promise<Portfolio | null> {
    try {
      // Try cache first
      const cached = await this.getCachedPortfolio(userId, walletAddress);
      if (cached) {
        logger.info('Portfolio cache found', { 
          userId, 
          walletAddress, 
          holdingsCount: cached.holdings?.length || 0,
          hasLastSynced: !!cached.lastSynced,
          lastSyncedType: typeof cached.lastSynced,
          lastSyncedValue: cached.lastSynced?.toString()
        });
        
        // Validate cached data structure
        if (!this.isValidCachedPortfolio(cached)) {
          logger.warn('Invalid cached portfolio data, clearing cache', { userId, walletAddress });
          await this.clearPortfolioCache(userId, walletAddress);
        } else if (this.isCacheValid(cached.lastSynced)) {
          logger.info('Portfolio cache hit and valid', { userId, walletAddress, holdingsCount: cached.holdings.length });
          return this.applyFilters(cached, filters);
        } else {
          logger.info('Portfolio cache hit but expired', { 
            userId, 
            walletAddress, 
            lastSynced: cached.lastSynced,
            ageMinutes: this.getCacheAgeMinutes(cached.lastSynced)
          });
        }
      }

      // Try database
      const dbPortfolio = await this.getPortfolioFromDB(userId, walletAddress);
      if (dbPortfolio) {
        logger.info('Portfolio database hit', { userId, walletAddress, holdingsCount: dbPortfolio.holdings.length });
        
        // Cache the result
        await this.cachePortfolio(dbPortfolio);
        return this.applyFilters(dbPortfolio, filters);
      }

      logger.info('No portfolio data found', { userId, walletAddress });
      return null;
    } catch (error) {
      logger.error('Error getting portfolio', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error
      });
      return null;
    }
  }

  /**
   * Get quick portfolio overview
   */
  async getQuickPortfolio(userId: string, walletAddress: string): Promise<{
    totalValueUSD: number;
    topHoldings: TokenHolding[];
    lastSynced: Date | null;
  }> {
    try {
      const cacheKey = `quick_portfolio:${userId}:${walletAddress}`;
      
      // Try cache first
      const cached = await this.cacheService.get<{
        totalValueUSD: number;
        topHoldings: TokenHolding[];
        lastSynced: Date | null;
      }>(cacheKey);
      
      if (cached && this.isValidQuickPortfolioData(cached)) {
        logger.info('Quick portfolio cache hit', { userId, walletAddress, totalValueUSD: cached.totalValueUSD });
        return cached;
      }

      // Get from full portfolio
      const portfolio = await this.getPortfolio(userId, walletAddress);
      if (!portfolio) {
        logger.info('No quick portfolio data available', { userId, walletAddress });
        return {
          totalValueUSD: 0,
          topHoldings: [],
          lastSynced: null
        };
      }

      const quickData = {
        totalValueUSD: portfolio.totalValueUSD,
        topHoldings: portfolio.holdings.slice(0, 5), // Top 5 holdings
        lastSynced: portfolio.lastSynced
      };

      // Cache for 2 minutes (quick refresh)
      await this.cacheService.set(cacheKey, quickData, 120);
      
      logger.info('Quick portfolio generated', { userId, walletAddress, totalValueUSD: quickData.totalValueUSD });
      return quickData;
    } catch (error) {
      logger.error('Error getting quick portfolio', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error
      });
      return {
        totalValueUSD: 0,
        topHoldings: [],
        lastSynced: null
      };
    }
  }

  /**
   * Get user sync status from database
   */
  async getUserSyncStatus(userId: string, walletAddress: string): Promise<{
    lastSyncAt: Date | null;
    syncStatus: string;
    tokensCount: number;
    totalValueUSD: number;
    isSyncEnabled: boolean;
  } | null> {
    try {
      const query = `
        SELECT 
          last_sync_at,
          sync_status,
          tokens_count,
          total_value_usd,
          is_sync_enabled
        FROM user_sync_status 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      
      const result = await this.db.query(query, [userId, walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
        syncStatus: row.sync_status || 'unknown',
        tokensCount: row.tokens_count || 0,
        totalValueUSD: parseFloat(row.total_value_usd) || 0,
        isSyncEnabled: row.is_sync_enabled === true
      };
    } catch (error) {
      logger.error('Error getting user sync status', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error
      });
      return null;
    }
  }

  /**
   * Clear portfolio cache
   */
  async clearPortfolioCache(userId: string, walletAddress: string): Promise<void> {
    try {
      const keys = [
        this.cacheService.getUserPortfolioKey(userId),
        `quick_portfolio:${userId}:${walletAddress}`
      ];
      
      for (const key of keys) {
        await this.cacheService.del(key);
      }
      
      logger.info('Portfolio cache cleared', { userId, walletAddress });
    } catch (error) {
      logger.error('Error clearing portfolio cache', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error
      });
    }
  }

  /**
   * Get cached portfolio
   */
  private async getCachedPortfolio(userId: string, walletAddress: string): Promise<Portfolio | null> {
    try {
      const cacheKey = this.cacheService.getUserPortfolioKey(userId);
      logger.debug('Attempting to get cached portfolio', { userId, walletAddress, cacheKey });
      
      const cached = await this.cacheService.get<Portfolio>(cacheKey);
      
      if (cached) {
        logger.debug('Portfolio cache retrieved', { 
          userId, 
          walletAddress, 
          hasHoldings: !!cached.holdings,
          holdingsCount: cached.holdings?.length || 0
        });
      } else {
        logger.debug('No cached portfolio found', { userId, walletAddress, cacheKey });
      }
      
      return cached;
    } catch (error) {
      logger.error('Error getting cached portfolio', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        cacheKey: this.cacheService.getUserPortfolioKey(userId)
      });
      return null;
    }
  }

  /**
   * Cache portfolio data
   */
  private async cachePortfolio(portfolio: Portfolio): Promise<void> {
    try {
      const cacheKey = this.cacheService.getUserPortfolioKey(portfolio.userId);
      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, portfolio, 600);
      
      logger.info('Portfolio cached', { 
        userId: portfolio.userId, 
        walletAddress: portfolio.walletAddress,
        holdingsCount: portfolio.holdings.length 
      });
    } catch (error) {
      logger.error('Error caching portfolio', { 
        userId: portfolio.userId, 
        walletAddress: portfolio.walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error
      });
    }
  }

  /**
   * Check if cache is valid (5 minute window)
   */
  private isCacheValid(lastSynced: Date | null): boolean {
    if (!lastSynced) return false;
    
    // Handle string dates from cache
    const syncDate = lastSynced instanceof Date ? lastSynced : new Date(lastSynced);
    if (isNaN(syncDate.getTime())) return false;
    
    const now = new Date();
    const diffMinutes = (now.getTime() - syncDate.getTime()) / (1000 * 60);
    return diffMinutes < 5;
  }

  /**
   * Get cache age in minutes
   */
  private getCacheAgeMinutes(lastSynced: Date | null): number {
    if (!lastSynced) return Infinity;
    
    const syncDate = lastSynced instanceof Date ? lastSynced : new Date(lastSynced);
    if (isNaN(syncDate.getTime())) return Infinity;
    
    const now = new Date();
    return (now.getTime() - syncDate.getTime()) / (1000 * 60);
  }

  /**
   * Validate cached portfolio data structure
   */
  private isValidCachedPortfolio(data: any): data is Portfolio {
    return data && 
           typeof data === 'object' &&
           typeof data.userId === 'string' &&
           typeof data.walletAddress === 'string' &&
           typeof data.totalValueUSD === 'number' &&
           Array.isArray(data.holdings) &&
           data.holdings.every((holding: any) => 
             holding && 
             typeof holding.tokenSymbol === 'string' &&
             typeof holding.valueUSD === 'number'
           );
  }

  /**
   * Validate quick portfolio data structure
   */
  private isValidQuickPortfolioData(data: any): data is { 
    totalValueUSD: number; 
    topHoldings: TokenHolding[]; 
    lastSynced: Date | null 
  } {
    return data && 
           typeof data.totalValueUSD === 'number' && 
           Array.isArray(data.topHoldings) && 
           (data.lastSynced === null || data.lastSynced instanceof Date);
  }

  /**
   * Apply filters to portfolio data
   */
  private applyFilters(portfolio: Portfolio, filters?: PortfolioFilters): Portfolio {
    if (!filters) return portfolio;
    
    try {
      if (!portfolio.holdings || !Array.isArray(portfolio.holdings)) {
        logger.warn('Invalid portfolio holdings for filtering', { 
          userId: portfolio.userId,
          walletAddress: portfolio.walletAddress,
          holdingsType: typeof portfolio.holdings
        });
        return portfolio;
      }

      let filteredHoldings = [...portfolio.holdings];

    // Filter by chain IDs
    if (filters.chainIds) {
      const chainIds = filters.chainIds.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
      if (chainIds.length > 0) {
        filteredHoldings = filteredHoldings.filter(h => 
          chainIds.includes(h.chainId)
        );
      }
    }

    // Filter by minimum USD value
    if (filters.minValueUSD) {
      filteredHoldings = filteredHoldings.filter(h => 
        h.valueUSD >= filters.minValueUSD!
      );
    }

    // Hide small balances
    if (filters.hideSmallBalances) {
      filteredHoldings = filteredHoldings.filter(h => h.valueUSD >= 1);
    }

    // Hide spam tokens
    if (filters.hideSpamTokens) {
      filteredHoldings = filteredHoldings.filter(h => 
        !h.alchemyData?.isSpam && !h.alchemyData?.possibleSpam
      );
    }

    // Sort holdings
    if (filters.sortBy) {
      filteredHoldings.sort((a, b) => {
        let aVal: number, bVal: number;
        
        switch (filters.sortBy) {
          case 'value':
            aVal = a.valueUSD;
            bVal = b.valueUSD;
            break;
          case 'balance':
            aVal = a.balanceFormatted;
            bVal = b.balanceFormatted;
            break;
          case 'symbol':
            return filters.sortOrder === 'desc' 
              ? b.tokenSymbol.localeCompare(a.tokenSymbol)
              : a.tokenSymbol.localeCompare(b.tokenSymbol);
          default:
            aVal = a.valueUSD;
            bVal = b.valueUSD;
        }

        return filters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    return {
      ...portfolio,
      holdings: filteredHoldings,
      totalValueUSD: filteredHoldings.reduce((sum, h) => sum + h.valueUSD, 0)
    };
    } catch (error) {
      logger.error('Error applying filters to portfolio', { 
        userId: portfolio.userId,
        walletAddress: portfolio.walletAddress,
        filters,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error)
      });
      // Return original portfolio if filtering fails
      return portfolio;
    }
  }

  /**
   * Get portfolio from database
   */
  private async getPortfolioFromDB(userId: string, walletAddress: string, filters?: PortfolioFilters): Promise<Portfolio | null> {
    try {
      // Base query
      let query = `
        SELECT 
          id, user_id, wallet_address, chain_id, token_address, token_symbol, 
          token_name, token_decimals, balance, balance_formatted, price_usd, 
          value_usd, last_updated, alchemy_data
        FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      
      const params: any[] = [userId, walletAddress];
      
      // Apply filters - handle minValueUSD = 0 properly
      const minValue = filters?.minValue ?? filters?.minValueUSD ?? 0.001;
      query += ` AND value_usd >= $${params.length + 1}`;
      params.push(minValue as any);
      
      // Chain filter
      if (filters?.chainIds) {
        const chainIds = filters.chainIds.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        if (chainIds.length > 0) {
          query += ` AND chain_id = ANY($${params.length + 1})`;
          params.push(chainIds as any);
        }
      }
      
      // Spam filter (includeSpam defaults to false)
      if (!filters?.includeSpam) {
        // Since we don't have is_spam column, we'll filter by alchemy_data
        query += ` AND (alchemy_data->>'isSpam' IS NULL OR alchemy_data->>'isSpam' = 'false')`;
      }
      
      query += ` ORDER BY value_usd DESC`;
      
      logger.info('Portfolio DB query', { 
        userId, 
        walletAddress, 
        filters, 
        minValue,
        paramCount: params.length
      });
      
      const result = await this.db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      const holdings: TokenHolding[] = result.rows.map((row: any) => {
        // Parse alchemy_data to extract additional fields
        let alchemyData: any = {};
        try {
          alchemyData = row.alchemy_data ? 
            (typeof row.alchemy_data === 'object' ? row.alchemy_data : JSON.parse(row.alchemy_data)) : 
            {};
        } catch (e) {
          logger.warn('Failed to parse alchemy_data', { userId: row.user_id, tokenAddress: row.token_address });
          alchemyData = {};
        }

        return {
          id: row.id,
          userId: row.user_id,
          walletAddress: row.wallet_address,
          chainId: row.chain_id,
          tokenAddress: row.token_address,
          tokenSymbol: row.token_symbol,
          tokenName: row.token_name,
          tokenDecimals: row.token_decimals,
          balance: row.balance,
          balanceFormatted: parseFloat(row.balance_formatted),
          priceUSD: parseFloat(row.price_usd),
          valueUSD: parseFloat(row.value_usd),
          lastUpdated: new Date(row.last_updated),
          alchemyData: alchemyData,
          // Extract from alchemy_data if available
          logoUrl: alchemyData.logo || alchemyData.logoUrl,
          isSpam: alchemyData.isSpam === true,
          isVerified: alchemyData.isVerified === true
        };
      });

      return {
        id: `${userId}_${walletAddress}`,
        userId,
        walletAddress,
        chainId: 0, // Multi-chain portfolio
        totalValueUSD: holdings.reduce((sum, h) => sum + h.valueUSD, 0),
        holdings,
        lastSynced: holdings.length > 0 ? holdings[0].lastUpdated : new Date(),
        syncStatus: 'completed'
      };
    } catch (error) {
      logger.error('Error fetching portfolio from database', { 
        userId, 
        walletAddress, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        errorType: typeof error,
        queryInfo: {
          minValue: filters?.minValue ?? filters?.minValueUSD ?? 0.001,
          hasChainFilter: !!filters?.chainIds,
          includeSpam: filters?.includeSpam || false
        }
      });
      return null;
    }
  }
} 