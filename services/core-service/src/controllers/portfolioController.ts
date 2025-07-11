import { FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioService } from '../services/portfolioService';
import { PnLService } from '../services/pnlService';
import { TradesService } from '../services/tradesService';
import { SyncProxyService } from '../services/syncProxyService';
import { CacheService } from '../services/cacheService';
import { AuthenticatedRequest, AuthMiddleware } from '../middleware/authMiddleware';
import { PortfolioSyncRequest, PortfolioFilters, PnLRequest } from '../types';
import { ApiResponse } from '../types';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { Portfolio } from '../types';

const logger = createLoggerForAnyService('core-service');

// Helper functions for standardized API responses
function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

function createErrorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };
}

export class PortfolioController {
  constructor(
    private portfolioService: PortfolioService,
    private pnlService: PnLService,
    private tradesService: TradesService,
    private authMiddleware: AuthMiddleware,
    private syncProxyService: SyncProxyService,
    private cacheService: CacheService
  ) {}

  // GET /portfolio - Get user portfolio (simplified)
  async getPortfolio(request: FastifyRequest<{ Querystring: PortfolioFilters }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      logger.info('Portfolio API called', { 
        userId, 
        walletAddress, 
        aaWalletAddress, 
        targetWalletAddress,
        query: request.query 
      });
      
      // Get portfolio data (cache + database)
      const portfolio = await this.portfolioService.getPortfolio(userId, targetWalletAddress, request.query);
      
      logger.info('Portfolio query result', { 
        userId, 
        targetWalletAddress, 
        hasPortfolio: !!portfolio,
        holdingsCount: portfolio?.holdings?.length || 0,
        lastSynced: portfolio?.lastSynced
      });
      
      // Check if we need to trigger background sync
      const shouldSync = await this.shouldTriggerBackgroundSync(userId, targetWalletAddress, portfolio);
      
      if (shouldSync) {
        logger.info('Triggering background sync', { userId, targetWalletAddress, reason: shouldSync.reason });
        
        // Trigger sync in background (don't wait for it)
        this.triggerBackgroundSync(userId, targetWalletAddress, shouldSync.priority, shouldSync.reason)
          .catch((error: any) => logger.error('Background sync failed', { error }));
      }

      // Return portfolio data or indicate sync in progress
      if (!portfolio) {
        return reply.code(202).send(createSuccessResponse(
          null,
          'Portfolio data not found, sync triggered'
        ));
      }

      // Fix response structure for frontend compatibility
      return reply.send(createSuccessResponse({
        portfolio,
        holdings: portfolio.holdings, // Add holdings at root level for backward compatibility
        totalValueUSD: portfolio.totalValueUSD,
        lastSynced: portfolio.lastSynced
      }, `Portfolio retrieved with ${portfolio.holdings?.length || 0} holdings`));
    } catch (error) {
      logger.error('Get portfolio error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get portfolio'));
    }
  }

  // GET /portfolio/holdings - Get token holdings only
  async getTokenHoldings(request: FastifyRequest<{ Querystring: PortfolioFilters }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      logger.info('Token holdings API called', { 
        userId, 
        walletAddress, 
        aaWalletAddress, 
        targetWalletAddress,
        query: request.query 
      });

      // Validate input
      if (!userId || !targetWalletAddress) {
        logger.warn('Invalid request parameters', { userId, targetWalletAddress });
        return reply.code(400).send(createErrorResponse('Invalid user ID or wallet address'));
      }
      
      // Get portfolio data to extract holdings
      const portfolio = await this.portfolioService.getPortfolio(userId, targetWalletAddress, request.query);
      
      logger.info('Portfolio service result', { 
        userId, 
        targetWalletAddress, 
        hasPortfolio: !!portfolio,
        holdingsCount: portfolio?.holdings?.length || 0,
        totalValueUSD: portfolio?.totalValueUSD || 0,
        lastSynced: portfolio?.lastSynced
      });
      
      if (!portfolio) {
        // Check if we need to trigger background sync
        const shouldSync = await this.shouldTriggerBackgroundSync(userId, targetWalletAddress, null);
        
        if (shouldSync) {
          logger.info('Triggering background sync for holdings', { userId, targetWalletAddress, reason: shouldSync.reason });
          
          // Trigger sync in background (don't wait for it)
          this.triggerBackgroundSync(userId, targetWalletAddress, shouldSync.priority, shouldSync.reason)
            .catch((error: any) => logger.error('Background sync failed', { error }));
        }

        return reply.code(202).send(createSuccessResponse(
          [],
          'No holdings data found, sync triggered'
        ));
      }

      // Validate portfolio data
      if (!portfolio.holdings || !Array.isArray(portfolio.holdings)) {
        logger.warn('Invalid portfolio holdings data', { 
          userId, 
          targetWalletAddress, 
          holdingsType: typeof portfolio.holdings,
          holdingsData: portfolio.holdings
        });
        return reply.code(500).send(createErrorResponse('Invalid portfolio data structure'));
      }

      // Calculate allocation percentages
      const totalValue = portfolio.totalValueUSD;
      const holdingsWithAllocation = portfolio.holdings.map(holding => ({
        ...holding,
        allocation: totalValue > 0 ? (holding.valueUSD / totalValue) * 100 : 0
      }));

      logger.info('Token holdings retrieved successfully', { 
        userId, 
        targetWalletAddress, 
        holdingsCount: holdingsWithAllocation.length,
        totalValueUSD: totalValue,
        sampleHolding: holdingsWithAllocation[0] || null
      });

      return reply.send(createSuccessResponse(
        holdingsWithAllocation,
        `Retrieved ${holdingsWithAllocation.length} token holdings`
      ));
    } catch (error) {
      logger.error('Get token holdings error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest),
        targetWalletAddress: this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest) || 
                             this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest)
      });
      return reply.code(500).send(createErrorResponse('Failed to get token holdings'));
    }
  }

  // GET /portfolio/quick - Get quick portfolio overview
  async getQuickPortfolio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      // Get quick data from service
      const quickData = await this.portfolioService.getQuickPortfolio(userId, targetWalletAddress);
      
      return reply.send(createSuccessResponse({
        ...quickData,
        status: quickData.totalValueUSD > 0 ? 'ready' : 'no_data',
        note: quickData.totalValueUSD === 0 ? 'No portfolio data. Use /sync/trigger to sync.' : undefined
      }, `Quick portfolio overview: $${quickData.totalValueUSD.toFixed(2)}`));
    } catch (error) {
      logger.error('Get quick portfolio error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get quick portfolio'));
    }
  }

  // POST /portfolio/refresh - Delegate to sync service
  async refreshPortfolio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);

      const targetWalletAddress = aaWalletAddress || walletAddress;
      logger.info('Refreshing portfolio', { userId, walletAddress, aaWalletAddress, targetWalletAddress });
      
      // Delegate to sync proxy service with forceRefresh=true to bypass rate limiting
      const syncResult = await this.syncProxyService.triggerUserSync(
        userId, 
        targetWalletAddress, 
        'high',
        {
          source: 'manual_refresh',
          forceRefresh: true, // Force refresh bypasses rate limiting and circuit breaker
          metadata: { triggeredBy: 'portfolio_refresh_api' }
        }
      );

      if (syncResult.success) {
        return reply.send(createSuccessResponse({
          syncOperationId: syncResult.syncOperationId,
          message: 'Portfolio refresh triggered successfully (force refresh enabled)'
        }, 'Portfolio refresh triggered'));
      } else {
        return reply.code(429).send(createErrorResponse(syncResult.message));
      }
    } catch (error) {
      logger.error('Portfolio refresh error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to refresh portfolio'));
    }
  }

  // GET /portfolio/pnl - Get portfolio P&L analysis
  async getPnL(request: FastifyRequest<{ Querystring: PnLRequest }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      const pnlData = await this.pnlService.calculatePnL(userId, {
        timeframe: request.query.timeframe || '24h',
        walletAddress: request.query.walletAddress || targetWalletAddress
      });

      return reply.send(createSuccessResponse(pnlData, 
        `P&L calculated for ${request.query.timeframe || '24h'} timeframe`));
    } catch (error) {
      logger.error('P&L calculation error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to calculate P&L'));
    }
  }

  // GET /portfolio/analytics - Get detailed analytics
  async getAnalytics(request: FastifyRequest<{ 
    Querystring: { 
      timeframe?: string; 
      breakdown?: 'chain' | 'token' | 'dex' 
    } 
  }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      const { timeframe = '30d', breakdown = 'token' } = request.query;
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      // Get P&L data
      const pnlSummary = await this.pnlService.calculatePnL(userId, { 
        timeframe: timeframe as any,
        walletAddress: targetWalletAddress 
      });

      // Get portfolio data
      const portfolio = await this.portfolioService.getPortfolio(userId, targetWalletAddress);
      
      // Generate analytics based on breakdown type
      let analyticsData: any = {};
      
      if (breakdown === 'chain' && portfolio) {
        // Group by chain
        const chainBreakdown = portfolio.holdings.reduce((acc, holding) => {
          const chainId = holding.chainId;
          if (!acc[chainId]) {
            acc[chainId] = {
              chainId,
              totalValueUSD: 0,
              tokensCount: 0,
              topTokens: []
            };
          }
          acc[chainId].totalValueUSD += holding.valueUSD;
          acc[chainId].tokensCount += 1;
          acc[chainId].topTokens.push({
            symbol: holding.tokenSymbol,
            valueUSD: holding.valueUSD,
            percentage: 0 // Will calculate after
          });
          return acc;
        }, {} as any);

        // Calculate percentages
        Object.values(chainBreakdown).forEach((chain: any) => {
          chain.topTokens = chain.topTokens
            .sort((a: any, b: any) => b.valueUSD - a.valueUSD)
            .slice(0, 3)
            .map((token: any) => ({
              ...token,
              percentage: (token.valueUSD / chain.totalValueUSD) * 100
            }));
        });

        analyticsData.chainBreakdown = Object.values(chainBreakdown);
      }

      if (breakdown === 'token' && portfolio) {
        // Top tokens breakdown
        analyticsData.topTokens = portfolio.holdings
          .slice(0, 10)
          .map(holding => ({
            symbol: holding.tokenSymbol,
            name: holding.tokenName,
            valueUSD: holding.valueUSD,
            percentage: (holding.valueUSD / portfolio.totalValueUSD) * 100,
            chainId: holding.chainId,
            balance: holding.balanceFormatted,
            priceUSD: holding.priceUSD
          }));
      }

      return reply.send(createSuccessResponse({
        pnl: pnlSummary,
        analytics: analyticsData,
        summary: {
          totalPortfolioValue: portfolio?.totalValueUSD || 0,
          totalTokens: portfolio?.holdings.length || 0,
          lastUpdated: portfolio?.lastSynced || null
        }
      }, `Analytics generated with ${breakdown} breakdown`));
    } catch (error) {
      logger.error('Get analytics error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get analytics'));
    }
  }

  // GET /portfolio/history - Get portfolio value history
  async getPortfolioHistory(request: FastifyRequest<{ 
    Querystring: { 
      timeframe?: string;
      interval?: 'hour' | 'day' | 'week'
    } 
  }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const { timeframe = '30d', interval = 'day' } = request.query;
      
      // TODO: Implement historical portfolio data retrieval
      // This would fetch from portfolio_snapshots table or similar
      const historyData = {
        timeframe,
        interval,
        data: []
      };
      
      return reply.send(createSuccessResponse({ history: historyData }, 
        'Portfolio history feature will be available soon'));
    } catch (error) {
      logger.error('Get portfolio history error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get portfolio history'));
    }
  }

  // GET /portfolio/trades - Get recent trades
  async getRecentTrades(request: FastifyRequest<{ 
    Querystring: { 
      limit?: number;
      chainIds?: string;
      days?: number;
    } 
  }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      
      // Build filters object conditionally to avoid undefined values with exactOptionalPropertyTypes
      const filters: { limit: number; days: number; chainIds?: number[] } = {
        limit: request.query.limit || 20,
        days: request.query.days || 30
      };

      // Only add chainIds if it exists and is valid
      if (request.query.chainIds) {
        const chainIds = request.query.chainIds
          .split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id));
        
        if (chainIds.length > 0) {
          filters.chainIds = chainIds;
        }
      }
      
      const trades = await this.tradesService.getRecentTrades(userId, filters);
      
      return reply.send(createSuccessResponse({ 
        trades,
        count: trades.length,
        filters: {
          limit: filters.limit,
          days: filters.days,
          chainIds: filters.chainIds
        }
      }, `Retrieved ${trades.length} recent trades`));
    } catch (error) {
      logger.error('Get recent trades error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get recent trades'));
    }
  }

  // POST /portfolio/trades - Add new trade after successful swap
  async addTrade(request: FastifyRequest<{
    Body: {
      txHash: string;
      chainId: number;
      blockNumber?: number;
      timestamp?: string;
      type?: 'swap' | 'buy' | 'sell';
      status?: 'pending' | 'completed' | 'failed';
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
    }
  }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      // Validate required fields
      const { txHash, chainId, fromToken, toToken, gasFeeUSD } = request.body;
      
      if (!txHash || !chainId || !fromToken || !toToken || gasFeeUSD === undefined) {
        return reply.code(400).send(createErrorResponse('Missing required fields: txHash, chainId, fromToken, toToken, gasFeeUSD'));
      }

      // Validate token data
      if (!fromToken.address || !fromToken.symbol || !toToken.address || !toToken.symbol) {
        return reply.code(400).send(createErrorResponse('Invalid token data: address and symbol are required'));
      }

      // Check if trade already exists
      const existingTrade = await this.tradesService.getTradeByTxHash(txHash, userId);
      if (existingTrade) {
        return reply.code(409).send(createErrorResponse(`Trade with transaction hash ${txHash} already exists`));
      }

      // Prepare trade data
      const tradeData = {
        userId,
        walletAddress: targetWalletAddress,
        txHash,
        chainId,
        blockNumber: request.body.blockNumber,
        timestamp: request.body.timestamp ? new Date(request.body.timestamp) : new Date(),
        type: request.body.type || 'swap' as const,
        status: request.body.status || 'completed' as const,
        fromToken,
        toToken,
        gasFeeETH: request.body.gasFeeETH,
        gasFeeUSD,
        protocolFeeUSD: request.body.protocolFeeUSD,
        slippage: request.body.slippage,
        priceImpact: request.body.priceImpact,
        dexName: request.body.dexName,
        routerAddress: request.body.routerAddress,
        aggregator: request.body.aggregator
      };

      // Add trade to database
      const savedTrade = await this.tradesService.addTrade(tradeData);

      // Note: Portfolio sync is now handled by sync worker
      // Users can manually trigger sync via /sync/trigger endpoint after adding trades

      return reply.code(201).send(createSuccessResponse({
        trade: savedTrade,
        portfolioSyncTriggered: false,
        note: 'Trade added successfully. Use /sync/trigger to refresh portfolio if needed.'
      }, `Trade ${txHash} added successfully`));

    } catch (error) {
      logger.error('Add trade error', { 
        error: error instanceof Error ? error.message : String(error),
        txHash: request.body?.txHash,
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to add trade';
      return reply.code(500).send(createErrorResponse(errorMessage));
    }
  }

  // PUT /portfolio/trades/:txHash - Update trade status
  async updateTrade(request: FastifyRequest<{
    Params: { txHash: string };
    Body: {
      status?: 'pending' | 'completed' | 'failed';
      blockNumber?: number;
      timestamp?: string;
      gasFeeETH?: number;
      gasFeeUSD?: number;
      pnl?: {
        realizedPnlUSD: number;
        feesPaidUSD: number;
        netPnlUSD: number;
        unrealizedPnlUSD?: number;
      };
    }
  }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const { txHash } = request.params;
      
      if (!txHash) {
        return reply.code(400).send(createErrorResponse('Transaction hash is required'));
      }

      const updates: any = {};
      
      if (request.body.status !== undefined) updates.status = request.body.status;
      if (request.body.blockNumber !== undefined) updates.blockNumber = request.body.blockNumber;
      if (request.body.timestamp !== undefined) updates.timestamp = new Date(request.body.timestamp);
      if (request.body.gasFeeETH !== undefined) updates.gasFeeETH = request.body.gasFeeETH;
      if (request.body.gasFeeUSD !== undefined) updates.gasFeeUSD = request.body.gasFeeUSD;
      if (request.body.pnl !== undefined) updates.pnl = request.body.pnl;

      const updatedTrade = await this.tradesService.updateTradeStatus(txHash, userId, updates);

      if (!updatedTrade) {
        return reply.code(404).send(createErrorResponse('Trade not found'));
      }

      return reply.send(createSuccessResponse({
        trade: updatedTrade
      }, `Trade ${txHash} updated successfully`));

    } catch (error) {
      logger.error('Update trade error', { 
        error: error instanceof Error ? error.message : String(error),
        txHash: request.params?.txHash,
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trade';
      return reply.code(500).send(createErrorResponse(errorMessage));
    }
  }

  // GET /portfolio/sync-status - Get sync status
  async getSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const syncStatus = {
        status: 'delegated_to_sync_worker',
        message: 'Sync operations are handled by the dedicated sync worker service',
        timestamp: new Date().toISOString()
      };

      return reply.send(createSuccessResponse({
        syncStatus,
        queueStats: { pending: 0, processing: 0, completed: 0 },
        lastSync: null
      }, 'Sync status retrieved (delegated to sync worker)'));
    } catch (error) {
      logger.error('Get sync status error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get sync status'));
    }
  }

  /**
   * Determine if background sync should be triggered
   */
  private async shouldTriggerBackgroundSync(
    userId: string, 
    walletAddress: string, 
    portfolio: Portfolio | null
  ): Promise<{ reason: string; priority: 'high' | 'medium' | 'low' } | null> {
    try {
      // No portfolio data - high priority sync
      if (!portfolio) {
        return { reason: 'no_portfolio_data', priority: 'high' };
      }

      // Check portfolio data age
      const dataAge = portfolio.lastSynced ? 
        Date.now() - portfolio.lastSynced.getTime() : 
        null;

      // Data older than 5 minutes - medium priority sync
      if (dataAge === null || dataAge > 5 * 60 * 1000) {
        return { reason: 'stale_data', priority: 'medium' };
      }

      // Check user API call pattern
      const shouldRefresh = await this.checkUserAPIPattern(userId, walletAddress);
      if (shouldRefresh) {
        return { reason: 'user_refresh_pattern', priority: 'medium' };
      }

      return null;
    } catch (error) {
      logger.error('Error determining sync need', { error });
      return null;
    }
  }

  /**
   * Check if user API call pattern suggests need for refresh
   */
  private async checkUserAPIPattern(userId: string, walletAddress: string): Promise<boolean> {
    try {
      const cacheKey = `portfolio:api:${userId}:${walletAddress}`;
      const cached = await this.cacheService.get<string>(cacheKey);
      
      if (!cached) {
        // First time calling - update cache but don't trigger sync
        await this.cacheService.set(cacheKey, Date.now().toString(), 120);
        return false;
      }
      
      const lastAPICall = parseInt(cached);
      const timeDiff = Date.now() - lastAPICall;
      
      // Update cache
      await this.cacheService.set(cacheKey, Date.now().toString(), 120);
      
      // Trigger sync if user hasn't called API in last 2 minutes
      // (indicates they're actively using the app)
      return timeDiff > 2 * 60 * 1000;
    } catch (error) {
      logger.error('Error checking API pattern', { error });
      return false;
    }
  }

  /**
   * Trigger background sync (simplified)
   */
  private async triggerBackgroundSync(
    userId: string,
    walletAddress: string,
    priority: 'high' | 'medium' | 'low',
    reason: string
  ): Promise<void> {
    try {
      // Use forceRefresh for high priority syncs to ensure immediate processing
      const forceRefresh = priority === 'high';
      
      const result = await this.syncProxyService.triggerUserSync(userId, walletAddress, priority, {
        source: reason,
        bypassRateLimit: true, // Internal calls bypass rate limit
        forceRefresh, // Force refresh for high priority syncs
        metadata: {
          triggeredBy: 'portfolio_controller',
          reason
        }
      });
      
      if (result.success) {
        logger.info('Background sync triggered', { 
          userId, 
          walletAddress, 
          priority, 
          reason,
          forceRefresh,
          syncOperationId: result.syncOperationId
        });
      } else {
        logger.warn('Background sync failed', { 
          userId, 
          walletAddress, 
          priority, 
          reason, 
          forceRefresh,
          message: result.message
        });
      }
    } catch (error: any) {
      logger.error('Background sync error', { 
        userId, 
        walletAddress, 
        priority, 
        reason, 
        error: error.message 
      });
      throw error;
    }
  }
} 