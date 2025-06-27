'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Search, Star, TrendingUp, Zap } from 'lucide-react'
import { useTokens, Token } from '@/hooks/use-tokens'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface TokenSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectToken: (token: Token) => void
  currentToken?: Token | null
  chainId?: number
  title?: string
}

// Fallback tokens for different chains
const FALLBACK_TOKENS: Record<number, Token[]> = {
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
      priceUSD: 2500,
      change24h: 2.5,
    },
    {
      address: '0xA0b86a33E6417fA6C08Bf0f1B6a3D4BB6Ac0f3c3',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1,
      verified: true,
      popular: true,
      priceUSD: 1.0,
      change24h: 0.1,
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 1,
      verified: true,
      popular: true,
      priceUSD: 1.0,
      change24h: -0.05,
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
      chainId: 1,
      verified: true,
      popular: true,
      priceUSD: 67000,
      change24h: 1.8,
    },
  ],
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
      priceUSD: 2500,
      change24h: 2.5,
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
      verified: true,
      popular: true,
      priceUSD: 1.0,
      change24h: 0.1,
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
      priceUSD: 320,
      change24h: 1.2,
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      chainId: 56,
      verified: true,
      popular: true,
      priceUSD: 1.0,
      change24h: 0.1,
    },
  ],
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelectToken,
  currentToken,
  chainId = 1,
  title = 'Select a token'
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'popular' | 'search' | 'favorites'>('popular')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const {
    tokens,
    popularTokens,
    favoriteTokens: hookFavoriteTokens,
    isLoading,
    toggleFavorite,
    isFavorite,
  } = useTokens(chainId)

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

  // Use fallback tokens if no tokens from API
  const availableTokens = useMemo(() => {
    if (tokens.length > 0) {
      return tokens
    }
    return FALLBACK_TOKENS[chainId] || []
  }, [tokens, chainId])

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableTokens
    }

    const query = searchQuery.toLowerCase().trim()
    return availableTokens.filter(token => 
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    )
  }, [availableTokens, searchQuery])

  // Get popular tokens
  const displayPopularTokens = useMemo(() => {
    if (popularTokens.length > 0) {
      return popularTokens
    }
    // Fallback to first 6 popular tokens
    return (FALLBACK_TOKENS[chainId] || []).filter(token => token.popular).slice(0, 6)
  }, [popularTokens, chainId])

  // Get favorite tokens
  const displayFavoriteTokens = useMemo(() => {
    if (hookFavoriteTokens.length > 0) {
      return hookFavoriteTokens
    }
    // Fallback to local favorites
    return availableTokens.filter(token => favorites.has(token.address))
  }, [hookFavoriteTokens, availableTokens, favorites])

  // Local favorite management
  const handleToggleFavorite = (tokenAddress: string) => {
    if (toggleFavorite) {
      toggleFavorite(tokenAddress)
    } else {
      // Fallback to local management
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

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setActiveTab('popular')
    }
  }, [isOpen])

  // Auto-switch to search tab when typing
  useEffect(() => {
    if (searchQuery.trim() && activeTab !== 'search') {
      setActiveTab('search')
    }
  }, [searchQuery, activeTab])

  const handleSelectToken = (token: Token) => {
    onSelectToken(token)
    onClose()
  }

  const getTokensToShow = () => {
    switch (activeTab) {
      case 'popular':
        return displayPopularTokens
      case 'search':
        return filteredTokens
      case 'favorites':
        return displayFavoriteTokens
      default:
        return displayPopularTokens
    }
  }

  const tokensToShow = getTokensToShow()
  const hasSearchQuery = searchQuery.trim().length > 0
  const hasResults = tokensToShow.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background border border-primary/20 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary/10">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-primary/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search name or paste address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-primary/10 rounded-xl 
                       text-foreground placeholder-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                       transition-all duration-200"
              autoFocus
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-primary/10">
          {[
            { key: 'popular', label: 'Popular', icon: TrendingUp },
            { key: 'search', label: 'Search', icon: Search },
            { key: 'favorites', label: 'Favorites', icon: Star },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors
                ${activeTab === key 
                  ? 'text-primary border-b-2 border-primary' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              disabled={key === 'search' && !hasSearchQuery}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === 'favorites' && displayFavoriteTokens.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {displayFavoriteTokens.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="sm" />
            </div>
          ) : !hasResults ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Search className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {hasSearchQuery ? 'No tokens found' : 'No tokens available'}
              </p>
              {hasSearchQuery && (
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search term
                </p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {tokensToShow.map((token) => (
                <TokenRow
                  key={`${token.chainId}-${token.address}`}
                  token={token}
                  isSelected={currentToken?.address === token.address}
                  isFavorite={checkIsFavorite(token.address)}
                  onSelect={() => handleSelectToken(token)}
                  onToggleFavorite={() => handleToggleFavorite(token.address)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary/10 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {tokensToShow.length} tokens • Updated real-time
          </p>
        </div>
      </div>
    </div>
  )
}

interface TokenRowProps {
  token: Token
  isSelected: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}

function TokenRow({ token, isSelected, isFavorite, onSelect, onToggleFavorite }: TokenRowProps) {
  return (
    <div 
      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group
        ${isSelected ? 'bg-primary/10' : ''}
      `}
      onClick={onSelect}
    >
      {/* Token Logo */}
      <div className="relative flex-shrink-0">
        {token.logoURI ? (
          <img 
            src={token.logoURI} 
            alt={token.symbol}
            className="w-8 h-8 rounded-full"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full 
                         flex items-center justify-center text-sm font-bold text-primary">
            {token.symbol.charAt(0)}
          </div>
        )}
        
        {/* Native/Verified badges */}
        {token.isNative && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
            <Zap className="w-2 h-2 text-white" />
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">
            {token.symbol}
          </span>
          {token.verified && (
            <div className="w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-xs text-primary">✓</span>
            </div>
          )}
          {token.popular && (
            <TrendingUp className="w-3 h-3 text-primary" />
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {token.name}
        </p>
      </div>

      {/* Price & Change */}
      {(token.priceUSD || token.change24h !== undefined) && (
        <div className="text-right">
          {token.priceUSD && (
            <p className="text-sm font-medium text-foreground">
              {formatCurrency(token.priceUSD)}
            </p>
          )}
          {token.change24h !== undefined && (
            <p className={`text-xs ${
              token.change24h >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
            </p>
          )}
        </div>
      )}

      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        className={`p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100
          ${isFavorite 
            ? 'text-yellow-500 bg-yellow-500/10 opacity-100' 
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
      >
        <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  )
} 