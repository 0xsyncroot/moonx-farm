import { DatabaseManager } from "@moonx/infrastructure";
import { createLogger, LogContext } from "@moonx/common";
import { Address } from 'viem';
import { http, createPublicClient } from 'viem';
import { base, baseSepolia, bsc, bscTestnet, sepolia, mainnet } from 'viem/chains';
import { 
  GasSponsorshipPolicy, 
  GasUsageRecord, 
  SponsorshipRequest,
  GasBudget,
  WalletRegistryError 
} from '../types';

const logger = createLogger('gas-manager');

export class GasManager {
  private db: DatabaseManager;
  private chains: Record<number, any>;
  private rpcUrls: Record<number, string>;

  constructor(db: DatabaseManager) {
    this.db = db;
    
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
   * Create gas sponsorship policy for a user/wallet
   */
  async createSponsorshipPolicy(policy: Omit<GasSponsorshipPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<GasSponsorshipPolicy> {
    try {
      const policyId = this.generateId();
      const now = new Date();

      const gasPolicy: GasSponsorshipPolicy = {
        id: policyId,
        ...policy,
        createdAt: now,
        updatedAt: now,
      };

      await this.saveSponsorshipPolicy(gasPolicy);

      logger.info('Gas sponsorship policy created', {
        policyId,
        userId: policy.userId,
        walletId: policy.walletId,
        dailyLimit: policy.dailyLimit,
        monthlyLimit: policy.monthlyLimit,
      });

      return gasPolicy;
    } catch (error) {
      logger.error('Failed to create sponsorship policy', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw this.createError('SPONSORSHIP_POLICY_CREATION_FAILED', 'Failed to create sponsorship policy', 500, error);
    }
  }

  /**
   * Check if gas sponsorship is available for a transaction
   */
  async checkSponsorshipEligibility(request: SponsorshipRequest): Promise<{
    eligible: boolean;
    reason?: string;
    estimatedGasCost?: string;
    policyId?: string;
  }> {
    try {
      const { walletAddress, chainId, estimatedGas, userId } = request;

      // Get active sponsorship policies for user/wallet
      const policies = await this.getActivePolicies(userId, walletAddress);
      if (policies.length === 0) {
        return {
          eligible: false,
          reason: 'No active sponsorship policy found',
        };
      }

      // Get current gas price
      const gasPrice = await this.getGasPrice(chainId);
      const estimatedGasCost = (BigInt(estimatedGas) * gasPrice).toString();

      // Check each policy for eligibility
      for (const policy of policies) {
        const eligibilityCheck = await this.checkPolicyLimits(policy, estimatedGasCost);
        if (eligibilityCheck.eligible) {
          return {
            eligible: true,
            estimatedGasCost,
            policyId: policy.id,
          };
        }
      }

      return {
        eligible: false,
        reason: 'All policies exceeded their limits',
        estimatedGasCost,
      };
    } catch (error) {
      logger.error('Failed to check sponsorship eligibility', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        eligible: false,
        reason: 'Error checking eligibility',
      };
    }
  }

  /**
   * Record gas usage for a sponsored transaction
   * Called by ZeroDevClient after successful sponsorship
   */
  async recordSponsoredTransaction(
    userId: string,
    walletAddress: Address,
    chainId: number,
    userOperationHash: string,
    gasCost: string,
    policyId: string
  ): Promise<void> {
    try {
      const usageRecord: Omit<GasUsageRecord, 'id' | 'timestamp'> = {
        userId,
        walletAddress,
        chainId,
        userOperationHash,
        gasCost,
        policyId,
        sponsored: true,
      };

      await this.recordGasUsage(usageRecord);

      logger.info('Sponsored transaction recorded', {
        userId,
        walletAddress,
        chainId,
        gasCost,
        policyId,
        userOperationHash,
      });
    } catch (error) {
      logger.error('Failed to record sponsored transaction', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - recording failure shouldn't break transaction
    }
  }

  /**
   * Get gas usage statistics for a user/wallet
   */
  async getGasUsageStats(userId: string, walletAddress?: Address, timeframe: 'day' | 'week' | 'month' = 'month'): Promise<{
    totalGasCost: string;
    transactionCount: number;
    averageGasCost: string;
    sponsoredTransactions: number;
    sponsorshipSavings: string;
  }> {
    try {
      const timeframeHours = timeframe === 'day' ? 24 : timeframe === 'week' ? 168 : 720; // 30 days
      const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

      let query = `
        SELECT * FROM gas_usage 
        WHERE user_id = ? AND timestamp >= ?
      `;
      const params: any[] = [userId, since];

      if (walletAddress) {
        query += ' AND wallet_address = ?';
        params.push(walletAddress);
      }

      const result = await this.db.raw(query, params);
      const records = result.rows.map(this.mapDbRowToGasUsage);

      const totalGasCost = records.reduce((sum, record) => sum + BigInt(record.gasCost), BigInt(0));
      const sponsoredRecords = records.filter(record => record.sponsored);
      const sponsorshipSavings = sponsoredRecords.reduce((sum, record) => sum + BigInt(record.gasCost), BigInt(0));

      return {
        totalGasCost: totalGasCost.toString(),
        transactionCount: records.length,
        averageGasCost: records.length > 0 ? (totalGasCost / BigInt(records.length)).toString() : '0',
        sponsoredTransactions: sponsoredRecords.length,
        sponsorshipSavings: sponsorshipSavings.toString(),
      };
    } catch (error) {
      logger.error('Failed to get gas usage stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw this.createError('GAS_STATS_FAILED', 'Failed to get gas usage statistics', 500, error);
    }
  }

  /**
   * Update sponsorship policy limits
   */
  async updatePolicyLimits(policyId: string, updates: Partial<Pick<GasSponsorshipPolicy, 'dailyLimit' | 'monthlyLimit' | 'perTransactionLimit' | 'allowedContracts' | 'isActive'>>): Promise<void> {
    try {
      const policy = await this.getPolicyById(policyId);
      if (!policy) {
        throw this.createError('POLICY_NOT_FOUND', 'Sponsorship policy not found', 404);
      }

      const updateData: any = {
        ...updates,
        updated_at: new Date(),
      };

      if (updates.allowedContracts) {
        updateData.allowed_contracts = JSON.stringify(updates.allowedContracts);
        delete updateData.allowedContracts;
      }

      await this.db.raw(
        'UPDATE gas_sponsorship_policies SET ? WHERE id = ?',
        [updateData, policyId]
      );

      logger.info('Sponsorship policy updated', {
        policyId,
        updates: Object.keys(updates),
      });
    } catch (error) {
      logger.error('Failed to update sponsorship policy', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw this.createError('POLICY_UPDATE_FAILED', 'Failed to update sponsorship policy', 500, error);
    }
  }

  /**
   * Get current gas budgets for all active policies
   */
  async getGasBudgets(userId?: string): Promise<GasBudget[]> {
    try {
      let query = 'SELECT * FROM gas_sponsorship_policies WHERE is_active = true';
      const params: any[] = [];
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const result = await this.db.raw(query, params);
      const policies = result.rows.map(this.mapDbRowToPolicy);

      const budgets = await Promise.all(
        policies
          .filter(policy => policy.walletId) // Only include policies with walletId
          .map(async (policy) => {
            const dailyUsage = await this.getPolicyUsage(policy.id, 'day');
            const monthlyUsage = await this.getPolicyUsage(policy.id, 'month');

            return {
              policyId: policy.id,
              userId: policy.userId,
              walletId: policy.walletId!, // Safe because we filtered above
              dailyLimit: policy.dailyLimit,
              dailyUsed: dailyUsage,
              dailyRemaining: (BigInt(policy.dailyLimit) - BigInt(dailyUsage)).toString(),
              monthlyLimit: policy.monthlyLimit,
              monthlyUsed: monthlyUsage,
              monthlyRemaining: (BigInt(policy.monthlyLimit) - BigInt(monthlyUsage)).toString(),
              isActive: policy.isActive,
            };
          })
      );

      return budgets;
    } catch (error) {
      logger.error('Failed to get gas budgets', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw this.createError('BUDGET_FETCH_FAILED', 'Failed to get gas budgets', 500, error);
    }
  }

  // Private helper methods

  private async getActivePolicies(userId: string, walletAddress?: Address): Promise<GasSponsorshipPolicy[]> {
    let query = 'SELECT * FROM gas_sponsorship_policies WHERE user_id = ? AND is_active = true';
    const params: any[] = [userId];

    if (walletAddress) {
      query += ' AND (wallet_address = ? OR wallet_address IS NULL)';
      params.push(walletAddress);
    }

    const result = await this.db.raw(query, params);
    return result.rows.map(this.mapDbRowToPolicy);
  }

  private async checkPolicyLimits(policy: GasSponsorshipPolicy, estimatedCost: string): Promise<{ eligible: boolean; reason?: string }> {
    // Check per-transaction limit
    if (policy.perTransactionLimit && BigInt(estimatedCost) > BigInt(policy.perTransactionLimit)) {
      return {
        eligible: false,
        reason: 'Transaction exceeds per-transaction limit',
      };
    }

    // Check daily limit
    const dailyUsage = await this.getPolicyUsage(policy.id, 'day');
    if (BigInt(dailyUsage) + BigInt(estimatedCost) > BigInt(policy.dailyLimit)) {
      return {
        eligible: false,
        reason: 'Would exceed daily limit',
      };
    }

    // Check monthly limit
    const monthlyUsage = await this.getPolicyUsage(policy.id, 'month');
    if (BigInt(monthlyUsage) + BigInt(estimatedCost) > BigInt(policy.monthlyLimit)) {
      return {
        eligible: false,
        reason: 'Would exceed monthly limit',
      };
    }

    return { eligible: true };
  }

  private async getPolicyUsage(policyId: string, timeframe: 'day' | 'month'): Promise<string> {
    const hours = timeframe === 'day' ? 24 : 720; // 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const result = await this.db.raw(
      'SELECT SUM(CAST(gas_cost AS UNSIGNED)) as total FROM gas_usage WHERE policy_id = ? AND timestamp >= ? AND sponsored = true',
      [policyId, since]
    );

    return result.rows[0]?.total?.toString() || '0';
  }

  private async getGasPrice(chainId: number): Promise<bigint> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(this.rpcUrls[chainId]),
      });

      return await publicClient.getGasPrice();
    } catch (error) {
      logger.warn('Failed to get current gas price, using default', {
        chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return BigInt('20000000000'); // 20 gwei default
    }
  }

  private async recordGasUsage(usage: Omit<GasUsageRecord, 'id' | 'timestamp'>): Promise<void> {
    const usageRecord: GasUsageRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      ...usage,
    };

    await this.db.raw(
      'INSERT INTO gas_usage (id, user_id, wallet_address, chain_id, user_operation_hash, gas_cost, policy_id, sponsored, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        usageRecord.id,
        usageRecord.userId,
        usageRecord.walletAddress,
        usageRecord.chainId,
        usageRecord.userOperationHash,
        usageRecord.gasCost,
        usageRecord.policyId,
        usageRecord.sponsored,
        usageRecord.timestamp,
      ]
    );
  }

  private async saveSponsorshipPolicy(policy: GasSponsorshipPolicy): Promise<void> {
    await this.db.raw(
      'INSERT INTO gas_sponsorship_policies (id, user_id, wallet_id, wallet_address, daily_limit, monthly_limit, per_transaction_limit, allowed_contracts, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        policy.id,
        policy.userId,
        policy.walletId,
        policy.walletAddress,
        policy.dailyLimit,
        policy.monthlyLimit,
        policy.perTransactionLimit,
        JSON.stringify(policy.allowedContracts || []),
        policy.isActive,
        policy.createdAt,
        policy.updatedAt,
      ]
    );
  }

  private async getPolicyById(policyId: string): Promise<GasSponsorshipPolicy | null> {
    const result = await this.db.raw(
      'SELECT * FROM gas_sponsorship_policies WHERE id = ?',
      [policyId]
    );
    
    return result.rows[0] ? this.mapDbRowToPolicy(result.rows[0]) : null;
  }

  private mapDbRowToPolicy(row: any): GasSponsorshipPolicy {
    return {
      id: row.id,
      userId: row.user_id,
      walletId: row.wallet_id,
      walletAddress: row.wallet_address,
      dailyLimit: row.daily_limit,
      monthlyLimit: row.monthly_limit,
      perTransactionLimit: row.per_transaction_limit,
      allowedContracts: JSON.parse(row.allowed_contracts || '[]'),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbRowToGasUsage(row: any): GasUsageRecord {
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      chainId: row.chain_id,
      userOperationHash: row.user_operation_hash,
      gasCost: row.gas_cost,
      policyId: row.policy_id,
      sponsored: row.sponsored,
      timestamp: new Date(row.timestamp),
    };
  }

  private getChain(chainId: number): any {
    const chain = this.chains[chainId];
    if (!chain) {
      throw this.createError('UNSUPPORTED_CHAIN', `Chain ID ${chainId} is not supported`, 400);
    }
    return chain;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private createError(code: string, message: string, statusCode: number, originalError?: any): WalletRegistryError {
    const error = new Error(message) as WalletRegistryError;
    error.code = code;
    error.statusCode = statusCode;
    error.details = originalError;
    return error;
  }
}
