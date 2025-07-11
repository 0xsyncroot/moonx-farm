import { MongoStatsService } from './mongoStatsService';
import { CacheService } from './cacheService';
import { createLoggerForAnyService } from '@moonx-farm/common';
import {
  ChainPerformanceStats,
  BridgeLatencyStats,
  ChainAlert,
  BridgeAlert,
  StatsOverview,
  StatsFilters,
  StatsAggregation,
  GetStatsRequest,
  GetStatsResponse,
  GetAlertsRequest,
  GetAlertsResponse,
  GetAggregatedStatsRequest,
  GetAggregatedStatsResponse,
  GetBridgeStatsResponse,
  GetBridgeStatsRequest
} from '../types/stats';

const logger = createLoggerForAnyService('stats-service');

export class StatsService {
  private mongoStatsService: MongoStatsService;
  private cacheService: CacheService;
  private isConnected: boolean = false;

  constructor(cacheService: CacheService) {
    this.mongoStatsService = new MongoStatsService();
    this.cacheService = cacheService;
    
    logger.info('Stats Service initialized');
  }

  /**
   * Initialize connections
   */
  async init(): Promise<void> {
    try {
      await this.mongoStatsService.connect();
      this.isConnected = true;
      
      logger.info('Stats Service connected to MongoDB');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to initialize Stats Service', { error });
      throw error;
    }
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    try {
      await this.mongoStatsService.disconnect();
      this.isConnected = false;
      
      logger.info('Stats Service disconnected');
    } catch (error) {
      logger.error('Error during Stats Service cleanup', { error });
    }
  }

  /**
   * Check if service is connected
   */
  isServiceConnected(): boolean {
    return this.isConnected && this.mongoStatsService.isDbConnected();
  }

  /**
   * Get chain performance stats with caching
   */
  async getChainStats(request: GetStatsRequest): Promise<GetStatsResponse> {
    try {
      const cacheKey = this.buildCacheKey('chain_stats', request);
      
      // Try cache first (2 minute TTL for stats)
      const cached = await this.cacheService.get<GetStatsResponse>(cacheKey);
      if (cached) {
        logger.info('Chain stats cache hit', { request });
        return cached;
      }

      // Convert request to filters
      const filters = this.requestToFilters(request);
      
      // Get data from MongoDB
      const chainStats = await this.mongoStatsService.getChainStats(filters);
      
      const response: GetStatsResponse = {
        chainStats,
        totalCount: chainStats.length,
        hasMore: chainStats.length >= (request.limit || 100),
        timestamp: new Date()
      };

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, response, 120);
      
      logger.info('Retrieved chain stats', { 
        count: chainStats.length,
        request 
      });
      
      return response;
    } catch (error) {
      logger.error('Error getting chain stats', { error, request });
      throw error;
    }
  }

  /**
   * Get bridge latency stats with caching
   */
  async getBridgeStats(request: GetBridgeStatsRequest): Promise<GetBridgeStatsResponse> {
    try {
      const cacheKey = this.buildCacheKey('bridge_stats', request);
      
      // Try cache first
      const cached = await this.cacheService.get<GetBridgeStatsResponse>(cacheKey);
      if (cached) {
        logger.info('Bridge stats cache hit', { request });
        return cached;
      }

      // Convert request to filters
      const filters = this.requestToFilters(request);
      
      // Get data from MongoDB
      const bridgeStats = await this.mongoStatsService.getBridgeStats(filters);
      
      const response: GetBridgeStatsResponse = {
        bridgeStats,
        totalCount: bridgeStats.length,
        hasMore: bridgeStats.length >= (request.limit || 100),
        timestamp: new Date()
      };

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, response, 120);
      
      logger.info('Retrieved bridge stats', { 
        count: bridgeStats.length,
        request 
      });
      
      return response;
    } catch (error) {
      logger.error('Error getting bridge stats', { error, request });
      throw error;
    }
  }

  /**
   * Get all stats (chain + bridge) with caching
   */
  async getAllStats(request: GetStatsRequest): Promise<GetStatsResponse> {
    try {
      const cacheKey = this.buildCacheKey('all_stats', request);
      
      // Try cache first
      const cached = await this.cacheService.get<GetStatsResponse>(cacheKey);
      if (cached) {
        logger.info('All stats cache hit', { request });
        return cached;
      }

      // Convert request to filters
      const filters = this.requestToFilters(request);
      
      // Get data from MongoDB in parallel
      const [chainStats, bridgeStats] = await Promise.all([
        this.mongoStatsService.getChainStats(filters),
        this.mongoStatsService.getBridgeStats(filters)
      ]);
      
      const response: GetStatsResponse = {
        chainStats,
        totalCount: chainStats.length + bridgeStats.length,
        hasMore: (chainStats.length + bridgeStats.length) >= (request.limit || 100),
        timestamp: new Date()
      };

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, response, 120);
      
      logger.info('Retrieved all stats', { 
        chainCount: chainStats.length,
        bridgeCount: bridgeStats.length,
        request 
      });
      
      return response;
    } catch (error) {
      logger.error('Error getting all stats', { error, request });
      throw error;
    }
  }

  /**
   * Get alerts (chain + bridge) with caching
   */
  async getAlerts(request: GetAlertsRequest): Promise<GetAlertsResponse> {
    try {
      const cacheKey = this.buildCacheKey('alerts', request);
      
      // Try cache first (1 minute TTL for alerts - more fresh)
      const cached = await this.cacheService.get<GetAlertsResponse>(cacheKey);
      if (cached) {
        logger.info('Alerts cache hit', { request });
        return cached;
      }

      // Convert request to filters
      const filters = this.alertRequestToFilters(request);
      
      // Get data from MongoDB in parallel
      const [chainAlerts, bridgeAlerts] = await Promise.all([
        this.mongoStatsService.getChainAlerts(filters),
        this.mongoStatsService.getBridgeAlerts(filters)
      ]);
      
      const response: GetAlertsResponse = {
        chainAlerts,
        bridgeAlerts,
        totalCount: chainAlerts.length + bridgeAlerts.length,
        hasMore: (chainAlerts.length + bridgeAlerts.length) >= (request.limit || 50),
        timestamp: new Date()
      };

      // Cache for 1 minute (alerts should be fresher)
      await this.cacheService.set(cacheKey, response, 60);
      
      logger.info('Retrieved alerts', { 
        chainAlertsCount: chainAlerts.length,
        bridgeAlertsCount: bridgeAlerts.length,
        request 
      });
      
      return response;
    } catch (error) {
      logger.error('Error getting alerts', { error, request });
      throw error;
    }
  }

  /**
   * Get stats overview with caching
   */
  async getStatsOverview(): Promise<StatsOverview> {
    try {
      const cacheKey = 'stats_overview';
      
      // Try cache first (1 minute TTL)
      const cached = await this.cacheService.get<StatsOverview>(cacheKey);
      if (cached) {
        logger.info('Stats overview cache hit');
        return cached;
      }

      // Get overview from MongoDB
      const overview = await this.mongoStatsService.getStatsOverview();
      
      // Add timestamp and missing properties to response
      const overviewWithTimestamp: StatsOverview = {
        ...overview,
        timestamp: new Date(),
        totalChains: overview.chainStats.length,
        healthyChains: overview.chainStats.filter(c => c.nodeStatus === 'healthy').length,
        totalBridges: overview.bridgeStats.length,
        activeBridges: overview.bridgeStats.filter(b => b.status === 'optimal').length,
        dexStats: [], // TODO: Implement DEX stats
        totalDEXs: 0,
        activeDEXs: 0,
        topTokens: [], // TODO: Implement token stats
        totalTokensTracked: 0,
        totalVolume24h: 0, // TODO: Calculate from actual data
        volumeChange24h: 0,
        totalTVL: 0, // TODO: Calculate from actual data
        tvlChange24h: 0,
        totalTransactions24h: 0, // TODO: Calculate from actual data
        totalActiveAddresses24h: 0,
        totalBridgeTransfers24h: 0,
        chainAlerts: overview.chainStats.reduce((acc, c) => acc + c.alerts.length, 0),
        bridgeAlerts: overview.bridgeStats.reduce((acc, b) => acc + b.alerts.length, 0),
        dexAlerts: 0,
        overallUptime: 95.0 // TODO: Calculate from actual data
      };
      
      // Cache for 1 minute
      await this.cacheService.set(cacheKey, overviewWithTimestamp, 60);
      
      logger.info('Retrieved stats overview', { 
        systemStatus: overview.systemStatus,
        totalAlerts: overview.totalAlerts,
        criticalAlerts: overview.criticalAlerts
      });
      
      return overviewWithTimestamp;
    } catch (error) {
      logger.error('Error getting stats overview', { error });
      throw error;
    }
  }

  /**
   * Get aggregated stats with caching
   */
  async getAggregatedStats(request: GetAggregatedStatsRequest): Promise<GetAggregatedStatsResponse> {
    try {
      const cacheKey = this.buildCacheKey('aggregated_stats', request);
      
      // Try cache first (5 minute TTL for aggregated data)
      const cached = await this.cacheService.get<GetAggregatedStatsResponse>(cacheKey);
      if (cached) {
        logger.info('Aggregated stats cache hit', { request });
        return cached;
      }

      // Get aggregated data from MongoDB
      const aggregation = await this.mongoStatsService.getAggregatedStats(request.timeframe);
      
      const response: GetAggregatedStatsResponse = {
        aggregation,
        data: {}, // TODO: Implement time-series data
        timestamp: new Date()
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, response, 300);
      
      logger.info('Retrieved aggregated stats', { 
        timeframe: request.timeframe,
        metrics: aggregation.metrics
      });
      
      return response;
    } catch (error) {
      logger.error('Error getting aggregated stats', { error, request });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    connected: boolean;
    mongodb: boolean;
    cache: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const [mongoHealth, cacheHealth] = await Promise.allSettled([
        this.mongoStatsService.healthCheck(),
        this.testCacheHealth()
      ]);

      const mongoConnected = mongoHealth.status === 'fulfilled' && mongoHealth.value.connected;
      const cacheConnected = cacheHealth.status === 'fulfilled';

      return {
        connected: this.isServiceConnected(),
        mongodb: mongoConnected,
        cache: cacheConnected,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        connected: false,
        mongodb: false,
        cache: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods
  private requestToFilters(request: GetStatsRequest): StatsFilters {
    const filters: StatsFilters = {};
    
    if (request.chainIds) {
      filters.chainIds = request.chainIds;
    }
    
    if (request.startTime) {
      filters.startTime = new Date(request.startTime);
    }
    
    if (request.endTime) {
      filters.endTime = new Date(request.endTime);
    }
    
    return filters;
  }

  // Private helper methods
  private requestBridgeToFilters(request: GetBridgeStatsRequest): StatsFilters {
    const filters: StatsFilters = {};
    
    if (request.bridgeIds) {
      filters.bridgeIds = request.bridgeIds;
    }
    
    if (request.bridgeProtocols) {
      filters.bridgeProtocols = request.bridgeProtocols;
    }

    if (request.minVolume24h) {
      filters.minVolume24h = request.minVolume24h;
    }
    
    if (request.minTVL) {
      filters.minTVL = request.minTVL;
    }
    
    return filters;
  }

  private alertRequestToFilters(request: GetAlertsRequest): StatsFilters {
    const filters: StatsFilters = {};
    
    if (request.chainIds) {
      filters.chainIds = request.chainIds;
    }
    
    if (request.bridgeIds) {
      filters.bridgeIds = request.bridgeIds;
    }
    
    if (request.severity) {
      filters.alertSeverity = request.severity;
    }
    
    if (request.startTime) {
      filters.startTime = new Date(request.startTime);
    }
    
    if (request.endTime) {
      filters.endTime = new Date(request.endTime);
    }
    
    return filters;
  }

  private buildCacheKey(type: string, request: any): string {
    const sortedKeys = Object.keys(request).sort();
    const keyParts = sortedKeys.map(key => `${key}:${request[key]}`);
    return `stats:${type}:${keyParts.join(':')}`;
  }

  private async testCacheHealth(): Promise<void> {
    try {
      // Test cache by setting and getting a test key
      const testKey = 'health_check_test';
      const testValue = { test: true, timestamp: Date.now() };
      
      await this.cacheService.set(testKey, testValue, 5);
      const retrieved = await this.cacheService.get<{test: boolean, timestamp: number}>(testKey);
      
      if (!retrieved || retrieved.test !== true) {
        throw new Error('Cache health check failed');
      }
      
      // Clean up test key
      await this.cacheService.del(testKey);
    } catch (error) {
      throw new Error(`Cache health check failed: ${error}`);
    }
  }
} 