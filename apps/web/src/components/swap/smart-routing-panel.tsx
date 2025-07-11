'use client'

import { Route, TrendingUp, Network, Shield, HelpCircle } from 'lucide-react'

export function SmartRoutingPanel() {
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Route className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Smart Routing
          </h3>
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
              Intelligent route optimization across multiple DEX aggregators for best execution
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
          </div>
          <div className="ml-auto">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto hover-scrollbar">
          {[
            {
              label: 'Best Price Source',
              value: 'LI.FI',
              subtext: 'Across 14 bridges',
              icon: TrendingUp,
              color: 'text-green-600 dark:text-green-400',
              bgColor: 'bg-green-50 dark:bg-green-900/20'
            },
            {
              label: 'Route Optimization',
              value: '3-hop routing',
              subtext: 'Base → ETH → BSC',
              icon: Network,
              color: 'text-blue-600 dark:text-blue-400',
              bgColor: 'bg-blue-50 dark:bg-blue-900/20'
            },
            {
              label: 'MEV Protection',
              value: 'Active',
              subtext: '99.2% success rate',
              icon: Shield,
              color: 'text-purple-600 dark:text-purple-400',
              bgColor: 'bg-purple-50 dark:bg-purple-900/20'
            }
          ].map((stat, index) => (
            <div key={index} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 p-3 rounded-xl transition-all duration-200 cursor-pointer">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor} group-hover:scale-105 transition-transform duration-200 mt-0.5`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <div className="mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">{stat.subtext}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 