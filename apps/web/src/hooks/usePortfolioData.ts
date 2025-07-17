'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { coreApi } from '@/lib/api-client'

// Types matching Core Service API response format
interface TokenHolding {
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  chainId: number
  balance: string // Raw balance in token units
  balanceFormatted: number // Human readable balance (changed from string to number)
  valueUSD: number
  priceUSD: number
  logoUrl?: string
  isSpam: boolean
  // Computed field
  allocation?: number
}

interface PnLData {
  timeframe: string
  realizedPnlUSD: number
  unrealizedPnlUSD: number
  netPnlUSD: number
  totalFeesUSD: number
  winRate: number
  totalTrades: number
  profitableTrades: number
  currentPortfolioValueUSD: number
  portfolioChangePercent: number
  biggestWinUSD: number
  biggestLossUSD: number
  avgWinUSD?: number
  avgLossUSD?: number
  riskRewardRatio?: number
}

interface Trade {
  id: string
  type: string
  txHash: string
  timestamp: string
  chainId: number
  status: string
  fromToken: {
    symbol: string
    amount: string
    valueUSD: number
  }
  toToken: {
    symbol: string
    amount: string
    valueUSD: number
  }
  gasFeeETH?: number
  gasFeeUSD: number
  dexName: string
  slippage: number
  pnl?: {
    realizedPnlUSD: number
    feesPaidUSD: number
    netPnlUSD: number
  }
}

interface PortfolioData {
  // Overview data
  totalValue: number
  totalChange: number
  totalChangePercent: number
  totalInvested: number
  unrealizedPnL: number
  realizedPnL: number
  
  // Holdings data
  holdings: TokenHolding[]
  
  // PnL data by timeframe
  pnlData: Record<string, PnLData>
  
  // Trade history
  trades: Trade[]
  
  // Meta info
  lastUpdated: number
}

// Global cache with TTL
const portfolioCache = {
  data: null as PortfolioData | null,
  timestamp: 0,
  promises: {} as Record<string, Promise<any>>,
}

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
  portfolio: 2 * 60 * 1000, // 2 minutes
  pnl: 5 * 60 * 1000,      // 5 minutes
  trades: 30 * 60 * 1000,  // 30 minutes
}

export function usePortfolioData() {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Error tracking for backoff
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef(0)
  
  // ✅ Use ref to store latest loadPortfolioData to avoid dependency issues
  const loadPortfolioDataRef = useRef<((force?: boolean) => Promise<void>) | null>(null)

  // Reset cache and force refresh on mount
  useEffect(() => {
    setMounted(true)
    
    console.log('🔄 Portfolio page mounted')
  }, [])

  // Cache validation helper
  const isCacheValid = useCallback((type: keyof typeof CACHE_TTL) => {
    if (!portfolioCache.timestamp) return false
    return Date.now() - portfolioCache.timestamp < CACHE_TTL[type]
  }, [])

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(() => {
    const baseDelay = 30 * 1000 // 30 seconds
    const maxDelay = 5 * 60 * 1000 // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, errorCountRef.current), maxDelay)
    return delay
  }, [])

  // Fetch portfolio overview data
  const fetchPortfolioOverview = useCallback(async () => {
    const cacheKey = 'portfolio-overview'
    
    if (cacheKey in portfolioCache.promises) {
      return portfolioCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('📊 Fetching portfolio overview...')
        
        const portfolioResponse = await coreApi.getQuickPortfolio()

        console.log('📊 Portfolio response:', portfolioResponse)

        if (portfolioResponse.success) {
          const portfolio = portfolioResponse.data

          const result = {
            totalValue: portfolio.totalValueUSD || 0,
            totalChange: 0,
            totalChangePercent: 0,
            totalInvested: portfolio.totalValueUSD || 0,
            unrealizedPnL: 0,
            realizedPnL: 0,
            pnlData: {}
          }
          
          console.log('📊 Portfolio overview result:', result)
          return result
        }
        
        console.warn('Portfolio API failed:', portfolioResponse.message || 'Unknown error')
        // Return fallback data for UI to continue working
        return {
          totalValue: 0,
          totalChange: 0,
          totalChangePercent: 0,
          totalInvested: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          pnlData: {}
        }
      } catch (error) {
        console.error('❌ Portfolio overview fetch error:', error)
        // Return fallback data instead of throwing
        return {
          totalValue: 0,
          totalChange: 0,
          totalChangePercent: 0,
          totalInvested: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          pnlData: {}
        }
      } finally {
        delete portfolioCache.promises[cacheKey]
      }
    })()

    portfolioCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Fetch token holdings
  const fetchTokenHoldings = useCallback(async () => {
    const cacheKey = 'token-holdings'
    
    if (cacheKey in portfolioCache.promises) {
      return portfolioCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('💼 Fetching token holdings...')
        
        const response = await coreApi.getTokenHoldings({ 
          includeSpam: false, 
          includeUnverified: false,
          hideSmallBalances: true, // Hide balances under $1 for cleaner UI
          sortBy: 'value',
          sortOrder: 'desc',
          limit: 500 // Reasonable limit for UI performance
        })
        
        console.log('💼 Holdings response:', response)
        
        if (response.success) {
          // New API returns holdings array directly with allocation already calculated
          let holdings: TokenHolding[] = []
          
          // Handle null response (no portfolio data)
          if (!response.data) {
            console.log('💼 No holdings data available, returning empty holdings')
            return []
          }
          
          if (Array.isArray(response.data)) {
            holdings = response.data
          } else {
            console.warn('💼 Unexpected holdings response structure:', response.data)
            return []
          }
          
          console.log('💼 Holdings result:', holdings)
          return holdings
        }
        
        console.warn('Token holdings API failed:', response.message || 'Unknown error')
        // Return empty holdings for UI to continue working
        return []
      } catch (error) {
        console.error('❌ Token holdings fetch error:', error)
        // Return empty holdings instead of throwing
        return []
      } finally {
        delete portfolioCache.promises[cacheKey]
      }
    })()

    portfolioCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Fetch PnL data for specific timeframe
  const fetchPnLData = useCallback(async (timeframe: string) => {
    const cacheKey = `pnl-${timeframe}`
    
    if (cacheKey in portfolioCache.promises) {
      return portfolioCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log(`📈 Fetching PnL data for ${timeframe}...`)
        
        const response = await coreApi.getPortfolioPnL({ timeframe })
        
        console.log(`📈 PnL ${timeframe} response:`, response)
        
        if (response.success) {
          return response.data
        }
        
        console.warn(`PnL API failed for ${timeframe}:`, response.message || 'Unknown error')
        // Return fallback PnL data for UI to continue working
        return {
          timeframe,
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          netPnlUSD: 0,
          totalFeesUSD: 0,
          winRate: 0,
          totalTrades: 0,
          profitableTrades: 0,
          currentPortfolioValueUSD: 0,
          portfolioChangePercent: 0,
          biggestWinUSD: 0,
          biggestLossUSD: 0
        }
      } catch (error) {
        console.error(`❌ P&L data fetch error for ${timeframe}:`, error)
        // Return fallback PnL data instead of throwing
        return {
          timeframe,
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          netPnlUSD: 0,
          totalFeesUSD: 0,
          winRate: 0,
          totalTrades: 0,
          profitableTrades: 0,
          currentPortfolioValueUSD: 0,
          portfolioChangePercent: 0,
          biggestWinUSD: 0,
          biggestLossUSD: 0
        }
      } finally {
        delete portfolioCache.promises[cacheKey]
      }
    })()

    portfolioCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Fetch trade history
  const fetchTradeHistory = useCallback(async (options: { limit?: number; days?: number } = {}) => {
    const cacheKey = `trades-${options.limit || 20}-${options.days || 30}`
    
    if (cacheKey in portfolioCache.promises) {
      return portfolioCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('📈 Fetching trade history...', options)
        
        const response = await coreApi.getRecentTrades({ 
          limit: options.limit || 20, 
          days: options.days || 30 
        })
        
        console.log('📈 Trades response:', response)
        
        if (response.success) {
          const trades = response.data.trades || []
          console.log('📈 Trades result:', trades)
          return trades
        }
        
        console.warn('Trades API failed:', response.message || 'Unknown error')
        // Return empty trades for UI to continue working
        return []
      } catch (error) {
        console.error('❌ Trade history fetch error:', error)
        // Return empty trades instead of throwing
        return []
      } finally {
        delete portfolioCache.promises[cacheKey]
      }
    })()

    portfolioCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Load all portfolio data
  const loadPortfolioData = useCallback(async (force = false) => {
    // Skip if there's a recent error and we're within backoff period
    if (!force && errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return
      }
    }

    try {
      console.log('🚀 Loading portfolio data...', { force })
      // Don't set error state to prevent UI from showing errors
      
      // Check cache first
      if (!force && isCacheValid('portfolio') && portfolioCache.data) {
        console.log('📦 Using cached portfolio data')
        setPortfolioData(portfolioCache.data)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      // Fetch data sequentially to control PnL calls
      // Step 1: Fetch basic data in parallel
      const basicResults = await Promise.allSettled([
        fetchPortfolioOverview(),
        fetchTokenHoldings(),
        fetchTradeHistory()
      ])

      console.log('🔄 Basic fetch results:', basicResults)

      // Extract results with fallback values
      const [overviewResult, holdingsResult, tradesResult] = basicResults
      
      let overviewData: any = {
        totalValue: 0,
        totalChange: 0,
        totalChangePercent: 0,
        totalInvested: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        pnlData: {}
      }
      
      let holdingsData: any[] = []
      let tradesData: any[] = []
      
      if (overviewResult.status === 'fulfilled') {
        overviewData = (overviewResult as any).value
      }
      
      if (holdingsResult.status === 'fulfilled') {
        holdingsData = (holdingsResult as any).value
      }
      
      if (tradesResult.status === 'fulfilled') {
        tradesData = (tradesResult as any).value
      }
      
      // Log any failures but continue with fallback data
      if (overviewResult.status === 'rejected') {
        console.error('Portfolio overview failed:', overviewResult.reason)
      }
      if (holdingsResult.status === 'rejected') {
        console.error('Token holdings failed:', holdingsResult.reason)
      }
      if (tradesResult.status === 'rejected') {
        console.error('Trade history failed:', tradesResult.reason)
      }

      // Step 2: Fetch default PnL data separately  
      let defaultPnLData = null
      try {
        defaultPnLData = await fetchPnLData('30d')
      } catch (error) {
        console.warn('Failed to fetch default PnL data:', error)
        // Continue without PnL data rather than failing entire load
        defaultPnLData = {
          timeframe: '30d',
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          netPnlUSD: 0,
          totalFeesUSD: 0,
          winRate: 0,
          totalTrades: 0,
          profitableTrades: 0,
          currentPortfolioValueUSD: 0,
          portfolioChangePercent: 0,
          biggestWinUSD: 0,
          biggestLossUSD: 0
        }
      }

      // Step 3: Combine all data
      const baseData = overviewData
      const newData: PortfolioData = {
        ...baseData,
        holdings: holdingsData,
        trades: tradesData,
        lastUpdated: Date.now(),
        totalChange: defaultPnLData?.netPnlUSD || 0,
        totalChangePercent: defaultPnLData?.portfolioChangePercent || 0,
        unrealizedPnL: defaultPnLData?.unrealizedPnlUSD || 0,
        realizedPnL: defaultPnLData?.realizedPnlUSD || 0,
        totalInvested: Math.max(0, (baseData.totalValue || 0) - (defaultPnLData?.netPnlUSD || 0)),
        pnlData: defaultPnLData ? { '30d': defaultPnLData } : {}
      }

      console.log('✅ New portfolio data:', newData)
      console.log('📊 PnL data available for timeframes:', Object.keys(newData.pnlData))

      // Update cache BEFORE setting state to prevent race conditions
      portfolioCache.data = newData
      portfolioCache.timestamp = Date.now()

      setPortfolioData(newData)
      
      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0
      
      console.log('✅ Portfolio data loaded successfully')
      
    } catch (error) {
      console.error('❌ Failed to load portfolio data:', error)
      
      // Increment error count and track time
      errorCountRef.current += 1
      lastErrorTimeRef.current = Date.now()
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load portfolio data'
      
      // Errors are logged to console for debugging only
      // Don't set error state to prevent UI from showing error messages
      
      // Fallback to cached data if available, or set empty data
      if (portfolioCache.data) {
        console.log('📦 Falling back to cached data')
        setPortfolioData(portfolioCache.data)
      } else {
        // Set empty data structure so UI can still render
        const emptyData: PortfolioData = {
          totalValue: 0,
          totalChange: 0,
          totalChangePercent: 0,
          totalInvested: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          holdings: [],
          trades: [],
          pnlData: {},
          lastUpdated: Date.now()
        }
        setPortfolioData(emptyData)
        console.log('📦 Set empty data structure for UI')
      }
    } finally {
      setIsLoading(false)
    }
  }, [getBackoffDelay, isCacheValid, fetchPortfolioOverview, fetchTokenHoldings, fetchTradeHistory, fetchPnLData])

  // ✅ Store latest loadPortfolioData function in ref to avoid dependency issues
  useEffect(() => {
    loadPortfolioDataRef.current = loadPortfolioData
  }, [loadPortfolioData])

  // Refresh specific data
  const refreshData = useCallback(async (type: 'all' | 'portfolio' | 'pnl' | 'trades' = 'all') => {
    try {
      setRefreshing(true)
      // Don't set error state to prevent UI from showing errors
      
      // Reset error count for manual refresh
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      // ✅ Use ref to get latest loadPortfolioData function
      if (loadPortfolioDataRef.current) {
        if (type === 'all') {
          await loadPortfolioDataRef.current(true)
        } else {
          // Refresh specific data type
          await loadPortfolioDataRef.current(true)
        }
      }
    } catch (error) {
      console.error('Failed to refresh data:', error)
      // Errors are logged to console for debugging only
      // Don't set error state to prevent UI from showing error
    } finally {
      setRefreshing(false)
    }
  }, []) // ✅ No dependencies - uses ref for stable access

  // Get PnL data for specific timeframe
  const getPnLData = useCallback(async (timeframe: string) => {
    // Check if we already have this data in cache
    if (portfolioData?.pnlData[timeframe]) {
      console.log(`📊 Using cached P&L data for ${timeframe}`)
      return portfolioData.pnlData[timeframe]
    }

    // Check if we're already fetching this timeframe
    const cacheKey = `pnl-${timeframe}`
    if (cacheKey in portfolioCache.promises) {
      console.log(`📊 Reusing existing P&L request for ${timeframe}`)
      return portfolioCache.promises[cacheKey]
    }

    try {
      console.log(`📊 Fetching new P&L data for ${timeframe}`)
      const pnlData = await fetchPnLData(timeframe)
      
      // Update cache without triggering state update to prevent infinite calls
      if (portfolioCache.data) {
        portfolioCache.data.pnlData[timeframe] = pnlData
        // Only update state if component is still mounted and data is current
        setPortfolioData(prev => prev ? { 
          ...prev, 
          pnlData: { ...prev.pnlData, [timeframe]: pnlData } 
        } : prev)
      }
      
      return pnlData
    } catch (error) {
      console.error('Failed to get P&L data:', error)
      // Return fallback data so UI can continue working
      return {
        timeframe,
        realizedPnlUSD: 0,
        unrealizedPnlUSD: 0,
        netPnlUSD: 0,
        totalFeesUSD: 0,
        winRate: 0,
        totalTrades: 0,
        profitableTrades: 0,
        currentPortfolioValueUSD: 0,
        portfolioChangePercent: 0,
        biggestWinUSD: 0,
        biggestLossUSD: 0
      }
    }
  }, [portfolioData?.pnlData, fetchPnLData])

  // Computed values
  const computedData = useMemo(() => {
    if (!portfolioData) return null

    const { holdings, trades } = portfolioData
    
    return {
      topHoldings: holdings.slice(0, 5),
      totalHoldings: holdings.length,
      recentTrades: trades.slice(0, 5),
      totalTrades: trades.length,
      holdingsAllocation: holdings.map(holding => ({
        ...holding,
        allocation: holding.allocation || 0
      })).sort((a, b) => b.allocation - a.allocation),
      performance: {
        dayChange: portfolioData.totalChangePercent,
        isPositive: portfolioData.totalChange >= 0,
        totalReturn: portfolioData.totalValue > 0 ? (portfolioData.totalChange / portfolioData.totalValue) * 100 : 0
      }
    }
  }, [portfolioData])

  // Load data on mount with stable dependency
  useEffect(() => {
    if (mounted && loadPortfolioDataRef.current) {
      // Use cache-aware loading instead of forced refresh
      loadPortfolioDataRef.current(false)
    }
  }, [mounted]) // ✅ No loadPortfolioData dependency - uses ref

  // Simplified auto-refresh with stable dependencies  
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      // Only auto-refresh if not currently loading
      if (!isLoading && !refreshing && loadPortfolioDataRef.current) {
        loadPortfolioDataRef.current(false) // Use cache-aware loading
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing]) // ✅ Stable dependencies, uses ref for function calls

  return {
    // Data
    portfolioData,
    computedData,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshData,
    getPnLData,
    
    // Derived data for specific components
    overview: portfolioData ? {
      totalValue: portfolioData.totalValue,
      totalChange: portfolioData.totalChange,
      totalChangePercent: portfolioData.totalChangePercent,
      totalInvested: portfolioData.totalInvested,
      unrealizedPnL: portfolioData.unrealizedPnL,
      realizedPnL: portfolioData.realizedPnL,
    } : null,
    
    holdings: portfolioData?.holdings || [],
    trades: portfolioData?.trades || [],
    pnlData: portfolioData?.pnlData || {},
    
    // Cache info
    lastUpdated: portfolioData?.lastUpdated || 0,
    cacheAge: portfolioData ? Date.now() - portfolioData.lastUpdated : 0,
  }
} 