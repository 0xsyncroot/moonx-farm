import { Address, encodeFunctionData, parseAbi } from 'viem'

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
    return token.toLowerCase() === NATIVE_TOKEN_ADDRESSES[chainId]?.toLowerCase()
  }

  private calculateTokenWithFee(
    token: Address, 
    amount: bigint, 
    chainId: number,
    feePercent: number = 0.003 // 0.3% default fee
  ): { tokenWithFee: bigint; feeAmount: bigint } {
    const isNative = this.isNativeToken(token, chainId)
    
    // For native tokens, include fee in the amount calculation
    if (isNative) {
      const feeAmount = (amount * BigInt(Math.floor(feePercent * 10000))) / BigInt(10000)
      return {
        tokenWithFee: amount + feeAmount,
        feeAmount
      }
    }
    
    // For ERC20 tokens, fee is calculated separately
    const feeAmount = (amount * BigInt(Math.floor(feePercent * 10000))) / BigInt(10000)
    return {
      tokenWithFee: amount,
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
      // Check current allowance using Privy client
      const allowanceData = encodeFunctionData({
        abi: DIAMOND_ABIS.ERC20,
        functionName: 'allowance',
        args: [smartWalletClient.account.address as Address, spenderAddress],
      })

      const allowanceResult = await smartWalletClient.readContract({
        address: tokenAddress,
        abi: DIAMOND_ABIS.ERC20,
        functionName: 'allowance',
        args: [smartWalletClient.account.address, spenderAddress],
      })

      // If allowance is sufficient, no approval needed
      if (allowanceResult >= amount) {
        return null
      }

      // Approve token spending using Privy smart wallet
      const approvalData = encodeFunctionData({
        abi: DIAMOND_ABIS.ERC20,
        functionName: 'approve',
        args: [spenderAddress, amount],
      })

      const hash = await smartWalletClient.sendTransaction({
        to: tokenAddress,
        data: approvalData,
        value: BigInt(0),
      })

      return hash
    } catch (error) {
      console.error('Token approval failed:', error)
      throw new Error(`Failed to approve token: ${error}`)
    }
  }

  async executeSwap(
    smartWalletClient: any, // Privy smart wallet client
    params: SwapParams
  ): Promise<string> {
    try {
      const diamondAddress = this.getDiamondAddress(params.chainId)
      const facetFunction = this.getFacetFunction(params.provider)

      // Calculate fees
      const { tokenWithFee: fromTokenWithFee, feeAmount: fromFeeAmount } = 
        this.calculateTokenWithFee(params.fromToken, params.fromAmount, params.chainId)
      
      const { tokenWithFee: toTokenWithFee } = 
        this.calculateTokenWithFee(params.toToken, params.toAmount, params.chainId)

      // Check if we need to approve tokens
      const isFromNative = this.isNativeToken(params.fromToken, params.chainId)
      
      if (!isFromNative) {
        console.log('Checking token approval...')
        const approvalHash = await this.checkAndApproveToken(
          smartWalletClient,
          params.fromToken,
          diamondAddress,
          fromTokenWithFee,
          params.chainId
        )
        
        if (approvalHash) {
          console.log('Token approval transaction:', approvalHash)
          // Wait for approval to be mined before proceeding
          // You might want to add a wait mechanism here
        }
      }

      // Execute the swap through the diamond facet using Privy smart wallet
      console.log('Executing swap through diamond contract via Privy smart wallet...')
      console.log({
        provider: params.provider,
        facetFunction,
        fromTokenWithFee: fromTokenWithFee.toString(),
        fromAmount: params.fromAmount.toString(),
        toTokenWithFee: toTokenWithFee.toString(),
        callData: params.callData,
        value: params.value,
      })

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

      // Send transaction via Privy smart wallet client
      const hash = await smartWalletClient.sendTransaction({
        to: diamondAddress,
        data: swapCallData,
        value: BigInt(params.value),
      })

      console.log('Swap transaction submitted via Privy smart wallet:', hash)
      return hash
    } catch (error) {
      console.error('Swap execution failed:', error)
      throw new Error(`Swap failed: ${error}`)
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
  return {
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
} 