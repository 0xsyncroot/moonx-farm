'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

// Hooks
import { useQuote } from '@/hooks/use-quote'
import { useAuth } from '@/hooks/use-auth'
import { useTokens, Token } from '@/hooks/use-tokens'
import { useTokenBalance, hasSufficientBalance } from '@/hooks/use-token-balance'
import { useUrlSync } from '@/hooks/use-url-sync'
import { useQuoteCountdown } from '@/hooks/use-quote-countdown'
import { useChainInfo } from '@/hooks/use-chain-info'
import { useShare } from '@/hooks/use-share'

// Components
import { SwapHeader } from './swap-header'
import { CrossChainIndicator } from './cross-chain-indicator'
import { TokenInput } from './token-input'
import { SwapArrow } from './swap-arrow'
import { QuoteDisplay } from './quote-display'
import { TokenSelector } from './token-selector'
import { SwapButton } from './swap-button'
import { SwapSettings } from './swap-settings'
import { QuoteComparison } from './quote-comparison'

import { cn, formatTokenAmount } from '@/lib/utils'

/**
 * SwapInterface Component - Refactored Version
 * 
 * Clean architecture with separated concerns:
 * - URL state management via useUrlSync hook
 * - Quote countdown logic via useQuoteCountdown hook  
 * - Chain info calculations via useChainInfo hook
 * - Share functionality via useShare hook
 * - UI components split into smaller, focused components
 */
export function SwapInterface() {
  const { client: smartWalletClient } = useSmartWallets()
  const { walletInfo } = useAuth()
  const searchParams = useSearchParams()
  
  // UI State
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuoteComparison, setShowQuoteComparison] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Track if component has been initialized from URL
  const isInitializedRef = useRef(false)
  const { getTokenBySymbol, searchToken } = useTokens()

  // Main quote hook
  const {
    fromToken,
    toToken,
    amount,
    slippage,
    quote,
    allQuotes,
    quoteResponse,
    isLoading,
    error,
    isValidRequest,
    exchangeRate,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    swapTokens,
    refetch,
  } = useQuote()

  // URL synchronization
  const { markInitialized } = useUrlSync({
    fromToken,
    toToken,
    amount,
    slippage: slippage || 0.5
  })

  // Memoize auto-refresh function to prevent infinite loops
  const handleAutoRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Quote countdown management
  const {
    realtimeCountdown,
    isCountdownPaused,
    isSwapInProgress,
    isAutoRefreshing,
    pauseCountdown,
    resumeCountdown
  } = useQuoteCountdown({
    quote,
    onAutoRefresh: handleAutoRefresh,
    isLoading
  })

  // Chain information
  const chainInfo = useChainInfo(fromToken, toToken)

  // Share functionality
  const { shareStatus, handleShare } = useShare({
    fromToken,
    toToken,
    amount,
    slippage: slippage || 0.5
  })

  // Token balances
  const fromTokenBalance = useTokenBalance(fromToken)
  const toTokenBalance = useTokenBalance(toToken)

  // Check if balance is sufficient
  const hasInsufficientBalance = fromToken && amount && fromTokenBalance.balance ? 
    !hasSufficientBalance(fromTokenBalance.balance, amount, fromToken.decimals) : false

  // Default chain ID for token loading
  const defaultChainId = useMemo(() => {
    const fromChainId = searchParams.get('fromChain')
    const toChainId = searchParams.get('toChain')
    
    if (fromChainId) return parseInt(fromChainId, 10)
    if (toChainId) return parseInt(toChainId, 10)
    return 8453 // Base as default
  }, [searchParams, smartWalletClient?.chain?.id, walletInfo?.chainId])

  // Enhanced token lookup function
  const findTokenByParam = useCallback(async (param: string, chainId: number): Promise<Token | null> => {
    if (param.startsWith('0x')) {
      try {
        const apiToken = await searchToken(param, chainId)
        if (apiToken) return apiToken
      } catch (error) {
        console.warn('Failed to find token by address:', param, error)
      }
    }
    
    if (getTokenBySymbol) {
      const symbolToken = getTokenBySymbol(param)
      if (symbolToken && symbolToken.chainId === chainId) {
        return symbolToken
      }
    }
    
    try {
      return await searchToken(param, chainId)
    } catch (error) {
      console.warn('Failed to find token by symbol:', param, error)
      return null
    }
  }, [getTokenBySymbol, searchToken])

  // Initialize basic state from URL parameters on mount
  useEffect(() => {
    const amountParam = searchParams.get('amount')
    const slippageParam = searchParams.get('slippage')

    if (amountParam && !amount) {
      setAmount(amountParam)
    }
    
    if (slippageParam && !slippage) {
      setSlippage(parseFloat(slippageParam))
    }
  }, [searchParams, amount, slippage, setAmount, setSlippage])

  // Load tokens from URL ONLY on mount to prevent loops
  const lastSearchParamsRef = useRef<string>('')
  
  useEffect(() => {
    const currentSearchParams = searchParams.toString()
    if (isInitializedRef.current && currentSearchParams === lastSearchParamsRef.current) {
      return
    }
    lastSearchParamsRef.current = currentSearchParams

    const fromTokenParam = searchParams.get('from')
    const toTokenParam = searchParams.get('to') 
    const fromChainId = searchParams.get('fromChain')
    const toChainId = searchParams.get('toChain')
    
    const loadTokensFromURL = async () => {
      try {
        // Load from token
        if (fromTokenParam && (!fromToken || fromToken.address !== fromTokenParam)) {
          const chainId = fromChainId ? parseInt(fromChainId) : defaultChainId
          const foundToken = await findTokenByParam(fromTokenParam, chainId)
          if (foundToken) {
            setFromToken(foundToken)
          }
        }

        // Load to token
        if (toTokenParam && (!toToken || toToken.address !== toTokenParam)) {
          const chainId = toChainId ? parseInt(toChainId) : defaultChainId
          const foundToken = await findTokenByParam(toTokenParam, chainId)
          if (foundToken) {
            setToToken(foundToken)
          }
        }

        // Mark as initialized after first attempt
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
          markInitialized()
        }
      } catch (error) {
        console.error('Failed to load tokens from URL:', error)
      }
    }

    if (defaultChainId) {
      loadTokensFromURL()
    }
  }, [searchParams.toString(), defaultChainId])

  // Determine active quote - priority: manual selection > best quote > first quote
  const activeQuote = useMemo(() => {
    if (selectedQuote) return selectedQuote
    if (quote) return quote
    if (allQuotes && allQuotes.length > 0) return allQuotes[0]
    return null
  }, [selectedQuote, quote, allQuotes, quoteResponse?.timestamp])

  // Clear manually selected quote when new quotes arrive
  useEffect(() => {
    if (quoteResponse?.timestamp && selectedQuote) {
      setSelectedQuote(null)
    }
  }, [quoteResponse?.timestamp])

  // Calculate minimum received after slippage
  const minReceived = useMemo(() => {
    if (!activeQuote || !toToken) return 0
    
    try {
      // Use toAmountMin from API if available
      if (activeQuote.toAmountMin && activeQuote.toAmountMin !== '0') {
        const formatted = formatTokenAmount(activeQuote.toAmountMin, toToken.decimals)
        const parsed = parseFloat(formatted)
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          return parsed
        }
      }
      
      // Calculate from toAmount with slippage
      if (activeQuote.toAmount) {
        const formatted = formatTokenAmount(activeQuote.toAmount, toToken.decimals)
        const parsed = parseFloat(formatted)
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          const slippageDecimal = (slippage || 0.5) / 100
          const minAmount = parsed * (1 - slippageDecimal)
          return Math.max(0, minAmount)
        }
      }
      
      return 0
    } catch (error) {
      console.warn('Failed to calculate minReceived:', error)
      return 0
    }
  }, [activeQuote?.toAmountMin, activeQuote?.toAmount, activeQuote?.id, toToken, slippage])

  // Throttled refresh to prevent API spam  
  const lastRefreshRef = useRef(0)
  const handleRefresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 2000) return // 2 second throttle
    lastRefreshRef.current = now
    
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [refetch])

  // Token selection handlers
  const handleFromTokenSelect = useCallback((token: Token) => {
    setShowFromTokenSelector(false)
    setFromToken(token)
  }, [setFromToken])

  const handleToTokenSelect = useCallback((token: Token) => {
    setShowToTokenSelector(false)
    setToToken(token)
  }, [setToToken])

  const handleSelectQuote = useCallback((quote: any) => {
    setSelectedQuote(quote)
  }, [])

  // Helper function to format quote amounts for display
  const formatQuoteAmount = useCallback((amount: string | undefined, token: Token | null) => {
    if (!amount || !token) return ''
    
    try {
      const formatted = formatTokenAmount(amount, token.decimals)
      const parsed = parseFloat(formatted)
      
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return ''
      if (parsed === 0) return '0'
      if (parsed < 0.000001) return formatted
      
      return parsed.toString()
    } catch (error) {
      console.warn('Failed to format quote amount:', error)
      return ''
    }
  }, [])

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Swap Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        
        {/* Header */}
        <SwapHeader
          isCrossChain={!!chainInfo.isCrossChain}
          onSettingsClick={() => setShowSettings(true)}
          shareStatus={shareStatus}
          onShareClick={handleShare}
          hasTokens={!!(fromToken || toToken)}
        />

        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Cross-Chain Bridge Indicator */}
          {chainInfo.isCrossChain && (
            <CrossChainIndicator
              fromChain={chainInfo.fromChain}
              toChain={chainInfo.toChain}
            />
          )}

          {/* From Token Input */}
          <TokenInput
            type="from"
            token={fromToken}
            amount={amount}
            onAmountChange={setAmount}
            onTokenClick={() => setShowFromTokenSelector(true)}
            balance={fromTokenBalance}
            hasInsufficientBalance={hasInsufficientBalance}
            chainInfo={chainInfo.fromChain || undefined}
          />

          {/* Swap Arrow */}
          <SwapArrow
            onSwap={swapTokens}
            disabled={!fromToken || !toToken}
          />

          {/* To Token Input */}
          <TokenInput
            type="to"
            token={toToken}
            amount=""
            onTokenClick={() => setShowToTokenSelector(true)}
            balance={toTokenBalance}
            displayValue={formatQuoteAmount(activeQuote?.toAmount, toToken)}
            readOnly={true}
            chainInfo={chainInfo.toChain || undefined}
          />

          {/* Quote Display */}
          {activeQuote && isValidRequest && (
            <QuoteDisplay
              quote={activeQuote}
              fromToken={fromToken}
              toToken={toToken}
              slippage={slippage || 0.5}
              exchangeRate={exchangeRate || ''}
              minReceived={minReceived}
              isCrossChain={!!chainInfo.isCrossChain}
              fromChain={chainInfo.fromChain}
              toChain={chainInfo.toChain}
              realtimeCountdown={realtimeCountdown}
              isCountdownPaused={isCountdownPaused}
              isSwapInProgress={isSwapInProgress}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              isAutoRefreshing={isAutoRefreshing}
              allQuotes={allQuotes || []}
              onRefresh={handleRefresh}
              onCompareQuotes={() => setShowQuoteComparison(true)}
            />
          )}

          {/* Loading Skeleton when no active quote */}
          {(isLoading || isAutoRefreshing) && !activeQuote && isValidRequest && !error && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
              <div className="p-3">
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
                </div>
                
                {/* Loading text with icon */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm">
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 bg-white/95 dark:bg-gray-800/95 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">Finding best quote...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                           rounded-2xl text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
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
            disabled={!fromToken || !toToken || !amount || amount === '0' || isLoading || hasInsufficientBalance}
            priceImpactTooHigh={activeQuote?.priceImpact ? Math.abs(parseFloat(activeQuote.priceImpact)) > 15 : false}
            hasInsufficientBalance={hasInsufficientBalance}
            onPauseCountdown={pauseCountdown}
            onResumeCountdown={resumeCountdown}
          />
        </div>
      </div>

      {/* Quote Comparison Modal */}
      {showQuoteComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl">
            <div className="p-6">
              <QuoteComparison
                quotes={allQuotes || []}
                selectedQuote={selectedQuote}
                onSelectQuote={handleSelectQuote}
                fromToken={fromToken}
                toToken={toToken}
                isLoading={isLoading}
                error={error}
                onClose={() => setShowQuoteComparison(false)}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowQuoteComparison(false)}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={handleFromTokenSelect}
        currentToken={fromToken}
        title="You pay"
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        currentToken={toToken}
        title="You receive"
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