import { randomUUID } from 'crypto';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface TokenBalance {
  id: string;
  chainId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: string;
  balanceFormatted: number;
  priceUSD: number;
  valueUSD: number;
  alchemyData: any;
}

export interface AlchemyPortfolioResponse {
  address: string;
  tokenBalances: Array<{
    contractAddress: string;
    tokenBalance: string;
    tokenMetadata?: {
      name: string;
      symbol: string;
      decimals: number;
      logo?: string;
    };
  }>;
}

export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

export interface AlchemyTokenMetadata {
  decimals: number;
  logo?: string;
  name: string;
  symbol: string;
  thumbnail?: string;
}

export interface AlchemyTokenPriceResponse {
  data: Array<{
    address: string;
    prices: Array<{
      currency: string;
      value: number;
      lastUpdatedAt: string;
    }>;
  }>;
}

export class AlchemyService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number = 3;
  private readonly rateLimitDelay: number = 300;
  private lastRequestTime: Map<string, number> = new Map();
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  }> = new Map();
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 failures  
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute cooldown

  constructor() {
    this.apiKey = config.alchemy.apiKey;
    this.baseUrl = 'https://api.alchemy.com/v2';
    this.timeout = config.alchemy.timeout;

    if (!this.apiKey) {
      throw new Error('ALCHEMY_API_KEY is required');
    }

    logger.info('✅ AlchemyService initialized with enhanced features', {
      apiKeyConfigured: !!this.apiKey,
      supportedChains: this.getSupportedChains().length,
      circuitBreakerEnabled: true,
      rateLimitingEnabled: true,
    });
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChains(): string[] {
    return [
      '8453',    // Base
      '56',      // BSC
    ];
  }

  /**
   * Get full portfolio for a wallet address across multiple chains
   */
  async getFullPortfolio(walletAddress: string, chainIds: string[]): Promise<TokenBalance[]> {
    try {
      logger.info('🔄 Fetching portfolio from Alchemy', {
        walletAddress,
        chains: chainIds.length,
      });

      const allTokens: TokenBalance[] = [];

      // Process chains with controlled concurrency
      const maxConcurrent = 2;
      for (let i = 0; i < chainIds.length; i += maxConcurrent) {
        const batch = chainIds.slice(i, i + maxConcurrent);
        
        const promises = batch.map(async (chainId) => {
          try {
            const chainTokens = await this.getTokenBalancesForChain(walletAddress, chainId);
            return chainTokens;
          } catch (error) {
            logger.error(`Failed to fetch tokens for chain ${chainId}`, {
              walletAddress,
              chainId,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          }
        });

        const batchResults = await Promise.allSettled(promises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            allTokens.push(...result.value);
          }
        }
      }

      logger.info('✅ Portfolio fetched successfully', {
        walletAddress,
        totalTokens: allTokens.length,
        chainsProcessed: chainIds.length,
      });

      return allTokens;

    } catch (error) {
      logger.error('Error fetching full portfolio', {
        walletAddress,
        chainIds: chainIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get token balances for a specific chain with enhanced error handling
   */
  private async getTokenBalancesForChain(walletAddress: string, chainId: string): Promise<TokenBalance[]> {
    if (!this.isValidAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const networkName = this.getNetworkName(chainId);
    
    try {
      logger.debug(`🔍 Fetching token balances for ${walletAddress} on chain ${chainId}`);

      // Get token balances with retry logic
      const balancesResponse = await this.makeRequest<{
        address: string;
        tokenBalances: AlchemyTokenBalance[];
      }>({
        method: 'alchemy_getTokenBalances',
        params: [walletAddress, 'erc20'], // Get all ERC20 tokens
        network: networkName,
      });

      if (!balancesResponse?.tokenBalances || balancesResponse.tokenBalances.length === 0) {
        logger.debug(`No token balances found for ${walletAddress} on chain ${chainId}`);
        return [];
      }

      // Filter out zero balances and errors
      const validBalances = balancesResponse.tokenBalances.filter(
        balance => balance && 
                  balance.tokenBalance && 
                  balance.tokenBalance !== '0x0' && 
                  balance.tokenBalance !== '0x' &&
                  !balance.error &&
                  balance.contractAddress
      );

      if (validBalances.length === 0) {
        logger.debug(`No valid token balances found for ${walletAddress} on chain ${chainId}`);
        return [];
      }

      logger.debug(`Found ${validBalances.length} valid token balances for ${walletAddress}`);

      // Get token metadata for all tokens
      const tokenAddresses = validBalances.map(b => b.contractAddress);
      const metadataResults = await this.getTokenMetadata(tokenAddresses, networkName);

      // Get current prices from multiple sources
      const prices = await this.getTokenPrices(tokenAddresses, chainId);

      // Combine data into TokenBalance objects
      const holdings: TokenBalance[] = [];

      for (let i = 0; i < validBalances.length; i++) {
        const balance = validBalances[i];
        const metadata = metadataResults[i];
        
        if (!balance || !metadata || !metadata.symbol) {
          logger.warn(`Skipping invalid token at index ${i}: missing data`);
          continue;
        }

        const price = prices.get(balance.contractAddress.toLowerCase()) || 0;

        try {
          // Convert balance from hex to decimal with safety checks
          const rawBalance = this.parseHexToBigInt(balance.tokenBalance);
          if (rawBalance === null) {
            logger.warn(`Invalid balance format for token ${balance.contractAddress}: ${balance.tokenBalance}`);
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
            id: randomUUID(),
            chainId,
            tokenAddress: balance.contractAddress.toLowerCase(),
            tokenSymbol: metadata.symbol,
            tokenName: metadata.name,
            tokenDecimals: decimals,
            balance: balance.tokenBalance,
            balanceFormatted,
            priceUSD: price,
            valueUSD,
            alchemyData: {
              logo: metadata.logo,
              thumbnail: metadata.thumbnail,
              contractAddress: balance.contractAddress,
              rawBalance: balance.tokenBalance,
              isSpam: false,
              possibleSpam: false,
            },
          });
        } catch (error) {
          logger.warn(`Error processing token ${balance.contractAddress}:`, error);
          continue;
        }
      }

      // Sort by USD value descending
      const sortedHoldings = holdings.sort((a, b) => b.valueUSD - a.valueUSD);
      
      logger.debug(`Processed ${sortedHoldings.length} token holdings for ${walletAddress} on chain ${chainId}`);
      
      return sortedHoldings;

    } catch (error) {
      logger.error(`Error fetching token balances for ${walletAddress} on chain ${chainId}:`, error);
      
      // Check if error is due to circuit breaker
      if (error instanceof Error && error.message.includes('Circuit breaker is open')) {
        return this.createFallbackResponse(walletAddress, chainId);
      }
      
      // Return empty array instead of throwing to maintain graceful degradation
      return [];
    }
  }

  /**
   * Enhanced token metadata retrieval with better error handling
   */
  private async getTokenMetadata(tokenAddresses: string[], network: string): Promise<AlchemyTokenMetadata[]> {
    if (tokenAddresses.length === 0) return [];

    logger.debug(`🔍 Fetching metadata for ${tokenAddresses.length} tokens on ${network}`);

    try {
      // Process in smaller batches to avoid API limits
      const batchSize = 5;
      const results: AlchemyTokenMetadata[] = [];

      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        
        try {
          // Add rate limiting delay
          await this.rateLimitCheck(`metadata-${network}`);
          
          // Try individual token metadata fetch for better success rate
          const batchResults: AlchemyTokenMetadata[] = [];
          
          for (const tokenAddress of batch) {
            try {
              const metadataResponse = await this.makeRequest<AlchemyTokenMetadata>({
                method: 'alchemy_getTokenMetadata',
                params: [tokenAddress],
                network,
              });

              if (metadataResponse) {
                batchResults.push(metadataResponse);
              } else {
                batchResults.push(this.createFallbackMetadata(tokenAddress));
              }
            } catch (tokenError) {
              logger.warn(`Failed to get metadata for token ${tokenAddress}:`, tokenError);
              batchResults.push(this.createFallbackMetadata(tokenAddress));
            }
            
            // Small delay between individual requests
            await this.sleep(100);
          }
          
          results.push(...batchResults);
          
        } catch (batchError) {
          logger.warn(`Failed to get metadata for batch ${i}-${i + batchSize}:`, batchError);
          // Fill with fallback metadata for failed batch
          results.push(...batch.map(addr => this.createFallbackMetadata(addr)));
        }

        // Add delay between batches
        if (i + batchSize < tokenAddresses.length) {
          await this.sleep(300);
        }
      }

      logger.debug(`✅ Metadata fetching complete: ${results.length}/${tokenAddresses.length} tokens processed`);
      return results;
      
    } catch (error) {
      logger.error('❌ Error fetching token metadata:', error);
      return tokenAddresses.map(addr => this.createFallbackMetadata(addr));
    }
  }

  /**
   * Enhanced token prices with multiple sources and fallback strategy
   */
  private async getTokenPrices(tokenAddresses: string[], chainId: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      if (tokenAddresses.length === 0) {
        return priceMap;
      }

      logger.debug(`💰 Fetching prices for ${tokenAddresses.length} tokens on chain ${chainId}`);

      // 1. Try Binance API first for common tokens (fastest & most reliable)
      try {
        const binanceResults = await this.fetchTokenPricesFromBinance(tokenAddresses, chainId);
        if (binanceResults.size > 0) {
          logger.debug(`🚀 Binance provided ${binanceResults.size} prices`);
          for (const [address, price] of binanceResults) {
            priceMap.set(address, price);
          }
        }
      } catch (error) {
        logger.warn('⚠️ Binance API failed:', error);
      }

      // 2. For remaining tokens, try DexScreener
      const missingAfterBinance = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (missingAfterBinance.length > 0) {
        try {
          const dexResults = await this.fetchTokenPricesFromDexScreener(missingAfterBinance, chainId);
          if (dexResults.size > 0) {
            logger.debug(`📊 DexScreener provided ${dexResults.size} additional prices`);
            for (const [address, price] of dexResults) {
              priceMap.set(address, price);
            }
          }
        } catch (error) {
          logger.warn('⚠️ DexScreener API failed:', error);
        }
      }

      // 3. For tokens still without prices, try CoinGecko
      const missingAfterDex = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (missingAfterDex.length > 0) {
        try {
          const cgResults = await this.fetchTokenPricesFromCoinGecko(missingAfterDex, chainId);
          for (const [address, price] of cgResults) {
            priceMap.set(address, price);
          }
          logger.debug(`🦎 CoinGecko provided ${cgResults.size} additional prices`);
        } catch (error) {
          logger.warn('⚠️ CoinGecko API failed:', error);
        }
      }

      // 4. Use fallback prices for remaining tokens
      const stillMissingTokens = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (stillMissingTokens.length > 0) {
        logger.debug(`🔄 Using fallback prices for ${stillMissingTokens.length} tokens`);
        this.addFallbackPrices(stillMissingTokens, chainId, priceMap);
      }

      logger.debug(`✅ Price fetching complete: ${priceMap.size}/${tokenAddresses.length} tokens have prices`);
      return priceMap;
    } catch (error) {
      logger.error('❌ Error in getTokenPrices:', error);
      // Return fallback prices as last resort
      this.addFallbackPrices(tokenAddresses, chainId, priceMap);
      return priceMap;
    }
  }

  /**
   * Fetch prices from Binance API for common tokens
   */
  private async fetchTokenPricesFromBinance(tokenAddresses: string[], chainId: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      // First, handle USDT tokens (always 1.0)
      let usdtCount = 0;
      for (const address of tokenAddresses) {
        if (this.isUSDTToken(address)) {
          priceMap.set(address.toLowerCase(), 1.0);
          usdtCount++;
        }
      }

      if (usdtCount > 0) {
        logger.debug(`💰 USDT: Set ${usdtCount} USDT prices to $1.00`);
      }

      // Get symbol mapping for non-USDT tokens
      const symbolMap = this.getCommonTokenSymbols(tokenAddresses, chainId);
      
      if (symbolMap.size === 0) {
        return priceMap;
      }

      const symbols = Array.from(new Set(symbolMap.values()));
      const symbolsParam = JSON.stringify(symbols);
      
      logger.debug(`📈 Fetching Binance prices for ${symbols.length} symbols`);
      
      const response = await fetch('https://api.binance.com/api/v3/ticker/price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MoonX-Farm-Sync-Worker/1.0'
        },
        body: JSON.stringify({ symbols }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json() as { symbol: string; price: string }[];
        
        // Map symbols back to token addresses
        for (const [address, symbol] of symbolMap.entries()) {
          const priceInfo = data.find(p => p.symbol === symbol);
          if (priceInfo) {
            const price = parseFloat(priceInfo.price);
            if (!isNaN(price) && price > 0) {
              priceMap.set(address, price);
            }
          }
        }
      }

      logger.debug(`🚀 Binance: Fetched ${priceMap.size} total prices`);
      return priceMap;
      
    } catch (error) {
      logger.warn('⚠️ Binance API error:', error);
      return priceMap;
    }
  }

  /**
   * Fetch token prices from DexScreener API
   */
  private async fetchTokenPricesFromDexScreener(tokenAddresses: string[], chainId: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      const platformMap: Record<string, string> = {
        '1': 'ethereum',
        '137': 'polygon',
        '10': 'optimism',
        '42161': 'arbitrum',
        '8453': 'base',
        '56': 'bsc',
      };

      const platform = platformMap[chainId];
      if (!platform) {
        logger.warn(`DexScreener: Chain ${chainId} not supported`);
        return priceMap;
      }

      // DexScreener API allows up to 30 tokens per request
      const batchSize = 30;
      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        const tokenParam = batch.map(addr => `${platform}:${addr}`).join(',');
        
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenParam}`, {
            headers: {
              'User-Agent': 'MoonX-Farm-Sync-Worker/1.0'
            },
            signal: AbortSignal.timeout(8000),
          });

          if (response.ok) {
            const data = await response.json() as { pairs?: Array<{ baseToken?: { address: string }; priceUsd?: string }> };
            if (data?.pairs) {
              for (const pair of data.pairs) {
                if (pair.baseToken && pair.priceUsd) {
                  const price = parseFloat(pair.priceUsd);
                  if (!isNaN(price) && price > 0) {
                    priceMap.set(pair.baseToken.address.toLowerCase(), price);
                  }
                }
              }
            }
          }

          // Rate limiting
          if (i + batchSize < tokenAddresses.length) {
            await this.sleep(200);
          }
        } catch (error) {
          logger.warn(`DexScreener API error for batch ${i}:`, error);
        }
      }

      logger.debug(`DexScreener: Fetched ${priceMap.size} prices`);
      return priceMap;
    } catch (error) {
      logger.error('DexScreener API error:', error);
      return priceMap;
    }
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchTokenPricesFromCoinGecko(tokenAddresses: string[], chainId: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      const platformMap: Record<string, string> = {
        '1': 'ethereum',
        '137': 'polygon-pos',
        '10': 'optimistic-ethereum',
        '42161': 'arbitrum-one',
        '8453': 'base',
        '56': 'binance-smart-chain'
      };

      const platform = platformMap[chainId];
      if (!platform) {
        logger.warn(`CoinGecko: Chain ${chainId} not supported`);
        return priceMap;
      }

      const batchSize = 50;
      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        const cleanedBatch = batch
          .map(addr => addr.toLowerCase().trim())
          .filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr));
        
        if (cleanedBatch.length === 0) continue;
        
        try {
          await this.sleep(2000); // Rate limiting
          
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${cleanedBatch.join(',')}&vs_currencies=usd`,
            {
              headers: {
                'User-Agent': 'MoonX-Farm-Sync-Worker/1.0',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(12000),
            }
          );

          if (response.ok) {
            const data = await response.json() as Record<string, { usd?: number }>;
            for (const [address, priceData] of Object.entries(data)) {
              if (priceData && typeof priceData === 'object' && 'usd' in priceData) {
                const price = parseFloat(String(priceData.usd));
                if (!isNaN(price) && price > 0) {
                  priceMap.set(address.toLowerCase(), price);
                }
              }
            }
          }
        } catch (error) {
          logger.warn(`CoinGecko API error for batch ${i}:`, error);
        }
      }

      logger.debug(`CoinGecko: Fetched ${priceMap.size} prices`);
      return priceMap;
    } catch (error) {
      logger.error('CoinGecko API error:', error);
      return priceMap;
    }
  }

  /**
   * Enhanced Alchemy request with circuit breaker and rate limiting
   */
  private async makeRequest<T = any>(params: {
    method: string;
    params: any[];
    network: string;
  }): Promise<T> {
    const url = `https://${params.network}.g.alchemy.com/v2/${this.apiKey}`;
    const requestKey = `${params.network}-${params.method}`;
    
    // Check circuit breaker first
    if (this.isCircuitBreakerOpen(requestKey)) {
      logger.warn(`🚨 Circuit breaker OPEN for ${requestKey} - skipping request`);
      throw new Error(`Circuit breaker is open for ${requestKey} - service degraded`);
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Add rate limiting
        await this.rateLimitCheck(requestKey);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'MoonX-Farm-Sync-Worker/1.0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: params.method,
            params: params.params,
            id: 1,
          }),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();

        if (data.error) {
          const errorMsg = data.error.message || 'Unknown API error';
          if (data.error.code === -32603 || data.error.code === -32000) {
            this.recordFailure(requestKey);
          }
          throw new Error(`Alchemy API error: ${errorMsg}`);
        }

        // Record success for circuit breaker
        this.recordSuccess(requestKey);
        return data.result as T;
        
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;
        
        logger.warn(`Alchemy request attempt ${attempt}/${this.maxRetries} failed`, {
          method: params.method,
          network: params.network,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('503')) {
            this.recordFailure(requestKey);
          }
        }
        
        if (isLastAttempt) {
          throw error;
        }
        
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new Error('Max retries exceeded for Alchemy request');
  }

  // Circuit breaker methods
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const state = this.circuitBreakerState.get(endpoint);
    if (!state) return false;
    
    if (state.isOpen) {
      if (Date.now() - state.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        this.circuitBreakerState.set(endpoint, {
          failures: 0,
          lastFailure: 0,
          isOpen: false
        });
        return false;
      }
      return true;
    }
    
    return false;
  }

  private recordFailure(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint) || { failures: 0, lastFailure: 0, isOpen: false };
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      logger.warn(`🚨 Circuit breaker OPEN for ${endpoint} (${state.failures} failures)`);
    }
    
    this.circuitBreakerState.set(endpoint, state);
  }

  private recordSuccess(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
      this.circuitBreakerState.set(endpoint, state);
    }
  }

  private async rateLimitCheck(requestKey: string): Promise<void> {
    const lastRequest = this.lastRequestTime.get(requestKey);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        const delay = this.rateLimitDelay - timeSinceLastRequest;
        await this.sleep(delay);
      }
    }
    
    this.lastRequestTime.set(requestKey, Date.now());
  }

  // Utility methods
  private parseHexToBigInt(hex: string): bigint | null {
    try {
      if (!hex || hex === '0x' || hex === '0x0') {
        return BigInt(0);
      }
      return BigInt(hex);
    } catch (error) {
      logger.warn(`Failed to parse hex value: ${hex}`, error);
      return null;
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private createFallbackMetadata(tokenAddress: string): AlchemyTokenMetadata {
    const knownTokens: Record<string, { symbol: string; name: string; decimals: number }> = {
      // Base tokens
      '0x4200000000000000000000000000000000000006': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      
      // BSC tokens
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': { symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18 },
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { symbol: 'USDC', name: 'USD Coin', decimals: 18 },
    };

    const known = knownTokens[tokenAddress.toLowerCase()];
    if (known) {
      return {
        decimals: known.decimals,
        name: known.name,
        symbol: known.symbol
      };
    }

    const addressSuffix = tokenAddress.slice(-4).toUpperCase();
    return {
      decimals: 18,
      name: `Token ${addressSuffix}`,
      symbol: `TK${addressSuffix}`
    };
  }

  private createFallbackResponse(walletAddress: string, chainId: string): TokenBalance[] {
    logger.warn(`🔄 Using fallback strategy for wallet ${walletAddress} on chain ${chainId}`);
    return [];
  }

  private getCommonTokenSymbols(tokenAddresses: string[], chainId: string): Map<string, string> {
    const symbolMap = new Map<string, string>();
    
    const commonTokens: Record<string, string> = {
      // Base tokens
      '0x4200000000000000000000000000000000000006': 'ETHUSDT', // WETH
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDCUSDT', // USDC
      
      // BSC tokens
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'BNBUSDT', // WBNB
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDCUSDT', // USDC BSC
      
      // Ethereum tokens
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ETHUSDT', // WETH
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDCUSDT', // USDC
    };

    for (const address of tokenAddresses) {
      const lowerAddress = address.toLowerCase();
      
      if (this.isUSDTToken(address)) {
        continue; // Skip USDT, handled separately
      }
      
      const symbol = commonTokens[lowerAddress];
      if (symbol) {
        symbolMap.set(lowerAddress, symbol);
      }
    }

    return symbolMap;
  }

  private isUSDTToken(address: string): boolean {
    const usdtAddresses = [
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Ethereum
      '0x55d398326f99059ff775485246999027b3197955', // USDT BSC
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT Arbitrum
    ];
    
    return usdtAddresses.includes(address.toLowerCase());
  }

  private addFallbackPrices(tokenAddresses: string[], chainId: string, priceMap: Map<string, number>): void {
    const commonTokens: Record<string, number> = {
      // Base mainnet common tokens
      '0x4200000000000000000000000000000000000006': 2000, // WETH
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 1.0,   // USDC
      
      // BSC common tokens  
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 300,   // WBNB
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 1.0,   // USDC
    };

    for (const tokenAddress of tokenAddresses) {
      const lowerAddress = tokenAddress.toLowerCase();
      
      if (this.isUSDTToken(tokenAddress)) {
        priceMap.set(lowerAddress, 1.0);
        continue;
      }
      
      let price = commonTokens[lowerAddress];
      
      if (price) {
        priceMap.set(lowerAddress, price);
        logger.debug(`Using fallback price $${price} for token ${lowerAddress}`);
      } else {
        const minimumPrice = 0.01;
        priceMap.set(lowerAddress, minimumPrice);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get network name from chain ID
   */
  private getNetworkName(chainId: string): string {
    const networkMap: Record<string, string> = {
      '8453': 'base-mainnet',
      '56': 'bnb-mainnet',
    };

    return networkMap[chainId] || 'base-mainnet';
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest({
        method: 'eth_blockNumber',
        params: [],
        network: 'base-mainnet',
      });
      return true;
    } catch (error) {
      logger.error('Alchemy health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
} 