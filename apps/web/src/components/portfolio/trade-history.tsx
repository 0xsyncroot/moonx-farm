'use client'

export function TradeHistory() {
  const trades = [
    {
      id: '1',
      type: 'buy',
      tokenFrom: 'USDT',
      tokenTo: 'ETH',
      amount: '1000.00',
      price: '2000.00',
      total: '0.5',
      timestamp: Date.now() - 86400000,
      status: 'completed'
    },
    {
      id: '2',
      type: 'sell',
      tokenFrom: 'BTC',
      tokenTo: 'USDC',
      amount: '0.01',
      price: '50000.00',
      total: '500.00',
      timestamp: Date.now() - 43200000,
      status: 'completed'
    }
  ]

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + 
           new Date(timestamp).toLocaleTimeString()
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

      <div className="space-y-4">
        {trades.map((trade) => (
          <div key={trade.id} className="bg-muted/20 border border-border/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-medium">{trade.tokenFrom} → {trade.tokenTo}</div>
                <div className={`text-sm ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                  {trade.type.toUpperCase()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{trade.amount} {trade.tokenFrom}</div>
                <div className="text-sm text-muted-foreground">
                  @ ${trade.price}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{trade.total} {trade.tokenTo}</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">{formatDate(trade.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 