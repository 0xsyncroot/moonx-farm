import { Portfolio, TokenHolding, PortfolioSyncRequest, PortfolioFilters, SyncOperation } from '../types';
import { AlchemyService } from './alchemyService';
import { CacheService } from './cacheService';
import { DatabaseService } from './databaseService';

export class PortfolioService {
  private alchemyService: AlchemyService;
  private cacheService: CacheService;
  private db: DatabaseService;

  constructor(databaseService: DatabaseService, cacheService: CacheService) {
    this.alchemyService = new AlchemyService();
    this.cacheService = cacheService;
    this.db = databaseService;
  }

  async syncPortfolio(userId: string, request: PortfolioSyncRequest): Promise<SyncOperation> {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create sync operation record
    const syncOperation: SyncOperation = {
      id: syncId,
      userId,
      walletAddress: request.walletAddress,
      type: 'portfolio_sync',
      status: 'pending',
      startedAt: new Date(),
      metadata: {
        chainsCount: request.chainIds?.length || this.alchemyService.getSupportedChains().length
      }
    };

    try {
      // Update sync status to running
      syncOperation.status = 'running';
      await this.saveSyncOperation(syncOperation);

      const chainsToSync = request.chainIds || this.alchemyService.getSupportedChains();
      
      // Check cache first (if not force refresh)
      if (!request.forceRefresh) {
        const cached = await this.getCachedPortfolio(userId, request.walletAddress);
        if (cached && this.isCacheValid(cached.lastSynced)) {
          syncOperation.status = 'completed';
          syncOperation.completedAt = new Date();
          await this.saveSyncOperation(syncOperation);
          return syncOperation;
        }
      }

      // Fetch fresh data from Alchemy
      const holdings = await this.alchemyService.getFullPortfolio(
        request.walletAddress, 
        chainsToSync
      );

      // Add userId to all holdings
      const holdingsWithUser = holdings.map(holding => ({
        ...holding,
        userId
      }));

      // Save to database
      await this.savePortfolioHoldings(userId, request.walletAddress, holdingsWithUser);

      // Update cache
      const portfolio: Portfolio = {
        id: `${userId}_${request.walletAddress}`,
        userId,
        walletAddress: request.walletAddress,
        chainId: 0, // Multi-chain portfolio
        totalValueUSD: holdingsWithUser.reduce((sum, h) => sum + h.valueUSD, 0),
        holdings: holdingsWithUser,
        lastSynced: new Date(),
        syncStatus: 'completed'
      };

      await this.cachePortfolio(portfolio);

      // Update sync operation
      syncOperation.status = 'completed';
      syncOperation.completedAt = new Date();
      syncOperation.metadata!.tokensCount = holdingsWithUser.length;
      await this.saveSyncOperation(syncOperation);

      return syncOperation;

    } catch (error) {
      console.error('Portfolio sync failed:', error);
      
      syncOperation.status = 'failed';
      syncOperation.completedAt = new Date();
      syncOperation.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveSyncOperation(syncOperation);
      
      throw error;
    }
  }

  async getPortfolio(userId: string, walletAddress: string, filters?: PortfolioFilters): Promise<Portfolio | null> {
    // Try cache first
    const cached = await this.getCachedPortfolio(userId, walletAddress);
    if (cached && this.isCacheValid(cached.lastSynced)) {
      return this.applyFilters(cached, filters);
    }

    // Try database
    const dbPortfolio = await this.getPortfolioFromDB(userId, walletAddress);
    if (dbPortfolio) {
      await this.cachePortfolio(dbPortfolio);
      return this.applyFilters(dbPortfolio, filters);
    }

    return null;
  }

  async getQuickPortfolio(userId: string, walletAddress: string): Promise<{
    totalValueUSD: number;
    topHoldings: TokenHolding[];
    lastSynced: Date | null;
  }> {
    const cacheKey = `quick_portfolio:${userId}:${walletAddress}`;
    
    // Try cache first with proper typing
    const cached = await this.cacheService.get<{
      totalValueUSD: number;
      topHoldings: TokenHolding[];
      lastSynced: Date | null;
    }>(cacheKey);
    if (cached && this.isValidQuickPortfolioData(cached)) {
      return cached;
    }

    // Get from full portfolio
    const portfolio = await this.getPortfolio(userId, walletAddress);
    if (!portfolio) {
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
    
    return quickData;
  }

  async forceRefreshPortfolio(userId: string, walletAddress: string): Promise<SyncOperation> {
    // Clear cache first
    await this.clearPortfolioCache(userId, walletAddress);
    
    // Force sync
    return this.syncPortfolio(userId, {
      walletAddress,
      forceRefresh: true
    });
  }

  private async getCachedPortfolio(userId: string, walletAddress: string): Promise<Portfolio | null> {
    const cacheKey = this.cacheService.getUserPortfolioKey(userId);
    return this.cacheService.get<Portfolio>(cacheKey);
  }

  private async cachePortfolio(portfolio: Portfolio): Promise<void> {
    const cacheKey = this.cacheService.getUserPortfolioKey(portfolio.userId);
    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, portfolio, 600);
  }

  private async clearPortfolioCache(userId: string, walletAddress: string): Promise<void> {
    const keys = [
      this.cacheService.getUserPortfolioKey(userId),
      `quick_portfolio:${userId}:${walletAddress}`
    ];
    
    for (const key of keys) {
      await this.cacheService.del(key);
    }
  }

  private isCacheValid(lastSynced: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSynced.getTime()) / (1000 * 60);
    return diffMinutes < 5; // Cache valid for 5 minutes
  }

  private isValidQuickPortfolioData(data: any): data is { totalValueUSD: number; topHoldings: TokenHolding[]; lastSynced: Date | null } {
    return data && 
           typeof data.totalValueUSD === 'number' && 
           Array.isArray(data.topHoldings) && 
           (data.lastSynced === null || data.lastSynced instanceof Date);
  }

  private applyFilters(portfolio: Portfolio, filters?: PortfolioFilters): Portfolio {
    if (!filters) return portfolio;

    let filteredHoldings = [...portfolio.holdings];

    // Filter by chain IDs
    if (filters.chainIds && filters.chainIds.length > 0) {
      filteredHoldings = filteredHoldings.filter(h => 
        filters.chainIds!.includes(h.chainId)
      );
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

    // Sort
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
  }

  private async getPortfolioFromDB(userId: string, walletAddress: string): Promise<Portfolio | null> {
    try {
      const query = `
        SELECT * FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2 
        ORDER BY value_usd DESC
      `;
      
      const result = await this.db.query(query, [userId, walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const holdings: TokenHolding[] = result.rows.map((row: any) => ({
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
        alchemyData: row.alchemy_data ? JSON.parse(row.alchemy_data) : undefined
      }));

      return {
        id: `${userId}_${walletAddress}`,
        userId,
        walletAddress,
        chainId: 0,
        totalValueUSD: holdings.reduce((sum, h) => sum + h.valueUSD, 0),
        holdings,
        lastSynced: holdings.length > 0 && holdings[0] ? holdings[0].lastUpdated : new Date(),
        syncStatus: 'completed'
      };
    } catch (error) {
      console.error('Error fetching portfolio from DB:', error);
      return null;
    }
  }

  private async savePortfolioHoldings(userId: string, walletAddress: string, holdings: TokenHolding[]): Promise<void> {
    try {
      await this.db.transaction(async (db) => {
        // Delete existing holdings for this wallet
        await db.query(
          'DELETE FROM user_token_holdings WHERE user_id = $1 AND wallet_address = $2',
          [userId, walletAddress]
        );

        // Insert new holdings
        if (holdings.length > 0) {
          const insertQuery = `
            INSERT INTO user_token_holdings (
              id, user_id, wallet_address, chain_id, token_address, token_symbol, 
              token_name, token_decimals, balance, balance_formatted, price_usd, 
              value_usd, last_updated, alchemy_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `;

          for (const holding of holdings) {
            await db.query(insertQuery, [
              holding.id,
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
              holding.lastUpdated,
              holding.alchemyData ? JSON.stringify(holding.alchemyData) : null
            ]);
          }
        }
      });
    } catch (error) {
      console.error('Error saving portfolio holdings:', error);
      throw error;
    }
  }

  private async saveSyncOperation(syncOp: SyncOperation): Promise<void> {
    try {
      const query = `
        INSERT INTO sync_operations (
          id, user_id, wallet_address, type, status, started_at, 
          completed_at, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          status = $5, completed_at = $7, error = $8, metadata = $9
      `;

      await this.db.query(query, [
        syncOp.id,
        syncOp.userId,
        syncOp.walletAddress,
        syncOp.type,
        syncOp.status,
        syncOp.startedAt,
        syncOp.completedAt,
        syncOp.error,
        syncOp.metadata ? JSON.stringify(syncOp.metadata) : null
      ]);
    } catch (error) {
      console.error('Error saving sync operation:', error);
    }
  }
} 