'use client'

import { useState, useEffect } from 'react'
import { Star, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aggregatorApi, Token, TokenListResponse } from '@/lib/api-client'
import { useTestnetMode } from '@/components/ui/testnet-toggle'

export function TokenList() {
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>([]) // Will store "address-chainId" format
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Get current testnet mode
  const isTestnet = useTestnetMode()

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('tokenFavorites')
    if (savedFavorites) {
      try {
        const favoritesArray = JSON.parse(savedFavorites) as string[]
        setFavorites(favoritesArray)
      } catch (error) {
        console.error('Failed to parse favorites:', error)
        localStorage.removeItem('tokenFavorites')
        setFavorites([])
      }
    }
  }, [])

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('tokenFavorites', JSON.stringify(favorites))
    } catch (error) {
      console.error('Failed to save favorites:', error)
    }
  }, [favorites])

  // Fetch popular tokens from API using api-client
  useEffect(() => {
    const fetchPopularTokens = async () => {
      try {
        setLoading(true)
        setError(null)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 TokenList: Fetching popular tokens with testnet:', isTestnet)
        }
        
        const data = await aggregatorApi.getPopularTokens({ 
          testnet: isTestnet 
        })
        
        setTokens(data.tokens || [])
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ TokenList: Loaded', data.tokens?.length || 0, 'popular tokens for', isTestnet ? 'testnet' : 'mainnet')
        }
      } catch (err) {
        console.error('Failed to fetch popular tokens:', err)
        setError('Failed to load tokens. Please try again.')
        // Fallback to empty array
        setTokens([])
      } finally {
        setLoading(false)
      }
    }

    fetchPopularTokens()
  }, [isTestnet]) // Re-fetch when testnet mode changes

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Helper function to create unique token ID
  const getTokenId = (token: Token) => `${token.address}-${token.chainId}`

  // Updated toggle favorite function using address + chainId
  const toggleFavorite = (token: Token) => {
    const tokenId = getTokenId(token)
    setFavorites(prev =>
      prev.includes(tokenId)
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    )
  }

  // Helper function to check if token is favorite
  const isFavorite = (token: Token) => {
    return favorites.includes(getTokenId(token))
  }

  const formatVolume = (volume?: number) => {
    if (!volume) return 'N/A'
    
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`
    }
    if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`
    }
    return `$${(volume / 1e3).toFixed(2)}K`
  }

  const formatPrice = (price?: number) => {
    if (!price || price === 0) return 'N/A'
    
    return price.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 4 : 2
    })
  }

  if (loading) {
    return (
      <div className="trade-card h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Tokens</h3>
          <div className="w-12 h-4 bg-muted animate-pulse rounded"></div>
        </div>
        
        {/* Search Skeleton */}
        <div className="relative mb-4">
          <div className="w-full h-10 bg-muted animate-pulse rounded-lg"></div>
        </div>
        
        {/* Token List Skeleton */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                {/* Star skeleton */}
                <div className="w-5 h-5 bg-muted animate-pulse rounded-full"></div>
                
                {/* Token logo skeleton */}
                <div className="w-8 h-8 bg-muted animate-pulse rounded-full"></div>
                
                <div className="space-y-1">
                  {/* Token symbol skeleton */}
                  <div className="flex items-center space-x-2">
                    <div className="w-12 h-4 bg-muted animate-pulse rounded"></div>
                    <div className="w-16 h-3 bg-muted animate-pulse rounded"></div>
                  </div>
                  {/* Token name skeleton */}
                  <div className="w-24 h-3 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
              
              <div className="text-right space-y-1">
                {/* Price skeleton */}
                <div className="w-16 h-4 bg-muted animate-pulse rounded ml-auto"></div>
                {/* Change skeleton */}
                <div className="w-12 h-3 bg-muted animate-pulse rounded ml-auto"></div>
                {/* Volume skeleton */}
                <div className="w-14 h-3 bg-muted animate-pulse rounded ml-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="trade-card h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Tokens</h3>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 text-primary hover:underline text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="trade-card h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Top Tokens</h3>
        <span className="text-xs text-muted-foreground">
          {tokens.length} tokens
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Token List */}
      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        {filteredTokens.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No tokens found</p>
          </div>
        ) : (
          filteredTokens.map((token) => {
            const isPositive = (token.change24h || 0) > 0
            const isTokenFav = isFavorite(token)
            const hasPrice = token.priceUSD && token.priceUSD > 0

            return (
              <div
                key={getTokenId(token)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleFavorite(token)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      isTokenFav ? "text-warning" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Star className={cn("h-3 w-3", isTokenFav && "fill-current")} />
                  </button>

                  {token.logoURI && (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="h-8 w-8 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{token.symbol}</span>
                      {token.isNative && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          Native
                        </span>
                      )}
                      {token.popular && (
                        <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {token.name}
                      <span className="ml-2 text-xs">Chain {token.chainId}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-medium">
                    {formatPrice(token.priceUSD)}
                  </div>
                  
                  {hasPrice && token.change24h !== undefined && (
                    <div className="flex items-center justify-end space-x-1">
                      <div className={cn(
                        "flex items-center space-x-1 text-sm",
                        isPositive ? "text-success" : "text-error"
                      )}>
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{isPositive ? '+' : ''}{token.change24h.toFixed(2)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Vol: {formatVolume(token.volume24h)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
} 