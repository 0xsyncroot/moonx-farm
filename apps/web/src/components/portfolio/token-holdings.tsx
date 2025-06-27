'use client'

export function TokenHoldings() {
  const holdings = [
    {
      token: 'ETH',
      name: 'Ethereum',
      amount: 12.5,
      value: 25000,
      change: 5.2,
      allocation: 45.5
    },
    {
      token: 'BTC',
      name: 'Bitcoin',
      amount: 0.75,
      value: 37500,
      change: -2.1,
      allocation: 35.2
    },
    {
      token: 'USDT',
      name: 'Tether USD',
      amount: 8500,
      value: 8500,
      change: 0.01,
      allocation: 15.8
    },
    {
      token: 'MATIC',
      name: 'Polygon',
      amount: 2500,
      value: 1875,
      change: 8.7,
      allocation: 3.5
    }
  ]

  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0)

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Token Holdings</h3>
          <p className="text-sm text-muted-foreground">
            Your current token positions
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">${totalValue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Value</div>
        </div>
      </div>

      <div className="space-y-4">
        {holdings.map((holding) => (
          <div key={holding.token} className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {holding.token.slice(0, 2)}
              </div>
              <div>
                <div className="font-medium">{holding.token}</div>
                <div className="text-sm text-muted-foreground">{holding.name}</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-medium">{holding.amount.toLocaleString()} {holding.token}</div>
              <div className="text-sm text-muted-foreground">
                ${holding.value.toLocaleString()}
              </div>
            </div>
            
            <div className="text-right">
              <div className={`font-medium ${holding.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {holding.change >= 0 ? '+' : ''}{holding.change}%
              </div>
              <div className="text-sm text-muted-foreground">
                {holding.allocation}% allocation
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Tokens: </span>
            <span className="font-medium">{holdings.length}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Avg. Change: </span>
            <span className="font-medium text-green-600">+2.9%</span>
          </div>
        </div>
      </div>
    </div>
  )
} 