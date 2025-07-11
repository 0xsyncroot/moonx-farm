import { MongoManager, createMongoConfig } from '@moonx-farm/infrastructure';
import { v4 as uuidv4 } from 'uuid';
import { 
  StatsWorkerConfig,
  StatsCollectionResult,
  StatsOverview,
  ChainPerformanceStats,
  BridgeLatencyStats,
  HealthStatus,
  StatsMetrics
} from '../types/index';
import { createStatsModels, statsQueries } from '../models/index';
import { ChainStatsService } from './chainStatsService';
import { BridgeStatsService } from './bridgeStatsService';
import { StatsEventPublisher } from './eventPublisher';
import { logger } from '../utils/logger';

export class StatsAggregator {
  private mongoManager: MongoManager;
  private chainStatsService: ChainStatsService;
  private bridgeStatsService: BridgeStatsService;
  private eventPublisher: StatsEventPublisher;
  private models: any;
  private config: StatsWorkerConfig;
  private isInitialized: boolean = false;
  private startTime: number = Date.now();
  private metrics: StatsMetrics = {
    collectionsTotal: 0,
    collectionsSuccess: 0,
    collectionsError: 0,
    lastCollectionDuration: 0,
    averageCollectionDuration: 0,
    eventsPublished: 0,
    eventsPublishErrors: 0,
    chainStatsCount: 0,
    bridgeStatsCount: 0,
    lastHealthCheck: new Date(),
    uptime: 0
  };
  private previousStats: {
    chainPerformance: Record<number, ChainPerformanceStats>;
    bridgeLatency: Record<string, BridgeLatencyStats>;
    overview?: StatsOverview;
  } = {
    chainPerformance: {},
    bridgeLatency: {}
  };

  constructor(config: StatsWorkerConfig) {
    this.config = config;
    
    // Initialize MongoDB manager
    this.mongoManager = new MongoManager(config.mongodb);
    
    // Initialize stats services
    this.chainStatsService = new ChainStatsService(
      config.chains,
      config.apis.defiLlama,
      process.env.ALCHEMY_API_KEY || ''
    );
    
    this.bridgeStatsService = new BridgeStatsService(
      config.bridges,
      config.apis.lifi,
      config.apis.relay,
      config.apis.lifiApiKey
    );
    
    // Initialize event publisher
    this.eventPublisher = new StatsEventPublisher(config.kafka);
  }

  /**
   * Initialize the aggregator
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing stats aggregator');
      
      // Connect to MongoDB
      await this.mongoManager.connect();
      this.models = createStatsModels(this.mongoManager);
      
      // Connect to Kafka
      await this.eventPublisher.connect();
      
      // Load previous stats for comparison
      await this.loadPreviousStats();
      
      this.isInitialized = true;
      logger.info('Stats aggregator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize stats aggregator', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Collect all stats (chain performance + bridge latency)
   */
  async collectAllStats(): Promise<StatsCollectionResult> {
    if (!this.isInitialized) {
      throw new Error('Stats aggregator not initialized');
    }

    const collectionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info('Starting full stats collection', { collectionId });

      // Collect stats in parallel
      const [chainStats, bridgeStats] = await Promise.all([
        this.collectChainStats(),
        this.collectBridgeStats()
      ]);

      // Save to MongoDB
      await this.saveStatsToDatabase(chainStats, bridgeStats);

      // Create and publish overview only when job completes successfully
      const overview = await this.createAndPublishOverview(chainStats, bridgeStats);

      // Update previous stats for next comparison
      this.updatePreviousStats(chainStats, bridgeStats, overview);

      const duration = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(true, duration, chainStats.length, bridgeStats.length);

      logger.info('Full stats collection completed successfully', {
        collectionId,
        duration,
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length
      });

      return {
        success: true,
        timestamp: Date.now(),
        duration,
        chainStats,
        bridgeStats,
        errors: []
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update metrics
      this.updateMetrics(false, duration, 0, 0);

      logger.error('Full stats collection failed', {
        collectionId,
        duration,
        error: errorMessage
      });

      return {
        success: false,
        timestamp: Date.now(),
        duration,
        chainStats: [],
        bridgeStats: [],
        errors: [errorMessage]
      };
    }
  }

  /**
   * Collect only chain performance stats
   */
  async collectChainStats(): Promise<ChainPerformanceStats[]> {
    try {
      const chainStats = await this.chainStatsService.collectAllChainStats();
      this.metrics.chainStatsCount = chainStats.length;
      return chainStats;
    } catch (error) {
      logger.error('Failed to collect chain stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Collect only bridge latency stats
   */
  async collectBridgeStats(): Promise<BridgeLatencyStats[]> {
    try {
      const bridgeStats = await this.bridgeStatsService.collectAllBridgeStats();
      this.metrics.bridgeStatsCount = bridgeStats.length;
      return bridgeStats;
    } catch (error) {
      logger.error('Failed to collect bridge stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Collect chain stats only and publish when job completes
   */
  async collectAndPublishChainStats(): Promise<ChainPerformanceStats[]> {
    const collectionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info('Starting chain stats collection and publish', { collectionId });

      const chainStats = await this.collectChainStats();
      
      // Save to MongoDB
      await this.saveChainStatsToDatabase(chainStats);

      // Publish chain stats summary (not individual records)
      await this.publishChainStatsUpdate(chainStats);

      const duration = Date.now() - startTime;
      
      logger.info('Chain stats collection and publish completed', {
        collectionId,
        duration,
        chainStatsCount: chainStats.length
      });

      return chainStats;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Chain stats collection and publish failed', {
        collectionId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Collect bridge stats only and publish when job completes
   */
  async collectAndPublishBridgeStats(): Promise<BridgeLatencyStats[]> {
    const collectionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info('Starting bridge stats collection and publish', { collectionId });

      const bridgeStats = await this.collectBridgeStats();
      
      // Save to MongoDB
      await this.saveBridgeStatsToDatabase(bridgeStats);

      // Publish bridge stats summary (not individual records)
      await this.publishBridgeStatsUpdate(bridgeStats);

      const duration = Date.now() - startTime;
      
      logger.info('Bridge stats collection and publish completed', {
        collectionId,
        duration,
        bridgeStatsCount: bridgeStats.length
      });

      return bridgeStats;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Bridge stats collection and publish failed', {
        collectionId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Save stats to MongoDB
   */
  private async saveStatsToDatabase(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[]
  ): Promise<void> {
    try {
      // Save chain stats
      const chainPromises = chainStats.map(stats => 
        statsQueries.upsertChainStats(
          this.mongoManager, 
          this.models.ChainStats, 
          stats.chainId, 
          stats
        )
      );

      // Save bridge stats
      const bridgePromises = bridgeStats.map(stats => 
        statsQueries.upsertBridgeStats(
          this.mongoManager, 
          this.models.BridgeStats, 
          stats.provider, 
          stats
        )
      );

      await Promise.all([...chainPromises, ...bridgePromises]);
      
      logger.debug('Stats saved to database', {
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length
      });
    } catch (error) {
      logger.error('Failed to save stats to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Save chain stats to MongoDB
   */
  private async saveChainStatsToDatabase(chainStats: ChainPerformanceStats[]): Promise<void> {
    try {
      const chainPromises = chainStats.map(stats => 
        statsQueries.upsertChainStats(
          this.mongoManager, 
          this.models.ChainStats, 
          stats.chainId, 
          stats
        )
      );

      await Promise.all(chainPromises);
      
      logger.debug('Chain stats saved to database', {
        chainStatsCount: chainStats.length
      });
    } catch (error) {
      logger.error('Failed to save chain stats to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Save bridge stats to MongoDB
   */
  private async saveBridgeStatsToDatabase(bridgeStats: BridgeLatencyStats[]): Promise<void> {
    try {
      const bridgePromises = bridgeStats.map(stats => 
        statsQueries.upsertBridgeStats(
          this.mongoManager, 
          this.models.BridgeStats, 
          stats.provider, 
          stats
        )
      );

      await Promise.all(bridgePromises);
      
      logger.debug('Bridge stats saved to database', {
        bridgeStatsCount: bridgeStats.length
      });
    } catch (error) {
      logger.error('Failed to save bridge stats to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }



  /**
   * Publish chain stats update
   */
  private async publishChainStatsUpdate(chainStats: ChainPerformanceStats[]): Promise<void> {
    try {
      // Publish chain stats
      await this.eventPublisher.publishChainStatsUpdate(chainStats);
      
      this.metrics.eventsPublished += chainStats.length;
      
      logger.debug('Chain stats published', {
        totalChains: chainStats.length
      });
    } catch (error) {
      this.metrics.eventsPublishErrors++;
      logger.error('Failed to publish chain stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Publish bridge stats update
   */
  private async publishBridgeStatsUpdate(bridgeStats: BridgeLatencyStats[]): Promise<void> {
    try {
      // Publish bridge stats
      await this.eventPublisher.publishBridgeStatsUpdate(bridgeStats);
      
      this.metrics.eventsPublished += bridgeStats.length;
      
      logger.debug('Bridge stats published', {
        totalBridges: bridgeStats.length
      });
    } catch (error) {
      this.metrics.eventsPublishErrors++;
      logger.error('Failed to publish bridge stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create and publish overview
   */
  private async createAndPublishOverview(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[]
  ): Promise<StatsOverview> {
    const overview: StatsOverview = {
      chainPerformance: chainStats,
      bridgeLatency: bridgeStats,
      lastUpdated: new Date(),
      healthStatus: this.calculateOverallHealth(chainStats, bridgeStats)
    };

    // Save overview to database
    // First clear any existing latest flag
    await this.mongoManager.updateMany(
      this.models.StatsOverview,
      { isLatest: true },
      { $set: { isLatest: false } }
    );
    
    // Then save new latest overview
    await this.mongoManager.create(
      this.models.StatsOverview,
      { ...overview, isLatest: true } as any
    );

    // Note: Overview is saved to database but not published as separate event
    // Individual chain_stats and bridge_stats events are published instead

          logger.debug('Stats overview saved to database', {
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length,
        healthStatus: overview.healthStatus
      });

    return overview;
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[]
  ): HealthStatus {
    const allStats = [...chainStats, ...bridgeStats];
    
    if (allStats.length === 0) return 'unhealthy';
    
    const healthyCount = allStats.filter(stat => stat.status === 'healthy').length;
    const healthyPercentage = (healthyCount / allStats.length) * 100;
    
    if (healthyPercentage >= 80) return 'healthy';
    if (healthyPercentage >= 50) return 'degraded';
    return 'unhealthy';
  }

  /**
   * Update previous stats for comparison
   */
  private updatePreviousStats(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[],
    overview: StatsOverview
  ): void {
    // Update chain stats
    chainStats.forEach((stats: ChainPerformanceStats) => {
      this.previousStats.chainPerformance[stats.chainId] = stats;
    });

    // Update bridge stats
    bridgeStats.forEach((stats: BridgeLatencyStats) => {
      this.previousStats.bridgeLatency[stats.provider] = stats;
    });

    // Update overview
    this.previousStats.overview = overview;
  }

  /**
   * Load previous stats from database
   */
  private async loadPreviousStats(): Promise<void> {
    try {
      // Load latest chain stats
      const chainStats = await statsQueries.getLatestChainStats(
        this.mongoManager,
        this.models.ChainStats
      );
      
      chainStats.forEach((stats: ChainPerformanceStats) => {
        this.previousStats.chainPerformance[stats.chainId] = stats;
      });

      // Load latest bridge stats
      const bridgeStats = await statsQueries.getLatestBridgeStats(
        this.mongoManager,
        this.models.BridgeStats
      );
      
      bridgeStats.forEach((stats: BridgeLatencyStats) => {
        this.previousStats.bridgeLatency[stats.provider] = stats;
      });

      // Load latest overview
      const overviewDoc = await this.mongoManager.findOne(
        this.models.StatsOverview,
        { isLatest: true }
      );
      
      if (overviewDoc) {
        // Convert MongoDB document to StatsOverview
        const docData = overviewDoc as any;
        const overview: StatsOverview = {
          chainPerformance: docData.chainPerformance || [],
          bridgeLatency: docData.bridgeLatency || [],
          lastUpdated: docData.lastUpdated || new Date(),
          healthStatus: docData.healthStatus || 'healthy'
        };
        this.previousStats.overview = overview;
      }

      logger.debug('Previous stats loaded', {
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length,
        hasOverview: !!overviewDoc
      });
    } catch (error) {
      logger.warn('Failed to load previous stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    success: boolean,
    duration: number,
    chainStatsCount: number,
    bridgeStatsCount: number
  ): void {
    this.metrics.collectionsTotal++;
    
    if (success) {
      this.metrics.collectionsSuccess++;
    } else {
      this.metrics.collectionsError++;
    }
    
    this.metrics.lastCollectionDuration = duration;
    this.metrics.averageCollectionDuration = 
      (this.metrics.averageCollectionDuration + duration) / 2;
    
    this.metrics.chainStatsCount = chainStatsCount;
    this.metrics.bridgeStatsCount = bridgeStatsCount;
    this.metrics.lastHealthCheck = new Date();
    this.metrics.uptime = Date.now() - this.startTime;
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<void> {
    try {
      const services = {
        mongodb: this.mongoManager.isHealthy(),
        kafka: await this.eventPublisher.healthCheck(),
        chains: {} as Record<string, boolean>,
        bridges: {} as Record<string, boolean>
      };

      // Check each chain
      for (const chain of this.config.chains) {
        try {
          await this.chainStatsService.getChainHealth(chain.chainId);
          services.chains[chain.name] = true;
        } catch {
          services.chains[chain.name] = false;
        }
      }

      // Check each bridge
      for (const bridge of this.config.bridges) {
        try {
          await this.bridgeStatsService.getBridgeHealth(bridge.provider);
          services.bridges[bridge.name] = true;
        } catch {
          services.bridges[bridge.name] = false;
        }
      }

      // Determine overall health
      const allHealthy = Object.values(services).every(service => 
        typeof service === 'boolean' ? service : Object.values(service).every(Boolean)
      );
      
      const status: HealthStatus = allHealthy ? 'healthy' : 'degraded';

      logger.debug('Health check completed', { status, services });
    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): StatsMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get configuration
   */
  getConfig(): StatsWorkerConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StatsWorkerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update services with new config
    if (config.chains) {
      this.chainStatsService.updateChainConfig(config.chains);
    }
    
    if (config.bridges) {
      this.bridgeStatsService.updateBridgeConfig(config.bridges);
    }

    logger.info('Configuration updated', {
      chainsCount: this.config.chains.length,
      bridgesCount: this.config.bridges.length
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.eventPublisher.disconnect();
      await this.mongoManager.cleanup();
      
      logger.info('Stats aggregator cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup stats aggregator', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 