// Stats Worker Configuration
// Using environment variables directly for simplicity

// Chain logo configuration - Using proper chain logos, not token logos
const CHAIN_LOGOS = {
  ethereum: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', // Official Ethereum logo
  base: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png', // Base chain logo
  bsc: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png', // BSC chain logo
  polygon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png', // Polygon chain logo
  arbitrum: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png', // Arbitrum chain logo
  optimism: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png', // Optimism chain logo
  avalanche: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png', // Avalanche chain logo
  fantom: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png' // Fantom chain logo
};

/**
 * Get logo URL for a chain with environment variable override support
 */
const getChainLogoUrl = (chainSlug: string): string => {
  const envKey = `${chainSlug.toUpperCase()}_LOGO_URL`;
  return process.env[envKey] || CHAIN_LOGOS[chainSlug as keyof typeof CHAIN_LOGOS] || '';
};

// Helper functions to get structured config
export const getMongoConfig = () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/moonx-farm',
  database: process.env.MONGODB_DATABASE || 'moonx-farm',
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '1', 10),
  enableMetrics: process.env.MONGODB_ENABLE_METRICS === 'true',
});

export const getKafkaConfig = () => ({
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID || 'stats-worker',
  groupId: process.env.KAFKA_GROUP_ID || 'stats-worker-group',
  topicEvents: process.env.KAFKA_TOPIC_EVENTS || 'moonx.ws.events',
});

export const getChainConfigs = () => {
  const enabledChains = (process.env.ENABLED_CHAINS || 'base,bsc,ethereum').split(',');
  const chains = [];

  if (enabledChains.includes('base')) {
    chains.push({
      name: 'Base',
      chainId: 8453,
      chainSlug: 'base',
      logoUrl: getChainLogoUrl('base'),
      rpc: process.env.BASE_RPC_URL || (() => {
        console.warn('⚠️  BASE_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://mainnet.base.org';
      })(),
      defiLlamaSlug: 'base',
      enabled: true,
    });
  }

  if (enabledChains.includes('bsc')) {
    chains.push({
      name: 'BSC',
      chainId: 56,
      chainSlug: 'bsc',
      logoUrl: getChainLogoUrl('bsc'),
      rpc: process.env.BSC_RPC_URL || (() => {
        console.warn('⚠️  BSC_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://bsc-dataseed.binance.org';
      })(),
      defiLlamaSlug: 'bsc',
      enabled: true,
    });
  }

  if (enabledChains.includes('ethereum')) {
    chains.push({
      name: 'Ethereum',
      chainId: 1,
      chainSlug: 'ethereum',
      logoUrl: getChainLogoUrl('ethereum'),
      rpc: process.env.ETHEREUM_RPC_URL || (() => {
        console.warn('⚠️  ETHEREUM_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://eth.llamarpc.com';
      })(),
      defiLlamaSlug: 'ethereum',
      enabled: true,
    });
  }

  if (enabledChains.includes('polygon')) {
    chains.push({
      name: 'Polygon',
      chainId: 137,
      chainSlug: 'polygon',
      logoUrl: getChainLogoUrl('polygon'),
      rpc: process.env.POLYGON_RPC_URL || (() => {
        console.warn('⚠️  POLYGON_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://polygon.llamarpc.com';
      })(),
      defiLlamaSlug: 'polygon',
      enabled: true,
    });
  }

  if (enabledChains.includes('arbitrum')) {
    chains.push({
      name: 'Arbitrum',
      chainId: 42161,
      chainSlug: 'arbitrum',
      logoUrl: getChainLogoUrl('arbitrum'),
      rpc: process.env.ARBITRUM_RPC_URL || (() => {
        console.warn('⚠️  ARBITRUM_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://arbitrum.llamarpc.com';
      })(),
      defiLlamaSlug: 'arbitrum',
      enabled: true,
    });
  }

  if (enabledChains.includes('optimism')) {
    chains.push({
      name: 'Optimism',
      chainId: 10,
      chainSlug: 'optimism',
      logoUrl: getChainLogoUrl('optimism'),
      rpc: process.env.OPTIMISM_RPC_URL || (() => {
        console.warn('⚠️  OPTIMISM_RPC_URL not set, using public endpoint (rate limited)');
        return 'https://optimism.llamarpc.com';
      })(),
      defiLlamaSlug: 'optimism',
      enabled: true,
    });
  }

  if (enabledChains.includes('avalanche')) {
    chains.push({
      name: 'Avalanche',
      chainId: 43114,
      chainSlug: 'avalanche',
      logoUrl: getChainLogoUrl('avalanche'),
      rpc: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      defiLlamaSlug: 'avalanche',
      enabled: true,
    });
  }

  if (enabledChains.includes('fantom')) {
    chains.push({
      name: 'Fantom',
      chainId: 250,
      chainSlug: 'fantom',
      logoUrl: getChainLogoUrl('fantom'),
      rpc: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools',
      defiLlamaSlug: 'fantom',
      enabled: true,
    });
  }

  return chains;
};

export const getBridgeConfigs = () => [
  {
    name: 'LI.FI',
    provider: 'LI.FI',
    endpoint: process.env.LIFI_API_URL || 'https://li.quest/v1',
    enabled: true,
    timeout: 30000,
  },
  {
    name: 'Relay',
    provider: 'Relay.link',
    endpoint: process.env.RELAY_API_URL || 'https://api.relay.link',
    enabled: true,
    timeout: 30000,
  },
];

export const getJobConfigs = () => [
  {
    name: 'full_stats_collection',
    schedule: process.env.STATS_COLLECTION_INTERVAL || '0 */5 * * * *',
    enabled: true,
    timeout: parseInt(process.env.STATS_COLLECTION_TIMEOUT || '120000', 10),
    retryAttempts: 3,
  },
  {
    name: 'chain_performance_only',
    schedule: process.env.CHAIN_PERFORMANCE_INTERVAL || '0 */1 * * * *',
    enabled: true,
    timeout: parseInt(process.env.CHAIN_PERFORMANCE_TIMEOUT || '60000', 10),
    retryAttempts: 2,
  },
  {
    name: 'bridge_latency_only',
    schedule: process.env.BRIDGE_LATENCY_INTERVAL || '0 */2 * * * *',
    enabled: true,
    timeout: parseInt(process.env.BRIDGE_LATENCY_TIMEOUT || '90000', 10),
    retryAttempts: 2,
  },
];

export const getApiConfigs = () => ({
  defiLlama: process.env.DEFILLAMA_API_URL || 'https://api.llama.fi',
  lifi: process.env.LIFI_API_URL || 'https://li.quest/v1',
  lifiApiKey: process.env.LIFI_API_KEY,
  relay: process.env.RELAY_API_URL || 'https://api.relay.link',
});

export const getClusterConfig = () => ({
  enabled: process.env.CLUSTER_MODE === 'true',
  workers: parseInt(process.env.CLUSTER_WORKERS || '0', 10),
}); 