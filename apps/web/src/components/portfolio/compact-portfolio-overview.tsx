'use client'

import { usePortfolioOverview } from '@/hooks/usePortfolioOverview'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Activity, Target, PieChart, Wallet } from 'lucide-react'

export function CompactPortfolioOverview() {
  const { overview, isLoading, error, refresh, refreshing, cacheAge } = usePortfolioOverview()

  // Default to zero values if no data
  const data = overview || {
    totalValue: 0,
    totalChange: 0,
    totalChangePercent: 0,
    totalInvested: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
  }

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value)
    
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    if (absValue === 0) {
      return '$0.00'
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Helper function to format percentage
  const formatPercentage = (value: number) => {
    if (value === -100) {
      return '-100%'
    }
    if (Math.abs(value) > 1000) {
      return `${value >= 0 ? '+' : ''}${Math.round(value)}%`
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary/70" />
          <h2 className="text-lg font-semibold">Portfolio Summary</h2>
          {!isDataFresh && !refreshing && !isLoading && (
            <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
              {cacheMinutes}m ago
            </span>
          )}
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing || isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Show error state */}
      {error && !refreshing && !isLoading && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-center">
          <div className="text-error font-medium text-sm">Failed to load portfolio data</div>
          <div className="text-xs text-muted-foreground">
            {overview ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Compact Portfolio Cards */}
      <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-4 transition-opacity relative`}>
        {(isLoading || refreshing) && <ShimmerOverlay />}
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Value */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-muted-foreground">Total Value</span>
            </div>
            <div className="text-xl font-bold text-foreground">{formatCurrency(data.totalValue)}</div>
            <div className="flex items-center justify-center gap-1 text-xs">
              {data.totalChangePercent >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-error" />
              )}
              <span className={`${data.totalChangePercent >= 0 ? 'text-success' : 'text-error'}`}>
                {formatPercentage(data.totalChangePercent)}
              </span>
            </div>
          </div>

          {/* Daily Change */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-1">
              <Activity className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-muted-foreground">Daily P&L</span>
            </div>
            <div className={`text-xl font-bold ${data.totalChange >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(data.totalChange)}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.totalChange >= 0 ? '📈 Up' : '📉 Down'}
            </div>
          </div>

          {/* Total Invested */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-muted-foreground">Invested</span>
            </div>
            <div className="text-xl font-bold text-foreground">{formatCurrency(data.totalInvested)}</div>
            <div className="text-xs text-muted-foreground">
              Capital deployed
            </div>
          </div>

          {/* Unrealized P&L */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-1">
              <PieChart className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-medium text-muted-foreground">Unrealized</span>
            </div>
            <div className={`text-xl font-bold ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(data.unrealizedPnL)}
            </div>
            <div className="text-xs text-muted-foreground">
              Open positions
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Realized P&L:</span>
                <span className={`font-medium ${data.realizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(data.realizedPnL)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${data.totalValue > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                  {data.totalValue > 0 ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Live data
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 