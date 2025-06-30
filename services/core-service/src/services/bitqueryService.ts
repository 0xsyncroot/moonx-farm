import axios from 'axios'
import { createLogger } from '@moonx-farm/common'

const logger = createLogger('bitquery-service')

export interface BitqueryOHLCV {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface BitqueryConfig {
  apiKey: string
  baseUrl: string
  rateLimit: {
    requestsPerSecond: number
    requestsPerMinute: number
  }
}

export interface FetchOHLCVParams {
  network: string
  baseToken: string
  quoteToken: string
  interval?: number
  intervalIn?: 'minutes' | 'hours' | 'days'
}

// Default configuration
const DEFAULT_CONFIG: BitqueryConfig = {
  apiKey: process.env.BITQUERY_API_KEY || 'ory_at_BIAvZiQ9zwJAomeVdc9FKhRshY7c4Gyhv4EUh4W9fy0.XZ34H4G-ZyCOzwYzOq_AIZ2XvlsnWrnYqO2YoCl14mA',
  baseUrl: 'https://streaming.bitquery.io/eap',
  rateLimit: {
    requestsPerSecond: 5,
    requestsPerMinute: 100
  }
}

// Rate limiting
let requestCount = 0
let lastResetTime = Date.now()

function checkRateLimit(): boolean {
  const now = Date.now()
  
  // Reset counter every minute
  if (now - lastResetTime > 60000) {
    requestCount = 0
    lastResetTime = now
  }
  
  if (requestCount >= DEFAULT_CONFIG.rateLimit.requestsPerMinute) {
    return false
  }
  
  requestCount++
  return true
}

// Network mapping - Updated to Bitquery V2 network names
const NETWORK_MAPPING: Record<string, string> = {
  'ethereum': 'eth',
  'bsc': 'bsc', 
  'polygon': 'matic',
  'avalanche': 'avalanche',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'base': 'base',
  'fantom': 'fantom',
  'celo': 'celo',
  '1': 'eth',
  '56': 'bsc',
  '137': 'matic',
  '43114': 'avalanche',
  '42161': 'arbitrum',
  '10': 'optimism',
  '8453': 'base',
  '250': 'fantom',
  '42220': 'celo'
}

// Cross-chain token addresses for major tokens - Updated for Bitquery V2
const CROSS_CHAIN_TOKENS: Record<string, Record<string, string>> = {
  // WETH addresses across chains
  'WETH': {
    'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    'arbitrum': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    'optimism': '0x4200000000000000000000000000000000000006',
    'base': '0x4200000000000000000000000000000000000006',
    'matic': '0x7ceb23fd6c0dd50e5cf1eeb15e0c32d64d04a0e0'
  },
  // USDC addresses across chains
  'USDC': {
    'eth': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    'arbitrum': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    'optimism': '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    'base': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    'matic': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    'avalanche': '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'
  },
  // USDT addresses across chains  
  'USDT': {
    'eth': '0xdac17f958d2ee523a2206206994597c13d831ec7',
    'bsc': '0x55d398326f99059ff775485246999027b3197955',
    'arbitrum': '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    'optimism': '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    'matic': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    'avalanche': '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7'
  },
  // Native wrapped tokens
  'WBNB': {
    'bsc': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
  },
  'WMATIC': {
    'matic': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
  },
  'WAVAX': {
    'avalanche': '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'
  }
}

// Common trading pairs for each network - Updated network names
const COMMON_PAIRS: Record<string, { base: string; quote: string; network: string }> = {
  // Ethereum pairs
  'ETH/USDC': {
    base: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    quote: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    network: 'eth'
  },
  'ETH/USDT': {
    base: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    quote: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    network: 'eth'
  },
  
  // BSC pairs
  'BNB/USDT': {
    base: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
    quote: '0x55d398326f99059ff775485246999027b3197955', // USDT
    network: 'bsc'
  },
  'BNB/BUSD': {
    base: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
    quote: '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
    network: 'bsc'
  },
  
  // Base pairs
  'ETH/USDC-BASE': {
    base: '0x4200000000000000000000000000000000000006', // WETH (Base)
    quote: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC (Base)
    network: 'base'
  },
  
  // Arbitrum pairs
  'ETH/USDC-ARB': {
    base: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH (Arbitrum)
    quote: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC (Arbitrum)
    network: 'arbitrum'
  },
  
  // Optimism pairs
  'ETH/USDC-OP': {
    base: '0x4200000000000000000000000000000000000006', // WETH (Optimism)
    quote: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC (Optimism)
    network: 'optimism'
  },
  
  // Polygon pairs
  'MATIC/USDC': {
    base: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
    quote: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC
    network: 'matic'
  },
  
  // Avalanche pairs
  'AVAX/USDC': {
    base: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
    quote: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // USDC
    network: 'avalanche'
  }
}

// Enhanced symbol to pair mapping with network-specific detection
const SYMBOL_TO_PAIR: Record<string, string[]> = {
  'ETH': ['ETH/USDC', 'ETH/USDT', 'ETH/USDC-BASE', 'ETH/USDC-ARB', 'ETH/USDC-OP'],
  'WETH': ['ETH/USDC', 'ETH/USDT', 'ETH/USDC-BASE', 'ETH/USDC-ARB', 'ETH/USDC-OP'],
  'BNB': ['BNB/USDT', 'BNB/BUSD'],
  'WBNB': ['BNB/USDT', 'BNB/BUSD'],
  'MATIC': ['MATIC/USDC'],
  'WMATIC': ['MATIC/USDC'],
  'AVAX': ['AVAX/USDC'],
  'WAVAX': ['AVAX/USDC'],
  'USDC': ['ETH/USDC', 'BNB/USDT', 'MATIC/USDC', 'AVAX/USDC'],
  'USDT': ['ETH/USDT', 'BNB/USDT'],
  'BUSD': ['BNB/BUSD']
}

export class BitqueryService {
  private config: BitqueryConfig

  constructor() {
    this.config = DEFAULT_CONFIG
  }

  async fetchOHLCV(params: FetchOHLCVParams): Promise<BitqueryOHLCV[]> {
    const { network, baseToken, quoteToken, interval = 5, intervalIn = 'minutes' } = params

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Check if API key is available
    if (!this.config.apiKey) {
      throw new Error('Bitquery API key is required. Please set BITQUERY_API_KEY environment variable.')
    }

    // Map network name to Bitquery V2 format
    const bitqueryNetwork = NETWORK_MAPPING[network] || network
    
    // Ensure interval format matches OLAP_DateTimeIntervalUnits enum
    const intervalFormat = intervalIn.toLowerCase()
    
    // Validate interval format
    const validIntervals = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']
    if (!validIntervals.includes(intervalFormat)) {
      throw new Error(`Invalid interval format: ${intervalFormat}. Must be one of: ${validIntervals.join(', ')}`)
    }

    // Build GraphQL query dynamically (no variables for network and interval)
    const dynamicQuery = `
    query getOHLCV($baseToken: String!, $quoteToken: String!, $intervalCount: Int!) {
      EVM(network: ${bitqueryNetwork}) {
        DEXTradeByTokens(
          orderBy: { ascendingByField: "Block_Time" }
          where: {
            Trade: {
              Side: {
                Amount: { gt: "0" }
                Currency: { SmartContract: { is: $baseToken } }
              }
              Currency: { SmartContract: { is: $quoteToken } }
              PriceAsymmetry: { lt: 0.5 }
            }
          }
          limit: { count: 1000 }
        ) {
          Block {
            Time(interval: { count: $intervalCount, in: ${intervalFormat} })
          }
          Trade {
            open: PriceInUSD(minimum: Block_Number)
            close: PriceInUSD(maximum: Block_Number)
            max: PriceInUSD(maximum: Trade_PriceInUSD)
            min: PriceInUSD(minimum: Trade_PriceInUSD)
          }
          volume: sum(of: Trade_Side_Amount)
        }
      }
    }
    `

    logger.info('Fetching OHLCV data', {
      originalNetwork: network,
      bitqueryNetwork,
      baseToken,
      quoteToken,
      interval,
      intervalFormat,
      queryPreview: dynamicQuery.substring(0, 200) + '...'
    })

    try {
      const response = await axios.post(
        this.config.baseUrl,
        {
          query: dynamicQuery,
          variables: {
            baseToken,
            quoteToken,
            intervalCount: interval
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 10000, // 10 second timeout
        }
      )

      logger.info('Bitquery API response', {
        hasErrors: !!response.data.errors,
        hasData: !!response.data.data,
        dataStructure: response.data.data ? Object.keys(response.data.data) : null
      })

      if (response.data.errors) {
        logger.error('GraphQL errors from Bitquery', { errors: response.data.errors })
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`)
      }

      const data = response.data.data?.EVM?.DEXTradeByTokens || []
      
      logger.info('Parsed OHLCV data', {
        dataPoints: data.length,
        firstItem: data[0] || null
      })
      
      return data.map((item: any) => ({
        time: item.Block.Time,
        open: parseFloat(item.Trade.open || '0'),
        high: parseFloat(item.Trade.max || '0'),
        low: parseFloat(item.Trade.min || '0'),
        close: parseFloat(item.Trade.close || '0'),
        volume: parseFloat(item.volume || '0')
      })).filter((item: BitqueryOHLCV) => 
        item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0
      )

    } catch (error) {
      logger.error('Bitquery API error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        network: bitqueryNetwork,
        baseToken,
        quoteToken
      })
      throw error
    }
  }

  async fetchCommonPairOHLCV(
    pair: string,
    interval: number = 5,
    intervalIn: 'minutes' | 'hours' | 'days' = 'minutes'
  ): Promise<BitqueryOHLCV[]> {
    const pairConfig = COMMON_PAIRS[pair]
    
    if (!pairConfig) {
      throw new Error(`Unknown pair: ${pair}. Supported pairs: ${Object.keys(COMMON_PAIRS).join(', ')}`)
    }

    return this.fetchOHLCV({
      network: pairConfig.network,
      baseToken: pairConfig.base,
      quoteToken: pairConfig.quote,
      interval,
      intervalIn
    })
  }

  async fetchTokenPairOHLCV(
    baseTokenAddress: string,
    quoteTokenAddress: string,
    network: string = 'ethereum',
    interval: number = 5,
    intervalIn: 'minutes' | 'hours' | 'days' = 'minutes'
  ): Promise<BitqueryOHLCV[]> {
    return this.fetchOHLCV({
      network,
      baseToken: baseTokenAddress,
      quoteToken: quoteTokenAddress,
      interval,
      intervalIn
    })
  }

  async fetchSymbolOHLCV(
    symbol: string,
    interval: number = 5,
    intervalIn: 'minutes' | 'hours' | 'days' = 'minutes'
  ): Promise<BitqueryOHLCV[]> {
    const pairs = SYMBOL_TO_PAIR[symbol.toUpperCase()]
    
    if (!pairs) {
      throw new Error(`Symbol not supported: ${symbol}. Supported symbols: ${Object.keys(SYMBOL_TO_PAIR).join(', ')}`)
    }

    // Try each pair until we get data
    for (const pair of pairs) {
      try {
        const result = await this.fetchCommonPairOHLCV(pair, interval, intervalIn)
        if (result.length > 0) {
          return result
        }
      } catch (error) {
        logger.warn(`Failed to fetch data for pair ${pair}`, { error: error instanceof Error ? error.message : 'Unknown error' })
        continue
      }
    }

    return []
  }

  convertToPriceDataPoint(
    bitqueryData: BitqueryOHLCV[]
  ): Array<{
    timestamp: number
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }> {
    return bitqueryData.map(item => ({
      timestamp: new Date(item.time).getTime(),
      date: new Date(item.time).toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    })).sort((a, b) => a.timestamp - b.timestamp)
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        logger.warn('Bitquery API key not configured')
        return false
      }

      // Test with a simple query
      const testData = await this.fetchCommonPairOHLCV('ETH/USDC', 1, 'minutes')
      return testData.length > 0
    } catch (error) {
      logger.error('Bitquery connection test failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      return false
    }
  }

  getNetworkFromChainId(chainId: number): string {
    const networkMap: Record<number, string> = {
      1: 'eth',
      56: 'bsc',
      137: 'matic',
      43114: 'avalanche',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base'
    }
    return networkMap[chainId] || 'eth'
  }

  // Handle native token to wrapped token conversion
  convertNativeToWrappedToken(tokenAddress: string, network: string): string {
    const normalizedNetwork = network.toLowerCase()
    
    // Native token addresses (0x0000... or specific native addresses)
    const nativeAddresses = [
      '0x0000000000000000000000000000000000000000',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    ]
    
    if (nativeAddresses.includes(tokenAddress.toLowerCase())) {
      // Return wrapped version of native token
      const wrappedTokens: Record<string, string> = {
        'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        'bsc': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB  
        'matic': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
        'avalanche': '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
        'arbitrum': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH (Arbitrum)
        'optimism': '0x4200000000000000000000000000000000000006', // WETH (Optimism)
        'base': '0x4200000000000000000000000000000000000006' // WETH (Base)
      }
      
      return wrappedTokens[normalizedNetwork] || tokenAddress
    }
    
    return tokenAddress
  }

  // Detect token pair from addresses - enhanced cross-chain support
  detectTokenPairFromAddresses(
    fromTokenAddress: string,
    toTokenAddress: string,
    network: string
  ): { baseToken: string; quoteToken: string; symbol: string } | null {
    const normalizedFromToken = fromTokenAddress.toLowerCase()
    const normalizedToToken = toTokenAddress.toLowerCase()
    const normalizedNetwork = network.toLowerCase()

    // Check if we can find a matching pair in our common pairs
    for (const [pairSymbol, pairConfig] of Object.entries(COMMON_PAIRS)) {
      if (pairConfig.network === normalizedNetwork) {
        const normalizedBase = pairConfig.base.toLowerCase()
        const normalizedQuote = pairConfig.quote.toLowerCase()

        if (
          (normalizedFromToken === normalizedBase && normalizedToToken === normalizedQuote) ||
          (normalizedFromToken === normalizedQuote && normalizedToToken === normalizedBase)
        ) {
          return {
            baseToken: normalizedFromToken === normalizedBase ? fromTokenAddress : toTokenAddress,
            quoteToken: normalizedFromToken === normalizedBase ? toTokenAddress : fromTokenAddress,
            symbol: pairSymbol
          }
        }
      }
    }

    // If no exact match, try to find if one of the tokens is a known quote token (USDC, USDT, etc.)
    const knownQuoteTokens = ['usdc', 'usdt', 'busd', 'dai']
    const fromTokenSymbol = this.findTokenSymbolByAddress(normalizedFromToken, normalizedNetwork)
    const toTokenSymbol = this.findTokenSymbolByAddress(normalizedToToken, normalizedNetwork)

    if (fromTokenSymbol && knownQuoteTokens.includes(fromTokenSymbol.toLowerCase())) {
      return {
        baseToken: toTokenAddress,
        quoteToken: fromTokenAddress,
        symbol: `${toTokenSymbol || 'UNKNOWN'}/${fromTokenSymbol}`
      }
    }

    if (toTokenSymbol && knownQuoteTokens.includes(toTokenSymbol.toLowerCase())) {
      return {
        baseToken: fromTokenAddress,
        quoteToken: toTokenAddress,
        symbol: `${fromTokenSymbol || 'UNKNOWN'}/${toTokenSymbol}`
      }
    }

    // Default: use provided order
    return {
      baseToken: fromTokenAddress,
      quoteToken: toTokenAddress,
      symbol: `${fromTokenSymbol || 'TOKEN1'}/${toTokenSymbol || 'TOKEN2'}`
    }
  }

  // Find token symbol by address - reverse lookup
  findTokenSymbolByAddress(tokenAddress: string, network: string): string | null {
    const normalizedAddress = tokenAddress.toLowerCase()
    const normalizedNetwork = network.toLowerCase()

    // Search in cross-chain tokens
    for (const [symbol, networkTokens] of Object.entries(CROSS_CHAIN_TOKENS)) {
      for (const [net, address] of Object.entries(networkTokens)) {
        if (net === normalizedNetwork && address.toLowerCase() === normalizedAddress) {
          return symbol
        }
      }
    }

    // Search in common pairs
    for (const [pairSymbol, pairConfig] of Object.entries(COMMON_PAIRS)) {
      if (pairConfig.network === normalizedNetwork) {
        if (pairConfig.base.toLowerCase() === normalizedAddress) {
          const baseSymbol = pairSymbol.split('/')[0]
          return baseSymbol
        }
        if (pairConfig.quote.toLowerCase() === normalizedAddress) {
          const quoteSymbol = pairSymbol.split('/')[1]
          return quoteSymbol
        }
      }
    }

    return null
  }

  // Get best quote token for a network
  getBestQuotePairForNetwork(baseTokenAddress: string, network: string): string | null {
    const normalizedNetwork = network.toLowerCase()
    
    // Priority order for quote tokens
    const quotePriority = ['USDC', 'USDT', 'BUSD', 'WETH', 'WBNB', 'WMATIC', 'WAVAX']
    
    for (const quoteSymbol of quotePriority) {
      const quoteTokens = CROSS_CHAIN_TOKENS[quoteSymbol]
      if (quoteTokens && quoteTokens[normalizedNetwork]) {
        return quoteTokens[normalizedNetwork]
      }
    }

    return null
  }

  // Enhanced fetchTokenPairOHLCV with native token handling
  async fetchTokenPairOHLCVEnhanced(
    fromTokenAddress: string,
    toTokenAddress: string,
    network: string = 'eth',
    interval: number = 5,
    intervalIn: 'minutes' | 'hours' | 'days' = 'minutes'
  ): Promise<BitqueryOHLCV[]> {
    const normalizedNetwork = NETWORK_MAPPING[network] || network

    // Convert native tokens to wrapped tokens
    const processedFromToken = this.convertNativeToWrappedToken(fromTokenAddress, normalizedNetwork)
    const processedToToken = this.convertNativeToWrappedToken(toTokenAddress, normalizedNetwork)

    logger.info('Enhanced token pair fetch', {
      originalFromToken: fromTokenAddress,
      originalToToken: toTokenAddress,
      processedFromToken,
      processedToToken,
      network: normalizedNetwork
    })

    // First, try the direct pair
    try {
      const directResult = await this.fetchOHLCV({
        network: normalizedNetwork,
        baseToken: processedFromToken,
        quoteToken: processedToToken,
        interval,
        intervalIn
      })
      
      if (directResult.length > 0) {
        logger.info('Direct pair fetch successful', { dataPoints: directResult.length })
        return directResult
      }
    } catch (error) {
      logger.warn('Direct pair fetch failed, trying detection', { error: error instanceof Error ? error.message : 'Unknown error' })
    }

    // If direct fails, try auto-detection
    const detectedPair = this.detectTokenPairFromAddresses(processedFromToken, processedToToken, normalizedNetwork)
    if (detectedPair) {
      try {
        const detectedResult = await this.fetchOHLCV({
          network: normalizedNetwork,
          baseToken: detectedPair.baseToken,
          quoteToken: detectedPair.quoteToken,
          interval,
          intervalIn
        })
        
        if (detectedResult.length > 0) {
          logger.info('Detected pair fetch successful', { dataPoints: detectedResult.length })
          return detectedResult
        }
      } catch (error) {
        logger.warn('Detected pair fetch failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Final fallback: try to find a quote token for the base token
    const bestQuoteToken = this.getBestQuotePairForNetwork(processedFromToken, normalizedNetwork)
    if (bestQuoteToken) {
      try {
        const fallbackResult = await this.fetchOHLCV({
          network: normalizedNetwork,
          baseToken: processedFromToken,
          quoteToken: bestQuoteToken,
          interval,
          intervalIn
        })
        
        if (fallbackResult.length > 0) {
          logger.info('Fallback quote pair fetch successful', { dataPoints: fallbackResult.length })
          return fallbackResult
        }
      } catch (error) {
        logger.warn('Best quote pair fetch failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return []
  }
}

// Export singleton instance
export const bitqueryService = new BitqueryService() 