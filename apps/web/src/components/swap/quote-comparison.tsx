'use client'

/**
 * QuoteComparison - Jupiter-style route comparison with optimized styling
 * 
 * Features:
 * - Correct price impact color coding (red = negative, green = positive)
 * - Responsive design with proper breakpoints
 * - Fixed styling conflicts and overlaps
 * - Optimized dark/light mode support
 * - Clean layout with proper spacing
 * - Mobile-first approach
 * - Enhanced error handling and loading states
 */

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Clock, Zap, Shield, TrendingUp, AlertTriangle, ExternalLink, Star, ArrowRight, CheckCircle, Target } from 'lucide-react'
import { formatCurrency, formatNumber, formatTokenAmount, cn } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'
import { Quote } from '@/lib/api-client'

interface QuoteComparisonProps {
  quotes: Quote[]
  selectedQuote: Quote | null
  onSelectQuote: (quote: Quote) => void
  fromToken: Token | null
  toToken: Token | null
  isLoading?: boolean
  error?: Error | null
  onClose?: () => void
}

// Enhanced provider configurations with better branding
const PROVIDER_CONFIG = {
  lifi: { 
    name: 'LiFi', 
    logo: '🌉', 
    color: 'from-purple-500 to-pink-500',
    description: 'Cross-chain bridge',
    category: 'Bridge'
  },
  '1inch': { 
    name: '1inch', 
    logo: '🦄', 
    color: 'from-blue-500 to-cyan-500',
    description: 'DEX aggregator',
    category: 'Aggregator'
  },
  relay: { 
    name: 'Relay', 
    logo: '⚡', 
    color: 'from-yellow-500 to-orange-500',
    description: 'Fast swaps',
    category: 'DEX'
  },
  jupiter: { 
    name: 'Jupiter', 
    logo: '🪐', 
    color: 'from-green-500 to-emerald-500',
    description: 'Solana DEX',
    category: 'Aggregator'
  },
  uniswap: {
    name: 'Uniswap',
    logo: '🦄',
    color: 'from-pink-500 to-purple-500',
    description: 'Leading DEX',
    category: 'DEX'
  },
  default: {
    name: 'DEX',
    logo: '⚡',
    color: 'from-gray-500 to-gray-600',
    description: 'Exchange',
    category: 'DEX'
  }
}

export function QuoteComparison({
  quotes,
  selectedQuote,
  onSelectQuote,
  fromToken,
  toToken,
  isLoading = false,
  error = null,
  onClose
}: QuoteComparisonProps) {
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set())

  // 🚀 IMPROVED: Helper function to safely format amounts with better error handling
  const safeFormatAmount = (amount: string | number | undefined, decimals: number = 18): number => {
    if (!amount) return 0
    
    try {
      const formatted = formatTokenAmount(String(amount), decimals)
      const parsed = parseFloat(formatted)
      
      // Return 0 if parsing failed or result is invalid
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return 0
      
      return parsed
    } catch (error) {
      console.warn('Failed to format amount:', error, { amount, decimals })
      return 0
    }
  }

  // 🚀 IMPROVED: Helper function for price impact color (Jupiter-style)
  const getPriceImpactColor = (priceImpact: string | number): string => {
    const impact = typeof priceImpact === 'string' ? parseFloat(priceImpact) : priceImpact
    
    if (isNaN(impact)) return 'text-gray-500 dark:text-gray-400'
    
    // Positive impact = good = green, Negative impact = bad = red
    if (impact > 0) {
      return impact > 1 ? 'text-green-600 dark:text-green-400' : 'text-green-500 dark:text-green-400'
    } else if (impact < 0) {
      const absImpact = Math.abs(impact)
      return absImpact > 5 ? 'text-red-600 dark:text-red-400' :
             absImpact > 1 ? 'text-orange-600 dark:text-orange-400' :
             'text-yellow-600 dark:text-yellow-400'
    } else {
      return 'text-gray-500 dark:text-gray-400'
    }
  }

  // 🚀 IMPROVED: Format price impact with proper sign and color
  const formatPriceImpact = (priceImpact: string | number): string => {
    const impact = typeof priceImpact === 'string' ? parseFloat(priceImpact) : priceImpact
    
    if (isNaN(impact)) return '0.00%'
    
    const absImpact = Math.abs(impact)
    const sign = impact > 0 ? '+' : impact < 0 ? '-' : ''
    
    return `${sign}${absImpact.toFixed(2)}%`
  }

  // Sort quotes by best value - FIXED to use safe amount formatting
  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      const aAmount = safeFormatAmount(a.toAmount, toToken?.decimals || 18)
      const bAmount = safeFormatAmount(b.toAmount, toToken?.decimals || 18)
      if (bAmount !== aAmount) return bAmount - aAmount
      
      const aImpact = parseFloat(a.priceImpact || '0')
      const bImpact = parseFloat(b.priceImpact || '0')
      if (aImpact !== bImpact) return aImpact - bImpact
      
      const aGasFee = a.gasEstimate?.gasFeeUSD || 0
      const bGasFee = b.gasEstimate?.gasFeeUSD || 0
      return aGasFee - bGasFee
    })
  }, [quotes, toToken?.decimals])

  const bestQuote = sortedQuotes[0]

  const toggleQuoteExpanded = (quoteId: string) => {
    const newExpanded = new Set(expandedQuotes)
    if (newExpanded.has(quoteId)) {
      newExpanded.delete(quoteId)
    } else {
      newExpanded.add(quoteId)
    }
    setExpandedQuotes(newExpanded)
  }

  const getProviderConfig = (provider: string) => {
    return PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG] || PROVIDER_CONFIG.default
  }

  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId

  // 🚀 IMPROVED: Enhanced error handling UI
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base">Failed to get quotes</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              {error.message || 'Please check your connection and try again'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 🚀 IMPROVED: Enhanced loading state
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
            <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
              <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3" />
          <span className="text-sm">Finding best routes...</span>
        </div>
      </div>
    )
  }

  // 🚀 IMPROVED: Enhanced empty state
  if (quotes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-center">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">No routes available</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto mb-4">
          No liquidity found for this trading pair. Try different tokens or amounts.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white truncate">Compare Routes</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {quotes.length} route{quotes.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          
          {isCrossChain && (
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full border border-purple-200 dark:border-purple-700 flex-shrink-0">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300">Cross-Chain</span>
            </div>
          )}
        </div>
      </div>

      {/* Quote List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 sm:max-h-96 overflow-y-auto">
        {sortedQuotes.map((quote, index) => {
          const isSelected = selectedQuote?.id === quote.id
          const isExpanded = expandedQuotes.has(quote.id)
          const isBest = quote === bestQuote
          const config = getProviderConfig(quote.provider)
          const toAmountFormatted = toToken ? 
            safeFormatAmount(quote.toAmount, toToken.decimals).toLocaleString('en-US', { maximumFractionDigits: 6 }) :
            safeFormatAmount(quote.toAmount, 18).toLocaleString('en-US', { maximumFractionDigits: 6 })

          // 🚀 IMPROVED: Better savings calculation
          const savings = index > 0 && toToken ? 
            (() => {
              const bestAmount = safeFormatAmount(bestQuote.toAmount, toToken.decimals)
              const currentAmount = safeFormatAmount(quote.toAmount, toToken.decimals)
              if (bestAmount === 0 || currentAmount === 0) return 0
              return ((bestAmount - currentAmount) / bestAmount * 100)
            })() : 0
          
          return (
            <div
              key={quote.id}
              className={cn(
                "transition-all duration-200 cursor-pointer",
                isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
              )}
              onClick={() => {
                console.log('🔄 Quote comparison: selecting quote', {
                  id: quote.id,
                  provider: quote.provider,
                  hasCallData: !!quote.callData,
                  hasValue: !!quote.value,
                  hasFromToken: !!quote.fromToken?.address,
                  hasToToken: !!quote.toToken?.address,
                  fromAmount: quote.fromAmount,
                  toAmount: quote.toAmount
                })
                
                // Validate quote before selection
                if (!quote.callData || !quote.fromToken?.address || !quote.toToken?.address) {
                  console.error('❌ Attempting to select invalid quote:', quote)
                  return
                }
                
                onSelectQuote(quote)
                onClose?.()
              }}
            >
              {/* Main Quote Row */}
              <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
                {/* Provider Info */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-base font-bold shadow-sm bg-gradient-to-br flex-shrink-0",
                    config.color
                  )}>
                    {config.logo}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">{config.name}</h4>
                      
                      {/* Best Badge */}
                      {isBest && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500 text-white rounded-full flex-shrink-0">
                          <Star className="w-2.5 h-2.5" />
                          <span className="text-xs font-bold">Best</span>
                        </div>
                      )}
                      
                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full flex-shrink-0">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span className="text-xs font-bold">Selected</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      <span className="truncate">{config.description}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                        {config.category}
                      </span>
                      {quote.route.steps.length > 1 && (
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <Target className="w-3 h-3" />
                          {quote.route.steps.length} steps
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quote Performance */}
                <div className="text-right space-y-1 flex-shrink-0">
                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                    <span className={cn(
                      "font-bold text-gray-900 dark:text-white",
                      // Dynamic text size based on length - consistent with swap interface
                      toAmountFormatted.length > 12 ? "text-xs sm:text-sm" :
                      toAmountFormatted.length > 8 ? "text-sm sm:text-base" :
                      "text-sm sm:text-lg"
                    )}>
                      {toAmountFormatted}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {toToken?.symbol}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 text-xs sm:text-sm">
                    <span className="text-gray-500 dark:text-gray-400 truncate">
                      {quote.gasEstimate?.gasFeeUSD ? 
                        formatCurrency(typeof quote.gasEstimate.gasFeeUSD === 'number' ? 
                          quote.gasEstimate.gasFeeUSD : 
                          parseFloat(String(quote.gasEstimate.gasFeeUSD))
                        ) : 
                        '$0.00'
                      }
                    </span>
                    {/* 🚀 FIXED: Proper price impact color coding */}
                    <span className={cn(
                      "font-medium flex-shrink-0",
                      getPriceImpactColor(quote.priceImpact || '0')
                    )}>
                      {formatPriceImpact(quote.priceImpact || '0')}
                    </span>
                  </div>
                  
                  {/* Savings Badge */}
                  {index > 0 && savings > 0.01 && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                      -{savings.toFixed(1)}% less
                    </div>
                  )}
                </div>

                {/* Expand Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleQuoteExpanded(quote.id)
                  }}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                  title={isExpanded ? 'Hide details' : 'Show details'}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 sm:px-6 pb-3 sm:pb-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
                  <div className="pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                    {/* Route Steps */}
                    <div>
                      <h5 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                        Route Details ({quote.route.steps?.length || 0} steps)
                      </h5>
                      <div className="space-y-2">
                        {quote.route.steps?.map((step, i) => (
                          <div key={i} className="p-3 sm:p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            {/* Step Header */}
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                                    {step.type || 'swap'}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">via</span>
                                  <span className="font-medium text-purple-600 dark:text-purple-400 text-sm">
                                    {step.protocol || 'Unknown'}
                                  </span>
                                </div>
                                {step.poolAddress && (
                                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Pool: {step.poolAddress.slice(0, 6)}...{step.poolAddress.slice(-4)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Step Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                              {/* From Token */}
                              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2 flex-1">
                                  {step.fromToken?.logoURI && (
                                    <img 
                                      src={step.fromToken.logoURI} 
                                      alt={step.fromToken.symbol}
                                      className="w-4 h-4 rounded-full"
                                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {step.fromToken && step.fromAmount ? 
                                        safeFormatAmount(step.fromAmount, step.fromToken.decimals || 18).toLocaleString('en-US', { maximumFractionDigits: 6 }) :
                                        '0'
                                      } {step.fromToken?.symbol || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      From
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* To Token */}
                              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2 flex-1">
                                  {step.toToken?.logoURI && (
                                    <img 
                                      src={step.toToken.logoURI} 
                                      alt={step.toToken.symbol}
                                      className="w-4 h-4 rounded-full"
                                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {step.toToken && step.toAmount ? 
                                        safeFormatAmount(step.toAmount, step.toToken.decimals || 18).toLocaleString('en-US', { maximumFractionDigits: 6 }) :
                                        '0'
                                      } {step.toToken?.symbol || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      To
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Step Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              {/* Step Fee */}
                              <div className="text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fee</div>
                                <div className="font-medium text-gray-900 dark:text-white text-xs">
                                  {(() => {
                                    if (!step.fee || !step.fromToken) {
                                      return '0.00%'
                                    }
                                    
                                    const feeValue = typeof step.fee === 'number' ? 
                                      step.fee : 
                                      parseFloat(String(step.fee))
                                    
                                    if (isNaN(feeValue)) {
                                      return '0.00%'
                                    }
                                    
                                    // Check if fee is in wei format (very large number) or percentage
                                    if (feeValue > 100) {
                                      // Fee is in wei format, need to format with token decimals
                                      const feeAmountFormatted = safeFormatAmount(feeValue, step.fromToken.decimals || 18)
                                      return `${feeAmountFormatted.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${step.fromToken.symbol}`
                                    } else {
                                      // Fee is percentage, calculate actual amount
                                      if (step.fromAmount && feeValue > 0) {
                                        const fromAmountFormatted = safeFormatAmount(step.fromAmount, step.fromToken.decimals || 18)
                                        const feeAmount = fromAmountFormatted * (feeValue / 100)
                                        if (!isNaN(feeAmount) && feeAmount > 0) {
                                          return `${feeAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${step.fromToken.symbol}`
                                        }
                                      }
                                      return `${feeValue.toFixed(4)}%`
                                    }
                                  })()}
                                </div>
                              </div>

                              {/* Step Price Impact */}
                              <div className="text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Impact</div>
                                <div className={cn(
                                  "font-medium text-xs",
                                  getPriceImpactColor(step.priceImpact || '0')
                                )}>
                                  {formatPriceImpact(step.priceImpact || '0')}
                                </div>
                              </div>

                              {/* Step Gas */}
                              {step.gasEstimate && (
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gas</div>
                                  <div className="font-medium text-gray-900 dark:text-white text-xs">
                                    {step.gasEstimate.gasFeeUSD ? 
                                      formatCurrency(typeof step.gasEstimate.gasFeeUSD === 'number' ? 
                                        step.gasEstimate.gasFeeUSD : 
                                        parseFloat(String(step.gasEstimate.gasFeeUSD))
                                      ) : 
                                      '$0.00'
                                    }
                                  </div>
                                </div>
                              )}

                              {/* Step Type */}
                              <div className="text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type</div>
                                <div className="font-medium text-blue-600 dark:text-blue-400 text-xs capitalize">
                                  {step.type || 'swap'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                          <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Gas</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {formatCurrency(quote.gasEstimate.gasFeeUSD)}
                        </p>
                      </div>
                      
                      <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fee</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {(() => {
                            if (!quote.route.totalFee || !fromToken) {
                              return '0.00%'
                            }
                            
                            const feeValue = typeof quote.route.totalFee === 'number' ? 
                              quote.route.totalFee : 
                              parseFloat(String(quote.route.totalFee))
                            
                            // Check if fee is in wei format (very large number) or percentage
                            if (feeValue > 100) {
                              // Fee is in wei format, need to format with token decimals
                              const feeAmountFormatted = safeFormatAmount(feeValue, fromToken.decimals)
                              return `${feeAmountFormatted.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromToken.symbol}`
                            } else {
                              // Fee is percentage, calculate actual amount
                              if (quote.fromAmount && feeValue > 0) {
                                const fromAmountFormatted = safeFormatAmount(quote.fromAmount, fromToken.decimals)
                                const feeAmount = fromAmountFormatted * (feeValue / 100)
                                return `${feeAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromToken.symbol}`
                              }
                              return `${feeValue.toFixed(2)}%`
                            }
                          })()}
                        </p>
                      </div>
                      
                      <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                          <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Impact</span>
                        </div>
                        <p className={cn(
                          "font-bold text-xs sm:text-sm",
                          getPriceImpactColor(quote.priceImpact || '0')
                        )}>
                          {formatPriceImpact(quote.priceImpact || '0')}
                        </p>
                      </div>
                      
                      <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Time</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {isCrossChain ? '2-5m' : '~30s'}
                        </p>
                      </div>
                    </div>

                    {/* 🚀 IMPROVED: High Impact Warning with correct logic */}
                    {(() => {
                      const impact = parseFloat(quote.priceImpact || '0')
                      const absImpact = Math.abs(impact)
                      return absImpact > 5 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg text-xs sm:text-sm">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>High price impact ({formatPriceImpact(impact)}) - consider smaller amounts</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
            <span>Routes verified and sorted by output</span>
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            Updated {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  )
} 