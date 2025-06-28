'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface PnLData {
  timeframe: string
  realizedPnlUSD: number
  unrealizedPnlUSD: number
  netPnlUSD: number
  totalFeesUSD: number
  winRate: number
  totalTrades: number
  profitableTrades: number
  currentPortfolioValueUSD: number
  portfolioChangePercent: number
  biggestWinUSD: number
  biggestLossUSD: number
}

export function PnLChart() {
  const [pnlData, setPnlData] = useState<PnLData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30d')

  useEffect(() => {
    async function fetchPnLData() {
      try {
        setIsLoading(true)
        const response = await coreApi.getPortfolioPnL({ timeframe })
        
        if (response.success) {
          setPnlData(response.data)
        } else {
          throw new Error('Failed to fetch P&L data')
        }
      } catch (error) {
        console.error('P&L data fetch error:', error)
        toast.error('Failed to load P&L data')
        setPnlData(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPnLData()
  }, [timeframe])

  if (isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">P&L Chart</h3>
            <p className="text-sm text-muted-foreground">
              Your portfolio performance over time
            </p>
          </div>
          <div className="text-right animate-pulse">
            <div className="h-6 bg-muted/40 rounded w-24 mb-1"></div>
            <div className="h-4 bg-muted/40 rounded w-16"></div>
          </div>
        </div>
        
        <div className="h-64 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-center mb-4 animate-pulse">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <div className="text-muted-foreground">Loading P&L data...</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg animate-pulse">
              <div className="h-4 bg-muted/40 rounded mb-2"></div>
              <div className="h-6 bg-muted/40 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">P&L Chart</h3>
          <p className="text-sm text-muted-foreground">
            Your portfolio performance over time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-2 py-1 bg-background border border-border/50 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
            <option value="1y">1y</option>
          </select>
          
          {pnlData && (
            <div className="text-right">
              <div className={`text-lg font-bold ${pnlData.netPnlUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnlData.netPnlUSD >= 0 ? '+' : ''}${pnlData.netPnlUSD.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {pnlData.portfolioChangePercent.toFixed(2)}% return
              </div>
            </div>
          )}
        </div>
      </div>

      {!pnlData ? (
        <div className="h-64 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-center mb-4">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <div className="text-muted-foreground">No P&L data available</div>
            <div className="text-sm text-muted-foreground mt-1">
              Start trading to see your performance
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Chart Placeholder */}
          <div className="h-64 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-center mb-4">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div className="text-muted-foreground">P&L Chart</div>
              <div className="text-sm text-muted-foreground mt-1">
                {pnlData.timeframe} performance tracking
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Net: ${pnlData.netPnlUSD.toLocaleString()} | Win Rate: {pnlData.winRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Biggest Win</div>
              <div className="font-medium text-green-600">
                +${pnlData.biggestWinUSD.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Biggest Loss</div>
              <div className="font-medium text-red-600">
                ${pnlData.biggestLossUSD.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="font-medium">{pnlData.winRate.toFixed(1)}%</div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="font-medium">{pnlData.totalTrades}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Realized P&L</div>
              <div className={`font-medium ${pnlData.realizedPnlUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnlData.realizedPnlUSD >= 0 ? '+' : ''}${pnlData.realizedPnlUSD.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Unrealized P&L</div>
              <div className={`font-medium ${pnlData.unrealizedPnlUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnlData.unrealizedPnlUSD >= 0 ? '+' : ''}${pnlData.unrealizedPnlUSD.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Fees</div>
              <div className="font-medium text-gray-600">
                ${pnlData.totalFeesUSD.toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 