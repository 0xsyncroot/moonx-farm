'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { RefreshCw, Search, Eye, EyeOff, PieChart, ArrowUp, ArrowDown } from 'lucide-react'

export function TokenHoldings() {
  const { holdings, isLoading, error, refresh, refreshing, cacheAge } = useTokenHoldings()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'value' | 'allocation' | 'symbol' | 'balance'>('value')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [hideSmallHoldings, setHideSmallHoldings] = useState(false)

  // Memoize the data to prevent useMemo dependency issues
  const data = useMemo(() => holdings || [], [holdings])

  // Filter and sort holdings
  const filteredHoldings = useMemo(() => {
    const filtered = data.filter(holding => {
      const matchesSearch = holding.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           holding.tokenName?.toLowerCase().includes(searchTerm.toLowerCase())
      const meetsMinimum = !hideSmallHoldings || holding.valueUSD >= 5 // $5 minimum
      return matchesSearch && meetsMinimum
    })

    // Sort holdings
    filtered.sort((a, b) => {
      let aValue: number | string, bValue: number | string
      switch (sortBy) {
        case 'value':
          aValue = a.valueUSD
          bValue = b.valueUSD
          break
        case 'allocation':
          aValue = a.allocation || 0
          bValue = b.allocation || 0
          break
        case 'symbol':
          aValue = a.tokenSymbol
          bValue = b.tokenSymbol
          break
        case 'balance':
          // Use balanceFormatted for numeric comparison
          aValue = a.balanceFormatted || 0
          bValue = b.balanceFormatted || 0
          break
        default:
          aValue = a.valueUSD
          bValue = b.valueUSD
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }
      return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
    })

    return filtered
  }, [data, searchTerm, sortBy, sortOrder, hideSmallHoldings])

  // Format currency
  const formatCurrency = (value: number) => {
    if (value < 0.01) return '$0.00'
    if (value < 1) return `$${value.toFixed(4)}`
    if (value < 1000) return `$${value.toFixed(2)}`
    if (value < 1000000) return `$${(value / 1000).toFixed(1)}K`
    return `$${(value / 1000000).toFixed(1)}M`
  }

  // Format balance - expects number from API
  const formatBalance = (balanceFormatted: number) => {
    if (isNaN(balanceFormatted) || balanceFormatted === 0) return '0'
    
    if (balanceFormatted < 0.0001) return balanceFormatted.toExponential(2)
    if (balanceFormatted < 1) return balanceFormatted.toFixed(6)
    if (balanceFormatted < 1000) return balanceFormatted.toFixed(4)
    if (balanceFormatted < 1000000) return `${(balanceFormatted / 1000).toFixed(1)}K`
    return `${(balanceFormatted / 1000000).toFixed(1)}M`
  }

  // Calculate total value
  const totalValue = data.reduce((sum, holding) => sum + holding.valueUSD, 0)

  // Categorize holdings
  const largeHoldings = filteredHoldings.filter(h => h.valueUSD >= 1000)
  const mediumHoldings = filteredHoldings.filter(h => h.valueUSD >= 100 && h.valueUSD < 1000)
  const smallHoldings = filteredHoldings.filter(h => h.valueUSD < 100)

  // Calculate cache freshness
  const isDataFresh = cacheAge < 2 * 60 * 1000 // 2 minutes
  const cacheMinutes = Math.floor(cacheAge / 60000)

  // Toggle sort order
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Shimmer loading overlay component
  const ShimmerOverlay = () => (
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-primary/70" />
          <div>
            <h2 className="text-lg font-semibold">Token Holdings</h2>
            <p className="text-xs text-muted-foreground">Portfolio positions</p>
          </div>
          {!isDataFresh && !refreshing && !isLoading && (
            <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
              {cacheMinutes}m ago
            </span>
          )}
          {(refreshing || isLoading) && (
            <span className="text-xs text-primary bg-primary/20 px-2 py-1 rounded flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {isLoading ? 'Loading...' : 'Updating...'}
            </span>
          )}
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing || isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
          <span className="font-medium">
            {refreshing ? 'Refreshing...' : isLoading ? 'Loading...' : 'Refresh'}
          </span>
        </button>
      </div>

      {/* Show error state */}
      {error && !refreshing && !isLoading && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-center">
          <div className="text-error font-medium mb-2">Failed to load holdings data</div>
          <div className="text-sm text-muted-foreground">
            {holdings ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Summary Statistics with shimmer loading */}
      <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-4 transition-opacity relative`}>
        {(isLoading || refreshing) && <ShimmerOverlay />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{filteredHoldings.length}</div>
            <div className="text-xs text-muted-foreground">Total Holdings</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-success">{largeHoldings.length}</div>
            <div className="text-xs text-muted-foreground">Large ($1K+)</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-warning">{mediumHoldings.length}</div>
            <div className="text-xs text-muted-foreground">Medium ($100+)</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-muted-foreground">{smallHoldings.length}</div>
            <div className="text-xs text-muted-foreground">Small (&lt;$100)</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
          />
        </div>

        {/* Hide Small Holdings Toggle */}
        <button
          onClick={() => setHideSmallHoldings(!hideSmallHoldings)}
          className={`flex items-center gap-2 px-3 py-2 text-sm border border-border/50 rounded-lg transition-colors ${
            hideSmallHoldings
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-card/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          {hideSmallHoldings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Hide Small
        </button>
      </div>

      {/* Sort Headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/20 border border-border/30 rounded-lg text-xs font-medium text-muted-foreground">
        <div className="col-span-4">
          <button
            onClick={() => toggleSort('symbol')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Token
            {sortBy === 'symbol' && (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
        </div>
        <div className="col-span-2">
          <button
            onClick={() => toggleSort('balance')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Balance
            {sortBy === 'balance' && (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
        </div>
        <div className="col-span-3">
          <button
            onClick={() => toggleSort('value')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Value
            {sortBy === 'value' && (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
        </div>
        <div className="col-span-3">
          <button
            onClick={() => toggleSort('allocation')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Allocation
            {sortBy === 'allocation' && (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Holdings List with shimmer loading */}
      <div className={`space-y-2 relative`}>
        {(isLoading || refreshing) && filteredHoldings.length > 0 && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm rounded-xl">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
          </div>
        )}
        
        {filteredHoldings.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || hideSmallHoldings ? 'No holdings match your filters' : 'No holdings found'}
          </div>
        ) : filteredHoldings.length === 0 && isLoading ? (
          // Show skeleton items for initial loading
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-card/30 border border-border/30 rounded-lg relative overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%] absolute inset-0" />
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted/50"></div>
                  <div className="space-y-1">
                    <div className="h-4 w-16 bg-muted/50 rounded"></div>
                    <div className="h-3 w-20 bg-muted/30 rounded"></div>
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <div className="h-4 w-12 bg-muted/50 rounded ml-auto"></div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="h-4 w-16 bg-muted/50 rounded ml-auto"></div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="h-4 w-12 bg-muted/50 rounded ml-auto"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredHoldings.map((holding, index) => (
            <div
              key={`${holding.tokenSymbol}-${index}`}
              className="grid grid-cols-12 gap-2 items-center p-3 bg-card/30 border border-border/30 rounded-lg hover:bg-card/50 transition-colors group"
            >
              {/* Token Info */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center flex-shrink-0">
                  {holding.logoUrl ? (
                    <Image 
                      src={holding.logoUrl} 
                      alt={holding.tokenSymbol}
                      width={24}
                      height={24}
                      className="rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                        if (nextElement) {
                          nextElement.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div className={`text-xs font-bold text-primary ${holding.logoUrl ? 'hidden' : 'flex'}`}>
                    {holding.tokenSymbol.charAt(0)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{holding.tokenSymbol}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {holding.tokenName || 'Unknown Token'}
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="col-span-2 text-right">
                <div className="text-sm font-medium">{formatBalance(holding.balanceFormatted)}</div>
                <div className="text-xs text-muted-foreground">
                  {holding.tokenSymbol}
                </div>
              </div>

              {/* Value */}
              <div className="col-span-3 text-right">
                <div className="text-sm font-medium">{formatCurrency(holding.valueUSD)}</div>
                <div className="text-xs text-muted-foreground">
                  {holding.priceUSD ? `$${holding.priceUSD.toFixed(6)}` : 'N/A'}
                </div>
              </div>

              {/* Allocation */}
              <div className="col-span-3 text-right">
                <div className="text-sm font-medium">{(holding.allocation || 0).toFixed(2)}%</div>
                <div className="w-full bg-muted/20 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/70 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(holding.allocation || 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Holdings Summary */}
      {filteredHoldings.length > 0 && (
        <div className={`bg-gradient-to-r from-card/50 to-card/30 backdrop-blur-xl border border-border/30 rounded-xl p-4 transition-opacity relative`}>
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-foreground">Portfolio Summary</h4>
              <p className="text-sm text-muted-foreground">
                {filteredHoldings.length} holdings • {formatCurrency(totalValue)} total value
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-foreground">{formatCurrency(totalValue)}</div>
              <div className="text-xs text-muted-foreground">Total Value</div>
            </div>
          </div>
          
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/30">
            <div className="text-center">
              <div className="text-sm font-bold text-success">{largeHoldings.length}</div>
              <div className="text-xs text-muted-foreground">Large Holdings</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-primary">
                {filteredHoldings.length > 0 ? (filteredHoldings[0].allocation || 0).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Top Allocation</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-foreground">
                {filteredHoldings.length > 5 ? 'High' : filteredHoldings.length > 2 ? 'Medium' : 'Low'}
              </div>
              <div className="text-xs text-muted-foreground">Diversification</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 