import { useState } from 'react'
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
  step: 'idle' | 'approving' | 'swapping' | 'success' | 'error'
}

export function useSwap() {
  const { client: smartWalletClient } = useSmartWallets()
  
  const [swapState, setSwapState] = useState<SwapState>({
    isSwapping: false,
    step: 'idle'
  })

  const swapMutation = useMutation({
    mutationFn: async (quote: Quote) => {
      if (!smartWalletClient) {
        throw new Error('Smart wallet not available')
      }
      
      if (!smartWalletClient.account?.address) {
        throw new Error('Smart wallet not connected')
      }

      // Prepare swap parameters from quote
      const swapParams = prepareSwapFromQuote(quote, smartWalletClient.account.address)
      
      setSwapState({
        isSwapping: true,
        step: 'approving'
      })

      try {
        // Execute the swap through diamond contract using Privy smart wallet
        const swapHash = await privyContractSwapExecutor.executeSwap(
          smartWalletClient,
          swapParams
        )
        
        setSwapState({
          isSwapping: true,
          swapHash,
          step: 'swapping'
        })

        // For Privy smart wallets, we don't need to manually wait for receipt
        // The transaction is considered successful when hash is returned
        setSwapState({
          isSwapping: false,
          swapHash,
          step: 'success'
        })
        
        toast.success('Swap completed successfully!', {
          description: `Transaction: ${swapHash}`,
          action: {
            label: 'View',
            onClick: () => {
              const explorerUrl = getExplorerUrl(swapParams.chainId, swapHash)
              window.open(explorerUrl, '_blank')
            }
          }
        })

        return swapHash
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Swap failed'
        
        setSwapState({
          isSwapping: false,
          error: errorMessage,
          step: 'error'
        })

        toast.error('Swap failed', {
          description: errorMessage
        })
        
        throw error
      }
    },
    onSuccess: (hash) => {
      console.log('Swap successful:', hash)
    },
    onError: (error) => {
      console.error('Swap failed:', error)
    }
  })

  const executeSwap = (quote: Quote) => {
    return swapMutation.mutateAsync(quote)
  }

  const resetSwapState = () => {
    setSwapState({
      isSwapping: false,
      step: 'idle'
    })
  }

  return {
    // State
    swapState,
    isSwapping: swapState.isSwapping || swapMutation.isPending,
    
    // Actions
    executeSwap,
    resetSwapState,
    
    // Computed
    canSwap: !!smartWalletClient?.account?.address && !swapState.isSwapping,
  }
}

// Helper function to get explorer URL
function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    56: 'https://bscscan.com/tx/',
  }
  
  return (explorers[chainId] || 'https://etherscan.io/tx/') + hash
} 