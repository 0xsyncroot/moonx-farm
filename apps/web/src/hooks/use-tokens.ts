'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aggregatorApi } from '@/lib/api-client'
import { useDebounce } from './use-debounce'

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
  const debouncedQuery = useDebounce(searchQuery, 300)

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

  // Search tokens using aggregator service - Cross-chain search
  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = useQuery<TokenListResponse>({
    queryKey: ['tokens', 'search', debouncedQuery, 'all-chains'],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { tokens: [], total: 0 }
      }
      
      // Don't pass chainId to search across all supported chains
      const result = await aggregatorApi.searchTokens({
        q: debouncedQuery.trim(),
        // chainId: undefined, // Search all chains
        limit: 50,
      })
      
      return result
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Process tokens data with proper fallback
  const tokens = useMemo(() => {
    let tokensArray: Token[] = []

    if (debouncedQuery.trim()) {
      // Use search results
      tokensArray = searchResults?.tokens || []
    } else {
      // Use fallback tokens when not searching
      tokensArray = Object.values(CRITICAL_TOKENS_FALLBACK).flat()
    }

    // Sort tokens by priority
    return tokensArray.sort((a, b) => {
      // 1. Favorites first
      const aFavorite = favorites.has(a.address)
      const bFavorite = favorites.has(b.address)
      if (aFavorite && !bFavorite) return -1
      if (!aFavorite && bFavorite) return 1

      // 2. Native tokens
      if (a.isNative && !b.isNative) return -1
      if (!a.isNative && b.isNative) return 1

      // 3. Verified tokens
      if (a.verified && !b.verified) return -1
      if (!a.verified && b.verified) return 1

      // 4. Popular tokens
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1

      // 5. Volume (highest first)
      if (a.volume24h && b.volume24h) {
        return b.volume24h - a.volume24h
      }

      // 6. Alphabetical
      return a.symbol.localeCompare(b.symbol)
    })
  }, [debouncedQuery, searchResults, popularTokensData, selectedChainId, favorites])

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

  // Search specific token
  const searchToken = async (query: string, chainId?: number): Promise<Token | null> => {
    if (!query.trim()) return null
    
    try {
      const result = await aggregatorApi.searchTokens({
        q: query.trim(),
        chainId,
        limit: 1,
      })
      return result.tokens?.[0] || null
    } catch (error) {
      console.error('Token search failed:', error)
      return null
    }
  }

  // Add function to manually load popular tokens
  const loadPopularTokens = async (): Promise<TokenListResponse | null> => {
    try {
      const result = await aggregatorApi.getPopularTokens()
      return result
    } catch (error) {
      console.error('❌ [Manual] Popular tokens load failed:', error)
      return null
    }
  }

  // Compute loading and error states
  const isLoading = popularLoading || isSearching
  const hasSearchQuery = Boolean(debouncedQuery.trim())
  const hasResults = tokens.length > 0
  const error = searchError || popularError

  return {
    // Data
    tokens,
    popularTokens,
    favoriteTokens,
    
    // State
    isLoading,
    error,
    hasSearchQuery,
    hasResults,
    searchQuery: debouncedQuery,

    // Actions  
    setSearchQuery,
    toggleFavorite,
    isFavorite,
    getTokenByAddress,
    getTokenBySymbol,
    searchToken,
    loadPopularTokens, // New manual load function

    // Metadata
    total: searchResults?.total || tokens.length,
    updatedAt: searchResults?.updatedAt || Date.now(),
  }
} 