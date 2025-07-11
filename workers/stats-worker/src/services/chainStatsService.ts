import { ethers } from 'ethers';
import axios from 'axios';
import { 
  ChainPerformanceStats, 
  ChainConfig, 
  StatsCollectionError,
  HealthStatus 
} from '../types/index';
import { logger } from '../utils/logger';

export class ChainStatsService {
  private chains: ChainConfig[];
  private defiLlamaApiUrl: string;
  private alchemyApiKey: string;

  constructor(
    chains: ChainConfig[],
    defiLlamaApiUrl: string,
    alchemyApiKey: string
  ) {
    this.chains = chains.filter(chain => chain.enabled);
    this.defiLlamaApiUrl = defiLlamaApiUrl;
    this.alchemyApiKey = alchemyApiKey;
  }

  /**
   * Collect chain performance stats for all enabled chains
   */
  async collectAllChainStats(): Promise<ChainPerformanceStats[]> {
    const results: ChainPerformanceStats[] = [];
    
    logger.info('Starting chain stats collection', { 
      chainsCount: this.chains.length,
      chains: this.chains.map(c => c.name)
    });

    for (const chain of this.chains) {
      try {
        const stats = await this.collectChainStats(chain);
        results.push(stats);
        
        logger.info('Chain stats collected successfully', {
          chainName: chain.name,
          chainId: chain.chainId,
          blockTime: stats.blockTime.current,
          volume: stats.volume24h,
          status: stats.status
        });
      } catch (error) {
        logger.error('Failed to collect chain stats', {
          chainName: chain.name,
          chainId: chain.chainId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Create error stats entry
        results.push(this.createErrorStats(chain, error));
      }
    }

    return results;
  }

  /**
   * Collect performance stats for a specific chain
   */
  async collectChainStats(chain: ChainConfig): Promise<ChainPerformanceStats> {
    const startTime = Date.now();
    
    try {
      // Get provider for the chain
      const provider = new ethers.JsonRpcProvider(chain.rpc);
      
      // Collect stats in parallel
      const [blockTimeStats, volumeStats] = await Promise.all([
        this.getBlockTimeStats(provider, chain),
        this.getVolumeStats(chain.defiLlamaSlug)
      ]);

      const stats: ChainPerformanceStats = {
        chainId: chain.chainId,
        chainName: chain.name,
        chainSlug: chain.chainSlug,
        logoUrl: chain.logoUrl,
        blockTime: blockTimeStats,
        volume24h: volumeStats.formatted,
        volumeUSD: volumeStats.value,
        defiLlamaSlug: chain.defiLlamaSlug,
        rpcUrl: chain.rpc,
        status: this.determineHealthStatus(blockTimeStats, volumeStats),
        updatedAt: new Date()
      };

      const duration = Date.now() - startTime;
      logger.debug('Chain stats collection completed', {
        chainName: chain.name,
        duration,
        blockTime: blockTimeStats.current,
        volume: volumeStats.formatted
      });

      return stats;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Chain stats collection failed', {
        chainName: chain.name,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new StatsCollectionError(
        `Failed to collect stats for ${chain.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'chain_stats_service',
        { chainId: chain.chainId, chainName: chain.name }
      );
    }
  }

  /**
   * Calculate block time statistics and changes
   */
  private async getBlockTimeStats(provider: ethers.JsonRpcProvider, chain: ChainConfig) {
    const BLOCK_WINDOW = 100; // Number of blocks to analyze
    
    try {
      const latestBlock = await provider.getBlock('latest');
      if (!latestBlock) {
        throw new Error('Failed to get latest block');
      }

      // Current block time calculation
      const currentEnd = latestBlock.number;
      const currentStart = currentEnd - BLOCK_WINDOW;
      const currentStartBlock = await provider.getBlock(currentStart);
      
      if (!currentStartBlock) {
        throw new Error('Failed to get historical block');
      }

      const currentAvg = (latestBlock.timestamp - currentStartBlock.timestamp) / BLOCK_WINDOW;

      // Estimate blocks per day for historical comparison
      const blocksPerDay = Math.ceil(86400 / currentAvg); // 86400s = 24h
      const pastEnd = currentEnd - blocksPerDay;
      const pastStart = pastEnd - BLOCK_WINDOW;

      // Past block time calculation
      const [pastEndBlock, pastStartBlock] = await Promise.all([
        provider.getBlock(pastEnd),
        provider.getBlock(pastStart)
      ]);

      if (!pastEndBlock || !pastStartBlock) {
        // If we can't get historical data, return current with no change
        return {
          current: currentAvg,
          change: '~0.00%',
          changePercent: 0,
          timestamp: latestBlock.timestamp
        };
      }

      const pastAvg = (pastEndBlock.timestamp - pastStartBlock.timestamp) / BLOCK_WINDOW;

      // Calculate percentage change
      const changePercent = ((currentAvg - pastAvg) / pastAvg) * 100;
      const changeFormatted = Math.abs(changePercent) < 0.01 
        ? '~0.00%'
        : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

      return {
        current: currentAvg,
        change: changeFormatted,
        changePercent,
        timestamp: latestBlock.timestamp
      };
    } catch (error) {
      logger.error('Block time calculation failed', {
        chainName: chain.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Get 24h volume data from DefiLlama
   */
  private async getVolumeStats(slug: string): Promise<{ formatted: string; value: number }> {
    try {
      const url = `${this.defiLlamaApiUrl}/overview/dexs/${slug}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MoonX-Farm-Stats-Worker/1.0.0'
        }
      });

      const volumeUSD = response.data.total24h || 0;
      const formatted = this.formatUSDNumber(volumeUSD);

      return {
        formatted,
        value: volumeUSD
      };
    } catch (error) {
      logger.warn('Failed to get volume data from DefiLlama', {
        slug,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return default values if API fails
      return {
        formatted: '-',
        value: 0
      };
    }
  }

  /**
   * Format USD numbers for display
   */
  private formatUSDNumber(num: number): string {
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    if (num === 0) return '$0';
    return `$${num.toFixed(2)}`;
  }

  /**
   * Determine health status based on metrics
   */
  private determineHealthStatus(
    blockTimeStats: any,
    volumeStats: { formatted: string; value: number }
  ): HealthStatus {
    // Block time health check
    const blockTime = blockTimeStats.current;
    const blockTimeChange = Math.abs(blockTimeStats.changePercent);
    
    // Consider unhealthy if:
    // - Block time is very high (> 30 seconds)
    // - Block time increased significantly (> 50%)
    if (blockTime > 30 || blockTimeChange > 50) {
      return 'unhealthy';
    }
    
    // Consider degraded if:
    // - Block time is high (> 15 seconds)
    // - Block time increased moderately (> 25%)
    // - Volume is 0 (no trading activity)
    if (blockTime > 15 || blockTimeChange > 25 || volumeStats.value === 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Create error stats entry when collection fails
   */
  private createErrorStats(chain: ChainConfig, error: any): ChainPerformanceStats {
    return {
      chainId: chain.chainId,
      chainName: chain.name,
      chainSlug: chain.chainSlug,
      logoUrl: chain.logoUrl,
      blockTime: {
        current: 0,
        change: '-',
        changePercent: 0,
        timestamp: Math.floor(Date.now() / 1000)
      },
      volume24h: '-',
      volumeUSD: 0,
      defiLlamaSlug: chain.defiLlamaSlug,
      rpcUrl: chain.rpc,
      status: 'unhealthy',
      updatedAt: new Date()
    };
  }

  /**
   * Get health status for a specific chain
   */
  async getChainHealth(chainId: number): Promise<HealthStatus> {
    const chain = this.chains.find(c => c.chainId === chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }

    try {
      const stats = await this.collectChainStats(chain);
      return stats.status;
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return this.chains;
  }

  /**
   * Update chain configuration
   */
  updateChainConfig(chains: ChainConfig[]): void {
    this.chains = chains.filter(chain => chain.enabled);
    logger.info('Chain configuration updated', {
      chainsCount: this.chains.length,
      chains: this.chains.map(c => c.name)
    });
  }
} 