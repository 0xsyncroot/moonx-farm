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
  const lastURLUpdateRef = useRef<string>('')

  // URL update function - optimized for speed
  const updateURL = useCallback((params: Record<string, string | null>) => {
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
    
    router.replace(newUrl, { scroll: false })
  }, [router])

  // Update URL when state changes
  useEffect(() => {
    if (!isInitializedRef.current) return // Skip during initialization

    const params: Record<string, string | null> = {}
    
    if (fromToken) {
      params.from = fromToken.address
      params.fromChain = fromToken.chainId.toString()
    }
    
    if (toToken) {
      params.to = toToken.address
      params.toChain = toToken.chainId.toString()
    }
    
    if (amount && amount !== '0') {
      params.amount = amount
      params.exactField = 'input'
    }
    
    if (slippage && slippage !== 0.5) {
      params.slippage = slippage.toString()
    }
    
    // Create URL string for comparison
    const urlString = Object.entries(params)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    
    // Only update if URL actually changed
    if (urlString !== lastURLUpdateRef.current) {
      lastURLUpdateRef.current = urlString
      
      // Debounce the actual update
      const timeoutId = setTimeout(() => {
        updateURL(params)
      }, 800)
      
      return () => clearTimeout(timeoutId)
    }
  }, [fromToken?.address, toToken?.address, amount, slippage, updateURL])

  // Mark as initialized
  const markInitialized = useCallback(() => {
    isInitializedRef.current = true
  }, [])

  return {
    searchParams,
    markInitialized,
    isInitialized: isInitializedRef.current
  }
} 