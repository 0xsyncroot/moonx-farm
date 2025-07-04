import { FastifyInstance } from 'fastify';
import { PortfolioService } from '../services/portfolioService';
import { PnLService } from '../services/pnlService';
import { TradesService } from '../services/tradesService';
import { AutoSyncService } from '../services/autoSyncService';
import { DatabaseService } from '../services/databaseService';
import { CacheService } from '../services/cacheService';
import { PortfolioController } from '../controllers/portfolioController';
import { AuthMiddleware } from '../middleware/authMiddleware';
import '../types/fastify'; // Import type extensions

// Portfolio routes that accept pre-initialized services
export async function portfolioRoutes(
  fastify: FastifyInstance,
  services?: {
    databaseService: DatabaseService;
    cacheService: CacheService;
    portfolioService: PortfolioService;
    autoSyncService: AutoSyncService;
  }
) {
  // If services are not provided, create them (fallback - should not happen in production)
  let databaseService: DatabaseService;
  let cacheService: CacheService;
  let portfolioService: PortfolioService;
  let autoSyncService: AutoSyncService;

  if (services) {
    // Use provided services (recommended approach)
    databaseService = services.databaseService;
    cacheService = services.cacheService;
    portfolioService = services.portfolioService;
    autoSyncService = services.autoSyncService;
  } else {
    // Fallback: create new services (not recommended for production)
    console.warn('Portfolio routes: No services provided, creating new instances');
    
    databaseService = new DatabaseService();
    cacheService = new CacheService();
    
    await databaseService.connect();
    await cacheService.connect();
    
    portfolioService = new PortfolioService(databaseService, cacheService);
    autoSyncService = new AutoSyncService(portfolioService, cacheService, databaseService);
  }

  // Initialize remaining services
  const pnlService = new PnLService(databaseService, cacheService);
  const tradesService = new TradesService(databaseService, cacheService);
  const authMiddleware = new AuthMiddleware();
  
  const portfolioController = new PortfolioController(
    portfolioService,
    pnlService,
    tradesService,
    autoSyncService,
    authMiddleware
  );

  // Portfolio Management Routes
  fastify.get('/portfolio', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get user portfolio with auto-sync',
      description: 'Retrieve user portfolio data with automatic background synchronization from Alchemy API',
      querystring: {
        type: 'object',
        properties: {
          chainIds: { type: 'string', description: 'Comma-separated chain IDs to filter' },
          includeSpam: { type: 'boolean', description: 'Include spam tokens', default: false },
          minValue: { type: 'number', description: 'Minimum token value in USD', default: 1 }
        }
      }
    }
  }, portfolioController.getPortfolio.bind(portfolioController));

  fastify.get('/portfolio/quick', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get quick portfolio overview',
      description: 'Get fast portfolio overview with cached data (2-minute cache)'
    }
  }, portfolioController.getQuickPortfolio.bind(portfolioController));

  fastify.post('/portfolio/refresh', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Force refresh portfolio data',
      description: 'Manually trigger high-priority portfolio sync from Alchemy API'
    }
  }, portfolioController.refreshPortfolio.bind(portfolioController));

  // P&L Analytics Routes
  fastify.get('/portfolio/pnl', {
    schema: {
      tags: ['Portfolio', 'Analytics'],
      summary: 'Get portfolio P&L analysis',
      description: 'Calculate real-time P&L with cost basis tracking and unrealized gains',
      querystring: {
        type: 'object',
        properties: {
          timeframe: { 
            type: 'string', 
            enum: ['24h', '7d', '30d', '90d', '1y', 'all'],
            default: '24h',
            description: 'Timeframe for P&L calculation'
          },
          walletAddress: { 
            type: 'string',
            description: 'Specific wallet address (optional, defaults to authenticated user)'
          }
        }
      }
    }
  }, portfolioController.getPnL.bind(portfolioController));

  fastify.get('/portfolio/analytics', {
    schema: {
      tags: ['Portfolio', 'Analytics'],
      summary: 'Get detailed portfolio analytics',
      description: 'Comprehensive portfolio analytics with chain/token breakdown and performance metrics',
      querystring: {
        type: 'object',
        properties: {
          timeframe: { 
            type: 'string', 
            default: '30d',
            description: 'Analytics timeframe'
          },
          breakdown: { 
            type: 'string',
            enum: ['chain', 'token', 'dex'],
            default: 'token',
            description: 'Analytics breakdown type'
          }
        }
      }
    }
  }, portfolioController.getAnalytics.bind(portfolioController));

  fastify.get('/portfolio/history', {
    schema: {
      tags: ['Portfolio', 'Analytics'],
      summary: 'Get portfolio value history',
      description: 'Historical portfolio value changes and performance tracking',
      querystring: {
        type: 'object',
        properties: {
          timeframe: { 
            type: 'string', 
            default: '30d',
            description: 'History timeframe'
          },
          interval: { 
            type: 'string',
            enum: ['hour', 'day', 'week'],
            default: 'day',
            description: 'Data aggregation interval'
          }
        }
      }
    }
  }, portfolioController.getPortfolioHistory.bind(portfolioController));

  // Trading History Routes
  fastify.get('/portfolio/trades', {
    schema: {
      tags: ['Portfolio', 'Trading'],
      summary: 'Get recent trading history',
      description: 'Retrieve recent trades from blockchain data with P&L calculation',
      querystring: {
        type: 'object',
        properties: {
          limit: { 
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of trades to return'
          },
          chainIds: { 
            type: 'string',
            description: 'Comma-separated chain IDs to filter trades'
          },
          days: { 
            type: 'integer',
            minimum: 1,
            maximum: 90,
            default: 30,
            description: 'Number of days to look back for trades'
          }
        }
      }
    }
  }, portfolioController.getRecentTrades.bind(portfolioController));

  fastify.post('/portfolio/trades', {
    schema: {
      tags: ['Portfolio', 'Trading'],
      summary: 'Add new trade record',
      description: 'Record a new trade after successful swap execution for immediate portfolio updates',
      body: {
        type: 'object',
        required: ['txHash', 'chainId', 'fromToken', 'toToken', 'gasFeeUSD'],
        properties: {
          txHash: { 
            type: 'string',
            description: 'Transaction hash of the swap'
          },
          chainId: { 
            type: 'integer',
            description: 'Blockchain chain ID'
          },
          blockNumber: { 
            type: 'integer',
            description: 'Block number (optional, can be updated later)'
          },
          timestamp: { 
            type: 'string',
            format: 'date-time',
            description: 'Trade execution timestamp (defaults to current time)'
          },
          type: { 
            type: 'string',
            enum: ['swap', 'buy', 'sell'],
            default: 'swap',
            description: 'Type of trade'
          },
          status: { 
            type: 'string',
            enum: ['pending', 'completed', 'failed'],
            default: 'completed',
            description: 'Trade status'
          },
          fromToken: {
            type: 'object',
            required: ['address', 'symbol', 'name', 'decimals', 'amount', 'amountFormatted', 'priceUSD', 'valueUSD'],
            properties: {
              address: { type: 'string' },
              symbol: { type: 'string' },
              name: { type: 'string' },
              decimals: { type: 'integer' },
              amount: { type: 'string' },
              amountFormatted: { type: 'number' },
              priceUSD: { type: 'number' },
              valueUSD: { type: 'number' }
            }
          },
          toToken: {
            type: 'object',
            required: ['address', 'symbol', 'name', 'decimals', 'amount', 'amountFormatted', 'priceUSD', 'valueUSD'],
            properties: {
              address: { type: 'string' },
              symbol: { type: 'string' },
              name: { type: 'string' },
              decimals: { type: 'integer' },
              amount: { type: 'string' },
              amountFormatted: { type: 'number' },
              priceUSD: { type: 'number' },
              valueUSD: { type: 'number' }
            }
          },
          gasFeeETH: { 
            type: 'number',
            description: 'Gas fee in ETH (optional)'
          },
          gasFeeUSD: { 
            type: 'number',
            description: 'Gas fee in USD'
          },
          protocolFeeUSD: { 
            type: 'number',
            description: 'Protocol fee in USD (optional)'
          },
          slippage: { 
            type: 'number',
            description: 'Slippage percentage (optional)'
          },
          priceImpact: { 
            type: 'number',
            description: 'Price impact percentage (optional)'
          },
          dexName: { 
            type: 'string',
            description: 'DEX name (optional)'
          },
          routerAddress: { 
            type: 'string',
            description: 'Router contract address (optional)'
          },
          aggregator: { 
            type: 'string',
            enum: ['lifi', '1inch', 'relay', 'jupiter'],
            description: 'Aggregator used (optional)'
          }
        }
      }
    }
  }, portfolioController.addTrade.bind(portfolioController));

  fastify.put('/portfolio/trades/:txHash', {
    schema: {
      tags: ['Portfolio', 'Trading'],
      summary: 'Update trade record',
      description: 'Update trade status, block number, or P&L data after blockchain confirmation',
      params: {
        type: 'object',
        required: ['txHash'],
        properties: {
          txHash: { 
            type: 'string',
            description: 'Transaction hash of the trade to update'
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['pending', 'completed', 'failed'],
            description: 'Updated trade status'
          },
          blockNumber: { 
            type: 'integer',
            description: 'Confirmed block number'
          },
          timestamp: { 
            type: 'string',
            format: 'date-time',
            description: 'Updated timestamp'
          },
          gasFeeETH: { 
            type: 'number',
            description: 'Updated gas fee in ETH'
          },
          gasFeeUSD: { 
            type: 'number',
            description: 'Updated gas fee in USD'
          },
          pnl: {
            type: 'object',
            properties: {
              realizedPnlUSD: { type: 'number' },
              feesPaidUSD: { type: 'number' },
              netPnlUSD: { type: 'number' },
              unrealizedPnlUSD: { type: 'number' }
            },
            description: 'P&L calculation results'
          }
        }
      }
    }
  }, portfolioController.updateTrade.bind(portfolioController));

  // System Status Routes
  fastify.get('/portfolio/sync-status', {
    schema: {
      tags: ['Portfolio', 'System'],
      summary: 'Get portfolio sync status',
      description: 'Current status of portfolio synchronization workers and queue statistics'
    }
  }, portfolioController.getSyncStatus.bind(portfolioController));
} 