import axios from 'axios';
import { getApiKeys } from '@moonx/configs';
import { TokenHolding } from '../types';

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

interface AlchemyTokenMetadata {
  decimals: number;
  logo?: string;
  name: string;
  symbol: string;
  thumbnail?: string;
}

interface AlchemyNativeBalance {
  id: number;
  jsonrpc: string;
  result: string;
}

interface AlchemyTokenBalanceResponse {
  id: number;
  jsonrpc: string;
  result: {
    address: string;
    tokenBalances: AlchemyTokenBalance[];
  };
}

interface AlchemyTokenMetadataResponse {
  id: number;
  jsonrpc: string;
  result: AlchemyTokenMetadata[];
}

export class AlchemyService {
  private apiKey: string;
  private baseUrl: string;
  private supportedChains: Map<number, string>;
  private maxRetries: number = 3;
  private timeout: number = 10000;

  constructor() {
    // Get API keys from @moonx/configs
    const apiKeys = getApiKeys('core-service');
    this.apiKey = apiKeys.alchemy || '';
    this.baseUrl = 'https://api.alchemy.com/v2';
    
    if (!this.apiKey) {
      throw new Error('ALCHEMY_API_KEY configuration is required - check @moonx/configs');
    }
    
    // Supported chains mapping - extended for production
    this.supportedChains = new Map([
      [56, 'bsc-mainnet'],       // BSC
      [8453, 'base-mainnet'],    // Base
    ]);

    console.log(`✅ AlchemyService initialized with ${this.supportedChains.size} supported chains using config-based API key`);
  }

  /**
   * Get token balances for a wallet with comprehensive error handling
   */
  async getTokenBalances(walletAddress: string, chainId: number): Promise<TokenHolding[]> {
    if (!this.isValidAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const network = this.supportedChains.get(chainId);
    if (!network) {
      console.warn(`Chain ${chainId} not supported by Alchemy`);
      return [];
    }

    try {
      console.log(`Fetching token balances for ${walletAddress} on chain ${chainId}`);

      // Get token balances with retry logic
      const balancesResponse = await this.makeAlchemyRequest<AlchemyTokenBalanceResponse>({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [walletAddress]
      }, network);

      if (!balancesResponse?.result?.tokenBalances) {
        console.warn(`No token balances data received for ${walletAddress}`);
        return [];
      }

      const tokenBalances: AlchemyTokenBalance[] = balancesResponse.result.tokenBalances;
      
      // Filter out tokens with zero balance or errors
      const validBalances = tokenBalances.filter(
        balance => balance && 
                  balance.tokenBalance && 
                  balance.tokenBalance !== '0x0' && 
                  balance.tokenBalance !== '0x' &&
                  !balance.error &&
                  balance.contractAddress
      );

      if (validBalances.length === 0) {
        console.log(`No valid token balances found for ${walletAddress} on chain ${chainId}`);
        return [];
      }

      console.log(`Found ${validBalances.length} valid token balances for ${walletAddress}`);

      // Get token metadata for all tokens
      const tokenAddresses = validBalances.map(b => b.contractAddress);
      const metadataResults = await this.getTokenMetadata(tokenAddresses, network);

      // Get current prices
      const prices = await this.getTokenPrices(tokenAddresses, chainId);

      // Combine data into TokenHolding objects
      const holdings: TokenHolding[] = [];

      for (let i = 0; i < validBalances.length; i++) {
        const balance = validBalances[i];
        const metadata = metadataResults[i];
        
        if (!balance || !metadata || !metadata.symbol) {
          console.warn(`Skipping invalid token at index ${i}: missing data`);
          continue;
        }

        const price = prices.get(balance.contractAddress.toLowerCase()) || 0;

        try {
          // Convert balance from hex to decimal with safety checks
          const rawBalance = this.parseHexToBigInt(balance.tokenBalance);
          if (rawBalance === null) {
            console.warn(`Invalid balance format for token ${balance.contractAddress}: ${balance.tokenBalance}`);
            continue;
          }

          const decimals = metadata.decimals || 18;
          const balanceFormatted = Number(rawBalance) / Math.pow(10, decimals);
          const valueUSD = balanceFormatted * price;

          // Skip tokens with very small USD value (< $0.01) or invalid data
          if (valueUSD < 0.01 || !isFinite(balanceFormatted) || !isFinite(valueUSD)) {
            continue;
          }

          holdings.push({
            id: `${chainId}-${balance.contractAddress}-${walletAddress}`,
            userId: '', // Will be set by caller
            walletAddress,
            chainId,
            tokenAddress: balance.contractAddress.toLowerCase(),
            tokenSymbol: metadata.symbol,
            tokenName: metadata.name,
            tokenDecimals: decimals,
            balance: balance.tokenBalance,
            balanceFormatted,
            priceUSD: price,
            valueUSD,
            lastUpdated: new Date(),
            alchemyData: {
              ...(metadata.logo && { logo: metadata.logo }),
              ...(metadata.thumbnail && { thumbnail: metadata.thumbnail }),
              isSpam: false, // Alchemy usually filters spam tokens
              possibleSpam: false
            }
          });
        } catch (error) {
          console.warn(`Error processing token ${balance.contractAddress}:`, error);
          continue;
        }
      }

      // Sort by USD value descending
      const sortedHoldings = holdings.sort((a, b) => b.valueUSD - a.valueUSD);
      
      console.log(`Processed ${sortedHoldings.length} token holdings for ${walletAddress} on chain ${chainId}`);
      
      return sortedHoldings;

    } catch (error) {
      console.error(`Error fetching token balances for ${walletAddress} on chain ${chainId}:`, error);
      // Return empty array instead of throwing to maintain graceful degradation
      return [];
    }
  }

  /**
   * Get token metadata with batch processing
   */
  private async getTokenMetadata(tokenAddresses: string[], network: string): Promise<AlchemyTokenMetadata[]> {
    if (tokenAddresses.length === 0) return [];

    try {
      // Process in batches to avoid API limits
      const batchSize = 20;
      const results: AlchemyTokenMetadata[] = [];

      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        
        try {
          const metadataResponse = await this.makeAlchemyRequest<AlchemyTokenMetadataResponse>({
            id: 1,
            jsonrpc: '2.0',
            method: 'alchemy_getTokenMetadata',
            params: batch
          }, network);

          if (metadataResponse?.result && Array.isArray(metadataResponse.result)) {
            results.push(...metadataResponse.result);
          } else {
            // Fill with empty metadata for failed batch
            results.push(...batch.map(() => ({
              decimals: 18,
              name: 'Unknown Token',
              symbol: 'UNKNOWN'
            })));
          }
        } catch (error) {
          console.warn(`Failed to get metadata for batch ${i}-${i + batchSize}:`, error);
          // Fill with empty metadata for failed batch
          results.push(...batch.map(() => ({
            decimals: 18,
            name: 'Unknown Token',
            symbol: 'UNKNOWN'
          })));
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      // Return default metadata for all tokens
      return tokenAddresses.map(() => ({
        decimals: 18,
        name: 'Unknown Token',
        symbol: 'UNKNOWN'
      }));
    }
  }

  /**
   * Get token prices - in production, integrate with DexScreener or CoinGecko
   */
  async getTokenPrices(tokenAddresses: string[], chainId: number): Promise<Map<string, number>> {
    try {
      const priceMap = new Map<string, number>();
      
      // TODO: Replace with real price API integration
      // For now, using mock prices for development
      const mockPrices: { [key: string]: number } = {
        // Common tokens with mock prices
        'eth': 2000,
        'usdc': 1.0,
        'usdt': 1.0,
        'dai': 1.0,
        'weth': 2000,
        'matic': 0.8,
        'link': 15,
        'uni': 6
      };

      for (const tokenAddress of tokenAddresses) {
        const lowerAddress = tokenAddress.toLowerCase();
        
        // Try to find a mock price based on common patterns
        let price = 0;
        for (const [token, mockPrice] of Object.entries(mockPrices)) {
          if (lowerAddress.includes(token)) {
            price = mockPrice;
            break;
          }
        }
        
        // Default fallback price
        if (price === 0) {
          price = Math.random() * 100; // Random price for demo
        }
        
        priceMap.set(lowerAddress, price);
      }

      return priceMap;
    } catch (error) {
      console.error('Error fetching token prices:', error);
      return new Map();
    }
  }

  /**
   * Get native token balance with proper error handling
   */
  async getNativeBalance(walletAddress: string, chainId: number): Promise<TokenHolding | null> {
    if (!this.isValidAddress(walletAddress)) {
      return null;
    }

    const network = this.supportedChains.get(chainId);
    if (!network) {
      return null;
    }

    try {
      const response = await this.makeAlchemyRequest<AlchemyNativeBalance>({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [walletAddress, 'latest']
      }, network);

      if (!response?.result) {
        console.warn(`No balance data received for ${walletAddress} on chain ${chainId}`);
        return null;
      }

      const balanceHex = response.result;
      const balanceWei = this.parseHexToBigInt(balanceHex);
      
      if (balanceWei === null) {
        console.warn(`Invalid balance format: ${balanceHex}`);
        return null;
      }

      const balanceETH = Number(balanceWei) / 1e18;

      // Skip very small balances
      if (balanceETH < 0.001) {
        return null;
      }

      // Get native token price (mock for now)
      const nativePrice = this.getNativeTokenPrice(chainId);
      const valueUSD = balanceETH * nativePrice;

      return {
        id: `${chainId}-native-${walletAddress}`,
        userId: '', // Will be set by caller
        walletAddress,
        chainId,
        tokenAddress: '0x0000000000000000000000000000000000000000', // Native token address
        tokenSymbol: this.getNativeTokenSymbol(chainId),
        tokenName: this.getNativeTokenName(chainId),
        tokenDecimals: 18,
        balance: balanceHex,
        balanceFormatted: balanceETH,
        priceUSD: nativePrice,
        valueUSD,
        lastUpdated: new Date(),
        alchemyData: {
          isSpam: false,
          possibleSpam: false
        }
      };
    } catch (error) {
      console.error(`Error fetching native balance for ${walletAddress} on chain ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Get full portfolio across all chains with parallel processing
   */
  async getFullPortfolio(walletAddress: string, chainIds?: number[]): Promise<TokenHolding[]> {
    if (!this.isValidAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const chainsToQuery = chainIds || Array.from(this.supportedChains.keys());
    const validChains = chainsToQuery.filter(chainId => this.supportedChains.has(chainId));
    
    if (validChains.length === 0) {
      console.warn('No valid chains specified for portfolio query');
      return [];
    }

    console.log(`Fetching full portfolio for ${walletAddress} across ${validChains.length} chains`);

    // Process chains in parallel with controlled concurrency
    const maxConcurrent = 3;
    const allHoldings: TokenHolding[] = [];

    for (let i = 0; i < validChains.length; i += maxConcurrent) {
      const batch = validChains.slice(i, i + maxConcurrent);
      
      const promises = batch.map(async (chainId) => {
        try {
          console.log(`Processing chain ${chainId} for ${walletAddress}`);
          
          // Get both native and token balances
          const [nativeBalance, tokenBalances] = await Promise.all([
            this.getNativeBalance(walletAddress, chainId),
            this.getTokenBalances(walletAddress, chainId)
          ]);

          const chainHoldings = [...tokenBalances];
          if (nativeBalance) {
            chainHoldings.unshift(nativeBalance); // Native token first
          }

          console.log(`Chain ${chainId}: Found ${chainHoldings.length} holdings`);
          return chainHoldings;
        } catch (error) {
          console.error(`Error fetching portfolio for chain ${chainId}:`, error);
          return [];
        }
      });

      const batchResults = await Promise.allSettled(promises);
      
      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allHoldings.push(...result.value);
        }
      }
    }

    // Sort by value descending and remove duplicates
    const uniqueHoldings = this.deduplicateHoldings(allHoldings);
    const sortedHoldings = uniqueHoldings.sort((a, b) => b.valueUSD - a.valueUSD);

    const totalValue = sortedHoldings.reduce((sum, h) => sum + h.valueUSD, 0);
    console.log(`Portfolio complete: ${sortedHoldings.length} holdings, $${totalValue.toFixed(2)} total value`);

    return sortedHoldings;
  }

  // Utility methods
  private async makeAlchemyRequest<T>(payload: any, network: string): Promise<T> {
    const url = `${this.baseUrl}/${this.apiKey}`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(url, payload, {
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: this.timeout
        });

        if (response.data.error) {
          throw new Error(`Alchemy API error: ${response.data.error.message}`);
        }

        return response.data as T;
      } catch (error) {
        console.warn(`Alchemy request attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private parseHexToBigInt(hex: string): bigint | null {
    try {
      if (!hex || hex === '0x' || hex === '0x0') {
        return BigInt(0);
      }
      return BigInt(hex);
    } catch (error) {
      console.warn(`Failed to parse hex value: ${hex}`, error);
      return null;
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private getNativeTokenPrice(chainId: number): number {
    // Mock prices - in production, use real price APIs
    const prices: { [key: number]: number } = {
      1: 2000,    // ETH
      137: 0.8,   // MATIC
      10: 2000,   // ETH (Optimism)
      42161: 2000, // ETH (Arbitrum)
      8453: 2000   // ETH (Base)
    };
    return prices[chainId] || 1;
  }

  private getNativeTokenSymbol(chainId: number): string {
    const symbols: { [key: number]: string } = {
      1: 'ETH',
      137: 'MATIC',
      10: 'ETH',
      42161: 'ETH',
      8453: 'ETH'
    };
    return symbols[chainId] || 'ETH';
  }

  private getNativeTokenName(chainId: number): string {
    const names: { [key: number]: string } = {
      1: 'Ethereum',
      137: 'Polygon',
      10: 'Ethereum',
      42161: 'Ethereum',
      8453: 'Ethereum'
    };
    return names[chainId] || 'Ethereum';
  }

  private deduplicateHoldings(holdings: TokenHolding[]): TokenHolding[] {
    const seen = new Set<string>();
    return holdings.filter(holding => {
      const key = `${holding.chainId}-${holding.tokenAddress}-${holding.walletAddress}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  isChainSupported(chainId: number): boolean {
    return this.supportedChains.has(chainId);
  }

  getSupportedChains(): number[] {
    return Array.from(this.supportedChains.keys());
  }

  getNetworkName(chainId: number): string | undefined {
    return this.supportedChains.get(chainId);
  }

  /**
   * Health check for Alchemy service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    apiKey: boolean;
    connectivity: boolean;
    supportedChains: number;
  }> {
    const health = {
      status: 'healthy' as 'healthy' | 'unhealthy',
      apiKey: !!this.apiKey,
      connectivity: false,
      supportedChains: this.supportedChains.size
    };

    try {
      // Test connectivity with a simple request
      const testNetwork = this.supportedChains.get(1); // Ethereum mainnet
      if (testNetwork) {
        await this.makeAlchemyRequest({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: []
        }, testNetwork);
        health.connectivity = true;
      }

      health.status = health.apiKey && health.connectivity ? 'healthy' : 'unhealthy';
    } catch (error) {
      console.warn('Alchemy service health check failed:', error);
      health.status = 'unhealthy';
    }

    return health;
  }
} 