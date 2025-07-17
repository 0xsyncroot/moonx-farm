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
import { useTestnet } from '@/hooks/use-testnet'
import { SwapInterfaceShimmer, SwapInterfaceProgressiveShimmer } from './swap-interface-shimmer'

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
 * SwapInterface Component - Jupiter-style Enhanced Version
 * 
 * 🚀 PERFORMANCE OPTIMIZATIONS:
 * - NO artificial delays - shimmer shows only when data is actually loading
 * - Reduced timeouts: URL retry (500ms), URL sync (50ms), UI feedback (300ms), button debounce (500ms)
 * - Immediate shimmer display during actual loading states (no delay for UX)
 * - Optimized loading conditions - only show shimmer when genuinely waiting for data
 * - No blocking patterns - everything loads optimistically and shows appropriate feedback
 * 
 * Key improvements:
 * - Better state management and clearing logic
 * - Enhanced error handling and recovery
 * - Proper loading state synchronization
 * - Auto-reset states when tokens/amounts change
 * - Improved URL synchronization
 * - Better countdown management
 * - Optimized shimmer usage without performance impact
 */
export function SwapInterface() {
  const { walletInfo } = useAuth()
  const searchParams = useSearchParams()

  // FIXED: Platform-safe number parsing utility to prevent Mac/Windows differences
  const safeParse = (value: string | number): number => {
    if (!value) return 0
    
    // Convert to string for processing
    const stringValue = value.toString()
    if (stringValue.trim() === '') return 0
    
    // Step 1: Normalize the string by removing all characters except digits, dots, and minus
    // This handles cases where different locales might inject different characters
    let normalized = stringValue.replace(/[^\d.-]/g, '')
    
    // Step 2: Handle multiple dots - keep only the last one as decimal separator
    const dotIndex = normalized.lastIndexOf('.')
    if (dotIndex !== -1) {
      // Remove all dots except the last one
      normalized = normalized.substring(0, dotIndex).replace(/\./g, '') + normalized.substring(dotIndex)
    }
    
    // Step 3: Parse using standard parseFloat
    const parsed = parseFloat(normalized)
    
    // Step 4: Validate result
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.warn('safeParse: Invalid number parsed:', { 
        original: value, 
        normalized, 
        parsed,
        platform: navigator.platform,
        locale: navigator.language 
      })
      return 0
    }
    
    // FIXED: Debug logging for platform differences (only in development)
    if (process.env.NODE_ENV === 'development' && normalized !== stringValue) {
      console.log('safeParse: Number normalized:', { 
        original: value, 
        stringValue,
        normalized, 
        parsed,
        platform: navigator.platform 
      })
    }
    
    return parsed
  }
  
  // UI State
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuoteComparison, setShowQuoteComparison] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // 🚀 IMPROVEMENT: Enhanced state tracking for better management
  const lastValidParamsRef = useRef<{
    fromToken?: string
    toToken?: string
    amount?: string
  }>({})
  
  // 🚀 IMPROVEMENT: Optimistic loading without blocking states
  const [isInitialized, setIsInitialized] = useState(false)
  const lastSearchParamsRef = useRef<string>('')
  const urlLoadAttemptsRef = useRef(0)
  const maxRetryAttempts = 3
  
  // 🚀 NEW: Use unified testnet hook with optimistic loading  
  const { isTestnet, isHydrated, isTestnetSwitching } = useTestnet({
    skipIfAutoSwitching: true // Prevent conflict with cross-chain swap logic
  })
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

  // 🚀 IMPROVEMENT: Auto chain switch with optimistic loading
  const {
    isLoading: isChainSwitching,
    isSuccess: chainSwitchSuccess,
    error: chainSwitchError,
    smartWalletClient,
    switchToChain,
    currentChain
  } = useAutoChainSwitch(
    // 🔧 IMPROVEMENT: Pass fromToken immediately after URL initialization (no need to wait for testnet)
    isInitialized ? fromToken : null
  )

  // 🚀 IMPROVEMENT: isTestnetSwitching now comes from useTestnet hook above

  // URL synchronization
  const { markInitialized } = useUrlSync({
    fromToken,
    toToken,
    amount,
    slippage: slippage || 0.5
  })

  // 🚀 IMPROVEMENT: Enhanced auto-refresh with better error handling
  const handleAutoRefresh = useCallback(async () => {
    try {
      await refetch()
    } catch (error) {
      console.warn('Auto-refresh failed:', error)
      // Don't throw, just log for auto-refresh failures
    }
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

  // 🚀 IMPROVEMENT: Enhanced state clearing logic
  const clearDependentStates = useCallback(() => {
    console.log('🧹 Clearing dependent states')
    setSelectedQuote(null)
    setIsRefreshing(false)
    setShowQuoteComparison(false)
  }, [])

  // 🚀 IMPROVEMENT: Auto-clear states when tokens or amounts change significantly
  useEffect(() => {
    const currentParams = {
      fromToken: fromToken?.address,
      toToken: toToken?.address,
      amount: amount
    }
    
    // Check if we should clear states
    const shouldClear = (
      // Token changes
      (lastValidParamsRef.current.fromToken && lastValidParamsRef.current.fromToken !== currentParams.fromToken) ||
      (lastValidParamsRef.current.toToken && lastValidParamsRef.current.toToken !== currentParams.toToken) ||
      // Amount changes significantly (more than just typing)
      (lastValidParamsRef.current.amount && 
       currentParams.amount && 
       lastValidParamsRef.current.amount !== currentParams.amount &&
       Math.abs(safeParse(lastValidParamsRef.current.amount) - safeParse(currentParams.amount)) > safeParse(lastValidParamsRef.current.amount) * 0.1)
    )
    
    if (shouldClear && isInitialized) {
      console.log('🔄 Auto-clearing states due to significant changes:', {
        old: lastValidParamsRef.current,
        new: currentParams
      })
      clearDependentStates()
    }
    
    // Update last valid params only if we have meaningful values
    if (currentParams.fromToken || currentParams.toToken || currentParams.amount) {
      lastValidParamsRef.current = currentParams
    }
  }, [fromToken?.address, toToken?.address, amount, clearDependentStates, isInitialized])

  // 🚀 IMPROVEMENT: No need to wait for testnet mode with optimistic loading
  // The optimized hook provides immediate value, so we can skip the waiting logic

  // ✅ Check if balance is sufficient - ONLY after URL params are fully loaded
  const hasInsufficientBalance = useMemo(() => {
    // Only check balance if we have all required data AND component is initialized
    if (!fromToken || !amount || !fromTokenBalance.balance || !isInitialized) {
      return false
    }
    
    // FIXED: Use platform-safe parsing
    const parsedAmount = safeParse(amount)
    if (parsedAmount <= 0) {
      return false
    }
    
    const isInsufficient = !hasSufficientBalance(fromTokenBalance.balance, amount, fromToken.decimals)
    
    if (process.env.NODE_ENV === 'development' && isInsufficient) {
      console.log('⚠️ Insufficient balance detected:', {
        token: fromToken.symbol,
        requestedAmount: amount,
        availableBalance: fromTokenBalance.balanceFormatted,
        isInitialized: isInitialized
      })
    }
    
    return isInsufficient
  }, [fromToken, amount, fromTokenBalance.balance, fromTokenBalance.balanceFormatted])

  // 🔧 FIX: Add real-time balance check function for immediate validation
  const checkInsufficientBalanceRealtime = useCallback((currentAmount: string) => {
    if (!fromToken || !currentAmount || !fromTokenBalance.balance) {
      return false
    }
    
    // FIXED: Use platform-safe parsing
    const parsedAmount = safeParse(currentAmount)
    if (parsedAmount <= 0) {
      return false
    }
    
    return !hasSufficientBalance(fromTokenBalance.balance, currentAmount, fromToken.decimals)
  }, [fromToken, fromTokenBalance.balance])

  // 🚀 IMPROVEMENT: Enhanced amount change handler with state clearing
  const handleAmountChange = useCallback((newAmount: string) => {
    console.log('💰 Amount changing:', {
      oldAmount: amount,
      newAmount,
      fromToken: fromToken?.symbol,
      hasBalance: !!fromTokenBalance.balance,
      balanceFormatted: fromTokenBalance.balanceFormatted
    })
    
    // FIXED: Clear dependent states on significant amount change with platform-safe parsing
    const oldAmountNum = safeParse(amount || '0')
    const newAmountNum = safeParse(newAmount || '0')
    
    if (amount && newAmount && Math.abs(oldAmountNum - newAmountNum) > oldAmountNum * 0.1) {
      clearDependentStates()
    }
    
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
  }, [amount, fromToken, fromTokenBalance.balance, fromTokenBalance.balanceFormatted, setAmount, checkInsufficientBalanceRealtime, clearDependentStates])

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

  // 🚀 IMPROVEMENT: Enhanced error recovery
  const handleErrorRecovery = useCallback(() => {
    console.log('🔄 Attempting error recovery')
    clearDependentStates()
    
    // FIXED: Try to refetch if we have valid request params with platform-safe parsing
    if (fromToken && toToken && amount && safeParse(amount) > 0) {
      setTimeout(() => {
        refetch().catch(console.warn)
      }, 1000)
    }
  }, [clearDependentStates, fromToken, toToken, amount, refetch])

  // 🚀 IMPROVEMENT: Trigger manual chain switch after initialization completes
  useEffect(() => {
    // When initialization completes and we have a fromToken that requires chain switch
    if (isInitialized && fromToken && smartWalletClient?.chain?.id !== fromToken.chainId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Post-initialization chain switch check:', {
          fromTokenChain: fromToken.chainId,
          currentChain: smartWalletClient?.chain?.id,
          needsSwitch: smartWalletClient?.chain?.id !== fromToken.chainId,
          isTestnet: isTestnet
        })
      }
      // The useAutoChainSwitch hook will now receive fromToken and handle the switch
    }
  }, [isInitialized, fromToken?.chainId, smartWalletClient?.chain?.id, isTestnet])

  // 🔧 IMPROVEMENT: Optimistic URL params loading without blocking
  useEffect(() => {
    // 🚀 IMPROVEMENT: Load URL params immediately with optimistic testnet mode
    // No need to wait since we have immediate testnet value

    const currentSearchParams = searchParams.toString()
    
    // Skip if already initialized and params haven't changed
    if (isInitialized && currentSearchParams === lastSearchParamsRef.current) {
      return
    }
    
    // Skip if no params to load
    if (!currentSearchParams) {
      if (!isInitialized) {
        setIsInitialized(true)
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
          const apiToken = await searchToken(param, chainId, isTestnet)
          if (apiToken) {
            console.log('✅ Found token by address:', param, '→', apiToken.symbol, 'on chain', chainId, 'testnet:', isTestnet)
            return apiToken
          }
          console.warn('⚠️ Token not found by address:', param, 'on chain', chainId, 'testnet:', isTestnet)
          return null
        } catch (error) {
          console.warn('❌ Failed to find token by address:', param, 'on chain', chainId, 'testnet:', isTestnet, error)
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
          const apiToken = await searchToken(param, chainId, isTestnet)
          if (apiToken) {
            console.log('✅ Found token by symbol via API:', param, '→', apiToken.symbol, 'on chain', chainId, 'testnet:', isTestnet)
            return apiToken
          }
          console.warn('⚠️ Token not found by symbol:', param, 'on chain', chainId, 'testnet:', isTestnet)
          return null
        } catch (error) {
          console.warn('❌ Failed to find token by symbol:', param, 'on chain', chainId, 'testnet:', isTestnet, error)
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
          hasSlippage: !!slippage,
          isTestnet: isTestnet,
          isHydrated: isHydrated
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
        
        if (slippageParam && safeParse(slippageParam) !== slippage) {
          setSlippage(safeParse(slippageParam))
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
        if (!isInitialized) {
          setIsInitialized(true)
          markInitialized()
          urlLoadAttemptsRef.current = 0 // Reset attempts on success
          
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ URL params loading completed:', {
              hasLoadedAnyParam,
              fromToken: fromToken?.symbol,
              toToken: toToken?.symbol,
              amount,
              slippage,
              isTestnet: isTestnet
            })
          }
        }

      } catch (error) {
        console.error('❌ Failed to load params from URL (attempt', attemptNumber, '):', error)
        
        // Retry logic
        if (attemptNumber < maxRetryAttempts) {
          console.log(`🔄 Retrying URL load in 500ms (attempt ${attemptNumber + 1}/${maxRetryAttempts})`)
          setTimeout(() => {
            // Trigger retry by clearing lastSearchParamsRef
            lastSearchParamsRef.current = ''
          }, 500)
        } else {
          // Give up after max attempts
          console.error('❌ Max retry attempts reached, marking as initialized anyway')
          if (!isInitialized) {
            setIsInitialized(true)
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
    isTestnet,
    setAmount,
    setSlippage,
    setFromToken,
    setToToken,
    markInitialized,
    getTokenBySymbol,
    searchToken
    // 🔧 IMPROVEMENT: Removed isTestnetReady - no longer needed with optimistic loading
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
          isInitialized: isInitialized
        })
      }
      
      // Force URL update if we have fromToken and it matches the switched chain
      if (fromToken && fromToken.chainId === chainId && isInitialized) {
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
            isInitialized: isInitialized,
            reason: !fromToken ? 'No fromToken' : 
                   fromToken.chainId !== chainId ? 'Chain mismatch' : 
                   !isInitialized ? 'Not initialized' : 'Unknown'
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
    if (chainSwitchSuccess && fromToken && currentChain && fromToken.chainId === currentChain?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Chain switch success state detected, ensuring URL sync:', {
          fromTokenChain: fromToken.chainId,
          currentChain: currentChain?.id,
          chainName: currentChain?.name,
          isInitialized: isInitialized
        })
      }
      
      // Small delay to ensure all state is settled, then trigger URL sync
      const timeoutId = setTimeout(() => {
        if (fromToken && isInitialized) {
          // Force trigger URL sync by creating a new object reference
          // This will trigger the useUrlSync effect without changing the actual token
          const newFromToken = { ...fromToken }
          setFromToken(newFromToken)
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Triggered URL sync via fromToken update')
          }
        }
      }, 50)
      
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

  // 🚀 IMPROVEMENT: Clear manually selected quote with smarter logic
  const lastUserSelectTimeRef = useRef(0)
  
  useEffect(() => {
    if (quoteResponse?.timestamp && selectedQuote) {
      // Only clear if it's been more than 15 seconds since user selection
      // And if the quote ID has changed significantly
      const timeSinceSelection = Date.now() - lastUserSelectTimeRef.current
      const shouldClear = timeSinceSelection > 15000 || 
                         !allQuotes?.some(q => q.id === selectedQuote.id)
      
      if (shouldClear) {
        console.log('⏰ Clearing manually selected quote:', {
          reason: timeSinceSelection > 15000 ? 'timeout' : 'quote_not_available',
          timeSinceSelection: (timeSinceSelection / 1000).toFixed(1) + 's'
        })
        setSelectedQuote(null)
      } else {
        console.log('📌 Preserving manually selected quote (selected', (timeSinceSelection / 1000).toFixed(1), 'seconds ago)')
      }
    }
  }, [quoteResponse?.timestamp, selectedQuote, allQuotes])

  // Calculate minimum received after slippage
  const minReceived = useMemo(() => {
    if (!activeQuote || !toToken) return 0
    
    try {
      // FIXED: Use toAmountMin from API if available with platform-safe parsing
      if (activeQuote.toAmountMin && activeQuote.toAmountMin !== '0') {
        const formatted = formatTokenAmount(activeQuote.toAmountMin, toToken.decimals)
        const parsed = safeParse(formatted)
        if (parsed > 0) {
          return parsed
        }
      }
      
      // FIXED: Calculate from toAmount with slippage using platform-safe parsing
      if (activeQuote.toAmount) {
        const formatted = formatTokenAmount(activeQuote.toAmount, toToken.decimals)
        const parsed = safeParse(formatted)
        if (parsed > 0) {
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

  // 🚀 IMPROVEMENT: Enhanced refresh with error recovery
  const lastRefreshRef = useRef(0)
  const handleRefresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 2000) return // 2 second throttle
    lastRefreshRef.current = now
    
    setIsRefreshing(true)
    try {
      await refetch()
    } catch (error) {
      console.error('Manual refresh failed:', error)
      // Trigger error recovery
      handleErrorRecovery()
    } finally {
      setTimeout(() => setIsRefreshing(false), 300)
    }
  }, [refetch, handleErrorRecovery])

  // 🚀 IMPROVEMENT: Enhanced token selection with state clearing
  const handleFromTokenSelect = useCallback((token: Token) => {
    setShowFromTokenSelector(false)
    
    // Clear dependent states when changing from token
    if (fromToken && fromToken.address !== token.address) {
      clearDependentStates()
    }
    
    setFromToken(token)
  }, [setFromToken, fromToken, clearDependentStates])

  const handleToTokenSelect = useCallback((token: Token) => {
    setShowToTokenSelector(false)
    
    // Clear dependent states when changing to token
    if (toToken && toToken.address !== token.address) {
      clearDependentStates()
    }
    
    setToToken(token)
  }, [setToToken, toToken, clearDependentStates])

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
      const parsed = safeParse(formatted)
      
      if (parsed < 0) return ''
      if (parsed === 0) return '0'
      if (parsed < 0.000001) return formatted
      
      return parsed.toString()
    } catch (error) {
      console.warn('Failed to format quote amount:', error)
      return ''
    }
  }, [])

  // 🚀 OPTIMIZED: Show shimmer loading ONLY during early initialization - no artificial delay
  if (!isInitialized && !isHydrated) {
    return (
      <SwapInterfaceProgressiveShimmer
        loadingStage="initialization"
        className="animate-pulse"
      />
    )
  }

  // 🚀 OPTIMIZED: Show shimmer ONLY when waiting for tokens to load from URL - immediate check
  if (isInitialized && !isHydrated && (searchParams.get('from') || searchParams.get('to'))) {
    return (
      <SwapInterfaceProgressiveShimmer
        loadingStage="tokens"
        className="animate-pulse"
      />
    )
  }

  // 🚀 OPTIMIZED: Show shimmer ONLY during active chain switching - no delay, immediate feedback
  if (isChainSwitching && fromToken && toToken) {
    return (
      <SwapInterfaceShimmer
        showCrossChainIndicator={!!chainInfo.isCrossChain}
        className="animate-pulse"
      />
    )
  }

  // 🚀 OPTIMIZED: Show shimmer ONLY during active testnet switching - immediate response
  if (isTestnetSwitching && (fromToken || toToken)) {
    return (
      <SwapInterfaceShimmer
        showCrossChainIndicator={false}
        className="animate-pulse"
      />
    )
  }

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

          {/* Testnet Switch Indicator */}
          {isTestnetSwitching && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 
                           rounded-2xl text-orange-700 dark:text-orange-400">
              <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Switching testnet mode...</div>
                <div className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                  Preparing smart wallet for network change
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
                onClick={handleErrorRecovery}
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

          {/* 🚀 NEW: Show shimmer for token inputs when loading */}
          {(!fromToken || !toToken) && isInitialized && !isHydrated ? (
            <SwapInterfaceProgressiveShimmer
              loadingStage="tokens"
              className="animate-pulse"
            />
          ) : (
            <>
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
            </>
          )}

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

          {/* 🚀 IMPROVED: Enhanced loading skeleton with better UX */}
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
                    <span className="text-sm font-medium">
                      {isAutoRefreshing ? 'Auto-refreshing quote...' : 'Finding best quote...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🚀 IMPROVEMENT: Enhanced Error Display with recovery options */}
          {error && (
            <div className="flex items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                           rounded-2xl text-red-700 dark:text-red-400">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">
                    {error instanceof Error ? error.message : 'Failed to get quote'}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-300 mt-1">
                    Try refreshing or adjusting your amount
                  </div>
                </div>
              </div>
              <button
                onClick={handleErrorRecovery}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Swap Button */}
          <SwapButton
            fromToken={fromToken}
            toToken={toToken}
            fromAmount={amount}
            quote={activeQuote || null}
            disabled={!fromToken || !toToken || !amount || amount === '0' || isLoading || hasInsufficientBalance || isChainSwitching || isTestnetSwitching}
            priceImpactTooHigh={activeQuote?.priceImpact ? Math.abs(safeParse(activeQuote.priceImpact)) > 15 : false}
            hasInsufficientBalance={hasInsufficientBalance}
            onPauseCountdown={pauseCountdown}
            onResumeCountdown={resumeCountdown}
            smartWalletClient={smartWalletClient}
            // 🚀 NEW: Jupiter-style post-swap callbacks
            onBalanceReload={() => {
              // Trigger balance reload for both tokens
              if (fromToken) {
                fromTokenBalance.refetch()
              }
              if (toToken) {
                toTokenBalance.refetch()
              }
            }}
            onInputReset={() => {
              // Reset input amount like Jupiter does
              setAmount('')
            }}
            onSwapSuccess={(hash, quote) => {
              console.log('🎉 Swap successful!', {
                hash,
                fromToken: quote.fromToken?.symbol,
                toToken: quote.toToken?.symbol,
                fromAmount: quote.fromAmount,
                toAmount: quote.toAmount
              })
            }}
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