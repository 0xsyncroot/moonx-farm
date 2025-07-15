'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { coreApi } from '@/lib/api-client'

// Types for trade data
interface Trade {
  id: string
  txHash: string
  timestamp: string
  type: 'swap' | 'buy' | 'sell'
  chainId: number
  fromToken: {
    address: string
    symbol: string
    name: string
    decimals: number
    amount: string
    amountFormatted: number
    priceUSD: number
    valueUSD: number
  }
  toToken: {
    address: string
    symbol: string
    name: string
    decimals: number
    amount: string
    amountFormatted: number
    priceUSD: number
    valueUSD: number
  }
  gasFeeUSD: number
  gasFeeETH?: number
  protocolFeeUSD?: number
  slippage?: number
  priceImpact?: number
  dexName?: string
  platform?: string
  aggregator?: string
  pnl?: {
    netPnlUSD: number
    realizedPnlUSD: number
    unrealizedPnlUSD: number
    feesPaidUSD: number
  }
  profitLoss?: number
  valueUSD?: number
}

// Cache for trade data
const tradesCache = {
  data: null as Trade[] | null,
  timestamp: 0,
  promises: {} as Record<string, Promise<any>>,
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache for trades

export function useTradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Error tracking for backoff
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef(0)
  
  // Use ref to store latest function to avoid dependency issues
  const loadTradesDataRef = useRef<((force?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    setMounted(true)
    console.log('🔄 Trade History mounted')
  }, [])

  // Check cache validity
  const isCacheValid = useCallback(() => {
    if (!tradesCache.timestamp) return false
    return Date.now() - tradesCache.timestamp < CACHE_TTL
  }, [])

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(() => {
    const baseDelay = 60 * 1000 // 1 minute
    const maxDelay = 15 * 60 * 1000 // 15 minutes
    const delay = Math.min(baseDelay * Math.pow(2, errorCountRef.current), maxDelay)
    return delay
  }, [])

  // Fetch trade history
  const fetchTradeHistory = useCallback(async () => {
    const cacheKey = 'recent-trades'
    
    if (cacheKey in tradesCache.promises) {
      return tradesCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('📈 Fetching trade history...')
        
        const response = await coreApi.getRecentTrades({ 
          limit: 50, 
          days: 180 
        })
        
        console.log('📈 Trade history response:', response)
        
        if (response.success) {
          let trades: Trade[] = []
          
          if (!response.data || !response.data.trades) {
            console.log('📈 No trades data available')
            return []
          }
          
          if (Array.isArray(response.data.trades)) {
            trades = response.data.trades
          } else {
            console.warn('📈 Unexpected trades response structure:', response.data)
            return []
          }
          
          console.log('📈 Trades result:', trades)
          return trades
        }
        
        console.warn('Recent trades API failed:', response.message || 'Unknown error')
        return []
      } catch (error) {
        console.error('❌ Trade history fetch error:', error)
        return []
      } finally {
        delete tradesCache.promises[cacheKey]
      }
    })()

    tradesCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Load trades data
  const loadTradesData = useCallback(async (force = false) => {
    // Skip if there's a recent error and we're within backoff period
    if (!force && errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping trades refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return
      }
    }

    try {
      console.log('🚀 Loading trade history data...', { force })
      
      // Check cache first
      if (!force && isCacheValid() && tradesCache.data) {
        console.log('📦 Using cached trades data')
        setTrades(tradesCache.data)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const tradesData = await fetchTradeHistory()

      console.log('✅ Trades data loaded successfully:', tradesData)

      // Update cache BEFORE setting state
      tradesCache.data = tradesData
      tradesCache.timestamp = Date.now()

      setTrades(tradesData)
      
      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0
      
    } catch (error) {
      console.error('❌ Failed to load trades data:', error)
      
      // Increment error count and track time
      errorCountRef.current += 1
      lastErrorTimeRef.current = Date.now()
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trades data'
      setError(errorMessage)
      
      // Fallback to cached data if available
      if (tradesCache.data) {
        console.log('📦 Falling back to cached trades data')
        setTrades(tradesCache.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [getBackoffDelay, isCacheValid, fetchTradeHistory])

  // Store latest loadTradesData function in ref
  useEffect(() => {
    loadTradesDataRef.current = loadTradesData
  }, [loadTradesData])

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      
      // Reset error count for manual refresh
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      if (loadTradesDataRef.current) {
        await loadTradesDataRef.current(true)
      }
    } catch (error) {
      console.error('Failed to refresh trades data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh trades data'
      setError(errorMessage)
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    if (mounted && loadTradesDataRef.current) {
      loadTradesDataRef.current(false)
    }
  }, [mounted])

  // Auto-refresh every 10 minutes (less frequent for trades)
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      if (!isLoading && !refreshing && loadTradesDataRef.current) {
        loadTradesDataRef.current(false)
      }
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing])

  return {
    // Data
    trades,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshData,
    
    // Cache info
    lastUpdated: tradesCache.timestamp,
    cacheAge: tradesCache.timestamp ? Date.now() - tradesCache.timestamp : 0,
  }
} 