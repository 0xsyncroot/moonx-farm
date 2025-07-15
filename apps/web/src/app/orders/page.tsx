'use client'

import { Suspense, useState } from 'react'
import { LimitOrderInterface } from '@/components/orders/limit-order-interface'
import { DCAInterface } from '@/components/orders/dca-interface'
import { OrderHistory } from '@/components/orders/order-history'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Target, Repeat, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('limit')

  const tabs = [
    {
      id: 'limit',
      label: 'Limit Orders',
      icon: Target,
      color: 'orange',
      description: 'Set target prices and execute when conditions are met'
    },
    {
      id: 'dca',
      label: 'DCA Strategy',
      icon: Repeat,
      color: 'blue',
      description: 'Automate recurring purchases at regular intervals'
    },
    {
      id: 'history',
      label: 'Order History',
      icon: Activity,
      color: 'green',
      description: 'Track and manage all your trading orders'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <main className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Enhanced Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Advanced Trading
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-balance">
              Professional trading tools with limit orders, DCA strategies, and comprehensive order management
            </p>
          </div>

          {/* Enhanced Tab Navigation */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl overflow-hidden shadow-lg">
            {/* Desktop Tab Header */}
            <div className="hidden sm:block border-b border-border bg-muted/10">
              <div className="px-6 py-4">
                <div className="flex space-x-1 bg-muted/30 p-1.5 rounded-xl">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <tab.icon className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">{tab.label}</div>
                        <div className="text-xs opacity-70 mt-0.5">{tab.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Tab Header */}
            <div className="sm:hidden border-b border-border bg-muted/10">
              <div className="px-4 py-4">
                <div className="grid grid-cols-3 gap-1 bg-muted/30 p-1.5 rounded-xl">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 px-3 py-3 rounded-lg transition-all duration-200 text-xs font-medium",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <tab.icon className="w-5 h-5" />
                      <span>{tab.id === 'limit' ? 'Limit' : tab.id === 'dca' ? 'DCA' : 'History'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Enhanced Tab Content */}
            <div className="p-4 sm:p-8">
              {activeTab === 'limit' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <LimitOrderInterface />
                </Suspense>
              )}
              
              {activeTab === 'dca' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <DCAInterface />
                </Suspense>
              )}
              
              {activeTab === 'history' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <OrderHistory />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 