import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Token } from './use-tokens'

interface UseUrlSyncProps {
  fromToken: Token | null
  toToken: Token | null
  amount: string
  slippage: number
}

export function useUrlSync({ fromToken, toToken, amount, slippage }: UseUrlSyncProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isInitializedRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null)

  // 🔧 FIX: Improved URL update function with smarter debouncing
  const updateURL = useCallback((params: Record<string, string | null>, immediate = false) => {
    // Clear any pending updates
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current)
      pendingUpdateRef.current = null
    }

    const performUpdate = () => {
      // Build query string directly without URLSearchParams overhead
      const queryParts: string[] = []
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        }
      })
      
      const queryString = queryParts.join('&')
      const newUrl = queryString ? `/swap?${queryString}` : '/swap'
      
      // Skip update if URL hasn't changed
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl === newUrl) return
      
      // Update URL and track when we last updated
      router.replace(newUrl, { scroll: false })
      lastUpdateRef.current = Date.now()
      
      console.log('🔗 URL updated:', newUrl)
    }

    if (immediate) {
      // For immediate updates (like when user explicitly changes something)
      performUpdate()
    } else {
      // 🔧 FIX: Reduced debounce from 800ms to 300ms for better responsiveness  
      pendingUpdateRef.current = setTimeout(performUpdate, 300)
    }
  }, [router])

  // 🔧 FIX: Enhanced URL sync with better state tracking
  useEffect(() => {
    // Only sync URL if component is properly initialized
    if (!isInitializedRef.current) return

    // 🔧 FIX: Prevent updating URL immediately after loading from URL
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current
    if (timeSinceLastUpdate < 1000) {
      console.log('⏳ Skipping URL update - too soon after last update')
      return
    }

    const params: Record<string, string | null> = {}
    
    // Add from token params
    if (fromToken) {
      params.from = fromToken.address
      params.fromChain = fromToken.chainId.toString()
    }
    
    // Add to token params
    if (toToken) {
      params.to = toToken.address
      params.toChain = toToken.chainId.toString()
    }
    
    // Add amount if it's a valid non-zero value
    if (amount && amount !== '0' && !isNaN(parseFloat(amount))) {
      params.amount = amount
      params.exactField = 'input'
    }
    
    // Add slippage if it's not the default
    if (slippage && slippage !== 0.5) {
      params.slippage = slippage.toString()
    }
    
    // Create URL string for comparison
    const urlString = Object.entries(params)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    
    // Get current URL params for comparison
    const currentUrlString = searchParams.toString()
    
    // Only update if URL actually needs to change
    if (urlString !== currentUrlString) {
      console.log('🔄 URL sync triggered:', {
        from: urlString !== currentUrlString ? 'changed' : 'same',
        newParams: urlString,
        currentParams: currentUrlString
      })
      updateURL(params)
    }
  }, [fromToken?.address, fromToken?.chainId, toToken?.address, toToken?.chainId, amount, slippage, updateURL, searchParams])

  // 🔧 FIX: Enhanced initialization function with proper state management
  const markInitialized = useCallback(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      // Mark the time when we initialized to prevent immediate URL overwrites
      lastUpdateRef.current = Date.now()
      console.log('✅ URL sync initialized - will start syncing URL changes')
    }
  }, [])

  // 🔧 FIX: Force immediate URL update function for user actions
  const forceUpdateURL = useCallback((immediate = true) => {
    if (!isInitializedRef.current) return

    const params: Record<string, string | null> = {}
    
    if (fromToken) {
      params.from = fromToken.address
      params.fromChain = fromToken.chainId.toString()
    }
    
    if (toToken) {
      params.to = toToken.address
      params.toChain = toToken.chainId.toString()
    }
    
    if (amount && amount !== '0' && !isNaN(parseFloat(amount))) {
      params.amount = amount
      params.exactField = 'input'
    }
    
    if (slippage && slippage !== 0.5) {
      params.slippage = slippage.toString()
    }

    updateURL(params, immediate)
  }, [fromToken, toToken, amount, slippage, updateURL])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current)
      }
    }
  }, [])

  return {
    searchParams,
    markInitialized,
    forceUpdateURL,
    isInitialized: isInitializedRef.current
  }
} 