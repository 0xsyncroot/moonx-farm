'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { AlertsManager } from '@/components/alerts/alerts-manager'
import { CreateAlert } from '@/components/alerts/create-alert'
import { WalletTracker } from '@/components/alerts/wallet-tracker'
import { CopyTrading } from '@/components/alerts/copy-trading'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Smart Alerts & Copy Trading
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stay ahead of the market with intelligent alerts and follow successful traders
            </p>
          </div>

          {/* Create Alert */}
          <div>
            <Suspense fallback={<LoadingSpinner />}>
              <CreateAlert />
            </Suspense>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wallet Tracker */}
            <div>
              <Suspense fallback={<LoadingSpinner />}>
                <WalletTracker />
              </Suspense>
            </div>

            {/* Copy Trading */}
            <div>
              <Suspense fallback={<LoadingSpinner />}>
                <CopyTrading />
              </Suspense>
            </div>
          </div>

          {/* Active Alerts */}
          <div>
            <Suspense fallback={<LoadingSpinner />}>
              <AlertsManager />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
} 