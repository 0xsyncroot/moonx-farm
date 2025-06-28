import { FastifyRequest } from 'fastify';

// Custom authenticated request type
export interface AuthenticatedFastifyRequest extends FastifyRequest {
  user: AuthenticatedRequest;
}

export interface AAWallet {
  id: string;
  userId: string; // Privy user ID
  address: string; // AA wallet address (updated after deployment if needed)
  ownerAddress: string; // Privy EOA wallet address (the actual owner)
  ownerType: 'privy-social' | 'privy-wallet' | 'external'; // Owner wallet type
  chainId: number;
  aaStandard: 'ERC-4337' | 'EIP-7702'; // AA standard: ETH mainnet uses EIP-7702, others use ERC-4337
  kernelVersion: string;
  salt: string;
  factoryAddress: string;
  implementationAddress: string;
  entryPointAddress: string; // EntryPoint contract address (for ERC-4337)
  isDeployed: boolean;
  deploymentTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionKey {
  id: string;
  walletId: string;
  userId: string;
  publicKey: string;
  encryptedPrivateKey: string; // Encrypted with KMS
  encryptedApproval: string; // Encrypted serialized permission approval
  permissions: SessionKeyPermissions;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionKeyPermissions {
  contractAddresses: string[]; // Contracts this key can interact with
  maxGasLimit: string; // Maximum gas limit per transaction
  maxAmount: string; // Maximum amount per transaction
  allowedMethods: string[]; // Allowed contract methods
  timeframe: {
    validAfter: number;
    validUntil: number;
  };
}

export interface CreateWalletRequest {
  userId: string; // Privy user ID
  ownerAddress: string; // Privy EOA wallet address (owner of AA wallet)
  ownerType?: 'privy-social' | 'privy-wallet' | 'external'; // Default: 'privy-social'
  chainId: number;
  saltNonce?: string;
}

export interface CreateWalletResponse {
  wallet: AAWallet;
  isDeployed: boolean;
  deploymentTxHash?: string; // Deployment transaction hash if auto-deployed
}

// REMOVED: DeployWalletRequest and DeployWalletResponse - auto-deploy on creation

export interface CreateSessionKeyRequest {
  walletId: string;
  userId: string;
  permissions: SessionKeyPermissions;
  expirationDays?: number;
}

export interface CreateSessionKeyResponse {
  sessionKey: Omit<SessionKey, 'encryptedPrivateKey' | 'encryptedApproval'>;
  publicKey: string;
  // Note: approval is now stored securely in database, client doesn't need it
}

export interface GetWalletsRequest {
  userId: string;
  chainId?: number;
  isDeployed?: boolean;
}

export interface GetWalletsResponse {
  wallets: AAWallet[];
  total: number;
}

export interface WalletStatusRequest {
  walletId: string;
  checkOnchain?: boolean;
}

export interface WalletStatusResponse {
  wallet: AAWallet;
  onchainStatus: {
    isDeployed: boolean;
    balance: string;
    nonce: number;
  };
}

export interface RecoverySetupRequest {
  walletId: string;
  guardianAddress: string;
  recoveryDelay?: number; // in seconds
}

export interface RecoverySetupResponse {
  recoveryEnabled: boolean;
  guardianAddress: string;
  recoveryDelay: number;
}

export interface InitiateRecoveryRequest {
  walletAddress: string;
  newOwner: string;
  guardianSignature: string;
}

export interface InitiateRecoveryResponse {
  recoveryId: string;
  executeAfter: Date;
}

// ZeroDev client types
export interface ZeroDevClientConfig {
  projectId: string;
  chain: any;
  bundlerUrl?: string;
  paymasterUrl?: string;
}

// Error types
export interface WalletRegistryError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

// Validation types
export interface ValidateAddressRequest {
  address: string;
  chainId: number;
}

export interface ValidateAddressResponse {
  isValid: boolean;
  isContract: boolean;
  isKernelAccount: boolean;
  kernelVersion?: string;
}

// REMOVED: Batch and multi-chain operations - users create wallets individually

// Events
export interface WalletEvent {
  type: 'WALLET_CREATED' | 'WALLET_DEPLOYED' | 'SESSION_KEY_CREATED' | 'RECOVERY_INITIATED';
  walletId: string;
  userId: string;
  chainId: number;
  data: any;
  timestamp: Date;
}

// Configuration
export interface WalletRegistryConfig {
  database: {
    url: string;
    maxConnections: number;
  };
  zerodev: {
    projectId: string;
    apiKey: string;
    paymasterPolicyId?: string;
  };
  kms: {
    keyId: string;
    region: string;
  };
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  chains: {
    supported: number[];
    rpcUrls: Record<number, string>;
    explorers: Record<number, string>;
  };
}

// Authentication types (integration with auth service)
export interface AuthenticatedRequest {
  userId: string;
  privyUserId: string;
  walletAddress?: string;
  email?: string;
}

// Gas Sponsorship Types
export interface GasSponsorshipPolicy {
  id: string;
  userId: string;
  walletId?: string;
  walletAddress?: string;
  dailyLimit: string; // Wei amount
  monthlyLimit: string; // Wei amount
  perTransactionLimit?: string; // Wei amount
  allowedContracts?: string[]; // Contract addresses
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GasUsageRecord {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: number;
  userOperationHash: string;
  gasCost: string; // Wei amount
  policyId: string;
  sponsored: boolean;
  timestamp: Date;
}

export interface SponsorshipRequest {
  userId: string;
  walletAddress: string;
  chainId: number;
  estimatedGas: string;
  userOperationHash?: string;
  contractAddress?: string;
}

export interface SponsorshipResponse {
  sponsored: boolean;
  paymasterData?: any;
  gasCost: string;
  policyId: string;
  reason?: string;
}

export interface GasBudget {
  policyId: string;
  userId: string;
  walletId: string; // Made required to fix type error
  dailyLimit: string;
  dailyUsed: string;
  dailyRemaining: string;
  monthlyLimit: string;
  monthlyUsed: string;
  monthlyRemaining: string;
  isActive: boolean;
}

export interface CreateSponsorshipPolicyRequest {
  userId: string;
  walletId?: string;
  walletAddress?: string;
  dailyLimit: string;
  monthlyLimit: string;
  perTransactionLimit?: string;
  allowedContracts?: string[];
}

export interface UpdateSponsorshipPolicyRequest {
  policyId: string;
  dailyLimit?: string;
  monthlyLimit?: string;
  perTransactionLimit?: string;
  allowedContracts?: string[];
  isActive?: boolean;
}

export interface GasUsageStatsRequest {
  userId: string;
  walletAddress?: string;
  timeframe?: 'day' | 'week' | 'month';
}

export interface GasUsageStatsResponse {
  totalGasCost: string;
  transactionCount: number;
  averageGasCost: string;
  sponsoredTransactions: number;
  sponsorshipSavings: string;
  breakdown: {
    chainId: number;
    gasCost: string;
    transactionCount: number;
  }[];
} 