import { PnLSummary, RealTrade, PnLRequest, TokenPrice } from '../types';
import { DatabaseService } from './databaseService';
import { CacheService } from './cacheService';

export class PnLService {
  private db: DatabaseService;
  private cacheService: CacheService;

  constructor(databaseService: DatabaseService, cacheService: CacheService) {
    this.db = databaseService;
    this.cacheService = cacheService;
  }

  async calculatePnL(userId: string, request: PnLRequest): Promise<PnLSummary> {
    try {
      const cacheKey = `pnl:${userId}:${request.timeframe}${request.walletAddress ? `:${request.walletAddress}` : ''}`;
      
      // Try cache first with error handling
      let cached: PnLSummary | null = null;
      try {
        cached = await this.cacheService.get<PnLSummary>(cacheKey);
        if (cached && this.isCacheValid(cached.lastCalculated, request.timeframe)) {
          console.log(`✅ P&L cache hit for user ${userId}, timeframe ${request.timeframe}`);
          return cached;
        }
      } catch (cacheError) {
        console.warn(`⚠️ Cache error for key ${cacheKey}, proceeding with fresh calculation:`, cacheError);
        // Clear the problematic cache key
        await this.cacheService.del(cacheKey);
      }

      console.log(`🔄 Calculating fresh P&L for user ${userId}, timeframe ${request.timeframe}`);

      // Calculate fresh P&L
      const trades = await this.getTradesForTimeframe(userId, request.timeframe, request.walletAddress);
      const currentPortfolioValue = await this.getCurrentPortfolioValue(userId, request.walletAddress);
      
      const pnlSummary = await this.calculatePnLFromTrades(userId, trades, currentPortfolioValue, request.timeframe);
      
      // Cache result with appropriate TTL and error handling
      try {
        const cacheTTL = this.getCacheTTL(request.timeframe);
        await this.cacheService.set(cacheKey, pnlSummary, cacheTTL);
        console.log(`💾 P&L result cached for user ${userId} with TTL ${cacheTTL}s`);
      } catch (setCacheError) {
        console.warn(`⚠️ Failed to cache P&L result for user ${userId}:`, setCacheError);
        // Don't throw - cache failure shouldn't break the API
      }
      
      console.log(`✅ P&L calculated and cached for user ${userId}: ${pnlSummary.netPnlUSD} USD`);
      return pnlSummary;
    } catch (error) {
      console.error(`❌ Error calculating P&L for user ${userId}:`, error);
      throw new Error(`Failed to calculate P&L: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTradesForTimeframe(userId: string, timeframe: string, walletAddress?: string): Promise<RealTrade[]> {
    try {
      const { startDate, endDate } = this.getDateRange(timeframe);
      
      let query = `
        SELECT * FROM user_trades 
        WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
      `;
      const params: any[] = [userId, startDate, endDate];

      if (walletAddress) {
        query += ' AND wallet_address = $4';
        params.push(walletAddress);
      }

      query += ' ORDER BY timestamp DESC';

      const result = await this.db.query(query, params);
      const trades = result.rows.map((row: any) => this.mapRowToRealTrade(row));
      
      console.log(`📊 Found ${trades.length} trades for user ${userId} in timeframe ${timeframe}`);
      return trades;
    } catch (error) {
      console.error('❌ Error fetching trades for P&L:', error);
      return [];
    }
  }

  private async getCurrentPortfolioValue(userId: string, walletAddress?: string): Promise<number> {
    try {
      let query = `
        SELECT SUM(value_usd) as total_value 
        FROM user_token_holdings 
        WHERE user_id = $1 AND value_usd > 0.01
      `;
      const params: any[] = [userId];

      if (walletAddress) {
        query += ' AND wallet_address = $2';
        params.push(walletAddress);
      }

      const result = await this.db.query(query, params);
      const portfolioValue = parseFloat(result.rows[0]?.total_value || '0');
      
      console.log(`💰 Current portfolio value for user ${userId}: $${portfolioValue.toFixed(2)}`);
      return portfolioValue;
    } catch (error) {
      console.error('❌ Error fetching current portfolio value:', error);
      return 0;
    }
  }

  private async calculatePnLFromTrades(
    userId: string, 
    trades: RealTrade[], 
    currentPortfolioValue: number,
    timeframe: string
  ): Promise<PnLSummary> {
    let totalVolumeUSD = 0;
    let totalFeesUSD = 0;
    let realizedPnlUSD = 0;
    let winCount = 0;
    let lossCount = 0;
    let biggestWinUSD = 0;
    let biggestLossUSD = 0;

    // Calculate metrics from completed trades only
    const completedTrades = trades.filter(trade => trade.status === 'completed');

    for (const trade of completedTrades) {
      // Safely handle numeric values
      const fromValueUSD = Number(trade.fromToken?.valueUSD) || 0;
      const toValueUSD = Number(trade.toToken?.valueUSD) || 0;
      const gasFeeUSD = Number(trade.gasFeeUSD) || 0;
      const protocolFeeUSD = Number(trade.protocolFeeUSD) || 0;

      totalVolumeUSD += fromValueUSD;
      totalFeesUSD += gasFeeUSD + protocolFeeUSD;

      // Calculate trade P&L: received value - sent value
      const tradePnl = toValueUSD - fromValueUSD;
      const tradePnlAfterFees = tradePnl - gasFeeUSD - protocolFeeUSD;
      
      realizedPnlUSD += tradePnl;

      if (tradePnlAfterFees > 0) {
        winCount++;
        biggestWinUSD = Math.max(biggestWinUSD, tradePnlAfterFees);
      } else if (tradePnlAfterFees < 0) {
        lossCount++;
        biggestLossUSD = Math.min(biggestLossUSD, tradePnlAfterFees);
      }
    }

    // Calculate unrealized P&L from current holdings
    const unrealizedPnlUSD = await this.calculateUnrealizedPnL(userId, completedTrades);
    
    // Calculate portfolio change for timeframe
    const portfolioChangeData = await this.getPortfolioChange(userId, timeframe, currentPortfolioValue);

    const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : 0;
    const avgTradeSize = completedTrades.length > 0 ? totalVolumeUSD / completedTrades.length : 0;
    const netPnlUSD = realizedPnlUSD + unrealizedPnlUSD - totalFeesUSD;

    return {
      userId,
      timeframe: timeframe as any,
      totalTrades: completedTrades.length,
      totalVolumeUSD,
      totalFeesUSD,
      realizedPnlUSD,
      unrealizedPnlUSD,
      netPnlUSD,
      winRate,
      avgTradeSize,
      biggestWinUSD,
      biggestLossUSD: Math.abs(biggestLossUSD),
      currentPortfolioValueUSD: currentPortfolioValue,
      portfolioChangeUSD: portfolioChangeData.changeUSD,
      portfolioChangePercent: portfolioChangeData.changePercent,
      lastCalculated: new Date()
    };
  }

  private async calculateUnrealizedPnL(userId: string, trades: RealTrade[]): Promise<number> {
    try {
      // Track cost basis for tokens we currently hold
      const tokenCostBasis = new Map<string, { totalCost: number; totalAmount: number }>();

      // Calculate cost basis from trades
      for (const trade of trades) {
        const tokenKey = `${trade.chainId}:${trade.toToken.address.toLowerCase()}`;
        const current = tokenCostBasis.get(tokenKey) || { totalCost: 0, totalAmount: 0 };
        
        tokenCostBasis.set(tokenKey, {
          totalCost: current.totalCost + trade.fromToken.valueUSD + trade.gasFeeUSD + (trade.protocolFeeUSD || 0),
          totalAmount: current.totalAmount + trade.toToken.amountFormatted
        });
      }

      // Get current holdings and calculate unrealized P&L
      let unrealizedPnL = 0;
      const holdingsQuery = `
        SELECT token_address, chain_id, balance_formatted, value_usd
        FROM user_token_holdings 
        WHERE user_id = $1 AND value_usd > 0.01
      `;
      
      const holdingsResult = await this.db.query(holdingsQuery, [userId]);
      
      for (const holding of holdingsResult.rows) {
        const tokenKey = `${holding.chain_id}:${holding.token_address.toLowerCase()}`;
        const costBasis = tokenCostBasis.get(tokenKey);
        
        if (costBasis && costBasis.totalAmount > 0) {
          const avgCost = costBasis.totalCost / costBasis.totalAmount;
          const currentValue = Number(holding.value_usd) || 0;
          const holdingAmount = Number(holding.balance_formatted) || 0;
          
          // Calculate unrealized P&L for this position
          if (holdingAmount > 0 && isFinite(avgCost) && isFinite(currentValue)) {
            const currentPricePerToken = currentValue / holdingAmount;
            const unrealizedForToken = (currentPricePerToken - avgCost) * holdingAmount;
            if (isFinite(unrealizedForToken)) {
              unrealizedPnL += unrealizedForToken;
            }
          }
        }
      }

      return unrealizedPnL;
    } catch (error) {
      console.error('❌ Error calculating unrealized P&L:', error);
      return 0;
    }
  }

  private async getPortfolioChange(userId: string, timeframe: string, currentValue: number): Promise<{
    changeUSD: number;
    changePercent: number;
  }> {
    try {
      const { startDate } = this.getDateRange(timeframe);
      
      // Try to get historical portfolio value
      const historyQuery = `
        SELECT total_value
        FROM (
          SELECT SUM(value_usd) as total_value, created_at
          FROM user_token_holdings_history 
          WHERE user_id = $1 AND created_at <= $2
          GROUP BY created_at
          ORDER BY created_at DESC
          LIMIT 1
        ) as latest_portfolio
      `;
      
      const result = await this.db.query(historyQuery, [userId, startDate]);
      const historicalValue = parseFloat(result.rows[0]?.total_value || '0');
      
      if (historicalValue > 0) {
        const changeUSD = currentValue - historicalValue;
        const changePercent = (changeUSD / historicalValue) * 100;
        
        return { changeUSD, changePercent };
      }
      
      // Fallback: estimate from trades if no historical data
      const tradesValue = await this.estimatePortfolioChangeFromTrades(userId, timeframe);
      return tradesValue;
      
    } catch (error) {
      console.error('❌ Error calculating portfolio change:', error);
      return { changeUSD: 0, changePercent: 0 };
    }
  }

  private async estimatePortfolioChangeFromTrades(userId: string, timeframe: string): Promise<{
    changeUSD: number;
    changePercent: number;
  }> {
    try {
      const { startDate } = this.getDateRange(timeframe);
      
      // Sum up all investments (money in) during timeframe
      const investmentsQuery = `
        SELECT SUM((from_token->>'valueUSD')::numeric) as total_invested
        FROM user_trades 
        WHERE user_id = $1 AND timestamp >= $2 AND status = 'completed'
      `;
      
      const result = await this.db.query(investmentsQuery, [userId, startDate]);
      const totalInvested = parseFloat(result.rows[0]?.total_invested || '0');
      
      if (totalInvested > 0) {
        const currentValue = await this.getCurrentPortfolioValue(userId);
        const changeUSD = currentValue - totalInvested;
        const changePercent = (changeUSD / totalInvested) * 100;
        
        return { changeUSD, changePercent };
      }
      
      return { changeUSD: 0, changePercent: 0 };
    } catch (error) {
      console.error('❌ Error estimating portfolio change from trades:', error);
      return { changeUSD: 0, changePercent: 0 };
    }
  }

  private getDateRange(timeframe: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020); // Start from 2020
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  private isCacheValid(lastCalculated: Date, timeframe: string): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastCalculated.getTime()) / (1000 * 60);
    
    // Different cache validity based on timeframe
    switch (timeframe) {
      case '24h':
        return diffMinutes < 5; // 5 minutes for 24h
      case '7d':
        return diffMinutes < 15; // 15 minutes for 7d
      case '30d':
      case '90d':
        return diffMinutes < 60; // 1 hour for longer periods
      case '1y':
      case 'all':
        return diffMinutes < 240; // 4 hours for very long periods
      default:
        return diffMinutes < 15;
    }
  }

  private getCacheTTL(timeframe: string): number {
    switch (timeframe) {
      case '24h':
        return 300; // 5 minutes
      case '7d':
        return 900; // 15 minutes
      case '30d':
      case '90d':
        return 3600; // 1 hour
      case '1y':
      case 'all':
        return 14400; // 4 hours
      default:
        return 900; // 15 minutes
    }
  }

  private mapRowToRealTrade(row: any): RealTrade {
    const trade: RealTrade = {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      txHash: row.tx_hash,
      chainId: row.chain_id,
      blockNumber: row.block_number,
      timestamp: new Date(row.timestamp),
      type: row.type,
      status: row.status,
      fromToken: JSON.parse(row.from_token || '{}'),
      toToken: JSON.parse(row.to_token || '{}'),
      gasFeeETH: parseFloat(row.gas_fee_eth || '0'),
      gasFeeUSD: parseFloat(row.gas_fee_usd || '0'),
      pnl: row.pnl ? JSON.parse(row.pnl) : undefined
    };

    // Handle optional properties
    if (row.protocol_fee_usd !== null && row.protocol_fee_usd !== undefined) {
      trade.protocolFeeUSD = parseFloat(row.protocol_fee_usd);
    }
    
    if (row.slippage !== null && row.slippage !== undefined) {
      trade.slippage = parseFloat(row.slippage);
    }
    
    if (row.price_impact !== null && row.price_impact !== undefined) {
      trade.priceImpact = parseFloat(row.price_impact);
    }
    
    if (row.dex_name) {
      trade.dexName = row.dex_name;
    }
    
    if (row.router_address) {
      trade.routerAddress = row.router_address;
    }
    
    if (row.aggregator) {
      trade.aggregator = row.aggregator;
    }

    return trade;
  }

  async updateTradePnL(tradeId: string, userId: string): Promise<void> {
    try {
      console.log(`🔄 Updating P&L for trade ${tradeId}`);
      
      const trade = await this.getTradeById(tradeId, userId);
      if (!trade) {
        console.warn(`Trade ${tradeId} not found for user ${userId}`);
        return;
      }

      // Calculate current P&L based on current market prices
      const updatedPnL = await this.calculateTradePnL(trade);
      
      // Update in database
      await this.db.query(
        'UPDATE user_trades SET pnl = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [JSON.stringify(updatedPnL), tradeId, userId]
      );

      // Invalidate related caches
      await this.invalidatePnLCache(userId);
      
      console.log(`✅ Updated P&L for trade ${tradeId}: ${updatedPnL.netPnlUSD} USD`);
    } catch (error) {
      console.error(`❌ Error updating trade P&L for ${tradeId}:`, error);
      throw error;
    }
  }

  private async getTradeById(tradeId: string, userId: string): Promise<RealTrade | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_trades WHERE id = $1 AND user_id = $2',
        [tradeId, userId]
      );
      
      if (result.rows.length === 0) return null;
      return this.mapRowToRealTrade(result.rows[0]);
    } catch (error) {
      console.error('❌ Error fetching trade by ID:', error);
      return null;
    }
  }

  private async calculateTradePnL(trade: RealTrade): Promise<any> {
    try {
      // Get current price for the received token
      const currentPrice = await this.getCurrentTokenPrice(trade.toToken.address, trade.chainId);
      const currentValue = trade.toToken.amountFormatted * (currentPrice || trade.toToken.priceUSD);
      
      const realizedPnlUSD = trade.toToken.valueUSD - trade.fromToken.valueUSD;
      const unrealizedPnlUSD = currentValue - trade.toToken.valueUSD;
      const feesPaidUSD = trade.gasFeeUSD + (trade.protocolFeeUSD || 0);
      const netPnlUSD = realizedPnlUSD + unrealizedPnlUSD - feesPaidUSD;
      
      return {
        realizedPnlUSD,
        unrealizedPnlUSD,
        feesPaidUSD,
        netPnlUSD
      };
    } catch (error) {
      console.error('❌ Error calculating trade P&L:', error);
      // Fallback to basic calculation
      const realizedPnlUSD = trade.toToken.valueUSD - trade.fromToken.valueUSD;
      const feesPaidUSD = trade.gasFeeUSD + (trade.protocolFeeUSD || 0);
      
      return {
        realizedPnlUSD,
        unrealizedPnlUSD: 0,
        feesPaidUSD,
        netPnlUSD: realizedPnlUSD - feesPaidUSD
      };
    }
  }

  private async getCurrentTokenPrice(tokenAddress: string, chainId: number): Promise<number | null> {
    try {
      // Try to get current price from token holdings first
      const priceQuery = `
        SELECT price_usd FROM user_token_holdings 
        WHERE token_address = $1 AND chain_id = $2 
        ORDER BY last_updated DESC 
        LIMIT 1
      `;
      
      const result = await this.db.query(priceQuery, [tokenAddress.toLowerCase(), chainId]);
      
      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].price_usd);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting current token price:', error);
      return null;
    }
  }

  private async invalidatePnLCache(userId: string): Promise<void> {
    try {
      const timeframes = ['24h', '7d', '30d', '90d', '1y', 'all'];
      
      const invalidationPromises = timeframes.map(async (timeframe) => {
        // Invalidate both with and without wallet address
        await Promise.all([
          this.cacheService.del(`pnl:${userId}:${timeframe}`),
          this.cacheService.del(`pnl:${userId}:${timeframe}:*`) // Pattern deletion for wallet-specific caches
        ]);
      });
      
      await Promise.all(invalidationPromises);
      console.log(`✅ Invalidated P&L cache for user ${userId}`);
    } catch (error) {
      console.error('❌ Error invalidating P&L cache:', error);
    }
  }

  async getDetailedPnLBreakdown(userId: string, timeframe: string, walletAddress?: string): Promise<{
    summary: PnLSummary;
    tokenBreakdown: Array<{
      token: string;
      symbol: string;
      chainId: number;
      realizedPnl: number;
      unrealizedPnl: number;
      totalVolume: number;
      tradeCount: number;
    }>;
    dailyPnL: Array<{
      date: string;
      pnl: number;
      volume: number;
      trades: number;
    }>;
  }> {
    try {
      console.log(`📊 Generating detailed P&L breakdown for user ${userId}`);
      
      const pnlRequest: PnLRequest = { timeframe: timeframe as any };
      if (walletAddress) {
        pnlRequest.walletAddress = walletAddress;
      }
      
      const summary = await this.calculatePnL(userId, pnlRequest);
      const trades = await this.getTradesForTimeframe(userId, timeframe, walletAddress);
      
      // Calculate token breakdown
      const tokenMap = new Map<string, any>();
      
      for (const trade of trades.filter(t => t.status === 'completed')) {
        const tokenKey = `${trade.toToken.address}:${trade.chainId}`;
        const existing = tokenMap.get(tokenKey) || {
          token: trade.toToken.address,
          symbol: trade.toToken.symbol,
          chainId: trade.chainId,
          realizedPnl: 0,
          unrealizedPnl: 0,
          totalVolume: 0,
          tradeCount: 0
        };
        
        existing.realizedPnl += trade.toToken.valueUSD - trade.fromToken.valueUSD;
        existing.totalVolume += trade.fromToken.valueUSD;
        existing.tradeCount += 1;
        
        tokenMap.set(tokenKey, existing);
      }
      
      // Calculate daily P&L
      const dailyMap = new Map<string, any>();
      
      for (const trade of trades.filter(t => t.status === 'completed')) {
        const dateKey = trade.timestamp.toISOString().split('T')[0]!;
        
        const existing = dailyMap.get(dateKey) || {
          date: dateKey,
          pnl: 0,
          volume: 0,
          trades: 0
        };
        
        existing.pnl += trade.toToken.valueUSD - trade.fromToken.valueUSD;
        existing.volume += trade.fromToken.valueUSD;
        existing.trades += 1;
        
        dailyMap.set(dateKey, existing);
      }
      
      return {
        summary,
        tokenBreakdown: Array.from(tokenMap.values()),
        dailyPnL: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      };
    } catch (error) {
      console.error('❌ Error generating detailed P&L breakdown:', error);
      throw new Error(`Failed to generate detailed P&L breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 