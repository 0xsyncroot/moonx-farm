'use client'

import { Bot, HelpCircle, ArrowRight } from 'lucide-react'

export function AIRecommendationsPanel() {
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Lili's Picks
          </h3>
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
              Lili's curated trading picks based on AI analysis and market sentiment for optimal trading opportunities
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Live</span>
          </div>
        </div>

        <div className="h-80 overflow-hidden picks-container relative border-b border-gray-200/50 dark:border-gray-700/50 mb-4">
          <div className="picks-slider">
            {[
              {
                from: 'BNB',
                to: 'USDT',
                reason: 'High volume',
                confidence: '94%',
                risk: 'Low',
                chain: 'bsc'
              },
              {
                from: 'ETH',
                to: 'USDC',
                reason: 'Trending pair',
                confidence: '89%',
                risk: 'Low',
                chain: 'base'
              },
              {
                from: 'CAKE',
                to: 'BNB',
                reason: 'Good momentum',
                confidence: '85%',
                risk: 'Medium',
                chain: 'bsc'
              },
              {
                from: 'WETH',
                to: 'USDC',
                reason: 'Stable volatility',
                confidence: '82%',
                risk: 'Low',
                chain: 'base'
              },
              // Duplicates for smooth infinite loop
              {
                from: 'BNB',
                to: 'USDT',
                reason: 'High volume',
                confidence: '94%',
                risk: 'Low',
                chain: 'bsc'
              },
              {
                from: 'ETH',
                to: 'USDC',
                reason: 'Trending pair',
                confidence: '89%',
                risk: 'Low',
                chain: 'base'
              },
              {
                from: 'CAKE',
                to: 'BNB',
                reason: 'Good momentum',
                confidence: '85%',
                risk: 'Medium',
                chain: 'bsc'
              },
              {
                from: 'WETH',
                to: 'USDC',
                reason: 'Stable volatility',
                confidence: '82%',
                risk: 'Low',
                chain: 'base'
              }
            ].map((rec, index) => (
              <div key={index} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-300 cursor-pointer picks-item flex-shrink-0">
                <div className="px-3 py-3">
                  {/* Trade pair row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-[#ff7842] transition-all duration-300 hover-text-shadow">
                        {rec.from}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-[#ff7842] group-hover:scale-110 transition-all duration-300" />
                      <span className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-[#ff7842] transition-all duration-300 hover-text-shadow">
                        {rec.to}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400 group-hover:text-[#ff7842] group-hover:scale-110 transition-all duration-300 hover-text-shadow">
                      {rec.confidence}
                    </div>
                  </div>
                  
                  {/* Info row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${rec.risk === 'Low' ? 'bg-green-500' :
                        rec.risk === 'Medium' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-[#ff7842] transition-colors duration-300 hover-text-shadow">{rec.risk}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded font-medium group-hover:text-[#ff7842] transition-all duration-300 hover-text-shadow">
                        {rec.reason}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <div className="group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                        {rec.chain === 'bsc' ? (
                          <div className="w-5 h-5 rounded-full overflow-hidden">
                            <svg viewBox="0 0 24 24" className="w-full h-full">
                              <circle cx="12" cy="12" r="12" fill="#F3BA2F" />
                              <g fill="white">
                                <path d="M12 9.5L9.5 12L12 14.5L14.5 12L12 9.5z" />
                                <path d="M7.5 12L5 14.5L7.5 17L10 14.5L7.5 12z" />
                                <path d="M16.5 12L14 14.5L16.5 17L19 14.5L16.5 12z" />
                                <path d="M12 5.5L9.5 8L12 10.5L14.5 8L12 5.5z" />
                                <path d="M12 16.5L9.5 19L12 21.5L14.5 19L12 16.5z" />
                              </g>
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full overflow-hidden">
                            <svg viewBox="0 0 24 24" className="w-full h-full">
                              <circle cx="12" cy="12" r="12" fill="#0052FF" />
                              <circle cx="12" cy="12" r="8" fill="none" stroke="white" strokeWidth="2" />
                              <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeWidth="1.5" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-medium group-hover:text-[#ff7842] transition-colors duration-300 hover-text-shadow">
                        {rec.chain === 'bsc' ? 'BSC' : 'Base'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        /* Lili's Picks Animation */
        .picks-container {
          position: relative;
        }
        
        .picks-slider {
          animation: slideItems 16s ease-in-out infinite;
          display: flex;
          flex-direction: column;
        }
        
        .picks-container:hover .picks-slider {
          animation-play-state: paused;
        }

        @keyframes slideItems {
          0%, 20% {
            transform: translateY(0);
          }
          25%, 45% {
            transform: translateY(-81px);
          }
          50%, 70% {
            transform: translateY(-162px);
          }
          75%, 95% {
            transform: translateY(-243px);
          }
          100% {
            transform: translateY(-324px);
          }
        }

        .picks-item {
          opacity: 1;
          transform: translateY(0);
          height: 80px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-bottom: 1px;
        }

        /* Orange Text Drop Shadow Effect */
        .hover-text-shadow {
          filter: drop-shadow(0 2px 4px rgba(255, 120, 66, 0.3));
          text-shadow: 0 0 8px rgba(255, 120, 66, 0.4);
        }

        @keyframes slideUpFade {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
} 