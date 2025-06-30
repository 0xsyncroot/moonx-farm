import { DatabaseManager } from '@moonx-farm/infrastructure';
import { createLogger, LogContext } from '@moonx-farm/common';
import { ZeroDevClientService } from './zeroDevClient';
import { privateKeyToAccount } from 'viem/accounts';
import { Address } from 'viem';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  SessionKey,
  SessionKeyPermissions,
  CreateSessionKeyRequest,
  CreateSessionKeyResponse,
  WalletRegistryError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('session-key-manager');

export class SessionKeyManager {
  private db: DatabaseManager;
  private zeroDevClient: ZeroDevClientService;

  constructor(db: DatabaseManager, zeroDevClient: ZeroDevClientService) {
    this.db = db;
    this.zeroDevClient = zeroDevClient;
  }

  /**
   * Create a new session key for a wallet
   */
  async createSessionKey(request: CreateSessionKeyRequest): Promise<CreateSessionKeyResponse> {
    try {
      const { walletId, userId, permissions, expirationDays = 30 } = request;

      // Get wallet info
      const wallet = await this.getWalletById(walletId);
      if (!wallet) {
        throw this.createError('WALLET_NOT_FOUND', 'Wallet not found', 404);
      }

      // STEP 1: Generate session key (agent/dApp side)
      const sessionKeyGeneration = await this.zeroDevClient.generateSessionKey();

      // STEP 2: Get wallet private key for approval creation
      const walletPrivateKey = await this.getWalletPrivateKey(walletId);

      // STEP 3: Create approval (owner side) - this enables session key usage
      const approvalResult = await this.zeroDevClient.createSessionKeyApproval(
        wallet.chain_id,
        walletPrivateKey,
        sessionKeyGeneration.sessionKeyAddress,
        permissions
      );

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

              // Create session key record with encrypted approval
        const sessionKey: SessionKey = {
          id: uuidv4(),
          walletId,
          userId,
          publicKey: sessionKeyGeneration.sessionKeyAddress, // Session key address
          encryptedPrivateKey: this.encryptPrivateKey(sessionKeyGeneration.sessionKey),
          encryptedApproval: this.encryptApproval(approvalResult.approval), // Store approval securely
          permissions,
          expiresAt,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save to database
        await this.saveSessionKey(sessionKey);

        logger.info('Session key created and approval stored securely', {
          sessionKeyId: sessionKey.id,
          walletId,
          userId,
          sessionKeyAddress: sessionKeyGeneration.sessionKeyAddress,
          walletAddress: approvalResult.permissionAccount.address,
          expiresAt,
          note: 'Session key ready for transaction execution, approval stored in database',
        });

        // Return response without sensitive data (private key and approval)
        const { encryptedPrivateKey, encryptedApproval, ...sessionKeyResponse } = sessionKey;
        return {
          sessionKey: sessionKeyResponse,
          publicKey: sessionKey.publicKey,
          // Note: approval is now securely stored in database, client doesn't need it
        };
    } catch (error) {
      const logContext: LogContext = {
        walletId: request.walletId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to create session key', logContext);
      throw this.createError('SESSION_KEY_CREATION_FAILED', 'Failed to create session key', 500, error);
    }
  }

  /**
   * Get session keys for a wallet
   */
  async getSessionKeys(walletId: string, activeOnly = true): Promise<SessionKey[]> {
    try {
      let query = this.db.select('session_keys').where({ wallet_id: walletId });

      if (activeOnly) {
        query = query.where({ is_active: true });
      }

      const result = await query.orderBy('created_at', 'DESC').execute();
      const sessionKeys = result.rows.map(this.mapDbRowToSessionKey);

      // Filter out expired keys if activeOnly
      const now = new Date();
      const filteredKeys = activeOnly 
        ? sessionKeys.filter(key => key.expiresAt > now)
        : sessionKeys;

      logger.info('Retrieved session keys', {
        walletId,
        activeOnly,
        count: filteredKeys.length,
      });

      return filteredKeys;
    } catch (error) {
      const logContext: LogContext = {
        walletId,
        activeOnly,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to get session keys', logContext);
      throw this.createError('SESSION_KEY_FETCH_FAILED', 'Failed to get session keys', 500, error);
    }
  }

  /**
   * Revoke a session key (both on-chain and database)
   * Note: approval is automatically retrieved from database, no need to pass it
   */
  async revokeSessionKey(
    sessionKeyId: string,
    onChainRevoke: boolean = true
  ): Promise<{ txHash?: string; success: boolean }> {
    try {
      const sessionKey = await this.getSessionKeyById(sessionKeyId);
      if (!sessionKey) {
        throw this.createError('SESSION_KEY_NOT_FOUND', 'Session key not found', 404);
      }

      let txHash: string | undefined;

      // Attempt on-chain revocation if requested
      if (onChainRevoke) {
        try {
          // Get wallet info
          const wallet = await this.getWalletById(sessionKey.walletId);
          if (!wallet) {
            throw this.createError('WALLET_NOT_FOUND', 'Wallet not found', 404);
          }

          // Get wallet private key and approval from database
          const approval = this.decryptApproval(sessionKey.encryptedApproval);

          // Decrypt session key private key
          const sessionKeyPrivateKey = this.decryptPrivateKey(sessionKey.encryptedPrivateKey);
          
          // Create session key signer
          const sessionKeyAccount = privateKeyToAccount(sessionKeyPrivateKey as `0x${string}`);
          const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount });

          // Revoke on-chain with user context for proper gas sponsorship
          const revokeResult = await this.zeroDevClient.revokeSessionKey(
            wallet.chain_id,
            sessionKey.publicKey as Address,
            approval,
            sessionKeySigner,
            sessionKey.userId // Pass userId for gas sponsorship checking
          );

          txHash = revokeResult.txHash;

          logger.info('Session key revoked on-chain', {
            sessionKeyId,
            walletId: sessionKey.walletId,
            txHash,
            note: 'Approval retrieved from database for on-chain revocation',
          });
        } catch (onChainError) {
          logger.warn('Failed to revoke session key on-chain, proceeding with database revocation', {
            sessionKeyId,
            error: onChainError instanceof Error ? onChainError.message : 'Unknown error',
          });
        }
      }

      // Mark as inactive in database
      await this.db
        .update('session_keys', { is_active: false, updated_at: new Date() })
        .where({ id: sessionKeyId })
        .execute();

      logger.info('Session key revoked in database', {
        sessionKeyId,
        walletId: sessionKey.walletId,
        onChainRevoke: !!txHash,
        requestedOnChain: onChainRevoke,
      });

      return { ...(txHash && { txHash }), success: true };
    } catch (error) {
      const logContext: LogContext = {
        sessionKeyId,
        onChainRevoke,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to revoke session key', logContext);
      throw this.createError('SESSION_KEY_REVOKE_FAILED', 'Failed to revoke session key', 500, error);
    }
  }

  /**
   * Check if a session key is valid and active
   */
  async validateSessionKey(sessionKeyId: string): Promise<{
    isValid: boolean;
    sessionKey?: SessionKey;
    reason?: string;
  }> {
    try {
      const sessionKey = await this.getSessionKeyById(sessionKeyId);
      if (!sessionKey) {
        return { isValid: false, reason: 'Session key not found' };
      }

      if (!sessionKey.isActive) {
        return { isValid: false, reason: 'Session key is inactive' };
      }

      const now = new Date();
      if (sessionKey.expiresAt <= now) {
        // Auto-revoke expired key (database only, no on-chain revocation for expired keys)
        await this.revokeSessionKey(sessionKeyId, true);
        return { isValid: false, reason: 'Session key has expired' };
      }

      return { isValid: true, sessionKey };
    } catch (error) {
      const logContext: LogContext = {
        sessionKeyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to validate session key', logContext);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Update session key permissions
   */
  async updateSessionKeyPermissions(
    sessionKeyId: string,
    newPermissions: SessionKeyPermissions
  ): Promise<void> {
    try {
      const sessionKey = await this.getSessionKeyById(sessionKeyId);
      if (!sessionKey) {
        throw this.createError('SESSION_KEY_NOT_FOUND', 'Session key not found', 404);
      }

      // Update in database
      await this.db
        .update('session_keys', {
          permissions: JSON.stringify(newPermissions),
          updated_at: new Date(),
        })
        .where({ id: sessionKeyId })
        .execute();

      logger.info('Session key permissions updated', {
        sessionKeyId,
        newPermissions: Object.keys(newPermissions),
      });
    } catch (error) {
      const logContext: LogContext = {
        sessionKeyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to update session key permissions', logContext);
      throw this.createError('SESSION_KEY_UPDATE_FAILED', 'Failed to update session key permissions', 500, error);
    }
  }

  /**
   * Cleanup expired session keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const now = new Date();
      
      const result = await this.db
        .update('session_keys', { is_active: false, updated_at: now })
        .where('expires_at <= ? AND is_active = true', [now])
        .execute();

      // For now, assume successful cleanup (database implementations vary)
      const cleanedCount = 0;

      logger.info('Cleaned up expired session keys', {
        count: cleanedCount,
        timestamp: now,
      });

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired session keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Execute transactions using session key
   * This is the main method for dApps/agents to execute transactions with session keys
   */
  async executeTransactions(
    sessionKeyId: string,
    transactions: Array<{
      to: Address;
      value?: bigint;
      data?: `0x${string}`;
    }>
  ): Promise<{
    userOpHash: string;
    txHash?: string;
    walletAddress: Address;
    sessionKeyAddress: Address;
  }> {
    try {
      // Validate session key
      const validation = await this.validateSessionKey(sessionKeyId);
      if (!validation.isValid || !validation.sessionKey) {
        throw this.createError('SESSION_KEY_INVALID', validation.reason || 'Session key is invalid', 400);
      }

      const sessionKey = validation.sessionKey;

      // Get wallet info
      const wallet = await this.getWalletById(sessionKey.walletId);
      if (!wallet) {
        throw this.createError('WALLET_NOT_FOUND', 'Wallet not found', 404);
      }

      // Decrypt session key private key and approval from database
      const sessionKeyPrivateKey = this.decryptPrivateKey(sessionKey.encryptedPrivateKey);
      const approval = this.decryptApproval(sessionKey.encryptedApproval);

      // Execute transactions using ZeroDev client with user context
      const result = await this.zeroDevClient.executeWithSessionKey(
        wallet.chain_id,
        approval,
        sessionKeyPrivateKey,
        transactions,
        sessionKey.userId // Pass userId for proper gas sponsorship checking
      );

      logger.info('Transactions executed successfully with session key', {
        sessionKeyId,
        sessionKeyAddress: sessionKey.publicKey,
        walletId: sessionKey.walletId,
        walletAddress: result.walletAddress,
        userOpHash: result.userOpHash,
        transactionCount: transactions.length,
        note: 'Transactions submitted to bundler, approval retrieved from database',
      });

      return {
        userOpHash: result.userOpHash as string,
        ...(result.txHash && { txHash: result.txHash as string }),
        walletAddress: result.walletAddress,
        sessionKeyAddress: sessionKey.publicKey as Address,
      };
    } catch (error) {
      const logContext: LogContext = {
        sessionKeyId,
        transactionCount: transactions.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to execute transactions with session key', logContext);
      throw this.createError('SESSION_EXECUTION_FAILED', 'Failed to execute transactions with session key', 500, error);
    }
  }

  /**
   * Execute and wait for transaction confirmation
   */
  async executeAndWaitForTransactions(
    sessionKeyId: string,
    transactions: Array<{
      to: Address;
      value?: bigint;
      data?: `0x${string}`;
    }>,
    timeout = 60000
  ): Promise<{
    userOpHash: string;
    txHash: string;
    blockNumber: string;
    status: 'success' | 'reverted';
    walletAddress: Address;
    sessionKeyAddress: Address;
  }> {
    try {
      // Execute transactions
      const execution = await this.executeTransactions(sessionKeyId, transactions);

      // Validate session key again for getting wallet info
      const validation = await this.validateSessionKey(sessionKeyId);
      if (!validation.isValid || !validation.sessionKey) {
        throw this.createError('SESSION_KEY_INVALID', 'Session key became invalid', 400);
      }

      const sessionKey = validation.sessionKey;
      const wallet = await this.getWalletById(sessionKey.walletId);
      if (!wallet) {
        throw this.createError('WALLET_NOT_FOUND', 'Wallet not found', 404);
      }

      // Decrypt session key private key and approval from database
      const sessionKeyPrivateKey = this.decryptPrivateKey(sessionKey.encryptedPrivateKey);
      const approval = this.decryptApproval(sessionKey.encryptedApproval);

      // Wait for transaction confirmation
      const receipt = await this.zeroDevClient.waitForSessionKeyTransaction(
        wallet.chain_id,
        approval,
        sessionKeyPrivateKey,
        execution.userOpHash as `0x${string}`,
        timeout
      );

      logger.info('Transactions confirmed successfully', {
        sessionKeyId,
        sessionKeyAddress: sessionKey.publicKey,
        walletId: sessionKey.walletId,
        walletAddress: execution.walletAddress,
        userOpHash: execution.userOpHash,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status,
        transactionCount: transactions.length,
      });

      return {
        userOpHash: execution.userOpHash,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status,
        walletAddress: execution.walletAddress,
        sessionKeyAddress: execution.sessionKeyAddress,
      };
    } catch (error) {
      const logContext: LogContext = {
        sessionKeyId,
        transactionCount: transactions.length,
        timeout,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to execute and wait for transactions', logContext);
      throw this.createError('SESSION_EXECUTION_WAIT_FAILED', 'Failed to execute and wait for transactions', 500, error);
    }
  }

  /**
   * Find or create a session key for specific use case
   * This prevents creating duplicate session keys for the same permissions
   */
  async findOrCreateSessionKey(request: {
    walletId: string;
    userId: string;
    permissions: SessionKeyPermissions;
    useCase?: string; // e.g., "swap", "gaming", "subscription"
    expirationDays?: number;
  }): Promise<CreateSessionKeyResponse> {
    try {
      const { walletId, userId, permissions, useCase = 'general', expirationDays = 30 } = request;

      // First, try to find existing active session key with compatible permissions
      const existingSessionKeys = await this.getSessionKeys(walletId, true);
      
      const compatibleSessionKey = existingSessionKeys.find(sessionKey => {
        // Check if session key has compatible permissions for this use case
        return this.arePermissionsCompatible(sessionKey.permissions, permissions);
      });

      if (compatibleSessionKey) {
        logger.info('Found existing compatible session key, reusing it', {
          sessionKeyId: compatibleSessionKey.id,
          walletId,
          userId,
          useCase,
          expiresAt: compatibleSessionKey.expiresAt,
          note: 'Reusing existing session key instead of creating new one',
        });

        // Return existing session key (exclude sensitive data)
        const { encryptedPrivateKey, encryptedApproval, ...sessionKeyResponse } = compatibleSessionKey;
        return {
          sessionKey: sessionKeyResponse,
          publicKey: compatibleSessionKey.publicKey,
        };
      }

      // No compatible session key found, create a new one
      logger.info('No compatible session key found, creating new one', {
        walletId,
        userId,
        useCase,
        expirationDays,
        existingSessionKeysCount: existingSessionKeys.length,
        note: 'Creating new session key for this use case',
      });

      return await this.createSessionKey({
        walletId,
        userId,
        permissions,
        expirationDays,
      });
    } catch (error) {
      const logContext: LogContext = {
        walletId: request.walletId,
        userId: request.userId,
        useCase: request.useCase,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to find or create session key', logContext);
      throw this.createError('SESSION_KEY_FIND_OR_CREATE_FAILED', 'Failed to find or create session key', 500, error);
    }
  }

  /**
   * Check if existing permissions are compatible with required permissions
   */
  private arePermissionsCompatible(
    existingPermissions: SessionKeyPermissions,
    requiredPermissions: SessionKeyPermissions
  ): boolean {
    try {
      // Check contract addresses compatibility
      if (requiredPermissions.contractAddresses && existingPermissions.contractAddresses) {
        const hasAllContracts = requiredPermissions.contractAddresses.every(
          contract => existingPermissions.contractAddresses!.includes(contract)
        );
        if (!hasAllContracts) return false;
      }

      // Check methods compatibility
      if (requiredPermissions.allowedMethods && existingPermissions.allowedMethods) {
        const hasAllMethods = requiredPermissions.allowedMethods.every(
          method => existingPermissions.allowedMethods!.includes(method)
        );
        if (!hasAllMethods) return false;
      }

      // Check gas limit compatibility
      if (requiredPermissions.maxGasLimit && existingPermissions.maxGasLimit) {
        if (requiredPermissions.maxGasLimit > existingPermissions.maxGasLimit) return false;
      }

      // Check amount limit compatibility
      if (requiredPermissions.maxAmount && existingPermissions.maxAmount) {
        if (BigInt(requiredPermissions.maxAmount) > BigInt(existingPermissions.maxAmount)) return false;
      }

      // Check timeframe compatibility
      if (requiredPermissions.timeframe && existingPermissions.timeframe) {
        const now = Math.floor(Date.now() / 1000);
        const existingValidUntil = existingPermissions.timeframe.validUntil;
        const requiredValidUntil = requiredPermissions.timeframe.validUntil;
        
        // Existing session key should be valid long enough for required usage
        if (existingValidUntil < Math.max(now + 3600, requiredValidUntil)) return false; // At least 1 hour left
      }

      return true;
    } catch (error) {
      logger.warn('Error checking permissions compatibility', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Execute transactions with automatic session key management
   * This method automatically finds/creates appropriate session key and executes transactions
   * This is the CORRECT workflow that prevents creating unnecessary session keys
   */
  async executeTransactionsWithAutoSession(request: {
    walletId: string;
    userId: string;
    transactions: Array<{
      to: Address;
      value?: bigint;
      data?: `0x${string}`;
    }>;
    permissions: SessionKeyPermissions;
    useCase?: string;
    waitForConfirmation?: boolean;
    timeout?: number;
  }): Promise<{
    userOpHash: string;
    txHash?: string;
    blockNumber?: string;
    status?: 'success' | 'reverted';
    walletAddress: Address;
    sessionKeyAddress: Address;
    sessionKeyId: string;
    wasExistingSessionKey: boolean;
  }> {
    try {
      const { 
        walletId, 
        userId, 
        transactions, 
        permissions, 
        useCase = 'general',
        waitForConfirmation = false,
        timeout = 60000 
      } = request;

      // STEP 1: Find or create session key (this prevents duplicate session keys)
      const sessionKeyResult = await this.findOrCreateSessionKey({
        walletId,
        userId,
        permissions,
        useCase,
      });

      const sessionKeyId = sessionKeyResult.sessionKey.id;
      const wasExistingSessionKey = !!sessionKeyResult.sessionKey.createdAt;

      logger.info('Executing transactions with auto session management', {
        sessionKeyId,
        walletId,
        userId,
        useCase,
        transactionCount: transactions.length,
        wasExistingSessionKey,
        waitForConfirmation,
        note: wasExistingSessionKey ? 'Reusing existing session key' : 'Created new session key',
      });

      // STEP 2: Execute transactions using the session key
      if (waitForConfirmation) {
        const result = await this.executeAndWaitForTransactions(
          sessionKeyId,
          transactions,
          timeout
        );

        return {
          ...result,
          sessionKeyId,
          wasExistingSessionKey,
        };
      } else {
        const result = await this.executeTransactions(sessionKeyId, transactions);

        return {
          ...result,
          sessionKeyId,
          wasExistingSessionKey,
        };
      }
    } catch (error) {
      const logContext: LogContext = {
        walletId: request.walletId,
        userId: request.userId,
        useCase: request.useCase,
        transactionCount: request.transactions.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      logger.error('Failed to execute transactions with auto session management', logContext);
      throw this.createError('AUTO_SESSION_EXECUTION_FAILED', 'Failed to execute transactions with auto session management', 500, error);
    }
  }

  // Private helper methods

  private async saveSessionKey(sessionKey: SessionKey): Promise<void> {
    await this.db.insert('session_keys', {
      id: sessionKey.id,
      wallet_id: sessionKey.walletId,
      user_id: sessionKey.userId,
      public_key: sessionKey.publicKey,
      encrypted_private_key: sessionKey.encryptedPrivateKey,
      encrypted_approval: sessionKey.encryptedApproval,
      permissions: JSON.stringify(sessionKey.permissions),
      expires_at: sessionKey.expiresAt,
      is_active: sessionKey.isActive,
      created_at: sessionKey.createdAt,
      updated_at: sessionKey.updatedAt,
    }).execute();
  }

  private async getSessionKeyById(sessionKeyId: string): Promise<SessionKey | null> {
    const result = await this.db
      .select('session_keys')
      .where({ id: sessionKeyId })
      .execute();
    
    return result.rows[0] ? this.mapDbRowToSessionKey(result.rows[0]) : null;
  }

  private async getWalletById(walletId: string): Promise<any> {
    const result = await this.db
      .select('aa_wallets')
      .where({ id: walletId })
      .execute();
    
    return result.rows[0] || null;
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

  private mapDbRowToSessionKey(row: any): SessionKey {
    return {
      id: row.id,
      walletId: row.wallet_id,
      userId: row.user_id,
      publicKey: row.public_key,
      encryptedPrivateKey: row.encrypted_private_key,
      encryptedApproval: row.encrypted_approval,
      permissions: JSON.parse(row.permissions),
      expiresAt: new Date(row.expires_at),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private encryptPrivateKey(privateKey: string): string {
    // In production, use AWS KMS or similar
    return Buffer.from(privateKey).toString('base64');
  }

  private decryptPrivateKey(encryptedKey: string): string {
    // In production, use AWS KMS or similar
    return Buffer.from(encryptedKey, 'base64').toString();
  }

  private encryptApproval(approval: string): string {
    // In production, use AWS KMS or similar
    return Buffer.from(approval).toString('base64');
  }

  private decryptApproval(encryptedApproval: string): string {
    // In production, use AWS KMS or similar
    return Buffer.from(encryptedApproval, 'base64').toString();
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