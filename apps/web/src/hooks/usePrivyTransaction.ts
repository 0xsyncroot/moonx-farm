'use client'

import { useState, useCallback, useRef } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { encodeFunctionData, isAddress, parseEther, parseUnits } from 'viem'
import { toast } from 'react-hot-toast'
import { getChainConfig } from '@/config/chains'
import type { Address } from 'viem'

// ERC20 ABI for token transfers
const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

// Transaction types
export interface NativeTransferParams {
  type: 'native'
  to: Address
  amount: string // ETH amount in ether (e.g., "0.1")
  chainId: number
}

export interface ERC20TransferParams {
  type: 'erc20'
  to: Address
  amount: string // Token amount in human readable format
  tokenAddress: Address
  tokenDecimals: number
  chainId: number
}

export interface CustomTransactionParams {
  type: 'custom'
  to: Address
  data: `0x${string}`
  value?: bigint
  chainId: number
  gas?: bigint
}

export type TransactionParams = NativeTransferParams | ERC20TransferParams | CustomTransactionParams

// Transaction result
export interface TransactionResult {
  hash: string
  chainId: number
  success: boolean
}

// Transaction state
interface TransactionState {
  isLoading: boolean
  isNetworkSwitching: boolean
  currentChainId?: number
  error?: string
}

// Hook options
export interface UsePrivyTransactionOptions {
  showToasts?: boolean // Default: true - set false để disable automatic toasts
  onSuccess?: (result: TransactionResult) => void // Custom success callback
  onError?: (error: Error) => void // Custom error callback
}

// Hook return type
export interface UsePrivyTransactionReturn {
  executeTransaction: (params: TransactionParams) => Promise<TransactionResult>
  state: TransactionState
  isReady: boolean
}

/**
 * Hook để xử lý tất cả transaction calls thông qua Privy Smart Wallet
 * Hỗ trợ:
 * - Native token transfers (ETH, BNB, etc.)
 * - ERC20 token transfers
 * - Custom contract calls
 * - Automatic chain switching
 * - Error handling với user-friendly messages
 * 
 * Sử dụng Privy Smart Wallet API mới nhất (2025)
 * 
 * @param options - Configuration options
 * @param options.showToasts - Show automatic success/error toasts (default: true)
 * @param options.onSuccess - Custom success callback
 * @param options.onError - Custom error callback
 */
export function usePrivyTransaction(options: UsePrivyTransactionOptions = {}): UsePrivyTransactionReturn {
  const { 
    showToasts = true, 
    onSuccess, 
    onError 
  } = options
  
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    isNetworkSwitching: false
  })
  
  // Prevent multiple concurrent transactions
  const isExecutingRef = useRef(false)

  // FIXED: Platform-safe number parsing để prevent Mac/Windows differences [[memory:3509624]]
  const safeParse = useCallback((value: string | number): number => {
    if (!value) return 0
    
    // Convert to string for processing
    const stringValue = value.toString()
    if (stringValue.trim() === '') return 0
    
    // Step 1: Normalize the string by removing all characters except digits, dots, and minus
    let normalized = stringValue.replace(/[^\d.-]/g, '')
    
    // Step 2: Handle multiple dots - keep only the last one as decimal separator
    const dotIndex = normalized.lastIndexOf('.')
    if (dotIndex !== -1) {
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
    
    return parsed
  }, [])

  // Helper function to get smart wallet client for specific chain
  const getSmartWalletForChain = useCallback(async (chainId: number) => {
    if (!getClientForChain) {
      throw new Error('Smart wallet client not available')
    }

    try {
      setState(prev => ({ ...prev, isNetworkSwitching: true }))
      
      // Use getClientForChain to automatically handle chain switching
      const targetClient = await getClientForChain({ id: chainId })
      
      if (!targetClient) {
        throw new Error(`Failed to get smart wallet client for chain ${chainId}`)
      }

      console.log('✅ Smart wallet client ready for chain:', {
        chainId,
        address: targetClient.account?.address,
        actualChain: targetClient.chain?.id
      })

      setState(prev => ({ 
        ...prev, 
        currentChainId: chainId,
        isNetworkSwitching: false 
      }))

      return targetClient
    } catch (error) {
      setState(prev => ({ ...prev, isNetworkSwitching: false }))
      throw error
    }
  }, [getClientForChain])

  // Helper function to validate transaction parameters
  const validateParams = useCallback((params: TransactionParams): void => {
    if (!isAddress(params.to)) {
      throw new Error('Invalid recipient address')
    }

    if (params.type === 'erc20') {
      if (!isAddress(params.tokenAddress)) {
        throw new Error('Invalid token address')
      }
      if (params.tokenDecimals < 0 || params.tokenDecimals > 18) {
        throw new Error('Invalid token decimals')
      }
    }

    // FIXED: Use safe parsing for amount validation
    if (params.type === 'native' || params.type === 'erc20') {
      const amount = safeParse(params.amount)
      if (amount <= 0) {
        throw new Error('Invalid transaction amount')
      }
    }
  }, [safeParse])

  // Helper function to prepare transaction data
  const prepareTransactionData = useCallback((params: TransactionParams) => {
    switch (params.type) {
      case 'native':
        // FIXED: Use safeParse để ensure consistent parsing across platforms
        const ethAmount = safeParse(params.amount)
        return {
          to: params.to,
          value: parseEther(ethAmount.toString()),
          data: '0x' as const
        }

      case 'erc20':
        // FIXED: Use safeParse và handle edge cases for decimals
        const tokenAmount = safeParse(params.amount)
        const transferAmount = params.tokenDecimals === 0 
          ? BigInt(Math.floor(tokenAmount))
          : parseUnits(tokenAmount.toString(), params.tokenDecimals)
        
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [params.to, transferAmount]
        })

        return {
          to: params.tokenAddress,
          value: BigInt(0),
          data
        }

      case 'custom':
        return {
          to: params.to,
          value: params.value || BigInt(0),
          data: params.data,
          ...(params.gas && { gas: params.gas })
        }

      default:
        throw new Error('Unsupported transaction type')
    }
  }, [safeParse])

  // Helper function to get user-friendly error messages
  const parseError = useCallback((error: any): string => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // User cancellation
    const cancellationKeywords = [
      'user rejected', 'user denied', 'user cancelled', 'transaction cancelled',
      'user abort', 'rejected by user', 'cancelled by user', 'transaction rejected',
      'actionRejected', 'ACTION_REJECTED'
    ]
    
    if (cancellationKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    )) {
      return 'Transaction cancelled by user'
    }

    // Smart wallet specific errors
    if (errorMessage.includes('UserOperation reverted')) {
      if (errorMessage.includes('0x5274afe7')) {
        return 'Transaction failed: Insufficient balance or slippage too high'
      }
      return 'Transaction failed: Smart wallet simulation error'
    }

    // Common blockchain errors
    if (errorMessage.includes('insufficient funds')) {
      return 'Insufficient funds for transaction'
    }
    
    if (errorMessage.includes('gas')) {
      return 'Gas estimation failed. Please try again.'
    }

    if (errorMessage.includes('network')) {
      return 'Network error. Please check your connection.'
    }

    return `Transaction failed: ${errorMessage}`
  }, [])

  // Main transaction execution function
  const executeTransaction = useCallback(async (params: TransactionParams): Promise<TransactionResult> => {
    // Prevent concurrent transactions
    if (isExecutingRef.current) {
      throw new Error('Another transaction is already in progress')
    }

    isExecutingRef.current = true
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: undefined 
    }))

    try {
      // Validate parameters
      validateParams(params)

      // Get smart wallet client for target chain
      const targetClient = await getSmartWalletForChain(params.chainId)
      
      if (!targetClient?.account?.address) {
        throw new Error('Smart wallet not connected')
      }

      // Prepare transaction data
      const txData = prepareTransactionData(params)
      
      console.log('🚀 Executing transaction:', {
        type: params.type,
        chainId: params.chainId,
        to: params.to,
        walletAddress: targetClient.account.address,
        // FIXED: Platform debugging info for cross-platform support
        platform: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        }
      })

      // Execute transaction using Privy Smart Wallet
      const hash = await targetClient.sendTransaction({
        ...txData,
        // Optional: Set gas limit for better reliability
        ...(params.type === 'custom' && params.gas ? { gas: params.gas } : {})
      })

      console.log('✅ Transaction submitted:', hash)

      const result: TransactionResult = {
        hash,
        chainId: params.chainId,
        success: true
      }

      // Show success feedback with explorer link (only if showToasts enabled)
      if (showToasts) {
        const chainConfig = getChainConfig(params.chainId)
        if (chainConfig?.explorer) {
          toast.success(
            `Transaction submitted! View: ${chainConfig.explorer}/tx/${hash}`,
            { duration: 5000 }
          )
        } else {
          toast.success('Transaction submitted successfully!')
        }
      }

      // Call custom success callback if provided
      if (onSuccess) {
        onSuccess(result)
      }

      return result

    } catch (error) {
      const friendlyError = parseError(error)
      console.error('❌ Transaction failed:', error)
      
      setState(prev => ({ ...prev, error: friendlyError }))
      
      // Show error toast only if showToasts enabled
      if (showToasts) {
        toast.error(friendlyError)
      }
      
      // Call custom error callback if provided
      const errorObj = new Error(friendlyError)
      if (onError) {
        onError(errorObj)
      }
      
      throw errorObj
    } finally {
      isExecutingRef.current = false
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isNetworkSwitching: false 
      }))
    }
  }, [validateParams, getSmartWalletForChain, prepareTransactionData, parseError])

  // Check if hook is ready to use
  const isReady = Boolean(smartWalletClient?.account?.address && getClientForChain)

  return {
    executeTransaction,
    state,
    isReady
  }
} 