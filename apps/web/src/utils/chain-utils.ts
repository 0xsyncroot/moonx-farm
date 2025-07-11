// Chain utility functions for processing chain information

export interface ChainInfo {
  chainId: number;
  chainName: string;
  chainSlug: string;
  logoUrl: string;
  defiLlamaSlug?: string;
}

/**
 * Format chain display name, using chainSlug as fallback for long names
 */
export const formatChainDisplayName = (chain: ChainInfo): string => {
  // Use chainSlug as backup if chainName is too long
  if (chain.chainName && chain.chainName.length > 12) {
    return chain.chainSlug || chain.chainName;
  }
  return chain.chainName || chain.chainSlug || 'Unknown';
};

/**
 * Get fallback letter for chain avatar when logo fails to load
 */
export const getChainAvatarFallback = (chain: ChainInfo): string => {
  // Priority: chainName first letter > chainSlug first letter > 'N'
  return chain.chainName?.[0]?.toUpperCase() || 
         chain.chainSlug?.[0]?.toUpperCase() || 'N';
};

/**
 * Get chain logo URL with fallback handling
 */
export const getChainLogoUrl = (chain: ChainInfo): string | null => {
  return chain.logoUrl || null;
};

/**
 * Format chain identifier for URLs/routing
 */
export const formatChainSlug = (chain: ChainInfo): string => {
  return chain.chainSlug || chain.chainName?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
};

/**
 * Check if chain logo is available
 */
export const hasChainLogo = (chain: ChainInfo): boolean => {
  return Boolean(chain.logoUrl && chain.logoUrl.trim().length > 0);
};

/**
 * Get chain full identifier (for debugging/logging)
 */
export const getChainIdentifier = (chain: ChainInfo): string => {
  return `${chain.chainName} (${chain.chainId})`;
};

/**
 * Common chain status mapping
 */
export const CHAIN_STATUS_MAP = {
  healthy: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500',
    label: 'Healthy'
  },
  degraded: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500',
    label: 'Degraded'
  },
  unhealthy: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500',
    label: 'Unhealthy'
  }
} as const;

export type ChainStatus = keyof typeof CHAIN_STATUS_MAP;

/**
 * Get chain status styling
 */
export const getChainStatusStyle = (status: ChainStatus) => {
  return CHAIN_STATUS_MAP[status] || CHAIN_STATUS_MAP.degraded;
}; 