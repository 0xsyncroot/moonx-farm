'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface PortfolioData {
  totalValue: number
  totalChange: number
  totalChangePercent: number
  totalInvested: number
  unrealizedPnL: number
  realizedPnL: number
}

export function PortfolioOverview() {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPortfolioData() {
      try {
        setIsLoading(true)
        
        // Fetch portfolio and P&L data in parallel
        const [portfolioResponse, pnlResponse] = await Promise.all([
          coreApi.getQuickPortfolio(),
          coreApi.getPortfolioPnL({ timeframe: '30d' })
        ])

        if (portfolioResponse.success && pnlResponse.success) {
          const portfolio = portfolioResponse.data
          const pnl = pnlResponse.data

          setPortfolioData({
            totalValue: portfolio.totalValueUSD || 0,
            totalChange: pnl.netPnlUSD || 0,
            totalChangePercent: pnl.portfolioChangePercent || 0,
            totalInvested: (portfolio.totalValueUSD || 0) - (pnl.netPnlUSD || 0),
            unrealizedPnL: pnl.unrealizedPnlUSD || 0,
            realizedPnL: pnl.realizedPnlUSD || 0
          })
        } else {
          throw new Error('Failed to fetch portfolio data')
        }
      } catch (error) {
        console.error('Portfolio overview fetch error:', error)
        toast.error('Failed to load portfolio data')
        
        // Fallback to empty data
        setPortfolioData({
          totalValue: 0,
          totalChange: 0,
          totalChangePercent: 0,
          totalInvested: 0,
          unrealizedPnL: 0,
          realizedPnL: 0
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPortfolioData()
  }, [])

  if (isLoading || !portfolioData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-muted/20 rounded mb-2"></div>
            <div className="h-8 bg-muted/20 rounded mb-1"></div>
            <div className="h-3 bg-muted/20 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Total Portfolio Value</h3>
          <span className="text-muted-foreground">$</span>
        </div>
        <div>
          <div className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            +{portfolioData.totalChangePercent}% from last month
          </p>
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">24h Change</h3>
          <span className={portfolioData.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}>
            {portfolioData.totalChange >= 0 ? '↗' : '↘'}
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold ${portfolioData.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioData.totalChange >= 0 ? '+' : ''}${portfolioData.totalChange.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {portfolioData.totalChange >= 0 ? '+' : ''}{portfolioData.totalChangePercent}%
          </p>
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Total Invested</h3>
          <span className="text-muted-foreground">📊</span>
        </div>
        <div>
          <div className="text-2xl font-bold">${portfolioData.totalInvested.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Across all positions
          </p>
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Unrealized P&L</h3>
          <span className={portfolioData.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
            {portfolioData.unrealizedPnL >= 0 ? '↗' : '↘'}
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold ${portfolioData.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioData.unrealizedPnL >= 0 ? '+' : ''}${portfolioData.unrealizedPnL.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Open positions
          </p>
        </div>
      </div>
    </div>
  )
} 