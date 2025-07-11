'use client'

import { Globe, Users, Shield, ShieldCheck, HelpCircle } from 'lucide-react'

export function SwapPageHeader() {
  return (
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
            Multi-aggregator routing • Zero gas fees • Best execution
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
  )
} 