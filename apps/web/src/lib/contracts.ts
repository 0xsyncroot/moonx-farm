import { Address, encodeFunctionData, parseAbi } from 'viem'
import { ethers } from 'ethers'

// Diamond Contract ABIs for each facet
export const DIAMOND_ABIS = {
  LifiProxyFacet: parseAbi([
    'function callLifi(uint256 fromTokenWithFee, uint256 fromAmt, uint256 toTokenWithFee, bytes calldata callData) external payable'
  ]),
  OneInchProxyFacet: parseAbi([
    'function callOneInch(uint256 fromTokenWithFee, uint256 fromAmt, uint256 toTokenWithFee, bytes calldata callData) external payable'
  ]),
  RelayProxyFacet: parseAbi([
    'function callRelay(uint256 fromTokenWithFee, uint256 fromAmt, uint256 toTokenWithFee, bytes calldata callData) external payable'
  ]),
  ERC20: parseAbi([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)'
  ])
}

// Contract addresses per chain
export const DIAMOND_ADDRESSES: Record<number, Address> = {
  1: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_ETHEREUM as Address) || '0x0000000000000000000000000000000000000000', // Ethereum
  8453: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_BASE as Address) || '0x0000000000000000000000000000000000000000', // Base
  56: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_BSC as Address) || '0x0000000000000000000000000000000000000000', // BSC
  137: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_POLYGON as Address) || '0x0000000000000000000000000000000000000000', // Polygon
  42161: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_ARBITRUM as Address) || '0x0000000000000000000000000000000000000000', // Arbitrum
  10: (process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_OPTIMISM as Address) || '0x0000000000000000000000000000000000000000', // Optimism
}

// Native token addresses (for gas calculations)
export const NATIVE_TOKEN_ADDRESSES: Record<number, Address> = {
  1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  8453: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH on Base
  56: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // BNB
}

export interface SwapParams {
  fromToken: Address
  toToken: Address
  fromAmount: bigint
  toAmount: bigint
  provider: string
  callData: string
  value: string
  chainId: number
  userAddress: Address
}

export class PrivyContractSwapExecutor {
  private isExecuting = false
  private currentOperationId: string | null = null

  private setExecutionLock(operationId: string): boolean {
    if (this.isExecuting) {
      console.warn('🚫 [PrivyContractSwapExecutor] Operation rejected: already executing', this.currentOperationId)
      return false
    }
    this.isExecuting = true
    this.currentOperationId = operationId
    return true
  }

  private releaseExecutionLock(): void {
    this.isExecuting = false
    this.currentOperationId = null
  }

  private getDiamondAddress(chainId: number): Address {
    const address = DIAMOND_ADDRESSES[chainId]
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Diamond contract not deployed on chain ${chainId}`)
    }
    return address
  }

  private getFacetFunction(provider: string): 'callLifi' | 'callOneInch' | 'callRelay' {
    switch (provider.toLowerCase()) {
      case 'lifi':
        return 'callLifi'
      case '1inch':
      case 'oneinch':
        return 'callOneInch'
      case 'relay':
        return 'callRelay'
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private getFacetAbi(provider: string) {
    switch (provider.toLowerCase()) {
      case 'lifi':
        return DIAMOND_ABIS.LifiProxyFacet
      case '1inch':
      case 'oneinch':
        return DIAMOND_ABIS.OneInchProxyFacet
      case 'relay':
        return DIAMOND_ABIS.RelayProxyFacet
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private isNativeToken(token: Address, chainId: number): boolean {
    const nativeAddresses = [
      '0x0000000000000000000000000000000000000000', // Zero address
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Common native token placeholder
      NATIVE_TOKEN_ADDRESSES[chainId]?.toLowerCase()
    ].filter(Boolean).map(addr => addr.toLowerCase())
    
    const isNative = nativeAddresses.includes(token.toLowerCase())
    return isNative
  }

  private calculateTokenWithFee(
    token: Address, 
    amount: bigint, 
    chainId: number,
    feePercent: number = 0 // 🔧 TEMP: Set to 0 to match test script
  ): { tokenWithFee: bigint; feeAmount: bigint } {
    // Convert fee percentage to basis points (0% = 0 basis points)
    const feeBasisPoints = Math.floor(feePercent * 10000)
    
    // Handle native token addresses properly
    let tokenAddress: bigint
    if (this.isNativeToken(token, chainId)) {
      // For native tokens, use zero address as in test script
      tokenAddress = BigInt('0x0000000000000000000000000000000000000000')
    } else {
      // For ERC20 tokens, use the actual address
      tokenAddress = BigInt(token)
    }
    
    // Encode token address with fee: (fee << 160) | address
    // Since fee = 0, this will just be the token address
    const feeShifted = BigInt(feeBasisPoints) << BigInt(160)
    const tokenWithFee = feeShifted | tokenAddress
    
    // Calculate fee amount (will be 0)
    const feeAmount = (amount * BigInt(feeBasisPoints)) / BigInt(10000)
    
    return {
      tokenWithFee,
      feeAmount
    }
  }

  async checkAndApproveToken(
    smartWalletClient: any, // Privy smart wallet client
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    chainId: number
  ): Promise<string | null> {
    try {
      // Use ethers v6 to check current allowance
      const rpcUrl = this.getRpcUrl(chainId)
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) external view returns (uint256)'],
        provider
      )

      const currentAllowance = await tokenContract.allowance(
        smartWalletClient.account.address,
        spenderAddress
      )

      // If allowance is sufficient, no approval needed
      if (BigInt(currentAllowance.toString()) >= amount) {
        return null
      }

      // Need approval - prepare transaction
      const approvalData = encodeFunctionData({
        abi: DIAMOND_ABIS.ERC20,
        functionName: 'approve',
        args: [spenderAddress, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')], // MAX_UINT256
      })

      // Send approval transaction
      let approvalHash: string
      try {
        approvalHash = await smartWalletClient.sendTransaction({
          to: tokenAddress,
          data: approvalData,
          value: BigInt(0),
        })
      } catch (txError) {
        // Check if user cancelled
        const errorMessage = txError instanceof Error ? txError.message : String(txError)
        if (this.isUserCancellation(errorMessage)) {
          throw new Error('USER_CANCELLED_APPROVAL')
        }
        throw txError
      }

      // Wait for approval transaction to be confirmed
      const maxWaitTime = 30000 // 30 seconds
      const pollInterval = 2000 // 2 seconds
      let waitedTime = 0
      
      while (waitedTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        waitedTime += pollInterval
        
        try {
          // Check if allowance has been updated
          const newAllowance = await tokenContract.allowance(
            smartWalletClient.account.address,
            spenderAddress
          )
          
          if (BigInt(newAllowance.toString()) >= amount) {
            return approvalHash
          }
        } catch (checkError) {
          // Continue waiting
        }
      }
      
      // Timeout - but approval transaction was sent
      return approvalHash
    } catch (error) {
      // Check if user cancelled the transaction
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'USER_CANCELLED_APPROVAL' || this.isUserCancellation(errorMessage)) {
        throw new Error('USER_CANCELLED_APPROVAL')
      }
      
      throw new Error(`Failed to approve token: ${errorMessage}`)
    }
  }

  // Helper function to detect user cancellation
  private isUserCancellation(errorMessage: string): boolean {
    const cancellationKeywords = [
      'user rejected',
      'user denied',
      'user cancelled',
      'transaction cancelled',
      'user abort',
      'rejected by user',
      'cancelled by user',
      'transaction rejected',
      'actionRejected',
      'ACTION_REJECTED',
      'User rejected the request',
      'User cancelled the transaction'
    ]
    
    const lowerErrorMessage = errorMessage.toLowerCase()
    return cancellationKeywords.some(keyword => 
      lowerErrorMessage.includes(keyword.toLowerCase())
    )
  }

  private getRpcUrl(chainId: number): string {
    switch (chainId) {
      case 1: // Ethereum
        return process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com'
      case 8453: // Base
        return process.env.NEXT_PUBLIC_BASE_RPC || 'https://base.llamarpc.com'
      case 56: // BSC
        return process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed1.binance.org'
      case 137: // Polygon
        return process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon.llamarpc.com'
      case 11155111: // Sepolia
        return 'https://eth-sepolia.g.alchemy.com/v2/demo'
      case 84532: // Base Sepolia
        return 'https://sepolia.base.org'
      case 97: // BSC Testnet
        return 'https://data-seed-prebsc-1-s1.binance.org:8545'
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`)
    }
  }

  async executeSwap(
    smartWalletClient: any, // Privy smart wallet client
    params: SwapParams
  ): Promise<string> {
    const operationId = `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Global execution lock to prevent any concurrent operations
    if (!this.setExecutionLock(operationId)) {
      throw new Error('Another swap operation is already in progress')
    }

    try {
      const diamondAddress = this.getDiamondAddress(params.chainId)
      const facetFunction = this.getFacetFunction(params.provider)

      // Calculate fees and encode token addresses with fee
      const { tokenWithFee: fromTokenWithFee } = 
        this.calculateTokenWithFee(params.fromToken, params.fromAmount, params.chainId)
      
      const { tokenWithFee: toTokenWithFee } = 
        this.calculateTokenWithFee(params.toToken, params.toAmount, params.chainId)

      // Check if we need to approve tokens
      const isFromNative = this.isNativeToken(params.fromToken, params.chainId)
      
      // CRITICAL: Handle approval first if needed
      if (!isFromNative) {
        const approvalHash = await this.checkAndApproveToken(
          smartWalletClient,
          params.fromToken,
          diamondAddress,
          params.fromAmount,
          params.chainId
        )
        
        if (approvalHash) {
          // Approval completed successfully
        }
      }

      // Encode the facet function call
      const facetAbi = this.getFacetAbi(params.provider)
      const swapCallData = encodeFunctionData({
        abi: facetAbi,
        functionName: facetFunction,
        args: [
          fromTokenWithFee,
          params.fromAmount,
          toTokenWithFee,
          params.callData as `0x${string}`
        ],
      })

      // Send swap transaction - FIXED: Smart fallback to prevent double modals
      let hash: string
      try {
        hash = await smartWalletClient.sendTransaction({
          to: diamondAddress,
          data: swapCallData,
          value: BigInt(params.value),
          gas: BigInt(500000),
        })
      } catch (swapError) {
        // Check if user cancelled the swap transaction
        const swapErrorMessage = swapError instanceof Error ? swapError.message : String(swapError)
        if (this.isUserCancellation(swapErrorMessage)) {
          throw new Error('Transaction cancelled by user')
        }
        throw swapError
      }

      return hash
    } catch (error) {
      // Check if it's a user cancellation
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'Transaction cancelled by user' || this.isUserCancellation(errorMessage)) {
        throw new Error('Transaction cancelled by user')
      }
      
      // Parse AA wallet specific errors
      if (errorMessage.includes('UserOperation reverted')) {
        if (errorMessage.includes('0x5274afe7')) {
          throw new Error('Swap failed: Insufficient output amount or slippage too high')
        }
        throw new Error(`Swap failed: Smart wallet simulation error - ${errorMessage}`)
      }
      
      throw new Error(`Swap failed: ${errorMessage}`)
    } finally {
      // Always release the execution lock
      this.releaseExecutionLock()
    }
  }

  // Utility method to get provider from quote
  static getProviderFromQuote(quote: any): string {
    // The quote provider field tells us which aggregator to use
    const provider = quote.provider?.toLowerCase()
    
    // Map provider names to our facet functions
    switch (provider) {
      case 'lifi':
      case 'li.fi':
        return 'lifi'
      case '1inch':
      case 'oneinch':
      case '1inch_v5':
        return '1inch'
      case 'relay':
      case 'relay.link':
        return 'relay'
      default:
        throw new Error(`Unsupported provider in quote: ${provider}`)
    }
  }
}

// Export singleton instance
export const privyContractSwapExecutor = new PrivyContractSwapExecutor()

// Helper function to prepare swap parameters from quote
export function prepareSwapFromQuote(
  quote: any,
  userAddress: Address
): SwapParams {
  const swapParams = {
    fromToken: quote.fromToken.address as Address,
    toToken: quote.toToken.address as Address,
    fromAmount: BigInt(quote.fromAmount),
    toAmount: BigInt(quote.toAmount),
    provider: PrivyContractSwapExecutor.getProviderFromQuote(quote),
    callData: quote.callData,
    value: quote.value,
    chainId: quote.fromToken.chainId,
    userAddress,
  }
  
  return swapParams
} 