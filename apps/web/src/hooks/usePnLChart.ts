'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { coreApi } from '@/lib/api-client'

// Types for P&L data
interface PnLData {
  netPnlUSD: number
  realizedPnlUSD: number
  unrealizedPnlUSD: number
  totalTrades: number
  profitableTrades: number
  winRate: number
  totalFeesUSD: number
  avgTradeSize: number
  biggestWinUSD: number
  biggestLossUSD: number
  portfolioChangePercent: number
  currentPortfolioValueUSD: number
  timeframe: string
}

// Cache for P&L data by timeframe
const pnlCache = {
  data: {} as Record<string, PnLData>,
  timestamps: {} as Record<string, number>,
  promises: {} as Record<string, Promise<any>>,
}

const CACHE_TTL = 3 * 60 * 1000 // 3 minutes cache for P&L data

export function usePnLChart() {
  const [pnlData, setPnlData] = useState<Record<string, PnLData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Error tracking for backoff
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef(0)

  useEffect(() => {
    setMounted(true)
    console.log('🔄 P&L Chart mounted')
  }, [])

  // Check cache validity for specific timeframe
  const isCacheValid = useCallback((timeframe: string) => {
    if (!pnlCache.timestamps[timeframe]) return false
    return Date.now() - pnlCache.timestamps[timeframe] < CACHE_TTL
  }, [])

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(() => {
    const baseDelay = 45 * 1000 // 45 seconds
    const maxDelay = 10 * 60 * 1000 // 10 minutes
    const delay = Math.min(baseDelay * Math.pow(2, errorCountRef.current), maxDelay)
    return delay
  }, [])

  // Fetch P&L data for specific timeframe
  const fetchPnLData = useCallback(async (timeframe: string) => {
    const cacheKey = `pnl-${timeframe}`
    
    if (cacheKey in pnlCache.promises) {
      return pnlCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log(`📈 Fetching P&L data for ${timeframe}...`)
        
        const response = await coreApi.getPortfolioPnL({ timeframe })
        console.log(`📈 P&L ${timeframe} response:`, response)
        
        if (response.success) {
          const data = response.data
          const pnlResult: PnLData = {
            netPnlUSD: data.netPnlUSD || 0,
            realizedPnlUSD: data.realizedPnlUSD || 0,
            unrealizedPnlUSD: data.unrealizedPnlUSD || 0,
            totalTrades: data.totalTrades || 0,
            profitableTrades: data.profitableTrades || 0,
            winRate: data.winRate || 0,
            totalFeesUSD: data.totalFeesUSD || 0,
            avgTradeSize: data.avgTradeSize || 0,
            biggestWinUSD: data.biggestWinUSD || 0,
            biggestLossUSD: data.biggestLossUSD || 0,
            portfolioChangePercent: data.portfolioChangePercent || 0,
            currentPortfolioValueUSD: data.currentPortfolioValueUSD || 0,
            timeframe
          }
          
          return pnlResult
        }
        
        console.warn(`P&L API failed for ${timeframe}:`, response.message || 'Unknown error')
        return {
          netPnlUSD: 0,
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          totalTrades: 0,
          profitableTrades: 0,
          winRate: 0,
          totalFeesUSD: 0,
          avgTradeSize: 0,
          biggestWinUSD: 0,
          biggestLossUSD: 0,
          portfolioChangePercent: 0,
          currentPortfolioValueUSD: 0,
          timeframe
        }
      } catch (error) {
        console.error(`❌ P&L ${timeframe} fetch error:`, error)
        return {
          netPnlUSD: 0,
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          totalTrades: 0,
          profitableTrades: 0,
          winRate: 0,
          totalFeesUSD: 0,
          avgTradeSize: 0,
          biggestWinUSD: 0,
          biggestLossUSD: 0,
          portfolioChangePercent: 0,
          currentPortfolioValueUSD: 0,
          timeframe
        }
      } finally {
        delete pnlCache.promises[cacheKey]
      }
    })()

    pnlCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Get P&L data for specific timeframe
  const getPnLData = useCallback(async (timeframe: string) => {
    // Skip if there's a recent error and we're within backoff period
    if (errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping P&L ${timeframe} refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return pnlCache.data[timeframe] || null
      }
    }

    try {
      // Check cache first
      if (isCacheValid(timeframe) && pnlCache.data[timeframe]) {
        console.log(`📦 Using cached P&L data for ${timeframe}`)
        return pnlCache.data[timeframe]
      }

      setIsLoading(true)
      setError(null)

      const pnlResult = await fetchPnLData(timeframe)

      // Update cache
      pnlCache.data[timeframe] = pnlResult
      pnlCache.timestamps[timeframe] = Date.now()

      // Update state
      setPnlData(prev => ({
        ...prev,
        [timeframe]: pnlResult
      }))

      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      return pnlResult
    } catch (error) {
      console.error(`❌ Failed to get P&L data for ${timeframe}:`, error)
      
      // Increment error count and track time
      errorCountRef.current += 1
      lastErrorTimeRef.current = Date.now()
      
      const errorMessage = error instanceof Error ? error.message : `Failed to load P&L data for ${timeframe}`
      setError(errorMessage)
      
      // Return cached data if available
      return pnlCache.data[timeframe] || null
    } finally {
      setIsLoading(false)
    }
  }, [getBackoffDelay, isCacheValid, fetchPnLData])

  // Load initial P&L data for default timeframe
  const loadInitialData = useCallback(async () => {
    if (!mounted) return
    
    try {
      console.log('🚀 Loading initial P&L data...')
      
      // Load 30d data by default
      await getPnLData('30d')
      
    } catch (error) {
      console.error('❌ Failed to load initial P&L data:', error)
    }
  }, [mounted, getPnLData])

  // Refresh all cached data
  const refreshAllData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      
      // Reset error count for manual refresh
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      // Clear cache
      pnlCache.data = {}
      pnlCache.timestamps = {}

      // Refresh all timeframes that were previously loaded
      const loadedTimeframes = Object.keys(pnlData)
      if (loadedTimeframes.length === 0) {
        // Load default timeframe if none were loaded
        await getPnLData('30d')
      } else {
        // Refresh all previously loaded timeframes
        for (const timeframe of loadedTimeframes) {
          await getPnLData(timeframe)
        }
      }
    } catch (error) {
      console.error('Failed to refresh P&L data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh P&L data'
      setError(errorMessage)
    } finally {
      setRefreshing(false)
    }
  }, [pnlData, getPnLData])

  // Load initial data on mount
  useEffect(() => {
    if (mounted) {
      loadInitialData()
    }
  }, [mounted, loadInitialData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      if (!isLoading && !refreshing) {
        // Only refresh timeframes that were previously loaded
        const loadedTimeframes = Object.keys(pnlData)
        loadedTimeframes.forEach(timeframe => {
          if (!isCacheValid(timeframe)) {
            getPnLData(timeframe)
          }
        })
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing, pnlData, isCacheValid, getPnLData])

  return {
    // Data
    pnlData,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshAllData,
    getPnLData,
    
    // Cache info
    lastUpdated: Math.max(...Object.values(pnlCache.timestamps).filter(Boolean)),
    cacheAge: Math.max(...Object.values(pnlCache.timestamps).filter(Boolean).map(t => Date.now() - t)),
  }
} 