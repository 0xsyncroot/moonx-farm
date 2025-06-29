import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { privyContractSwapExecutor, prepareSwapFromQuote } from '@/lib/contracts'
import { Quote } from '@/lib/api-client'

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
}

export function useSwap() {
  const { client: smartWalletClient } = useSmartWallets()
  
  const [swapState, setSwapState] = useState<SwapState>({
    isSwapping: false,
    step: 'idle'
  })

  // Single execution lock
  const isExecutingRef = useRef(false)
  const lastCallTimeRef = useRef(0)
  
  // Callback for external cleanup (like global locks)
  const onSwapCompleteRef = useRef<(() => void) | null>(null)

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
      setSwapState({
        isSwapping: false,
        swapHash: hash,
        step: 'success'
      })
      toast.success('Swap completed successfully!', {
        description: `Transaction: ${hash.slice(0, 10)}...${hash.slice(-8)}`
      })
      
      // Notify external cleanup
      if (onSwapCompleteRef.current) {
        onSwapCompleteRef.current()
      }
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

  // Set cleanup callback
  const setOnSwapComplete = useCallback((callback: (() => void) | null) => {
    onSwapCompleteRef.current = callback
  }, [])

  // Reset swap state
  const resetSwapState = useCallback(() => {
    // Only reset if not currently swapping
    if (!isExecutingRef.current && !swapMutation.isPending) {
      setSwapState({
        isSwapping: false,
        step: 'idle'
      })
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
    setOnSwapComplete
  }
} 