import { useState, useCallback } from 'react'
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Zap, 
  Clock, 
  ArrowRight, 
  Shield, 
  BarChart3, 
  Info, 
  ChevronDown, 
  AlertTriangle,
  Sparkles 
} from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { Token } from '@/hooks/use-tokens'
import { formatCurrency, formatTokenAmount, cn } from '@/lib/utils'

interface QuoteDisplayProps {
  quote: any
  fromToken: Token | null
  toToken: Token | null
  slippage: number
  exchangeRate: string
  minReceived: number
  isCrossChain: boolean
  fromChain: any
  toChain: any
  realtimeCountdown: number
  isCountdownPaused: boolean
  isSwapInProgress: boolean
  isLoading: boolean
  isRefreshing: boolean
  isAutoRefreshing: boolean
  allQuotes: any[]
  onRefresh: () => void
  onCompareQuotes: () => void
}

export function QuoteDisplay({
  quote,
  fromToken,
  toToken,
  slippage,
  exchangeRate,
  minReceived,
  isCrossChain,
  fromChain,
  toChain,
  realtimeCountdown,
  isCountdownPaused,
  isSwapInProgress,
  isLoading,
  isRefreshing,
  isAutoRefreshing,
  allQuotes,
  onRefresh,
  onCompareQuotes
}: QuoteDisplayProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Helper function to safely format quote amounts for display
  const formatQuoteAmount = useCallback((amount: string | undefined, token: Token | null) => {
    if (!amount || !token) return ''
    
    try {
      const formatted = formatTokenAmount(amount, token.decimals)
      const parsed = parseFloat(formatted)
      
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return ''
      if (parsed === 0) return '0'
      
      if (parsed < 0.000001) {
        return formatted
      }
      
      return parsed.toString()
    } catch (error) {
      console.warn('Failed to format quote amount:', error, { amount, token: token?.symbol })
      return ''
    }
  }, [])

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom duration-300">
      {/* Quote Summary Card */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
        
        {/* Loading Skeleton Overlay */}
        {(isLoading || isRefreshing || isAutoRefreshing) && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 rounded-xl">
            <div className="p-3">
              {/* Header Skeleton */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                </div>
              </div>
              
              {/* Content Skeleton */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                </div>
                
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                </div>
              </div>
              
              {/* Shimmer Effect */}
              <div 
                className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{
                  animation: 'shimmer 2s infinite',
                  transform: 'translateX(-100%)'
                }}
              />
              
              <style jsx>{`
                @keyframes shimmer {
                  0% { transform: translateX(-100%) skewX(-12deg); }
                  100% { transform: translateX(200%) skewX(-12deg); }
                }
              `}</style>
            </div>
          </div>
        )}
        
        {/* Header Row - Provider & Timing */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {/* Provider Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 capitalize">
                {quote?.provider || 'DEX'}
              </span>
            </div>
            
            {/* Cross-chain Badge */}
            {isCrossChain && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                Cross-Chain
              </div>
            )}
          </div>
          
          {/* Timing & Refresh */}
          <div className="flex items-center gap-2">
            {/* Smooth Quote Timer */}
            {realtimeCountdown > 0 && (
              <div className="flex items-center gap-2">
                {/* Progress Bar with PAUSE indicator */}
                <div className="relative w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute top-0 left-0 h-full rounded-full transition-all duration-100 ease-linear",
                      isCountdownPaused || isSwapInProgress 
                        ? "bg-gradient-to-r from-orange-400 to-red-500"
                        : realtimeCountdown > 15000 ? "bg-gradient-to-r from-green-400 to-green-500" :
                          realtimeCountdown > 5000 ? "bg-gradient-to-r from-yellow-400 to-yellow-500" : 
                          "bg-gradient-to-r from-red-400 to-red-500"
                    )}
                    style={{
                      width: `${Math.min(100, (realtimeCountdown / 30000) * 100)}%`,
                      transition: (realtimeCountdown <= 5000 || isCountdownPaused) ? 'none' : 'width 0.1s ease-linear'
                    }}
                  />
                  {isCountdownPaused || isSwapInProgress ? (
                    <div className="absolute inset-0 bg-orange-500/20 animate-pulse rounded-full" />
                  ) : realtimeCountdown <= 5000 && (
                    <div className="absolute inset-0 bg-red-500/30 animate-pulse rounded-full" />
                  )}
                </div>
                
                {/* Compact Timer with PAUSE indicator */}
                <div className="flex items-center gap-1">
                  <div className={cn(
                    "w-1 h-1 rounded-full",
                    isCountdownPaused || isSwapInProgress
                      ? "bg-orange-500 animate-pulse"
                      : realtimeCountdown > 15000 ? "bg-green-500" :
                        realtimeCountdown > 5000 ? "bg-yellow-500" : "bg-red-500 animate-ping"
                  )} />
                  <span className={cn(
                    "text-xs font-mono tabular-nums transition-colors",
                    isCountdownPaused || isSwapInProgress
                      ? "text-orange-600 dark:text-orange-400"
                      : realtimeCountdown > 15000 ? "text-green-600 dark:text-green-400" :
                        realtimeCountdown > 5000 ? "text-yellow-600 dark:text-yellow-400" : 
                        "text-red-600 dark:text-red-400"
                  )}>
                    {isCountdownPaused || isSwapInProgress ? '⏸' : Math.ceil(realtimeCountdown / 1000)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Enhanced Refresh Button */}
            <button 
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
              className={cn(
                "group relative p-2.5 rounded-xl transition-all duration-300 overflow-hidden",
                "border-2 border-transparent hover:border-orange-200 dark:hover:border-orange-700",
                "shadow-lg hover:shadow-xl active:scale-95 transform",
                (isLoading || isRefreshing || isAutoRefreshing)
                  ? "bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700" 
                  : "bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-900/20 dark:hover:to-red-900/20 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400",
                "disabled:cursor-not-allowed disabled:transform-none disabled:hover:border-transparent"
              )}
              title={(isLoading || isRefreshing || isAutoRefreshing) ? "Fetching new quote..." : "Refresh quote"}
            >
              {/* Background shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700" />
              
              {/* Loading ripple effect */}
              {(isLoading || isRefreshing || isAutoRefreshing) && (
                <>
                  <div className="absolute inset-0 bg-orange-500/10 animate-pulse rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-orange-500/20 to-orange-500/5 animate-ping rounded-xl" />
                </>
              )}
              
              {/* Icon with enhanced animations */}
              <RefreshCw className={cn(
                "w-4 h-4 relative z-10 transition-all duration-300",
                (isLoading || isRefreshing || isAutoRefreshing)
                  ? "animate-spin text-orange-600 dark:text-orange-400" 
                  : "group-hover:rotate-180 group-hover:scale-110"
              )} />
              
              {/* Click feedback overlay */}
              <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-active:opacity-100 transition-opacity duration-150 rounded-xl" />
            </button>
          </div>
        </div>

        {/* Main Quote Info */}
        <div className="p-3">
          {/* Top Row: Rate & Price Impact */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Rate:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {exchangeRate}
              </span>
            </div>
            
            {/* Price Impact Badge */}
            {quote?.priceImpact && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                (() => {
                  const impact = parseFloat(quote.priceImpact)
                  const absImpact = Math.abs(impact)
                  
                  // 🚀 FIXED: Positive impact = good (green), Negative impact = bad (red/yellow)
                  if (impact > 0) {
                    // Positive impact is good - green
                    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  } else if (impact < 0) {
                    // Negative impact is bad - red/yellow based on severity
                    return absImpact > 5 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'
                      : absImpact > 2 
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  } else {
                    // Zero impact - neutral
                    return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                  }
                })()
              )}>
                {(() => {
                  const impact = parseFloat(quote.priceImpact)
                  // 🚀 FIXED: Use appropriate icon based on impact direction
                  if (impact > 0) {
                    return <TrendingUp className="w-3 h-3" />
                  } else if (impact < 0) {
                    return <TrendingDown className="w-3 h-3" />
                  } else {
                    return <Minus className="w-3 h-3" />
                  }
                })()}
                {(() => {
                  const impact = parseFloat(quote.priceImpact)
                  const absImpact = Math.abs(impact)
                  const sign = impact > 0 ? '+' : impact < 0 ? '-' : ''
                  return `${sign}${absImpact.toFixed(2)}% impact`
                })()}
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Gas Fee */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Gas</span>
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {quote?.gasEstimate?.gasFeeUSD ? 
                  formatCurrency(typeof quote.gasEstimate.gasFeeUSD === 'number' ? 
                    quote.gasEstimate.gasFeeUSD : 
                    parseFloat(String(quote.gasEstimate.gasFeeUSD))
                  ) : 
                  '$0.00'
                }
              </div>
            </div>
            
            {/* Time Estimate */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Time</span>
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {isCrossChain ? '2-5m' : '~30s'}
              </div>
            </div>
          </div>

          {/* Route Display - Horizontal */}
          <div className="flex items-center justify-center gap-2 p-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700/30 dark:to-gray-800/30 rounded-lg mb-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {fromChain?.name || 'ETH'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            {isCrossChain && (
              <>
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium">
                  Bridge
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </>
            )}
            <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
              {quote?.provider}
            </span>
          </div>

          {/* Bottom Actions Row */}
          <div className="flex items-center gap-2">
            {/* Min Received */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex-1">
              <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Min:</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                <NumericFormat
                  value={minReceived}
                  displayType="text"
                  thousandSeparator=","
                  decimalSeparator="."
                  decimalScale={minReceived < 1 ? 6 : 4}
                  fixedDecimalScale={false}
                  allowLeadingZeros={false}
                  suffix={` ${toToken?.symbol || ''}`}
                />
              </span>
            </div>

            {/* Compare Routes */}
            {allQuotes && allQuotes.length > 1 && (
              <button
                onClick={onCompareQuotes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 text-xs font-medium text-gray-900 dark:text-white"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {allQuotes.length} routes
              </button>
            )}
            
            {/* Details Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              <Info className="w-3.5 h-3.5" />
              <ChevronDown className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                showAdvanced && "rotate-180"
              )} />
            </button>
          </div>

          {/* Advanced Details Collapsible */}
          {showAdvanced && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg animate-in slide-in-from-top duration-200">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Slippage Tolerance</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{slippage}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Network Fee</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {quote?.protocolFee || '0.05%'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Route Type</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isCrossChain ? 'Cross-Chain' : 'Single Chain'}
                  </span>
                </div>
              </div>
              
              {/* High Impact Warning */}
              {quote?.priceImpact && Math.abs(parseFloat(quote.priceImpact)) > 5 && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mt-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-red-800 dark:text-red-300">
                      High Price Impact ({(() => {
                        const impact = parseFloat(quote.priceImpact)
                        const sign = impact > 0 ? '+' : impact < 0 ? '-' : ''
                        return `${sign}${Math.abs(impact).toFixed(2)}%`
                      })()})
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                      You may receive significantly less than expected
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 