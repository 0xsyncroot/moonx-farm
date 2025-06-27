'use client'

export function PortfolioOverview() {
  const portfolioData = {
    totalValue: 25680.45,
    totalChange: 1234.56,
    totalChangePercent: 5.2,
    totalInvested: 24445.89,
    unrealizedPnL: 1234.56,
    realizedPnL: 890.23
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