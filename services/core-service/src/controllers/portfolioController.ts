import { FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioService } from '../services/portfolioService';
import { PnLService } from '../services/pnlService';
import { TradesService } from '../services/tradesService';
import { AuthenticatedRequest, AuthMiddleware } from '../middleware/authMiddleware';
import { PortfolioSyncRequest, PortfolioFilters, PnLRequest } from '../types';
import { ApiResponse } from '../types';
import { createLoggerForAnyService } from '@moonx-farm/common';

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
    private authMiddleware: AuthMiddleware
  ) {}

  // GET /portfolio - Get user portfolio (auto-synced)
  async getPortfolio(request: FastifyRequest<{ Querystring: PortfolioFilters }>, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      
      // Try to get portfolio (cache first, then DB)
      let portfolio = await this.portfolioService.getPortfolio(userId, walletAddress, request.query);
      
      if (!portfolio) {
        // No portfolio data - sync is now handled by sync worker
        // User should use sync endpoints to trigger sync if needed
        
        return reply.code(202).send(createSuccessResponse({
          portfolio: null,
          status: 'no_data',
          message: 'No portfolio data available. Please use /sync/trigger to initiate sync.'
        }, 'Portfolio data not found'));
      }

      // Check if data is stale (> 15 minutes old)
      const now = new Date();
      const diffMinutes = (now.getTime() - portfolio.lastSynced.getTime()) / (1000 * 60);
      
      // Note: Background sync is now handled by sync worker
      // Users can manually trigger sync via /sync/trigger endpoint

      return reply.send(createSuccessResponse({ 
        portfolio,
        syncStatus: diffMinutes > 15 ? 'stale' : 'current',
        lastSynced: portfolio.lastSynced,
        note: diffMinutes > 15 ? 'Data is stale. Consider using /sync/trigger to refresh.' : undefined
      }, `Portfolio retrieved with ${portfolio.holdings?.length || 0} holdings`));
    } catch (error) {
      logger.error('Get portfolio error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get portfolio'));
    }
  }

  // GET /portfolio/quick - Get quick portfolio overview (always fast)
  async getQuickPortfolio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      
      // Quick data should always be available (short cache)
      const quickData = await this.portfolioService.getQuickPortfolio(userId, walletAddress);
      
      // Note: Auto sync is now handled by sync worker
      // User can manually trigger sync if needed via /sync/trigger
      
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

  // POST /portfolio/refresh - Force refresh user portfolio
  async refreshPortfolio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);

      // Note: Portfolio refresh is now handled by sync worker
      // User should use /sync/trigger endpoint instead

      return reply.send(createSuccessResponse({
        message: 'Portfolio refresh has been moved to sync worker. Please use /api/v1/sync/trigger endpoint.',
        redirect: '/api/v1/sync/trigger',
        status: 'delegated'
      }, 'Portfolio refresh delegated to sync worker'));
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
      
      const pnlData = await this.pnlService.calculatePnL(userId, {
        timeframe: request.query.timeframe || '24h',
        walletAddress: request.query.walletAddress || walletAddress
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
      const { timeframe = '30d', breakdown = 'token' } = request.query;
      
      // Get P&L data
      const pnlSummary = await this.pnlService.calculatePnL(userId, { 
        timeframe: timeframe as any,
        walletAddress 
      });

      // Get portfolio data
      const portfolio = await this.portfolioService.getPortfolio(userId, walletAddress);
      
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
        walletAddress,
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
} 