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

  // Auto-trigger sync when user enters portfolio (once per session)
  useEffect(() => {
    const triggerInitialSync = async () => {
      // Check if sync was already triggered in this session
      const syncTriggered = sessionStorage.getItem('portfolio_sync_triggered')
      if (syncTriggered) return

      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        // Check if we need to sync (last sync > 30 minutes ago)
        const response = await fetch('/api/sync/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          const lastSync = data.data?.lastSync
          const now = Date.now()
          const thirtyMinutes = 30 * 60 * 1000

          // Only trigger if last sync was more than 30 minutes ago or never synced
          if (!lastSync || (now - new Date(lastSync).getTime()) > thirtyMinutes) {
            // Trigger background sync
            await fetch('/api/sync/trigger', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                syncType: 'portfolio',
                priority: 'medium'
              })
            })
          }
        }

        // Mark as triggered for this session
        sessionStorage.setItem('portfolio_sync_triggered', 'true')
      } catch (error) {
        console.error('Failed to trigger initial sync:', error)
      }
    }

    if (pageKey) {
      triggerInitialSync()
    }
  }, [pageKey])

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