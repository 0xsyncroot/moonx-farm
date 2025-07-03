'use client'

/**
 * TokenSelector - Jupiter-inspired token selection component
 * 
 * Modern UI Features:
 * - Clean, minimalist design with proper spacing
 * - Smooth animations and micro-interactions
 * - Smart search with instant results (local + API)
 * - Visual token categories and suggestions
 * - Mobile-optimized responsive design
 * - Live price data with change indicators
 * - Accessibility-first approach
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Star, TrendingUp, Zap, Filter, CheckCircle, AlertCircle, Clock, Copy, Coins, Shield, ArrowUpDown, BarChart3, Eye, EyeOff, Wallet } from 'lucide-react'
import { useTokens, Token } from '@/hooks/use-tokens'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useTestnetMode } from '@/components/ui/testnet-toggle'
import { ChainIcon } from '@/components/ui/chain-icon'

// Chain configurations with real SVG icons
const CHAIN_CONFIG = {
  // Mainnet chains
  1: { 
    name: 'Ethereum',
    color: 'bg-blue-500',
    icon: `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#627EEA"/>
      <path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#C1CCF7" fill-opacity=".602"/>
      <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
      <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#C1CCF7" fill-opacity=".602"/>
      <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff"/>
      <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#8197EE" fill-opacity=".2"/>
      <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#8197EE" fill-opacity=".602"/>
    </svg>`
  },
  8453: { 
    name: 'Base',
    color: 'bg-blue-600',
    icon: `<svg width="24" height="24" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="111" height="111" rx="55.5" fill="#0052FF"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 21.3467 0.239014 48.8484H36.8705C38.8239 39.4891 46.8109 32.6523 56.3681 32.6523C67.2944 32.6523 76.1429 41.5008 76.1429 52.4271C76.1429 63.3534 67.2944 72.2019 56.3681 72.2019C46.8109 72.2019 38.8239 65.3651 36.8705 55.9058H0.239014C2.35281 83.4075 26.0432 104.754 54.921 110.034Z" fill="white"/>
    </svg>`
  },
  56: { 
    name: 'BSC',
    color: 'bg-yellow-500',
    icon: `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F0B90B"/>
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.856L24.14 16l-2.26 2.26L19.62 16l2.26-2.26z" fill="white"/>
      <path d="M16 14.52L13.596 16.924 16 19.328l2.404-2.404L16 14.52z" fill="white"/>
    </svg>`
  },
  137: { 
    name: 'Polygon',
    color: 'bg-purple-500',
    icon: `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#8247E5"/>
      <path d="M21.092 12.693c-.369-.215-.848-.215-1.217 0l-2.804 1.619-1.878 1.086-2.804 1.619c-.369.215-.848.215-1.217 0l-2.804-1.619c-.369-.215-.369-.645 0-.86l2.804-1.619c.369-.215.848-.215 1.217 0l2.804 1.619c.369.215.369.645 0 .86l-1.878 1.086 1.878 1.086c.369.215.369.645 0 .86l-2.804 1.619c-.369.215-.848.215-1.217 0l-2.804-1.619c-.369-.215-.369-.645 0-.86l2.804-1.619 1.878-1.086-1.878-1.086c-.369-.215-.369-.645 0-.86l2.804-1.619c.369-.215.848-.215 1.217 0l2.804 1.619c.369.215.369.645 0 .86z" fill="white"/>
    </svg>`
  },
  
  // Testnet chains
  84532: { 
    name: 'Base Sepolia',
    color: 'bg-orange-500',
    icon: `<svg width="24" height="24" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="111" height="111" rx="55.5" fill="#0052FF"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 21.3467 0.239014 48.8484H36.8705C38.8239 39.4891 46.8109 32.6523 56.3681 32.6523C67.2944 32.6523 76.1429 41.5008 76.1429 52.4271C76.1429 63.3534 67.2944 72.2019 56.3681 72.2019C46.8109 72.2019 38.8239 65.3651 36.8705 55.9058H0.239014C2.35281 83.4075 26.0432 104.754 54.921 110.034Z" fill="white"/>
    </svg>`
  },
  97: { 
    name: 'BSC Testnet',
    color: 'bg-orange-400',
    icon: `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F0B90B"/>
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.856L24.14 16l-2.26 2.26L19.62 16l2.26-2.26z" fill="white"/>
      <path d="M16 14.52L13.596 16.924 16 19.328l2.404-2.404L16 14.52z" fill="white"/>
    </svg>`
  },
}

interface TokenSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectToken: (token: Token) => void
  currentToken?: Token | null
  title?: string
}

// Emergency fallback - only essential tokens per chain with logos
const EMERGENCY_FALLBACK: Record<number, Token[]> = {
  // Mainnet chains
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
  
  // Testnet chains
  84532: [ // Base Sepolia
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 84532,
      isNative: true,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
  ],
  97: [ // BSC Testnet
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chainId: 97,
      isNative: true,
      verified: true,
      popular: true,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    },
  ],
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelectToken,
  currentToken,
  title = 'Select a token'
}: TokenSelectorProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'favorites' | 'recent'>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recentTokens, setRecentTokens] = useState<Token[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showBalances, setShowBalances] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'marketCap' | 'volume' | 'change'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterRisk, setFilterRisk] = useState<'all' | 'verified' | 'unverified'>('all')
  const [apiTokens, setApiTokens] = useState<Token[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<Error | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef(false)
  const hasLoadedRef = useRef(false)
  
  const isTestnet = useTestnetMode()

  // Mount check for Portal
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // ✅ FIXED: Use useTokens hook for search logic
  const {
    tokens: searchTokens,
    popularTokens,
    favoriteTokens: hookFavoriteTokens,
    isLoading: searchLoading,
    toggleFavorite,
    isFavorite,
    error: tokensError,
    hasSearchQuery: searchHasQuery,
    searchQuery: hookSearchQuery,
    setSearchQuery: setHookSearchQuery,
    loadPopularTokens,
  } = useTokens()

  const loadPopularTokensRef = useRef(loadPopularTokens)

  // ✅ UPDATE: Keep ref in sync with latest function
  useEffect(() => {
    loadPopularTokensRef.current = loadPopularTokens
  }, [loadPopularTokens])

  // Load popular tokens when modal opens - FIXED for performance
  const loadTokensOnOpen = useCallback(async () => {
    // ✅ FIXED: Use refs to prevent multiple loads
    if (!isOpen || searchHasQuery || apiTokens.length > 0 || loadingRef.current || hasLoadedRef.current) {
      return
    }
    
    loadingRef.current = true
    setApiLoading(true)
    setApiError(null)
    
    try {
      const result = await loadPopularTokensRef.current()
      if (result?.tokens) {
        setApiTokens(result.tokens)
        hasLoadedRef.current = true // ✅ MARK: We've successfully loaded tokens
      }
    } catch (error) {
      console.error('❌ [Modal] Load failed:', error)
      setApiError(error instanceof Error ? error : new Error('Failed to load tokens'))
    } finally {
      loadingRef.current = false
      setApiLoading(false)
    }
  }, [isOpen, searchHasQuery, apiTokens.length]) // ✅ FIXED: Simplified deps

  // Trigger load when modal opens - OPTIMIZED to prevent re-triggers
  useEffect(() => {
    if (!isOpen) {
      // ✅ RESET: Clear flags when modal closes
      hasLoadedRef.current = false
      return
    }
    
    // ✅ FIXED: Use refs for better state management
    if (apiTokens.length === 0 && !loadingRef.current && !hasLoadedRef.current && !searchHasQuery) {
      loadTokensOnOpen()
    }
    
    // ✅ CLEANUP: Handle component unmounting
    return () => {
      loadingRef.current = false
    }
  }, [isOpen, searchHasQuery, loadTokensOnOpen]) // ✅ FIXED: Simplified deps

  // Auto-focus search when opened - OPTIMIZED
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [isOpen])

  // ✅ FIXED: Load favorites from localStorage with proper migration and sync
  useEffect(() => {
    if (favoritesLoaded) return // Prevent double loading
    
    const savedFavorites = localStorage.getItem('tokenFavorites')
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites)
        
        // ✅ FIXED: Migration logic - Convert old address-only format to chainId-address format
        const migratedFavorites = parsed.map((item: string) => {
          // If already in chainId-address format, keep as is
          if (item.includes('-') && item.split('-')[0].match(/^\d+$/)) {
            return item
          }
          // For address-only format, we can't migrate properly without knowing the chain
          // Keep the old format for backward compatibility but mark for cleanup
          return item
        })
        
        // ✅ FIXED: Set favorites and mark as loaded
        setFavorites(new Set(migratedFavorites))
        setFavoritesLoaded(true)
        
        // Update localStorage with migrated data
        localStorage.setItem('tokenFavorites', JSON.stringify(migratedFavorites))
      } catch (error) {
        console.error('Failed to parse favorites:', error)
        // Clear invalid data and mark as loaded
        localStorage.removeItem('tokenFavorites')
        setFavorites(new Set())
        setFavoritesLoaded(true)
      }
    } else {
      setFavoritesLoaded(true)
    }
  }, [favoritesLoaded]) // Only run when not loaded

  // Load recent tokens from localStorage
  useEffect(() => {
    const savedRecent = localStorage.getItem('recentTokens')
    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent)
        setRecentTokens(parsed.slice(0, 10)) // Keep only last 10
      } catch (error) {
        console.error('Failed to parse recent tokens:', error)
        localStorage.removeItem('recentTokens')
      }
    }
  }, [])

  // Helper to check if chain is testnet
  const isTestnetChain = (chainId: number) => {
    return [84532, 97].includes(chainId) // Base Sepolia, BSC Testnet
  }

  // ✅ FIXED: Improved token source logic - combines API search results with local tokens
  const availableTokens = useMemo(() => {
    let tokens: Token[] = []
    
    if (searchHasQuery) {
      // ✅ SEARCH MODE: Use API search results + local filtering
      const apiResults = searchTokens.length > 0 ? searchTokens : []
      
      // Also search through local emergency fallback tokens
      const localTokens = Object.values(EMERGENCY_FALLBACK).flat()
      const query = hookSearchQuery.toLowerCase().trim()
      const localMatches = localTokens.filter((token: Token) => {
        const symbolMatch = token.symbol.toLowerCase().includes(query)
        const nameMatch = token.name.toLowerCase().includes(query)
        const addressMatch = token.address.toLowerCase().includes(query)
        return symbolMatch || nameMatch || addressMatch
      })
      
      // Combine API results with local matches (deduplicate by address)
      const combined = [...apiResults]
      const existingAddresses = new Set(apiResults.map(t => t.address.toLowerCase()))
      
      localMatches.forEach(token => {
        if (!existingAddresses.has(token.address.toLowerCase())) {
          combined.push(token)
        }
      })
      
      tokens = combined
    } else {
      // ✅ NON-SEARCH MODE: Use API tokens or fallback
      if (apiTokens.length > 0) {
        tokens = apiTokens
      } else {
        // Fallback from all chains
        tokens = Object.values(EMERGENCY_FALLBACK).flat()
      }
    }
    
    // Filter tokens based on testnet mode
    return tokens.filter(token => {
      const tokenIsTestnet = isTestnetChain(token.chainId)
      return isTestnet ? tokenIsTestnet : !tokenIsTestnet
    })
  }, [searchHasQuery, searchTokens, hookSearchQuery, apiTokens, isTestnet])

  // Enhanced filtering with sorting and risk filtering
  const filteredTokens = useMemo(() => {
    let tokens: Token[] = []
    
    if (!hookSearchQuery.trim()) {
      // ✅ NO SEARCH: Use tab-based filtering
      switch (activeTab) {
        case 'popular':
          tokens = popularTokens.length > 0 ? popularTokens : 
                   Object.values(EMERGENCY_FALLBACK).flat().filter((token: Token) => token.popular)
          break
        case 'favorites':
          // ✅ FIXED: Strict chain-specific favorites filtering
          tokens = availableTokens.filter((token: Token) => {
            const tokenKey = `${token.chainId}-${token.address}`
            return favorites.has(tokenKey)
          })
          break
        case 'recent':
          // Filter recent tokens that are still available
          tokens = recentTokens.filter(recent => 
            availableTokens.some(available => 
              available.address === recent.address && available.chainId === recent.chainId
            )
          )
          break
        default:
          tokens = availableTokens
      }
    } else {
      // ✅ WITH SEARCH: Use all available tokens (already filtered by search)
      tokens = availableTokens
      
      // Additional local sorting for better relevance
      const query = hookSearchQuery.toLowerCase().trim()
      tokens = tokens.sort((a, b) => {
        // Exact symbol match first
        const aExact = a.symbol.toLowerCase() === query
        const bExact = b.symbol.toLowerCase() === query
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Symbol starts with query
        const aStarts = a.symbol.toLowerCase().startsWith(query)
        const bStarts = b.symbol.toLowerCase().startsWith(query)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        
        // Popular/verified tokens first
        if (a.popular && !b.popular) return -1
        if (!a.popular && b.popular) return 1
        if (a.verified && !b.verified) return -1
        if (!a.verified && b.verified) return 1
        
        return 0
      })
    }

    // Apply risk filter
    if (filterRisk !== 'all') {
      tokens = tokens.filter(token => {
        if (filterRisk === 'verified') return token.verified
        if (filterRisk === 'unverified') return !token.verified
        return true
      })
    }

    // Apply sorting
    tokens = tokens.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.symbol.localeCompare(b.symbol)
          break
        case 'price':
          const aPrice = a.priceUSD && !isNaN(a.priceUSD) ? a.priceUSD : 0
          const bPrice = b.priceUSD && !isNaN(b.priceUSD) ? b.priceUSD : 0
          comparison = aPrice - bPrice
          break
        case 'marketCap':
          const aMarketCap = a.marketCap && !isNaN(a.marketCap) ? a.marketCap : 0
          const bMarketCap = b.marketCap && !isNaN(b.marketCap) ? b.marketCap : 0
          comparison = aMarketCap - bMarketCap
          break
        case 'volume':
          const aVolume = a.volume24h && !isNaN(a.volume24h) ? a.volume24h : 0
          const bVolume = b.volume24h && !isNaN(b.volume24h) ? b.volume24h : 0
          comparison = aVolume - bVolume
          break
        case 'change':
          const aChange = a.change24h && !isNaN(a.change24h) ? a.change24h : 0
          const bChange = b.change24h && !isNaN(b.change24h) ? b.change24h : 0
          comparison = aChange - bChange
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    // Chain priority sorting (secondary sort)
    const chainPriority = isTestnet 
      ? [84532, 97] // Base Sepolia, BSC Testnet
      : [8453, 1, 56, 137] // Base, Ethereum, BSC, Polygon
    
    return tokens.sort((a, b) => {
      // Primary sort by user selection
      if (sortBy !== 'name') return 0
      
      // Secondary sort by chain priority
      const aPriority = chainPriority.indexOf(a.chainId)
      const bPriority = chainPriority.indexOf(b.chainId)
      
      if (aPriority !== bPriority) {
        if (aPriority === -1) return 1
        if (bPriority === -1) return -1
        return aPriority - bPriority
      }
      
      return 0
    })
  }, [availableTokens, hookSearchQuery, activeTab, popularTokens, hookFavoriteTokens, favorites, recentTokens, isTestnet, filterRisk, sortBy, sortDirection])

  // ✅ FIXED: Chain-specific favorite management to avoid conflicts with same addresses
  const handleToggleFavorite = (tokenKey: string) => {
    // Always use chainId-address format for consistency
    const newFavorites = favorites.has(tokenKey)
      ? new Set(Array.from(favorites).filter(key => key !== tokenKey))
      : new Set([...Array.from(favorites), tokenKey])
    
    setFavorites(newFavorites)
    
    // Save to localStorage immediately
    try {
      localStorage.setItem('tokenFavorites', JSON.stringify(Array.from(newFavorites)))
    } catch (error) {
      console.error('Failed to save favorites:', error)
    }
    
    // Sync with useTokens hook (address only for compatibility)
    if (toggleFavorite) {
      try {
        const tokenAddress = tokenKey.includes('-') ? tokenKey.split('-')[1] : tokenKey
        toggleFavorite(tokenAddress)
      } catch (error) {
        console.error('Failed to sync with useTokens hook:', error)
      }
    }
  }

  // ✅ FIXED: Strict chain-specific favorite checking
  const checkIsFavorite = (tokenKey: string) => {
    // Only check the exact chainId-address key to avoid cross-chain conflicts
    return favorites.has(tokenKey)
  }

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setHookSearchQuery('') // ✅ FIXED: Clear search query properly
      setShowFilters(false)
      // Don't clear apiTokens to cache them
    }
  }, [isOpen, setHookSearchQuery])

  const handleSelectToken = (token: Token) => {
    // Add to recent tokens
    const newRecent = [token, ...recentTokens.filter(t => !(t.address === token.address && t.chainId === token.chainId))].slice(0, 10)
    setRecentTokens(newRecent)
    
    // Save to localStorage
    try {
      localStorage.setItem('recentTokens', JSON.stringify(newRecent))
    } catch (error) {
      console.error('Failed to save recent tokens:', error)
    }
    
    onSelectToken(token)
    onClose()
  }

  // Copy address to clipboard
  const handleCopyAddress = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(address)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  // ✅ FIXED: Use hook search query for all logic
  const hasResults = filteredTokens.length > 0
  const isLoading = apiLoading || searchLoading
  const error = apiError || tokensError
  const showEmptyState = !isLoading && !hasResults

  // ✅ FIXED: Calculate accurate tab counts based on actual filtered results
  const getTabCounts = useMemo(() => {
    // Base tokens for counting (same as availableTokens but we need to calculate each category)
    let baseTokens: Token[] = []
    
    if (searchHasQuery) {
      // In search mode, use search results
      const apiResults = searchTokens.length > 0 ? searchTokens : []
      const localTokens = Object.values(EMERGENCY_FALLBACK).flat()
      const query = hookSearchQuery.toLowerCase().trim()
      const localMatches = localTokens.filter((token: Token) => {
        const symbolMatch = token.symbol.toLowerCase().includes(query)
        const nameMatch = token.name.toLowerCase().includes(query)
        const addressMatch = token.address.toLowerCase().includes(query)
        return symbolMatch || nameMatch || addressMatch
      })
      
      const combined = [...apiResults]
      const existingAddresses = new Set(apiResults.map(t => t.address.toLowerCase()))
      
      localMatches.forEach(token => {
        if (!existingAddresses.has(token.address.toLowerCase())) {
          combined.push(token)
        }
      })
      
      baseTokens = combined
    } else {
      // Non-search mode
      if (apiTokens.length > 0) {
        baseTokens = apiTokens
      } else {
        baseTokens = Object.values(EMERGENCY_FALLBACK).flat()
      }
    }
    
    // Apply testnet filtering
    const filteredBaseTokens = baseTokens.filter(token => {
      const tokenIsTestnet = isTestnetChain(token.chainId)
      return isTestnet ? tokenIsTestnet : !tokenIsTestnet
    })
    
    // Calculate counts for each tab
    const allCount = filteredBaseTokens.length
    
    const popularCount = filteredBaseTokens.filter(token => token.popular).length
    
    const recentCount = recentTokens.filter(recent => 
      filteredBaseTokens.some(available => 
        available.address === recent.address && available.chainId === recent.chainId
      )
    ).length
    
    const favoritesCount = filteredBaseTokens.filter((token: Token) => {
      const tokenKey = `${token.chainId}-${token.address}`
      return favorites.has(tokenKey)
    }).length
    
    return {
      all: allCount,
      popular: popularCount,
      recent: recentCount,
      favorites: favoritesCount
    }
  }, [searchHasQuery, searchTokens, hookSearchQuery, apiTokens, isTestnet, recentTokens, favorites])

  if (!isOpen || !isMounted) return null

  const modalContent = (
    <>
      {/* ✅ FIXED: Backdrop with proper z-index */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* ✅ FIXED: Modal Container with higher z-index */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl 
                       pointer-events-auto transform transition-all duration-300 
                       animate-in slide-in-from-bottom-8 fade-in-0 relative">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, symbol, or paste token address..."
                value={hookSearchQuery}
                onChange={(e) => setHookSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl 
                         text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700
                         transition-all duration-200 text-lg"
              />
              {hookSearchQuery && (
                <button
                  onClick={() => setHookSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 
                           text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isLoading && (
                <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>

            {/* Search Status */}
            {searchHasQuery && filteredTokens.length > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {filteredTokens.length} result{filteredTokens.length !== 1 ? 's' : ''} found
              </div>
            )}

            {/* Tabs */}
            {!searchHasQuery && (
              <div className="space-y-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
                  {[
                    { key: 'all', label: 'All', icon: Coins, count: getTabCounts.all },
                    { key: 'popular', label: 'Popular', icon: TrendingUp, count: getTabCounts.popular },
                    { key: 'recent', label: 'Recent', icon: Clock, count: getTabCounts.recent },
                    { 
                      key: 'favorites', 
                      label: 'Favorites',
                      icon: Star,
                      count: getTabCounts.favorites
                    },
                  ].map(({ key, label, icon: Icon, count }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200",
                        activeTab === key 
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                      {count > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-xs min-w-[18px] text-center",
                          activeTab === key 
                            ? 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        )}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Filter and Sort Controls */}
                <div className="flex items-center gap-2">
                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="price">Sort by Price</option>
                    <option value="marketCap">Sort by Market Cap</option>
                    <option value="volume">Sort by Volume</option>
                    <option value="change">Sort by 24h Change</option>
                  </select>

                  {/* Sort Direction */}
                  <button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={`Sort ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
                  >
                    <ArrowUpDown className={cn("w-4 h-4", sortDirection === 'desc' && "rotate-180")} />
                  </button>

                  {/* Risk Filter */}
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value as any)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Tokens</option>
                    <option value="verified">Verified Only</option>
                    <option value="unverified">Unverified Only</option>
                  </select>

                  {/* Show Balances Toggle */}
                  <button
                    onClick={() => setShowBalances(!showBalances)}
                    className={cn(
                      "p-2 border rounded-lg transition-colors",
                      showBalances 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    title={showBalances ? 'Hide Balances' : 'Show Balances'}
                  >
                    {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {isLoading ? (
              // ✅ FIXED: Skeleton shimmer loading for better UX
              <div className="py-2 space-y-1">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="group flex items-start gap-4 px-4 py-4 mx-2 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                    {/* Token Logo Skeleton */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full animate-pulse" />
                      {/* Native Badge Skeleton */}
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full animate-pulse" />
                    </div>

                    {/* Token Info Skeleton */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Symbol + Chain Badge */}
                      <div className="flex items-center gap-2">
                        <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse w-20" />
                        <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-lg animate-pulse w-16" />
                      </div>
                      
                      {/* Token Name */}
                      <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse w-32" />
                      
                      {/* Security Tags */}
                      <div className="flex items-center gap-2">
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-md animate-pulse w-16" />
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-md animate-pulse w-14" />
                      </div>
                    </div>

                    {/* Price Skeleton */}
                    <div className="text-right flex-shrink-0 min-w-0">
                      <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse w-16 ml-auto" />
                    </div>

                    {/* Favorite Button Skeleton */}
                    <div className="w-6 h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-lg animate-pulse flex-shrink-0" />
                  </div>
                ))}
                
                {/* Loading text */}
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    {searchHasQuery ? 'Searching tokens...' : 'Loading popular tokens...'}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Failed to load tokens
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-4">
                  {error instanceof Error ? error.message : 'Unable to fetch token data. Using fallback tokens.'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : showEmptyState ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchHasQuery ? 'No tokens found' : 'No tokens available'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
                  {searchHasQuery ? (
                    'Try searching with a different term, symbol, or paste a token address'
                  ) : (
                    'Switch to a supported chain or check your network connection'
                  )}
                </p>
              </div>
            ) : (
              <div className="py-2 space-y-1">
                {/* Flat list sorted by chain priority */}
                {filteredTokens.map((token, index) => (
                  <TokenRow
                    key={`${token.chainId}-${token.address}`}
                    token={token}
                    isSelected={
                      currentToken?.address === token.address && 
                      currentToken?.chainId === token.chainId
                    }
                    isFavorite={checkIsFavorite(`${token.chainId}-${token.address}`)}
                    onSelect={() => handleSelectToken(token)}
                    onToggleFavorite={() => handleToggleFavorite(`${token.chainId}-${token.address}`)}
                    searchQuery={hookSearchQuery}
                    index={index}
                    showBalances={showBalances}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-3xl">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {filteredTokens.length} {filteredTokens.length === 1 ? 'token' : 'tokens'} available
              </span>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}

interface TokenRowProps {
  token: Token
  isSelected: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  searchQuery: string
  index: number
  showBalances: boolean
}

function TokenRow({ 
  token, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite, 
  searchQuery,
  index,
  showBalances
}: TokenRowProps) {
  const [imageError, setImageError] = useState(false)
  const [showFullAddress, setShowFullAddress] = useState(false)

  // Highlight search matches
  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded px-1">
          {part}
        </mark>
      ) : part
    )
  }

  // Format address for display
  const formatAddress = (address: string) => {
    if (address === '0x0000000000000000000000000000000000000000') return 'Native Token'
    return showFullAddress ? address : `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Copy address to clipboard
  const handleCopyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(token.address)
      // Add toast notification here if available
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  // Get verification status
  const getVerificationStatus = () => {
    if (token.verified) return { status: 'verified', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle }
    if (token.verified === false) return { status: 'unverified', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle }
    return { status: 'unknown', color: 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400', icon: AlertCircle }
  }

  // Format price change
  const formatPriceChange = (change: any) => {
    // Convert to number and validate
    let numericChange: number
    
    try {
      // Handle different input types
      if (change === undefined || change === null || change === '') {
        numericChange = 0
      } else if (typeof change === 'string') {
        numericChange = parseFloat(change)
      } else if (typeof change === 'number') {
        numericChange = change
      } else {
        // For objects, arrays, or other types
        numericChange = 0
      }
      
      // Final validation
      if (isNaN(numericChange) || !isFinite(numericChange)) {
        numericChange = 0
      }
    } catch (error) {
      console.warn('Error parsing price change:', change, error)
      numericChange = 0
    }
    
    // Return formatted result
    if (numericChange === 0) {
      return {
        value: '0.00%',
        color: 'text-gray-500 dark:text-gray-400'
      }
    }
    
    const isPositive = numericChange > 0
    return {
      value: `${isPositive ? '+' : ''}${numericChange.toFixed(2)}%`,
      color: isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    }
  }

  // Format large numbers with K, M, B suffixes
  const formatCompactCurrency = (amount: number | undefined | null) => {
    // Handle invalid or missing values
    if (amount === undefined || amount === null || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      return '-'
    }
    
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`
    return formatCurrency(amount)
  }

  const chainInfo = CHAIN_CONFIG[token.chainId as keyof typeof CHAIN_CONFIG]
  const verification = getVerificationStatus()

  return (
    <div 
      className={cn(
        "group flex items-start gap-3 px-4 py-3 mx-2 rounded-2xl cursor-pointer transition-all duration-200",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm",
        isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20 shadow-md"
      )}
      onClick={onSelect}
    >
      {/* Token Logo */}
      <div className="relative flex-shrink-0">
        {token.logoURI && !imageError ? (
          <div className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
            <img 
              src={token.logoURI} 
              alt={token.symbol}
              className="w-full h-full object-cover object-center"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700">
            {token.symbol.charAt(0)}
          </div>
        )}
        
        {/* Verification Badge - top-right */}
        <div className={cn(
          "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm",
          verification.color
        )}>
          <verification.icon className="w-2.5 h-2.5" />
        </div>
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header: Symbol + Chain */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
              {highlightText(token.symbol, searchQuery)}
            </h3>
            {token.isNative && (
              <div className="flex items-center justify-center w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
                <Zap className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          
          {/* Chain Badge */}
          {chainInfo && (
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white",
              chainInfo.color
            )}>
              <ChainIcon icon={chainInfo.icon} size="xs" />
              <span className="hidden sm:inline">{chainInfo.name}</span>
            </div>
          )}
        </div>

        {/* Token Name & Address */}
        <div className="space-y-0.5">
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
            {highlightText(token.name, searchQuery)}
          </p>
          
          {/* Address with copy function */}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">{formatAddress(token.address)}</span>
            {token.address !== '0x0000000000000000000000000000000000000000' && (
              <button
                onClick={handleCopyAddress}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Copy address"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tags & Status */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Verification Status */}
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 text-xs rounded font-medium",
            verification.color
          )}>
            <verification.icon className="w-3 h-3" />
            <span className="capitalize">{verification.status}</span>
          </div>

          {/* Popular Tag */}
          {token.popular && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>Popular</span>
            </div>
          )}

          {/* Token Tags */}
          {token.tags?.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Market Data */}
      <div className="text-right flex-shrink-0 min-w-0 space-y-0.5">
        {/* Price */}
        {token.priceUSD ? (
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(token.priceUSD)}
          </p>
        ) : (
          <p className="text-sm text-gray-400">-</p>
        )}

        {/* 24h Change */}
        {token.change24h !== undefined && token.change24h !== null && !isNaN(token.change24h) && (
          <p className={cn("text-xs font-medium", formatPriceChange(token.change24h).color)}>
            {formatPriceChange(token.change24h).value}
          </p>
        )}

        {/* Market Cap */}
        {token.marketCap && token.marketCap > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            MC: {formatCompactCurrency(token.marketCap)}
          </p>
        )}

        {/* Volume 24h */}
        {token.volume24h && token.volume24h > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Vol: {formatCompactCurrency(token.volume24h)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            "opacity-0 group-hover:opacity-100",
            isFavorite 
              ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 opacity-100' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
        </button>

        {/* Portfolio Balance - placeholder for future wallet integration */}
        {showBalances && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Portfolio balance"
            >
              <Wallet className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 