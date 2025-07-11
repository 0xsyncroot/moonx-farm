'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { coreApi } from '@/lib/api-client'

// Types for token holdings
interface TokenHolding {
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  chainId: number
  balance: string
  balanceFormatted: number
  valueUSD: number
  priceUSD: number
  logoUrl?: string
  isSpam: boolean
  allocation?: number
}

// Cache for holdings data
const holdingsCache = {
  data: null as TokenHolding[] | null,
  timestamp: 0,
  promises: {} as Record<string, Promise<any>>,
}

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes cache

export function useTokenHoldings() {
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Error tracking for backoff
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef(0)
  
  // Use ref to store latest function to avoid dependency issues
  const loadHoldingsDataRef = useRef<((force?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    setMounted(true)
    console.log('🔄 Token Holdings mounted')
  }, [])

  // Check cache validity
  const isCacheValid = useCallback(() => {
    if (!holdingsCache.timestamp) return false
    return Date.now() - holdingsCache.timestamp < CACHE_TTL
  }, [])

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(() => {
    const baseDelay = 30 * 1000 // 30 seconds
    const maxDelay = 5 * 60 * 1000 // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, errorCountRef.current), maxDelay)
    return delay
  }, [])

  // Fetch token holdings
  const fetchTokenHoldings = useCallback(async () => {
    const cacheKey = 'token-holdings'
    
    if (cacheKey in holdingsCache.promises) {
      return holdingsCache.promises[cacheKey]
    }

    const promise = (async () => {
      try {
        console.log('💼 Fetching token holdings...')
        
        const response = await coreApi.getTokenHoldings({ 
          includeSpam: false, 
          minValueUSD: 0
        })
        
        console.log('💼 Holdings response:', response)
        
        if (response.success) {
          let holdings: TokenHolding[] = []
          
          if (!response.data) {
            console.log('💼 No holdings data available')
            return []
          }
          
          // Backend returns array directly as response.data
          if (Array.isArray(response.data)) {
            holdings = response.data
          } else {
            console.warn('💼 Unexpected holdings response structure:', response.data)
            console.warn('💼 Expected array, got:', typeof response.data)
            return []
          }
          
          console.log('💼 Holdings result:', { count: holdings.length, holdings })
          return holdings
        }
        
        console.warn('Token holdings API failed:', response.message || 'Unknown error')
        return []
      } catch (error) {
        console.error('❌ Token holdings fetch error:', error)
        return []
      } finally {
        delete holdingsCache.promises[cacheKey]
      }
    })()

    holdingsCache.promises[cacheKey] = promise
    return promise
  }, [])

  // Load holdings data
  const loadHoldingsData = useCallback(async (force = false) => {
    // Skip if there's a recent error and we're within backoff period
    if (!force && errorCountRef.current > 0) {
      const timeSinceError = Date.now() - lastErrorTimeRef.current
      const backoffDelay = getBackoffDelay()
      if (timeSinceError < backoffDelay) {
        console.log(`⏳ Skipping holdings refresh due to backoff. Retry in ${Math.ceil((backoffDelay - timeSinceError) / 1000)}s`)
        return
      }
    }

    try {
      console.log('🚀 Loading token holdings data...', { force })
      
      // Check cache first
      if (!force && isCacheValid() && holdingsCache.data) {
        console.log('📦 Using cached holdings data')
        setHoldings(holdingsCache.data)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const holdingsData = await fetchTokenHoldings()

      console.log('✅ Holdings data loaded successfully:', holdingsData)

      // Update cache BEFORE setting state
      holdingsCache.data = holdingsData
      holdingsCache.timestamp = Date.now()

      setHoldings(holdingsData)
      
      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0
      
    } catch (error) {
      console.error('❌ Failed to load holdings data:', error)
      
      // Increment error count and track time
      errorCountRef.current += 1
      lastErrorTimeRef.current = Date.now()
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load holdings data'
      setError(errorMessage)
      
      // Fallback to cached data if available
      if (holdingsCache.data) {
        console.log('📦 Falling back to cached holdings data')
        setHoldings(holdingsCache.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [getBackoffDelay, isCacheValid, fetchTokenHoldings])

  // Store latest loadHoldingsData function in ref
  useEffect(() => {
    loadHoldingsDataRef.current = loadHoldingsData
  }, [loadHoldingsData])

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      
      // Reset error count for manual refresh
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      if (loadHoldingsDataRef.current) {
        await loadHoldingsDataRef.current(true)
      }
    } catch (error) {
      console.error('Failed to refresh holdings data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh holdings data'
      setError(errorMessage)
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    if (mounted && loadHoldingsDataRef.current) {
      loadHoldingsDataRef.current(false)
    }
  }, [mounted])

  // Auto-refresh every 3 minutes (more frequent for holdings)
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      if (!isLoading && !refreshing && loadHoldingsDataRef.current) {
        loadHoldingsDataRef.current(false)
      }
    }, 3 * 60 * 1000) // 3 minutes

    return () => clearInterval(interval)
  }, [mounted, isLoading, refreshing])

  return {
    // Data
    holdings,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshData,
    
    // Cache info
    lastUpdated: holdingsCache.timestamp,
    cacheAge: holdingsCache.timestamp ? Date.now() - holdingsCache.timestamp : 0,
  }
} 