'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface Trade {
  id: string
  type: string
  txHash: string
  timestamp: string
  chainId: number
  status: string
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
  slippage: number
  pnl?: {
    realizedPnlUSD: number
    feesPaidUSD: number
    netPnlUSD: number
  }
}

export function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchTrades() {
      try {
        setIsLoading(true)
        const response = await coreApi.getRecentTrades({ limit: 10, days: 30 })
        
        if (response.success) {
          setTrades(response.data.trades || [])
        } else {
          throw new Error('Failed to fetch trades')
        }
      } catch (error) {
        console.error('Trade history fetch error:', error)
        toast.error('Failed to load trade history')
        setTrades([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrades()
  }, [])

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + 
           new Date(timestamp).toLocaleTimeString()
  }

  if (isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Trade History</h3>
            <p className="text-sm text-muted-foreground">
              Recent trading activity and transaction history
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/20 border border-border/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted/40 rounded mb-2"></div>
              <div className="h-6 bg-muted/40 rounded mb-2"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-4 bg-muted/40 rounded"></div>
                <div className="h-4 bg-muted/40 rounded"></div>
              </div>
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
          <h3 className="text-xl font-semibold">Trade History</h3>
          <p className="text-sm text-muted-foreground">
            Recent trading activity and transaction history
          </p>
        </div>
        <button className="text-sm text-blue-500 hover:text-blue-400">
          View All
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-muted-foreground">No trades found</div>
          <div className="text-sm text-muted-foreground mt-1">
            Your trading history will appear here
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {trades.map((trade) => (
            <div key={trade.id} className="bg-muted/20 border border-border/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium">{trade.fromToken.symbol} → {trade.toToken.symbol}</div>
                  <div className={`text-sm ${trade.type === 'swap' ? 'text-blue-600' : 'text-gray-600'}`}>
                    {trade.type.toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {trade.dexName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{trade.fromToken.amount} {trade.fromToken.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    ${trade.fromToken.valueUSD.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">{trade.toToken.amount} {trade.toToken.symbol}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">{formatDate(trade.timestamp)}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mt-2">
                <div>
                  <span>Gas: ${trade.gasFeeUSD.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span>Slippage: {trade.slippage.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 