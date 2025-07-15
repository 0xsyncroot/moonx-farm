'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { coreApi } from '@/lib/api-client'

// Types for portfolio overview data
interface PortfolioOverviewData {
  totalValue: number
  totalChange: number
  totalChangePercent: number
  totalInvested: number
  unrealizedPnL: number
  realizedPnL: number
  topHoldings: {
    tokenSymbol: string
    tokenName?: string
    valueUSD: number
    allocation?: number
  }[]
  totalHoldings: number
  lastUpdated: number
}

// Cache for overview data
const overviewCache = {
  data: null as PortfolioOverviewData | null,
  timestamp: 0,
  promises: {} as Record<string, Promise<any>>,
}

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes cache

export function usePortfolioOverview() {
  const [overviewData, setOverviewData] = useState<PortfolioOverviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Error tracking for backoff
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef(0)
  
  // Use ref to store latest function to avoid dependency issues
  const loadOverviewDataRef = useRef<((force?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    setMounted(true)
    console.log('🔄 Portfolio Overview mounted')
  }, [])

  // Check cache validity
  const isCacheValid = useCallback(() => {
    if (!overviewCache.timestamp) return false
    return Date.now() - overviewCache.timestamp < CACHE_TTL
  }, [])

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(() => {
    const baseDelay = 30 * 1000 // 30 seconds
    const maxDelay = 5 * 60 * 1000 // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, errorCountRef.current), maxDelay)
    return delay
  }, [])

  // Fetch quick portfolio data
  const fetchQuickPortfolio = useCallback(async () => {
    const cacheKey = 'quick-portfolio'
    
    if (cacheKey in overviewCache.promises) {
      return overviewCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('📊 Fetching quick portfolio...')
        
        const response = await coreApi.getQuickPortfolio()
        console.log('📊 Quick portfolio response:', response)

        if (response.success) {
          const data = response.data
          return {
            totalValueUSD: data.totalValueUSD || 0,
            topHoldings: data.topHoldings || [],
            lastSynced: data.lastSynced
          }
        }
        
        console.warn('Quick portfolio API failed:', response.message || 'Unknown error')
        return {
          totalValueUSD: 0,
          topHoldings: [],
          lastSynced: null
        }
      } catch (error) {
        console.error('❌ Quick portfolio fetch error:', error)
        return {
          totalValueUSD: 0,
          topHoldings: [],
          lastSynced: null
        }
      } finally {
        delete overviewCache.promises[cacheKey]
      }
    })()

    overviewCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Fetch P&L data for daily performance
  const fetchPnLData = useCallback(async () => {
    const cacheKey = 'pnl-24h'
    
    if (cacheKey in overviewCache.promises) {
      return overviewCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('📈 Fetching P&L data for overview...')
        
        const response = await coreApi.getPortfolioPnL({ timeframe: '24h' })
        console.log('📈 P&L response:', response)
        
        if (response.success) {
          const data = response.data
          return {
            realizedPnlUSD: data.realizedPnlUSD || 0,
            unrealizedPnlUSD: data.unrealizedPnlUSD || 0,
            netPnlUSD: data.netPnlUSD || 0,
            portfolioChangePercent: data.portfolioChangePercent || 0,
            currentPortfolioValueUSD: data.currentPortfolioValueUSD || 0
          }
        }
        
        console.warn('P&L API failed:', response.message || 'Unknown error')
        return {
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          netPnlUSD: 0,
          portfolioChangePercent: 0,
          currentPortfolioValueUSD: 0
        }
      } catch (error) {
        console.error('❌ P&L data fetch error:', error)
        return {
          realizedPnlUSD: 0,
          unrealizedPnlUSD: 0,
          netPnlUSD: 0,
          portfolioChangePercent: 0,
          currentPortfolioValueUSD: 0
        }
      } finally {
        delete overviewCache.promises[cacheKey]
      }
    })()

    overviewCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Load overview data (optimized)
  const loadOverviewData = useCallback(async (force = false) => {
    // Skip if there's a recent error and we're within backoff period
    if (!force && errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping overview refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return
      }
    }

    try {
      console.log('🚀 Loading portfolio overview data...', { force })
      
      // Check cache first (only if not forced)
      if (!force && isCacheValid() && overviewCache.data) {
        console.log('📦 Using cached overview data')
        setOverviewData(overviewCache.data)
        setIsLoading(false)
        return
      }

      // Clear cache if forced refresh
      if (force) {
        console.log('🔄 Force refresh - clearing cache')
        overviewCache.data = null
        overviewCache.timestamp = 0
      }

      setIsLoading(true)
      setError(null)

      // Fetch both quick portfolio and P&L data in parallel
      const [quickPortfolioResult, pnlResult] = await Promise.allSettled([
        fetchQuickPortfolio(),
        fetchPnLData()
      ])

      // Extract results with fallback values
      let quickData = {
        totalValueUSD: 0,
        topHoldings: [],
        lastSynced: null
      }
      
      let pnlData = {
        realizedPnlUSD: 0,
        unrealizedPnlUSD: 0,
        netPnlUSD: 0,
        portfolioChangePercent: 0,
        currentPortfolioValueUSD: 0
      }
      
      if (quickPortfolioResult.status === 'fulfilled') {
        quickData = quickPortfolioResult.value
      } else {
        console.error('Quick portfolio failed:', quickPortfolioResult.reason)
      }
      
      if (pnlResult.status === 'fulfilled') {
        pnlData = pnlResult.value
      } else {
        console.error('P&L data failed:', pnlResult.reason)
      }

      // Combine data
      const totalValue = quickData.totalValueUSD || pnlData.currentPortfolioValueUSD || 0
      const totalInvested = Math.max(0, totalValue - pnlData.netPnlUSD)
      
      const newData: PortfolioOverviewData = {
        totalValue,
        totalChange: pnlData.netPnlUSD,
        totalChangePercent: pnlData.portfolioChangePercent,
        totalInvested,
        unrealizedPnL: pnlData.unrealizedPnlUSD,
        realizedPnL: pnlData.realizedPnlUSD,
        topHoldings: quickData.topHoldings,
        totalHoldings: quickData.topHoldings.length,
        lastUpdated: Date.now()
      }

      console.log('✅ Overview data loaded successfully:', newData)

      // Update cache BEFORE setting state
      overviewCache.data = newData
      overviewCache.timestamp = Date.now()

      setOverviewData(newData)
      
      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0
      
    } catch (error) {
      console.error('❌ Failed to load overview data:', error)
      
      // Increment error count and track time
      errorCountRef.current += 1
      lastErrorTimeRef.current = Date.now()
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load overview data'
      setError(errorMessage)
      
      // Fallback to cached data if available
      if (overviewCache.data) {
        console.log('📦 Falling back to cached overview data')
        setOverviewData(overviewCache.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [getBackoffDelay, isCacheValid, fetchQuickPortfolio, fetchPnLData])

  // Store latest loadOverviewData function in ref
  useEffect(() => {
    loadOverviewDataRef.current = loadOverviewData
  }, [loadOverviewData])

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      
      // Reset error count for manual refresh
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      // Clear cache and force refresh
      console.log('🔄 Manual refresh initiated - clearing cache...')
      overviewCache.data = null
      overviewCache.timestamp = 0
      
      // Clear all pending promises to prevent stale data
      Object.keys(overviewCache.promises).forEach(key => {
        delete overviewCache.promises[key]
      })

      if (loadOverviewDataRef.current) {
        await loadOverviewDataRef.current(true)
      }
    } catch (error) {
      console.error('Failed to refresh overview data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh overview data'
      setError(errorMessage)
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    if (mounted && loadOverviewDataRef.current) {
      loadOverviewDataRef.current(false)
    }
  }, [mounted])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      if (!isLoading && !refreshing && loadOverviewDataRef.current) {
        loadOverviewDataRef.current(false)
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing])

  return {
    // Data
    overview: overviewData,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshData,
    
    // Computed data for compatibility
    computedData: overviewData ? {
      topHoldings: overviewData.topHoldings,
      totalHoldings: overviewData.totalHoldings,
      performance: {
        totalReturn: overviewData.totalValue > 0 ? (overviewData.totalChange / overviewData.totalValue) * 100 : 0,
        isPositive: overviewData.totalChange >= 0,
        dayChange: overviewData.totalChangePercent
      }
    } : null,
    
    // Cache info
    lastUpdated: overviewData?.lastUpdated || 0,
    cacheAge: overviewData ? Date.now() - overviewData.lastUpdated : 0,
  }
} 