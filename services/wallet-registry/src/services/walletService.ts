import { DatabaseManager } from '@moonx/infrastructure';
import { createLogger, LogContext } from '@moonx/common';
import { ZeroDevClientService } from './zeroDevClient';
import {
    AAWallet,
    CreateWalletRequest,
    CreateWalletResponse,
    GetWalletsRequest,
    GetWalletsResponse,
    WalletStatusRequest,
    WalletStatusResponse,
    ValidateAddressRequest,
    ValidateAddressResponse,
    WalletRegistryError,
} from '../types';
import { getAAStandard } from '../utils/aaStandards';
import { v4 as uuidv4 } from 'uuid';
import { Address } from 'viem';

const logger = createLogger('wallet-service');

export class WalletService {
    private db: DatabaseManager;
    private zeroDevClient: ZeroDevClientService;

    constructor(
        db: DatabaseManager,
        zeroDevClient: ZeroDevClientService
    ) {
        this.db = db;
        this.zeroDevClient = zeroDevClient;
    }

    /**
     * Create a new AA wallet for a user
     */
    async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
        try {
            const { userId, ownerAddress, ownerType = 'privy-social', chainId, saltNonce } = request;

            // Check if user already has a wallet on this chain
            const existingWallet = await this.getUserWalletByChain(userId, chainId);
            if (existingWallet) {
                logger.info('Wallet already exists for user on chain', {
                    userId,
                    chainId,
                    walletId: existingWallet.id,
                });
                return {
                    wallet: existingWallet,
                    isDeployed: existingWallet.isDeployed,
                };
            }

            // Get AA standard for this chain
            const aaConfig = getAAStandard(chainId);

            // Create kernel account with ZeroDev
            const kernelResult = await this.zeroDevClient.createKernelAccount(
                chainId, 
                ownerAddress as Address, 
                saltNonce
            );

            // Create wallet record in database
            const wallet: AAWallet = {
                id: uuidv4(),
                userId,
                address: kernelResult.address,
                ownerAddress,
                ownerType,
                chainId,
                aaStandard: aaConfig.standard,
                kernelVersion: '3.1',
                salt: kernelResult.salt,
                factoryAddress: '0x7a1dBAB750f12a90EB1B60D2Ae3aD17D4D81EfFe', // ZeroDev factory
                implementationAddress: '0xD830D15D3dc0C269F3dBAa0F3e8626d33CFdaBe1', // Kernel implementation
                entryPointAddress: aaConfig.entryPoint,
                isDeployed: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Store wallet in database (only save private key for custodial wallets)
            await this.saveWallet(wallet, kernelResult.privateKey || '');

            // AUTO-DEPLOY in custodial mode (seamless UX)
            let deploymentTxHash: string | undefined;
            let finalAddress = wallet.address;
            let isDeployed = false;

            if (kernelResult.privateKey) {
                try {
                    // Deploy wallet immediately for custodial mode
                    const deployResult = await this.zeroDevClient.deployKernelAccount(
                        chainId,
                        kernelResult.privateKey
                    );

                    // Update wallet with deployment info
                    await this.updateWalletDeployment(wallet.id, deployResult.txHash, true, deployResult.address);
                    
                    deploymentTxHash = deployResult.txHash;
                    finalAddress = deployResult.address;
                    isDeployed = true;
                    wallet.isDeployed = true;
                    wallet.deploymentTxHash = deployResult.txHash;
                    wallet.address = deployResult.address;

                    logger.info('Wallet auto-deployed successfully', {
                        userId,
                        walletId: wallet.id,
                        deploymentTxHash,
                        originalAddress: kernelResult.address,
                        finalAddress: deployResult.address,
                        addressMatch: kernelResult.address === deployResult.address,
                    });
                } catch (deployError) {
                    logger.warn('Auto-deployment failed, wallet created but not deployed', {
                        userId,
                        walletId: wallet.id,
                        error: deployError instanceof Error ? deployError.message : 'Unknown error',
                    });
                    // Continue without failing - wallet can be deployed later
                }
            }

            // Automatically create gas sponsorship policy for new wallet
            try {
                const sponsorshipResult = await this.zeroDevClient.createDefaultGasSponsorshipPolicy(userId, finalAddress as Address);
                if (sponsorshipResult.success) {
                    logger.info('Gas sponsorship policy auto-created for new wallet', {
                        userId,
                        walletId: wallet.id,
                        address: finalAddress,
                        policyId: sponsorshipResult.policyId,
                    });
                } else {
                    logger.warn('Failed to create auto gas sponsorship policy', {
                        userId,
                        walletId: wallet.id,
                        error: sponsorshipResult.error,
                    });
                }
            } catch (error) {
                logger.warn('Failed to create auto gas sponsorship policy, continuing...', {
                    userId,
                    walletId: wallet.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Don't fail wallet creation if sponsorship fails
            }

            logger.info('Wallet created successfully', {
                userId,
                chainId,
                walletId: wallet.id,
                address: finalAddress,
                isDeployed,
                deploymentTxHash,
            });

            return {
                wallet,
                isDeployed,
                ...(deploymentTxHash && { deploymentTxHash }),
            };
        } catch (error) {
            const logContext: LogContext = {
                userId: request.userId,
                chainId: request.chainId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            logger.error('Failed to create wallet', logContext);
            throw this.createError('WALLET_CREATION_FAILED', 'Failed to create wallet', 500, error);
        }
    }

    // REMOVED: deployWallet method - wallets auto-deploy on creation in custodial mode

    /**
     * Get wallets for a user
     */
    async getWallets(request: GetWalletsRequest): Promise<GetWalletsResponse> {
        try {
            const { userId, chainId, isDeployed } = request;

            let query = this.db.select('aa_wallets').where({ user_id: userId });

            if (chainId !== undefined) {
                query = query.where({ chain_id: chainId });
            }

            if (isDeployed !== undefined) {
                query = query.where({ is_deployed: isDeployed });
            }

            const result = await query.orderBy('created_at', 'DESC').execute();
            const wallets = result.rows.map(this.mapDbRowToWallet);

            logger.info('Retrieved wallets for user', {
                userId,
                chainId,
                isDeployed,
                count: wallets.length,
            });

            return {
                wallets,
                total: wallets.length,
            };
        } catch (error) {
            const logContext: LogContext = {
                userId: request.userId,
                chainId: request.chainId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            logger.error('Failed to get wallets', logContext);
            throw this.createError('WALLET_FETCH_FAILED', 'Failed to get wallets', 500, error);
        }
    }

    /**
     * Get wallet status with onchain verification
     */
    async getWalletStatus(request: WalletStatusRequest): Promise<WalletStatusResponse> {
        try {
            const { walletId, checkOnchain = true } = request;

            const wallet = await this.getWalletByIdInternal(walletId);
            if (!wallet) {
                throw this.createError('WALLET_NOT_FOUND', 'Wallet not found', 404);
            }

            let onchainStatus = {
                isDeployed: wallet.isDeployed,
                balance: '0',
                nonce: 0,
            };

            if (checkOnchain) {
                try {
                    // Check actual onchain status
                    const kernelCheck = await this.zeroDevClient.isKernelAccount(
                        wallet.chainId,
                        wallet.address as Address
                    );

                    const balance = await this.zeroDevClient.getAccountBalance(
                        wallet.chainId,
                        wallet.address as Address
                    );

                    const nonce = await this.zeroDevClient.getAccountNonce(
                        wallet.chainId,
                        wallet.address as Address
                    );

                    onchainStatus = {
                        isDeployed: kernelCheck.isDeployed,
                        balance: balance.formattedBalance,
                        nonce,
                    };

                    // Update database if status changed
                    if (wallet.isDeployed !== kernelCheck.isDeployed) {
                        await this.updateWalletDeployment(walletId, undefined, kernelCheck.isDeployed);
                        wallet.isDeployed = kernelCheck.isDeployed;
                    }
                } catch (error) {
                    logger.warn('Failed to check onchain status', {
                        walletId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            return {
                wallet,
                onchainStatus,
            };
        } catch (error) {
            const logContext: LogContext = {
                walletId: request.walletId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            logger.error('Failed to get wallet status', logContext);
            throw this.createError('WALLET_STATUS_FAILED', 'Failed to get wallet status', 500, error);
        }
    }

    // REMOVED: batchCreateWallets and createMultiChainWallets methods
    // Users create wallets individually as needed

    /**
     * Validate an address and check if it's a Kernel account
     */
    async validateAddress(request: ValidateAddressRequest): Promise<ValidateAddressResponse> {
        try {
            const { address, chainId } = request;

            // Basic address validation
            const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
            if (!isValid) {
                return {
                    isValid: false,
                    isContract: false,
                    isKernelAccount: false,
                };
            }

            // Check onchain status
            const kernelCheck = await this.zeroDevClient.isKernelAccount(
                chainId,
                address as Address
            );

            return {
                isValid: true,
                isContract: kernelCheck.isDeployed,
                isKernelAccount: kernelCheck.isKernel,
                ...(kernelCheck.kernelVersion && { kernelVersion: kernelCheck.kernelVersion }),
            };
        } catch (error) {
            const logContext: LogContext = {
                address: request.address,
                chainId: request.chainId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            logger.error('Failed to validate address', logContext);
            throw this.createError('ADDRESS_VALIDATION_FAILED', 'Failed to validate address', 500, error);
        }
    }



    /**
     * Check gas sponsorship status for a user/wallet
     */
    async checkGasSponsorship(
        userId: string,
        walletAddress: Address,
        chainId: number
    ): Promise<{
        hasSponsorship: boolean;
        dailyRemaining?: string;
        monthlyRemaining?: string;
        reason?: string;
    }> {
        return this.zeroDevClient.checkGasSponsorship(userId, walletAddress, chainId);
    }

    /**
     * Get wallet by ID (public method)
     */
    async getWalletById(walletId: string): Promise<AAWallet | null> {
        return this.getWalletByIdInternal(walletId);
    }

    // Private helper methods

    private async saveWallet(wallet: AAWallet, privateKey: string): Promise<void> {
        // Start transaction
        await this.db.transaction(async () => {
            // Save wallet
            await this.db.insert('aa_wallets', {
                id: wallet.id,
                user_id: wallet.userId,
                address: wallet.address,
                owner_address: wallet.ownerAddress,
                owner_type: wallet.ownerType,
                chain_id: wallet.chainId,
                aa_standard: wallet.aaStandard,
                kernel_version: wallet.kernelVersion,
                salt: wallet.salt,
                factory_address: wallet.factoryAddress,
                implementation_address: wallet.implementationAddress,
                entry_point_address: wallet.entryPointAddress,
                is_deployed: wallet.isDeployed,
                created_at: wallet.createdAt,
                updated_at: wallet.updatedAt,
            }).execute();

            // Save encrypted private key (would use KMS in production)
            await this.db.insert('wallet_keys', {
                wallet_id: wallet.id,
                encrypted_private_key: this.encryptPrivateKey(privateKey),
                created_at: new Date(),
            }).execute();
        });
    }

    private async getWalletByIdInternal(walletId: string): Promise<AAWallet | null> {
        const result = await this.db
            .select('aa_wallets')
            .where({ id: walletId })
            .execute();

        return result.rows[0] ? this.mapDbRowToWallet(result.rows[0]) : null;
    }

    private async getUserWalletByChain(userId: string, chainId: number): Promise<AAWallet | null> {
        const result = await this.db
            .select('aa_wallets')
            .where({ user_id: userId, chain_id: chainId })
            .execute();

        return result.rows[0] ? this.mapDbRowToWallet(result.rows[0]) : null;
    }

    private async getWalletPrivateKey(walletId: string): Promise<string> {
        const result = await this.db
            .select('wallet_keys')
            .where({ wallet_id: walletId })
            .execute();

        if (!result.rows[0]) {
            throw this.createError('PRIVATE_KEY_NOT_FOUND', 'Private key not found', 404);
        }

        return this.decryptPrivateKey(result.rows[0].encrypted_private_key);
    }

    private async updateWalletDeployment(
        walletId: string,
        txHash?: string,
        isDeployed?: boolean,
        actualAddress?: string
    ): Promise<void> {
        const updateData: any = { updated_at: new Date() };

        if (txHash) updateData.deployment_tx_hash = txHash;
        if (isDeployed !== undefined) updateData.is_deployed = isDeployed;
        if (actualAddress) updateData.address = actualAddress; // Update with actual deployed address

        await this.db
            .update('aa_wallets', updateData)
            .where({ id: walletId })
            .execute();
    }

    private mapDbRowToWallet(row: any): AAWallet {
        return {
            id: row.id,
            userId: row.user_id,
            address: row.address,
            ownerAddress: row.owner_address,
            ownerType: row.owner_type || 'privy-social', // Default fallback
            chainId: row.chain_id,
            aaStandard: row.aa_standard || 'ERC-4337', // Default fallback
            kernelVersion: row.kernel_version,
            salt: row.salt,
            factoryAddress: row.factory_address,
            implementationAddress: row.implementation_address,
            entryPointAddress: row.entry_point_address || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Default fallback
            isDeployed: row.is_deployed,
            deploymentTxHash: row.deployment_tx_hash,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }

    private encryptPrivateKey(privateKey: string): string {
        // In production, use AWS KMS or similar
        // For now, simple base64 encoding (NOT SECURE)
        return Buffer.from(privateKey).toString('base64');
    }

    private decryptPrivateKey(encryptedKey: string): string {
        // In production, use AWS KMS or similar
        // For now, simple base64 decoding (NOT SECURE)
        return Buffer.from(encryptedKey, 'base64').toString();
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