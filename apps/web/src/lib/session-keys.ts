'use client'

import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  addressToEmptyAccount,
} from '@zerodev/sdk'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import {
  ModularSigner,
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { toSudoPolicy, toCallPolicy, toGasPolicy, CallPolicyVersion } from '@zerodev/permissions/policies'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, custom, http, Address, parseEther, formatEther, encodeFunctionData, type Account } from 'viem'
import { DIAMOND_ADDRESSES, DIAMOND_ABIS } from './contracts'
import { getChainConfig } from '@/config/chains'

// Types based on backend services
export interface SessionKeyPermissions {
  contractAddresses: Address[]
  allowedMethods: string[]
  maxAmount: string // Wei format  
  maxGasLimit: string
  timeframe: {
    validAfter: number
    validUntil: number
  }
}

export interface SessionKey {
  id: string
  address: Address
  privateKey: string // Store securely in production
  approval: string // Serialized permission account
  permissions: SessionKeyPermissions
  expiresAt: Date
  isActive: boolean
  createdAt: Date
  metadata: {
    chainId: number
    ownerAddress: Address
    walletAddress: Address
  }
}

export class PrivySessionKeyService {
  private entryPoint = getEntryPoint('0.7')
  private kernelVersion = KERNEL_V3_1

  /**
   * Check if ZeroDev is properly configured
   */
  checkConfiguration(): { isConfigured: boolean; message: string } {
    const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID
    
    if (!projectId) {
      return {
        isConfigured: false,
        message: 'NEXT_PUBLIC_ZERODEV_PROJECT_ID environment variable is not set'
      }
    }

    if (projectId === 'your_zerodev_project_id') {
      return {
        isConfigured: false,
        message: 'Please set NEXT_PUBLIC_ZERODEV_PROJECT_ID to your actual ZeroDev project ID'
      }
    }

    return {
      isConfigured: true,
      message: 'ZeroDev ready - Using Privy embedded wallet signing (no private key export required)'
    }
  }

  /**
   * Get chain configuration
   */
  private getChain(chainId: number) {
    const chainConfig = getChainConfig(chainId)
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }
    return chainConfig.wagmiChain
  }

  /**
   * Get RPC URL for chain
   */
  private getRpcUrl(chainId: number): string {
    const chainConfig = getChainConfig(chainId)
    if (!chainConfig) {
      throw new Error(`No RPC URL for chain ${chainId}`)
    }
    return chainConfig.rpcUrls[0] // Use first RPC URL from config
  }

  /**
   * Create wallet client from Privy embedded wallet (theo tài liệu Privy + ZeroDev)
   */
  async createPrivyWalletClient(embeddedWallet: any, chainId: number): Promise<any> {
    try {
      // Check if embedded wallet is available and authenticated
      if (!embeddedWallet) {
        throw new Error('Privy embedded wallet not found')
      }

      if (!embeddedWallet.address) {
        throw new Error('Privy embedded wallet not authenticated')
      }

      // Get EIP1193 provider from Privy embedded wallet (theo tài liệu Privy)
      const eip1193provider = await embeddedWallet.getEthereumProvider()
      
      if (!eip1193provider) {
        throw new Error('Failed to get EIP1193 provider from Privy embedded wallet')
      }

      const chain = this.getChain(chainId)

      // Create viem WalletClient từ embedded wallet's EIP1193 provider (theo tài liệu)
      const privyWalletClient = createWalletClient({
        account: embeddedWallet.address as `0x${string}`,
        chain,
        transport: custom(eip1193provider)
      })

      return privyWalletClient

    } catch (error) {
      console.error('❌ Failed to create Privy wallet client:', error)
      throw new Error(`Privy wallet client creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * STEP 1: Generate session key pair (from zeroDevClient.generateSessionKey)
   */
  async generateSessionKey(): Promise<{
    sessionKey: string
    sessionKeyAddress: Address
    sessionKeySigner: ModularSigner
  }> {
    try {
      // Generate session key pair
      const sessionKey = generatePrivateKey()
      const sessionKeyAccount = privateKeyToAccount(sessionKey)
      
      // Convert to ModularSigner for permissions
      const sessionKeySigner = await toECDSASigner({
        signer: sessionKeyAccount,
      })

      return {
        sessionKey, // Private key (to be stored encrypted)
        sessionKeyAddress: sessionKeySigner.account.address,
        sessionKeySigner, // ModularSigner for permissions
      }
    } catch (error) {
      console.error('❌ Failed to generate session key:', error)
      throw new Error('Session key generation failed')
    }
  }

  /**
   * STEP 2: Create approval for session key (from zeroDevClient.createSessionKeyApproval)
   */
  async createSessionKeyApproval(
    chainId: number,
    privyWalletClient: any,
    sessionKeyAddress: Address,
    permissions: SessionKeyPermissions
  ): Promise<{
    approval: string
    permissionAccount: any
  }> {
    try {
      const chain = this.getChain(chainId)

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.getRpcUrl(chainId)),
      })

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer: privyWalletClient,
        kernelVersion: this.kernelVersion,
      })

      // Create empty account for session key (only needs address)
      const emptyAccount = addressToEmptyAccount(sessionKeyAddress)
      const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount })

      // Create policies based on permissions
      const policies = this.createPoliciesFromPermissions(permissions)

      // Create permission validator
      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer: emptySessionKeySigner,
        policies,
        kernelVersion: this.kernelVersion,
      })

      // Create kernel account with both validators
      const sessionKeyAccount = await createKernelAccount(publicClient, {
        entryPoint: this.entryPoint,
        plugins: {
          sudo: ecdsaValidator,      // Main owner validator
          regular: permissionPlugin  // Session key validator
        },
        kernelVersion: this.kernelVersion,
      })

      // Serialize permission account to create approval
      const approval = await serializePermissionAccount(sessionKeyAccount)

      return {
        approval, // Serialized approval string
        permissionAccount: sessionKeyAccount,
      }
    } catch (error) {
      console.error('❌ Failed to create session key approval:', error)
      throw new Error(`Session key approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create policies from session key permissions (simplified to use sudo policy)
   */
  private createPoliciesFromPermissions(permissions: SessionKeyPermissions): any[] {
    // For now, use sudo policy (allows everything) to avoid complex call policy setup
    // In production, you'd want specific call policies for better security
    const policies = [toSudoPolicy({})]

    return policies
  }



  /**
   * Create Diamond contract trading permissions
   */
  createDiamondTradingPermissions(
    chainId: number,
    maxAmountEth: number = 1,
    durationDays: number = 30
  ): SessionKeyPermissions {
    const diamondAddress = DIAMOND_ADDRESSES[chainId]
    if (!diamondAddress || diamondAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Diamond contract not deployed on chain ${chainId}`)
    }

    const now = Math.floor(Date.now() / 1000)
    const expiration = now + (durationDays * 24 * 60 * 60)

    return {
      contractAddresses: [diamondAddress],
      allowedMethods: [
        'callLifi',     // LI.FI swaps
        'callOneInch',  // 1inch swaps  
        'callRelay',    // Relay swaps
        'approve',      // Token approvals
      ],
      maxAmount: parseEther(maxAmountEth.toString()).toString(),
      maxGasLimit: '1000000', // 1M gas limit
      timeframe: {
        validAfter: now,
        validUntil: expiration,
      },
    }
  }

  /**
   * Complete session key creation flow (from sessionKeyManager.createSessionKey)
   */
  async createTradingSessionKey(
    chainId: number,
    embeddedWallet: any, // Privy embedded wallet
    smartWalletAddress: Address, // Privy AA wallet address
    options: {
      maxAmountEth?: number
      durationDays?: number
    } = {}
  ): Promise<SessionKey> {
    try {
      const { maxAmountEth = 1, durationDays = 30 } = options

      // STEP 1: Create wallet client from Privy embedded wallet (theo tài liệu Privy + ZeroDev)
      const privyWalletClient = await this.createPrivyWalletClient(embeddedWallet, chainId)

      // STEP 2: Generate session key pair
      const sessionKeyGeneration = await this.generateSessionKey()

      // STEP 3: Create permissions for Diamond contract
      const permissions = this.createDiamondTradingPermissions(
        chainId,
        maxAmountEth,
        durationDays
      )

      // STEP 4: Create approval (owner side) - this enables session key usage
      const approvalResult = await this.createSessionKeyApproval(
        chainId,
        privyWalletClient,
        sessionKeyGeneration.sessionKeyAddress,
        permissions
      )

      // STEP 5: Create session key object
      const sessionKey: SessionKey = {
        id: `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        address: sessionKeyGeneration.sessionKeyAddress,
        privateKey: sessionKeyGeneration.sessionKey, // Store securely in production
        approval: approvalResult.approval, // Serialized permission account
        permissions,
        expiresAt: new Date(permissions.timeframe.validUntil * 1000),
        isActive: true,
        createdAt: new Date(),
        metadata: {
          chainId,
          ownerAddress: embeddedWallet.address,
          walletAddress: smartWalletAddress,
        }
      }



      return sessionKey

    } catch (error) {
      console.error('❌ Failed to create trading session key:', error)
      throw error
    }
  }

  /**
   * Create session key client for executing transactions
   */
  async createSessionKeyClient(
    chainId: number,
    approval: string,
    sessionKeySigner: ModularSigner
  ): Promise<any> {
    try {
      const chain = this.getChain(chainId)

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.getRpcUrl(chainId)),
      })

      // Deserialize permission account from approval
      const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        this.entryPoint,
        this.kernelVersion,
        approval,
        sessionKeySigner
      )

      // Create ZeroDev paymaster client
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(`https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/${chainId}`),
      })

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain,
        bundlerTransport: http(`https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/${chainId}`),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            try {
              return await paymasterClient.sponsorUserOperation({ userOperation })
            } catch (sponsorError) {
              console.warn('Paymaster sponsorship failed, user will pay gas:', sponsorError)
              throw sponsorError
            }
          },
        },
      })



      return kernelClient
    } catch (error) {
      console.error('❌ Failed to create session key client:', error)
      throw new Error(`Session key client creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute transactions using session key (from zeroDevClient.executeWithSessionKey)
   */
  async executeWithSessionKey(
    sessionKey: SessionKey,
    transactions: Array<{
      to: Address
      value?: bigint
      data?: string
    }>
  ): Promise<{
    userOpHash: string
    txHash?: string
    walletAddress: Address
  }> {
    try {
      // Validate session key
      this.validateSessionKey(sessionKey)

      // Create session key signer from private key
      const sessionKeyAccount = privateKeyToAccount(sessionKey.privateKey as `0x${string}`)
      const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount })

      // Create session key client
      const sessionKeyClient = await this.createSessionKeyClient(
        sessionKey.metadata.chainId,
        sessionKey.approval,
        sessionKeySigner
      )

      // Encode calls using kernel account's encodeCalls method
      const callData = await sessionKeyClient.account.encodeCalls(
        transactions.map(tx => ({
          to: tx.to,
          value: tx.value || BigInt(0),
          data: tx.data || '0x',
        }))
      )

      // Send user operation
      const userOpHash = await sessionKeyClient.sendUserOperation({
        callData,
      })



      return {
        userOpHash,
        walletAddress: sessionKeyClient.account.address,
      }
    } catch (error) {
      console.error('❌ Failed to execute transaction with session key:', error)
      throw error
    }
  }

  /**
   * Revoke session key on-chain
   */
  async revokeSessionKey(sessionKey: SessionKey): Promise<{ txHash?: string; success: boolean }> {
    try {
      // Create session key signer from private key
      const sessionKeyAccount = privateKeyToAccount(sessionKey.privateKey as `0x${string}`)
      const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount })

      // Create session key client
      const sessionKeyClient = await this.createSessionKeyClient(
        sessionKey.metadata.chainId,
        sessionKey.approval,
        sessionKeySigner
      )

      const chain = this.getChain(sessionKey.metadata.chainId)
      const publicClient = createPublicClient({
        chain,
        transport: http(this.getRpcUrl(sessionKey.metadata.chainId)),
      })

      // Create empty account for session key (to get permission plugin)
      const emptyAccount = addressToEmptyAccount(sessionKey.address)
      const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount })

      // Recreate permission plugin to uninstall it
      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer: emptySessionKeySigner,
        policies: [toSudoPolicy({})], // Same policies as when created
        kernelVersion: this.kernelVersion,
      })

      // Uninstall permission plugin (revoke session key)
      const txHash = await sessionKeyClient.uninstallPlugin({
        plugin: permissionPlugin,
      })

      // Mark as inactive locally
      sessionKey.isActive = false

      return { txHash, success: true }
    } catch (error) {
      console.error('❌ Failed to revoke session key:', error)
      
      // Mark as inactive locally even if on-chain revocation fails
      sessionKey.isActive = false
      
      return { success: false }
    }
  }

  /**
   * Validate session key before use
   */
  validateSessionKey(sessionKey: SessionKey): boolean {
    if (!sessionKey.isActive) {
      throw new Error('Session key is not active')
    }

    if (Date.now() > sessionKey.expiresAt.getTime()) {
      throw new Error('Session key has expired')
    }

    const now = Math.floor(Date.now() / 1000)
    if (now < sessionKey.permissions.timeframe.validAfter || 
        now > sessionKey.permissions.timeframe.validUntil) {
      throw new Error('Session key is outside valid timeframe')
    }

    return true
  }

  /**
   * Prepare swap transaction data for Diamond contract
   */
  prepareSwapTransaction(
    chainId: number,
    provider: string, // 'lifi', 'oneinch', 'relay'
    fromToken: Address,
    toToken: Address,
    amount: bigint,
    callData: string
  ): {
    to: Address
    data: string
    value: bigint
  } {
    const diamondAddress = DIAMOND_ADDRESSES[chainId]
    if (!diamondAddress) {
      throw new Error(`Diamond contract not deployed on chain ${chainId}`)
    }

    let functionName: string
    let abi: any
    
    switch (provider.toLowerCase()) {
      case 'lifi':
        functionName = 'callLifi'
        abi = DIAMOND_ABIS.LifiProxyFacet
        break
      case '1inch':
      case 'oneinch':
        functionName = 'callOneInch'
        abi = DIAMOND_ABIS.OneInchProxyFacet
        break
      case 'relay':
        functionName = 'callRelay'
        abi = DIAMOND_ABIS.RelayProxyFacet
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    const encodedData = encodeFunctionData({
      abi,
      functionName,
      args: [
        fromToken, // fromTokenWithFee
        amount,    // fromAmt
        toToken,   // toTokenWithFee  
        callData   // callData
      ],
    })

    return {
      to: diamondAddress,
      data: encodedData,
      value: BigInt(0), // Adjust if native token swap
    }
  }
}

// Export singleton instance
export const privySessionKeyService = new PrivySessionKeyService()

// Helper function for easy session key creation with Privy
export async function createDiamondSessionKey(
  chainId: number,
  embeddedWallet: any, // Privy embedded wallet
  smartWalletAddress: Address, // Privy AA wallet address
  options?: {
    maxAmountEth?: number
    durationDays?: number
  }
): Promise<SessionKey> {
  return await privySessionKeyService.createTradingSessionKey(
    chainId,
    embeddedWallet,
    smartWalletAddress,
    options
  )
}

// Helper function to execute Diamond contract swaps with session key
export async function executeSwapWithSessionKey(
  sessionKey: SessionKey,
  swapParams: {
    chainId: number
    provider: string
    fromToken: Address
    toToken: Address
    amount: bigint
    callData: string
  }
): Promise<{ userOpHash: string; txHash?: string; walletAddress: Address }> {
  const transaction = privySessionKeyService.prepareSwapTransaction(
    swapParams.chainId,
    swapParams.provider,
    swapParams.fromToken,
    swapParams.toToken,
    swapParams.amount,
    swapParams.callData
  )
  
  return await privySessionKeyService.executeWithSessionKey(sessionKey, [transaction])
} 