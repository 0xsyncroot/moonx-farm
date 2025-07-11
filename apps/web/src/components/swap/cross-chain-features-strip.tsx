'use client'

import { Zap, Globe, Shield, Timer, ChevronRight } from 'lucide-react'

export function CrossChainFeaturesStrip() {
  return (
    <div className="mt-8 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {[
        {
          icon: Zap,
          title: 'Instant Routes',
          description: 'Sub-200ms quote aggregation',
          color: 'from-green-500 to-emerald-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20'
        },
        {
          icon: Globe,
          title: 'Universal Bridge',
          description: '20+ chains, 14+ bridges',
          color: 'from-blue-500 to-cyan-600',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20'
        },
        {
          icon: Shield,
          title: 'MEV Protected',
          description: 'Front-running prevention',
          color: 'from-purple-500 to-violet-600',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20'
        },
        {
          icon: Timer,
          title: 'Resume Anywhere',
          description: 'Safe to close tabs',
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
            <ChevronRight className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </div>
        </div>
      ))}
    </div>
  )
} 