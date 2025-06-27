'use client'

import { formatCurrency, formatNumber } from '@/lib/utils'

interface Trade {
  id: string
  type: 'buy' | 'sell'
  fromToken: string
  toToken: string
  amount: number
  price: number
  timestamp: Date
}

// Mock data for demonstration
const MOCK_TRADES: Trade[] = [
  {
    id: '1',
    type: 'buy',
    fromToken: 'ETH',
    toToken: 'USDC',
    amount: 2.5,
    price: 2450.75,
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: '2',
    type: 'sell',
    fromToken: 'BNB',
    toToken: 'USDT',
    amount: 10.2,
    price: 285.50,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '3',
    type: 'buy',
    fromToken: 'ETH',
    toToken: 'WBTC',
    amount: 1.8,
    price: 0.038,
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
]

export function RecentTrades() {
  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60))
    if (minutes < 1) return 'now'
    if (minutes === 1) return '1m ago'
    return `${minutes}m ago`
  }

  return (
    <div className="space-y-3">
      {MOCK_TRADES.map((trade) => (
        <div
          key={trade.id}
          className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              trade.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <div>
              <div className="text-sm font-medium text-white">
                {trade.fromToken} → {trade.toToken}
              </div>
              <div className="text-xs text-gray-400">
                {formatNumber(trade.amount)} {trade.fromToken}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {formatCurrency(trade.price)}
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