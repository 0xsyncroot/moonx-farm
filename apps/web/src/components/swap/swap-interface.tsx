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
import { useAutoChainSwitch } from '@/hooks/use-auto-chain-switch'

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
import { getChainConfig } from '@/config/chains'

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

  // Main quote hook - initially without auto chain switch
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

  // Auto chain switch when fromToken changes
  const {
    isLoading: isChainSwitching,
    isSuccess: chainSwitchSuccess,
    error: chainSwitchError,
    smartWalletClient,
    switchToChain,
    currentChain
  } = useAutoChainSwitch(fromToken)

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

  // Token balances with auto-switched smart wallet client
  const fromTokenBalance = useTokenBalance(fromToken, smartWalletClient)
  const toTokenBalance = useTokenBalance(toToken, smartWalletClient)

  // ✅ Check if balance is sufficient - ONLY after URL params are fully loaded
  // Tránh false positive khi amount chưa được load từ URL
  const hasInsufficientBalance = useMemo(() => {
    // Only check balance if we have all required data AND component is initialized
    if (!fromToken || !amount || !fromTokenBalance.balance || !isInitializedRef.current) {
      return false
    }
    
    // Parse amount safely
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return false
    }
    
    const isInsufficient = !hasSufficientBalance(fromTokenBalance.balance, amount, fromToken.decimals)
    
    if (process.env.NODE_ENV === 'development' && isInsufficient) {
      console.log('⚠️ Insufficient balance detected:', {
        token: fromToken.symbol,
        requestedAmount: amount,
        availableBalance: fromTokenBalance.balanceFormatted,
        isInitialized: isInitializedRef.current
      })
    }
    
    return isInsufficient
  }, [fromToken, amount, fromTokenBalance.balance, fromTokenBalance.balanceFormatted])

  // Default chain ID for token loading
  const defaultChainId = useMemo(() => {
    const fromChainId = searchParams.get('fromChain')
    const toChainId = searchParams.get('toChain')
    
    if (fromChainId) return parseInt(fromChainId, 10)
    if (toChainId) return parseInt(toChainId, 10)
    
    // Use current chain from auto chain switch hook
    if (currentChain?.id) return currentChain.id
    
    return 8453 // Base as default
  }, [searchParams, currentChain?.id, walletInfo?.chainId])

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

  // ✅ Single useEffect để load ALL URL parameters synchronously
  // Tránh race condition giữa amount và tokens
  const lastSearchParamsRef = useRef<string>('')
  
  useEffect(() => {
    const currentSearchParams = searchParams.toString()
    if (isInitializedRef.current && currentSearchParams === lastSearchParamsRef.current) {
      return
    }
    lastSearchParamsRef.current = currentSearchParams

    const loadFromURL = async () => {
      try {
        // 1. Load basic params first (amount, slippage)
        const amountParam = searchParams.get('amount')
        const slippageParam = searchParams.get('slippage')
        
        if (amountParam && !amount) {
          setAmount(amountParam)
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Loading amount from URL:', amountParam)
          }
        }
        
        if (slippageParam && !slippage) {
          setSlippage(parseFloat(slippageParam))
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Loading slippage from URL:', slippageParam)
          }
        }

        // 2. Load tokens after amount is set
        const fromTokenParam = searchParams.get('from')
        const toTokenParam = searchParams.get('to') 
        const fromChainId = searchParams.get('fromChain')
        const toChainId = searchParams.get('toChain')
        
        // Load from token
        if (fromTokenParam && (!fromToken || fromToken.address !== fromTokenParam)) {
          const chainId = fromChainId ? parseInt(fromChainId) : defaultChainId
          const foundToken = await findTokenByParam(fromTokenParam, chainId)
          if (foundToken) {
            setFromToken(foundToken)
            if (process.env.NODE_ENV === 'development') {
              console.log('🔗 Loading fromToken from URL:', foundToken.symbol, 'on', foundToken.chainId)
            }
          }
        }

        // Load to token
        if (toTokenParam && (!toToken || toToken.address !== toTokenParam)) {
          const chainId = toChainId ? parseInt(toChainId) : defaultChainId
          const foundToken = await findTokenByParam(toTokenParam, chainId)
          if (foundToken) {
            setToToken(foundToken)
            if (process.env.NODE_ENV === 'development') {
              console.log('🔗 Loading toToken from URL:', foundToken.symbol, 'on', foundToken.chainId)
            }
          }
        }

        // 3. Mark as initialized after all attempts
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
          markInitialized()
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ URL params loading completed and marked as initialized')
          }
        }
      } catch (error) {
        console.error('Failed to load params from URL:', error)
      }
    }

    if (defaultChainId) {
      loadFromURL()
    }
  }, [
    searchParams.toString(), 
    defaultChainId,
    amount, // Include để prevent re-set nếu đã có
    slippage, // Include để prevent re-set nếu đã có
    fromToken?.address, // Include để prevent re-load nếu đã đúng token
    toToken?.address, // Include để prevent re-load nếu đã đúng token
    setAmount,
    setSlippage,
    setFromToken,
    setToToken,
    findTokenByParam,
    markInitialized
  ])

  // Determine active quote - priority: manual selection > best quote > first quote
  const activeQuote = useMemo(() => {
    let active = null
    
    if (selectedQuote) {
      console.log('🎯 Using manually selected quote:', selectedQuote.id, selectedQuote.provider)
      active = selectedQuote
    } else if (quote) {
      console.log('🏆 Using best quote from API:', quote.id, quote.provider)
      active = quote
    } else if (allQuotes && allQuotes.length > 0) {
      console.log('📝 Using first available quote:', allQuotes[0].id, allQuotes[0].provider)
      active = allQuotes[0]
    }
    
    if (active) {
      // Validate quote has required fields for contract execution
      const isValid = !!(
        active.callData &&
        active.fromToken?.address &&
        active.toToken?.address &&
        active.fromAmount &&
        active.toAmount &&
        active.provider
      )
      
      if (!isValid) {
        console.error('❌ Active quote missing required fields:', {
          id: active.id,
          provider: active.provider,
          hasCallData: !!active.callData,
          hasFromToken: !!active.fromToken?.address,
          hasToToken: !!active.toToken?.address,
          hasFromAmount: !!active.fromAmount,
          hasToAmount: !!active.toAmount
        })
      }
    }
    
    return active
  }, [selectedQuote, quote, allQuotes, quoteResponse?.timestamp])

  // Clear manually selected quote when new quotes arrive
  // BUT preserve selection if user explicitly chose it recently
  const lastUserSelectTimeRef = useRef(0)
  
  useEffect(() => {
    if (quoteResponse?.timestamp && selectedQuote) {
      // Only clear if it's been more than 10 seconds since user selection
      // This prevents clearing when user just selected a quote
      const timeSinceSelection = Date.now() - lastUserSelectTimeRef.current
      if (timeSinceSelection > 10000) {
        console.log('⏰ Clearing manually selected quote after 10 seconds')
        setSelectedQuote(null)
      } else {
        console.log('📌 Preserving manually selected quote (selected', (timeSinceSelection / 1000).toFixed(1), 'seconds ago)')
      }
    }
  }, [quoteResponse?.timestamp, selectedQuote])

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
    console.log('📌 User manually selected quote:', {
      id: quote.id,
      provider: quote.provider,
      toAmount: quote.toAmount,
      hasCallData: !!quote.callData,
      hasValue: !!quote.value,
      hasFromToken: !!quote.fromToken?.address,
      hasToToken: !!quote.toToken?.address
    })
    
    // Additional validation before setting selected quote
    const isValidQuote = !!(
      quote.id &&
      quote.provider &&
      quote.callData &&
      quote.fromToken?.address &&
      quote.toToken?.address &&
      quote.fromAmount &&
      quote.toAmount
    )
    
    if (!isValidQuote) {
      console.error('❌ Attempted to select invalid quote, falling back to best quote')
      // Don't set selectedQuote, let it fallback to best quote
      return
    }
    
    lastUserSelectTimeRef.current = Date.now()
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
          {/* Chain Switch Indicator */}
          {isChainSwitching && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 
                           rounded-2xl text-blue-700 dark:text-blue-400">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Switching network...</div>
                <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  Preparing smart wallet for {fromToken ? getChainConfig(fromToken.chainId)?.name : 'target chain'}
                </div>
              </div>
            </div>
          )}

          {/* Chain Switch Success */}
          {chainSwitchSuccess && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 
                           rounded-2xl text-green-700 dark:text-green-400">
              <div className="w-5 h-5 text-green-600 flex-shrink-0">✓</div>
              <div>
                <div className="text-sm font-medium">Network switched successfully</div>
                <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                  Ready for cross-chain swap on {currentChain?.name}
                </div>
              </div>
            </div>
          )}

          {/* Chain Switch Error */}
          {chainSwitchError && (
            <div className="flex items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                           rounded-2xl text-red-700 dark:text-red-400">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-red-600 flex-shrink-0">⚠</div>
                <div>
                  <div className="text-sm font-medium">Failed to switch network</div>
                  <div className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {chainSwitchError}
                  </div>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

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
            disabled={!fromToken || !toToken || !amount || amount === '0' || isLoading || hasInsufficientBalance || isChainSwitching}
            priceImpactTooHigh={activeQuote?.priceImpact ? Math.abs(parseFloat(activeQuote.priceImpact)) > 15 : false}
            hasInsufficientBalance={hasInsufficientBalance}
            onPauseCountdown={pauseCountdown}
            onResumeCountdown={resumeCountdown}
            smartWalletClient={smartWalletClient}
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