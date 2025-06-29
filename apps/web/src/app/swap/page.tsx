'use client'

import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { SwapInterface } from '@/components/swap/swap-interface'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { 
  ArrowUpDown, 
  TrendingUp, 
  Shield, 
  ShieldCheck,
  Zap, 
  Globe,
  Users,
  Activity,
  DollarSign,
  BarChart3,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Clock,
  Star
} from 'lucide-react'
import { ChainIcon } from '@/components/ui/chain-icon'

// Simple loading fallback for SwapInterface
function SwapInterfaceLoading() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="animate-pulse bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-12 bg-gradient-to-r from-orange-200 to-red-200 dark:from-orange-800 dark:to-red-800 rounded-xl"></div>
        </div>
      </div>
    </div>
  )
}

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="container mx-auto px-4 py-4 max-w-7xl">
        {/* Compact Hero Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-300">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Cross-Chain Swap
              </h1>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                Trade with zero gas fees • 15+ chains • Best rates
              </p>
            </div>
          </div>
          
          {/* Quick Stats Bar - Responsive */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-3 md:gap-6 px-4 md:px-6 py-2 md:py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">$4.2B</span>
              </div>
              <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <Users className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">280K+</span>
              </div>
              <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <Shield className="w-3 h-3 md:w-4 md:h-4 text-purple-500" />
                <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Audited</span>
              </div>
              <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-gray-600"></div>
              {/* MEV Protection Indicator */}
              <div className="group relative">
                <div className="flex items-center gap-1.5 md:gap-2 cursor-help">
                  <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs md:text-sm font-medium text-green-700 dark:text-green-400">MEV</span>
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 
                              bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 
                              group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap
                              shadow-lg border border-gray-700 dark:border-gray-600 z-[100]
                              before:content-[''] before:absolute before:bottom-full before:left-1/2 before:transform before:-translate-x-1/2
                              before:border-4 before:border-transparent before:border-b-gray-900 dark:before:border-b-gray-700">
                  Protected against MEV attacks
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Responsive */}
        <div className="grid lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Sidebar - Enhanced Market Info - Hidden on mobile */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4 md:space-y-6 hidden lg:block">
            {/* Market Overview */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="p-4 md:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                    Market Overview
                  </h3>
                  <div className="ml-auto">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                <div className="space-y-3 md:space-y-4">
                  {[
                    { 
                      label: '24h Volume', 
                      value: '$4.2B', 
                      change: '+12.4%', 
                      icon: TrendingUp,
                      color: 'text-green-600 dark:text-green-400',
                      bgColor: 'bg-green-100 dark:bg-green-900/30'
                    },
                    { 
                      label: 'Active Pairs', 
                      value: '1,234', 
                      change: '+5.7%', 
                      icon: Activity,
                      color: 'text-blue-600 dark:text-blue-400',
                      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
                    },
                    { 
                      label: 'Total TVL', 
                      value: '$890M', 
                      change: '+18.2%', 
                      icon: DollarSign,
                      color: 'text-purple-600 dark:text-purple-400',
                      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
                    }
                  ].map((stat, index) => (
                    <div key={index} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 md:p-3 rounded-xl transition-all duration-200 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className={`p-1.5 md:p-2 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                            <stat.icon className={`w-3 h-3 md:w-4 md:h-4 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                            <p className="font-bold text-sm md:text-base text-gray-900 dark:text-white">{stat.value}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs md:text-sm font-semibold ${stat.color} flex items-center gap-1`}>
                            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {stat.change}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">24h</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className="w-full flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
                    View Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2">
                <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                Quick Actions
              </h4>
              <div className="space-y-2">
                {[
                  { label: 'Bridge ETH', icon: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#8197EE" fill-opacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#8197EE" fill-opacity=".602"/></svg>`, color: 'bg-blue-500' },
                  { label: 'Swap USDC', icon: '💰', color: 'bg-green-500' },
                  { label: 'Add Liquidity', icon: '💧', color: 'bg-purple-500' }
                ].map((action, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-200 text-left group"
                  >
                    <div className={`w-6 h-6 md:w-8 md:h-8 ${action.color} rounded-lg flex items-center justify-center text-white text-xs md:text-sm group-hover:scale-110 transition-transform duration-200`}>
                      {action.icon.startsWith('<svg') ? (
                        <ChainIcon icon={action.icon} size="sm" className="text-white" />
                      ) : (
                        action.icon
                      )}
                    </div>
                    <span className="font-medium text-xs md:text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {action.label}
                    </span>
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform duration-200" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center - Swap Interface */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <Suspense fallback={<SwapInterfaceLoading />}>
              <SwapInterface />
            </Suspense>
          </div>

          {/* Right Sidebar - Enhanced Activity - Hidden on mobile */}
          <div className="lg:col-span-3 order-3 space-y-4 md:space-y-6 hidden lg:block">
            {/* Recent Trades */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="p-4 md:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                    Live Trades
                  </h3>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
                  </div>
                </div>
                
                <div className="space-y-2 md:space-y-3 max-h-64 md:max-h-80 overflow-y-auto custom-scrollbar">
                  {[
                    { from: 'ETH', to: 'USDC', amount: '1.25', value: '$3,127', time: '2s', chain: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#8197EE" fill-opacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#8197EE" fill-opacity=".602"/></svg>` },
                    { from: 'USDC', to: 'SOL', amount: '1,000', value: '$1,000', time: '5s', chain: '◎' },
                    { from: 'WBTC', to: 'ETH', amount: '0.5', value: '$31,250', time: '12s', chain: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#8197EE" fill-opacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#8197EE" fill-opacity=".602"/></svg>` },
                    { from: 'BNB', to: 'USDT', amount: '15.2', value: '$6,080', time: '18s', chain: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#F0B90B"/><path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.856L24.14 16l-2.26 2.26L19.62 16l2.26-2.26z" fill="white"/><path d="M16 14.52L13.596 16.924 16 19.328l2.404-2.404L16 14.52z" fill="white"/></svg>` },
                    { from: 'MATIC', to: 'USDC', amount: '2,450', value: '$2,205', time: '25s', chain: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#8247E5"/><path d="M21.092 12.693c-.369-.215-.848-.215-1.217 0l-2.804 1.619-1.878 1.086-2.804 1.619c-.369.215-.848.215-1.217 0l-2.804-1.619c-.369-.215-.369-.645 0-.86l2.804-1.619c.369-.215.848-.215 1.217 0l2.804 1.619c.369.215.369.645 0 .86l-1.878 1.086 1.878 1.086c.369.215.369.645 0 .86l-2.804 1.619c-.369.215-.848.215-1.217 0l-2.804-1.619c-.369-.215-.369-.645 0-.86l2.804-1.619 1.878-1.086-1.878-1.086c-.369-.215-.369-.645 0-.86l2.804-1.619c.369-.215.848-.215 1.217 0l2.804 1.619c.369.215.369.645 0 .86z" fill="white"/></svg>` }
                  ].map((trade, i) => (
                    <div key={i} className="group flex items-center justify-between p-2 md:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="text-base md:text-lg">
                          {trade.chain.startsWith('<svg') ? (
                            <ChainIcon icon={trade.chain} size="sm" />
                          ) : (
                            trade.chain
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm">
                              {trade.from} → {trade.to}
                            </span>
                            <ArrowRight className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-400 group-hover:translate-x-0.5 transition-transform duration-200" />
                          </div>
                          <div className="flex items-center gap-1.5 md:gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{trade.amount} {trade.from}</span>
                            <span>•</span>
                            <span>{trade.value}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          {trade.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className="w-full flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                    <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
                    View All Trades
                  </button>
                </div>
              </div>
            </div>

            {/* Trending Tokens */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
              <div className="flex items-center gap-3 mb-3 md:mb-4">
                <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Trending</h4>
              </div>
              <div className="space-y-2 md:space-y-3">
                {[
                  { symbol: 'ETH', name: 'Ethereum', change: '+8.4%', positive: true, icon: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#C1CCF7" fill-opacity=".602"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#8197EE" fill-opacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#8197EE" fill-opacity=".602"/></svg>` },
                  { symbol: 'SOL', name: 'Solana', change: '+12.7%', positive: true, icon: '◎' },
                  { symbol: 'USDC', name: 'USD Coin', change: '+0.1%', positive: true, icon: '💰' },
                  { symbol: 'WBTC', name: 'Bitcoin', change: '-2.3%', positive: false, icon: '₿' }
                ].map((token, i) => (
                  <div key={token.symbol} className="group flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        {token.icon.startsWith('<svg') ? (
                          <ChainIcon icon={token.icon} size="xs" />
                        ) : (
                          <span className="text-xs md:text-sm">{token.icon}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm">{token.symbol}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs md:text-sm font-bold flex items-center gap-1 ${
                        token.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        <TrendingUp className={`w-2.5 h-2.5 md:w-3 md:h-3 ${!token.positive && 'rotate-180'}`} />
                        {token.change}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">24h</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Features Strip - Responsive */}
        <div className="mt-8 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            {
              icon: Zap,
              title: 'Zero Gas Fees',
              description: 'Save on transaction costs',
              color: 'from-green-500 to-emerald-600',
              bgColor: 'bg-green-50 dark:bg-green-900/20'
            },
            {
              icon: Globe,
              title: 'Cross-Chain',
              description: '15+ blockchain networks',
              color: 'from-blue-500 to-cyan-600',
              bgColor: 'bg-blue-50 dark:bg-blue-900/20'
            },
            {
              icon: Shield,
              title: 'Secure & Audited',
              description: 'Smart contracts verified',
              color: 'from-purple-500 to-violet-600',
              bgColor: 'bg-purple-50 dark:bg-purple-900/20'
            },
            {
              icon: TrendingUp,
              title: 'Best Rates',
              description: 'AI-powered routing',
              color: 'from-orange-500 to-red-600',
              bgColor: 'bg-orange-50 dark:bg-orange-900/20'
            }
          ].map((feature, index) => (
            <div 
              key={index}
              className={`group ${feature.bgColor} rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
            >
              <div className={`w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br ${feature.color} rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">
                {feature.description}
              </p>
              <div className="mt-2 md:mt-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                <span>Learn more</span>
                <ArrowRight className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }
      `}</style>
    </div>
  )
} 