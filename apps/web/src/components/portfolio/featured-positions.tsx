'use client'

import { useState, useMemo } from 'react'
import { Trophy, TrendingUp, TrendingDown, Star, Crown, Target, Zap, Flame, Gem, Rocket } from 'lucide-react'
import Image from 'next/image'

interface FeaturedPositionsProps {
  trades: Array<{
    id: string
    type: 'buy' | 'sell' | 'swap'
    fromToken: {
      symbol: string
      amount: string
      decimals: number
      logoUrl?: string
    }
    toToken: {
      symbol: string
      amount: string
      decimals: number
      logoUrl?: string
    }
    pnl?: {
      netPnlUSD?: number
      pnlPercent?: number
    }
    profitLoss?: number
    valueUSD?: number
    timestamp: string
    txHash?: string
  }>
  isLoading?: boolean
}

export function FeaturedPositions({ trades, isLoading }: FeaturedPositionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'biggest' | 'profitable' | 'recent'>('all')

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

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const formatTokenAmount = (amount: string, decimals: number) => {
    try {
      const value = parseFloat(amount) / Math.pow(10, decimals)
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
      if (value >= 1) return value.toFixed(2)
      return value.toFixed(4)
    } catch {
      return '0'
    }
  }

  const featuredTrades = useMemo(() => {
    if (!trades.length) return []

    const tradesWithPnL = trades.map(trade => ({
      ...trade,
      pnlValue: trade.pnl?.netPnlUSD || trade.profitLoss || 0,
      pnlPercent: trade.pnl?.pnlPercent || 0,
    }))

    switch (selectedCategory) {
      case 'biggest':
        return tradesWithPnL
          .sort((a, b) => Math.abs(b.pnlValue) - Math.abs(a.pnlValue))
          .slice(0, 6)
      case 'profitable':
        return tradesWithPnL
          .filter(trade => trade.pnlValue > 0)
          .sort((a, b) => b.pnlValue - a.pnlValue)
          .slice(0, 6)
      case 'recent':
        return tradesWithPnL
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 6)
      default:
        return tradesWithPnL
          .sort((a, b) => b.pnlValue - a.pnlValue)
          .slice(0, 6)
    }
  }, [trades, selectedCategory])

  const getTradeIcon = (trade: any) => {
    if (trade.pnlValue >= 10000) return <Rocket className="h-5 w-5 text-purple-400" />
    if (trade.pnlValue >= 5000) return <Crown className="h-5 w-5 text-yellow-400" />
    if (trade.pnlValue >= 1000) return <Flame className="h-5 w-5 text-orange-400" />
    if (trade.pnlValue >= 100) return <Gem className="h-5 w-5 text-blue-400" />
    if (trade.pnlValue > 0) return <TrendingUp className="h-5 w-5 text-green-400" />
    return <TrendingDown className="h-5 w-5 text-red-400" />
  }

  const getTradeRank = (index: number) => {
    switch (index) {
      case 0: return { icon: <Crown className="h-4 w-4 text-yellow-400" />, label: '1st', color: 'text-yellow-400' }
      case 1: return { icon: <Trophy className="h-4 w-4 text-gray-400" />, label: '2nd', color: 'text-gray-400' }
      case 2: return { icon: <Trophy className="h-4 w-4 text-amber-600" />, label: '3rd', color: 'text-amber-600' }
      default: return { icon: <Star className="h-4 w-4 text-primary" />, label: `${index + 1}th`, color: 'text-primary' }
    }
  }

  const getBadgeText = (trade: any) => {
    if (trade.pnlValue >= 10000) return 'LEGENDARY'
    if (trade.pnlValue >= 5000) return 'EPIC'
    if (trade.pnlValue >= 1000) return 'RARE'
    if (trade.pnlValue >= 100) return 'UNCOMMON'
    if (trade.pnlValue > 0) return 'PROFIT'
    return 'LOSS'
  }

  const getBadgeColor = (trade: any) => {
    if (trade.pnlValue >= 10000) return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    if (trade.pnlValue >= 5000) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (trade.pnlValue >= 1000) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    if (trade.pnlValue >= 100) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (trade.pnlValue > 0) return 'bg-green-500/20 text-green-400 border-green-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary/70" />
            <h2 className="text-lg font-semibold">Featured Positions</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card/50 border border-border/50 rounded-xl p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted/20 rounded w-1/2"></div>
                <div className="h-8 bg-muted/20 rounded w-3/4"></div>
                <div className="h-4 bg-muted/20 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary/70" />
          <div>
            <h2 className="text-lg font-semibold">Featured Positions</h2>
            <p className="text-sm text-muted-foreground">Showcase your best trades</p>
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex items-center gap-1 bg-muted/20 border border-border/30 rounded-lg p-1">
          {(['all', 'biggest', 'profitable', 'recent'] as const).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Trades Grid */}
      {featuredTrades.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTrades.map((trade, index) => {
            const rank = getTradeRank(index)
            return (
              <div
                key={trade.id}
                className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-4 hover:bg-card/60 transition-all duration-200 group relative overflow-hidden"
              >
                {/* Background Glow Effect */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-200 ${
                  trade.pnlValue >= 1000 ? 'bg-gradient-to-br from-primary via-transparent to-primary' : ''
                }`} />

                {/* Rank Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1 text-sm font-medium ${rank.color}`}>
                    {rank.icon}
                    {rank.label}
                  </div>
                  <div className={`px-2 py-1 text-xs font-bold rounded-full border ${getBadgeColor(trade)}`}>
                    {getBadgeText(trade)}
                  </div>
                </div>

                {/* Trade Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTradeIcon(trade)}
                      <span className="text-sm font-medium capitalize">{trade.type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Token Pair */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center text-xs font-bold">
                          {trade.fromToken.symbol.charAt(0)}
                        </div>
                        <span className="font-medium">{trade.fromToken.symbol}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-secondary/30 to-secondary/20 flex items-center justify-center text-xs font-bold">
                          {trade.toToken.symbol.charAt(0)}
                        </div>
                        <span className="font-medium">{trade.toToken.symbol}</span>
                      </div>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">P&L</span>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${trade.pnlValue >= 0 ? 'text-success' : 'text-error'}`}>
                          {formatCurrency(trade.pnlValue)}
                        </div>
                        {trade.pnlPercent !== 0 && (
                          <div className={`text-xs ${trade.pnlPercent >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatPercentage(trade.pnlPercent)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trade Value */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-medium">{formatCurrency(trade.valueUSD || 0)}</span>
                  </div>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Featured Positions Yet</h3>
          <p className="text-sm text-muted-foreground">
            Start trading to see your best positions featured here!
          </p>
        </div>
      )}

      {/* Summary Stats */}
      {featuredTrades.length > 0 && (
        <div className="bg-gradient-to-r from-card/50 to-card/30 backdrop-blur-xl border border-border/30 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-success">
                {featuredTrades.filter(t => t.pnlValue > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">Profitable</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(featuredTrades.reduce((sum, t) => sum + t.pnlValue, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total P&L</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {formatCurrency(Math.max(...featuredTrades.map(t => t.pnlValue)))}
              </div>
              <div className="text-sm text-muted-foreground">Best Trade</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 