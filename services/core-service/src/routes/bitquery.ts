import { FastifyInstance } from 'fastify'
import { bitqueryController } from '../controllers/bitqueryController'

export async function bitqueryRoutes(fastify: FastifyInstance) {
  // Test connection endpoint
  fastify.get('/test', {
    schema: {
      tags: ['Bitquery'],
      summary: 'Test Bitquery API connection',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            connected: { type: 'boolean' },
            hasApiKey: { type: 'boolean' }
          }
        }
      }
    }
  }, bitqueryController.testConnection.bind(bitqueryController))

  // Get OHLCV data for specific token pair
  fastify.get('/ohlcv', {
    schema: {
      tags: ['Bitquery'],
      summary: 'Get OHLCV data for token pair',
      querystring: {
        type: 'object',
        required: ['baseToken', 'quoteToken'],
        properties: {
          network: { type: 'string', default: 'ethereum' },
          baseToken: { type: 'string' },
          quoteToken: { type: 'string' },
          interval: { type: 'number', default: 5 },
          intervalIn: { type: 'string', enum: ['minutes', 'hours', 'days'], default: 'minutes' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time: { type: 'string' },
                  open: { type: 'number' },
                  high: { type: 'number' },
                  low: { type: 'number' },
                  close: { type: 'number' },
                  volume: { type: 'number' }
                }
              }
            },
            source: { type: 'string' }
          }
        }
      }
    }
  }, bitqueryController.getOHLCV.bind(bitqueryController))

  // Get OHLCV data by symbol
  fastify.get('/symbol/:symbol', {
    schema: {
      tags: ['Bitquery'],
      summary: 'Get OHLCV data by symbol',
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          interval: { type: 'number', default: 5 },
          intervalIn: { type: 'string', enum: ['minutes', 'hours', 'days'], default: 'minutes' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time: { type: 'string' },
                  open: { type: 'number' },
                  high: { type: 'number' },
                  low: { type: 'number' },
                  close: { type: 'number' },
                  volume: { type: 'number' }
                }
              }
            },
            source: { type: 'string' }
          }
        }
      }
    }
  }, bitqueryController.getSymbolOHLCV.bind(bitqueryController))

  // Get OHLCV data for token pair by addresses
  fastify.get('/pair', {
    schema: {
      tags: ['Bitquery'],
      summary: 'Get OHLCV data for token pair by addresses',
      querystring: {
        type: 'object',
        required: ['baseTokenAddress', 'quoteTokenAddress'],
        properties: {
          baseTokenAddress: { type: 'string' },
          quoteTokenAddress: { type: 'string' },
          network: { type: 'string', default: 'ethereum' },
          interval: { type: 'number', default: 5 },
          intervalIn: { type: 'string', enum: ['minutes', 'hours', 'days'], default: 'minutes' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time: { type: 'string' },
                  open: { type: 'number' },
                  high: { type: 'number' },
                  low: { type: 'number' },
                  close: { type: 'number' },
                  volume: { type: 'number' }
                }
              }
            },
            source: { type: 'string' }
          }
        }
      }
    }
  }, bitqueryController.getTokenPairOHLCV.bind(bitqueryController))

  // Get chart data (main endpoint for frontend)
  fastify.get('/chart', {
    schema: {
      tags: ['Bitquery'],
      summary: 'Get chart data for trading interface',
      querystring: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' },
          tokenAddress: { type: 'string' },
          timeframe: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
          fromTokenAddress: { type: 'string' },
          toTokenAddress: { type: 'string' },
          fromTokenChainId: { type: 'number' },
          toTokenChainId: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                token: {
                  type: 'object',
                  properties: {
                    symbol: { type: 'string' },
                    name: { type: 'string' },
                    address: { type: 'string' },
                    chainId: { type: 'number' }
                  }
                },
                timeframe: { type: 'string' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'number' },
                      date: { type: 'string' },
                      open: { type: 'number' },
                      high: { type: 'number' },
                      low: { type: 'number' },
                      close: { type: 'number' },
                      volume: { type: 'number' }
                    }
                  }
                },
                source: { type: 'string' },
                lastUpdated: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, bitqueryController.getChartData.bind(bitqueryController))
} 