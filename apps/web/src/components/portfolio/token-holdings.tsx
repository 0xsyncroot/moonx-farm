'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { getChainConfig } from '@/config/chains'
import { RefreshCw, PieChart, Eye, X, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { TokenHoldingDetail } from './token-holding-detail'

// Enhanced Pie Chart Component with Tooltips
const TokenPieChart = ({ tokens, totalValue }: { tokens: any[], totalValue: number }) => {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)
  
  const formatCurrency = (value: number) => {
    if (value < 0.01) return '$0.00'
    if (value < 1000) return `$${value.toFixed(2)}`
    if (value < 1000000) return `$${(value / 1000).toFixed(1)}K`
    return `$${(value / 1000000).toFixed(1)}M`
  }

  // Debug log
  console.log('🔍 TokenPieChart - Debug:', {
    tokens: tokens.length,
    totalValue,
    firstToken: tokens[0],
    allTokens: tokens,
    hoveredSegment
  })

  // Show fallback if no data
  if (!tokens.length || totalValue === 0) {
    return (
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <div className="w-32 h-32 border-8 border-muted/20 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-bold text-muted-foreground">$0.00</div>
              <div className="text-xs text-muted-foreground">No Data</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate percentages for each token
  const chartData = tokens.map((token, index) => ({
    ...token,
    percentage: (token.valueUSD / totalValue) * 100,
    color: `hsl(${(index * 360) / tokens.length}, 70%, 50%)`
  }))

  // Create a simple donut chart using CSS
  let cumulativePercentage = 0
  const circumference = 2 * Math.PI * 35 // radius = 35

  return (
    <div className="flex items-center justify-center relative">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90 cursor-pointer" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="transparent"
            stroke="rgb(148 163 184 / 0.2)"
            strokeWidth="6"
          />
          
          {/* Pie segments */}
          {chartData.map((segment, index) => {
            const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`
            const strokeDashoffset = -cumulativePercentage * circumference / 100
            
            const result = (
              <circle
                key={index}
                cx="50"
                cy="50"
                r="35"
                fill="transparent"
                stroke={segment.color}
                strokeWidth="6"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 hover:opacity-100 cursor-pointer"
                opacity={hoveredSegment === index ? "1" : "0.8"}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            )
            
            cumulativePercentage += segment.percentage
            return result
          })}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {hoveredSegment !== null ? (
              <>
                <div className="text-xs font-semibold text-foreground">
                  {chartData[hoveredSegment].tokenSymbol}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(chartData[hoveredSegment].valueUSD)}
                </div>
                <div className="text-xs text-primary">
                  {chartData[hoveredSegment].percentage.toFixed(1)}%
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-bold text-foreground">{formatCurrency(totalValue)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Hover tooltip */}
      {hoveredSegment !== null && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-2 py-1 rounded text-xs z-20 whitespace-nowrap shadow-lg">
          <div className="font-medium">{chartData[hoveredSegment].tokenSymbol}</div>
          <div className="text-xs opacity-90">
            {formatCurrency(chartData[hoveredSegment].valueUSD)} ({chartData[hoveredSegment].percentage.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  )
}

export function TokenHoldings() {
  const { holdings, isLoading, error } = useTokenHoldings()
  const [selectedToken, setSelectedToken] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Memoize the data to prevent useMemo dependency issues
  const data = useMemo(() => {
    console.log('🔍 Holdings Data:', holdings)
    return holdings || []
  }, [holdings])

  // Calculate total value first
  const totalValue = useMemo(() => {
    const total = data.reduce((sum, holding) => sum + (holding.valueUSD || 0), 0)
    console.log('🔍 Total Value Calculated:', { total, dataLength: data.length, data })
    return total
  }, [data])

  // Get top 5 tokens by value for display
  const topTokens = useMemo(() => {
    const filtered = data.filter(holding => holding.valueUSD > 0) // Only tokens with value
    const sorted = filtered.sort((a, b) => b.valueUSD - a.valueUSD) // Sort by value desc
    const top5 = sorted.slice(0, 5) // Take top 5
    
    console.log('🔍 Top Tokens Processing:', {
      originalData: data.length,
      filtered: filtered.length,
      top5: top5.length,
      top5Tokens: top5
    })
    
    return top5
  }, [data])

  // Format currency
  const formatCurrency = (value: number) => {
    if (value < 0.01) return '$0.00'
    if (value < 1000) return `$${value.toFixed(2)}`
    if (value < 1000000) return `$${(value / 1000).toFixed(1)}K`
    return `$${(value / 1000000).toFixed(1)}M`
  }

  // Format balance
  const formatBalance = (balanceFormatted: number) => {
    if (isNaN(balanceFormatted) || balanceFormatted === 0) return '0'
    
    if (balanceFormatted < 0.0001) return balanceFormatted.toExponential(2)
    if (balanceFormatted < 1) return balanceFormatted.toFixed(6)
    if (balanceFormatted < 1000) return balanceFormatted.toFixed(4)
    if (balanceFormatted < 1000000) return `${(balanceFormatted / 1000).toFixed(1)}K`
    return `${(balanceFormatted / 1000000).toFixed(1)}M`
  }

  const openTokenDetail = (token: any) => {
    console.log('🔍 Opening token detail for:', token)
    setSelectedToken(token)
    setShowDetailModal(true)
  }

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {/* Chart skeleton */}
      <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-4 shadow-sm">
        <div className="w-32 h-32 bg-muted/30 rounded-full mx-auto animate-pulse" />
      </div>
      
      {/* List skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted/30 rounded-full animate-pulse" />
              <div className="w-12 h-4 bg-muted/30 rounded animate-pulse" />
            </div>
            <div className="text-right">
              <div className="w-16 h-4 bg-muted/30 rounded animate-pulse mb-1" />
              <div className="w-8 h-3 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Empty state component
  const EmptyState = () => (
    <div className="text-center">
      <div className="w-16 h-16 bg-card/60 backdrop-blur-sm border border-border/40 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
        <PieChart className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Holdings Found</h3>
      <p className="text-sm text-muted-foreground">
        Start trading to see your token holdings here!
      </p>
    </div>
  )

  // Show loading skeleton when loading
  if (isLoading && !data.length) {
    return <LoadingSkeleton />
  }

  // Show empty state when no data
  if (!isLoading && !data.length) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      {/* Horizontal Layout: Chart Left + Token List Right */}
      {topTokens.length > 0 ? (
        <div className="bg-card/60 backdrop-blur-sm border-0 rounded-xl overflow-hidden h-[352px] shadow-lg ring-1 ring-border/20">
          <div className="grid grid-cols-12 gap-0 h-full">
            {/* Left: Compact Pie Chart */}
            <div className="col-span-4 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-r border-border/20 p-4 flex items-center justify-center">
              <div className="relative">
                <TokenPieChart tokens={topTokens} totalValue={totalValue} />
              </div>
            </div>

            {/* Right: Token List */}
            <div className="col-span-8 flex flex-col h-full bg-gradient-to-b from-card/20 to-card/10">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-card/60 to-card/40 backdrop-blur-sm border-b border-border/20 flex-shrink-0">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="col-span-4 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Holdings
                  </div>
                  <div className="col-span-3 text-right">Price</div>
                  <div className="col-span-2 text-right">Balance</div>
                  <div className="col-span-3 text-right">Value</div>
                </div>
              </div>

              {/* Token Rows - Fill remaining space */}
              <div className="flex-1 overflow-y-auto">
                {topTokens.map((holding, index) => {
                  const chainConfig = getChainConfig(holding.chainId)
                  const allocation = ((holding.valueUSD / totalValue) * 100).toFixed(1)
                  const tokenPrice = holding.priceUSD || (holding.balanceFormatted > 0 ? holding.valueUSD / holding.balanceFormatted : 0)
                  
                  return (
                    <div 
                      key={`${holding.tokenSymbol}-${index}`}
                      onClick={() => openTokenDetail(holding)}
                      className={`px-4 py-3 hover:bg-gradient-to-r hover:from-card/60 hover:to-card/40 cursor-pointer transition-all duration-300 group relative ${
                        index < topTokens.length - 1 ? 'border-b border-border/10' : ''
                      }`}
                    >
                      {/* Hover indicator */}
                      <div className="absolute left-0 top-0 h-full w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-r-full"></div>
                      
                      <div className="grid grid-cols-12 gap-2 items-center">
                        {/* Holdings Column */}
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
                            style={{ backgroundColor: `hsl(${(index * 360) / topTokens.length}, 70%, 55%)` }}
                          />
                          
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 ring-1 ring-border/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                            {holding.logoUrl ? (
                              <img 
                                src={holding.logoUrl} 
                                alt={holding.tokenSymbol}
                                className="w-5 h-5 rounded-full"
                              />
                            ) : (
                              <span className="text-xs font-bold text-primary">
                                {holding.tokenSymbol.charAt(0)}
                              </span>
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                {holding.tokenSymbol}
                              </span>
                              <span className="text-xs bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm ring-1 ring-border/20 text-muted-foreground px-1.5 py-0.5 rounded-full">
                                {chainConfig?.name?.slice(0, 4) || 'Chain'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Price Column */}
                        <div className="col-span-3 text-right">
                          <div className="text-sm font-medium text-foreground">
                            {formatCurrency(tokenPrice)}
                          </div>
                        </div>

                        {/* Balance Column */}
                        <div className="col-span-2 text-right">
                          <div className="text-sm font-medium text-foreground">
                            {formatBalance(holding.balanceFormatted)}
                          </div>
                        </div>

                        {/* Value Column */}
                        <div className="col-span-3 text-right">
                          <div className="text-sm font-semibold text-foreground">
                            {formatCurrency(holding.valueUSD)}
                          </div>
                          <div className="text-xs text-primary font-medium bg-primary/10 ring-1 ring-primary/20 px-1.5 py-0.5 rounded-full inline-block">
                            {allocation}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                {/* Fill remaining space if less than 5 tokens */}
                {topTokens.length < 5 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <div className="text-center text-muted-foreground">
                      <div className="w-12 h-12 bg-gradient-to-br from-muted/20 to-muted/10 ring-1 ring-border/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <PieChart className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <div className="text-sm opacity-70">
                        {data.length > 5 ? `+${data.length - 5} more tokens available` : 'Ready for more tokens'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer - Fixed at bottom */}
              {data.length > 5 && (
                <div className="px-4 py-3 bg-gradient-to-r from-card/60 to-card/40 backdrop-blur-sm border-t border-border/20 flex-shrink-0">
                  <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span className="font-medium">+{data.length - 5} more tokens available</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card/60 backdrop-blur-sm border-0 rounded-xl h-[352px] flex items-center justify-center shadow-lg ring-1 ring-border/20">
          <EmptyState />
        </div>
      )}

      {/* Token Detail Modal */}
      <TokenHoldingDetail 
        token={selectedToken}
        totalPortfolioValue={totalValue}
        isOpen={showDetailModal}
        onClose={() => {
          console.log('🔍 Closing token detail modal')
          setShowDetailModal(false)
          setSelectedToken(null)
        }}
      />
    </div>
  )
} 