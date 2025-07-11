import axios from 'axios';
import { 
  BridgeLatencyStats, 
  BridgeConfig, 
  StatsCollectionError,
  HealthStatus 
} from '../types/index';
import { bridgeStatsLogger } from '../utils/logger';

export class BridgeStatsService {
  private bridges: BridgeConfig[];
  private lifiApiUrl: string;
  private relayApiUrl: string;
  private lifiApiKey?: string;
  private dummyAddress: string = '0x34Dd4B1035A245886e2ca84f7D00a2e7236C13A3';
  private ETH: string = '0x0000000000000000000000000000000000000000';

  constructor(
    bridges: BridgeConfig[],
    lifiApiUrl: string,
    relayApiUrl: string,
    lifiApiKey?: string
  ) {
    this.bridges = bridges.filter(bridge => bridge.enabled);
    this.lifiApiUrl = lifiApiUrl;
    this.relayApiUrl = relayApiUrl;
    this.lifiApiKey = lifiApiKey;
  }

  /**
   * Collect bridge latency stats for all enabled bridges
   */
  async collectAllBridgeStats(): Promise<BridgeLatencyStats[]> {
    const results: BridgeLatencyStats[] = [];
    
    bridgeStatsLogger.info('Starting bridge latency collection', { 
      bridgesCount: this.bridges.length,
      bridges: this.bridges.map(b => b.name)
    });

    // Collect stats for all bridges in parallel
    const promises = this.bridges.map(bridge => this.collectBridgeStats(bridge));
    
    const settledResults = await Promise.allSettled(promises);
    
    settledResults.forEach((result, index) => {
      const bridge = this.bridges[index];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
        bridgeStatsLogger.info('Bridge stats collected successfully', {
          bridgeName: bridge.name,
          provider: bridge.provider,
          latency: result.value.latency,
          status: result.value.status
        });
      } else {
        bridgeStatsLogger.error('Failed to collect bridge stats', {
          bridgeName: bridge.name,
          provider: bridge.provider,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        });
        
        // Create error stats entry
        results.push(this.createErrorStats(bridge, result.reason));
      }
    });

    return results;
  }

  /**
   * Collect latency stats for a specific bridge
   */
  async collectBridgeStats(bridge: BridgeConfig): Promise<BridgeLatencyStats> {
    const startTime = Date.now();
    
    try {
      let latency: number;
      let route: string | undefined;
      let fromChain: number | undefined;
      let toChain: number | undefined;

      switch (bridge.provider) {
        case 'LI.FI':
          ({ latency, route, fromChain, toChain } = await this.testLiFiLatency());
          break;
        case 'Relay.link':
          ({ latency, route, fromChain, toChain } = await this.testRelayLatency());
          break;
        case '1inch':
          ({ latency, route, fromChain, toChain } = await this.test1inchLatency());
          break;
        default:
          throw new Error(`Unsupported bridge provider: ${bridge.provider}`);
      }

      const stats: BridgeLatencyStats = {
        provider: bridge.provider as any,
        latency,
        status: this.determineHealthStatus(latency),
        timestamp: Math.floor(Date.now() / 1000),
        route,
        fromChain,
        toChain,
        updatedAt: new Date()
      };

      const duration = Date.now() - startTime;
      bridgeStatsLogger.debug('Bridge stats collection completed', {
        provider: bridge.provider,
        latency,
        duration,
        route
      });

      return stats;
    } catch (error) {
      const duration = Date.now() - startTime;
      bridgeStatsLogger.error('Bridge stats collection failed', {
        provider: bridge.provider,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new StatsCollectionError(
        `Failed to collect stats for ${bridge.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'bridge_stats_service',
        { provider: bridge.provider, bridgeName: bridge.name }
      );
    }
  }

  /**
   * Test LI.FI latency with Base to Base swap
   */
  private async testLiFiLatency(): Promise<{ latency: number; route: string; fromChain: number; toChain: number }> {
    const url = `${this.lifiApiUrl}/quote`;
    const params = {
      fromChain: 8453, // Base
      toChain: 8453, // Base
      fromToken: this.ETH,
      toToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
      fromAddress: this.dummyAddress,
      toAddress: this.dummyAddress,
      fromAmount: '10000000000000000000', // 10 ETH
      order: 'FASTEST',
      preferExchanges: 'lifidexaggregator',
      integrator: 'moonx-farm',
      referrer: this.dummyAddress,
      slippage: 0.005
    };

    const startTime = Date.now();
    
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'MoonX-Farm-Stats-Worker/1.0.0'
      };
      
      // Add API key if available
      if (this.lifiApiKey) {
        headers['x-lifi-api-key'] = this.lifiApiKey;
      }
      
      await axios.get(url, { 
        params,
        timeout: 30000,
        headers
      });
      
      const latency = Date.now() - startTime;
      
      return {
        latency,
        route: 'Base->Base',
        fromChain: 8453,
        toChain: 8453
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // If it's a timeout or network error, still record the latency
      if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND')) {
        return {
          latency,
          route: 'Base->Base',
          fromChain: 8453,
          toChain: 8453
        };
      }
      
      throw error;
    }
  }

  /**
   * Test Relay.link latency with ETH to ETH cross-chain
   */
  private async testRelayLatency(): Promise<{ latency: number; route: string; fromChain: number; toChain: number }> {
    const url = `${this.relayApiUrl}/quote`;
    const payload = {
      user: this.dummyAddress,
      originChainId: 8453, // Ethereum
      destinationChainId: 56, // Arbitrum
      originCurrency: this.ETH,
      destinationCurrency: this.ETH,
      recipient: this.dummyAddress,
      tradeType: 'EXACT_INPUT',
      amount: '100000000000000000', // 0.1 ETH
      referrer: 'relay.link',
      useExternalLiquidity: false,
      useDepositAddress: false,
      topupGas: false
    };

    const startTime = Date.now();
    
    try {
      await axios.post(url, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MoonX-Farm-Stats-Worker/1.0.0'
        }
      });
      
      const latency = Date.now() - startTime;
      
      return {
        latency,
        route: 'Ethereum->Arbitrum',
        fromChain: 1,
        toChain: 42161
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // If it's a timeout or network error, still record the latency
      if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND')) {
        return {
          latency,
          route: 'Ethereum->Arbitrum',
          fromChain: 1,
          toChain: 42161
        };
      }
      
      throw error;
    }
  }

  /**
   * Test 1inch latency (real API implementation)
   */
  private async test1inchLatency(): Promise<{ latency: number; route: string; fromChain: number; toChain: number }> {
    // 1inch doesn't support cross-chain, so this would be a same-chain swap
    const startTime = Date.now();
    
    try {
      // Real 1inch API call for price quote
      const url = 'https://api.1inch.dev/swap/v5.2/1/quote';
      const params = {
        src: this.ETH, // ETH
        dst: '0xA0b86a33E6417efE8A0e9b7FE7Da5A2aB65c4ED0', // USDC
        amount: '1000000000000000000', // 1 ETH
        includeTokensInfo: 'false',
        includeProtocols: 'false',
        includeGas: 'false'
      };
      
      await axios.get(url, { 
        params,
        timeout: 15000,
        headers: {
          'User-Agent': 'MoonX-Farm-Stats-Worker/1.0.0',
          'Accept': 'application/json'
        }
      });
      
      const latency = Date.now() - startTime;
      
      return {
        latency,
        route: 'Ethereum->Ethereum',
        fromChain: 1,
        toChain: 1
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // If it's a timeout or network error, still record the latency
      if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND')) {
        return {
          latency,
          route: 'Ethereum->Ethereum',
          fromChain: 1,
          toChain: 1
        };
      }
      
      throw error;
    }
  }

  /**
   * Determine health status based on latency
   */
  private determineHealthStatus(latency: number): HealthStatus {
    // Consider unhealthy if latency is > 10 seconds
    if (latency > 10000) {
      return 'unhealthy';
    }
    
    // Consider degraded if latency is > 5 seconds
    if (latency > 5000) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Create error stats entry when collection fails
   */
  private createErrorStats(bridge: BridgeConfig, error: any): BridgeLatencyStats {
    return {
      provider: bridge.provider as any,
      latency: 0,
      status: 'unhealthy',
      timestamp: Math.floor(Date.now() / 1000),
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: new Date()
    };
  }

  /**
   * Get health status for a specific bridge
   */
  async getBridgeHealth(provider: string): Promise<HealthStatus> {
    const bridge = this.bridges.find(b => b.provider === provider);
    if (!bridge) {
      throw new Error(`Bridge ${provider} not found`);
    }

    try {
      const stats = await this.collectBridgeStats(bridge);
      return stats.status;
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Get supported bridges
   */
  getSupportedBridges(): BridgeConfig[] {
    return this.bridges;
  }

  /**
   * Update bridge configuration
   */
  updateBridgeConfig(bridges: BridgeConfig[]): void {
    this.bridges = bridges.filter(bridge => bridge.enabled);
    bridgeStatsLogger.info('Bridge configuration updated', {
      bridgesCount: this.bridges.length,
      bridges: this.bridges.map(b => b.name)
    });
  }

  /**
   * Measure latency for a custom function
   */
  private async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const startTime = Date.now();
    const result = await fn();
    const latency = Date.now() - startTime;
    
    return { result, latency };
  }
} 