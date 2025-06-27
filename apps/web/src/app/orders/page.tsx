'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { LimitOrderInterface } from '@/components/orders/limit-order-interface'
import { DCAInterface } from '@/components/orders/dca-interface'
import { OrderHistory } from '@/components/orders/order-history'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Advanced Trading
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Set up limit orders and dollar-cost averaging strategies for automated trading
            </p>
          </div>

          {/* Trading Interfaces */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Limit Orders */}
            <div>
              <Suspense fallback={<LoadingSpinner />}>
                <LimitOrderInterface />
              </Suspense>
            </div>

            {/* DCA */}
            <div>
              <Suspense fallback={<LoadingSpinner />}>
                <DCAInterface />
              </Suspense>
            </div>
          </div>

          {/* Order History */}
          <div>
            <Suspense fallback={<LoadingSpinner />}>
              <OrderHistory />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
} 