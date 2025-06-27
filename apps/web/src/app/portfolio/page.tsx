'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { PortfolioOverview } from '@/components/portfolio/portfolio-overview'
import { TradeHistory } from '@/components/portfolio/trade-history'
import { TokenHoldings } from '@/components/portfolio/token-holdings'
import { PnLChart } from '@/components/portfolio/pnl-chart'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Portfolio
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track your trading performance, view transaction history, and manage your holdings
            </p>
          </div>

          {/* Portfolio Overview */}
          <div>
            <Suspense fallback={<LoadingSpinner />}>
              <PortfolioOverview />
            </Suspense>
          </div>

          {/* Portfolio Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Holdings */}
            <div className="lg:col-span-1">
              <Suspense fallback={<LoadingSpinner />}>
                <TokenHoldings />
              </Suspense>
            </div>

            {/* PnL Chart */}
            <div className="lg:col-span-2">
              <Suspense fallback={<LoadingSpinner />}>
                <PnLChart />
              </Suspense>
            </div>
          </div>

          {/* Trade History */}
          <div>
            <Suspense fallback={<LoadingSpinner />}>
              <TradeHistory />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
} 