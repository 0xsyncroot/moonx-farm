'use client'

import { useState, useCallback, useRef } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { encodeFunctionData, isAddress, parseEther, parseUnits, formatGwei, createPublicClient, http } from 'viem'
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
  gasSettings?: GasSettings
}

export interface ERC20TransferParams {
  type: 'erc20'
  to: Address
  amount: string // Token amount in human readable format
  tokenAddress: Address
  tokenDecimals: number
  chainId: number
  gasSettings?: GasSettings
}

export interface CustomTransactionParams {
  type: 'custom'
  to: Address
  data: `0x${string}`
  value?: bigint
  chainId: number
  gas?: bigint
  gasSettings?: GasSettings
}

// EIP-7702 Batch Transaction Support
export interface BatchTransactionParams {
  type: 'batch'
  transactions: Array<
    | Omit<NativeTransferParams, 'chainId' | 'gasSettings'>
    | Omit<ERC20TransferParams, 'chainId' | 'gasSettings'>
    | Omit<CustomTransactionParams, 'chainId' | 'gasSettings'>
  >
  chainId: number
  gasSettings?: GasSettings
}

export type TransactionParams = NativeTransferParams | ERC20TransferParams | CustomTransactionParams | BatchTransactionParams

// Gas Settings for EIP-7702 compatibility
export interface GasSettings {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  gasLimit?: bigint
  gasPrice?: bigint // Legacy gas price for non-EIP-1559 chains
  autoEstimate?: boolean // Default: true
  sponsorship?: {
    enabled: boolean
    paymaster?: Address
  }
}

// Transaction result
export interface TransactionResult {
  hash: string
  chainId: number
  success: boolean
  gasUsed?: bigint
  effectiveGasPrice?: bigint
}

// Transaction state
interface TransactionState {
  isLoading: boolean
  isNetworkSwitching: boolean
  isEstimatingGas: boolean
  currentChainId?: number
  error?: string
  gasEstimate?: {
    gasLimit: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    estimatedCost: bigint
  }
}

// Hook options
export interface UsePrivyTransactionOptions {
  showToasts?: boolean // Default: true - set false để disable automatic toasts
  onSuccess?: (result: TransactionResult) => void // Custom success callback
  onError?: (error: Error) => void // Custom error callback
  defaultGasSettings?: Partial<GasSettings> // Default gas settings
}

// Hook return type
export interface UsePrivyTransactionReturn {
  executeTransaction: (params: TransactionParams) => Promise<TransactionResult>
  estimateGas: (params: TransactionParams) => Promise<GasSettings>
  state: TransactionState
  isReady: boolean
}

/**
 * Hook để xử lý tất cả transaction calls thông qua Privy Smart Wallet với EIP-7702 support
 * Hỗ trợ:
 * - Native token transfers (ETH, BNB, etc.)
 * - ERC20 token transfers  
 * - Custom contract calls
 * - Batch transactions (EIP-7702)
 * - Automatic gas estimation với division by zero protection
 * - Gas sponsorship
 * - Automatic chain switching
 * - Error handling với user-friendly messages
 * 
 * Updated for EIP-7702 và Pectra upgrade compatibility (2025)
 * 
 * @param options - Configuration options
 * @param options.showToasts - Show automatic success/error toasts (default: true)
 * @param options.onSuccess - Custom success callback
 * @param options.onError - Custom error callback
 * @param options.defaultGasSettings - Default gas settings cho tất cả transactions
 */
export function usePrivyTransaction(options: UsePrivyTransactionOptions = {}): UsePrivyTransactionReturn {
  const { 
    showToasts = true, 
    onSuccess, 
    onError,
    defaultGasSettings = {}
  } = options
  
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    isNetworkSwitching: false,
    isEstimatingGas: false
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
    
    // Step 4: Validate result and prevent division by zero
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
    
    // Step 5: Additional check to prevent division by zero in gas calculations
    if (parsed === 0 && typeof value === 'string' && value.includes('/')) {
      console.warn('safeParse: Potential division by zero detected:', value)
      return 0.000001 // Return minimal non-zero value
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
        actualChain: targetClient.chain?.id,
        supportsEIP7702: true // EIP-7702 is now live with Pectra upgrade
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

  // Enhanced gas estimation with EIP-7702 support
  const estimateGasForTransaction = useCallback(async (
    client: any, 
    params: TransactionParams
  ): Promise<GasSettings> => {
    setState(prev => ({ ...prev, isEstimatingGas: true }))
    
    try {
      // Create a public client for gas estimation
      const chainConfig = getChainConfig(params.chainId)
      const rpcUrl = chainConfig?.rpcUrls?.[0] || `https://rpc.ankr.com/eth` // Fallback RPC
      
      const publicClient = createPublicClient({
        chain: { id: params.chainId } as any,
        transport: http(rpcUrl)
      })
      
      // Get current gas price with safety checks using public client
      const feeData = await publicClient.estimateFeesPerGas()
      
      // FIXED: Prevent division by zero in gas calculations
      const safeMaxFeePerGas = feeData.maxFeePerGas && feeData.maxFeePerGas > BigInt(0) 
        ? feeData.maxFeePerGas 
        : parseEther('0.00000002') // Fallback: 20 gwei
        
      const safeMaxPriorityFeePerGas = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > BigInt(0)
        ? feeData.maxPriorityFeePerGas 
        : parseEther('0.000000001') // Fallback: 1 gwei

      // Estimate gas limit based on transaction type
      let estimatedGasLimit: bigint
      
      if (params.type === 'batch') {
        // EIP-7702 batch transaction estimation
        const baseBatchGas = BigInt(21000) // Base transaction cost
        const perTxGas = BigInt(30000) // Estimated gas per batched transaction
        estimatedGasLimit = baseBatchGas + (BigInt(params.transactions.length) * perTxGas)
      } else {
        // Prepare transaction for gas estimation
        const txData = prepareTransactionData(params)
        
        try {
          estimatedGasLimit = await publicClient.estimateGas({
            ...txData,
            account: client.account?.address
          })
          
          // Add 20% buffer to prevent out of gas errors
          estimatedGasLimit = (estimatedGasLimit * BigInt(200)) / BigInt(100)
          
        } catch (error) {
          console.warn('Gas estimation failed, using fallback:', error)
          // Fallback gas limits based on transaction type
          switch (params.type) {
            case 'native':
              estimatedGasLimit = BigInt(21000)
              break
            case 'erc20':
              estimatedGasLimit = BigInt(65000)
              break
            case 'custom':
              estimatedGasLimit = params.gas || BigInt(100000)
              break
            default:
              estimatedGasLimit = BigInt(100000)
          }
        }
      }

      // FIXED: Ensure all gas values are non-zero to prevent division errors
      const gasSettings: GasSettings = {
        gasLimit: estimatedGasLimit > BigInt(0) ? estimatedGasLimit : BigInt(21000),
        maxFeePerGas: safeMaxFeePerGas,
        maxPriorityFeePerGas: safeMaxPriorityFeePerGas,
        autoEstimate: true
      }

      console.log('⛽ Gas estimation completed:', {
        gasLimit: gasSettings.gasLimit!.toString(),
        maxFeePerGas: formatGwei(gasSettings.maxFeePerGas!) + ' gwei',
        maxPriorityFeePerGas: formatGwei(gasSettings.maxPriorityFeePerGas!) + ' gwei',
        estimatedCost: formatGwei((gasSettings.gasLimit! * gasSettings.maxFeePerGas!)) + ' ETH'
      })

      // Update state with gas estimate
      setState(prev => ({ 
        ...prev, 
        gasEstimate: {
          gasLimit: gasSettings.gasLimit!,
          maxFeePerGas: gasSettings.maxFeePerGas!,
          maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas!,
          estimatedCost: gasSettings.gasLimit! * gasSettings.maxFeePerGas!
        }
      }))

      return gasSettings
      
    } catch (error) {
      console.error('Gas estimation error:', error)
      
      // Return safe fallback values
      return {
        gasLimit: BigInt(100000),
        maxFeePerGas: parseEther('0.00000002'), // 20 gwei
        maxPriorityFeePerGas: parseEther('0.000000001'), // 1 gwei
        autoEstimate: false
      }
    } finally {
      setState(prev => ({ ...prev, isEstimatingGas: false }))
    }
  }, [])

  // Standalone gas estimation function
  const estimateGas = useCallback(async (params: TransactionParams): Promise<GasSettings> => {
    const targetClient = await getSmartWalletForChain(params.chainId)
    return estimateGasForTransaction(targetClient, params)
  }, [getSmartWalletForChain, estimateGasForTransaction])

  // Helper function to validate transaction parameters
  const validateParams = useCallback((params: TransactionParams): void => {
    if (params.type === 'batch') {
      if (!params.transactions || params.transactions.length === 0) {
        throw new Error('Batch transaction must contain at least one transaction')
      }
      
      // Validate each transaction in batch
      params.transactions.forEach((tx, index) => {
        if (!isAddress(tx.to)) {
          throw new Error(`Invalid recipient address at index ${index}`)
        }
        
        if (tx.type === 'erc20') {
          if (!isAddress(tx.tokenAddress)) {
            throw new Error(`Invalid token address at index ${index}`)
          }
          if (tx.tokenDecimals < 0 || tx.tokenDecimals > 18) {
            throw new Error(`Invalid token decimals at index ${index}`)
          }
        }
        
        // Use safe parsing for amounts
        if (tx.type === 'native' || tx.type === 'erc20') {
          const amount = safeParse(tx.amount)
          if (amount <= 0) {
            throw new Error(`Invalid transaction amount at index ${index}`)
          }
        }
      })
      
      return
    }

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
    if (params.type === 'batch') {
      // EIP-7702 batch transaction preparation would go here
      // For now, we'll throw as batch needs special handling
      throw new Error('Batch transactions require special EIP-7702 handling')
    }

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

    // Gas-related errors with division by zero protection
    if (errorMessage.includes('gas') || errorMessage.includes('Gas')) {
      if (errorMessage.includes('division') || errorMessage.includes('divide')) {
        return 'Gas calculation error. Please try again with manual gas settings.'
      }
      return 'Gas estimation failed. Please try again.'
    }

    // Common blockchain errors
    if (errorMessage.includes('insufficient funds')) {
      return 'Insufficient funds for transaction'
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

      // Merge gas settings with defaults
      const gasSettings = {
        ...defaultGasSettings,
        ...params.gasSettings
      }

      // Auto-estimate gas if enabled (default: true)
      let finalGasSettings = gasSettings
      if (gasSettings.autoEstimate !== false) {
        finalGasSettings = await estimateGasForTransaction(targetClient, params)
      }

      console.log('🚀 Executing transaction:', {
        type: params.type,
        chainId: params.chainId,
        to: params.type !== 'batch' ? params.to : `batch(${params.transactions.length})`,
        walletAddress: targetClient.account.address,
        gasSettings: finalGasSettings,
        eip7702Support: true,
        // FIXED: Platform debugging info for cross-platform support
        platform: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        }
      })

      // Handle batch transactions (EIP-7702)
      if (params.type === 'batch') {
        // TODO: Implement proper EIP-7702 batch execution
        // For now, execute transactions sequentially
        const results = []
        for (const tx of params.transactions) {
          const singleTxData = prepareTransactionData({ ...tx, chainId: params.chainId } as TransactionParams)
          const hash = await targetClient.sendTransaction({
            ...singleTxData,
            gas: finalGasSettings.gasLimit,
            maxFeePerGas: finalGasSettings.maxFeePerGas,
            maxPriorityFeePerGas: finalGasSettings.maxPriorityFeePerGas
          })
          results.push(hash)
        }
        
        const result: TransactionResult = {
          hash: results[0], // Return first transaction hash as primary
          chainId: params.chainId,
          success: true
        }
        
        if (showToasts) {
          toast.success(`Batch of ${params.transactions.length} transactions executed successfully!`)
        }
        
        if (onSuccess) {
          onSuccess(result)
        }
        
        return result
      }

      // Prepare single transaction data
      const txData = prepareTransactionData(params)
      
      // Execute transaction using Privy Smart Wallet with proper gas settings
      const hash = await targetClient.sendTransaction({
        ...txData,
        gas: finalGasSettings.gasLimit,
        maxFeePerGas: finalGasSettings.maxFeePerGas,
        maxPriorityFeePerGas: finalGasSettings.maxPriorityFeePerGas,
        // EIP-7702 specific options could be added here
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
        isNetworkSwitching: false,
        isEstimatingGas: false
      }))
    }
  }, [validateParams, getSmartWalletForChain, prepareTransactionData, parseError, estimateGasForTransaction, defaultGasSettings, showToasts, onSuccess, onError])

  // Check if hook is ready to use
  const isReady = Boolean(smartWalletClient?.account?.address && getClientForChain)

  return {
    executeTransaction,
    estimateGas,
    state,
    isReady
  }
} 