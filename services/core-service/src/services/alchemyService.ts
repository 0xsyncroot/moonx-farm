import axios from 'axios';
import { getApiKeys } from '@moonx-farm/configs';
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
  private rateLimitDelay: number = 300;
  private lastRequestTime: Map<string, number> = new Map();
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  }> = new Map();
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute cooldown

  constructor() {
    // Get API keys from @moonx-farm/configs
    const apiKeys = getApiKeys('core-service');
    this.apiKey = apiKeys.alchemy || '';
    this.baseUrl = 'https://api.alchemy.com/v2';
    
    // Debug logging for configuration
    console.log('🔑 AlchemyService Configuration Debug:');
    console.log(`  - API Keys loaded: ${Object.keys(apiKeys).join(', ')}`);
    console.log(`  - Alchemy API Key configured: ${this.apiKey ? 'Yes' : 'No'}`);
    console.log(`  - Environment ALCHEMY_API_KEY: ${process.env.ALCHEMY_API_KEY ? 'Set' : 'Not set'}`);
    
    if (!this.apiKey) {
      console.error('❌ ALCHEMY_API_KEY configuration missing!');
      console.error('📝 Debug info:');
      console.error(`  - Available API keys: ${JSON.stringify(Object.keys(apiKeys))}`);
      console.error(`  - apiKeys.alchemy value: ${apiKeys.alchemy}`);
      console.error(`  - process.env.ALCHEMY_API_KEY: ${process.env.ALCHEMY_API_KEY || 'undefined'}`);
      throw new Error('ALCHEMY_API_KEY configuration is required - check @moonx-farm/configs');
    }
    
    // Supported chains mapping - extended for production
    this.supportedChains = new Map([
      [56, 'bnb-mainnet'],       // BSC - Fixed URL
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
      // According to Alchemy docs, alchemy_getTokenBalances requires 2 parameters:
      // 1. address (wallet address)  
      // 2. tokenSpec (array of token addresses or "erc20" for all tokens)
      const balancesResponse = await this.makeAlchemyRequest<AlchemyTokenBalanceResponse>({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [walletAddress, "erc20"] // Fixed: Added tokenSpec parameter to get all ERC20 tokens
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
      
      // Check if error is due to circuit breaker
      if (error instanceof Error && error.message.includes('Circuit breaker is open')) {
        return this.createFallbackResponse(walletAddress, chainId);
      }
      
      // Return empty array instead of throwing to maintain graceful degradation
      return [];
    }
  }

  /**
   * Enhanced token metadata retrieval with better error handling and fallbacks
   */
  private async getTokenMetadata(tokenAddresses: string[], network: string): Promise<AlchemyTokenMetadata[]> {
    if (tokenAddresses.length === 0) return [];

    console.log(`🔍 Fetching metadata for ${tokenAddresses.length} tokens on ${network}`);

    try {
      // Process in smaller batches to avoid API limits and circuit breaker issues
      const batchSize = 5; // Reduced from 10 to 5 for better reliability
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
              const metadataResponse = await this.makeAlchemyRequest<{
                id: number;
                jsonrpc: string;
                result: AlchemyTokenMetadata;
              }>({
                id: 1,
                jsonrpc: '2.0',
                method: 'alchemy_getTokenMetadata',
                params: [tokenAddress] // Single token per request for better reliability
              }, network);

              if (metadataResponse?.result) {
                batchResults.push(metadataResponse.result);
              } else {
                batchResults.push(this.createFallbackMetadata(tokenAddress));
              }
            } catch (tokenError) {
              console.warn(`Failed to get metadata for token ${tokenAddress}:`, tokenError);
              batchResults.push(this.createFallbackMetadata(tokenAddress));
            }
            
            // Small delay between individual requests
            await this.sleep(100);
          }
          
          results.push(...batchResults);
          
        } catch (batchError) {
          console.warn(`Failed to get metadata for batch ${i}-${i + batchSize}:`, batchError);
          // Fill with fallback metadata for failed batch
          results.push(...batch.map(addr => this.createFallbackMetadata(addr)));
        }

        // Add delay between batches
        if (i + batchSize < tokenAddresses.length) {
          await this.sleep(300);
        }
      }

      console.log(`✅ Metadata fetching complete: ${results.length}/${tokenAddresses.length} tokens processed`);
      return results;
      
    } catch (error) {
      console.error('❌ Error fetching token metadata:', error);
      // Return fallback metadata for all tokens
      return tokenAddresses.map(addr => this.createFallbackMetadata(addr));
    }
  }

  /**
   * Create smart fallback metadata based on token address
   */
  private createFallbackMetadata(tokenAddress: string): AlchemyTokenMetadata {
    // Check if it's a known token
    const knownTokens: { [key: string]: { symbol: string; name: string; decimals: number } } = {
      // Base tokens
      '0x4200000000000000000000000000000000000006': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      
      // BSC tokens
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': { symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18 },
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { symbol: 'USDC', name: 'USD Coin', decimals: 18 },
      '0x55d398326f99059ff775485246999027b3197955': { symbol: 'USDT', name: 'Tether USD', decimals: 18 },
      
      // Ethereum tokens
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    };

    const known = knownTokens[tokenAddress.toLowerCase()];
    if (known) {
      return {
        decimals: known.decimals,
        name: known.name,
        symbol: known.symbol
      };
    }

    // Generate symbol from address (last 4 chars)
    const addressSuffix = tokenAddress.slice(-4).toUpperCase();
    
    return {
      decimals: 18, // Most common
      name: `Token ${addressSuffix}`,
      symbol: `TK${addressSuffix}`
    };
  }

  /**
   * Enhanced token prices with improved fallback strategy
   */
  async getTokenPrices(tokenAddresses: string[], chainId: number): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      if (tokenAddresses.length === 0) {
        return priceMap;
      }

      console.log(`💰 Fetching prices for ${tokenAddresses.length} tokens on chain ${chainId}`);

      // 1. Try Binance API first for common tokens (fastest & most reliable)
      try {
        const binanceResults = await this.fetchTokenPricesFromBinance(tokenAddresses, chainId);
        if (binanceResults.size > 0) {
          console.log(`🚀 Binance provided ${binanceResults.size} prices`);
          for (const [address, price] of binanceResults) {
            priceMap.set(address, price);
          }
        }
      } catch (error) {
        console.warn('⚠️  Binance API failed:', error);
      }

      // 2. For remaining tokens, try DexScreener
      const missingAfterBinance = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (missingAfterBinance.length > 0) {
        try {
          const dexResults = await this.fetchTokenPricesFromDexScreener(missingAfterBinance, chainId);
          if (dexResults.size > 0) {
            console.log(`📊 DexScreener provided ${dexResults.size} additional prices`);
            for (const [address, price] of dexResults) {
              priceMap.set(address, price);
            }
          }
        } catch (error) {
          console.warn('⚠️  DexScreener API failed:', error);
        }
      }

      // 3. For tokens still without prices, try CoinGecko
      const missingAfterDex = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (missingAfterDex.length > 0) {
        try {
          const cgResults = await this.fetchTokenPricesFromCoinGeckoImproved(missingAfterDex, chainId);
          for (const [address, price] of cgResults) {
            priceMap.set(address, price);
          }
          console.log(`🦎 CoinGecko provided ${cgResults.size} additional prices`);
        } catch (error) {
          console.warn('⚠️  CoinGecko API failed:', error);
        }
      }

      // 4. Use fallback prices for remaining tokens
      const stillMissingTokens = tokenAddresses.filter(addr => !priceMap.has(addr.toLowerCase()));
      if (stillMissingTokens.length > 0) {
        console.log(`🔄 Using fallback prices for ${stillMissingTokens.length} tokens`);
        this.addFallbackPrices(stillMissingTokens, chainId, priceMap);
      }

      console.log(`✅ Price fetching complete: ${priceMap.size}/${tokenAddresses.length} tokens have prices`);
      return priceMap;
    } catch (error) {
      console.error('❌ Error in getTokenPrices:', error);
      // Return fallback prices as last resort
      this.addFallbackPrices(tokenAddresses, chainId, priceMap);
      return priceMap;
    }
  }

  /**
   * Improved CoinGecko API implementation with better error handling
   */
  private async fetchTokenPricesFromCoinGeckoImproved(tokenAddresses: string[], chainId: number): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      const platformMap: { [key: number]: string } = {
        1: 'ethereum',
        137: 'polygon-pos',
        10: 'optimistic-ethereum',
        42161: 'arbitrum-one',
        8453: 'base',
        56: 'binance-smart-chain'
      };

      const platform = platformMap[chainId];
      if (!platform) {
        console.warn(`CoinGecko: Chain ${chainId} not supported`);
        return priceMap;
      }

      // Use smaller batches for better reliability
      const batchSize = 50;
      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        
        // Clean and validate token addresses
        const cleanedBatch = batch
          .map(addr => addr.toLowerCase().trim())
          .filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr));
        
        if (cleanedBatch.length === 0) continue;
        
        const tokenParam = cleanedBatch.join(',');
        
        try {
          // Add rate limiting
          await this.sleep(2000);
          
          const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/token_price/${platform}`,
            {
              params: {
                contract_addresses: tokenParam,
                vs_currencies: 'usd',
                include_24hr_change: false
              },
              timeout: 12000,
              headers: {
                'User-Agent': 'MoonX-Farm-Core-Service/1.0',
                'Accept': 'application/json'
              },
              validateStatus: (status) => status < 500
            }
          );

          if (response.status === 200 && response.data) {
            for (const [address, priceData] of Object.entries(response.data)) {
              if (priceData && typeof priceData === 'object' && 'usd' in priceData) {
                const price = parseFloat((priceData as any).usd);
                if (!isNaN(price) && price > 0) {
                  priceMap.set(address.toLowerCase(), price);
                }
              }
            }
          } else {
            console.warn(`CoinGecko returned status ${response.status} for batch ${i}`);
          }
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 429) {
              console.warn('CoinGecko rate limit hit, waiting longer...');
              await this.sleep(5000);
            } else if (error.response?.status === 400) {
              console.warn(`CoinGecko 400 error for batch ${i}:`, error.response.data);
            } else {
              console.warn(`CoinGecko API error ${error.response?.status} for batch ${i}:`, error.message);
            }
          } else {
            console.warn(`CoinGecko network error for batch ${i}:`, error);
          }
        }
      }

      console.log(`CoinGecko: Fetched ${priceMap.size} prices for ${tokenAddresses.length} tokens`);
      return priceMap;
    } catch (error) {
      console.error('CoinGecko API error:', error);
      return priceMap;
    }
  }

  /**
   * Enhanced Alchemy request with better retry logic and rate limiting
   */
  private async makeAlchemyRequest<T>(payload: any, network: string): Promise<T> {
    const url = `https://${network}.g.alchemy.com/v2/${this.apiKey}`;
    const requestKey = `${network}-${payload.method}`;
    
    // Check circuit breaker first
    if (this.isCircuitBreakerOpen(requestKey)) {
      console.warn(`🚨 Circuit breaker OPEN for ${requestKey} - skipping request`);
      throw new Error(`Circuit breaker is open for ${requestKey} - service degraded`);
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Add rate limiting
        await this.rateLimitCheck(requestKey);
        
        const response = await axios.post(url, payload, {
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'MoonX-Farm-Core-Service/1.0'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        });

        if (response.data.error) {
          const errorMsg = response.data.error.message || 'Unknown API error';
          // Some errors should trigger circuit breaker
          if (response.data.error.code === -32603 || response.data.error.code === -32000) {
            this.recordFailure(requestKey);
          }
          throw new Error(`Alchemy API error: ${errorMsg}`);
        }

        // Record success for circuit breaker
        this.recordSuccess(requestKey);
        return response.data as T;
        
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === this.maxRetries;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          console.warn(`Alchemy request attempt ${attempt}/${this.maxRetries} failed - Status: ${status}, URL: ${url}`);
          
          // Record failure for circuit breaker on 503/500 errors
          if (status && (status >= 500 || status === 503)) {
            this.recordFailure(requestKey);
          }
          
          if (status === 503) {
            console.warn('⚠️  Alchemy service unavailable (503) - Extended backoff');
            if (!isLastAttempt) {
              await this.sleep(Math.pow(2, attempt) * 3000); // Longer wait for 503
            }
          } else if (status === 429) {
            console.warn('⚠️  Alchemy rate limit hit (429) - Backing off');
            if (!isLastAttempt) {
              await this.sleep(Math.pow(2, attempt) * 2000);
            }
          } else if (status === 502 || status === 504) {
            console.warn('⚠️  Alchemy gateway error - Retry with backoff');
            if (!isLastAttempt) {
              await this.sleep(Math.pow(2, attempt) * 1500);
            }
          } else if (!isRetryable || isLastAttempt) {
            throw error;
          } else {
            await this.sleep(Math.pow(2, attempt) * 1000);
          }
        } else {
          console.warn(`Alchemy request attempt ${attempt}/${this.maxRetries} failed:`, error);
          
          // Record failure for circuit breaker on connection errors
          if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = (error as any).code;
            if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT') {
              this.recordFailure(requestKey);
            }
          }
          
          if (!isRetryable || isLastAttempt) {
            throw error;
          }
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw new Error('Max retries exceeded for Alchemy request');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return !status || status >= 500 || status === 429 || status === 503;
    }
    
    if (error && typeof error === 'object') {
      const errorCode = error.code;
      const errorName = error.name;
      
      return errorCode === 'ECONNRESET' || 
             errorCode === 'ENOTFOUND' || 
             errorCode === 'ETIMEDOUT' ||
             errorName === 'TimeoutError';
    }
    
    return false;
  }

  /**
   * Rate limiting check
   */
  // Circuit breaker check
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const state = this.circuitBreakerState.get(endpoint);
    if (!state) return false;
    
    if (state.isOpen) {
      // Check if timeout has passed
      if (Date.now() - state.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        // Reset circuit breaker
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

  // Record failure for circuit breaker
  private recordFailure(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint) || { failures: 0, lastFailure: 0, isOpen: false };
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      console.warn(`🚨 Circuit breaker OPEN for ${endpoint} (${state.failures} failures)`);
    }
    
    this.circuitBreakerState.set(endpoint, state);
  }

  // Record success for circuit breaker
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
    
    // Update last request time
    this.lastRequestTime.set(requestKey, Date.now());
  }

  /**
   * Fetch token prices from DexScreener API
   */
  private async fetchTokenPricesFromDexScreener(tokenAddresses: string[], chainId: number): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      const platformMap: { [key: number]: string } = {
        1: 'ethereum',
        137: 'polygon',
        10: 'optimism',
        42161: 'arbitrum',
        8453: 'base',
        56: 'bsc' // Added BSC support
      };

      const platform = platformMap[chainId];
      if (!platform) {
        console.warn(`DexScreener: Chain ${chainId} not supported`);
        return priceMap;
      }

      // DexScreener API allows up to 30 tokens per request
      const batchSize = 30;
      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        const tokenParam = batch.map(addr => `${platform}:${addr}`).join(',');
        
        try {
          const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenParam}`, {
            timeout: 8000,
            headers: {
              'User-Agent': 'MoonX-Farm-Core-Service/1.0'
            }
          });

          if (response.data?.pairs) {
            for (const pair of response.data.pairs) {
              if (pair.baseToken && pair.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (!isNaN(price) && price > 0) {
                  priceMap.set(pair.baseToken.address.toLowerCase(), price);
                }
              }
            }
          }

          // Rate limiting
          if (i + batchSize < tokenAddresses.length) {
            await this.sleep(200); // 200ms between requests
          }
        } catch (error) {
          console.warn(`DexScreener API error for batch ${i}:`, error);
        }
      }

      console.log(`DexScreener: Fetched ${priceMap.size} prices for ${tokenAddresses.length} tokens`);
      return priceMap;
    } catch (error) {
      console.error('DexScreener API error:', error);
      return priceMap;
    }
  }

  /**
   * Add fallback prices for common tokens when APIs fail
   */
  private addFallbackPrices(tokenAddresses: string[], chainId: number, priceMap: Map<string, number>): void {
    const commonTokens: { [key: string]: number } = {
      // Base mainnet common tokens
      '0x4200000000000000000000000000000000000006': 2000, // WETH on Base
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 1.0,   // USDC on Base
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 1.0,   // DAI on Base
      
      // BSC common tokens  
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 300,   // WBNB
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 1.0,   // USDC on BSC
      
      // Ethereum mainnet (if we expand support)
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 2000, // WETH
      '0xa0b86a33e6ba3f8e4de3a95c2b8c1e8c0b8e7e8f': 2000, // WETH
      '0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b': 1.0,   // USDC
      '0x6b175474e89094c44da98b954eedeac495271d0f': 1.0,   // DAI
      
      // Common token patterns
      'usdc': 1.0,
      'dai': 1.0,
      'weth': 2000,
      'wbnb': 300,
      'eth': 2000,
      'bnb': 300,
      'wbtc': 35000,
      'matic': 0.8,
      'link': 15,
      'uni': 6
    };

    for (const tokenAddress of tokenAddresses) {
      const lowerAddress = tokenAddress.toLowerCase();
      
      // Handle USDT separately (always 1.0)
      if (this.isUSDTToken(tokenAddress)) {
        priceMap.set(lowerAddress, 1.0);
        console.log(`Using fallback price $1.00 for USDT token ${lowerAddress}`);
        continue;
      }
      
      let price = commonTokens[lowerAddress];
      
      if (!price) {
        // Try pattern matching based on symbol or name
        for (const [token, tokenPrice] of Object.entries(commonTokens)) {
          if (token.length > 10 && lowerAddress === token.toLowerCase()) {
            price = tokenPrice;
            break;
          } else if (token.length <= 10 && lowerAddress.includes(token)) {
            price = tokenPrice;
            break;
          }
        }
      }
      
      if (price) {
        priceMap.set(lowerAddress, price);
        console.log(`Using fallback price $${price} for token ${lowerAddress}`);
      } else {
        // Very last resort - minimal price for display purposes
        const minimumPrice = 0.01;
        priceMap.set(lowerAddress, minimumPrice);
        console.log(`Using minimum fallback price $${minimumPrice} for unknown token ${lowerAddress}`);
      }
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

      // Get native token price
      const nativePrice = await this.getNativeTokenPrice(chainId);
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

  private async getNativeTokenPrice(chainId: number): Promise<number> {
    try {
      // Get native token price from CoinGecko
      const nativeTokenIds: { [key: number]: string } = {
        1: 'ethereum',
        137: 'matic-network',
        10: 'ethereum',
        42161: 'ethereum',
        8453: 'ethereum'
      };

      const tokenId = nativeTokenIds[chainId];
      if (!tokenId) {
        console.warn(`No native token ID for chain ${chainId}`);
        return 1;
      }

      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
        params: {
          ids: tokenId,
          vs_currencies: 'usd'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'MoonX-Farm-Core-Service/1.0'
        }
      });

      if (response.data[tokenId]?.usd) {
        const price = parseFloat(response.data[tokenId].usd);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }

      // Fallback prices if API fails
      const fallbackPrices: { [key: number]: number } = {
        1: 2000,    // ETH
        137: 0.8,   // MATIC
        10: 2000,   // ETH (Optimism)
        42161: 2000, // ETH (Arbitrum)
        8453: 2000   // ETH (Base)
      };
      
      console.warn(`Using fallback price for chain ${chainId}`);
      return fallbackPrices[chainId] || 1;
    } catch (error) {
      console.error(`Error fetching native token price for chain ${chainId}:`, error);
      
      // Return fallback price
      const fallbackPrices: { [key: number]: number } = {
        1: 2000,    // ETH
        137: 0.8,   // MATIC
        10: 2000,   // ETH (Optimism)
        42161: 2000, // ETH (Arbitrum)
        8453: 2000   // ETH (Base)
      };
      
      return fallbackPrices[chainId] || 1;
    }
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
    status: 'healthy' | 'unhealthy' | 'degraded';
    apiKey: boolean;
    connectivity: boolean;
    supportedChains: number;
    circuitBreakerStatus: Record<string, any>;
  }> {
    const healthStatus = {
      status: 'healthy' as 'healthy' | 'unhealthy' | 'degraded',
      apiKey: !!this.apiKey,
      connectivity: false,
      supportedChains: this.supportedChains.size,
      circuitBreakerStatus: {} as Record<string, any>
    };

    // Check circuit breaker status
    const circuitBreakerStatus: Record<string, any> = {};
    for (const [key, state] of this.circuitBreakerState.entries()) {
      circuitBreakerStatus[key] = {
        isOpen: state.isOpen,
        failures: state.failures,
        lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null
      };
    }
    healthStatus.circuitBreakerStatus = circuitBreakerStatus;

    // Test connectivity with a simple request
    try {
      const testNetwork = 'base-mainnet';
      const testPayload = {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: []
      };
      
      await this.makeAlchemyRequest(testPayload, testNetwork);
      healthStatus.connectivity = true;
    } catch (error) {
      console.warn('Alchemy health check failed:', error);
      healthStatus.connectivity = false;
      healthStatus.status = 'unhealthy';
    }

    // Determine overall status
    const hasOpenCircuitBreakers = Object.values(circuitBreakerStatus).some(state => state.isOpen);
    if (hasOpenCircuitBreakers && healthStatus.connectivity) {
      healthStatus.status = 'degraded';
    } else if (!healthStatus.connectivity || !healthStatus.apiKey) {
      healthStatus.status = 'unhealthy';
    }

    return healthStatus;
  }

  /**
   * Fallback strategy when circuit breaker is open
   */
  private createFallbackResponse(walletAddress: string, chainId: number): TokenHolding[] {
    console.warn(`🔄 Using fallback strategy for wallet ${walletAddress} on chain ${chainId}`);
    
    // Return empty array but log that fallback was used
    // In production, this could return cached data from database
    return [];
  }

  /**
   * Enhanced native token detection
   */
  private isNativeToken(tokenAddress: string): boolean {
    const nativeAddresses = [
      '0x0000000000000000000000000000000000000000',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      '0x4200000000000000000000000000000000000006', // WETH on Base/Optimism 
    ];
    
    return nativeAddresses.includes(tokenAddress.toLowerCase());
  }

  /**
   * Check if token address is USDT
   */
  private isUSDTToken(address: string): boolean {
    const usdtAddresses = [
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Ethereum
      '0x55d398326f99059ff775485246999027b3197955', // USDT BSC
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT Arbitrum
      '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT Polygon
    ];
    
    return usdtAddresses.includes(address.toLowerCase());
  }

  /**
   * Get common token symbols for Binance API
   */
  private getCommonTokenSymbols(tokenAddresses: string[], chainId: number): Map<string, string> {
    const symbolMap = new Map<string, string>();
    
    // Common token address to symbol mapping (excluding USDT since USDTUSDT = 1.0 always)
    const commonTokens: { [key: string]: string } = {
      // Ethereum Mainnet
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ETHUSDT', // WETH
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDCUSDT', // USDC
      '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAIUSDT', // DAI
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'BTCUSDT', // WBTC
      '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINKUSDT', // LINK
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNIUSDT', // UNI
      
      // BSC Mainnet  
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'BNBUSDT', // WBNB
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDCUSDT', // USDC BSC
      '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': 'BTCUSDT', // BTCB
      
      // Base Mainnet
      '0x4200000000000000000000000000000000000006': 'ETHUSDT', // WETH Base
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDCUSDT', // USDC Base
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'DAIUSDT', // DAI Base
      
      // Arbitrum
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'ETHUSDT', // WETH Arbitrum
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDCUSDT', // USDC Arbitrum
      
      // Polygon
      '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'MATICUSDT', // WMATIC
      '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'USDCUSDT', // USDC Polygon
    };

    for (const address of tokenAddresses) {
      const lowerAddress = address.toLowerCase();
      
      // Check if it's USDT - skip since price is always 1.0
      if (this.isUSDTToken(address)) {
        continue; // Don't add to symbolMap, will be handled separately
      }
      
      const symbol = commonTokens[lowerAddress];
      if (symbol) {
        symbolMap.set(lowerAddress, symbol);
      }
    }

    return symbolMap;
  }

  /**
   * Fetch prices from Binance API for common tokens
   */
  private async fetchTokenPricesFromBinance(tokenAddresses: string[], chainId: number): Promise<Map<string, number>> {
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
        console.log(`💰 USDT: Set ${usdtCount} USDT prices to $1.00`);
      }

      // Get symbol mapping for non-USDT tokens
      const symbolMap = this.getCommonTokenSymbols(tokenAddresses, chainId);
      
      if (symbolMap.size === 0) {
        return priceMap; // Only USDT tokens or no mappable tokens
      }

      const symbols = Array.from(new Set(symbolMap.values())); // Remove duplicates
      const symbolsParam = JSON.stringify(symbols);
      
      console.log(`📈 Fetching Binance prices for ${symbols.length} symbols`);
      
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: {
          symbols: symbolsParam
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'MoonX-Farm-Core-Service/1.0'
        }
      });

      if (response.data && Array.isArray(response.data)) {
        const priceData: { symbol: string; price: string }[] = response.data;
        
        // Map symbols back to token addresses
        for (const [address, symbol] of symbolMap.entries()) {
          const priceInfo = priceData.find(p => p.symbol === symbol);
          if (priceInfo) {
            const price = parseFloat(priceInfo.price);
            if (!isNaN(price) && price > 0) {
              priceMap.set(address, price);
            }
          }
        }
      }

      console.log(`🚀 Binance: Fetched ${priceMap.size} total prices (${usdtCount} USDT + ${priceMap.size - usdtCount} API)`);
      return priceMap;
      
    } catch (error) {
      console.warn('⚠️  Binance API error:', error);
      return priceMap;
    }
  }
} 