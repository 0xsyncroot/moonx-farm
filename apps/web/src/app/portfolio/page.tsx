'use client'

import { Header } from '@/components/layout/header'
import { PortfolioOverview } from '@/components/portfolio/portfolio-overview'
import { TradeHistory } from '@/components/portfolio/trade-history'
import { TokenHoldings } from '@/components/portfolio/token-holdings'
import { PnLChart } from '@/components/portfolio/pnl-chart'
import { useEffect, useState } from 'react'

export default function PortfolioPage() {
  const [pageKey, setPageKey] = useState('')

  // Force re-mount when page loads
  useEffect(() => {
    setPageKey(Date.now().toString())
  }, [])

  // Don't render until pageKey is set
  if (!pageKey) {
    return null
  }

  return (
    <div key={pageKey} className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Portfolio Dashboard
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track your trading performance, analyze P&L, and manage your DeFi positions
            </p>
          </div>

          {/* Portfolio Overview */}
          <PortfolioOverview />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Token Holdings */}
            <div className="xl:col-span-1">
              <TokenHoldings />
            </div>

            {/* P&L Chart - takes remaining 3 columns */}
            <div className="xl:col-span-3">
              <PnLChart />
            </div>
          </div>

          {/* Trade History */}
          <TradeHistory />
        </div>
      </main>
    </div>
  )
} 