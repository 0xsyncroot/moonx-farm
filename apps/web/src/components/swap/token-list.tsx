'use client'

import { useState, useEffect } from 'react'
import { Star, TrendingUp, TrendingDown, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TokenData {
  address: string
  symbol: string
  name: string
  decimals: number
  chainId: number
  priceUSD?: number
  change24h?: number
  volume24h?: number
  logoURI?: string
  isNative: boolean
  popular: boolean
}

interface TokenListResponse {
  tokens: TokenData[]
  total: number
  updatedAt: string
  metadata: {
    source: string
    type: string
  }
}

export function TokenList() {
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>(['ETH', 'BTC'])
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch popular tokens from API
  useEffect(() => {
    const fetchPopularTokens = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const aggregatorApiUrl = process.env.NEXT_PUBLIC_AGGREGATOR_API_URL || 'http://localhost:3003/api/v1'
        const response = await fetch(`${aggregatorApiUrl}/tokens/popular`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data: TokenListResponse = await response.json()
        setTokens(data.tokens || [])
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
  }, [])

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    )
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
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading tokens...</span>
          </div>
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
            const isFavorite = favorites.includes(token.symbol)
            const hasPrice = token.priceUSD && token.priceUSD > 0

            return (
              <div
                key={`${token.address}-${token.chainId}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleFavorite(token.symbol)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      isFavorite ? "text-warning" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
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