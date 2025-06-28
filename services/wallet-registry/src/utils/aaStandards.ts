/**
 * Account Abstraction Standards Utility
 * 
 * Determines which AA standard to use based on chain ID:
 * - Ethereum Mainnet (1): EIP-7702 (Native Account Abstraction)
 * - Other chains (Base, BSC, Polygon, etc.): ERC-4337 (EntryPoint-based)
 */

export type AAStandard = 'ERC-4337' | 'EIP-7702';

/**
 * Chain configurations for AA standards
 */
const AA_CHAIN_CONFIG = {
  // Ethereum Mainnet - EIP-7702 Native AA
  1: {
    standard: 'EIP-7702' as AAStandard,
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EIP-7702 native
    name: 'Ethereum Mainnet'
  },
  
  // Base Mainnet - ERC-4337
  8453: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // EntryPoint v0.6
    name: 'Base Mainnet'
  },
  
  // Base Sepolia - ERC-4337
  84532: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    name: 'Base Sepolia'
  },
  
  // BSC Mainnet - ERC-4337
  56: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    name: 'BSC Mainnet'
  },
  
  // BSC Testnet - ERC-4337
  97: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    name: 'BSC Testnet'
  },
  
  // Polygon Mainnet - ERC-4337
  137: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    name: 'Polygon Mainnet'
  },
  
  // Polygon Mumbai - ERC-4337
  80001: {
    standard: 'ERC-4337' as AAStandard,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    name: 'Polygon Mumbai'
  }
} as const;

/**
 * Get AA standard and configuration for a chain
 */
export function getAAStandard(chainId: number): {
  standard: AAStandard;
  entryPoint: string;
  chainName: string;
} {
  const config = AA_CHAIN_CONFIG[chainId as keyof typeof AA_CHAIN_CONFIG];
  
  if (!config) {
    // Default to ERC-4337 for unknown chains
    return {
      standard: 'ERC-4337',
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      chainName: `Chain ${chainId}`
    };
  }
  
  return {
    standard: config.standard,
    entryPoint: config.entryPoint,
    chainName: config.name
  };
}

/**
 * Check if a chain supports EIP-7702 native AA
 */
export function isEIP7702Chain(chainId: number): boolean {
  return getAAStandard(chainId).standard === 'EIP-7702';
}

/**
 * Check if a chain uses ERC-4337 EntryPoint
 */
export function isERC4337Chain(chainId: number): boolean {
  return getAAStandard(chainId).standard === 'ERC-4337';
}

/**
 * Get supported chain IDs
 */
export function getSupportedChains(): number[] {
  return Object.keys(AA_CHAIN_CONFIG).map(Number);
}

/**
 * Validate if a chain is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId in AA_CHAIN_CONFIG;
} 