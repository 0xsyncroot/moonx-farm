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

  // URL synchronization - 🔧 FIX: Get forceUpdateURL for immediate updates
  const { markInitialized, forceUpdateURL } = useUrlSync({
    fromToken,
    toToken,
    amount,
    slippage: slippage || 0.5
  })

  // 🔧 FIX: Add URL loading state tracking
  const [isLoadingFromURL, setIsLoadingFromURL] = useState(false)
  const urlLoadCompleteRef = useRef(false)

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
  // 🔧 FIX: Use urlLoadCompleteRef to prevent false positives during URL loading
  const hasInsufficientBalance = useMemo(() => {
    // Don't check balance during URL loading or if not properly initialized
    if (!urlLoadCompleteRef.current || isLoadingFromURL || !fromToken || !amount || !fromTokenBalance.balance) {
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
        urlLoadComplete: urlLoadCompleteRef.current,
        isLoadingFromURL
      })
    }
    
    return isInsufficient
  }, [fromToken, amount, fromTokenBalance.balance, fromTokenBalance.balanceFormatted, isLoadingFromURL])

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

  // 🔧 FIX: Enhanced amount change handler with URL sync
  const handleAmountChange = useCallback((newAmount: string) => {
    console.log('💰 Amount changing:', {
      oldAmount: amount,
      newAmount,
      fromToken: fromToken?.symbol,
      urlLoadComplete: urlLoadCompleteRef.current
    })
    
    // Update the amount immediately
    setAmount(newAmount)
    
    // 🔧 FIX: Force immediate URL update for user-initiated changes
    if (urlLoadCompleteRef.current && forceUpdateURL) {
      // Small delay to let state update propagate
      setTimeout(() => forceUpdateURL(true), 10)
    }
  }, [amount, fromToken, setAmount, forceUpdateURL])

  // 🔧 FIX: Enhanced token change handlers with immediate URL sync
  const handleFromTokenChange = useCallback((token: Token | null) => {
    console.log('🔄 From token changing:', token?.symbol)
    setFromToken(token)
    
    // Force immediate URL update for token changes
    if (urlLoadCompleteRef.current && forceUpdateURL) {
      setTimeout(() => forceUpdateURL(true), 10)
    }
  }, [setFromToken, forceUpdateURL])

  const handleToTokenChange = useCallback((token: Token | null) => {
    console.log('🔄 To token changing:', token?.symbol)
    setToToken(token)
    
    // Force immediate URL update for token changes
    if (urlLoadCompleteRef.current && forceUpdateURL) {
      setTimeout(() => forceUpdateURL(true), 10)
    }
  }, [setToToken, forceUpdateURL])

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

  // 🔧 FIX: Add validation helper functions
  const validateAmount = useCallback((amount: string): boolean => {
    if (!amount || amount.trim() === '') return false
    const num = parseFloat(amount)
    return !isNaN(num) && isFinite(num) && num > 0
  }, [])

  const validateChainId = useCallback((chainIdStr: string): number | null => {
    if (!chainIdStr) return null
    const chainId = parseInt(chainIdStr, 10)
    if (isNaN(chainId) || chainId <= 0) return null
    return chainId
  }, [])

  // 🔧 FIX: Add URL parameter getter with validation
  const getValidURLParams = useCallback(() => {
    const params = {
      amount: searchParams.get('amount'),
      slippage: searchParams.get('slippage'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      fromChain: searchParams.get('fromChain'),
      toChain: searchParams.get('toChain')
    }

    // Validate amount
    if (params.amount && !validateAmount(params.amount)) {
      console.warn('⚠️ Invalid amount in URL:', params.amount)
      params.amount = null
    }

    // Validate slippage
    if (params.slippage) {
      const slippageNum = parseFloat(params.slippage)
      if (isNaN(slippageNum) || slippageNum < 0 || slippageNum > 50) {
        console.warn('⚠️ Invalid slippage in URL:', params.slippage)
        params.slippage = null
      }
    }

    // Validate chain IDs
    if (params.fromChain && !validateChainId(params.fromChain)) {
      console.warn('⚠️ Invalid fromChain in URL:', params.fromChain)
      params.fromChain = null
    }

    if (params.toChain && !validateChainId(params.toChain)) {
      console.warn('⚠️ Invalid toChain in URL:', params.toChain)
      params.toChain = null
    }

    return params
  }, [searchParams, validateAmount, validateChainId])

  // Enhanced token lookup function - Fixed to avoid duplicate API calls
  const findTokenByParam = useCallback(async (param: string, chainId: number): Promise<Token | null> => {
    if (!param || param.trim() === '') {
      console.warn('⚠️ Empty token parameter')
      return null
    }

    console.log('🔍 Token lookup:', { param, chainId, isAddress: param.startsWith('0x') })

    // 🔧 FIX: Special handling for native token address
    const isNativeAddress = param.toLowerCase() === '0x0000000000000000000000000000000000000000'
    const isAddress = param.startsWith('0x') && param.length === 42
    
    if (isNativeAddress) {
      // For native token address: create native token for specific chain
      try {
        console.log('🔧 Creating native token for chain:', chainId)
        
        // Create native token based on chainId
        let nativeToken: Token
        switch (chainId) {
          case 8453: // Base
          case 84532: // Base Sepolia  
            nativeToken = {
              address: '0x0000000000000000000000000000000000000000',
              symbol: 'ETH',
              name: 'Ethereum',
              decimals: 18,
              chainId: chainId,
              isNative: true,
              verified: true,
              popular: true,
              logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            }
            break
          case 56: // BSC
          case 97: // BSC Testnet
            nativeToken = {
              address: '0x0000000000000000000000000000000000000000',
              symbol: 'BNB',
              name: 'BNB',
              decimals: 18,
              chainId: chainId,
              isNative: true,
              verified: true,
              popular: true,
              logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
            }
            break
          case 1: // Ethereum
            nativeToken = {
              address: '0x0000000000000000000000000000000000000000',
              symbol: 'ETH',
              name: 'Ethereum',
              decimals: 18,
              chainId: chainId,
              isNative: true,
              verified: true,
              popular: true,
              logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            }
            break
          default:
            console.warn('⚠️ Unsupported chain for native token:', chainId)
            return null
        }
        
        console.log('✅ Created native token:', nativeToken.symbol, 'for chain', chainId)
        return nativeToken
      } catch (error) {
        console.error('❌ Failed to create native token:', error)
        return null
      }
    } else if (isAddress) {
      // For contract addresses: search by address
      try {
        const apiToken = await searchToken(param, chainId)
        if (apiToken) {
          console.log('✅ Found token by address:', param, '→', apiToken.symbol, 'on chain', apiToken.chainId)
          return apiToken
        }
        console.warn('⚠️ Token not found by address:', param, 'on chain', chainId)
        return null
      } catch (error) {
        console.warn('❌ Failed to find token by address:', param, error)
        return null
      }
    } else {
      // For symbols: Try local first, then API
      // 1. Check local tokens first (faster)
      if (getTokenBySymbol) {
        const symbolToken = getTokenBySymbol(param)
        if (symbolToken && symbolToken.chainId === chainId) {
          console.log('✅ Found token locally:', param, '→', symbolToken.symbol, 'on chain', symbolToken.chainId)
          return symbolToken
        }
      }
      
      // 2. Search via API if not found locally
      try {
        const apiToken = await searchToken(param, chainId)
        if (apiToken) {
          console.log('✅ Found token by symbol via API:', param, '→', apiToken.symbol, 'on chain', apiToken.chainId)
          return apiToken
        }
        console.warn('⚠️ Token not found by symbol:', param, 'on chain', chainId)
        return null
      } catch (error) {
        console.warn('❌ Failed to find token by symbol:', param, error)
        return null
      }
    }
  }, [getTokenBySymbol, searchToken])

  // 🔧 FIX: Stable token lookup function to prevent infinite re-renders
  const findTokenByParamStable = useRef(findTokenByParam)
  useEffect(() => {
    findTokenByParamStable.current = findTokenByParam
  }, [findTokenByParam])

  // ✅ Single useEffect để load ALL URL parameters synchronously
  // 🔧 FIX: Improved logic with proper state management
  const lastSearchParamsRef = useRef<string>('')
  const loadingStateRef = useRef({
    amount: false,
    slippage: false,
    fromToken: false,
    toToken: false
  })
  
  useEffect(() => {
    const currentSearchParams = searchParams.toString()
    
    // Skip if already loaded and same params
    if (urlLoadCompleteRef.current && currentSearchParams === lastSearchParamsRef.current) {
      return
    }
    
    // Skip if we don't have defaultChainId yet
    if (!defaultChainId) {
      return
    }
    
    lastSearchParamsRef.current = currentSearchParams

    const loadFromURL = async () => {
      try {
        console.log('🔗 Starting URL parameter loading:', {
          currentSearchParams,
          defaultChainId,
          currentChain: currentChain?.id,
          walletChain: walletInfo?.chainId
        })
        setIsLoadingFromURL(true)
        
        // Reset loading state
        loadingStateRef.current = {
          amount: false,
          slippage: false,
          fromToken: false,
          toToken: false
        }

        // 🔧 FIX: Get validated URL parameters
        const urlParams = getValidURLParams()
        console.log('🔗 Validated URL params:', urlParams)

        // 1. Load basic params first (amount, slippage)
        // 🔧 FIX: Only load if URL has the param AND it's different from current state
        if (urlParams.amount && urlParams.amount !== amount) {
          console.log('🔗 Loading amount from URL:', urlParams.amount, '(current:', amount, ')')
          setAmount(urlParams.amount)
          loadingStateRef.current.amount = true
        }
        
        if (urlParams.slippage && parseFloat(urlParams.slippage) !== slippage) {
          console.log('🔗 Loading slippage from URL:', urlParams.slippage, '(current:', slippage, ')')
          setSlippage(parseFloat(urlParams.slippage))
          loadingStateRef.current.slippage = true
        }

        // 2. Load tokens with improved comparison logic
        // 🔧 FIX: Better fromToken loading logic with explicit chain handling
        if (urlParams.from) {
          const targetChainId = urlParams.fromChain ? parseInt(urlParams.fromChain) : defaultChainId
          const shouldLoadFromToken = !fromToken || 
            (fromToken.address.toLowerCase() !== urlParams.from.toLowerCase() && 
             fromToken.symbol.toLowerCase() !== urlParams.from.toLowerCase()) ||
            fromToken.chainId !== targetChainId
          
          console.log('🔍 FromToken loading decision:', {
            urlParam: urlParams.from,
            targetChainId,
            currentToken: fromToken?.symbol,
            currentChain: fromToken?.chainId,
            shouldLoad: shouldLoadFromToken
          })
          
          if (shouldLoadFromToken) {
            console.log('🔍 Looking for fromToken:', urlParams.from, 'on chain:', targetChainId)
            
            try {
              const foundToken = await findTokenByParamStable.current(urlParams.from, targetChainId)
              if (foundToken) {
                setFromToken(foundToken)
                loadingStateRef.current.fromToken = true
                console.log('✅ Loaded fromToken from URL:', foundToken.symbol, 'on chain', foundToken.chainId)
              } else {
                console.warn('⚠️ fromToken not found:', urlParams.from, 'on chain', targetChainId)
              }
            } catch (error) {
              console.error('❌ Error loading fromToken:', error)
            }
          } else {
            console.log('✅ fromToken already matches URL:', fromToken?.symbol, 'on chain', fromToken?.chainId)
          }
        }

        // 🔧 FIX: Better toToken loading logic with explicit chain handling
        if (urlParams.to) {
          const targetChainId = urlParams.toChain ? parseInt(urlParams.toChain) : defaultChainId
          const shouldLoadToToken = !toToken || 
            (toToken.address.toLowerCase() !== urlParams.to.toLowerCase() && 
             toToken.symbol.toLowerCase() !== urlParams.to.toLowerCase()) ||
            toToken.chainId !== targetChainId
          
          console.log('🔍 ToToken loading decision:', {
            urlParam: urlParams.to,
            targetChainId,
            currentToken: toToken?.symbol,
            currentChain: toToken?.chainId,
            shouldLoad: shouldLoadToToken
          })
          
          if (shouldLoadToToken) {
            console.log('🔍 Looking for toToken:', urlParams.to, 'on chain:', targetChainId)
            
            try {
              const foundToken = await findTokenByParamStable.current(urlParams.to, targetChainId)
              if (foundToken) {
                setToToken(foundToken)
                loadingStateRef.current.toToken = true
                console.log('✅ Loaded toToken from URL:', foundToken.symbol, 'on chain', foundToken.chainId)
              } else {
                console.warn('⚠️ toToken not found:', urlParams.to, 'on chain', targetChainId)
              }
            } catch (error) {
              console.error('❌ Error loading toToken:', error)
            }
          } else {
            console.log('✅ toToken already matches URL:', toToken?.symbol, 'on chain', toToken?.chainId)
          }
        }

        // 3. Mark URL loading as complete
        urlLoadCompleteRef.current = true
        setIsLoadingFromURL(false)
        
        // 4. Initialize URL sync AFTER loading is complete
        markInitialized()
        
        console.log('✅ URL params loading completed:', {
          amountLoaded: loadingStateRef.current.amount,
          slippageLoaded: loadingStateRef.current.slippage,
          fromTokenLoaded: loadingStateRef.current.fromToken,
          toTokenLoaded: loadingStateRef.current.toToken,
          currentParams: currentSearchParams
        })
        
      } catch (error) {
        console.error('❌ Failed to load params from URL:', error)
        setIsLoadingFromURL(false)
        // Still mark as complete to prevent infinite loading
        urlLoadCompleteRef.current = true
        markInitialized()
      }
    }

    loadFromURL()
  }, [
    // 🔧 FIX: Minimal stable dependencies to prevent infinite loops
    searchParams.toString(),
    defaultChainId,
    getValidURLParams,
    markInitialized
    // Note: Removed amount, slippage, fromToken, toToken from deps to prevent loops
    // The conditionals inside handle state comparison
  ])

  // 🔧 FIX: Add debugging for current state
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Current swap state:', {
        fromToken: fromToken?.symbol,
        toToken: toToken?.symbol,
        amount,
        slippage,
        isInitialized: isInitializedRef.current,
        urlParams: searchParams.toString()
      })
    }
  }, [fromToken, toToken, amount, slippage, searchParams])

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
    handleFromTokenChange(token)
  }, [handleFromTokenChange])

  const handleToTokenSelect = useCallback((token: Token) => {
    setShowToTokenSelector(false)
    handleToTokenChange(token)
  }, [handleToTokenChange])

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