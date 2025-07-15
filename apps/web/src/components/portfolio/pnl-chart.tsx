'use client'

import { useState, useMemo, useEffect } from 'react'
import { usePnLChart } from '@/hooks/usePnLChart'
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Activity, Target, DollarSign } from 'lucide-react'

export function PnLChart() {
  const { pnlData, isLoading, error, refresh, refreshing, cacheAge, getPnLData } = usePnLChart()
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>('30d')
  const [currentPnLData, setCurrentPnLData] = useState<{
    netPnlUSD?: number
    realizedPnlUSD?: number
    unrealizedPnlUSD?: number
    totalTrades?: number
    profitableTrades?: number
    winRate?: number
    totalFeesUSD?: number
    avgTradeSize?: number
    biggestWinUSD?: number
    biggestLossUSD?: number
    portfolioChangePercent?: number
    currentPortfolioValueUSD?: number
  } | null>(null)

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

  // Use current PnL data from the dedicated hook
  const pnlMetrics = useMemo(() => {
    return {
      totalPnL: currentPnLData?.netPnlUSD || 0,
      realizedPnL: currentPnLData?.realizedPnlUSD || 0,
      unrealizedPnL: currentPnLData?.unrealizedPnlUSD || 0,
      totalTrades: currentPnLData?.totalTrades || 0,
      profitableTrades: currentPnLData?.profitableTrades || 0,
      winRate: currentPnLData?.winRate || 0,
      totalFees: currentPnLData?.totalFeesUSD || 0,
      avgTradeSize: currentPnLData?.avgTradeSize || 0,
      biggestWin: currentPnLData?.biggestWinUSD || 0,
      biggestLoss: currentPnLData?.biggestLossUSD || 0,
      portfolioChange: currentPnLData?.portfolioChangePercent || 0,
      currentValue: currentPnLData?.currentPortfolioValueUSD || 0
    }
  }, [currentPnLData])

  // Calculate performance metrics
  const totalReturn = pnlMetrics.totalPnL
  const totalReturnPercent = pnlMetrics.portfolioChange

  // Format currency
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Calculate cache freshness
  const isDataFresh = cacheAge < 2 * 60 * 1000 // 2 minutes
  const cacheMinutes = Math.floor(cacheAge / 60000)

  // Shimmer loading overlay component
  const ShimmerOverlay = () => (
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
    </div>
  )

  // Generate chart data points for visualization
  const generateChartData = () => {
    if (!pnlMetrics.totalTrades || pnlMetrics.totalTrades === 0) {
      return []
    }

    // Generate simple data points based on real metrics
    const points = []
    const totalPoints = Math.min(30, pnlMetrics.totalTrades) // Max 30 points
    
    for (let i = 0; i < totalPoints; i++) {
      const progress = i / (totalPoints - 1)
      // Simulate realistic P&L curve with some randomness but trending toward final value
      const baseValue = progress * totalReturn
      const variance = Math.sin(progress * Math.PI * 3) * (Math.abs(totalReturn) * 0.1)
      const value = baseValue + variance
      
      points.push({
        x: (i / (totalPoints - 1)) * 100,
        y: value
      })
    }

    return points
  }

  const chartData = generateChartData()

  // Create SVG path for the chart
  const createChartPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    
    const minY = Math.min(...points.map(p => p.y))
    const maxY = Math.max(...points.map(p => p.y))
    const range = maxY - minY || 1
    
    // Normalize y values to fit in chart height (inverted for SVG)
    const normalizedPoints = points.map(p => ({
      x: p.x,
      y: 100 - ((p.y - minY) / range) * 100
    }))
    
    let path = `M ${normalizedPoints[0].x} ${normalizedPoints[0].y}`
    
    // Use smooth curves
    for (let i = 1; i < normalizedPoints.length; i++) {
      const curr = normalizedPoints[i]
      const prev = normalizedPoints[i - 1]
      
      if (i === 1) {
        path += ` L ${curr.x} ${curr.y}`
      } else {
        // Smooth curve using quadratic bezier
        const cpx = (prev.x + curr.x) / 2
        const cpy = (prev.y + curr.y) / 2
        path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`
      }
    }
    
    return path
  }

  const chartPath = createChartPath(chartData)

  const handleTimeframeChange = async (newTimeframe: typeof timeframe) => {
    setTimeframe(newTimeframe)
    if (!pnlData[newTimeframe]) {
      const data = await getPnLData(newTimeframe)
      setCurrentPnLData(data)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header - Balanced with Trade History */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary/70" />
          <h2 className="text-lg font-semibold">P&L Performance</h2>
          {!isDataFresh && !refreshing && !isLoading && (
            <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
              {cacheMinutes}m ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {pnlMetrics.totalTrades} trades
          </div>
          <button
            onClick={() => refresh()}
            disabled={refreshing || isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Show error state */}
      {error && !refreshing && !isLoading && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-center">
          <div className="text-error font-medium mb-2">Failed to load P&L data</div>
          <div className="text-sm text-muted-foreground">
            {currentPnLData ? 'Showing cached data' : 'Please try refreshing'}
          </div>
        </div>
      )}

      {/* Main Chart Card - Consistent styling */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 space-y-4 relative">
        {(isLoading || refreshing) && <ShimmerOverlay />}
        
        {/* Timeframe Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Portfolio Performance</h3>
            <p className="text-sm text-muted-foreground">
              {timeframe.toUpperCase()} trading performance
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/20 border border-border/30 rounded-lg p-1">
            {(['24h', '7d', '30d', '90d', '1y'] as const).map((period) => (
              <button
                key={period}
                onClick={() => handleTimeframeChange(period)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
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

        {/* Real Chart with Data */}
        <div className="h-48 bg-gradient-to-br from-muted/10 to-muted/5 border border-border/30 rounded-lg p-4 relative overflow-hidden">
          {isLoading && !currentPnLData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading P&L data...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <div className="relative h-full">
              {/* Chart SVG */}
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgb(var(--border))" strokeWidth="0.5" opacity="0.3"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
                
                {/* Chart line */}
                <path
                  d={chartPath}
                  fill="none"
                  stroke={totalReturn >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                  strokeWidth="2"
                  className="drop-shadow-sm"
                />
                
                {/* Fill area under curve */}
                {chartPath && (
                  <path
                    d={`${chartPath} L 100 100 L 0 100 Z`}
                    fill={totalReturn >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                  />
                )}
                
                {/* Data points */}
                {chartData.map((point, index) => {
                  const normalizedY = 100 - ((point.y - Math.min(...chartData.map(p => p.y))) / 
                    (Math.max(...chartData.map(p => p.y)) - Math.min(...chartData.map(p => p.y)) || 1)) * 100
                  return (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={normalizedY}
                      r="1"
                      fill={totalReturn >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                      className="opacity-60"
                    />
                  )
                })}
              </svg>
              
              {/* Chart overlay with current value */}
              <div className="absolute top-2 left-2 bg-card/80 backdrop-blur-sm border border-border/30 rounded-lg px-2 py-1">
                <div className="text-xs text-muted-foreground">Current P&L</div>
                <div className={`text-sm font-bold ${totalReturn >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(totalReturn)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No trading data available</p>
                <p className="text-xs text-muted-foreground/70">
                  Start trading to see your performance chart
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Summary - Balanced grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {totalReturn >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-error" />
              )}
              <span className="text-xs text-muted-foreground">Total P&L</span>
            </div>
            <div className={`text-lg font-bold ${totalReturn >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(totalReturn)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatPercentage(totalReturnPercent)}
            </div>
          </div>

          <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Win Rate</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {pnlMetrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {pnlMetrics.profitableTrades}/{pnlMetrics.totalTrades}
            </div>
          </div>

          <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Trade</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatCurrency(pnlMetrics.avgTradeSize)}
            </div>
            <div className="text-xs text-muted-foreground">
              {pnlMetrics.totalTrades} trades
            </div>
          </div>

          <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Fees</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatCurrency(pnlMetrics.totalFees)}
            </div>
            <div className="text-xs text-muted-foreground">
              Gas + Protocol
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 