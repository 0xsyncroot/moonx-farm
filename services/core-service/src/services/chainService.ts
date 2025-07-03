import { Chain, CreateChainRequest, UpdateChainRequest, ChainModel } from '../models/chain';
import { CacheService } from './cacheService';
import { DatabaseService } from './databaseService';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('core-service');

export class ChainService {
  private chainModel: ChainModel;
  private cacheService: CacheService;
  private db: DatabaseService;

  // Cache keys
  private static readonly CACHE_KEYS = {
    ALL_CHAINS: 'chains:all',
    ACTIVE_CHAINS: 'chains:active',
    MAINNET_CHAINS: 'chains:mainnet',
    TESTNET_CHAINS: 'chains:testnet',
    CHAIN_BY_ID: (chainId: number) => `chains:chain_id:${chainId}`,
    CHAIN_BY_UUID: (id: string) => `chains:uuid:${id}`,
  };

  // Cache TTL (Time To Live) in seconds
  private static readonly CACHE_TTL = {
    CHAINS_LIST: 604800, // 7 days
    SINGLE_CHAIN: 604800, // 7 days
  };

  constructor(databaseService: DatabaseService, cacheService: CacheService) {
    this.db = databaseService;
    this.cacheService = cacheService;
    this.chainModel = new ChainModel(this.db.getPool());
  }

  // Create a new chain (admin only)
  async createChain(chainData: CreateChainRequest): Promise<Chain> {
    try {
      // Check if chain ID already exists
      const existing = await this.chainModel.chainIdExists(chainData.chainId);
      if (existing) {
        throw new Error(`Chain with ID ${chainData.chainId} already exists`);
      }

      // Create chain in database
      const chain = await this.chainModel.createChain(chainData);

      // Auto refresh cache after creation
      await this.autoRefreshCacheAfterModification();

      logger.info('Chain created successfully with cache auto-refreshed', { 
        chainId: chain.chainId, 
        name: chain.name 
      });

      return chain;
    } catch (error) {
      logger.error('Error creating chain', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        chainId: chainData.chainId,
        name: chainData.name
      });
      throw error;
    }
  }

  // Get all chains with caching
  async getAllChains(): Promise<Chain[]> {
    const cacheKey = ChainService.CACHE_KEYS.ALL_CHAINS;
    
    // Try cache first
    const cached = await this.cacheService.get<Chain[]>(cacheKey);
    if (cached) {
      logger.debug('Chains retrieved from cache', { count: cached.length });
      return cached;
    }

    // Get from database
    const chains = await this.chainModel.getAllChains();

    // Cache the result
    await this.cacheService.set(cacheKey, chains, ChainService.CACHE_TTL.CHAINS_LIST);

    logger.debug('Chains retrieved from database and cached', { count: chains.length });
    return chains;
  }

  // Get active chains only
  async getActiveChains(): Promise<Chain[]> {
    const cacheKey = ChainService.CACHE_KEYS.ACTIVE_CHAINS;
    
    // Try cache first
    const cached = await this.cacheService.get<Chain[]>(cacheKey);
    if (cached) {
      logger.debug('Active chains retrieved from cache', { count: cached.length });
      return cached;
    }

    // Get from database
    const chains = await this.chainModel.getActiveChains();

    // Cache the result
    await this.cacheService.set(cacheKey, chains, ChainService.CACHE_TTL.CHAINS_LIST);

    logger.debug('Active chains retrieved from database and cached', { count: chains.length });
    return chains;
  }

  // Get chains by network type (mainnet/testnet)
  async getChainsByNetworkType(networkType: 'mainnet' | 'testnet'): Promise<Chain[]> {
    const cacheKey = networkType === 'mainnet' 
      ? ChainService.CACHE_KEYS.MAINNET_CHAINS 
      : ChainService.CACHE_KEYS.TESTNET_CHAINS;
    
    // Try cache first
    const cached = await this.cacheService.get<Chain[]>(cacheKey);
    if (cached) {
      logger.debug(`${networkType} chains retrieved from cache`, { count: cached.length });
      return cached;
    }

    // Get from database
    const chains = await this.chainModel.getChainsByNetworkType(networkType);

    // Cache the result
    await this.cacheService.set(cacheKey, chains, ChainService.CACHE_TTL.CHAINS_LIST);

    logger.debug(`${networkType} chains retrieved from database and cached`, { count: chains.length });
    return chains;
  }

  // Get chain by chain ID
  async getChainByChainId(chainId: number): Promise<Chain | null> {
    const cacheKey = ChainService.CACHE_KEYS.CHAIN_BY_ID(chainId);
    
    // Try cache first
    const cached = await this.cacheService.get<Chain>(cacheKey);
    if (cached) {
      logger.debug('Chain retrieved from cache', { chainId });
      return cached;
    }

    // Get from database
    const chain = await this.chainModel.getChainByChainId(chainId);
    
    if (chain) {
      // Cache the result
      await this.cacheService.set(cacheKey, chain, ChainService.CACHE_TTL.SINGLE_CHAIN);
      logger.debug('Chain retrieved from database and cached', { chainId });
    }

    return chain;
  }

  // Get chain by UUID
  async getChainById(id: string): Promise<Chain | null> {
    const cacheKey = ChainService.CACHE_KEYS.CHAIN_BY_UUID(id);
    
    // Try cache first
    const cached = await this.cacheService.get<Chain>(cacheKey);
    if (cached) {
      logger.debug('Chain retrieved from cache', { id });
      return cached;
    }

    // Get from database
    const chain = await this.chainModel.getChainById(id);
    
    if (chain) {
      // Cache the result
      await this.cacheService.set(cacheKey, chain, ChainService.CACHE_TTL.SINGLE_CHAIN);
      logger.debug('Chain retrieved from database and cached', { id });
    }

    return chain;
  }

  // Update chain (admin only)
  async updateChain(id: string, updates: UpdateChainRequest): Promise<Chain | null> {
    try {
      // Check if chain exists
      const existingChain = await this.chainModel.getChainById(id);
      if (!existingChain) {
        throw new Error(`Chain with ID ${id} not found`);
      }

      // If updating chain_id, check for conflicts
      if (updates.chainId && updates.chainId !== existingChain.chainId) {
        const exists = await this.chainModel.chainIdExists(updates.chainId, id);
        if (exists) {
          throw new Error(`Chain with ID ${updates.chainId} already exists`);
        }
      }

      // Update in database
      const updatedChain = await this.chainModel.updateChain(id, updates);
      
      if (updatedChain) {
        // Auto refresh cache after update
        await this.clearChainCaches(existingChain);
        await this.autoRefreshCacheAfterModification();

        logger.info('Chain updated successfully with cache auto-refreshed', { 
          id, 
          chainId: updatedChain.chainId,
          name: updatedChain.name 
        });
      }

      return updatedChain;
    } catch (error) {
      logger.error('Error updating chain', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        id
      });
      throw error;
    }
  }

  // Delete chain (admin only)
  async deleteChain(id: string): Promise<boolean> {
    try {
      // Get chain details before deletion for cache clearing
      const chain = await this.chainModel.getChainById(id);
      if (!chain) {
        throw new Error(`Chain with ID ${id} not found`);
      }

      // Delete from database
      const deleted = await this.chainModel.deleteChain(id);
      
      if (deleted) {
        // Auto refresh cache after deletion
        await this.clearChainCaches(chain);
        await this.autoRefreshCacheAfterModification();

        logger.info('Chain deleted successfully with cache auto-refreshed', { 
          id, 
          chainId: chain.chainId,
          name: chain.name 
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting chain', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        id
      });
      throw error;
    }
  }

  // Get chain statistics
  async getChainStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    mainnet: number;
    testnet: number;
  }> {
    const cacheKey = 'chains:stats';
    
    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const allChains = await this.getAllChains();
    
    const stats = {
      total: allChains.length,
      active: allChains.filter(c => c.status === 'active').length,
      inactive: allChains.filter(c => c.status !== 'active').length,
      mainnet: allChains.filter(c => c.networkType === 'mainnet').length,
      testnet: allChains.filter(c => c.networkType === 'testnet').length,
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, stats, 300);
    
    return stats;
  }

  // Clear individual chain caches
  private async clearChainCaches(chain: Chain): Promise<void> {
    const keys = [
      ChainService.CACHE_KEYS.CHAIN_BY_ID(chain.chainId),
      ChainService.CACHE_KEYS.CHAIN_BY_UUID(chain.id),
    ];

    for (const key of keys) {
      await this.cacheService.del(key);
    }
  }

  // Clear all chains list caches
  private async clearChainsCache(): Promise<void> {
    const keys = [
      ChainService.CACHE_KEYS.ALL_CHAINS,
      ChainService.CACHE_KEYS.ACTIVE_CHAINS,
      ChainService.CACHE_KEYS.MAINNET_CHAINS,
      ChainService.CACHE_KEYS.TESTNET_CHAINS,
      'chains:stats'
    ];

    for (const key of keys) {
      await this.cacheService.del(key);
    }
  }

  // Manual cache refresh (admin only)
  async refreshCache(): Promise<void> {
    try {
      // Clear all caches
      await this.clearChainsCache();
      
      // Pre-warm important caches
      await this.getActiveChains();
      await this.getChainsByNetworkType('mainnet');
      await this.getChainsByNetworkType('testnet');
      
      logger.info('Chain cache refreshed successfully');
    } catch (error) {
      logger.error('Error refreshing chain cache', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // Auto refresh cache after admin modifications (Create/Update/Delete)
  private async autoRefreshCacheAfterModification(): Promise<void> {
    try {
      // Clear all chains list caches
      await this.clearChainsCache();
      
      // Pre-warm critical caches immediately for better performance
      await Promise.all([
        this.getActiveChains(),
        this.getChainsByNetworkType('mainnet'),
        this.getChainsByNetworkType('testnet'),
        this.getChainStats()
      ]);
      
      logger.debug('Cache auto-refreshed after admin modification');
    } catch (error) {
      logger.error('Error auto-refreshing cache after modification', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Don't throw error here to avoid breaking the main operation
    }
  }
} 