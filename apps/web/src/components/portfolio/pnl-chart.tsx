'use client'

export function PnLChart() {
  const chartData = [
    { date: '2024-01-01', pnl: 0 },
    { date: '2024-01-02', pnl: 250 },
    { date: '2024-01-03', pnl: -100 },
    { date: '2024-01-04', pnl: 500 },
    { date: '2024-01-05', pnl: 750 },
    { date: '2024-01-06', pnl: 1200 },
    { date: '2024-01-07', pnl: 850 }
  ]

  const totalPnL = chartData[chartData.length - 1]?.pnl || 0
  const totalReturn = ((totalPnL / 10000) * 100).toFixed(2)

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">P&L Chart</h3>
          <p className="text-sm text-muted-foreground">
            Your portfolio performance over time
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">
            {totalReturn}% return
          </div>
        </div>
      </div>

      {/* Simple Chart Placeholder */}
      <div className="h-64 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-center mb-4">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <div className="text-muted-foreground">P&L Chart</div>
          <div className="text-sm text-muted-foreground mt-1">
            Performance tracking visualization
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Best Day</div>
          <div className="font-medium text-green-600">+$500</div>
        </div>
        <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Worst Day</div>
          <div className="font-medium text-red-600">-$100</div>
        </div>
        <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Win Rate</div>
          <div className="font-medium">85.7%</div>
        </div>
        <div className="text-center p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
          <div className="font-medium">1.45</div>
        </div>
      </div>
    </div>
  )
} 