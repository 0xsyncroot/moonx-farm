'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = [
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
]

export function PriceChart() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d')
  const [selectedToken, setSelectedToken] = useState('ETH/USDC')

  // Mock data for demonstration
  const mockPrice = 3247.82
  const mockChange = 2.4
  const isPositive = mockChange > 0

  return (
    <div className="trade-card h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-lg font-semibold">{selectedToken}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold">
                ${mockPrice.toLocaleString()}
              </span>
              <div className={cn(
                "flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium",
                isPositive ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}>
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{isPositive ? '+' : ''}{mockChange}%</span>
              </div>
            </div>
          </div>
        </div>

        <button className="p-2 rounded-lg hover:bg-muted transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center space-x-1 mb-6">
        {TIMEFRAMES.map((timeframe) => (
          <button
            key={timeframe.value}
            onClick={() => setSelectedTimeframe(timeframe.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg transition-colors",
              selectedTimeframe === timeframe.value
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {timeframe.label}
          </button>
        ))}
      </div>

      {/* Chart Placeholder */}
      <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center space-y-2">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Price chart will be displayed here</p>
          <p className="text-sm text-muted-foreground">
            Integration with TradingView or Chart.js coming soon
          </p>
        </div>
      </div>
    </div>
  )
} 