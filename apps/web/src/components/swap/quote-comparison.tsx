'use client'

/**
 * QuoteComparison - Jupiter-inspired multiple quotes comparison
 * 
 * Features:
 * - Visual route comparison with clear metrics
 * - Best quote highlighting
 * - Provider info with logos
 * - Time estimates and fee breakdown
 * - Smart recommendations
 * - Mobile-optimized design
 */

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Clock, Zap, Shield, Info, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'

interface Quote {
  id: string
  provider: string
  fromAmount: number
  toAmount: number
  toAmountMin: number
  price: number
  priceImpact: number
  slippageTolerance: number
  gasEstimate: {
    gasLimit: number
    gasPrice: number
    gasFee: number
    gasFeeUSD: number
  }
  route: {
    steps: Array<{
      type: string
      protocol: string
      fromToken: Token
      toToken: Token
      fromAmount: number
      toAmount: number
      fee: number
      priceImpact: number
    }>
    totalFee: number
    gasEstimate: any
  }
  callData: string
  to: string
  value: string
  createdAt: string
  expiresAt: string
}

interface QuoteComparisonProps {
  quotes: Quote[]
  selectedQuote: Quote | null
  onSelectQuote: (quote: Quote) => void
  fromToken: Token | null
  toToken: Token | null
  isLoading?: boolean
  error?: Error | null
}

// Provider configurations
const PROVIDER_CONFIG = {
  lifi: {
    name: 'LiFi',
    description: 'Cross-chain bridge aggregator',
    logo: '🌉',
    color: 'from-purple-500 to-pink-500',
    badge: 'Bridge',
  },
  '1inch': {
    name: '1inch',
    description: 'DEX aggregator',
    logo: '🦄',
    color: 'from-blue-500 to-cyan-500',
    badge: 'DEX',
  },
  relay: {
    name: 'Relay',
    description: 'Cross-chain protocol',
    logo: '⚡',
    color: 'from-yellow-500 to-orange-500',
    badge: 'Fast',
  },
  jupiter: {
    name: 'Jupiter',
    description: 'Solana swap aggregator',
    logo: '🪐',
    color: 'from-green-500 to-emerald-500',
    badge: 'Popular',
  },
}

export function QuoteComparison({
  quotes,
  selectedQuote,
  onSelectQuote,
  fromToken,
  toToken,
  isLoading = false,
  error = null
}: QuoteComparisonProps) {
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set())
  const [showAllQuotes, setShowAllQuotes] = useState(false)

  // Sort quotes by best value (highest output amount)
  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      // Primary: highest output amount
      if (b.toAmount !== a.toAmount) {
        return b.toAmount - a.toAmount
      }
      // Secondary: lowest price impact
      if (a.priceImpact !== b.priceImpact) {
        return a.priceImpact - b.priceImpact
      }
      // Tertiary: lowest gas cost
      return a.gasEstimate.gasFeeUSD - b.gasEstimate.gasFeeUSD
    })
  }, [quotes])

  const bestQuote = sortedQuotes[0]
  const visibleQuotes = showAllQuotes ? sortedQuotes : sortedQuotes.slice(0, 3)

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
    return PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG] || {
      name: provider,
      description: 'DEX Aggregator',
      logo: '⚡',
      color: 'from-gray-500 to-gray-600',
      badge: 'DEX',
    }
  }

  const getQuoteBadges = (quote: Quote) => {
    const badges = []
    
    if (quote === bestQuote) {
      badges.push({ text: 'Best Price', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: TrendingUp })
    }
    
    if (quote.gasEstimate.gasFeeUSD < 0.5) {
      badges.push({ text: 'Low Gas', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Zap })
    }
    
    if (quote.priceImpact < 0.1) {
      badges.push({ text: 'No Impact', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Shield })
    }
    
    return badges
  }

  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Failed to get quotes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error.message || 'Please try again or adjust your swap parameters'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No quotes available</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Adjust your swap parameters or try different tokens
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Routes</h3>
            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {quotes.length} found
              </span>
            </div>
          </div>
          {isCrossChain && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
              <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Cross-Chain</span>
            </div>
          )}
        </div>
      </div>

      {/* Quote List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {visibleQuotes.map((quote, index) => {
          const isSelected = selectedQuote?.id === quote.id
          const isExpanded = expandedQuotes.has(quote.id)
          const isBest = quote === bestQuote
          const config = getProviderConfig(quote.provider)
          const badges = getQuoteBadges(quote)
          
          return (
            <div
              key={quote.id}
              className={cn(
                "transition-all duration-200",
                isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              {/* Quote Row */}
              <div
                className="flex items-center gap-4 px-6 py-4 cursor-pointer"
                onClick={() => onSelectQuote(quote)}
              >
                {/* Provider Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br",
                    config.color
                  )}>
                    {config.logo}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{config.name}</h4>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                        {config.badge}
                      </span>
                      {isBest && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {config.description}
                      </p>
                      {quote.route.steps.length > 1 && (
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {quote.route.steps.length} steps
                        </span>
                      )}
                    </div>

                    {/* Badges */}
                    {badges.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {badges.map((badge, i) => (
                          <div key={i} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs", badge.color)}>
                            <badge.icon className="w-3 h-3" />
                            {badge.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quote Details */}
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(quote.toAmount)} {toToken?.symbol}
                    </span>
                    {isSelected && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>~{formatCurrency(quote.gasEstimate.gasFeeUSD)}</span>
                    <span className={cn(
                      quote.priceImpact < 1 ? 'text-green-600 dark:text-green-400' :
                      quote.priceImpact < 3 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    )}>
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                    {isCrossChain && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        2-5min
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleQuoteExpanded(quote.id)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
                  <div className="pt-4 space-y-4">
                    {/* Route Steps */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Route</h5>
                      <div className="space-y-2">
                        {quote.route.steps.map((step, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <div className="w-6 h-6 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </div>
                            <span className="text-gray-600 dark:text-gray-300">
                              {formatNumber(step.fromAmount)} {step.fromToken.symbol}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-600 dark:text-gray-300">
                              {formatNumber(step.toAmount)} {step.toToken.symbol}
                            </span>
                            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                              {step.protocol}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gas & Fees */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Gas Fee</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(quote.gasEstimate.gasFeeUSD)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Protocol Fee</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {quote.route.totalFee.toFixed(4)}%
                        </p>
                      </div>
                    </div>

                    {/* View on Explorer */}
                    <button className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      <ExternalLink className="w-4 h-4" />
                      View route details
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Show More Button */}
      {sortedQuotes.length > 3 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAllQuotes(!showAllQuotes)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showAllQuotes ? (
              <>
                Show less
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Show {sortedQuotes.length - 3} more routes
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
} 