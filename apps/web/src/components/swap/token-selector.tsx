'use client'

/**
 * TokenSelector - Jupiter-inspired token selection component
 * 
 * Modern UI Features:
 * - Clean, minimalist design with proper spacing
 * - Smooth animations and micro-interactions
 * - Smart search with instant results
 * - Visual token categories and suggestions
 * - Mobile-optimized responsive design
 * - Live price data with change indicators
 * - Accessibility-first approach
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { X, Search, Star, TrendingUp, Zap, ArrowUpRight, Filter, CheckCircle, AlertCircle } from 'lucide-react'
import { useTokens, Token } from '@/hooks/use-tokens'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

// Chain configurations with real logos
const CHAIN_CONFIG = {
  1: { 
    name: 'Ethereum', 
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: 'bg-blue-500',
    icon: '⟠'
  },
  8453: { 
    name: 'Base', 
    logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.svg',
    color: 'bg-blue-600',
    icon: '🔵'
  },
  56: { 
    name: 'BSC', 
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
    color: 'bg-yellow-500',
    icon: '🟡'
  },
  137: { 
    name: 'Polygon', 
    logo: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: 'bg-purple-500',
    icon: '🟣'
  },
}

interface TokenSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectToken: (token: Token) => void
  currentToken?: Token | null
  title?: string
}

// Emergency fallback - only essential tokens per chain
const EMERGENCY_FALLBACK: Record<number, Token[]> = {
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
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
      verified: true,
      popular: true,
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
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      chainId: 56,
      verified: true,
      popular: true,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'favorites'>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [apiTokens, setApiTokens] = useState<Token[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<Error | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const {
    tokens: searchTokens,
    popularTokens,
    favoriteTokens: hookFavoriteTokens,
    isLoading: searchLoading,
    toggleFavorite,
    isFavorite,
    error: tokensError,
    hasSearchQuery: searchHasQuery,
    loadPopularTokens,
  } = useTokens()

  // Load popular tokens when modal opens
  const loadTokensOnOpen = useCallback(async () => {
    if (!isOpen || searchHasQuery || apiTokens.length > 0) return
    
    setApiLoading(true)
    setApiError(null)
    
    try {
      const result = await loadPopularTokens()
      if (result?.tokens) {
        setApiTokens(result.tokens)
        console.log('🎯 [Modal Open] Loaded tokens:', result.tokens.length)
      }
    } catch (error) {
      console.error('❌ [Modal Open] Load failed:', error)
      setApiError(error instanceof Error ? error : new Error('Failed to load tokens'))
    } finally {
      setApiLoading(false)
    }
  }, [isOpen, searchHasQuery, apiTokens.length, loadPopularTokens])

  // Trigger load when modal opens
  useEffect(() => {
    loadTokensOnOpen()
  }, [loadTokensOnOpen])

  // Auto-focus search when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('tokenFavorites')
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)))
      } catch (error) {
        console.error('Failed to parse favorites:', error)
      }
    }
  }, [])

  // Simple token source logic
  const availableTokens = useMemo(() => {
    // Search mode: use search results or empty
    if (searchHasQuery) {
      return searchTokens.length > 0 ? searchTokens : []
    }
    
    // Non-search mode: use API tokens or fallback
    if (apiTokens.length > 0) {
      return apiTokens
    }
    
    // Fallback from all chains
    const fallbackTokens = Object.values(EMERGENCY_FALLBACK).flat()
    return fallbackTokens
  }, [searchHasQuery, searchTokens, apiTokens])

  // Group tokens by chain for better organization
  const tokensByChain = useMemo(() => {
    const grouped: Record<number, Token[]> = {}
    
    availableTokens.forEach(token => {
      if (!grouped[token.chainId]) {
        grouped[token.chainId] = []
      }
      grouped[token.chainId].push(token)
    })
    
    // Sort chains by priority: Base, Ethereum, BSC, Polygon, Others
    const chainPriority = [8453, 1, 56, 137]
    const sortedChains = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => {
        const aPriority = chainPriority.indexOf(a)
        const bPriority = chainPriority.indexOf(b)
        if (aPriority === -1 && bPriority === -1) return a - b
        if (aPriority === -1) return 1
        if (bPriority === -1) return -1
        return aPriority - bPriority
      })
    
    return sortedChains.reduce((acc, chainId) => {
      acc[chainId] = grouped[chainId]
      return acc
    }, {} as Record<number, Token[]>)
  }, [availableTokens])

  // Smart filtering with enhanced search and chain sorting
  const filteredTokens = useMemo(() => {
    let tokens: Token[] = []
    
    if (!searchQuery.trim()) {
      switch (activeTab) {
        case 'popular':
          tokens = popularTokens.length > 0 ? popularTokens : 
                   Object.values(EMERGENCY_FALLBACK).flat().filter((token: Token) => token.popular)
          break
        case 'favorites':
          tokens = hookFavoriteTokens.length > 0 ? hookFavoriteTokens :
                   availableTokens.filter((token: Token) => favorites.has(token.address))
          break
        default:
          tokens = availableTokens
      }
    } else {
      const query = searchQuery.toLowerCase().trim()
      tokens = availableTokens.filter((token: Token) => {
        const symbolMatch = token.symbol.toLowerCase().includes(query)
        const nameMatch = token.name.toLowerCase().includes(query)
        const addressMatch = token.address.toLowerCase().includes(query)
        
        return symbolMatch || nameMatch || addressMatch
      }).sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.symbol.toLowerCase() === query
        const bExact = b.symbol.toLowerCase() === query
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Then popular tokens
        if (a.popular && !b.popular) return -1
        if (!a.popular && b.popular) return 1
        
        return 0
      })
    }

    // Always sort by chain priority, then by symbol
    const chainPriority = [8453, 1, 56, 137] // Base, Ethereum, BSC, Polygon
    return tokens.sort((a, b) => {
      // First by chain priority
      const aPriority = chainPriority.indexOf(a.chainId)
      const bPriority = chainPriority.indexOf(b.chainId)
      
      if (aPriority !== bPriority) {
        if (aPriority === -1 && bPriority === -1) return a.chainId - b.chainId
        if (aPriority === -1) return 1
        if (bPriority === -1) return -1
        return aPriority - bPriority
      }
      
      // Then by symbol within same chain
      return a.symbol.localeCompare(b.symbol)
    })
  }, [availableTokens, searchQuery, activeTab, popularTokens, hookFavoriteTokens, favorites])

  // Local favorite management
  const handleToggleFavorite = (tokenAddress: string) => {
    if (toggleFavorite) {
      toggleFavorite(tokenAddress)
    } else {
      const newFavorites = favorites.has(tokenAddress)
        ? new Set(Array.from(favorites).filter(addr => addr !== tokenAddress))
        : new Set([...Array.from(favorites), tokenAddress])
      
      setFavorites(newFavorites)
      localStorage.setItem('tokenFavorites', JSON.stringify(Array.from(newFavorites)))
    }
  }

  const checkIsFavorite = (tokenAddress: string) => {
    if (isFavorite) {
      return isFavorite(tokenAddress)
    }
    return favorites.has(tokenAddress)
  }

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setShowFilters(false)
      // Don't clear apiTokens to cache them
    }
  }, [isOpen])

  const handleSelectToken = (token: Token) => {
    onSelectToken(token)
    onClose()
  }

  const hasLocalSearchQuery = searchQuery.trim().length > 0
  const hasResults = filteredTokens.length > 0
  const isLoading = apiLoading || searchLoading
  const error = apiError || tokensError
  const showEmptyState = !isLoading && !hasResults

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl 
                       pointer-events-auto transform transition-all duration-300 
                       animate-in slide-in-from-bottom-8 fade-in-0">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              {hasLocalSearchQuery && (
                <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {filteredTokens.length} found
                  </span>
                </div>
              )}
              {!hasLocalSearchQuery && availableTokens.length > 0 && (
                <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {availableTokens.length} tokens
                  </span>
                </div>
              )}
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
                placeholder="Search by name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl 
                         text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700
                         transition-all duration-200 text-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 
                           text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tabs */}
            {!hasLocalSearchQuery && (
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
                {[
                  { key: 'all', label: 'All Tokens', count: availableTokens.length },
                  { key: 'popular', label: 'Popular', count: popularTokens.length },
                  { key: 'favorites', label: 'Favorites', count: hookFavoriteTokens.length || favorites.size },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200",
                      activeTab === key 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    {key === 'popular' && <TrendingUp className="w-4 h-4" />}
                    {key === 'favorites' && <Star className="w-4 h-4" />}
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs",
                        activeTab === key 
                          ? 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {error ? (
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
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <LoadingSpinner size="sm" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  {hasLocalSearchQuery ? 'Searching tokens...' : 'Loading tokens...'}
                </p>
              </div>
            ) : showEmptyState ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {hasLocalSearchQuery ? 'No tokens found' : 'No tokens available'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
                  {hasLocalSearchQuery ? (
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
                    isSelected={currentToken?.address === token.address}
                    isFavorite={checkIsFavorite(token.address)}
                    onSelect={() => handleSelectToken(token)}
                    onToggleFavorite={() => handleToggleFavorite(token.address)}
                    searchQuery={searchQuery}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-3xl">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {filteredTokens.length} {filteredTokens.length === 1 ? 'token' : 'tokens'}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>{isLoading ? 'Loading...' : 'Live prices from Binance'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface TokenRowProps {
  token: Token
  isSelected: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  searchQuery: string
  index: number
}

function TokenRow({ 
  token, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite, 
  searchQuery,
  index
}: TokenRowProps) {
  const [imageError, setImageError] = useState(false)

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

  const chainInfo = CHAIN_CONFIG[token.chainId as keyof typeof CHAIN_CONFIG]

  return (
    <div 
      className={cn(
        "group flex items-center gap-4 px-4 py-3 mx-2 rounded-2xl cursor-pointer transition-all duration-200",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm",
        isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20 shadow-md"
      )}
      onClick={onSelect}
    >
      {/* Token Logo with Chain Badge */}
      <div className="relative flex-shrink-0">
        {token.logoURI && !imageError ? (
          <img 
            src={token.logoURI} 
            alt={token.symbol}
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700">
            {token.symbol.charAt(0)}
          </div>
        )}
        
        {/* Chain Badge - Small bottom-right corner */}
        {chainInfo && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm">
            {chainInfo.logo ? (
              <img 
                src={chainInfo.logo} 
                alt={chainInfo.name}
                className="w-2.5 h-2.5 rounded-full"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCAxMCAxMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNSIgY3k9IjUiIHI9IjUiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCAxMCAxMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHRleHQgeD0iNSIgeT0iNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSI2IiBmaWxsPSIjNjM3MjhGIj4/PC90ZXh0Pgo8L3N2Zz4='
                }}
              />
            ) : (
              <span className="text-xs">{chainInfo.icon}</span>
            )}
          </div>
        )}
        
        {/* Status badges - top-right */}
        {(token.isNative || token.popular) && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center">
            {token.isNative ? (
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Zap className="w-2 h-2 text-white" />
              </div>
            ) : token.popular ? (
              <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-2 h-2 text-white" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
            {highlightText(token.symbol, searchQuery)}
          </h3>
          {token.verified && (
            <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
                      {/* Chain name as subtle text */}
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {chainInfo?.name}
            </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate leading-tight">
          {highlightText(token.name, searchQuery)}
        </p>
        {token.tags && token.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {token.tags.slice(0, 1).map((tag, i) => (
              <span 
                key={i}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-md font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price & Stats */}
      {(token.priceUSD || token.change24h !== undefined) && (
        <div className="text-right space-y-0.5 flex-shrink-0 min-w-0">
          {token.priceUSD && (
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {formatCurrency(token.priceUSD)}
            </p>
          )}
          {token.change24h !== undefined && (
            <div className={cn(
              "flex items-center justify-end gap-1 text-xs font-medium",
              token.change24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              <ArrowUpRight className={cn(
                "w-3 h-3",
                token.change24h < 0 && "rotate-180"
              )} />
              <span>{Math.abs(token.change24h).toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        className={cn(
          "p-1.5 rounded-lg transition-all duration-200 flex-shrink-0",
          "opacity-0 group-hover:opacity-100",
          isFavorite 
            ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 opacity-100' 
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
      </button>
    </div>
  )
} 