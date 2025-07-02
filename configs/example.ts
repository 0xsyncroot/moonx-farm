import { 
  createConfig, 
  getNetworkConfigs, 
  getRpcConfig,
  getBestRpcUrl,
  getAllRpcUrls,
  getPublicRpcUrls,
  hasPrivateRpc 
} from './index';

/**
 * Example usage of the new RPC configuration system
 * with private RPC URLs and fallback support
 */

// Example 1: Basic network configuration
export const exampleBasicNetworkConfig = () => {
  console.log('=== Basic Network Configuration ===');
  
  const config = createConfig('aggregator-service');
  const networks = getNetworkConfigs('aggregator-service');
  
  console.log('Base Mainnet:', networks.base.mainnet);
  console.log('BSC Mainnet:', networks.bsc.mainnet);
  
  // Access specific network config
  const baseMainnet = networks.base.mainnet;
  console.log('Base Mainnet Private RPC:', baseMainnet.privateRpc);
  console.log('Base Mainnet Fallback RPCs:', baseMainnet.fallbackRpcs);
};

// Example 2: Using RPC utilities from configs
export const exampleRpcUtilities = () => {
  console.log('=== RPC Utilities ===');
  
  const networks = getNetworkConfigs('swap-orchestrator');
  const baseMainnet = networks.base.mainnet;
  
  // Get best RPC URL (private first, then fallback)
  const bestUrl = getBestRpcUrl(baseMainnet);
  console.log('Best RPC URL:', bestUrl);
  
  // Get all RPC URLs (private first, then fallbacks)
  const allUrls = getAllRpcUrls(baseMainnet);
  console.log('All RPC URLs:', allUrls);
  
  // Get public RPC URLs only
  const publicUrls = getPublicRpcUrls(baseMainnet);
  console.log('Public RPC URLs:', publicUrls);
  
  // Check if private RPC is configured
  const hasPrivate = hasPrivateRpc(baseMainnet);
  console.log('Has Private RPC:', hasPrivate);
};

// Example 3: Using RPC config helper
export const exampleRpcConfigHelper = () => {
  console.log('=== RPC Config Helper ===');
  
  // Get complete RPC configuration for Base mainnet
  const baseMainnetConfig = getRpcConfig('aggregator-service', 'base', 'mainnet');
  
  console.log('Base Mainnet Config:', {
    privateRpc: baseMainnetConfig.privateRpc,
    fallbackRpcs: baseMainnetConfig.fallbackRpcs,
    chainId: baseMainnetConfig.chainId,
    explorer: baseMainnetConfig.explorer,
  });
  
  // Use utility methods
  console.log('Best URL:', baseMainnetConfig.getBestUrl());
  console.log('All URLs:', baseMainnetConfig.getAllUrls());
  console.log('Public URLs:', baseMainnetConfig.getPublicUrls());
  console.log('Has Private:', baseMainnetConfig.hasPrivate());
};

// Example 4: Using RPC utilities from common package
export const exampleCommonRpcUtilities = () => {
  console.log('=== Common Package RPC Utilities ===');
  
  // Import networks from common package
  // const { NETWORKS, RPC_UTILS } = require('@moonx-farm/common');
  
  // const baseNetwork = NETWORKS[8453]; // Base mainnet
  
  // console.log('Base Network RPC URLs:', baseNetwork.rpcUrls);
  // console.log('Base Network Private RPC:', baseNetwork.privateRpcUrl);
  
  // Use RPC utilities
  // const bestUrl = RPC_UTILS.getBestRpcUrl(baseNetwork);
  // console.log('Best RPC URL:', bestUrl);
  
  // const allUrls = RPC_UTILS.getAllRpcUrls(baseNetwork);
  // console.log('All RPC URLs:', allUrls);
  
  // const publicUrls = RPC_UTILS.getPublicRpcUrls(baseNetwork);
  // console.log('Public RPC URLs:', publicUrls);
  
  // const hasPrivate = RPC_UTILS.hasPrivateRpc(baseNetwork);
  // console.log('Has Private RPC:', hasPrivate);
};

// Example 5: Fallback RPC implementation
export const exampleFallbackRpc = async () => {
  console.log('=== Fallback RPC Implementation ===');
  
  const networks = getNetworkConfigs('swap-orchestrator');
  const baseMainnet = networks.base.mainnet;
  const allUrls = getAllRpcUrls(baseMainnet);
  
  // Simulate trying RPC URLs in order
  for (const rpcUrl of allUrls) {
    try {
      console.log(`Trying RPC: ${rpcUrl}`);
      
      // Simulate RPC call
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });
      
      if (response.ok) {
        console.log(`✅ RPC ${rpcUrl} is working`);
        return rpcUrl; // Use this RPC URL
      }
    } catch (error) {
      console.log(`❌ RPC ${rpcUrl} failed:`, (error as Error).message);
      continue; // Try next RPC URL
    }
  }
  
  throw new Error('All RPC URLs failed');
};

// Example 6: Service-specific RPC usage
export const exampleServiceRpcUsage = () => {
  console.log('=== Service-Specific RPC Usage ===');
  
  // Quote Service - needs fast RPC for price queries
  const quoteServiceConfig = createConfig('aggregator-service');
  const quoteNetworks = getNetworkConfigs('aggregator-service');
  
  // Use private RPC for fast price queries
  const basePrivateRpc = quoteNetworks.base.mainnet.privateRpc;
  console.log('Quote Service Base Private RPC:', basePrivateRpc);
  
  // Swap Orchestrator - needs reliable RPC for transactions
  const swapConfig = createConfig('swap-orchestrator');
  const swapNetworks = getNetworkConfigs('swap-orchestrator');
  
  // Get all RPC URLs for fallback during transactions
  const baseAllRpcs = getAllRpcUrls(swapNetworks.base.mainnet);
  console.log('Swap Orchestrator Base All RPCs:', baseAllRpcs);
  
  // Position Indexer - can use public RPCs for event listening
  const indexerConfig = createConfig('position-indexer');
  const indexerNetworks = getNetworkConfigs('position-indexer');
  
  // Use public RPCs for event listening
  const basePublicRpcs = getPublicRpcUrls(indexerNetworks.base.mainnet);
  console.log('Position Indexer Base Public RPCs:', basePublicRpcs);
};

// Example 7: Environment-specific configuration
export const exampleEnvironmentConfig = () => {
  console.log('=== Environment-Specific Configuration ===');
  
  const config = createConfig('full');
  const env = config.get('NODE_ENV');
  
  if (env === 'production') {
    // Production: Use private RPCs for all operations
    const networks = getNetworkConfigs('full');
    
    console.log('Production Configuration:');
    console.log('- Base Mainnet Private RPC:', networks.base.mainnet.privateRpc);
    console.log('- BSC Mainnet Private RPC:', networks.bsc.mainnet.privateRpc);
    
  } else if (env === 'development') {
    // Development: Use fallback RPCs
    const networks = getNetworkConfigs('full');
    
    console.log('Development Configuration:');
    console.log('- Base Mainnet Fallback RPCs:', networks.base.mainnet.fallbackRpcs);
    console.log('- BSC Mainnet Fallback RPCs:', networks.bsc.mainnet.fallbackRpcs);
    
  } else {
    // Test: Use testnet RPCs
    const networks = getNetworkConfigs('full');
    
    console.log('Test Configuration:');
    console.log('- Base Testnet RPCs:', getAllRpcUrls(networks.base.testnet));
    console.log('- BSC Testnet RPCs:', getAllRpcUrls(networks.bsc.testnet));
  }
};

// =============================================================================
// LOGGER CONFIGURATION EXAMPLES
// =============================================================================

// Example 1: Using default logger configuration
// import { createLogger } from '@moonx-farm/common';
// const defaultLogger = createLogger('auth-service');
// defaultLogger.info('Service started', { port: 3001 });

// Example 2: Using profile-based logger configuration
// import { createLoggerForProfile } from '@moonx-farm/common';
// const authLogger = createLoggerForProfile('auth-service');
// authLogger.info('Auth service started', { port: 3001 });

// Example 3: Using custom logger configuration
// import { createLoggerWithConfig, LoggerConfig } from '@moonx-farm/common';
// const customLoggerConfig: LoggerConfig = {
//   level: 'debug',
//   service: 'quote-service',
//   enableConsole: true,
//   enableFile: true,
//   logDir: 'logs/quote',
//   maxFiles: 10,
//   maxSize: '20m',
//   format: 'json',
// };
// const customLogger = createLoggerWithConfig(customLoggerConfig);

// Example 4: Environment-specific logger configuration
// const getLoggerForEnvironment = (service: string) => {
//   const isProduction = process.env.NODE_ENV === 'production';
//   const config: LoggerConfig = {
//     level: isProduction ? 'info' : 'debug',
//     service,
//     enableConsole: !isProduction,
//     enableFile: isProduction,
//     logDir: 'logs',
//     maxFiles: isProduction ? 10 : 5,
//     maxSize: isProduction ? '50m' : '10m',
//     format: isProduction ? 'json' : 'console',
//   };
//   return createLoggerWithConfig(config);
// };

// Example 5: Child logger with context
// const userLogger = authLogger.child({ userId: 'user123' });
// userLogger.info('User action performed', { action: 'login' });

// Example 6: Service-specific logger usage
// const quoteLogger = createLoggerForProfile('quote-service');
// quoteLogger.debug('Quote calculation started', { 
//   tokenIn: 'USDC', 
//   tokenOut: 'ETH',
//   amount: '1000'
// });

// const swapLogger = createLoggerForProfile('swap-orchestrator');
// swapLogger.info('Order executed', { 
//   orderId: '12345',
//   amount: '1000 USDC',
//   gasUsed: '150000'
// });

// Run examples
if (require.main === module) {
  console.log('🚀 Running RPC Configuration Examples\n');
  
  exampleBasicNetworkConfig();
  console.log('\n');
  
  exampleRpcUtilities();
  console.log('\n');
  
  exampleRpcConfigHelper();
  console.log('\n');
  
  exampleCommonRpcUtilities();
  console.log('\n');
  
  exampleServiceRpcUsage();
  console.log('\n');
  
  exampleEnvironmentConfig();
  console.log('\n');
  
  // Uncomment to test fallback RPC (requires actual RPC endpoints)
  // exampleFallbackRpc().catch(console.error);
} 