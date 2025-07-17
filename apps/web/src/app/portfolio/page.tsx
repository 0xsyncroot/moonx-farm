'use client'

import { PortfolioOverview } from '@/components/portfolio/portfolio-overview'
import { TradeHistory } from '@/components/portfolio/trade-history'
import { PnLChart } from '@/components/portfolio/pnl-chart'
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'

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
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-6">
          {/* Portfolio Overview */}
          <PortfolioOverview />

          {/* Main Content - 2 Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Charts */}
            <div className="space-y-6">
              <PnLChart />
            </div>

            {/* Right Column - Trades */}
            <div className="space-y-6">
              <TradeHistory />
              
              {/* Community Section */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Share Your Wins</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share your successful trades and inspire the community!
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 