'use client'

import { usePortfolioOverview } from '@/hooks/usePortfolioOverview'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, PieChart, BarChart3, Activity, Wallet, Award, Shield } from 'lucide-react'

export function PortfolioOverview() {
  const { overview, isLoading, error, refresh, refreshing, cacheAge, computedData } = usePortfolioOverview()

  // Default to zero values if no data
  const data = overview || {
    totalValue: 0,
    totalChange: 0,
    totalChangePercent: 0,
    totalInvested: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
  }

  // Helper function to format currency with better small number handling
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value)
    
    // Handle very small values
    if (absValue > 0 && absValue < 0.001) {
      return `${value >= 0 ? '' : '-'}$${absValue < 0.0001 ? '< 0.0001' : absValue.toFixed(4)}`
    }
    
    // Handle zero
    if (absValue === 0) {
      return '$0.00'
    }
    
    // Standard formatting for larger values
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: absValue < 1 ? 4 : 2,
      maximumFractionDigits: absValue < 1 ? 4 : 2,
    }).format(value)
  }

  // Helper function to format percentage with context
  const formatPercentage = (value: number) => {
    // Handle extreme cases
    if (value === -100) {
      return '-100% (Portfolio Closed)'
    }
    if (Math.abs(value) > 1000) {
      return `${value >= 0 ? '+' : ''}${Math.round(value)}%`
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Calculate cache freshness
  const isDataFresh = cacheAge < 2 * 60 * 1000 // 2 minutes
  const cacheMinutes = Math.floor(cacheAge / 60000)

  // Calculate portfolio health score
  const portfolioHealthScore = Math.min(100, Math.max(0, 50 + (data.totalChangePercent * 2)))

  // Shimmer loading overlay component
  const ShimmerOverlay = () => (
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary/70" />
          <h2 className="text-lg font-semibold">Portfolio Overview</h2>
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
        <div className="flex items-center gap-3">
          {/* Portfolio Health Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border border-border/30 rounded-lg">
            <Shield className={`h-4 w-4 ${
              portfolioHealthScore >= 60 ? 'text-success' : 
              portfolioHealthScore >= 40 ? 'text-warning' : 'text-error'
            }`} />
            <span className="text-sm font-medium">
              Health: {portfolioHealthScore.toFixed(0)}%
            </span>
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
      </div>

      {/* Show error state */}
      {error && !refreshing && !isLoading && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-center">
          <div className="text-error font-medium mb-2">Failed to load portfolio data</div>
          <div className="text-sm text-muted-foreground">
            {overview ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Portfolio cards with shimmer loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Portfolio Value */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 hover:bg-card/60 transition-colors group relative">
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex flex-row items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Total Portfolio Value</h3>
            <DollarSign className="h-5 w-5 text-primary/70 group-hover:text-primary transition-colors" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground mb-1">{formatCurrency(data.totalValue)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {data.totalChangePercent >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-error" />
              )}
              {formatPercentage(data.totalChangePercent)} from last month
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${data.totalValue > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {data.totalValue > 0 ? 'Active' : (computedData?.totalHoldings || 0) > 0 ? 'Positions Closed' : 'Empty'}
              </span>
            </div>
          </div>
        </div>

        {/* Daily Performance */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 hover:bg-card/60 transition-colors group relative">
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex flex-row items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Daily Performance</h3>
            <BarChart3 className={`h-5 w-5 ${data.totalChange >= 0 ? 'text-success' : 'text-error'} group-hover:scale-110 transition-transform`} />
          </div>
          <div>
            <div className={`text-2xl font-bold mb-1 ${data.totalChange >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(data.totalChange)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {data.totalChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-error" />
              )}
              {formatPercentage(data.totalChangePercent)} today
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Trend</span>
              <span className={`font-medium ${data.totalChange >= 0 ? 'text-success' : 'text-error'}`}>
                {data.totalChange >= 0 ? '📈 Rising' : '📉 Falling'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Invested */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 hover:bg-card/60 transition-colors group relative">
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex flex-row items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Total Invested</h3>
            <Target className="h-5 w-5 text-primary/70 group-hover:text-primary transition-colors" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground mb-1">{formatCurrency(data.totalInvested)}</div>
            <div className="text-xs text-muted-foreground">
              Across all positions
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Utilization</span>
              <span className="font-medium text-primary">
                {data.totalValue > 0 ? ((data.totalInvested / data.totalValue) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 hover:bg-card/60 transition-colors group relative">
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex flex-row items-center justify-between space-y-0 pb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Unrealized P&L</h3>
            <PieChart className={`h-5 w-5 ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'} group-hover:scale-110 transition-transform`} />
          </div>
          <div>
            <div className={`text-2xl font-bold mb-1 ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(data.unrealizedPnL)}
            </div>
            <div className="text-xs text-muted-foreground">
              Open positions
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                {data.unrealizedPnL >= 0 ? '✅ Profitable' : '⚠️ At Loss'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Performance Summary */}
      {data.totalValue > 0 && (
        <div className={`bg-gradient-to-r from-card/50 to-card/30 backdrop-blur-xl border border-border/30 rounded-xl p-6 transition-opacity relative`}>
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${data.totalChange >= 0 ? 'bg-success' : 'bg-error'} animate-pulse`} />
              <div>
                <h4 className="font-semibold text-foreground">
                  Portfolio {data.totalChange >= 0 ? 'up' : 'down'} {formatPercentage(Math.abs(data.totalChangePercent))}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {data.totalChange >= 0 ? 'Strong performance today' : 'Temporary decline'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-foreground">
                {data.totalChange >= 0 ? '🚀' : '📉'} {formatCurrency(Math.abs(data.totalChange))}
              </div>
              <div className="text-sm text-muted-foreground">
                {data.totalChange >= 0 ? 'Gained' : 'Lost'} today
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/20 border border-border/30 rounded-lg">
              <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-xs text-muted-foreground">Total Return</div>
              <div className={`text-sm font-bold ${data.totalChange >= 0 ? 'text-success' : 'text-error'}`}>
                {formatPercentage(computedData?.performance?.totalReturn || 0)}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/30 rounded-lg">
              <Award className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-xs text-muted-foreground">Holdings</div>
              <div className="text-sm font-bold text-foreground">
                {computedData?.totalHoldings || 0}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/30 rounded-lg">
              <Shield className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-xs text-muted-foreground">Diversification</div>
              <div className="text-sm font-bold text-primary">
                {(computedData?.totalHoldings || 0) > 5 ? 'High' : (computedData?.totalHoldings || 0) > 2 ? 'Medium' : 'Low'}
              </div>
            </div>
          </div>

          {/* Top Holdings Preview */}
          {computedData?.topHoldings && computedData.topHoldings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-muted-foreground">Top Holdings</h5>
                <span className="text-xs text-muted-foreground">
                  {computedData.topHoldings.length} of {computedData.totalHoldings || 0}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {computedData.topHoldings.slice(0, 5).map((holding, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border border-border/30 rounded-lg whitespace-nowrap">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center text-xs font-bold">
                      {holding.tokenSymbol.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{holding.tokenSymbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(holding.valueUSD)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 