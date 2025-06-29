import { FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioService } from '../services/portfolioService';
import { PnLService } from '../services/pnlService';
import { TradesService } from '../services/tradesService';
import { AutoSyncService } from '../services/autoSyncService';
import { AuthenticatedRequest, AuthMiddleware } from '../middleware/authMiddleware';
import { PortfolioSyncRequest, PortfolioFilters, PnLRequest } from '../types';
import { ApiResponse } from '../types';
import { createLoggerForAnyService } from '@moonx/common';

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
    private autoSyncService: AutoSyncService,
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
        // No portfolio data - trigger high priority sync and return loading state
        await this.autoSyncService.onUserAccess(userId, walletAddress);
        
        return reply.code(202).send(createSuccessResponse({
          portfolio: null,
          status: 'syncing',
          message: 'Portfolio is being synced. Please check back in a few moments.'
        }, 'Portfolio sync initiated'));
      }

      // Check if data is stale (> 15 minutes old)
      const now = new Date();
      const diffMinutes = (now.getTime() - portfolio.lastSynced.getTime()) / (1000 * 60);
      
      if (diffMinutes > 15) {
        // Trigger background sync for fresh data (don't wait)
        setImmediate(() => {
          this.autoSyncService.onUserAccess(userId, walletAddress);
        });
      }

      return reply.send(createSuccessResponse({ 
        portfolio,
        syncStatus: diffMinutes > 15 ? 'refreshing' : 'current',
        lastSynced: portfolio.lastSynced
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
      
      // Trigger auto sync if no data or data is old
      if (!quickData.lastSynced || quickData.totalValueUSD === 0) {
        setImmediate(() => {
          this.autoSyncService.onUserAccess(userId, walletAddress);
        });
      }
      
      return reply.send(createSuccessResponse({
        ...quickData,
        status: quickData.totalValueUSD > 0 ? 'ready' : 'syncing'
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

      // Force high priority sync
      await this.autoSyncService.triggerUserSync(userId, walletAddress, 'high');

      return reply.send(createSuccessResponse({
        message: 'Portfolio refresh initiated. Check back in a few moments for updated data.',
        status: 'refreshing'
      }, 'Portfolio refresh initiated'));
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

  // GET /portfolio/sync-status - Get sync status
  async getSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.autoSyncService.getSyncStats();
      
      return reply.send(createSuccessResponse({ syncStats: stats }, 
        'Sync statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get sync status error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get sync status'));
    }
  }
} 