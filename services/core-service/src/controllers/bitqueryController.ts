import { FastifyRequest, FastifyReply } from 'fastify'
import { bitqueryService } from '../services/bitqueryService'
import { createLogger } from '@moonx-farm/common'

const logger = createLogger('bitquery-controller')

interface GetOHLCVRequest {
  Querystring: {
    network?: string
    baseToken: string
    quoteToken: string
    interval?: number
    intervalIn?: 'minutes' | 'hours' | 'days'
  }
}

interface GetSymbolOHLCVRequest {
  Querystring: {
    symbol: string
    interval?: number
    intervalIn?: 'minutes' | 'hours' | 'days'
  }
}

interface GetTokenPairOHLCVRequest {
  Querystring: {
    baseTokenAddress: string
    quoteTokenAddress: string
    network?: string
    interval?: number
    intervalIn?: 'minutes' | 'hours' | 'days'
  }
}

interface GetChartDataRequest {
  Querystring: {
    symbol: string
    tokenAddress?: string
    timeframe?: 'daily' | 'weekly' | 'monthly'
    fromTokenAddress?: string
    toTokenAddress?: string
    fromTokenChainId?: number
    toTokenChainId?: number
  }
}

export class BitqueryController {
  async getOHLCV(request: FastifyRequest<GetOHLCVRequest>, reply: FastifyReply) {
    try {
      const { network = 'ethereum', baseToken, quoteToken, interval = 5, intervalIn = 'minutes' } = request.query

      const data = await bitqueryService.fetchOHLCV({
        network,
        baseToken,
        quoteToken,
        interval,
        intervalIn
      })

      return reply.send({
        success: true,
        data,
        source: 'bitquery'
      })
    } catch (error) {
      logger.error('Error fetching OHLCV data', { error: error instanceof Error ? error.message : 'Unknown error' })
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'bitquery'
      })
    }
  }

  async getSymbolOHLCV(request: FastifyRequest<GetSymbolOHLCVRequest>, reply: FastifyReply) {
    try {
      const { symbol, interval = 5, intervalIn = 'minutes' } = request.query

      const data = await bitqueryService.fetchSymbolOHLCV(symbol, interval, intervalIn)

      return reply.send({
        success: true,
        data,
        source: 'bitquery'
      })
    } catch (error) {
      logger.error('Error fetching symbol OHLCV data', { error: error instanceof Error ? error.message : 'Unknown error' })
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'bitquery'
      })
    }
  }

  async getTokenPairOHLCV(request: FastifyRequest<GetTokenPairOHLCVRequest>, reply: FastifyReply) {
    try {
      const { baseTokenAddress, quoteTokenAddress, network = 'ethereum', interval = 5, intervalIn = 'minutes' } = request.query

      const data = await bitqueryService.fetchTokenPairOHLCV(
        baseTokenAddress,
        quoteTokenAddress,
        network,
        interval,
        intervalIn
      )

      return reply.send({
        success: true,
        data,
        source: 'bitquery'
      })
    } catch (error) {
      logger.error('Error fetching token pair OHLCV data', { error: error instanceof Error ? error.message : 'Unknown error' })
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'bitquery'
      })
    }
  }

  async getChartData(request: FastifyRequest<GetChartDataRequest>, reply: FastifyReply) {
    try {
      const { 
        symbol, 
        tokenAddress, 
        timeframe = 'daily',
        fromTokenAddress,
        toTokenAddress,
        fromTokenChainId,
        toTokenChainId
      } = request.query

      logger.info('Chart data request', { 
        symbol, 
        fromTokenAddress, 
        toTokenAddress, 
        fromTokenChainId, 
        toTokenChainId 
      })

      // Try to get real OHLCV data from Bitquery
      const bitqueryAvailable = await bitqueryService.testConnection()
      
      if (bitqueryAvailable && fromTokenAddress && toTokenAddress) {
        try {
          // Calculate interval based on timeframe
          const interval = timeframe === 'daily' ? 1440 : timeframe === 'weekly' ? 10080 : 43200 // minutes
          const intervalIn = 'minutes' as const
          
          // Get network from chain ID - support cross-chain properly
          const network = bitqueryService.getNetworkFromChainId(fromTokenChainId || toTokenChainId || 1)
          
          logger.info('Fetching Bitquery data', { 
            network, 
            fromTokenAddress, 
            toTokenAddress, 
            interval 
          })
          
          // Try to get data for the actual token pair selected by user
          const bitqueryData = await bitqueryService.fetchTokenPairOHLCVEnhanced(
            fromTokenAddress,
            toTokenAddress,
            network,
            interval,
            intervalIn
          )
          
          if (bitqueryData.length > 0) {
            const priceData = bitqueryService.convertToPriceDataPoint(bitqueryData)
            
            logger.info('Successfully fetched Bitquery data', { dataPoints: priceData.length })
            
            return reply.send({
              success: true,
              data: {
                token: {
                  symbol: symbol,
                  name: `${symbol} Token`,
                  address: toTokenAddress,
                  chainId: toTokenChainId,
                },
                timeframe,
                data: priceData,
                source: 'bitquery',
                lastUpdated: Date.now()
              }
            })
          }
          
        } catch (bitqueryError) {
          logger.warn('Bitquery failed for token pair, trying symbol lookup', { 
            error: bitqueryError instanceof Error ? bitqueryError.message : 'Unknown error' 
          })
          
          // Fallback: try to get data by symbol if token pair fails
          try {
            const cleanSymbol = symbol.split('/')[0]?.toUpperCase() || symbol.toUpperCase()
            const interval = timeframe === 'daily' ? 1440 : timeframe === 'weekly' ? 10080 : 43200
            const bitqueryData = await bitqueryService.fetchSymbolOHLCV(cleanSymbol, interval, 'minutes')
            
            if (bitqueryData.length > 0) {
              const priceData = bitqueryService.convertToPriceDataPoint(bitqueryData)
              
              logger.info('Successfully fetched Bitquery data by symbol', { 
                symbol: cleanSymbol, 
                dataPoints: priceData.length 
              })
              
              return reply.send({
                success: true,
                data: {
                  token: {
                    symbol: cleanSymbol,
                    name: `${cleanSymbol} Token`,
                    address: tokenAddress,
                    chainId: toTokenChainId,
                  },
                  timeframe,
                  data: priceData,
                  source: 'bitquery',
                  lastUpdated: Date.now()
                }
              })
            }
          } catch (symbolError) {
            logger.warn('Bitquery symbol lookup also failed', { 
              error: symbolError instanceof Error ? symbolError.message : 'Unknown error' 
            })
          }
        }
      } else {
        logger.warn('Bitquery not available or missing token addresses', { 
          bitqueryAvailable, 
          fromTokenAddress: !!fromTokenAddress, 
          toTokenAddress: !!toTokenAddress 
        })
      }

      // Return fallback response - let frontend handle with DexScreener
      logger.info('Returning fallback response for frontend to handle')
      return reply.send({
        success: true,
        data: {
          token: {
            symbol: symbol,
            name: `${symbol} Token`,
            address: tokenAddress,
            chainId: toTokenChainId,
          },
          timeframe,
          data: [],
          source: 'fallback',
          lastUpdated: Date.now()
        }
      })

    } catch (error) {
      logger.error('Error fetching chart data', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async testConnection(request: FastifyRequest, reply: FastifyReply) {
    try {
      const isConnected = await bitqueryService.testConnection()
      
      return reply.send({
        success: true,
        connected: isConnected,
        hasApiKey: !!process.env.BITQUERY_API_KEY
      })
    } catch (error) {
      logger.error('Error testing Bitquery connection', { error: error instanceof Error ? error.message : 'Unknown error' })
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export const bitqueryController = new BitqueryController() 