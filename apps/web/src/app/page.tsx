'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { SwapInterface } from '@/components/swap/swap-interface'
import { PriceChart } from '@/components/swap/price-chart'
import { TokenList } from '@/components/swap/token-list'
import { RecentTrades } from '@/components/swap/recent-trades'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div 
        className="fixed inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-2xl flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Cross-Chain DEX
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Swap tokens across multiple chains with{' '}
            <span className="text-[#ff7842] font-semibold">Account Abstraction wallets</span>{' '}
            and sponsored gas fees
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Gas Sponsored</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Account Abstraction</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Cross-Chain</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="w-2 h-2 bg-[#ff7842] rounded-full"></div>
              <span className="text-sm text-gray-300">Best Routes</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Swap Interface - Center */}
          <div className="lg:col-start-2 lg:col-span-1">
            <SwapInterface />
          </div>

          {/* Price Chart - Left */}
          <div className="lg:col-start-1 lg:row-start-1 order-2 lg:order-1">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Price Chart</h3>
              <PriceChart />
            </div>
          </div>

          {/* Recent Trades - Right */}
          <div className="lg:col-start-3 lg:row-start-1 order-3">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
              <RecentTrades />
            </div>
          </div>
        </div>

        {/* Supported Chains */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-white mb-6">Supported Networks</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { name: 'Ethereum', icon: '⟠', color: 'border-blue-500/30 bg-blue-500/10' },
              { name: 'Base', icon: '🔵', color: 'border-blue-600/30 bg-blue-600/10' },
              { name: 'BSC', icon: '🟡', color: 'border-yellow-500/30 bg-yellow-500/10' },
            ].map((chain) => (
              <div
                key={chain.name}
                className={`flex items-center gap-3 px-6 py-3 border rounded-xl ${chain.color} transition-colors hover:bg-white/5`}
              >
                <span className="text-2xl">{chain.icon}</span>
                <span className="text-white font-medium">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Volume', value: '$2.5B+', change: '+12.5%' },
            { label: 'Active Users', value: '125K+', change: '+8.3%' },
            { label: 'Transactions', value: '1.2M+', change: '+15.7%' },
            { label: 'Saved Fees', value: '$50M+', change: '+22.1%' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
              <div className="text-xs text-green-400">{stat.change}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
} 