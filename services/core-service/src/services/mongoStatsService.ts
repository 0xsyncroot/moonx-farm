import { MongoManager, createMongoConfig, Schema } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { 
  ChainStatsDocument, 
  BridgeStatsDocument, 
  ChainAlertDocument,
  BridgeAlertDocument,
  ChainPerformanceStats,
  BridgeLatencyStats,
  ChainAlert,
  BridgeAlert,
  StatsFilters,
  StatsAggregation
} from '../types/stats';

const logger = createLoggerForAnyService('mongo-stats-service');

export class MongoStatsService {
  private mongoManager: MongoManager;
  private ChainStatsModel: any;
  private BridgeStatsModel: any;
  private ChainAlertModel: any;
  private BridgeAlertModel: any;
  private isConnected: boolean = false;

  constructor() {
    // Create MongoDB configuration for stats database
    const config = createMongoConfig();
    
    // Override database name for stats (separate from main database)
    const statsConfig = {
      ...config,
      database: process.env.MONGODB_STATS_DATABASE || 'moonx-farm-stats',
      uri: process.env.MONGODB_STATS_URI || config.uri
    };
    
    this.mongoManager = new MongoManager(statsConfig);
    
    logger.info('MongoDB Stats Service initialized', {
      database: statsConfig.database,
      uri: statsConfig.uri?.replace(/\/\/.*@/, '//***:***@') // Hide credentials in logs
    });
    
    // Note: Models will be registered after connection is established
  }

  /**
   * Define MongoDB schemas for stats collections
   */
  private defineSchemas(): void {
    // Chain stats schema
    const chainStatsSchema = new Schema({
      chainId: { type: Number, required: true },
      chainName: { type: String, required: true },
      chainSlug: { type: String, required: true },
      logoUrl: { type: String, required: true },
      blockNumber: { type: Number, required: true },
      blockTime: { type: Number, required: true },
      avgBlockTime: { type: Number, required: true },
      gasPrice: { type: Number, required: true },
      gasUsed: { type: Number, required: true },
      transactionCount: { type: Number, required: true },
      pendingTransactionCount: { type: Number, required: true },
      timestamp: { type: Date, required: true },
      rpcLatency: { type: Number, required: true },
      rpcErrors: { type: Number, required: true },
      rpcSuccessRate: { type: Number, required: true },
      nodeStatus: { type: String, enum: ['healthy', 'degraded', 'unhealthy'], required: true },
      alerts: [{ 
        type: Schema.Types.Mixed,
        default: []
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Bridge stats schema
    const bridgeStatsSchema = new Schema({
      bridgeId: { type: String, required: true },
      bridgeName: { type: String, required: true },
      fromChainId: { type: Number, required: true },
      fromChainName: { type: String, required: true },
      toChainId: { type: Number, required: true },
      toChainName: { type: String, required: true },
      avgLatency: { type: Number, required: true },
      minLatency: { type: Number, required: true },
      maxLatency: { type: Number, required: true },
      successRate: { type: Number, required: true },
      failureRate: { type: Number, required: true },
      totalTransactions: { type: Number, required: true },
      timestamp: { type: Date, required: true },
      status: { type: String, enum: ['optimal', 'slow', 'down'], required: true },
      alerts: [{ 
        type: Schema.Types.Mixed,
        default: []
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Chain alert schema
    const chainAlertSchema = new Schema({
      chainId: { type: Number, required: true },
      type: { type: String, enum: ['block_time', 'gas_price', 'rpc_latency', 'transaction_pool', 'node_error'], required: true },
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
      message: { type: String, required: true },
      threshold: { type: Number, required: true },
      currentValue: { type: Number, required: true },
      timestamp: { type: Date, required: true },
      resolved: { type: Boolean, default: false },
      resolvedAt: { type: Date },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Bridge alert schema
    const bridgeAlertSchema = new Schema({
      bridgeId: { type: String, required: true },
      type: { type: String, enum: ['high_latency', 'low_success_rate', 'bridge_down', 'timeout'], required: true },
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
      message: { type: String, required: true },
      threshold: { type: Number, required: true },
      currentValue: { type: Number, required: true },
      timestamp: { type: Date, required: true },
      resolved: { type: Boolean, default: false },
      resolvedAt: { type: Date },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Register models
    this.ChainStatsModel = this.mongoManager.registerModel('ChainStats', chainStatsSchema);
    this.BridgeStatsModel = this.mongoManager.registerModel('BridgeStats', bridgeStatsSchema);
    this.ChainAlertModel = this.mongoManager.registerModel('ChainAlert', chainAlertSchema);
    this.BridgeAlertModel = this.mongoManager.registerModel('BridgeAlert', bridgeAlertSchema);

    logger.info('MongoDB Stats schemas defined and models registered');
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    try {
      await this.mongoManager.connect();
      
      // Register models after connection is established
      this.defineSchemas();
      
      this.isConnected = true;
      
      logger.info('MongoDB Stats Service connected successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to MongoDB Stats Service', { error });
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    try {
      await this.mongoManager.cleanup();
      this.isConnected = false;
      logger.info('MongoDB Stats Service disconnected');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB Stats Service', { error });
    }
  }

  /**
   * Check if connected
   */
  isDbConnected(): boolean {
    return this.isConnected && this.mongoManager.isHealthy();
  }

  /**
   * Get chain performance stats
   */
  async getChainStats(filters: StatsFilters = {}): Promise<ChainPerformanceStats[]> {
    try {
      const query: any = {};
      
      if (filters.chainIds && filters.chainIds.length > 0) {
        query.chainId = { $in: filters.chainIds };
      }
      
      if (filters.startTime || filters.endTime) {
        query.timestamp = {};
        if (filters.startTime) query.timestamp.$gte = filters.startTime;
        if (filters.endTime) query.timestamp.$lte = filters.endTime;
      }
      
      if (filters.chainStatus) {
        query.nodeStatus = filters.chainStatus;
      }

      const options: any = {
        sort: { timestamp: -1 },
        limit: 100,
        lean: true
      };

      const results = await this.mongoManager.findMany(this.ChainStatsModel, query, options);
      
      logger.info('Retrieved chain stats', { 
        count: results.length,
        filters: Object.keys(filters)
      });
      
      return results;
    } catch (error) {
      logger.error('Error getting chain stats', { error, filters });
      throw error;
    }
  }

  /**
   * Get bridge latency stats
   */
  async getBridgeStats(filters: StatsFilters = {}): Promise<BridgeLatencyStats[]> {
    try {
      const query: any = {};
      
      if (filters.bridgeIds && filters.bridgeIds.length > 0) {
        query.bridgeId = { $in: filters.bridgeIds };
      }
      
      if (filters.chainIds && filters.chainIds.length > 0) {
        query.$or = [
          { fromChainId: { $in: filters.chainIds } },
          { toChainId: { $in: filters.chainIds } }
        ];
      }
      
      if (filters.startTime || filters.endTime) {
        query.timestamp = {};
        if (filters.startTime) query.timestamp.$gte = filters.startTime;
        if (filters.endTime) query.timestamp.$lte = filters.endTime;
      }
      
      if (filters.bridgeStatus) {
        query.status = filters.bridgeStatus;
      }

      const options: any = {
        sort: { timestamp: -1 },
        limit: 100,
        lean: true
      };

      const results = await this.mongoManager.findMany(this.BridgeStatsModel, query, options);
      
      logger.info('Retrieved bridge stats', { 
        count: results.length,
        filters: Object.keys(filters)
      });
      
      return results;
    } catch (error) {
      logger.error('Error getting bridge stats', { error, filters });
      throw error;
    }
  }

  /**
   * Get chain alerts
   */
  async getChainAlerts(filters: StatsFilters = {}): Promise<ChainAlert[]> {
    try {
      const query: any = {};
      
      if (filters.chainIds && filters.chainIds.length > 0) {
        query.chainId = { $in: filters.chainIds };
      }
      
      if (filters.alertSeverity) {
        query.severity = filters.alertSeverity;
      }
      
      if (filters.startTime || filters.endTime) {
        query.timestamp = {};
        if (filters.startTime) query.timestamp.$gte = filters.startTime;
        if (filters.endTime) query.timestamp.$lte = filters.endTime;
      }

      const options: any = {
        sort: { timestamp: -1 },
        limit: 50,
        lean: true
      };

      const results = await this.mongoManager.findMany(this.ChainAlertModel, query, options);
      
      logger.info('Retrieved chain alerts', { 
        count: results.length,
        filters: Object.keys(filters)
      });
      
      return results;
    } catch (error) {
      logger.error('Error getting chain alerts', { error, filters });
      throw error;
    }
  }

  /**
   * Get bridge alerts
   */
  async getBridgeAlerts(filters: StatsFilters = {}): Promise<BridgeAlert[]> {
    try {
      const query: any = {};
      
      if (filters.bridgeIds && filters.bridgeIds.length > 0) {
        query.bridgeId = { $in: filters.bridgeIds };
      }
      
      if (filters.alertSeverity) {
        query.severity = filters.alertSeverity;
      }
      
      if (filters.startTime || filters.endTime) {
        query.timestamp = {};
        if (filters.startTime) query.timestamp.$gte = filters.startTime;
        if (filters.endTime) query.timestamp.$lte = filters.endTime;
      }

      const options: any = {
        sort: { timestamp: -1 },
        limit: 50,
        lean: true
      };

      const results = await this.mongoManager.findMany(this.BridgeAlertModel, query, options);
      
      logger.info('Retrieved bridge alerts', { 
        count: results.length,
        filters: Object.keys(filters)
      });
      
      return results;
    } catch (error) {
      logger.error('Error getting bridge alerts', { error, filters });
      throw error;
    }
  }

  /**
   * Get latest stats overview
   */
  async getStatsOverview(): Promise<{
    chainStats: ChainPerformanceStats[];
    bridgeStats: BridgeLatencyStats[];
    totalAlerts: number;
    criticalAlerts: number;
    systemStatus: 'healthy' | 'degraded' | 'critical';
  }> {
    try {
      const [chainStats, bridgeStats, totalAlerts, criticalAlerts] = await Promise.all([
        this.getLatestChainStats(),
        this.getLatestBridgeStats(),
        this.getAlertsCount(),
        this.getCriticalAlertsCount()
      ]);

      // Determine system status
      let systemStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (criticalAlerts > 0) {
        systemStatus = 'critical';
      } else if (totalAlerts > 5) {
        systemStatus = 'degraded';
      }

      return {
        chainStats,
        bridgeStats,
        totalAlerts,
        criticalAlerts,
        systemStatus
      };
    } catch (error) {
      logger.error('Error getting stats overview', { error });
      throw error;
    }
  }

  /**
   * Get aggregated stats for time periods
   */
  async getAggregatedStats(timeframe: 'hour' | 'day' | 'week' | 'month'): Promise<StatsAggregation> {
    try {
      const pipeline = this.buildAggregationPipeline(timeframe);
      const results = await this.mongoManager.aggregate(this.ChainStatsModel, pipeline);
      
      const metrics = results[0] || {
        avgBlockTime: 0,
        avgRpcLatency: 0,
        avgBridgeLatency: 0,
        alertCount: 0,
        successRate: 0
      };

      return {
        timeframe,
        metrics,
        breakdown: {} // TODO: Implement breakdown logic
      };
    } catch (error) {
      logger.error('Error getting aggregated stats', { error, timeframe });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    database: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.isDbConnected()) {
        return {
          connected: false,
          responseTime: Date.now() - startTime,
          database: 'moonx-farm-stats',
          error: 'Not connected'
        };
      }
      
      // Test query
      await this.mongoManager.findOne(this.ChainStatsModel, {});
      
      return {
        connected: true,
        responseTime: Date.now() - startTime,
        database: 'moonx-farm-stats'
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        database: 'moonx-farm-stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods
  private async getLatestChainStats(): Promise<ChainPerformanceStats[]> {
    return await this.mongoManager.findMany(this.ChainStatsModel, {}, {
      sort: { timestamp: -1 },
      limit: 10,
      lean: true
    });
  }

  private async getLatestBridgeStats(): Promise<BridgeLatencyStats[]> {
    return await this.mongoManager.findMany(this.BridgeStatsModel, {}, {
      sort: { timestamp: -1 },
      limit: 10,
      lean: true
    });
  }

  private async getAlertsCount(): Promise<number> {
    const chainAlerts = await this.mongoManager.count(this.ChainAlertModel, { resolved: false });
    const bridgeAlerts = await this.mongoManager.count(this.BridgeAlertModel, { resolved: false });
    return chainAlerts + bridgeAlerts;
  }

  private async getCriticalAlertsCount(): Promise<number> {
    const chainCriticalAlerts = await this.mongoManager.count(this.ChainAlertModel, { 
      resolved: false, 
      severity: 'critical' 
    });
    const bridgeCriticalAlerts = await this.mongoManager.count(this.BridgeAlertModel, { 
      resolved: false, 
      severity: 'critical' 
    });
    return chainCriticalAlerts + bridgeCriticalAlerts;
  }

  private buildAggregationPipeline(timeframe: string): any[] {
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return [
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: null,
          avgBlockTime: { $avg: '$avgBlockTime' },
          avgRpcLatency: { $avg: '$rpcLatency' },
          alertCount: { $sum: { $size: '$alerts' } },
          successRate: { $avg: '$rpcSuccessRate' }
        }
      }
    ];
  }
} 