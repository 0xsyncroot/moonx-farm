'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, RefreshCw, AlertTriangle, Settings, Zap, ExternalLink, ChevronDown, Share2, Copy, Check, TrendingUp, Shield, Clock, Sparkles, X, Globe, BarChart3, ArrowRight, Info, Target, Layers, DollarSign, Network, Loader2 } from 'lucide-react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import Image from 'next/image'
import { TokenSelector } from './token-selector'
import { SwapButton } from './swap-button'
import { SwapSettings } from './swap-settings'
import { QuoteComparison } from './quote-comparison'
import { formatCurrency, formatNumber, formatTokenAmount, cn } from '@/lib/utils'
import { useQuote } from '@/hooks/use-quote'
import { useAuth } from '@/hooks/use-auth'
import { useTokens, Token } from '@/hooks/use-tokens'
import { useTokenBalance, formatTokenBalance, hasSufficientBalance } from '@/hooks/use-token-balance'
import { NumericFormat } from 'react-number-format'
import { getChainConfig } from '@/config/chains'
import { ChainIcon } from '@/components/ui/chain-icon'

// Chain configurations for cross-chain support with extended colors
const CHAIN_DISPLAY_CONFIG = {
  1: { bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  8453: { bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  56: { bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
  84532: { bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
  97: { bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
}

/**
 * SwapInterface Component
 * 
 * Handles token swapping with URL state management.
 * 
 * URL State Management:
 * - Uses Next.js router.replace() instead of manual URL building
 * - Centralized URL parameter building logic
 * - Debounced updates to avoid excessive URL changes
 * - Automatic sync between component state and URL
 */
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

  const [shareStatus, setShareStatus] = useState<'idle' | 'copying' | 'copied'>('idle')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Real-time countdown state
  const [realtimeCountdown, setRealtimeCountdown] = useState(0)
  
  // Local refresh loading state
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Auto-refresh loading state
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  
  // Quote countdown control states
  const [isCountdownPaused, setIsCountdownPaused] = useState(false)
  const [isSwapInProgress, setIsSwapInProgress] = useState(false)
  
  // Track if component has been initialized from URL
  const isInitializedRef = useRef(false)

  // Use tokens hook for token lookup
  const { getTokenBySymbol, searchToken } = useTokens()

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

  // Get token balances
  const fromTokenBalance = useTokenBalance(fromToken)
  const toTokenBalance = useTokenBalance(toToken)

  // Check if balance is sufficient
  const hasInsufficientBalance = fromToken && amount && fromTokenBalance.balance ? 
    !hasSufficientBalance(fromTokenBalance.balance, amount, fromToken.decimals) : false

  // URL update function - optimized for speed
  const updateURL = useCallback((params: Record<string, string | null>) => {
    // Build query string directly without URLSearchParams overhead
    const queryParts: string[] = []
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    })
    
    const queryString = queryParts.join('&')
    const newUrl = queryString ? `/swap?${queryString}` : '/swap'
    
    // Skip update if URL hasn't changed
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl === newUrl) return
    
    router.replace(newUrl, { scroll: false })
  }, [router])



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

  // ❌ SIMPLE URL update with conditions to prevent loops
  const lastURLUpdateRef = useRef<string>('')
  
  useEffect(() => {
    if (!isInitializedRef.current) return // Skip during initialization

    const params: Record<string, string | null> = {}
    
    if (fromToken) {
      params.from = fromToken.address
      params.fromChain = fromToken.chainId.toString()
    }
    
    if (toToken) {
      params.to = toToken.address
      params.toChain = toToken.chainId.toString()
    }
    
    if (amount && amount !== '0') {
      params.amount = amount
      params.exactField = 'input'
    }
    
    if (slippage && slippage !== 0.5) {
      params.slippage = slippage.toString()
    }
    
    // Create URL string for comparison
    const urlString = Object.entries(params)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    
    // Only update if URL actually changed
    if (urlString !== lastURLUpdateRef.current) {
      lastURLUpdateRef.current = urlString
      
      // Debounce the actual update
      const timeoutId = setTimeout(() => {
        updateURL(params)
      }, 800)
      
      return () => clearTimeout(timeoutId)
    }
  }, [fromToken?.address, toToken?.address, amount, slippage, updateURL])

  // ✨ DEX-style countdown with PAUSE/RESUME control
  const hasRefetchedRef = useRef(false)
  const pausedTimeRef = useRef(0) // Track how long paused
  const pauseStartTimeRef = useRef(0)
  
      useEffect(() => {
      if (!quote) {
        setRealtimeCountdown(0)
        hasRefetchedRef.current = false
        pausedTimeRef.current = 0
        pauseStartTimeRef.current = 0
        return
      }
      
      // Reset pause tracking for new quote
      pausedTimeRef.current = 0
      pauseStartTimeRef.current = 0

    // Initial calculation
    const calculateCountdown = () => {
      const expiry = new Date(quote.expiresAt).getTime()
      const now = Date.now()
      // Subtract paused time to extend quote life
      return Math.max(0, expiry - now + pausedTimeRef.current)
    }

    // Set initial value
    setRealtimeCountdown(calculateCountdown())
    hasRefetchedRef.current = false

    // Update every 200ms for smooth animation (compromise between smooth and performance)
    const interval = setInterval(() => {
      // PAUSE logic: Don't update countdown when swap is in progress
      if (isCountdownPaused || isSwapInProgress) {
        // Track pause duration to extend quote life
        if (pauseStartTimeRef.current === 0) {
          pauseStartTimeRef.current = Date.now()
        }
        return
      }

      // Resume: Add paused time to extend quote
      if (pauseStartTimeRef.current > 0) {
        const pauseDuration = Date.now() - pauseStartTimeRef.current
        pausedTimeRef.current += pauseDuration
        pauseStartTimeRef.current = 0
      }

      const remaining = calculateCountdown()
      setRealtimeCountdown(remaining)
      
      // Auto-refresh quote when it expires - ONLY ONCE
      if (remaining <= 0 && !hasRefetchedRef.current) {
        hasRefetchedRef.current = true
        setIsAutoRefreshing(true)
        refetch().finally(() => {
          // Reset auto-refresh state after a delay to show the skeleton
          setTimeout(() => {
            setIsAutoRefreshing(false)
          }, 800)
        })
      }
    }, 200) // Smoother animation

    return () => clearInterval(interval)
  }, [quote?.expiresAt, quote?.id, isCountdownPaused, isSwapInProgress])

  // Reset state when component unmounts or path changes
  useEffect(() => {
    return () => {
      isInitializedRef.current = false
    }
  }, [])

  // FIXED: Ensure we always use the best quote available with proper dependencies
  const activeQuote = useMemo(() => {
    // If user manually selected a quote, use that
    if (selectedQuote) {
      return selectedQuote
    }
    
    // Otherwise use the best quote from useQuote (already sorted)
    if (quote) {
      return quote
    }
    
    // Fallback: use first quote from allQuotes if available
    if (allQuotes && allQuotes.length > 0) {
      return allQuotes[0]
    }
    
    return null
  }, [selectedQuote, quote, allQuotes, quoteResponse?.timestamp])


  // ✅ CLEAR manually selected quote when new quotes arrive
  useEffect(() => {
    if (quoteResponse?.timestamp && selectedQuote) {
      setSelectedQuote(null)
    }
  }, [quoteResponse?.timestamp]) // Only depend on timestamp to detect new responses

  // ✅ RESET auto-refresh state when new quote arrives
  useEffect(() => {
    if (quote && isAutoRefreshing) {
      setIsAutoRefreshing(false)
    }
  }, [quote?.id, isAutoRefreshing]) // Reset when quote ID changes

  // Helper function to safely format quote amounts for display - FIXED for small numbers
  const formatQuoteAmount = useCallback((amount: string | undefined, token: Token | null) => {
    if (!amount || !token) return ''
    
    try {
      const formatted = formatTokenAmount(amount, token.decimals)
      const parsed = parseFloat(formatted)
      
      // Return empty string if parsing failed or result is invalid
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return ''
      
      // ✅ FIXED: Handle very small numbers properly without scientific notation
      if (parsed === 0) return '0'
      
      // For very small numbers, use fixed notation with appropriate decimal places
      if (parsed < 0.000001) {
        // Use the original formatted string to preserve precision
        return formatted
      }
      
      // For normal numbers, use standard conversion
      return parsed.toString()
    } catch (error) {
      console.warn('Failed to format quote amount:', error, { amount, token: token?.symbol })
      return ''
    }
  }, [])

  // Memoize expensive calculations
  const chainInfo = useMemo(() => {
    const fromChainConfig = fromToken ? getChainConfig(fromToken.chainId) : null
    const toChainConfig = toToken ? getChainConfig(toToken.chainId) : null
    const fromChainDisplay = fromToken ? CHAIN_DISPLAY_CONFIG[fromToken.chainId as keyof typeof CHAIN_DISPLAY_CONFIG] : null
    const toChainDisplay = toToken ? CHAIN_DISPLAY_CONFIG[toToken.chainId as keyof typeof CHAIN_DISPLAY_CONFIG] : null
    
    return {
      isCrossChain: fromToken && toToken && fromToken.chainId !== toToken.chainId,
      fromChain: fromChainConfig && fromChainDisplay ? { ...fromChainConfig, ...fromChainDisplay } : null,
      toChain: toChainConfig && toChainDisplay ? { ...toChainConfig, ...toChainDisplay } : null,
    }
  }, [fromToken, toToken])

  // Calculate minimum received after slippage - FIXED with backend consistency
  const minReceived = useMemo(() => {
    if (!activeQuote || !toToken) return 0
    
    try {
      // Priority 1: Use toAmountMin from API if available and valid
      if (activeQuote.toAmountMin && activeQuote.toAmountMin !== '0') {
        // Backend now returns consistent wei format
        const formatted = formatTokenAmount(activeQuote.toAmountMin, toToken.decimals)
        const parsed = parseFloat(formatted)
        
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          return parsed
        }
      }
      
      // Priority 2: Calculate from toAmount with slippage
      if (activeQuote.toAmount) {
        // Backend returns wei format, format to human readable
        const formatted = formatTokenAmount(activeQuote.toAmount, toToken.decimals)
        const parsed = parseFloat(formatted)
        
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          // Apply slippage tolerance (convert percentage to decimal)
          const slippageDecimal = (slippage || 0.5) / 100
          const minAmount = parsed * (1 - slippageDecimal)
          
          return Math.max(0, minAmount) // Ensure non-negative
        }
      }
      
      return 0
    } catch (error) {
      console.warn('Failed to calculate minReceived:', error, {
        activeQuote: activeQuote?.id,
        toAmountMin: activeQuote?.toAmountMin,
        toAmount: activeQuote?.toAmount,
        tokenSymbol: toToken?.symbol,
        slippage
      })
      return 0
    }
  }, [activeQuote?.toAmountMin, activeQuote?.toAmount, activeQuote?.id, toToken, slippage])



  // ✨ DEX-style countdown control functions
  const pauseCountdown = useCallback((reason: 'swap' | 'approval' = 'swap') => {
    setIsCountdownPaused(true)
    if (reason === 'swap') {
      setIsSwapInProgress(true)
    }
  }, [])
  
  const resumeCountdown = useCallback((reason: 'cancelled' | 'completed' | 'error' = 'completed') => {
    setIsCountdownPaused(false)
    setIsSwapInProgress(false)
    
    // Reset refs when resuming
    pauseStartTimeRef.current = 0
  }, [])

  // ❌ THROTTLED refresh to prevent API spam  
  const lastRefreshRef = useRef(0)
  
  const handleRefresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 2000) { // 2 second throttle
      return
    }
    lastRefreshRef.current = now
    
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      // Reset refresh state after a short delay to show the skeleton
      setTimeout(() => {
        setIsRefreshing(false)
      }, 500)
    }
  }, [refetch])

  const handleSelectQuote = useCallback((quote: any) => {
    setSelectedQuote(quote)
    // Don't close modal here - let the component handle it
  }, [])

  // Default chain ID
  const defaultChainId = useMemo(() => {
    const chainId = walletInfo?.chainId
    if (typeof chainId === 'number') return chainId
    if (typeof chainId === 'string') return parseInt(chainId, 10)
    return 8453
  }, [walletInfo?.chainId])

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

  // Token selection handlers - instant update without any delays
  const handleFromTokenSelect = useCallback((token: Token) => {
    // Close modal first for instant UI feedback
    setShowFromTokenSelector(false)
    
    // Set token immediately - no async needed
    setFromToken(token)
    
    // URL will be updated automatically by the useEffect above
    // No isTokenSelecting state needed for instant response
  }, [setFromToken])

  const handleToTokenSelect = useCallback((token: Token) => {
    // Close modal first for instant UI feedback  
    setShowToTokenSelector(false)
    
    // Set token immediately - no async needed
    setToToken(token)
    
    // URL will be updated automatically by the useEffect above
    // No isTokenSelecting state needed for instant response
  }, [setToToken])

  // Share functionality - simplified
  const handleShare = useCallback(async () => {
    if (shareStatus === 'copying') return
    
    setShareStatus('copying')
    
    try {
      // Build URL params inline
      const urlParams: Record<string, string | null> = {}
      
      if (fromToken) {
        urlParams.from = fromToken.address
        urlParams.fromChain = fromToken.chainId.toString()
      }
      
      if (toToken) {
        urlParams.to = toToken.address
        urlParams.toChain = toToken.chainId.toString()
      }
      
      if (amount && amount !== '0') {
        urlParams.amount = amount
        urlParams.exactField = 'input'
      }
      
      if (slippage && slippage !== 0.5) {
        urlParams.slippage = slippage.toString()
      }
      
      const params = new URLSearchParams()
      Object.entries(urlParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.set(key, value)
        }
      })
      
      // Use window.location for share URL (this is acceptable for sharing)
      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
      
      await navigator.clipboard.writeText(shareUrl)
      setShareStatus('copied')
      
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy swap link:', error)
      setShareStatus('idle')
    }
  }, [fromToken, toToken, amount, slippage, shareStatus])

  // ❌ OPTIMIZED: Load tokens from URL ONLY on mount to prevent loops
  const lastSearchParamsRef = useRef<string>('')
  
  useEffect(() => {
    // Only run on mount or when searchParams actually change
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
        // Load from token if URL has it but component doesn't
        if (fromTokenParam && (!fromToken || fromToken.address !== fromTokenParam)) {
          const chainId = fromChainId ? parseInt(fromChainId) : defaultChainId
          try {
            const foundToken = await findTokenByParam(fromTokenParam, chainId)
            if (foundToken) {
              setFromToken(foundToken)
            }
          } catch (error) {
            console.warn('Failed to load from token from URL:', error)
          }
        }

        // Load to token if URL has it but component doesn't
        if (toTokenParam && (!toToken || toToken.address !== toTokenParam)) {
          const chainId = toChainId ? parseInt(toChainId) : defaultChainId
          try {
            const foundToken = await findTokenByParam(toTokenParam, chainId)
            if (foundToken) {
              setToToken(foundToken)
            }
          } catch (error) {
            console.warn('Failed to load to token from URL:', error)
          }
        }

        // Mark as initialized after first attempt
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
        }
      } catch (error) {
        console.error('Failed to load tokens from URL:', error)
      }
    }

    // Only load if we have a default chain ID
    if (defaultChainId) {
      loadTokensFromURL()
    }
      }, [
      searchParams.toString(), // Only depend on search params string
      defaultChainId, // Safe dependency
      // ❌ REMOVED: findTokenByParam, setFromToken, setToToken to prevent loops
      // These are accessed directly within the effect
    ])

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Swap Card - Clean design */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-lg md:rounded-xl shadow-lg">
                <ArrowUpDown className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Swap</h2>
                {chainInfo.isCrossChain && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Cross-Chain</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
                      <div className="flex items-center gap-1.5 md:gap-2">
              <button
              onClick={() => setShowSettings(true)}
              className="p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all duration-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              onClick={handleShare}
              disabled={!fromToken && !toToken}
              className={cn(
                "p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all duration-200 border",
                shareStatus === 'copied' 
                  ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
                  : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title={shareStatus === 'copied' ? 'Link copied!' : 'Share swap'}
            >
              {shareStatus === 'copying' ? (
                <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
              ) : shareStatus === 'copied' ? (
                <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Cross-Chain Bridge Indicator */}
          {chainInfo.isCrossChain && chainInfo.fromChain && chainInfo.toChain && (
            <div className="flex items-center justify-center mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 dark:border-purple-700/50 rounded-full">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className={cn("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full", chainInfo.fromChain.color)} />
                  <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">{chainInfo.fromChain.name}</span>
                </div>
                <div className="flex items-center gap-1 px-1.5 md:px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded-full">
                  <ArrowUpDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
                  <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className={cn("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full", chainInfo.toChain.color)} />
                  <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">{chainInfo.toChain.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* From Token Input */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">You pay</span>
              {smartWalletClient?.account?.address && fromToken && (
                <button 
                  onClick={() => {
                    if (fromTokenBalance.error) {
                      // Retry loading balance if there was an error
                      fromTokenBalance.refetch()
                    } else if (fromTokenBalance.balanceFormatted) {
                      // Set max balance when clicked - USE FULL BALANCE
                      setAmount(fromTokenBalance.balanceNumber.toString())
                    }
                  }}
                  disabled={fromTokenBalance.isLoading}
                  className="text-xs md:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={fromTokenBalance.error ? "Click to retry" : "Click to use max balance"}
                >
                  {fromTokenBalance.isLoading ? (
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                      Loading...
                    </span>
                  ) : fromTokenBalance.error ? (
                    <span className="text-red-400">Error loading balance</span>
                  ) : (
                    <>
                      Balance: {fromTokenBalance.balanceFormatted ? 
                        formatTokenBalance(fromTokenBalance.balance, fromToken.decimals, 4) : 
                        '0'
                      } {fromToken.symbol}
                    </>
                  )}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className={cn(
                "relative bg-gradient-to-br from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl md:rounded-2xl transition-all duration-300",
                "border border-gray-200/50 dark:border-gray-700/50",
                "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/10",
                "focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10"
              )}>
                <div className="flex items-center p-3 md:p-4">
                  <div className="flex-1 min-w-0">
                    <NumericFormat
                      value={amount}
                      onValueChange={(values) => setAmount(values.value)}
                      placeholder="0.0"
                      thousandSeparator=","
                      decimalSeparator="."
                      allowNegative={false}
                      decimalScale={6}
                      className={cn(
                        "w-full font-bold bg-transparent border-0 outline-none",
                        "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                        "disabled:opacity-50 transition-all duration-200",
                        // Dynamic text size based on length
                        amount && amount.length > 12 ? "text-lg md:text-xl" :
                        amount && amount.length > 8 ? "text-xl md:text-2xl" :
                        "text-2xl md:text-3xl"
                      )}
                      style={{
                        fontSize: amount && amount.length > 15 ? '1rem' : undefined
                      }}
                    />
                    {fromToken?.priceUSD && amount && (
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        ≈ {formatCurrency(parseFloat(amount) * fromToken.priceUSD)}
                      </p>
                    )}
                    {hasInsufficientBalance && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Insufficient balance
                      </p>
                    )}
                  </div>
                  
                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowFromTokenSelector(true)}
                    disabled={false}
                    className={cn(
                      "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 ml-3 md:ml-4 transition-all duration-200",
                      "bg-white dark:bg-gray-700 rounded-lg md:rounded-xl shadow-sm border border-gray-200 dark:border-gray-600",
                      "hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:shadow-md",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    )}
                  >
                    {fromToken ? (
                      <>
                        <div className="relative">
                          {fromToken.logoURI && (
                            <Image 
                              src={fromToken.logoURI} 
                              alt={fromToken.symbol}
                              width={28}
                              height={28}
                              className="w-6 h-6 md:w-7 md:h-7 rounded-full shadow-sm"
                            />
                          )}
                          {chainInfo.fromChain && (
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white dark:border-gray-700",
                              chainInfo.fromChain.color
                            )} />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-gray-900 dark:text-white text-sm md:text-base">{fromToken.symbol}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{fromToken.name}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full" />
                        <div className="text-left">
                          <div className="font-medium text-gray-500 dark:text-gray-400 text-sm md:text-base">Select token</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">Choose token</div>
                        </div>
                      </>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center relative -my-1">
            <button 
              onClick={swapTokens}
              disabled={!fromToken || !toToken}
              className={cn(
                "p-2.5 md:p-3 bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
                "transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-gray-900/10 dark:hover:shadow-black/20",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                "relative overflow-hidden group z-10"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300 rounded-lg md:rounded-xl" />
              <ArrowUpDown className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors relative z-10" />
            </button>
          </div>

          {/* To Token Input */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">You receive</span>
              {smartWalletClient?.account?.address && toToken && (
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  {toTokenBalance.isLoading ? (
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                      Loading...
                    </span>
                  ) : toTokenBalance.error ? (
                    <span className="text-red-400">Error loading balance</span>
                  ) : (
                    <>
                      Balance: {toTokenBalance.balanceFormatted ? 
                        formatTokenBalance(toTokenBalance.balance, toToken.decimals, 4) : 
                        '0'
                      } {toToken.symbol}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative group">
              <div className={cn(
                "relative bg-gradient-to-br from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl md:rounded-2xl transition-all duration-300",
                "border border-gray-200/50 dark:border-gray-700/50",
                "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/10",
                activeQuote && "border-green-200 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/10"
              )}>
                <div className="flex items-center p-3 md:p-4">
                  <div className="flex-1 min-w-0">
                    <NumericFormat
                      key={`quote-${activeQuote?.id || 'empty'}-${activeQuote?.toAmount || '0'}`} // ✅ FORCE RE-RENDER on quote change
                      value={formatQuoteAmount(activeQuote?.toAmount, toToken)}
                      displayType="text"
                      thousandSeparator=","
                      decimalSeparator="."
                      decimalScale={6}
                      className={cn(
                        "w-full font-bold bg-transparent border-0 outline-none",
                        "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                        "transition-all duration-200",
                        // Dynamic text size based on value length - FIXED to use safe helper
                        (() => {
                          const displayValue = formatQuoteAmount(activeQuote?.toAmount, toToken)
                          console.log('📱 Rendering toAmount display:', { displayValue, quoteId: activeQuote?.id, raw: activeQuote?.toAmount }) // ✅ DEBUG
                          return displayValue.length > 12 ? "text-lg md:text-xl" :
                                 displayValue.length > 8 ? "text-xl md:text-2xl" :
                                 "text-2xl md:text-3xl"
                        })()
                      )}
                    />
                    {toToken?.priceUSD && activeQuote?.toAmount && (() => {
                      const amountValue = formatQuoteAmount(activeQuote.toAmount, toToken)
                      if (!amountValue) return null
                      const parsed = parseFloat(amountValue)
                      if (isNaN(parsed) || !isFinite(parsed)) return null
                      return (
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                          ≈ {formatCurrency(parsed * toToken.priceUSD)}
                        </p>
                      )
                    })()}
                  </div>

                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowToTokenSelector(true)}
                    disabled={false}
                    className={cn(
                      "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 ml-3 md:ml-4 transition-all duration-200",
                      "bg-white dark:bg-gray-700 rounded-lg md:rounded-xl shadow-sm border border-gray-200 dark:border-gray-600",
                      "hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:shadow-md",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    )}
                  >
                    {toToken ? (
                      <>
                        <div className="relative">
                          {toToken.logoURI && (
                            <Image 
                              src={toToken.logoURI} 
                              alt={toToken.symbol}
                              width={28}
                              height={28}
                              className="w-6 h-6 md:w-7 md:h-7 rounded-full shadow-sm"
                            />
                          )}
                          {chainInfo.toChain && (
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white dark:border-gray-700",
                              chainInfo.toChain.color
                            )} />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-gray-900 dark:text-white text-sm md:text-base">{toToken.symbol}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{toToken.name}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full" />
                        <div className="text-left">
                          <div className="font-medium text-gray-500 dark:text-gray-400 text-sm md:text-base">Select token</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">Choose token</div>
                        </div>
                      </>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modern Quote Display */}
          {activeQuote && isValidRequest && (
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
                          {/* ✅ FIXED: Match countdown timer (slightly thicker for visibility) */}
                          <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                          {/* ✅ FIXED: Match exact refresh button size */}
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
                        {activeQuote?.provider || 'DEX'}
                      </span>
                    </div>
                    
                    {/* Cross-chain Badge */}
                    {chainInfo.isCrossChain && (
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
                                 ? "bg-gradient-to-r from-orange-400 to-red-500" // Orange when paused (match theme)
                                 : realtimeCountdown > 15000 ? "bg-gradient-to-r from-green-400 to-green-500" :
                                   realtimeCountdown > 5000 ? "bg-gradient-to-r from-yellow-400 to-yellow-500" : 
                                   "bg-gradient-to-r from-red-400 to-red-500"
                             )}
                             style={{
                               width: `${Math.min(100, (realtimeCountdown / 30000) * 100)}%`,
                               transition: (realtimeCountdown <= 5000 || isCountdownPaused) ? 'none' : 'width 0.1s ease-linear'
                             }}
                           />
                           {/* Different effects based on state */}
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
                               ? "bg-orange-500 animate-pulse" // Orange pulse when paused (match theme)
                               : realtimeCountdown > 15000 ? "bg-green-500" :
                                 realtimeCountdown > 5000 ? "bg-yellow-500" : "bg-red-500 animate-ping"
                           )} />
                           <span className={cn(
                             "text-xs font-mono tabular-nums transition-colors",
                             isCountdownPaused || isSwapInProgress
                               ? "text-orange-600 dark:text-orange-400" // Orange text when paused (match theme)
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
                       onClick={handleRefresh}
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

                {/* Main Quote Info - Streamlined */}
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
                    {activeQuote?.priceImpact && (
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        (() => {
                          const impact = parseFloat(activeQuote.priceImpact)
                          const absImpact = Math.abs(impact)
                          return absImpact > 5 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'
                            : absImpact > 2 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        })()
                      )}>
                        <TrendingUp className="w-3 h-3" />
                        {(() => {
                          const impact = parseFloat(activeQuote.priceImpact)
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
                        {activeQuote?.gasEstimate?.gasFeeUSD ? 
                          formatCurrency(typeof activeQuote.gasEstimate.gasFeeUSD === 'number' ? 
                            activeQuote.gasEstimate.gasFeeUSD : 
                            parseFloat(String(activeQuote.gasEstimate.gasFeeUSD))
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
                        {chainInfo.isCrossChain ? '2-5m' : '~30s'}
                      </div>
                    </div>
                  </div>

                  {/* Route Display - Horizontal */}
                  <div className="flex items-center justify-center gap-2 p-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700/30 dark:to-gray-800/30 rounded-lg mb-3">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {chainInfo.fromChain?.name || 'ETH'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    {chainInfo.isCrossChain && (
                      <>
                        <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium">
                          Bridge
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      </>
                    )}
                    <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                      {activeQuote?.provider}
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
                          suffix={` ${toToken?.symbol || ''}`}
                        />
                      </span>
                    </div>

                    {/* Compare Routes */}
                    {allQuotes && allQuotes.length > 1 && (
                      <button
                        onClick={() => setShowQuoteComparison(true)}
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
                            {activeQuote?.protocolFee || '0.05%'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 dark:text-gray-400">Route Type</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {chainInfo.isCrossChain ? 'Cross-Chain' : 'Single Chain'}
                          </span>
                        </div>
                      </div>
                      
                      {/* High Impact Warning */}
                      {activeQuote?.priceImpact && Math.abs(parseFloat(activeQuote.priceImpact)) > 5 && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mt-3">
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-red-800 dark:text-red-300">
                              High Price Impact ({(() => {
                                const impact = parseFloat(activeQuote.priceImpact)
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
          )}

          {/* Loading Skeleton when no active quote */}
          {(isLoading || isAutoRefreshing) && !activeQuote && isValidRequest && !error && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
              <div className="p-3">
                                 {/* Header Skeleton */}
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                     <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                   </div>
                   <div className="flex items-center gap-2">
                     {/* ✅ FIXED: Match countdown timer (slightly thicker for visibility) */}
                     <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                     {/* ✅ FIXED: Match exact refresh button size */}
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
                
                                      {/* Loading text with icon */}
                      <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm">
                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 bg-white/95 dark:bg-gray-800/95 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">
                            {isRefreshing ? "Refreshing quote..." : 
                             isAutoRefreshing ? "Auto-refreshing quote..." : 
                             "Finding best quote..."}
                          </span>
                        </div>
                      </div>
                
                {/* Shimmer Effect */}
                <div 
                  className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
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

      {/* Quote Comparison Modal - Using Component */}
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