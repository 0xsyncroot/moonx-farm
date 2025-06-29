'use client'

import { useQuery } from '@tanstack/react-query'
import { coreApi } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface Trade {
  id: string
  type: 'swap'
  txHash: string
  timestamp: string
  fromToken: {
    symbol: string
    amount: string
    valueUSD: number
  }
  toToken: {
    symbol: string
    amount: string
    valueUSD: number
  }
  gasFeeUSD: number
  dexName: string
}

export function RecentTrades() {
  const { isAuthenticated } = useAuth()

  // Fetch recent trades from Core Service
  const { data: tradesData, isLoading, error } = useQuery({
    queryKey: ['recentTrades'],
    queryFn: () => coreApi.getRecentTrades({ limit: 10, days: 7 }),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  })

  const trades = tradesData?.data?.trades || []

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60))
    if (minutes < 1) return 'now'
    if (minutes === 1) return '1m ago'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <p>Connect wallet to view recent trades</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-400">
        <p>Failed to load recent trades</p>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <p>No recent trades found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {trades.map((trade: Trade) => (
        <div
          key={trade.id}
          className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div>
              <div className="text-sm font-medium text-white">
                {trade.fromToken.symbol} → {trade.toToken.symbol}
              </div>
              <div className="text-xs text-gray-400">
                {formatNumber(parseFloat(trade.fromToken.amount))} {trade.fromToken.symbol}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {formatCurrency(trade.toToken.valueUSD)}
            </div>
            <div className="text-xs text-gray-400">
              {formatTimeAgo(trade.timestamp)}
            </div>
          </div>
        </div>
      ))}

      <div className="text-center pt-4">
        <button className="text-sm text-[#ff7842] hover:text-[#ff7842]/80 transition-colors">
          View all trades →
        </button>
      </div>
    </div>
  )
} 