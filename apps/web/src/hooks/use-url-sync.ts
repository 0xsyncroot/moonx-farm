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
  const lastChainUpdateRef = useRef<{ fromChain?: number, toChain?: number }>({})

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
    
    // 🔧 FIX: Detect chain changes for immediate URL update
    const currentChains = {
      fromChain: fromToken?.chainId,
      toChain: toToken?.chainId
    }
    
    const chainChanged = (
      currentChains.fromChain !== lastChainUpdateRef.current.fromChain ||
      currentChains.toChain !== lastChainUpdateRef.current.toChain
    )
    
    // Create URL string for comparison
    const urlString = Object.entries(params)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    
    // Only update if URL actually changed
    if (urlString !== lastURLUpdateRef.current) {
      lastURLUpdateRef.current = urlString
      lastChainUpdateRef.current = currentChains
      
      if (chainChanged) {
        // 🔧 FIX: Immediate update for chain changes (no debounce)
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Chain change detected, immediate URL update:', {
            fromChain: currentChains.fromChain,
            toChain: currentChains.toChain,
            previousChains: lastChainUpdateRef.current
          })
        }
        updateURL(params)
      } else {
        // Regular debounce for other changes (amount, slippage)
        const timeoutId = setTimeout(() => {
          updateURL(params)
        }, 800)
        
        return () => clearTimeout(timeoutId)
      }
    } else {
      // Update chain ref even if URL didn't change
      lastChainUpdateRef.current = currentChains
    }
  }, [fromToken?.address, fromToken?.chainId, toToken?.address, toToken?.chainId, amount, slippage, updateURL])

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