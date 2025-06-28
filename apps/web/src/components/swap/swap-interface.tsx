'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, RefreshCw, AlertTriangle, Settings, Zap, ExternalLink, ChevronDown } from 'lucide-react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import Image from 'next/image'
import { TokenSelector } from './token-selector'
import { SwapButton } from './swap-button'
import { SwapSettings } from './swap-settings'
import { QuoteComparison } from './quote-comparison'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useQuote } from '@/hooks/use-quote'
import { useAuth } from '@/hooks/use-auth'
import { Token } from '@/hooks/use-tokens'

// Chain configurations for cross-chain support
const SUPPORTED_CHAINS = {
  1: { name: 'Ethereum', icon: '⟠', color: 'bg-blue-500' },
  8453: { name: 'Base', icon: '🔵', color: 'bg-blue-600' },
  56: { name: 'BSC', icon: '🟡', color: 'bg-yellow-500' },
}

export function SwapInterface() {
  const { client: smartWalletClient } = useSmartWallets()
  const { walletInfo } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuoteComparison, setShowQuoteComparison] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)

  const {
    fromToken,
    toToken,
    amount,
    slippage,
    quote,
    isLoading,
    error,
    isValidRequest,
    exchangeRate,
    priceImpactColor,
    priceImpactSeverity,
    timeUntilExpiry,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    swapTokens,
    refetch,
  } = useQuote()

  // URL routing functions
  const updateURL = (params: Record<string, string | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newSearchParams.delete(key)
      } else {
        newSearchParams.set(key, value)
      }
    })
    
    router.push(`/?${newSearchParams.toString()}`, { scroll: false })
  }

  // Initialize state from URL parameters
  useEffect(() => {
    const fromTokenSymbol = searchParams.get('from')
    const toTokenSymbol = searchParams.get('to') 
    const fromChainId = searchParams.get('fromChain')
    const toChainId = searchParams.get('toChain')
    const amountParam = searchParams.get('amount')
    const slippageParam = searchParams.get('slippage')

    // Load tokens from URL if available
    // This would need to be implemented with actual token lookup
    // For now, we'll just set the amount and slippage if available
    
    if (amountParam && !amount) {
      setAmount(amountParam)
    }
    
    if (slippageParam && !slippage) {
      setSlippage(parseFloat(slippageParam))
    }
  }, []) // Only run on mount

  // Update URL when tokens or amount change  
  useEffect(() => {
    const params: Record<string, string | null> = {}
    
    if (fromToken) {
      params.from = fromToken.symbol
      params.fromChain = fromToken.chainId.toString()
    } else {
      params.from = null
      params.fromChain = null
    }
    
    if (toToken) {
      params.to = toToken.symbol
      params.toChain = toToken.chainId.toString()
    } else {
      params.to = null
      params.toChain = null
    }
    
    if (amount && amount !== '0') {
      params.amount = amount
    } else {
      params.amount = null
    }
    
    if (slippage && slippage !== 0.5) { // 0.5% is default
      params.slippage = slippage.toString()
    } else {
      params.slippage = null
    }
    
    updateURL(params)
  }, [fromToken?.symbol, fromToken?.chainId, toToken?.symbol, toToken?.chainId, amount, slippage])

  // Use selected quote or default to first quote
  const activeQuote = selectedQuote || quote

  // Check if this is a cross-chain swap
  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId

  // Get chain info
  const fromChain = fromToken ? SUPPORTED_CHAINS[fromToken.chainId as keyof typeof SUPPORTED_CHAINS] : null
  const toChain = toToken ? SUPPORTED_CHAINS[toToken.chainId as keyof typeof SUPPORTED_CHAINS] : null

  // Calculate minimum received after slippage
  const minReceived = activeQuote ? activeQuote.toAmountMin : 0

  // Format expiry countdown
  const formatTimeUntilExpiry = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const handleRefresh = () => {
    refetch()
  }

  const handleSelectQuote = (quote: any) => {
    setSelectedQuote(quote)
    setShowQuoteComparison(false)
  }

  // Default chain ID (ensure it's a number)
  const defaultChainId = useMemo(() => {
    const chainId = walletInfo?.chainId
    if (typeof chainId === 'number') return chainId
    if (typeof chainId === 'string') return parseInt(chainId, 10)
    return 1 // Default to Ethereum
  }, [walletInfo?.chainId])

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Main Swap Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Swap</h2>
            {isCrossChain && (
              <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-full">
                <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Cross-Chain</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              title="Swap Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading || !isValidRequest}
              className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors 
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh Quote"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Cross-Chain Bridge Info */}
          {isCrossChain && fromChain && toChain && (
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", fromChain.color)} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fromChain.name}</span>
                </div>
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", toChain.color)} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{toChain.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">From</span>
              {smartWalletClient?.account?.address && fromToken && (
                <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm">
                  Balance: {formatNumber(0)} {fromToken.symbol}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-3xl font-bold bg-transparent border-0 outline-none 
                             text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-0"
                  />
                  
                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowFromTokenSelector(true)}
                    className="flex items-center gap-3 px-4 py-3 ml-4
                             bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 
                             border border-gray-200 dark:border-gray-600 rounded-xl
                             transition-colors shadow-sm"
                  >
                    {fromToken ? (
                      <>
                        {fromToken.logoURI && (
                          <Image 
                            src={fromToken.logoURI} 
                            alt={fromToken.symbol}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="font-bold text-gray-900 dark:text-white">{fromToken.symbol}</span>
                        {fromChain && (
                          <div className={cn("w-2 h-2 rounded-full", fromChain.color)} />
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Select token</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* USD Value */}
                {fromToken?.priceUSD && amount && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    ≈ {formatCurrency(parseFloat(amount) * fromToken.priceUSD)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Swap Arrow with Animation */}
          <div className="flex justify-center">
            <button
              onClick={swapTokens}
              disabled={!fromToken || !toToken}
              className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
                       border border-gray-200 dark:border-gray-700 rounded-2xl
                       transition-all duration-200 hover:scale-105 hover:shadow-lg
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       group"
            >
              <ArrowUpDown className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">To</span>
              {smartWalletClient?.account?.address && toToken && (
                <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm">
                  Balance: {formatNumber(0)} {toToken.symbol}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={activeQuote?.toAmount ? formatNumber(activeQuote.toAmount) : ''}
                    readOnly
                    className="text-3xl font-bold bg-transparent border-0 outline-none 
                             text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-0"
                  />
                  
                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowToTokenSelector(true)}
                    className="flex items-center gap-3 px-4 py-3 ml-4
                             bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 
                             border border-gray-200 dark:border-gray-600 rounded-xl
                             transition-colors shadow-sm"
                  >
                    {toToken ? (
                      <>
                        {toToken.logoURI && (
                          <Image 
                            src={toToken.logoURI} 
                            alt={toToken.symbol}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="font-bold text-gray-900 dark:text-white">{toToken.symbol}</span>
                        {toChain && (
                          <div className={cn("w-2 h-2 rounded-full", toChain.color)} />
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Select token</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* USD Value */}
                {toToken?.priceUSD && activeQuote?.toAmount && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    ≈ {formatCurrency(activeQuote.toAmount * toToken.priceUSD)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quote Summary */}
          {activeQuote && isValidRequest && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-3">
              {/* Quick Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Rate</span>
                    <p className="font-medium text-gray-900 dark:text-white">{exchangeRate}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Impact</span>
                    <p className={cn("font-medium", priceImpactColor || 'text-gray-900 dark:text-white')}>
                      {activeQuote.priceImpact.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Fee</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(activeQuote.gasEstimate.gasFeeUSD)}
                    </p>
                  </div>
                </div>

                {/* Quote Options Button - TODO: Implement multiple quotes from aggregator */}
                {false && (
                  <button
                    onClick={() => setShowQuoteComparison(!showQuoteComparison)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 
                             hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    Multiple routes
                    <ChevronDown className={cn("w-4 h-4 transition-transform", showQuoteComparison && "rotate-180")} />
                  </button>
                )}
              </div>

              {/* Provider Info */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>via</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{activeQuote.provider}</span>
                  {timeUntilExpiry > 0 && (
                    <>
                      <span>•</span>
                      <span className={cn(
                        "font-medium",
                        timeUntilExpiry < 30000 ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                      )}>
                        {formatTimeUntilExpiry(timeUntilExpiry)}
                      </span>
                    </>
                  )}
                </div>
                {isCrossChain && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">~2-5 minutes</span>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                           rounded-2xl text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                {error instanceof Error ? error.message : 'Failed to get quote'}
              </span>
            </div>
          )}

          {/* Swap Button */}
          <SwapButton
            fromToken={fromToken}
            toToken={toToken}
            fromAmount={amount}
            quote={activeQuote || null}
            disabled={!fromToken || !toToken || !amount || amount === '0' || isLoading}
            priceImpactTooHigh={activeQuote?.priceImpact ? activeQuote.priceImpact > 15 : false}
          />
        </div>
      </div>

      {/* Quote Comparison - TODO: Implement with real quote data */}
      {false && (
        <QuoteComparison
          quotes={[]}
          selectedQuote={selectedQuote}
          onSelectQuote={handleSelectQuote}
          fromToken={fromToken}
          toToken={toToken}
          isLoading={isLoading}
          error={error}
        />
      )}

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={(token: Token) => setFromToken(token)}
        currentToken={fromToken}
        title="Select token to swap from"
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={(token: Token) => setToToken(token)}
        currentToken={toToken}
        title="Select token to swap to"
      />

      {/* Settings Modal */}
      <SwapSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        slippage={slippage || 0}
        onSlippageChange={setSlippage}
      />
    </div>
  )
} 