import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient, addressToEmptyAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { 
  ModularSigner,
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { toSudoPolicy, toCallPolicy, toGasPolicy } from '@zerodev/permissions/policies';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createPublicClient, http, Chain, Address, Hash, parseEther } from 'viem';
import { base, baseSepolia, bsc, bscTestnet, sepolia, mainnet } from 'viem/chains';
import { createLogger, LogContext } from '@moonx-farm/common';
import { ZeroDevClientConfig, SessionKeyPermissions, WalletRegistryError } from '../types';
import { GasManager } from './gasManager';

const logger = createLogger('zerodev-client');

export class ZeroDevClientService {
  private projectId: string;
  private chains: Record<number, Chain>;
  private rpcUrls: Record<number, string>;
  private entryPoint = getEntryPoint('0.7');
  private kernelVersion = KERNEL_V3_1;
  private gasManager?: GasManager;

  constructor(config: ZeroDevClientConfig, gasManager?: GasManager) {
    this.projectId = config.projectId;
    if (gasManager) {
      this.gasManager = gasManager;
    }
    
    this.rpcUrls = {
      1: process.env['ETHEREUM_RPC_URL'] || '',
      8453: process.env['BASE_RPC_URL'] || '',
      11155111: process.env['SEPOLIA_RPC_URL'] || '',
      84532: process.env['BASE_SEPOLIA_RPC_URL'] || '',
      56: process.env['BSC_RPC_URL'] || '',
      97: process.env['BSC_TESTNET_RPC_URL'] || '',
    };

    this.chains = {
      1: mainnet,
      8453: base,
      11155111: sepolia,
      84532: baseSepolia,
      56: bsc,
      97: bscTestnet,
    };
  }

  /**
   * Create a new Kernel account with ECDSA validator
   * @param chainId Target chain ID
   * @param ownerAddress Owner EOA address (e.g., Privy wallet address)
   * @param saltNonce Optional salt for deterministic address generation
   */
  async createKernelAccount(
    chainId: number, 
    ownerAddress?: Address,
    saltNonce?: string
  ): Promise<{
    account: any;
    address: Address;
    salt: string;
    privateKey?: string; // Only returned for custodial mode
    ownerAddress: Address;
  }> {
    try {
      const chain = this.getChain(chainId);
      const salt = saltNonce || this.generateSalt();
      
      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      if (ownerAddress) {
        // Owner-based mode: Create account owned by external address (e.g., Privy EOA)
        logger.info('Creating owner-based kernel account', {
          chainId,
          ownerAddress,
          salt: salt.substring(0, 10) + '...',
        });

        // Create empty account (placeholder signer - real signing happens via owner)
        const emptySigner = addressToEmptyAccount(ownerAddress);
        
        // Create ECDSA validator with owner address
        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          signer: emptySigner,
          entryPoint: this.entryPoint,
          kernelVersion: this.kernelVersion,
        });

        // Create kernel account with owner
        const account = await createKernelAccount(publicClient, {
          plugins: {
            sudo: ecdsaValidator,
          },
          entryPoint: this.entryPoint,
          kernelVersion: this.kernelVersion,
        });

        logger.info('Owner-based kernel account created', {
          chainId,
          accountAddress: account.address,
          ownerAddress,
          salt: salt.substring(0, 10) + '...',
        });

        return {
          account,
          address: account.address,
          salt,
          ownerAddress,
          // No privateKey returned for owner-based accounts
        };
      } else {
        // Custodial mode: Generate private key for self-owned account
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);

        logger.info('Creating custodial kernel account', {
          chainId,
          salt: salt.substring(0, 10) + '...',
        });

        // Create ECDSA validator
        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          signer,
          entryPoint: this.entryPoint,
          kernelVersion: this.kernelVersion,
        });

        // Create kernel account
        const account = await createKernelAccount(publicClient, {
          plugins: {
            sudo: ecdsaValidator,
          },
          entryPoint: this.entryPoint,
          kernelVersion: this.kernelVersion,
        });

        logger.info('Custodial kernel account created', {
          chainId,
          address: account.address,
          ownerAddress: signer.address,
          salt: salt.substring(0, 10) + '...',
        });

        return {
          account,
          address: account.address,
          salt,
          privateKey,
          ownerAddress: signer.address,
        };
      }
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        saltNonce,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to create kernel account', logContext);
      throw this.createError('KERNEL_CREATION_FAILED', 'Failed to create kernel account', 500, error);
    }
  }

  /**
   * Create Kernel client for account operations
   */
  async createKernelClient(chainId: number, privateKey: string): Promise<any> {
    try {
      const chain = this.getChain(chainId);
      const signer = privateKeyToAccount(privateKey as `0x${string}`);

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      // Create ECDSA validator
      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer,
        entryPoint: this.entryPoint,
        kernelVersion: this.kernelVersion,
      });

      // Create kernel account
      const account = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint: this.entryPoint,
        kernelVersion: this.kernelVersion,
      });

      // Create ZeroDev paymaster client with v3 API format
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
      });

      // Create kernel client with v3 API format and intelligent gas sponsorship
      const kernelClient = createKernelAccountClient({
        account,
        chain,
        bundlerTransport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            // Check if this is likely a deployment transaction (empty or minimal calldata)
            const isMinimalTransaction = !userOperation.callData || 
                                       userOperation.callData === '0x' || 
                                       userOperation.callData.length <= 10;

            if (isMinimalTransaction) {
              logger.info('Auto-sponsoring minimal transaction (likely deployment)', {
                walletAddress: userOperation.sender,
                chainId,
                callDataLength: userOperation.callData?.length || 0,
              });
              return paymasterClient.sponsorUserOperation({ userOperation });
            }

            // For regular transactions, check sponsorship eligibility
            if (this.gasManager && userOperation.sender) {
              try {
                const eligibility = await this.gasManager.checkSponsorshipEligibility({
                  userId: 'system', // Will be replaced with actual userId in higher-level calls
                  walletAddress: userOperation.sender as Address,
                  chainId,
                  estimatedGas: userOperation.maxFeePerGas?.toString() || '1000000',
                  userOperationHash: userOperation.callData,
                });

                if (eligibility.eligible) {
                  logger.info('Gas sponsorship approved', {
                    walletAddress: userOperation.sender,
                    chainId,
                    policyId: eligibility.policyId,
                    estimatedCost: eligibility.estimatedGasCost,
                  });
                  
                  // Get paymaster data
                  const paymasterData = await paymasterClient.sponsorUserOperation({ userOperation });
                  
                  // Record sponsored transaction asynchronously
                  if (eligibility.policyId && eligibility.estimatedGasCost) {
                    this.gasManager.recordSponsoredTransaction(
                      'system', // Will be replaced with actual userId from higher level
                      userOperation.sender as Address,
                      chainId,
                      userOperation.callData || '0x',
                      eligibility.estimatedGasCost,
                      eligibility.policyId
                    ).catch(error => {
                      logger.warn('Failed to record sponsored transaction', { error });
                    });
                  }
                  
                  return paymasterData;
                } else {
                  logger.info('Gas sponsorship not eligible', {
                    walletAddress: userOperation.sender,
                    chainId,
                    reason: eligibility.reason,
                  });
                }
              } catch (error) {
                logger.warn('Gas sponsorship check failed, using default paymaster', {
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }

            // Fallback to default paymaster (user pays gas)
            return paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      logger.info('Kernel client created', {
        chainId,
        address: account.address,
      });

      return kernelClient;
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to create kernel client', logContext);
      throw this.createError('KERNEL_CLIENT_FAILED', 'Failed to create kernel client', 500, error);
    }
  }

  /**
   * Deploy a kernel account on-chain
   */
  async deployKernelAccount(chainId: number, privateKey: string): Promise<{
    txHash: Hash;
    address: Address;
    blockNumber?: number;
  }> {
    try {
      const kernelClient = await this.createKernelClient(chainId, privateKey);

      // Deploy by sending a simple transaction to self
      const txHash = await kernelClient.sendUserOperation({
        userOperation: {
          callData: await kernelClient.account.encodeCallData({
            to: kernelClient.account.address,
            value: parseEther('0'),
            data: '0x',
          }),
        },
      });

      // Wait for transaction to be mined
      const receipt = await kernelClient.waitForUserOperationReceipt({ hash: txHash });

      logger.info('Kernel account deployed', {
        chainId,
        address: kernelClient.account.address,
        txHash: receipt.receipt.transactionHash,
      });

      return {
        txHash: receipt.receipt.transactionHash as Hash,
        address: kernelClient.account.address,
        blockNumber: Number(receipt.receipt.blockNumber),
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to deploy kernel account', logContext);
      throw this.createError('DEPLOYMENT_FAILED', 'Failed to deploy kernel account', 500, error);
    }
  }

  /**
   * Generate session key for delegation (step 1 of 2)
   * This generates the session key that will be approved by wallet owner
   */
  async generateSessionKey(): Promise<{
    sessionKey: string;
    sessionKeyAddress: Address;
    sessionKeySigner: ModularSigner;
  }> {
    try {
      // Generate session key pair
      const sessionKey = generatePrivateKey();
      const sessionKeyAccount = privateKeyToAccount(sessionKey);
      
      // Convert to ModularSigner for permissions
      const sessionKeySigner = await toECDSASigner({
        signer: sessionKeyAccount,
      });

      logger.info('Session key generated', {
        sessionKeyAddress: sessionKeySigner.account.address,
        note: 'Session key ready for approval by wallet owner',
      });

      return {
        sessionKey, // Private key (to be stored encrypted)
        sessionKeyAddress: sessionKeySigner.account.address,
        sessionKeySigner, // ModularSigner for permissions
      };
    } catch (error) {
      logger.error('Failed to generate session key', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw this.createError('SESSION_KEY_GENERATION_FAILED', 'Failed to generate session key', 500, error);
    }
  }

  /**
   * Create approval for session key (step 2 of 2)
   * This creates the permission approval that enables session key usage
   */
  async createSessionKeyApproval(
    chainId: number,
    walletPrivateKey: string,
    sessionKeyAddress: Address,
    permissions: SessionKeyPermissions
  ): Promise<{
    approval: string;
    permissionAccount: any;
  }> {
    try {
      const chain = this.getChain(chainId);
      const signer = privateKeyToAccount(walletPrivateKey as `0x${string}`);

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      // Create ECDSA validator for main wallet
      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer,
        kernelVersion: this.kernelVersion,
      });

      // Create empty account for session key (only needs address)
      const emptyAccount = addressToEmptyAccount(sessionKeyAddress);
      const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount });

      // Create policies based on permissions
      const policies = this.createPoliciesFromPermissions(permissions);

      // Create permission validator
      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer: emptySessionKeySigner,
        policies,
        kernelVersion: this.kernelVersion,
      });

      // Create kernel account with both validators
      const sessionKeyAccount = await createKernelAccount(publicClient, {
        entryPoint: this.entryPoint,
        plugins: {
          sudo: ecdsaValidator,      // Main owner validator
          regular: permissionPlugin  // Session key validator
        },
        kernelVersion: this.kernelVersion,
      });

      // Serialize permission account to create approval
      const approval = await serializePermissionAccount(sessionKeyAccount);

      logger.info('Session key approval created', {
        chainId,
        sessionKeyAddress,
        walletAddress: sessionKeyAccount.address,
        contractAddresses: permissions.contractAddresses,
        maxAmount: permissions.maxAmount,
        expiresAt: new Date(permissions.timeframe.validUntil * 1000),
        note: 'Approval ready for session key usage',
      });

      return {
        approval, // Serialized approval string
        permissionAccount: sessionKeyAccount,
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        sessionKeyAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to create session key approval', logContext);
      throw this.createError('SESSION_APPROVAL_FAILED', 'Failed to create session key approval', 500, error);
    }
  }

  /**
   * Use session key to create kernel client
   * This enables the session key to execute transactions with intelligent gas sponsorship
   */
  async createSessionKeyClient(
    chainId: number,
    approval: string,
    sessionKeySigner: ModularSigner,
    userId?: string
  ): Promise<any> {
    try {
      const chain = this.getChain(chainId);

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      // Deserialize permission account from approval
      const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        this.entryPoint,
        this.kernelVersion,
        approval,
        sessionKeySigner
      );

      // Create ZeroDev paymaster client with v3 API format
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
      });

      // Create kernel client with intelligent gas sponsorship for session keys
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain,
        bundlerTransport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            // Session key management operations (install/uninstall) are always sponsored
            const isSessionKeyManagement = userOperation.callData?.includes('plugin') || 
                                          userOperation.callData?.includes('install') ||
                                          userOperation.callData?.includes('uninstall');

            if (isSessionKeyManagement) {
              logger.info('Auto-sponsoring session key management operation', {
                walletAddress: userOperation.sender,
                chainId,
                callDataLength: userOperation.callData?.length || 0,
                note: 'Session key management operations are always sponsored',
              });
              return paymasterClient.sponsorUserOperation({ userOperation });
            }

            // For regular transactions, check sponsorship eligibility
            if (this.gasManager && userOperation.sender) {
              try {
                const eligibility = await this.gasManager.checkSponsorshipEligibility({
                  userId: userId || 'system', // Use provided userId or fallback to system
                  walletAddress: userOperation.sender as Address,
                  chainId,
                  estimatedGas: userOperation.maxFeePerGas?.toString() || '1000000',
                  userOperationHash: userOperation.callData,
                });

                if (eligibility.eligible) {
                  logger.info('Gas sponsorship approved for session key transaction', {
                    walletAddress: userOperation.sender,
                    chainId,
                    userId: userId || 'system',
                    policyId: eligibility.policyId,
                    estimatedCost: eligibility.estimatedGasCost,
                    note: 'Regular transaction via session key',
                  });
                  
                  // Get paymaster data
                  const paymasterData = await paymasterClient.sponsorUserOperation({ userOperation });
                  
                  // Record sponsored transaction asynchronously
                  if (eligibility.policyId && eligibility.estimatedGasCost) {
                    this.gasManager.recordSponsoredTransaction(
                      userId || 'system', // Use provided userId for proper tracking
                      userOperation.sender as Address,
                      chainId,
                      userOperation.callData || '0x',
                      eligibility.estimatedGasCost,
                      eligibility.policyId
                    ).catch(error => {
                      logger.warn('Failed to record sponsored session key transaction', { error });
                    });
                  }
                  
                  return paymasterData;
                } else {
                  logger.info('Gas sponsorship declined for session key transaction', {
                    walletAddress: userOperation.sender,
                    chainId,
                    reason: eligibility.reason,
                    note: 'User will pay gas for this session key transaction',
                  });
                }
              } catch (error) {
                logger.warn('Failed to check gas sponsorship eligibility for session key', {
                  walletAddress: userOperation.sender,
                  chainId,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }

            // Fallback: attempt to sponsor anyway (for backward compatibility)
            try {
              return paymasterClient.sponsorUserOperation({ userOperation });
            } catch (sponsorError) {
              logger.warn('Paymaster sponsorship failed for session key, user will pay gas', {
                walletAddress: userOperation.sender,
                chainId,
                error: sponsorError instanceof Error ? sponsorError.message : 'Unknown error',
              });
              throw sponsorError;
            }
          },
        },
      });

      logger.info('Session key client created with intelligent gas sponsorship', {
        chainId,
        sessionKeyAddress: sessionKeySigner.account.address,
        walletAddress: sessionKeyAccount.address,
        hasGasManager: !!this.gasManager,
        note: 'Session key can execute transactions with intelligent gas sponsorship',
      });

      return kernelClient;
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to create session key client', logContext);
      throw this.createError('SESSION_CLIENT_FAILED', 'Failed to create session key client', 500, error);
    }
  }

  /**
   * Revoke session key by uninstalling permission plugin
   * This disables the session key from executing further transactions
   */
  async revokeSessionKey(
    chainId: number,
    sessionKeyAddress: Address,
    approval: string,
    sessionKeySigner: ModularSigner,
    userId?: string
  ): Promise<{ txHash: Hash; success: boolean }> {
    try {
      const chain = this.getChain(chainId);

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      // Deserialize session key account from approval
      const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        this.entryPoint,
        this.kernelVersion,
        approval,
        sessionKeySigner
      );

      // Create ZeroDev paymaster client
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
      });

      // Create kernel client with intelligent gas sponsorship for session key revocation
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain,
        bundlerTransport: http(`https://rpc.zerodev.app/api/v3/${this.projectId}/chain/${chainId}`),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            // For session key revocation, check sponsorship eligibility first
            if (this.gasManager && userOperation.sender && userId) {
              try {
                const eligibility = await this.gasManager.checkSponsorshipEligibility({
                  userId: userId,
                  walletAddress: userOperation.sender as Address,
                  chainId,
                  estimatedGas: userOperation.maxFeePerGas?.toString() || '1000000',
                  userOperationHash: userOperation.callData,
                });

                if (eligibility.eligible) {
                  logger.info('Gas sponsorship approved for session key revocation', {
                    walletAddress: userOperation.sender,
                    chainId,
                    userId,
                    policyId: eligibility.policyId,
                    estimatedCost: eligibility.estimatedGasCost,
                    note: 'Session key revocation operation sponsored',
                  });
                  
                  // Get paymaster data
                  const paymasterData = await paymasterClient.sponsorUserOperation({ userOperation });
                  
                  // Record sponsored transaction asynchronously
                  if (eligibility.policyId && eligibility.estimatedGasCost) {
                    this.gasManager.recordSponsoredTransaction(
                      userId,
                      userOperation.sender as Address,
                      chainId,
                      userOperation.callData || '0x',
                      eligibility.estimatedGasCost,
                      eligibility.policyId
                    ).catch(error => {
                      logger.warn('Failed to record sponsored session key revocation', { error });
                    });
                  }
                  
                  return paymasterData;
                } else {
                  logger.info('Gas sponsorship declined for session key revocation', {
                    walletAddress: userOperation.sender,
                    chainId,
                    userId,
                    reason: eligibility.reason,
                    note: 'User will pay gas for this session key revocation',
                  });
                }
              } catch (error) {
                logger.warn('Failed to check gas sponsorship eligibility for session key revocation', {
                  walletAddress: userOperation.sender,
                  chainId,
                  userId,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            } else {
              // Fallback: session key management operations are always sponsored if no GasManager
              logger.info('Auto-sponsoring session key revocation (no gas manager or userId)', {
                walletAddress: userOperation.sender,
                chainId,
                hasGasManager: !!this.gasManager,
                hasUserId: !!userId,
                callDataLength: userOperation.callData?.length || 0,
                note: 'Session key revocation operations are sponsored by default',
              });
            }
            
            // Fallback: attempt to sponsor anyway (for backward compatibility)
            try {
              return paymasterClient.sponsorUserOperation({ userOperation });
            } catch (sponsorError) {
              logger.warn('Paymaster sponsorship failed for session key revocation, user will pay gas', {
                walletAddress: userOperation.sender,
                chainId,
                error: sponsorError instanceof Error ? sponsorError.message : 'Unknown error',
              });
              throw sponsorError;
            }
          },
        },
      });

      // Create empty account for session key (to get permission plugin)
      const emptyAccount = addressToEmptyAccount(sessionKeyAddress);
      const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount });

      // Recreate permission plugin to uninstall it
      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: this.entryPoint,
        signer: emptySessionKeySigner,
        policies: [toSudoPolicy({})], // Same policies as when created
        kernelVersion: this.kernelVersion,
      });

      // Uninstall permission plugin (revoke session key)
      const txHash = await kernelClient.uninstallPlugin({
        plugin: permissionPlugin,
      });

      logger.info('Session key revoked successfully', {
        chainId,
        sessionKeyAddress,
        walletAddress: sessionKeyAccount.address,
        txHash,
        note: 'Session key can no longer execute transactions',
      });

      return { txHash, success: true };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        sessionKeyAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to revoke session key', logContext);
      throw this.createError('SESSION_REVOKE_FAILED', 'Failed to revoke session key', 500, error);
    }
  }

  /**
   * Create policies from session key permissions
   */
  private createPoliciesFromPermissions(permissions: SessionKeyPermissions): any[] {
    const policies: any[] = [];

    // Create call policy for allowed contracts and methods
    if (permissions.contractAddresses && permissions.contractAddresses.length > 0) {
      const callPolicies = permissions.contractAddresses.map(contractAddress => {
        const policyConfig: any = {
          target: contractAddress as Address,
        };

        // Add method restrictions if specified
        if (permissions.allowedMethods && permissions.allowedMethods.length > 0) {
          policyConfig.selector = permissions.allowedMethods[0]; // Use first method as example
          // In a full implementation, you'd create multiple policies for multiple methods
        }

        return toCallPolicy(policyConfig);
      });
      
      policies.push(...callPolicies);
    }

    // Create gas policy for gas limit restrictions
    if (permissions.maxGasLimit) {
      policies.push(toGasPolicy({
        enforcePaymaster: true, // Enforce paymaster usage
      }));
    }

    // If no specific policies, use sudo policy (allows everything)
    if (policies.length === 0) {
      policies.push(toSudoPolicy({}));
    }

    logger.info('Created policies from permissions', {
      contractAddresses: permissions.contractAddresses,
      allowedMethods: permissions.allowedMethods,
      maxGasLimit: permissions.maxGasLimit,
      policyCount: policies.length,
    });

    return policies;
  }

  /**
   * Execute transactions using session key (step 4: Usage)
   * This method allows executing transactions with session key permissions
   */
  async executeWithSessionKey(
    chainId: number,
    approval: string,
    sessionKeyPrivateKey: string,
    transactions: Array<{
      to: Address;
      value?: bigint;
      data?: `0x${string}`;
    }>,
    userId?: string
  ): Promise<{
    userOpHash: Hash;
    txHash?: Hash;
    walletAddress: Address;
  }> {
    try {
      // Create session key signer from private key
      const sessionKeyAccount = privateKeyToAccount(sessionKeyPrivateKey as `0x${string}`);
      const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount });

      // Create session key client with user context for proper gas sponsorship
      const sessionKeyClient = await this.createSessionKeyClient(
        chainId,
        approval,
        sessionKeySigner,
        userId
      );

      // Encode calls using kernel account's encodeCalls method
      const callData = await sessionKeyClient.account.encodeCalls(
        transactions.map(tx => ({
          to: tx.to,
          value: tx.value || BigInt(0),
          data: tx.data || '0x',
        }))
      );

      // Send user operation
      const userOpHash = await sessionKeyClient.sendUserOperation({
        callData,
      });

      logger.info('Transaction executed with session key', {
        chainId,
        sessionKeyAddress: sessionKeySigner.account.address,
        walletAddress: sessionKeyClient.account.address,
        userOpHash,
        transactionCount: transactions.length,
        note: 'Session key transaction submitted to bundler',
      });

      return {
        userOpHash,
        walletAddress: sessionKeyClient.account.address,
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        transactionCount: transactions.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to execute transaction with session key', logContext);
      throw this.createError('SESSION_EXECUTION_FAILED', 'Failed to execute transaction with session key', 500, error);
    }
  }

  /**
   * Wait for session key transaction receipt
   */
  async waitForSessionKeyTransaction(
    chainId: number,
    approval: string,
    sessionKeyPrivateKey: string,
    userOpHash: Hash,
    timeout = 60000
  ): Promise<{
    txHash: Hash;
    blockNumber: bigint;
    status: 'success' | 'reverted';
  }> {
    try {
      // Create session key signer from private key
      const sessionKeyAccount = privateKeyToAccount(sessionKeyPrivateKey as `0x${string}`);
      const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount });

      // Create session key client (no userId needed for wait operations)
      const sessionKeyClient = await this.createSessionKeyClient(
        chainId,
        approval,
        sessionKeySigner
      );

      // Wait for user operation receipt
      const receipt = await sessionKeyClient.waitForUserOperationReceipt({
        hash: userOpHash,
        timeout,
      });

      logger.info('Session key transaction confirmed', {
        chainId,
        sessionKeyAddress: sessionKeySigner.account.address,
        walletAddress: sessionKeyClient.account.address,
        userOpHash,
        txHash: receipt.receipt.transactionHash,
        blockNumber: receipt.receipt.blockNumber,
        gasUsed: receipt.receipt.gasUsed,
        status: receipt.success ? 'success' : 'reverted',
      });

      return {
        txHash: receipt.receipt.transactionHash as Hash,
        blockNumber: receipt.receipt.blockNumber,
        status: receipt.success ? 'success' : 'reverted',
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        userOpHash,
        timeout,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to wait for session key transaction', logContext);
      throw this.createError('SESSION_WAIT_FAILED', 'Failed to wait for session key transaction', 500, error);
    }
  }

  /**
   * Check if an address is a Kernel account
   */
  async isKernelAccount(chainId: number, address: Address): Promise<{
    isKernel: boolean;
    isDeployed: boolean;
    kernelVersion?: string;
  }> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      // Check if address has code (is deployed)
      const code = await publicClient.getCode({ address });
      const isDeployed = !!code && code !== '0x';

      // For now, assume it's a kernel account if it's a contract
      // In production, you would check the actual implementation
      const isKernel = isDeployed;
      const kernelVersion = isKernel ? '3.1' : undefined;

      logger.info('Kernel account validation', {
        chainId,
        address,
        isKernel,
        isDeployed,
        kernelVersion,
      });

      return {
        isKernel,
        isDeployed,
        ...(kernelVersion && { kernelVersion }),
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to validate kernel account', logContext);
      throw this.createError('VALIDATION_FAILED', 'Failed to validate kernel account', 500, error);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(chainId: number, address: Address): Promise<{
    balance: string;
    formattedBalance: string;
  }> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      const balance = await publicClient.getBalance({ address });
      const formattedBalance = (Number(balance) / 1e18).toFixed(6);

      return {
        balance: balance.toString(),
        formattedBalance,
      };
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to get account balance', logContext);
      throw this.createError('BALANCE_FETCH_FAILED', 'Failed to get account balance', 500, error);
    }
  }

  /**
   * Get account nonce
   */
  async getAccountNonce(chainId: number, address: Address): Promise<number> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      const nonce = await publicClient.getTransactionCount({ address });
      return nonce;
    } catch (error) {
      const logContext: LogContext = {
        chainId,
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to get account nonce', logContext);
      throw this.createError('NONCE_FETCH_FAILED', 'Failed to get account nonce', 500, error);
    }
  }

  /**
   * Create default gas sponsorship policy for a new wallet
   * Internal method with conservative limits
   */
  async createDefaultGasSponsorshipPolicy(userId: string, walletAddress: Address): Promise<{ success: boolean; policyId?: string; error?: string }> {
    if (!this.gasManager) {
      return {
        success: false,
        error: 'Gas sponsorship not configured',
      };
    }

    try {
      // Conservative default limits for new users
      const DEFAULT_LIMITS = {
        dailyLimitEth: 0.0005,    // 0.005 ETH daily (~$12 at $2400 ETH)
        monthlyLimitEth: 0.005,   // 0.05 ETH monthly (~$120 at $2400 ETH)
        perTransactionLimitEth: 0.0001, // 0.002 ETH per transaction (~$5 at $2400 ETH)
      };

      const policy = await this.gasManager.createSponsorshipPolicy({
        userId,
        walletAddress,
        dailyLimit: (BigInt(Math.floor(DEFAULT_LIMITS.dailyLimitEth * 1e18))).toString(),
        monthlyLimit: (BigInt(Math.floor(DEFAULT_LIMITS.monthlyLimitEth * 1e18))).toString(),
        perTransactionLimit: (BigInt(Math.floor(DEFAULT_LIMITS.perTransactionLimitEth * 1e18))).toString(),
        isActive: true,
      });

      logger.info('Default gas sponsorship policy created', {
        userId,
        walletAddress,
        policyId: policy.id,
        limits: DEFAULT_LIMITS,
        note: 'Conservative limits for new user',
      });

      return {
        success: true,
        policyId: policy.id,
      };
    } catch (error) {
      logger.error('Failed to create default gas sponsorship policy', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create policy',
      };
    }
  }

  /**
   * Check if user has gas sponsorship available
   */
  async checkGasSponsorship(userId: string, walletAddress: Address, chainId: number): Promise<{
    hasSponsorship: boolean;
    dailyRemaining?: string;
    monthlyRemaining?: string;
    reason?: string;
  }> {
    if (!this.gasManager) {
      return {
        hasSponsorship: false,
        reason: 'Gas sponsorship not configured',
      };
    }

    try {
      const budgets = await this.gasManager.getGasBudgets(userId);
      const activeBudget = budgets.find(b => b.isActive && (!b.walletId || b.walletId === walletAddress));

      if (!activeBudget) {
        return {
          hasSponsorship: false,
          reason: 'No active sponsorship policy found',
        };
      }

      return {
        hasSponsorship: true,
        dailyRemaining: activeBudget.dailyRemaining,
        monthlyRemaining: activeBudget.monthlyRemaining,
      };
    } catch (error) {
      logger.error('Failed to check gas sponsorship', {
        userId,
        walletAddress,
        chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        hasSponsorship: false,
        reason: 'Error checking sponsorship status',
      };
    }
  }

  private getChain(chainId: number): Chain {
    const chain = this.chains[chainId];
    if (!chain) {
      throw this.createError('UNSUPPORTED_CHAIN', `Chain ID ${chainId} is not supported`, 400);
    }
    return chain;
  }

  private generateSalt(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private createError(
    code: string,
    message: string,
    statusCode: number,
    originalError?: any
  ): WalletRegistryError {
    const error = new Error(message) as WalletRegistryError;
    error.code = code;
    error.statusCode = statusCode;
    error.details = originalError;
    return error;
  }
} 