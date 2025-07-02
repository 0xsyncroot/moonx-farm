import { FastifyReply, FastifyRequest } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { WalletService } from '../services/walletService';
import { SessionKeyManager } from '../services/sessionKeyManager';
import {
  CreateWalletRequest,
  GetWalletsRequest,
  WalletStatusRequest,
  CreateSessionKeyRequest,
  SessionKeyPermissions,
  ValidateAddressRequest,
  AuthenticatedRequest,
  WalletRegistryError,
} from '../types';

const logger = createLogger('wallet-controller');

export class WalletController {
  private walletService: WalletService;
  private sessionKeyManager: SessionKeyManager;

  constructor(walletService: WalletService, sessionKeyManager: SessionKeyManager) {
    this.walletService = walletService;
    this.sessionKeyManager = sessionKeyManager;
  }

  /**
   * Create a new AA wallet
   */
  async createWallet(
    request: FastifyRequest<{ Body: Omit<CreateWalletRequest, 'userId'> }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { ownerAddress, ownerType = 'privy-social', chainId, saltNonce } = request.body;

      const walletRequest: CreateWalletRequest = {
        userId: user.userId,
        ownerAddress,
        ownerType,
        chainId,
        ...(saltNonce && { saltNonce }),
      };

      const result = await this.walletService.createWallet(walletRequest);

      logger.info('Wallet created via API', {
        userId: user.userId,
        walletId: result.wallet.id,
        chainId,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'createWallet');
    }
  }

  // REMOVED: deployWallet method - wallets auto-deploy on creation in custodial mode

  /**
   * Get wallets for authenticated user
   */
  async getWallets(
    request: FastifyRequest<{ Querystring: Omit<GetWalletsRequest, 'userId'> }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { chainId, isDeployed } = request.query;

      const walletRequest: GetWalletsRequest = {
        userId: user.userId,
        ...(chainId && { chainId: Number(chainId) }),
        ...(isDeployed !== undefined && { isDeployed: Boolean(isDeployed) }),
      };

      const result = await this.walletService.getWallets(walletRequest);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'getWallets');
    }
  }

  /**
   * Get wallet status with onchain verification
   */
  async getWalletStatus(
    request: FastifyRequest<{ 
      Params: { walletId: string }; 
      Querystring: { checkOnchain?: string } 
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { walletId } = request.params;
      const { checkOnchain } = request.query;

      // Verify wallet ownership
      await this.verifyWalletOwnership(walletId, user.userId);

      const statusRequest: WalletStatusRequest = {
        walletId,
        checkOnchain: checkOnchain === 'true',
      };

      const result = await this.walletService.getWalletStatus(statusRequest);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'getWalletStatus');
    }
  }

  /**
   * Create session key for a wallet
   */
  async createSessionKey(
    request: FastifyRequest<{ 
      Body: Omit<CreateSessionKeyRequest, 'userId' | 'walletId'>;
      Params: { walletId: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { walletId } = request.params;
      const { permissions, expirationDays } = request.body;

      // Verify wallet ownership
      await this.verifyWalletOwnership(walletId, user.userId);

      const sessionKeyRequest: CreateSessionKeyRequest = {
        walletId,
        userId: user.userId,
        permissions,
        ...(expirationDays !== undefined && { expirationDays }),
      };

      const result = await this.sessionKeyManager.createSessionKey(sessionKeyRequest);

      logger.info('Session key created via API', {
        userId: user.userId,
        walletId,
        sessionKeyId: result.sessionKey.id,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'createSessionKey');
    }
  }

  /**
   * Get session keys for a wallet
   */
  async getSessionKeys(
    request: FastifyRequest<{ 
      Params: { walletId: string };
      Querystring: { activeOnly?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { walletId } = request.params;
      const { activeOnly } = request.query;

      // Verify wallet ownership
      await this.verifyWalletOwnership(walletId, user.userId);

      const result = await this.sessionKeyManager.getSessionKeys(
        walletId,
        activeOnly !== 'false'
      );

      return reply.status(200).send({
        success: true,
        data: { sessionKeys: result },
      });
    } catch (error) {
      return this.handleError(error, reply, 'getSessionKeys');
    }
  }

  /**
   * Revoke session key
   */
  async revokeSessionKey(
    request: FastifyRequest<{ 
      Params: { sessionKeyId: string };
      Body: { onChainRevoke?: boolean };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { sessionKeyId } = request.params;
      const { onChainRevoke = true } = request.body;

      // Get session key to verify ownership
      const sessionKeys = await this.sessionKeyManager.getSessionKeys('', false);
      const sessionKey = sessionKeys.find(sk => sk.id === sessionKeyId && sk.userId === user.userId);
      
      if (!sessionKey) {
        return reply.status(404).send({
          success: false,
          error: 'Session key not found or access denied',
        });
      }

      const result = await this.sessionKeyManager.revokeSessionKey(sessionKeyId, onChainRevoke);

      logger.info('Session key revoked via API', {
        userId: user.userId,
        sessionKeyId,
        onChainRevoke: !!result.txHash,
        requestedOnChain: onChainRevoke,
        note: 'Approval automatically retrieved from database',
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'revokeSessionKey');
    }
  }

  /**
   * Execute transactions using session key
   */
  async executeSessionKeyTransactions(
    request: FastifyRequest<{ 
      Body: {
        sessionKeyId: string;
        transactions: Array<{
          to: string;
          value?: string;
          data?: string;
        }>;
        waitForConfirmation?: boolean;
        timeout?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { sessionKeyId, transactions, waitForConfirmation = false, timeout = 60000 } = request.body;

      // Validate input
      if (!sessionKeyId || !transactions || transactions.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: sessionKeyId or transactions',
        });
      }

      // Transform transactions to proper format
      const formattedTransactions = transactions.map(tx => ({
        to: tx.to as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
        data: (tx.data || '0x') as `0x${string}`,
      }));

      let result;
      if (waitForConfirmation) {
        // Execute and wait for confirmation
        result = await this.sessionKeyManager.executeAndWaitForTransactions(
          sessionKeyId,
          formattedTransactions,
          timeout
        );
      } else {
        // Execute without waiting
        result = await this.sessionKeyManager.executeTransactions(
          sessionKeyId,
          formattedTransactions
        );
      }

      logger.info('Transactions executed via session key API', {
        userId: user.userId,
        sessionKeyId,
        transactionCount: transactions.length,
        waitForConfirmation,
        userOpHash: result.userOpHash,
        txHash: result.txHash || 'pending',
        note: 'Approval automatically retrieved from database',
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'executeSessionKeyTransactions');
    }
  }

  /**
   * Validate an address
   */
  async validateAddress(
    request: FastifyRequest<{ Body: ValidateAddressRequest }>,
    reply: FastifyReply
  ) {
    try {
      const { address, chainId } = request.body;

      const result = await this.walletService.validateAddress({ address, chainId });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'validateAddress');
    }
  }

  // REMOVED: batchCreateWallets and createMultiChainWallets methods
  // Users create wallets individually as needed

  /**
   * Health check endpoint
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      service: 'wallet-registry',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check gas sponsorship status for a wallet
   */
  async checkGasSponsorship(
    request: FastifyRequest<{ Params: { walletId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { walletId } = request.params;

      // Verify wallet ownership
      await this.verifyWalletOwnership(walletId, user.userId);

      // Get wallet to get its address and chain
      const wallet = await this.walletService.getWalletById(walletId);
      if (!wallet) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'WALLET_NOT_FOUND',
            message: 'Wallet not found',
          },
        });
      }

      const result = await this.walletService.checkGasSponsorship(
        user.userId,
        wallet.address as any,
        wallet.chainId
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply, 'checkGasSponsorship');
    }
  }

  /**
   * Execute transactions with automatic session key management (CORRECT WORKFLOW)
   * This prevents creating duplicate session keys and reuses existing compatible ones
   */
  async executeTransactionsWithAutoSession(
    request: FastifyRequest<{ 
      Body: {
        walletId: string;
        transactions: Array<{
          to: string;
          value?: string;
          data?: string;
        }>;
        permissions: {
          contractAddresses?: string[];
          allowedMethods?: string[];
          maxAmount?: string;
          maxGasLimit?: string;
          timeframe?: {
            validAfter: number;
            validUntil: number;
          };
        };
        useCase?: string;
        waitForConfirmation?: boolean;
        timeout?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as AuthenticatedRequest;
      const { 
        walletId, 
        transactions, 
        permissions, 
        useCase = 'general',
        waitForConfirmation = false, 
        timeout = 60000 
      } = request.body;

      // Validate input
      if (!walletId || !transactions || transactions.length === 0 || !permissions) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: walletId, transactions, or permissions',
        });
      }

      // Verify wallet ownership
      await this.verifyWalletOwnership(walletId, user.userId);

      // Transform transactions to proper format
      const formattedTransactions = transactions.map(tx => ({
        to: tx.to as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
        data: (tx.data || '0x') as `0x${string}`,
      }));

             // Transform permissions to match SessionKeyPermissions interface
       const sessionKeyPermissions: SessionKeyPermissions = {
         contractAddresses: permissions.contractAddresses || [],
         allowedMethods: permissions.allowedMethods || [],
         maxAmount: permissions.maxAmount || '0',
         maxGasLimit: permissions.maxGasLimit || '1000000',
         timeframe: permissions.timeframe || {
           validAfter: Math.floor(Date.now() / 1000),
           validUntil: Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days
         }
       };

       // Execute with auto session management (CORRECT WORKFLOW)
       const result = await this.sessionKeyManager.executeTransactionsWithAutoSession({
         walletId,
         userId: user.userId,
         transactions: formattedTransactions,
         permissions: sessionKeyPermissions,
         useCase,
         waitForConfirmation,
         timeout,
       });

      logger.info('Transactions executed with auto session management via API', {
        userId: user.userId,
        walletId,
        sessionKeyId: result.sessionKeyId,
        useCase,
        transactionCount: transactions.length,
        wasExistingSessionKey: result.wasExistingSessionKey,
        waitForConfirmation,
        userOpHash: result.userOpHash,
        txHash: result.txHash || 'pending',
        note: result.wasExistingSessionKey 
          ? 'Reused existing session key (CORRECT workflow)' 
          : 'Created new session key for this use case',
      });

      return reply.send({
        success: true,
        data: {
          ...result,
          message: result.wasExistingSessionKey 
            ? 'Transaction executed using existing session key' 
            : 'Transaction executed with new session key created for this use case'
        },
      });
    } catch (error) {
      return this.handleError(error, reply, 'executeTransactionsWithAutoSession');
    }
  }

  // Private helper methods

  private async verifyWalletOwnership(walletId: string, userId: string): Promise<void> {
    const wallets = await this.walletService.getWallets({ userId });
    const wallet = wallets.wallets.find(w => w.id === walletId);
    
    if (!wallet) {
      throw this.createError('WALLET_NOT_FOUND', 'Wallet not found or access denied', 404);
    }
  }

  private async verifySessionKeyOwnership(sessionKeyId: string, userId: string): Promise<void> {
    const validation = await this.sessionKeyManager.validateSessionKey(sessionKeyId);
    
    if (!validation.isValid || !validation.sessionKey) {
      throw this.createError('SESSION_KEY_NOT_FOUND', 'Session key not found', 404);
    }

    if (validation.sessionKey.userId !== userId) {
      throw this.createError('ACCESS_DENIED', 'Access denied to session key', 403);
    }
  }

  private async handleError(error: any, reply: FastifyReply, operation: string) {
    const logContext = {
      operation,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (error instanceof Error && 'statusCode' in error) {
      const walletError = error as WalletRegistryError;
      logger.warn(`Wallet registry error in ${operation}`, logContext);
      
      return reply.status(walletError.statusCode).send({
        success: false,
        error: {
          code: walletError.code,
          message: walletError.message,
        },
      });
    }

    logger.error(`Unexpected error in ${operation}`, logContext);
    
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }

  private createError(
    code: string,
    message: string,
    statusCode: number
  ): WalletRegistryError {
    const error = new Error(message) as WalletRegistryError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
} 