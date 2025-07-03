import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { privyContractSwapExecutor, prepareSwapFromQuote } from '@/lib/contracts'
import { Quote } from '@/lib/api-client'
import { getChainConfig } from '@/config/chains'

// Simple toast replacement for now
const toast = {
  success: (message: string, options?: any) => console.log('✅', message, options),
  error: (message: string, options?: any) => console.error('❌', message, options)
}

export interface SwapState {
  isSwapping: boolean
  approvalHash?: string
  swapHash?: string
  error?: string
  step: 'idle' | 'approving' | 'swapping' | 'success' | 'error' | 'cancelled'
  // 🚀 NEW: Transaction explorer URL for easy access
  explorerUrl?: string
  // 🚀 NEW: Quote info for post-swap context
  completedQuote?: Quote
}

// 🚀 NEW: Helper function to build transaction explorer URL
const buildTransactionUrl = (hash: string, chainId?: number): string => {
  if (!chainId) {
    // Fallback to Base if no chainId provided
    return `https://basescan.org/tx/${hash}`
  }
  
  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) {
    // Fallback to Base if chain not supported
    return `https://basescan.org/tx/${hash}`
  }
  
  return `${chainConfig.explorer}/tx/${hash}`
}

export function useSwap(customSmartWalletClient?: any) {
  const { client: defaultSmartWalletClient } = useSmartWallets()
  const smartWalletClient = customSmartWalletClient || defaultSmartWalletClient
  
  const [swapState, setSwapState] = useState<SwapState>({
    isSwapping: false,
    step: 'idle'
  })

  // Single execution lock
  const isExecutingRef = useRef(false)
  const lastCallTimeRef = useRef(0)
  
  // 🚀 ENHANCED: Multiple callbacks for different post-swap actions
  const onSwapCompleteRef = useRef<(() => void) | null>(null)
  const onSwapSuccessRef = useRef<((hash: string, quote: Quote) => void) | null>(null)
  const onBalanceReloadRef = useRef<(() => void) | null>(null)
  const onInputResetRef = useRef<(() => void) | null>(null)
  
  // 🚀 JUPITER-STYLE: Hover protection for success state
  const isUserInteractingRef = useRef<boolean>(false)
  const autoResetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 🚀 NEW: Store current quote for post-swap callbacks
  const currentQuoteRef = useRef<Quote | null>(null)

  // Helper function to detect user cancellation
  const isUserCancellation = useCallback((errorMessage: string): boolean => {
    const cancellationKeywords = [
      'user rejected',
      'user denied', 
      'user cancelled',
      'transaction cancelled',
      'cancelled by user',
      'USER_CANCELLED_APPROVAL',
      'Transaction cancelled by user'
    ]
    
    const lowerErrorMessage = errorMessage.toLowerCase()
    return cancellationKeywords.some(keyword => 
      lowerErrorMessage.includes(keyword.toLowerCase())
    )
  }, [])

  // Mutation with NO RETRY to prevent multiple attempts
  const swapMutation = useMutation({
    mutationFn: async (quote: Quote) => {
      const now = Date.now()
      
      // Protection: Prevent calls too close together
      if (now - lastCallTimeRef.current < 1000) {
        throw new Error('Please wait before trying again')
      }

      // Protection: Already executing check
      if (isExecutingRef.current) {
        throw new Error('Swap already in progress')
      }

      // Set execution state
      isExecutingRef.current = true
      lastCallTimeRef.current = now

      try {
        if (!smartWalletClient?.account?.address) {
          throw new Error('Smart wallet not connected')
        }

        // Prepare swap parameters
        const swapParams = prepareSwapFromQuote(quote, smartWalletClient.account.address)
        
        // 🚀 NEW: Store quote for post-swap callbacks
        currentQuoteRef.current = quote
        
        // Execute swap
        const result = await privyContractSwapExecutor.executeSwap(smartWalletClient, swapParams)
        
        return result
      } finally {
        // Always cleanup
        isExecutingRef.current = false
      }
    },
    // DISABLE RETRY - This is critical to prevent multiple attempts
    retry: false,
    onMutate: () => {
      setSwapState(prev => ({
        ...prev,
        isSwapping: true,
        step: 'approving',
        error: undefined
      }))
    },
    onSuccess: (hash: string) => {
      const completedQuote = currentQuoteRef.current
      const explorerUrl = buildTransactionUrl(hash, completedQuote?.fromToken?.chainId)
      
              setSwapState({
          isSwapping: false,
          swapHash: hash,
          step: 'success',
          explorerUrl,
          completedQuote: completedQuote || undefined
        })
      
      toast.success('Swap completed successfully!', {
        description: `Transaction: ${hash.slice(0, 10)}...${hash.slice(-8)}`
      })
      
      // 🚀 ENHANCED: Jupiter-style post-swap actions
      
      // 1. Trigger balance reload immediately
      if (onBalanceReloadRef.current) {
        console.log('🔄 Triggering balance reload after successful swap')
        onBalanceReloadRef.current()
      }
      
             // 2. Jupiter-style input reset after user has time to see success
       setTimeout(() => {
         if (onInputResetRef.current) {
           console.log('🔄 Resetting input after successful swap (Jupiter-style)')
           onInputResetRef.current()
         }
       }, 3000) // 3 second delay to let user see success and copy tx hash
       
       // 3. Smart auto-reset with hover protection (Jupiter-style UX)
       const scheduleAutoReset = () => {
         // Clear any existing timeout
         if (autoResetTimeoutRef.current) {
           clearTimeout(autoResetTimeoutRef.current)
         }
         
         autoResetTimeoutRef.current = setTimeout(() => {
           // Only auto-reset if user is not interacting
           if (!isUserInteractingRef.current) {
             console.log('🔄 Auto-resetting swap state to idle (Jupiter-style)')
             setSwapState(prev => ({
               ...prev,
               step: 'idle',
               isSwapping: false
             }))
           } else {
             // User is still interacting, reschedule
             console.log('🎯 User still interacting, delaying auto-reset')
             scheduleAutoReset()
           }
         }, 8000) // 8 second delay, but can be extended if user is interacting
       }
       
       scheduleAutoReset()
      
      // 3. Trigger custom success callback
      if (onSwapSuccessRef.current && completedQuote) {
        onSwapSuccessRef.current(hash, completedQuote)
      }
      
      // 4. General cleanup
      if (onSwapCompleteRef.current) {
        onSwapCompleteRef.current()
      }
      
      // 5. Clear quote reference
      currentQuoteRef.current = null
    },
    onError: (error: Error) => {
      // Check if it's a user cancellation
      if (isUserCancellation(error.message)) {
        setSwapState({
          isSwapping: false,
          step: 'cancelled',
          error: undefined
        })
      } else {
        // Handle other errors
        setSwapState({
          isSwapping: false,
          step: 'error',
          error: error.message
        })
        toast.error('Swap failed', {
          description: error.message
        })
      }
      
      // Notify external cleanup for both cancel and error
      if (onSwapCompleteRef.current) {
        onSwapCompleteRef.current()
      }
    }
  })

  // Execute swap function
  const executeSwap = useCallback(async (quote: Quote) => {
    // Guard: Prevent if already executing
    if (isExecutingRef.current || swapState.isSwapping) {
      return
    }

    // Execute the mutation
    swapMutation.mutate(quote)
  }, [swapMutation, swapState.isSwapping])

  // 🚀 ENHANCED: Callback setters for post-swap actions
  const setOnSwapComplete = useCallback((callback: (() => void) | null) => {
    onSwapCompleteRef.current = callback
  }, [])
  
  const setOnSwapSuccess = useCallback((callback: ((hash: string, quote: Quote) => void) | null) => {
    onSwapSuccessRef.current = callback
  }, [])
  
  const setOnBalanceReload = useCallback((callback: (() => void) | null) => {
    onBalanceReloadRef.current = callback
  }, [])
  
  const setOnInputReset = useCallback((callback: (() => void) | null) => {
    onInputResetRef.current = callback
  }, [])
  
  // 🚀 JUPITER-STYLE: Set user interaction state for hover protection
  const setUserInteracting = useCallback((isInteracting: boolean) => {
    isUserInteractingRef.current = isInteracting
    console.log(`🎯 User interaction state: ${isInteracting}`)
  }, [])

  // Reset swap state
  const resetSwapState = useCallback(() => {
    // Only reset if not currently swapping
    if (!isExecutingRef.current && !swapMutation.isPending) {
      setSwapState({
        isSwapping: false,
        step: 'idle'
      })
      // Clear quote reference
      currentQuoteRef.current = null
      
      // 🚀 CLEANUP: Clear auto-reset timeout and interaction state
      if (autoResetTimeoutRef.current) {
        clearTimeout(autoResetTimeoutRef.current)
        autoResetTimeoutRef.current = null
      }
      isUserInteractingRef.current = false
    }
  }, [swapMutation.isPending])

  // Computed values - single source of truth
  const isSwapping = swapState.isSwapping || isExecutingRef.current || swapMutation.isPending
  const canSwap = !isSwapping && swapState.step !== 'approving' && swapState.step !== 'swapping'

  return {
    executeSwap,
    swapState,
    resetSwapState,
    canSwap,
    isSwapping,
    // 🚀 ENHANCED: New callback setters for post-swap actions
    setOnSwapComplete,
    setOnSwapSuccess,
    setOnBalanceReload,
    setOnInputReset,
    // 🚀 JUPITER-STYLE: User interaction control for hover protection
    setUserInteracting
  }
} 