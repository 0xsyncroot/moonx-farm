'use client'

import { useState } from 'react'
import { Star, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TokenData {
  symbol: string
  name: string
  price: number
  change24h: number
  volume24h: number
  logoUri?: string
}

const MOCK_TOKENS: TokenData[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3247.82,
    change24h: 2.4,
    volume24h: 12450000000,
    logoUri: '/tokens/eth.png'
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67234.56,
    change24h: -1.2,
    volume24h: 8760000000,
    logoUri: '/tokens/btc.png'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    price: 1.00,
    change24h: 0.1,
    volume24h: 5430000000,
    logoUri: '/tokens/usdc.png'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    price: 0.999,
    change24h: -0.05,
    volume24h: 15620000000,
    logoUri: '/tokens/usdt.png'
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    price: 634.23,
    change24h: 3.8,
    volume24h: 2340000000,
    logoUri: '/tokens/bnb.png'
  }
]

export function TokenList() {
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>(['ETH', 'BTC'])

  const filteredTokens = MOCK_TOKENS.filter(token =>
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

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`
    }
    if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`
    }
    return `$${(volume / 1e3).toFixed(2)}K`
  }

  return (
    <div className="trade-card h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Top Tokens</h3>
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
        {filteredTokens.map((token) => {
          const isPositive = token.change24h > 0
          const isFavorite = favorites.includes(token.symbol)

          return (
            <div
              key={token.symbol}
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

                {token.logoUri && (
                  <img
                    src={token.logoUri}
                    alt={token.symbol}
                    className="h-8 w-8 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}

                <div>
                  <div className="font-medium">{token.symbol}</div>
                  <div className="text-sm text-muted-foreground">{token.name}</div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="font-medium">
                  ${token.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: token.price < 1 ? 4 : 2
                  })}
                </div>
                
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

                <div className="text-xs text-muted-foreground">
                  Vol: {formatVolume(token.volume24h)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 