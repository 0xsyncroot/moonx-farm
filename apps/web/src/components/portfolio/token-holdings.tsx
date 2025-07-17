'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { getChainConfig } from '@/config/chains'
import { PieChart, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, Eye } from 'lucide-react'
import { TokenHoldingDetail } from './token-holding-detail'
import { formatCurrency, formatBalance, getChartColor } from '@/utils/formatting'

// Professional Donut Chart Component - Inspired by Robinhood/Coinbase
const TokenDonutChart = ({ tokens, totalValue }: { tokens: any[], totalValue: number }) => {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null)

  // Show fallback if no data
  if (!tokens.length || totalValue === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="relative w-36 h-36">
          <div className="w-36 h-36 border-8 border-muted/20 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold text-muted-foreground">$0.00</div>
              <div className="text-xs text-muted-foreground mt-1">No Holdings</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate chart data with professional colors
  const chartData = tokens.map((token, index) => ({
    ...token,
    percentage: ((token.balanceUSD || 0) / totalValue) * 100,
    color: getChartColor(index)
  }))

  // SVG donut chart
  const radius = 60
  const circumference = 2 * Math.PI * radius
  let cumulativePercentage = 0

  const activeSegment = hoveredSegment !== null ? hoveredSegment : selectedSegment

  return (
    <div className="flex items-center justify-center h-48 relative">
      <div className="relative">
        <svg className="w-36 h-36 transform -rotate-90 cursor-pointer" viewBox="0 0 144 144">
          {/* Background circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="transparent"
            stroke="rgb(148 163 184 / 0.1)"
            strokeWidth="12"
          />
          
          {/* Donut segments */}
          {chartData.map((segment, index) => {
            const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`
            const strokeDashoffset = -cumulativePercentage * circumference / 100
            
            const isActive = activeSegment === index
            
            const result = (
              <circle
                key={index}
                cx="72"
                cy="72"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={isActive ? "16" : "12"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 cursor-pointer"
                style={{
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' : 'none'
                }}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => setSelectedSegment(selectedSegment === index ? null : index)}
              />
            )
            
            cumulativePercentage += segment.percentage
            return result
          })}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {activeSegment !== null ? (
              <div className="animate-in fade-in duration-200">
                <div className="text-sm font-semibold text-foreground mb-1">
                  {chartData[activeSegment].tokenSymbol}
                </div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(chartData[activeSegment].balanceUSD || 0)}
                </div>
                <div className="text-xs text-primary font-medium">
                  {chartData[activeSegment].percentage.toFixed(1)}%
                </div>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold text-foreground">{formatCurrency(totalValue)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Value</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hover tooltip */}
      {hoveredSegment !== null && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-sm z-20 whitespace-nowrap shadow-lg animate-in fade-in duration-200">
          <div className="font-medium">{chartData[hoveredSegment].tokenSymbol}</div>
          <div className="text-xs opacity-90">
            {formatCurrency(chartData[hoveredSegment].balanceUSD || 0)} ({chartData[hoveredSegment].percentage.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  )
}

export function TokenHoldings() {
  // FIXED: Use refresh function from hook to enable proper data refresh
  const { holdings, isLoading, error, refreshing } = useTokenHoldings()
  const [selectedToken, setSelectedToken] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAllTokens, setShowAllTokens] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  // Memoize the data to prevent useMemo dependency issues
  const data = useMemo(() => {
    console.log('🔍 Holdings Data:', holdings)
    return holdings || []
  }, [holdings])

  // Calculate total value first
  const totalValue = useMemo(() => {
    const total = data.reduce((sum, holding) => sum + (holding.balanceUSD || 0), 0)
    console.log('🔍 Total Value Calculated:', { total, dataLength: data.length, data })
    return total
  }, [data])

  // Get tokens sorted by value for display
  const sortedTokens = useMemo(() => {
    const filtered = data.filter(holding => (holding.balanceUSD || 0) > 0) // Only tokens with value
    const sorted = filtered.sort((a, b) => (b.balanceUSD || 0) - (a.balanceUSD || 0)) // Sort by value desc
    
    console.log('🔍 Sorted Tokens Processing:', {
      originalData: data.length,
      filtered: filtered.length,
      sorted: sorted.length,
      sortedTokens: sorted
    })
    
    return sorted
  }, [data])

  // Show only top 5 tokens in chart, top 10 in table (with scrolling)
  const displayTokens = viewMode === 'chart' ? sortedTokens.slice(0, 5) : (showAllTokens ? sortedTokens : sortedTokens.slice(0, 10))

  const openTokenDetail = (token: any) => {
    console.log('🔍 Opening token detail for:', token)
    setSelectedToken(token)
    setShowDetailModal(true)
  }

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-48 h-6 bg-muted/30 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="w-20 h-8 bg-muted/30 rounded animate-pulse" />
          <div className="w-20 h-8 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
      
      {/* Chart skeleton */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/40 rounded-xl p-6">
        <div className="flex items-center justify-center h-48">
          <div className="w-36 h-36 bg-muted/30 rounded-full animate-pulse" />
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-card/50 backdrop-blur-sm border border-border/40 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted/30 rounded-full animate-pulse" />
              <div>
                <div className="w-16 h-4 bg-muted/30 rounded animate-pulse mb-2" />
                <div className="w-12 h-3 bg-muted/30 rounded animate-pulse" />
              </div>
            </div>
            <div className="text-right">
              <div className="w-16 h-4 bg-muted/30 rounded animate-pulse mb-2" />
              <div className="w-12 h-3 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-card/50 backdrop-blur-sm border border-border/40 rounded-full flex items-center justify-center mx-auto mb-4">
        <PieChart className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No Holdings Found</h3>
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
    <div className="space-y-4 relative">
      {/* FIXED: Add shimmer overlay when refreshing */}
      {refreshing && (
        <div className="absolute inset-0 bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden z-10">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
        </div>
      )}
      
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Holdings Allocation</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{sortedTokens.length} assets</span>
            {/* FIXED: Show refresh status */}
            {refreshing && (
              <span className="text-primary animate-pulse">• Refreshing...</span>
            )}
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/30 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'chart' 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieChart className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'table' 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart View */}
      {viewMode === 'chart' && sortedTokens.length > 0 && (
        <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center">
              <TokenDonutChart tokens={displayTokens} totalValue={totalValue} />
              
              {/* Chart Legend */}
              <div className="mt-4 w-full max-w-xs">
                <div className="space-y-2">
                  {displayTokens.map((token, index) => {
                    const percentage = (((token.balanceUSD || 0) / totalValue) * 100).toFixed(1)
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/20 p-2 rounded-lg transition-colors"
                        onClick={() => openTokenDetail(token)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getChartColor(index) }}
                          />
                          <span className="font-medium">{token.tokenSymbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{percentage}%</span>
                          <span>•</span>
                          <span>{formatCurrency(token.balanceUSD || 0)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {sortedTokens.length > 5 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <button
                      onClick={() => setViewMode('table')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-card/50 backdrop-blur-sm border border-border/40 rounded-lg hover:bg-card/80 transition-colors"
                    >
                      <Eye className="h-3 w-3" />
                      <span>View All {sortedTokens.length} Assets</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Holdings Details */}
            <div className="space-y-4">
              {/* Largest Holdings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">Largest Holdings</div>
                  <div className="text-xs text-muted-foreground">Top {Math.min(3, displayTokens.length)} by value</div>
                </div>
                {displayTokens.slice(0, 3).map((token, index) => {
                  const chainConfig = getChainConfig(token.chainId)
                  const allocation = (((token.balanceUSD || 0) / totalValue) * 100).toFixed(1)
                  
                  return (
                    <div
                      key={index}
                      onClick={() => openTokenDetail(token)}
                      className="flex items-center justify-between p-3 bg-muted/10 rounded-lg cursor-pointer hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center">
                          {token.logoUrl ? (
                            <Image
                              src={token.logoUrl} 
                              alt={token.tokenSymbol}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          ) : (
                            <span className="text-xs font-bold text-primary">
                              {token.tokenSymbol.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{token.tokenSymbol}</span>
                            <span className="text-xs bg-muted/40 px-1.5 py-0.5 rounded">
                              {chainConfig?.name?.slice(0, 4) || 'Chain'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatCurrency(token.balanceUSD || 0)}</div>
                        <div className="text-xs text-primary">{allocation}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick Stats */}
              <div className="bg-muted/10 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Diversification</div>
                    <div className="font-medium">
                      {sortedTokens.length > 5 ? 'Well Diversified' : 'Concentrated'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Top 3 Holdings</div>
                    <div className="font-medium">
                      {displayTokens.slice(0, 3).reduce((acc, token) => 
                        acc + ((token.balanceUSD || 0) / totalValue) * 100, 0
                      ).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-muted/20 text-sm font-medium text-muted-foreground border-b border-border/20">
            <div className="col-span-5">Asset</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Holdings</div>
            <div className="col-span-2 text-right">Value</div>
            <div className="col-span-1 text-right">Allocation</div>
          </div>
          
          {/* Token Rows with Scrolling */}
          <div className={`divide-y divide-border/20 ${showAllTokens && sortedTokens.length > 10 ? 'max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent' : ''}`}>
            {displayTokens.map((token, index) => {
              const chainConfig = getChainConfig(token.chainId)
              const allocation = (((token.balanceUSD || 0) / totalValue) * 100).toFixed(1)
              const tokenPrice = token.priceUSD || (token.balanceFormatted > 0 ? (token.balanceUSD || 0) / token.balanceFormatted : 0)
              
              return (
                <div
                  key={index}
                  onClick={() => openTokenDetail(token)}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/10 transition-colors cursor-pointer group"
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center">
                      {token.logoUrl ? (
                        <Image
                          src={token.logoUrl} 
                          alt={token.tokenSymbol}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-bold text-primary">
                          {token.tokenSymbol.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {token.tokenSymbol}
                        </span>
                        <span className="text-xs bg-muted/40 px-1.5 py-0.5 rounded">
                          {chainConfig?.name?.slice(0, 4) || 'Chain'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-medium">{formatCurrency(tokenPrice)}</div>
                  </div>
                  
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-medium">{formatBalance(token.balanceFormatted)}</div>
                  </div>
                  
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-semibold">{formatCurrency(token.balanceUSD || 0)}</div>
                  </div>
                  
                  <div className="col-span-1 text-right">
                    <div className="text-sm font-medium text-primary">{allocation}%</div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* View All Button - Inside table container */}
          {sortedTokens.length > 10 && (
            <div className="p-4 bg-muted/5 border-t border-border/20">
              <button
                onClick={() => setShowAllTokens(!showAllTokens)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-card/50 backdrop-blur-sm border border-border/40 rounded-lg hover:bg-card/80 transition-colors"
              >
                {showAllTokens ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    View All ({sortedTokens.length} assets)
                  </>
                )}
              </button>
            </div>
          )}
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