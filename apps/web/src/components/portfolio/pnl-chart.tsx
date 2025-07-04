'use client'

import { useState, useMemo, useEffect } from 'react'
import { usePortfolioData } from '@/hooks/usePortfolioData'
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Activity, Target, DollarSign, Award } from 'lucide-react'

export function PnLChart() {
  const { overview, pnlData, trades, isLoading, error, refresh, refreshing, cacheAge, getPnLData } = usePortfolioData()
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>('30d')
  const [currentPnLData, setCurrentPnLData] = useState<any>(null)

  // Load PnL data for selected timeframe
  useEffect(() => {
    const loadPnLData = async () => {
      if (pnlData[timeframe]) {
        setCurrentPnLData(pnlData[timeframe])
      } else {
        const data = await getPnLData(timeframe)
        setCurrentPnLData(data)
      }
    }
    
    loadPnLData()
  }, [timeframe, pnlData, getPnLData])

  // Use current PnL data or fallback to overview data
  const pnlMetrics = useMemo(() => {
    if (currentPnLData) {
      return {
        totalPnL: currentPnLData.netPnlUSD || 0,
        realizedPnL: currentPnLData.realizedPnlUSD || 0,
        unrealizedPnL: currentPnLData.unrealizedPnlUSD || 0,
        totalTrades: currentPnLData.totalTrades || 0,
        profitableTrades: currentPnLData.profitableTrades || 0,
        winRate: currentPnLData.winRate || 0,
        totalFees: currentPnLData.totalFeesUSD || 0,
        avgTradeSize: currentPnLData.avgTradeSize || 0,
        biggestWin: currentPnLData.biggestWinUSD || 0,
        biggestLoss: currentPnLData.biggestLossUSD || 0,
        portfolioChange: currentPnLData.portfolioChangePercent || 0,
        currentValue: currentPnLData.currentPortfolioValueUSD || 0
      }
    }
    
    // Fallback to overview data
    return {
      totalPnL: overview?.totalChange || 0,
      realizedPnL: overview?.realizedPnL || 0,
      unrealizedPnL: overview?.unrealizedPnL || 0,
      totalTrades: trades.length || 0,
      profitableTrades: trades.filter(t => t.pnl && t.pnl.netPnlUSD > 0).length || 0,
      winRate: trades.length > 0 ? (trades.filter(t => t.pnl && t.pnl.netPnlUSD > 0).length / trades.length) * 100 : 0,
      totalFees: trades.reduce((sum, t) => sum + (t.gasFeeUSD || 0), 0),
      avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.fromToken.valueUSD || 0), 0) / trades.length : 0,
      biggestWin: Math.max(0, ...trades.map(t => t.pnl?.netPnlUSD || 0)),
      biggestLoss: Math.abs(Math.min(0, ...trades.map(t => t.pnl?.netPnlUSD || 0))),
      portfolioChange: overview?.totalChangePercent || 0,
      currentValue: overview?.totalValue || 0
    }
  }, [currentPnLData, overview, trades])

  // Calculate total return metrics
  const totalReturn = pnlMetrics.totalPnL
  const totalReturnPercent = pnlMetrics.portfolioChange

  // Format currency with better small number handling
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

  // Format percentage with context
  const formatPercentage = (value: number) => {
    // Handle extreme cases
    if (value === -100) {
      return '-100% (Closed)'
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

  // Handle timeframe change
  const handleTimeframeChange = async (newTimeframe: typeof timeframe) => {
    setTimeframe(newTimeframe)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary/70" />
          <div>
            <h2 className="text-lg font-semibold">P&L Analysis</h2>
            <p className="text-xs text-muted-foreground">Performance tracking</p>
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
          <div className="text-error font-medium mb-2">Failed to load P&L data</div>
          <div className="text-sm text-muted-foreground">
            {overview ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Main Chart Card with shimmer loading */}
      <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 transition-opacity relative`}>
        {(isLoading || refreshing) && <ShimmerOverlay />}
        
        {/* Timeframe Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Portfolio Performance</h3>
            <p className="text-sm text-muted-foreground">
              Real trading performance from your transactions
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/20 border border-border/30 rounded-lg p-1">
            {(['24h', '7d', '30d', '90d', '1y'] as const).map((period) => (
              <button
                key={period}
                onClick={() => handleTimeframeChange(period)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeframe === period
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                {period.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Placeholder - TODO: Add real chart library */}
        <div className="h-64 bg-gradient-to-br from-muted/10 to-muted/5 border border-border/30 rounded-lg flex items-center justify-center mb-6">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">P&L Chart ({timeframe.toUpperCase()})</p>
            <p className="text-xs text-muted-foreground/70">
              Total P&L: {formatCurrency(pnlMetrics.totalPnL)} ({formatPercentage(totalReturnPercent)})
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-muted/10 to-muted/5 border border-border/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total P&L</span>
              {totalReturn >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-error" />
              )}
            </div>
            <div className={`text-lg font-bold ${totalReturn >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(totalReturn)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatPercentage(totalReturnPercent)}
            </div>
          </div>

          <div className="bg-gradient-to-r from-muted/10 to-muted/5 border border-border/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Win Rate</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {pnlMetrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {pnlMetrics.profitableTrades} of {pnlMetrics.totalTrades} trades
            </div>
          </div>

          <div className="bg-gradient-to-r from-muted/10 to-muted/5 border border-border/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Trades</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {pnlMetrics.totalTrades}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg: {formatCurrency(pnlMetrics.avgTradeSize)}
            </div>
          </div>

          <div className="bg-gradient-to-r from-muted/10 to-muted/5 border border-border/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Fees</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatCurrency(pnlMetrics.totalFees)}
            </div>
            <div className="text-xs text-muted-foreground">
              Gas + Protocol fees
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics with shimmer loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realized vs Unrealized P&L */}
        <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 transition-opacity relative`}>
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-primary/70" />
            <h3 className="text-lg font-semibold">Realized vs Unrealized P&L</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="font-medium">Realized P&L</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-success">{formatCurrency(pnlMetrics.realizedPnL)}</div>
                <div className="text-xs text-muted-foreground">From completed trades</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="font-medium">Unrealized P&L</span>
              </div>
              <div className="text-right">
                <div className={`font-bold ${pnlMetrics.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(pnlMetrics.unrealizedPnL)}
                </div>
                <div className="text-xs text-muted-foreground">From current holdings</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="font-medium">Total P&L</span>
              </div>
              <div className="text-right">
                <div className={`font-bold ${pnlMetrics.totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(pnlMetrics.totalPnL)}
                </div>
                <div className="text-xs text-muted-foreground">Combined performance</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Statistics */}
        <div className={`bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 transition-opacity relative`}>
          {(isLoading || refreshing) && <ShimmerOverlay />}
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary/70" />
            <h3 className="text-lg font-semibold">Trading Statistics</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{pnlMetrics.totalTrades}</div>
              <div className="text-sm text-muted-foreground">Total Trades</div>
            </div>
            
            <div className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg">
              <div className="text-2xl font-bold text-success">{pnlMetrics.profitableTrades}</div>
              <div className="text-sm text-muted-foreground">Profitable</div>
            </div>
            
            <div className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{pnlMetrics.winRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
            </div>
            
            <div className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg">
              <div className="text-lg font-bold text-foreground">{formatCurrency(pnlMetrics.avgTradeSize)}</div>
              <div className="text-sm text-muted-foreground">Avg Size</div>
            </div>
          </div>
          
          {/* Performance Breakdown */}
          <div className="mt-4 pt-4 border-t border-border/30">
            <h4 className="font-medium mb-3">Performance Breakdown</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Best Trade:</span>
                <span className="font-medium text-success">+{formatCurrency(pnlMetrics.biggestWin)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Worst Trade:</span>
                <span className="font-medium text-error">-{formatCurrency(pnlMetrics.biggestLoss)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Portfolio Value:</span>
                <span className="font-medium text-foreground">{formatCurrency(pnlMetrics.currentValue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Fees Paid:</span>
                <span className="font-medium text-muted-foreground">{formatCurrency(pnlMetrics.totalFees)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 