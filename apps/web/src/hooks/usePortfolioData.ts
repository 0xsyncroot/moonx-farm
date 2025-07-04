'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

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
        
        throw new Error(`Portfolio API failed: ${portfolioResponse.message || 'Unknown error'}`)
      } catch (error) {
        console.error('❌ Portfolio overview fetch error:', error)
        throw error
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
        
        const response = await coreApi.getPortfolio({ 
          includeSpam: false, 
          minValueUSD: 1 
        })
        
        console.log('💼 Holdings response:', response)
        
        if (response.success) {
          // Handle different response structures according to README.md
          let holdings: TokenHolding[] = []
          
          if (response.data.portfolio?.holdings) {
            holdings = response.data.portfolio.holdings
          } else if (response.data.holdings) {
            holdings = response.data.holdings
          } else if (Array.isArray(response.data)) {
            holdings = response.data
          }
          
          // Calculate total value for allocation calculation
          const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUSD, 0)
          
          // Add allocation percentage to each holding
          const holdingsWithAllocation = holdings.map(holding => ({
            ...holding,
            allocation: totalValue > 0 ? (holding.valueUSD / totalValue) * 100 : 0
          }))
          
          console.log('💼 Holdings result:', holdingsWithAllocation)
          return holdingsWithAllocation
        }
        
        throw new Error(`Portfolio API failed: ${response.message || 'Unknown error'}`)
      } catch (error) {
        console.error('❌ Token holdings fetch error:', error)
        throw error
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
        
        throw new Error(`PnL API failed: ${response.message || 'Unknown error'}`)
      } catch (error) {
        console.error(`❌ P&L data fetch error for ${timeframe}:`, error)
        throw error
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
        
        throw new Error(`Trades API failed: ${response.message || 'Unknown error'}`)
      } catch (error) {
        console.error('❌ Trade history fetch error:', error)
        throw error
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
    if (!force && error && errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return
      }
    }

    try {
      console.log('🚀 Loading portfolio data...', { force })
      setError(null)
      
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

      // Check if any failed
      const [overviewResult, holdingsResult, tradesResult] = basicResults
      
      if (overviewResult.status === 'rejected') {
        throw new Error(`Portfolio overview failed: ${overviewResult.reason}`)
      }
      
      if (holdingsResult.status === 'rejected') {
        throw new Error(`Token holdings failed: ${holdingsResult.reason}`)
      }
      
      if (tradesResult.status === 'rejected') {
        throw new Error(`Trade history failed: ${tradesResult.reason}`)
      }

      // Step 2: Fetch default PnL data separately  
      let defaultPnLData = null
      try {
        defaultPnLData = await fetchPnLData('30d')
      } catch (error) {
        console.warn('Failed to fetch default PnL data:', error)
        // Continue without PnL data rather than failing entire load
      }

      // Step 3: Combine all data
      const baseData = overviewResult.value
      const newData: PortfolioData = {
        ...baseData,
        holdings: holdingsResult.value,
        trades: tradesResult.value,
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
      setError(errorMessage)
      
      // Only show toast for first few errors to avoid spam
      if (errorCountRef.current <= 3) {
        toast.error(errorMessage)
      }
      
      // Fallback to cached data if available
      if (portfolioCache.data) {
        console.log('📦 Falling back to cached data')
        setPortfolioData(portfolioCache.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [error, getBackoffDelay, isCacheValid, fetchPortfolioOverview, fetchTokenHoldings, fetchTradeHistory, fetchPnLData])

  // ✅ Store latest loadPortfolioData function in ref to avoid dependency issues
  useEffect(() => {
    loadPortfolioDataRef.current = loadPortfolioData
  }, [loadPortfolioData])

  // Refresh specific data
  const refreshData = useCallback(async (type: 'all' | 'portfolio' | 'pnl' | 'trades' = 'all') => {
    try {
      setRefreshing(true)
      setError(null)
      
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
      setError('Failed to refresh data')
      toast.error('Failed to refresh data')
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
      toast.error('Failed to load P&L data')
      return null
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
      // Only auto-refresh if not currently loading and no recent errors
      if (!isLoading && !refreshing && (!error || errorCountRef.current === 0) && loadPortfolioDataRef.current) {
        loadPortfolioDataRef.current(false) // Use cache-aware loading
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing, error]) // ✅ Stable dependencies, uses ref for function calls

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