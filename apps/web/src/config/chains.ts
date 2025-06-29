import { base, baseSepolia, bsc, bscTestnet } from 'wagmi/chains'
import type { Chain } from 'wagmi/chains'

export interface ChainConfig {
  id: number
  name: string
  shortName: string
  icon: string
  color: string
  explorer: string
  isTestnet: boolean
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  wagmiChain: Chain
}

// Get RPC URL from environment or fallback
const getRpcUrls = (chainId: number): string[] => {
  switch (chainId) {
    case base.id: // 8453
      return [
        process.env.NEXT_PUBLIC_BASE_RPC,
        'https://base.blockpi.network/v1/rpc/public',
        'https://1rpc.io/base',
        'https://base.meowrpc.com',
        'https://mainnet.base.org'
      ].filter(Boolean) as string[]
    
    case baseSepolia.id: // 84532
      return [
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
        'https://sepolia.base.org',
        'https://base-sepolia.blockpi.network/v1/rpc/public',
        'https://base-sepolia.publicnode.com'
      ].filter(Boolean) as string[]
    
    case bsc.id: // 56
      return [
        process.env.NEXT_PUBLIC_BSC_RPC,
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc.nodereal.io',
        'https://rpc.ankr.com/bsc'
      ].filter(Boolean) as string[]
    
    case bscTestnet.id: // 97
      return [
        process.env.NEXT_PUBLIC_BSC_TESTNET_RPC,
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://bsc-testnet.publicnode.com'
      ].filter(Boolean) as string[]
    
    default:
      return ['https://mainnet.base.org']
  }
}

// Create custom chain with our RPC URLs
const createCustomChain = (baseChain: Chain): Chain => ({
  ...baseChain,
  rpcUrls: {
    default: {
      http: getRpcUrls(baseChain.id),
    },
    public: {
      http: getRpcUrls(baseChain.id),
    },
  },
})

// Supported chains configuration
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Base Mainnet
  [base.id]: {
    id: base.id,
    name: 'Base',
    shortName: 'BASE',
    icon: `<svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="111" height="111" rx="55.5" fill="#0052FF"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 21.3467 0.239014 48.8484H36.8705C38.8239 39.4891 46.8109 32.6523 56.3681 32.6523C67.2944 32.6523 76.1429 41.5008 76.1429 52.4271C76.1429 63.3534 67.2944 72.2019 56.3681 72.2019C46.8109 72.2019 38.8239 65.3651 36.8705 55.9058H0.239014C2.35281 83.4075 26.0432 104.754 54.921 110.034Z" fill="white"/>
    </svg>`,
    color: 'bg-blue-600',
    explorer: 'https://basescan.org',
    isTestnet: false,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: getRpcUrls(base.id),
    wagmiChain: createCustomChain(base),
  },

  // Base Sepolia Testnet
  [baseSepolia.id]: {
    id: baseSepolia.id,
    name: 'Base Sepolia',
    shortName: 'BASE_SEPOLIA',
    icon: `<svg width="16" height="16" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="111" height="111" rx="55.5" fill="#0052FF"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 21.3467 0.239014 48.8484H36.8705C38.8239 39.4891 46.8109 32.6523 56.3681 32.6523C67.2944 32.6523 76.1429 41.5008 76.1429 52.4271C76.1429 63.3534 67.2944 72.2019 56.3681 72.2019C46.8109 72.2019 38.8239 65.3651 36.8705 55.9058H0.239014C2.35281 83.4075 26.0432 104.754 54.921 110.034Z" fill="white"/>
    </svg>`,
    color: 'bg-blue-400',
    explorer: 'https://sepolia.basescan.org',
    isTestnet: true,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: getRpcUrls(baseSepolia.id),
    wagmiChain: createCustomChain(baseSepolia),
  },

  // BSC Mainnet
  [bsc.id]: {
    id: bsc.id,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    icon: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F0B90B"/>
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.856L24.14 16l-2.26 2.26L19.62 16l2.26-2.26z" fill="white"/>
      <path d="M16 14.52L13.596 16.924 16 19.328l2.404-2.404L16 14.52z" fill="white"/>
    </svg>`,
    color: 'bg-yellow-500',
    explorer: 'https://bscscan.com',
    isTestnet: false,
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: getRpcUrls(bsc.id),
    wagmiChain: createCustomChain(bsc),
  },

  // BSC Testnet
  [bscTestnet.id]: {
    id: bscTestnet.id,
    name: 'BNB Smart Chain Testnet',
    shortName: 'BSC_TESTNET',
    icon: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F0B90B"/>
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.856L24.14 16l-2.26 2.26L19.62 16l2.26-2.26z" fill="white"/>
      <path d="M16 14.52L13.596 16.924 16 19.328l2.404-2.404L16 14.52z" fill="white"/>
    </svg>`,
    color: 'bg-yellow-400',
    explorer: 'https://testnet.bscscan.com',
    isTestnet: true,
    nativeCurrency: {
      name: 'BNB',
      symbol: 'tBNB',
      decimals: 18,
    },
    rpcUrls: getRpcUrls(bscTestnet.id),
    wagmiChain: createCustomChain(bscTestnet),
  },
}

// Helper functions
export const getAllChains = (): ChainConfig[] => Object.values(SUPPORTED_CHAINS)
export const getMainnetChains = (): ChainConfig[] => getAllChains().filter(chain => !chain.isTestnet)
export const getTestnetChains = (): ChainConfig[] => getAllChains().filter(chain => chain.isTestnet)
export const getChainConfig = (chainId: number): ChainConfig | undefined => SUPPORTED_CHAINS[chainId]
export const getWagmiChains = (): Chain[] => getAllChains().map(chain => chain.wagmiChain)

// Default chains
export const DEFAULT_MAINNET_CHAIN = SUPPORTED_CHAINS[base.id]
export const DEFAULT_TESTNET_CHAIN = SUPPORTED_CHAINS[baseSepolia.id]
export const DEFAULT_CHAIN = DEFAULT_MAINNET_CHAIN

// Network environment
export const IS_TESTNET_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'

// Get default chain based on environment
export const getDefaultChain = (useTestnet = false): ChainConfig => {
  if (useTestnet) {
    return DEFAULT_TESTNET_CHAIN
  }
  return DEFAULT_MAINNET_CHAIN
}

// Chain pairs (mainnet <-> testnet)
export const CHAIN_PAIRS: Record<number, number> = {
  [base.id]: baseSepolia.id,        // Base -> Base Sepolia
  [baseSepolia.id]: base.id,        // Base Sepolia -> Base
  [bsc.id]: bscTestnet.id,          // BSC -> BSC Testnet
  [bscTestnet.id]: bsc.id,          // BSC Testnet -> BSC
}

// Get corresponding chain (mainnet <-> testnet)
export const getCorrespondingChain = (chainId: number): ChainConfig | undefined => {
  const correspondingId = CHAIN_PAIRS[chainId]
  return correspondingId ? SUPPORTED_CHAINS[correspondingId] : undefined
}

// Validation
export const isSupportedChain = (chainId: number): boolean => chainId in SUPPORTED_CHAINS
export const isTestnetChain = (chainId: number): boolean => SUPPORTED_CHAINS[chainId]?.isTestnet ?? false
export const isMainnetChain = (chainId: number): boolean => !isTestnetChain(chainId) 