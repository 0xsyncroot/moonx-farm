'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aggregatorApi } from '@/lib/api-client'
import { useDebounce } from './use-debounce'
import { useTestnetMode } from '@/components/ui/testnet-toggle'

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  chainId: number
  priceUSD?: number
  change24h?: number
  volume24h?: number
  marketCap?: number
  verified?: boolean
  popular?: boolean
  tags?: string[]
  isNative?: boolean
  // Security & Audit fields - will be populated by API in the future
  auditStatus?: 'audited' | 'unaudited' | 'risk'
  securityScore?: number // 0-100
  trustScore?: number // 1-5 rating
}

interface TokenListResponse {
  tokens: Token[]
  total: number
  updatedAt?: string | number
}

// Minimal fallback for critical chains when API is down
const CRITICAL_TOKENS_FALLBACK: Record<number, Token[]> = {
  8453: [ // Base
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 8453,
      isNative: true,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a91E6441ad06b6b6F0E5Ce7dF9e7fC56a5e/logo.png',
    },
  ],
  56: [ // BSC
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chainId: 56,
      isNative: true,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      chainId: 56,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a91E6441ad06b6b6F0E5Ce7dF9e7fC56a5e/logo.png',
    },
  ],
  1: [ // Ethereum
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 1,
      isNative: true,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
    {
      address: '0xA0b86a91E6441ad06b6b6F0E5Ce7dF9e7fC56a5e',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a91E6441ad06b6b6F0E5Ce7dF9e7fC56a5e/logo.png',
    },
  ],
}

export function useTokens(selectedChainId?: number) {
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const debouncedQuery = useDebounce(searchQuery, 800) // Increased to 800ms - only trigger when user stops typing
  
  // Get current testnet mode
  const isTestnet = useTestnetMode()

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('tokenFavorites')
    if (savedFavorites) {
      try {
        const favoritesArray = JSON.parse(savedFavorites) as string[]
        setFavorites(new Set(favoritesArray))
      } catch (error) {
        console.error('Failed to parse favorites:', error)
        // Clear corrupted data
        localStorage.removeItem('tokenFavorites')
      }
    }
  }, [])

    // Simple popular tokens fallback - no auto-loading
  const popularTokensData = null
  const popularLoading = false  
  const popularError = null

  // Search tokens using aggregator service - Cross-chain search with optimized triggering
  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = useQuery<TokenListResponse>({
    queryKey: ['tokens', 'search', debouncedQuery, 'all-chains', isTestnet],
    queryFn: async ({ signal }) => {
      const query = debouncedQuery.trim()
      
      // Return empty for empty queries (removed minimum length requirement as tokens can be 1 character)
      if (!query) {
        return { tokens: [], total: 0 }
      }
      
      // React Query provides AbortSignal automatically, no need for manual AbortController
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 useTokens: Triggering API search for:', query, 'testnet:', isTestnet)
        }
        
        // Don't pass chainId to search across all supported chains
        const result = await aggregatorApi.searchTokens({
          q: query,
          // chainId: undefined, // Search all chains
          limit: 50,
          testnet: isTestnet, // Pass current testnet mode
        })
        
        // Check if request was aborted
        if (signal?.aborted) {
          console.log('🚫 API search cancelled for:', query)
          throw new Error('AbortError')
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ useTokens: API search completed for:', query, 'Found:', result.tokens?.length || 0, 'testnet:', isTestnet)
        }
        return result
      } catch (error) {
        // Don't throw for aborted requests
        if (signal?.aborted || (error instanceof Error && (error.name === 'AbortError' || error.message === 'AbortError'))) {
          console.log('🚫 API search cancelled for:', query)
          return { tokens: [], total: 0 }
        }
        throw error
      }
    },
    enabled: !!debouncedQuery.trim(), // Search for any non-empty query (tokens can be 1 character)
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Process tokens data with instant local filtering + debounced API search
  const tokens = useMemo(() => {
    let tokensArray: Token[] = []
    const currentQuery = searchQuery.trim().toLowerCase()
    const debouncedQ = debouncedQuery.trim().toLowerCase()

    if (currentQuery) {
      // 🚀 INSTANT LOCAL FILTERING: Filter fallback tokens immediately while typing
      const localTokens = Object.values(CRITICAL_TOKENS_FALLBACK).flat()
      const localMatches = localTokens.filter((token: Token) => {
        const symbolMatch = token.symbol.toLowerCase().includes(currentQuery)
        const nameMatch = token.name.toLowerCase().includes(currentQuery)
        const addressMatch = token.address.toLowerCase().includes(currentQuery)
        return symbolMatch || nameMatch || addressMatch
      })

             // 🔍 API RESULTS: Only use API results if debounced query matches current query
       // This prevents stale API results from overriding fresh local results
       if (debouncedQ === currentQuery && debouncedQ.length > 0) {
        // Combine API results with local matches (deduplicate by address)
        const apiResults = searchResults?.tokens || []
        const combined = [...apiResults]
        const existingAddresses = new Set(apiResults.map(t => t.address.toLowerCase()))
        
        localMatches.forEach(token => {
          if (!existingAddresses.has(token.address.toLowerCase())) {
            combined.push(token)
          }
        })
        
        tokensArray = combined
      } else {
        // Only show local matches for instant feedback
        tokensArray = localMatches
      }
    } else {
      // No search query - use fallback tokens
      tokensArray = Object.values(CRITICAL_TOKENS_FALLBACK).flat()
    }

    // Sort tokens by priority
    return tokensArray.sort((a, b) => {
      // 1. Favorites first
      const aFavorite = favorites.has(a.address)
      const bFavorite = favorites.has(b.address)
      if (aFavorite && !bFavorite) return -1
      if (!aFavorite && bFavorite) return 1

      // 2. Exact matches first (if searching)
      if (currentQuery) {
        const aExact = a.symbol.toLowerCase() === currentQuery
        const bExact = b.symbol.toLowerCase() === currentQuery
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Symbol starts with query
        const aStarts = a.symbol.toLowerCase().startsWith(currentQuery)
        const bStarts = b.symbol.toLowerCase().startsWith(currentQuery)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
      }

      // 3. Native tokens
      if (a.isNative && !b.isNative) return -1
      if (!a.isNative && b.isNative) return 1

      // 4. Verified tokens
      if (a.verified && !b.verified) return -1
      if (!a.verified && b.verified) return 1

      // 5. Popular tokens
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1

      // 6. Volume (highest first)
      if (a.volume24h && b.volume24h) {
        return b.volume24h - a.volume24h
      }

      // 7. Alphabetical
      return a.symbol.localeCompare(b.symbol)
    })
  }, [searchQuery, debouncedQuery, searchResults, favorites])

  // Popular tokens for quick access
  const popularTokens = useMemo(() => {
    const popular = tokens.filter(token => token.popular || token.isNative)
    return popular.slice(0, 8) // Top 8 for UI
  }, [tokens])

  // Favorite tokens
  const favoriteTokens = useMemo(() => {
    return tokens.filter(token => favorites.has(token.address))
  }, [tokens, favorites])

  // Toggle favorite with proper Set handling
  const toggleFavorite = (tokenAddress: string) => {
    const favoritesArray = Array.from(favorites)
    const newFavoritesArray = favorites.has(tokenAddress)
      ? favoritesArray.filter(addr => addr !== tokenAddress)
      : [...favoritesArray, tokenAddress]
    
    const newFavorites = new Set(newFavoritesArray)
    setFavorites(newFavorites)
    
    // Persist to localStorage
    try {
      localStorage.setItem('tokenFavorites', JSON.stringify(newFavoritesArray))
    } catch (error) {
      console.error('Failed to save favorites:', error)
    }
  }

  // Check if token is favorite
  const isFavorite = (tokenAddress: string) => {
    return favorites.has(tokenAddress)
  }

  // Get token by address
  const getTokenByAddress = (address: string) => {
    if (!address) return undefined
    return tokens.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    )
  }

  // Get token by symbol
  const getTokenBySymbol = (symbol: string) => {
    if (!symbol) return undefined
    return tokens.find(token => 
      token.symbol.toLowerCase() === symbol.toLowerCase()
    )
  }

  // Search specific token with memoization to prevent duplicate calls
  const searchTokenCache = useMemo(() => new Map<string, { result: Promise<Token | null>, timestamp: number }>(), [])
  
  const searchToken = useCallback(async (query: string, chainId?: number, testnet?: boolean): Promise<Token | null> => {
    if (!query.trim()) return null
    
    // Use current testnet mode if not specified
    const useTestnet = testnet !== undefined ? testnet : isTestnet
    
    // Create cache key including testnet mode
    const cacheKey = `${query.trim().toLowerCase()}_${chainId || 'all'}_${useTestnet ? 'testnet' : 'mainnet'}`
    const now = Date.now()
    const CACHE_DURATION = 10000 // 10 seconds cache
    
    // Check cache first
    const cached = searchTokenCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 useTokens: Using cached searchToken result for:', query)
      }
      return await cached.result
    }
    
    // Create promise for the API call
    const searchPromise = (async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 useTokens: Calling aggregatorApi.searchTokens for:', query, 'chainId:', chainId, 'testnet:', useTestnet)
        }
        const result = await aggregatorApi.searchTokens({
          q: query.trim(),
          chainId,
          limit: 1,
          testnet: useTestnet,
        })
        return result.tokens?.[0] || null
      } catch (error) {
        console.error('❌ Token search failed:', error)
        return null
      }
    })()
    
    // Cache the promise and timestamp
    searchTokenCache.set(cacheKey, {
      result: searchPromise,
      timestamp: now
    })
    
    // Clean up old cache entries periodically
    if (searchTokenCache.size > 50) {
      const entriesToDelete: string[] = []
      searchTokenCache.forEach((value, key) => {
        if ((now - value.timestamp) > CACHE_DURATION) {
          entriesToDelete.push(key)
        }
      })
      entriesToDelete.forEach(key => searchTokenCache.delete(key))
    }
    
    return await searchPromise
  }, [searchTokenCache, isTestnet])

  // Add function to manually load popular tokens
  const loadPopularTokens = async (options?: { chainId?: number; testnet?: boolean }): Promise<TokenListResponse | null> => {
    try {
      // Use provided options or default to current testnet mode
      const params = {
        chainId: options?.chainId || selectedChainId,
        testnet: options?.testnet !== undefined ? options.testnet : isTestnet
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 useTokens: Loading popular tokens with params:', params)
      }
      
      const result = await aggregatorApi.getPopularTokens(params)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ useTokens: Loaded', result.tokens?.length || 0, 'popular tokens')
      }
      
      return result
    } catch (error) {
      console.error('❌ [Manual] Popular tokens load failed:', error)
      return null
    }
  }

  // Compute loading and error states with better granularity
  const isLoadingAPI = isSearching && debouncedQuery.trim().length > 0
  const isLoadingPopular = popularLoading
  const isLoading = isLoadingAPI || isLoadingPopular
  
  // Better search state tracking
  const hasSearchQuery = Boolean(searchQuery.trim())
  const hasAPIQuery = Boolean(debouncedQuery.trim())
  const hasResults = tokens.length > 0
  const error = searchError || popularError

  // Determine if we're showing local results vs API results
  const isShowingLocalResults = hasSearchQuery && (!hasAPIQuery || searchQuery.trim() !== debouncedQuery.trim())
  const isShowingAPIResults = hasAPIQuery && searchQuery.trim() === debouncedQuery.trim() && !isLoadingAPI

  return {
    // Data
    tokens,
    popularTokens,
    favoriteTokens,
    
    // State - Enhanced for better UX
    isLoading,
    isLoadingAPI,
    isLoadingPopular,
    error,
    hasSearchQuery,
    hasAPIQuery,
    hasResults,
    isShowingLocalResults,
    isShowingAPIResults,
    isTestnet, // Expose testnet mode
    
    // Search queries - separate for better control
    searchQuery, // Real-time query (for input field)
    debouncedQuery, // Debounced query (for API calls)

    // Actions  
    setSearchQuery,
    toggleFavorite,
    isFavorite,
    getTokenByAddress,
    getTokenBySymbol,
    searchToken,
    loadPopularTokens, // Manual load function

    // Metadata
    total: searchResults?.total || tokens.length,
    updatedAt: searchResults?.updatedAt || Date.now(),
  }
} 