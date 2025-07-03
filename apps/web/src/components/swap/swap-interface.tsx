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
  const lastSearchParamsRef = useRef<string>('')
  const urlLoadAttemptsRef = useRef(0)
  const maxRetryAttempts = 3
  
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
  // 🔧 FIX: Use real-time amount calculation to prevent race condition
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

  // 🔧 FIX: Add real-time balance check function for immediate validation
  const checkInsufficientBalanceRealtime = useCallback((currentAmount: string) => {
    if (!fromToken || !currentAmount || !fromTokenBalance.balance) {
      return false
    }
    
    const parsedAmount = parseFloat(currentAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return false
    }
    
    return !hasSufficientBalance(fromTokenBalance.balance, currentAmount, fromToken.decimals)
  }, [fromToken, fromTokenBalance.balance])

  // 🔧 FIX: Enhanced amount change handler that provides immediate feedback
  const handleAmountChange = useCallback((newAmount: string) => {
    console.log('💰 Amount changing:', {
      oldAmount: amount,
      newAmount,
      fromToken: fromToken?.symbol,
      hasBalance: !!fromTokenBalance.balance,
      balanceFormatted: fromTokenBalance.balanceFormatted
    })
    
    // Update the amount immediately
    setAmount(newAmount)
    
    // For immediate UI feedback, check if this would cause insufficient balance
    if (newAmount && fromToken && fromTokenBalance.balance) {
      const wouldBeInsufficient = checkInsufficientBalanceRealtime(newAmount)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Real-time balance check:', {
          newAmount,
          wouldBeInsufficient,
          currentBalance: fromTokenBalance.balanceFormatted
        })
      }
    }
  }, [amount, fromToken, fromTokenBalance.balance, fromTokenBalance.balanceFormatted, setAmount, checkInsufficientBalanceRealtime])

  // 🔧 FIX: Improved defaultChainId logic - only fallback when NO URL params exist
  const defaultChainId = useMemo(() => {
    const fromChainParam = searchParams.get('fromChain')
    const toChainParam = searchParams.get('toChain')
    
    // If we have URL chain params, don't use fallback
    if (fromChainParam || toChainParam) {
      return null // No default - use specific chains from URL
    }
    
    // Only use fallback when no URL params
    if (currentChain?.id) return currentChain.id
    return 8453 // Base as last resort
  }, [searchParams, currentChain?.id])

  // 🔧 FIX: Comprehensive URL params loading with proper error handling and retry
  useEffect(() => {
    const currentSearchParams = searchParams.toString()
    
    // Skip if already initialized and params haven't changed
    if (isInitializedRef.current && currentSearchParams === lastSearchParamsRef.current) {
      return
    }
    
    // Skip if no params to load
    if (!currentSearchParams) {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true
        markInitialized()
        console.log('✅ No URL params to load, marked as initialized')
      }
      return
    }
    
    lastSearchParamsRef.current = currentSearchParams

    // 🔧 FIX: Define token lookup function inside useEffect to avoid dependency issues
    const findTokenByParam = async (param: string, chainId: number): Promise<Token | null> => {
      // 🔍 Detect input type to avoid duplicate calls
      const isAddress = param.startsWith('0x') && param.length === 42
      
      if (isAddress) {
        // For addresses: ONLY search by address, no fallback
        try {
          const apiToken = await searchToken(param, chainId)
          if (apiToken) {
            console.log('✅ Found token by address:', param, '→', apiToken.symbol, 'on chain', chainId)
            return apiToken
          }
          console.warn('⚠️ Token not found by address:', param, 'on chain', chainId)
          return null
        } catch (error) {
          console.warn('❌ Failed to find token by address:', param, 'on chain', chainId, error)
          return null
        }
      } else {
        // For symbols: Try local first, then API
        // 1. Check local tokens first (faster)
        if (getTokenBySymbol) {
          const symbolToken = getTokenBySymbol(param)
          if (symbolToken && symbolToken.chainId === chainId) {
            console.log('✅ Found token locally:', param, '→', symbolToken.symbol, 'on chain', chainId)
            return symbolToken
          }
        }
        
        // 2. Search via API if not found locally
        try {
          const apiToken = await searchToken(param, chainId)
          if (apiToken) {
            console.log('✅ Found token by symbol via API:', param, '→', apiToken.symbol, 'on chain', chainId)
            return apiToken
          }
          console.warn('⚠️ Token not found by symbol:', param, 'on chain', chainId)
          return null
        } catch (error) {
          console.warn('❌ Failed to find token by symbol:', param, 'on chain', chainId, error)
          return null
        }
      }
    }

    const loadFromURL = async () => {
      const attemptNumber = ++urlLoadAttemptsRef.current
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔗 Loading URL params (attempt ${attemptNumber}):`, {
          params: currentSearchParams,
          hasFromToken: !!fromToken,
          hasToToken: !!toToken,
          hasAmount: !!amount,
          hasSlippage: !!slippage
        })
      }

      try {
        let hasLoadedAnyParam = false

        // 1. Load basic params first (amount, slippage)
        const amountParam = searchParams.get('amount')
        const slippageParam = searchParams.get('slippage')
        
        if (amountParam && amountParam !== amount) {
          setAmount(amountParam)
          hasLoadedAnyParam = true
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Loading amount from URL:', amountParam)
          }
        }
        
        if (slippageParam && parseFloat(slippageParam) !== slippage) {
          setSlippage(parseFloat(slippageParam))
          hasLoadedAnyParam = true
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Loading slippage from URL:', slippageParam)
          }
        }

        // 2. Load tokens with explicit chain IDs from URL
        const fromTokenParam = searchParams.get('from')
        const toTokenParam = searchParams.get('to') 
        const fromChainParam = searchParams.get('fromChain')
        const toChainParam = searchParams.get('toChain')
        
        // 🔧 FIX: Load fromToken only if URL params specify it and it's different from current
        if (fromTokenParam && fromChainParam) {
          const chainId = parseInt(fromChainParam, 10)
          const shouldLoad = !fromToken || 
                           fromToken.address.toLowerCase() !== fromTokenParam.toLowerCase() ||
                           fromToken.chainId !== chainId
          
          if (shouldLoad) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔗 Attempting to load fromToken:', {
                param: fromTokenParam,
                chainId,
                reason: !fromToken ? 'No current token' :
                       fromToken.address.toLowerCase() !== fromTokenParam.toLowerCase() ? 'Different address' :
                       fromToken.chainId !== chainId ? 'Different chain' : 'Unknown'
              })
            }
            
            const foundToken = await findTokenByParam(fromTokenParam, chainId)
            if (foundToken) {
              setFromToken(foundToken)
              hasLoadedAnyParam = true
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Loaded fromToken from URL:', foundToken.symbol, 'on chain', foundToken.chainId)
              }
            } else {
              console.warn('❌ Failed to load fromToken from URL:', {
                param: fromTokenParam,
                chainId
              })
            }
          }
        }

        // 🔧 FIX: Load toToken only if URL params specify it and it's different from current
        if (toTokenParam && toChainParam) {
          const chainId = parseInt(toChainParam, 10)
          const shouldLoad = !toToken || 
                           toToken.address.toLowerCase() !== toTokenParam.toLowerCase() ||
                           toToken.chainId !== chainId
          
          if (shouldLoad) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔗 Attempting to load toToken:', {
                param: toTokenParam,
                chainId,
                reason: !toToken ? 'No current token' :
                       toToken.address.toLowerCase() !== toTokenParam.toLowerCase() ? 'Different address' :
                       toToken.chainId !== chainId ? 'Different chain' : 'Unknown'
              })
            }
            
            const foundToken = await findTokenByParam(toTokenParam, chainId)
            if (foundToken) {
              setToToken(foundToken)
              hasLoadedAnyParam = true
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Loaded toToken from URL:', foundToken.symbol, 'on chain', foundToken.chainId)
              }
            } else {
              console.warn('❌ Failed to load toToken from URL:', {
                param: toTokenParam,
                chainId
              })
            }
          }
        }

        // 3. Mark as initialized after successful attempt
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
          markInitialized()
          urlLoadAttemptsRef.current = 0 // Reset attempts on success
          
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ URL params loading completed:', {
              hasLoadedAnyParam,
              fromToken: fromToken?.symbol,
              toToken: toToken?.symbol,
              amount,
              slippage
            })
          }
        }

      } catch (error) {
        console.error('❌ Failed to load params from URL (attempt', attemptNumber, '):', error)
        
        // Retry logic
        if (attemptNumber < maxRetryAttempts) {
          console.log(`🔄 Retrying URL load in 1 second (attempt ${attemptNumber + 1}/${maxRetryAttempts})`)
          setTimeout(() => {
            // Trigger retry by clearing lastSearchParamsRef
            lastSearchParamsRef.current = ''
          }, 1000)
        } else {
          // Give up after max attempts
          console.error('❌ Max retry attempts reached, marking as initialized anyway')
          if (!isInitializedRef.current) {
            isInitializedRef.current = true
            markInitialized()
            urlLoadAttemptsRef.current = 0
          }
        }
      }
    }

    // Only load if we have search params to load
    if (currentSearchParams) {
      loadFromURL()
    }
  }, [
    searchParams.toString(),
    setAmount,
    setSlippage,
    setFromToken,
    setToToken,
    markInitialized,
    getTokenBySymbol,
    searchToken
    // 🔧 FIX: Only essential stable dependencies
  ])

  // 🔧 FIX: Listen to auto chain switch events and update URL accordingly
  useEffect(() => {
    const handleChainSwitchSuccess = (event: CustomEvent) => {
      const { chainId, smartWalletClient: newSmartWalletClient } = event.detail
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Auto chain switch success detected, updating URL:', {
          newChainId: chainId,
          fromToken: fromToken?.symbol,
          fromTokenChain: fromToken?.chainId,
          isInitialized: isInitializedRef.current
        })
      }
      
      // Force URL update if we have fromToken and it matches the switched chain
      if (fromToken && fromToken.chainId === chainId && isInitializedRef.current) {
        // Trigger URL sync by temporarily updating a ref and forcing re-render
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
        
        // Build query string
        const queryParts: string[] = []
        Object.entries(urlParams).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          }
        })
        
        const queryString = queryParts.join('&')
        const newUrl = queryString ? `/swap?${queryString}` : '/swap'
        
        // Check if URL actually needs updating
        const currentUrl = `${window.location.pathname}${window.location.search}`
        const expectedUrl = newUrl
        
        if (currentUrl !== expectedUrl) {
          // Update URL immediately
          window.history.replaceState(null, '', newUrl)
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 URL updated after chain switch:', {
              from: currentUrl,
              to: newUrl,
              params: urlParams
            })
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 URL already correct after chain switch:', currentUrl)
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Skipping URL update after chain switch:', {
            hasFromToken: !!fromToken,
            chainMatch: fromToken?.chainId === chainId,
            isInitialized: isInitializedRef.current,
            reason: !fromToken ? 'No fromToken' : 
                   fromToken.chainId !== chainId ? 'Chain mismatch' : 
                   !isInitializedRef.current ? 'Not initialized' : 'Unknown'
          })
        }
      }
    }

    // Listen to custom events from useAutoChainSwitch
    if (typeof window !== 'undefined') {
      window.addEventListener('auto-chain-switch-success', handleChainSwitchSuccess as EventListener)
      
      return () => {
        window.removeEventListener('auto-chain-switch-success', handleChainSwitchSuccess as EventListener)
      }
    }
  }, [fromToken, toToken, amount, slippage])

  // 🔧 FIX: Also listen to direct chain switch completion via state change
  useEffect(() => {
    if (chainSwitchSuccess && fromToken && currentChain && fromToken.chainId === currentChain.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Chain switch success state detected, ensuring URL sync:', {
          fromTokenChain: fromToken.chainId,
          currentChain: currentChain.id,
          chainName: currentChain.name,
          isInitialized: isInitializedRef.current
        })
      }
      
      // Small delay to ensure all state is settled, then trigger URL sync
      const timeoutId = setTimeout(() => {
        if (fromToken && isInitializedRef.current) {
          // Force trigger URL sync by creating a new object reference
          // This will trigger the useUrlSync effect without changing the actual token
          const newFromToken = { ...fromToken }
          setFromToken(newFromToken)
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Triggered URL sync via fromToken update')
          }
        }
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [chainSwitchSuccess, fromToken, currentChain, setFromToken])

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
            onAmountChange={handleAmountChange}
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