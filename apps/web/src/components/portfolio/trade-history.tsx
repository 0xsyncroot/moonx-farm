'use client'

import { useState, useMemo } from 'react'
import { usePortfolioData } from '@/hooks/usePortfolioData'
import { RefreshCw, History, Filter, Search, ChevronDown, ChevronUp, ArrowRightLeft, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react'
import { formatUnits } from 'ethers'

export function TradeHistory() {
  const { trades, isLoading, error, refresh, refreshing, cacheAge } = usePortfolioData()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'swap' | 'buy' | 'sell'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Default to empty array if no data
  const data = trades || []

  // Filter trades with safe property access
  const filteredTrades = useMemo(() => {
    let filtered = data.filter(trade => {
      const tradeData = trade as any
      const fromSymbol = tradeData.fromToken?.symbol || tradeData.tokenIn?.symbol || ''
      const toSymbol = tradeData.toToken?.symbol || tradeData.tokenOut?.symbol || ''
      const txHash = tradeData.txHash || ''
      
      const matchesSearch = fromSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           toSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           txHash.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || 
                         (filterType === 'swap' && tradeData.type === 'swap') ||
                         (filterType === 'buy' && tradeData.type === 'buy') ||
                         (filterType === 'sell' && tradeData.type === 'sell')
      
      return matchesSearch && matchesType
    })

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [data, searchTerm, filterType])

  // Calculate summary statistics with safe property access
  const summary = useMemo(() => {
    const totalTrades = filteredTrades.length
    const totalVolume = filteredTrades.reduce((sum, trade) => {
      const tradeData = trade as any
      return sum + (tradeData.valueUSD || tradeData.fromToken?.valueUSD || 0)
    }, 0)
    const profitableTrades = filteredTrades.filter(trade => {
      const tradeData = trade as any
      const pnl = tradeData.profitLoss ?? tradeData.pnl?.netPnlUSD ?? 0
      return pnl > 0
    }).length
    const totalPnL = filteredTrades.reduce((sum, trade) => {
      const tradeData = trade as any
      return sum + (tradeData.profitLoss ?? tradeData.pnl?.netPnlUSD ?? 0)
    }, 0)
    
    return {
      totalTrades,
      totalVolume,
      profitableTrades,
      totalPnL,
      winRate: totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0
    }
  }, [filteredTrades])

  // Format currency
  const formatCurrency = (value: number) => {
    if (value < 0.01) return '$0.00'
    if (value < 1000) return `$${value.toFixed(2)}`
    if (value < 1000000) return `$${(value / 1000).toFixed(1)}K`
    return `$${(value / 1000000).toFixed(1)}M`
  }

  // Format token amounts properly using ethers.js
  const formatTokenAmount = (amount: string | number, decimals: number = 18) => {
    try {
      if (!amount) return '0'
      
      // Convert to string for ethers
      const amountStr = amount.toString()
      
      // Check if it's already formatted (contains decimal point)
      if (amountStr.includes('.') && parseFloat(amountStr) < 1000000) {
        const num = parseFloat(amountStr)
        if (num < 0.0001) return '< 0.0001'
        if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '')
        if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
        return num.toFixed(2)
      }
      
      // Format from raw amount using ethers
      const formatted = formatUnits(amountStr, decimals)
      const num = parseFloat(formatted)
      
      if (num < 0.0001) return '< 0.0001'
      if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '')
      if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
      if (num < 1000000) return `${(num / 1000).toFixed(2)}K`
      return `${(num / 1000000).toFixed(2)}M`
    } catch (error) {
      console.warn('Error formatting token amount:', error)
      return amount?.toString() || '0'
    }
  }

  // Format date
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Format time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get trade type color
  const getTradeTypeColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-success'
      case 'sell': return 'text-error'
      case 'swap': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  // Get trade type icon
  const getTradeTypeIcon = (type: string) => {
    switch (type) {
      case 'buy': return <TrendingUp className="h-4 w-4" />
      case 'sell': return <TrendingDown className="h-4 w-4" />
      case 'swap': return <ArrowRightLeft className="h-4 w-4" />
      default: return <ArrowRightLeft className="h-4 w-4" />
    }
  }

  // Calculate cache freshness
  const isDataFresh = cacheAge < 2 * 60 * 1000 // 2 minutes
  const cacheMinutes = Math.floor(cacheAge / 60000)

  // Shimmer loading overlay component
  const ShimmerOverlay = () => (
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
    </div>
  )

  // Get block explorer URL for chain
  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
    const explorerMap: { [key: number]: { url: string; name: string } } = {
      1: { url: 'https://etherscan.io', name: 'Etherscan' },
      56: { url: 'https://bscscan.com', name: 'BscScan' },
      8453: { url: 'https://basescan.org', name: 'BaseScan' },
      137: { url: 'https://polygonscan.com', name: 'PolygonScan' },
      42161: { url: 'https://arbiscan.io', name: 'Arbiscan' },
      10: { url: 'https://optimistic.etherscan.io', name: 'Optimism Explorer' },
      43114: { url: 'https://snowtrace.io', name: 'SnowTrace' },
      250: { url: 'https://ftmscan.com', name: 'FTMScan' },
      25: { url: 'https://cronoscan.com', name: 'CronoScan' },
      100: { url: 'https://gnosisscan.io', name: 'GnosisScan' },
    }
    
    const explorer = explorerMap[chainId] || explorerMap[1] // Default to Etherscan
    return {
      url: `${explorer.url}/tx/${txHash}`,
      name: explorer.name
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary/70" />
          <div>
            <h2 className="text-lg font-semibold">Trade History</h2>
            <p className="text-xs text-muted-foreground">Recent transactions</p>
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
          <div className="text-error font-medium mb-2">Failed to load trade history</div>
          <div className="text-sm text-muted-foreground">
            {trades ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Summary Statistics with shimmer loading */}
      <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-4 transition-opacity relative`}>
        {(isLoading || refreshing) && <ShimmerOverlay />}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{summary.totalTrades}</div>
            <div className="text-sm text-muted-foreground">Total Trades</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(summary.totalVolume)}</div>
            <div className="text-sm text-muted-foreground">Total Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{summary.profitableTrades}</div>
            <div className="text-sm text-muted-foreground">Profitable</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${summary.totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(summary.totalPnL)}
            </div>
            <div className="text-sm text-muted-foreground">Total P&L</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search trades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-card/50 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredTrades.length} of {data.length} trades
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="bg-card/30 border border-border/30 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Trade Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-card/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">All Types</option>
                  <option value="swap">Swaps</option>
                  <option value="buy">Buys</option>
                  <option value="sell">Sells</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trade List with shimmer loading */}
      <div className={`space-y-3 relative`}>
        {(isLoading || refreshing) && filteredTrades.length > 0 && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm rounded-xl">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
          </div>
        )}
        
        {filteredTrades.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm || filterType !== 'all' ? 'No trades match your filters' : 'No trades found'}
            </div>
            <div className="text-sm text-muted-foreground">
              {searchTerm || filterType !== 'all' ? 'Try adjusting your search or filters' : 'Your trading history will appear here'}
            </div>
          </div>
        ) : filteredTrades.length === 0 && isLoading ? (
          // Show skeleton items for initial loading
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="bg-card/30 border border-border/30 rounded-lg p-4 relative overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%] absolute inset-0" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted/50"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-muted/50 rounded"></div>
                      <div className="h-3 w-32 bg-muted/30 rounded"></div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-4 w-16 bg-muted/50 rounded ml-auto"></div>
                    <div className="h-3 w-12 bg-muted/30 rounded ml-auto"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredTrades.map((trade, index) => {
            const tradeData = trade as any
            return (
              <div
                key={`${tradeData.txHash || index}-${index}`}
                className="bg-card/30 border border-border/30 rounded-lg p-4 hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Trade Type Icon */}
                    <div className={`p-2 rounded-lg ${getTradeTypeColor(tradeData.type || 'swap')} bg-current/10`}>
                      {getTradeTypeIcon(tradeData.type || 'swap')}
                    </div>
                    
                    {/* Trade Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground capitalize">{tradeData.type || 'swap'}</span>
                        <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                          {tradeData.platform || tradeData.dexName || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatTokenAmount(tradeData.fromToken?.amount || '0', tradeData.fromToken?.decimals || 18)} {tradeData.fromToken?.symbol || 'Unknown'}</span>
                        <ArrowRightLeft className="h-3 w-3" />
                        <span>{formatTokenAmount(tradeData.toToken?.amount || '0', tradeData.toToken?.decimals || 18)} {tradeData.toToken?.symbol || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trade Value & P&L */}
                  <div className="text-right">
                    <div className="font-medium text-foreground">
                      {formatCurrency(tradeData.valueUSD || tradeData.fromToken?.valueUSD || 0)}
                    </div>
                    {(tradeData.profitLoss !== undefined || tradeData.pnl?.netPnlUSD !== undefined) && (
                      <div className={`text-sm ${(tradeData.profitLoss || tradeData.pnl?.netPnlUSD || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {(tradeData.profitLoss || tradeData.pnl?.netPnlUSD || 0) >= 0 ? '+' : ''}
                        {formatCurrency(tradeData.profitLoss || tradeData.pnl?.netPnlUSD || 0)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(tradeData.timestamp || new Date().toISOString())}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(tradeData.timestamp || new Date().toISOString())}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Gas: {formatCurrency(tradeData.gasFeeUSD || 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tradeData.txHash && (
                      <a
                        href={getBlockExplorerUrl(tradeData.chainId || 1, tradeData.txHash).url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary/80 underline"
                      >
                        View on {getBlockExplorerUrl(tradeData.chainId || 1, tradeData.txHash).name}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Load More Button */}
      {filteredTrades.length > 0 && filteredTrades.length >= 20 && (
        <div className="text-center pt-6">
          <button className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-card/50 transition-colors">
            Load More Trades
          </button>
        </div>
      )}
    </div>
  )
} 