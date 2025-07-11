import { Schema, Model } from '@moonx-farm/infrastructure';
import { 
  ChainStatsDocument, 
  BridgeStatsDocument, 
  StatsOverviewDocument 
} from '../types/index';

// Chain Performance Stats Schema
export const chainStatsSchema = new Schema({
  chainId: { type: Number, required: true, index: true },
  chainName: { type: String, required: true, index: true },
  chainSlug: { type: String, required: true, index: true },
  logoUrl: { type: String, required: true },
  blockTime: {
    current: { type: Number, required: true },
    change: { type: String, required: true },
    changePercent: { type: Number, required: true },
    timestamp: { type: Number, required: true, index: true }
  },
  volume24h: { type: String, required: true },
  volumeUSD: { type: Number, required: true },
  defiLlamaSlug: { type: String, required: true },
  rpcUrl: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['healthy', 'degraded', 'unhealthy'], 
    required: true,
    index: true 
  },
  updatedAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, index: true }
});

// Bridge Latency Stats Schema
export const bridgeStatsSchema = new Schema({
  provider: { 
    type: String, 
    enum: ['LI.FI', 'Relay.link', '1inch'], 
    required: true,
    index: true 
  },
  latency: { type: Number, required: true, index: true },
  status: { 
    type: String, 
    enum: ['healthy', 'degraded', 'unhealthy'], 
    required: true,
    index: true 
  },
  timestamp: { type: Number, required: true, index: true },
  route: { type: String, index: true },
  fromChain: { type: Number, index: true },
  toChain: { type: Number, index: true },
  error: { type: String },
  updatedAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, index: true }
});

// Stats Overview Schema
export const statsOverviewSchema = new Schema({
  chainPerformance: [chainStatsSchema],
  bridgeLatency: [bridgeStatsSchema],
  lastUpdated: { type: Date, required: true, index: true },
  healthStatus: { 
    type: String, 
    enum: ['healthy', 'degraded', 'unhealthy'], 
    required: true,
    index: true 
  },
  isLatest: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, index: true }
});

// Compound indexes for chain stats
chainStatsSchema.index({ chainId: 1, updatedAt: -1 });
chainStatsSchema.index({ status: 1, updatedAt: -1 });
chainStatsSchema.index({ chainName: 1, status: 1 });

// Compound indexes for bridge stats
bridgeStatsSchema.index({ provider: 1, updatedAt: -1 });
bridgeStatsSchema.index({ status: 1, updatedAt: -1 });
bridgeStatsSchema.index({ provider: 1, latency: 1 });
bridgeStatsSchema.index({ fromChain: 1, toChain: 1 });

// Compound indexes for overview
statsOverviewSchema.index({ healthStatus: 1, lastUpdated: -1 });

// TTL indexes for automatic cleanup (24 hours)
chainStatsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
bridgeStatsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
statsOverviewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set expiration
chainStatsSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

bridgeStatsSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

statsOverviewSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

// Model types
export type ChainStatsModel = Model<ChainStatsDocument>;
export type BridgeStatsModel = Model<BridgeStatsDocument>;
export type StatsOverviewModel = Model<StatsOverviewDocument>;

// Model factory function
export function createStatsModels(mongoManager: any) {
  const ChainStats = mongoManager.registerModel('ChainStats', chainStatsSchema);
  const BridgeStats = mongoManager.registerModel('BridgeStats', bridgeStatsSchema);
  const StatsOverview = mongoManager.registerModel('StatsOverview', statsOverviewSchema);

  return {
    ChainStats,
    BridgeStats,
    StatsOverview
  };
}

// Query helpers that use mongoManager
export const statsQueries = {
  // Get latest chain stats
  getLatestChainStats: async (mongoManager: any, chainModel: any, chainId?: number) => {
    const query = chainId ? { chainId } : {};
    return await mongoManager.findMany(chainModel, query, {
      sort: { updatedAt: -1 },
      limit: chainId ? 1 : 10
    });
  },

  // Get latest bridge stats
  getLatestBridgeStats: async (mongoManager: any, bridgeModel: any, provider?: string) => {
    const query = provider ? { provider } : {};
    return await mongoManager.findMany(bridgeModel, query, {
      sort: { updatedAt: -1 },
      limit: provider ? 1 : 10
    });
  },

  // Get health status summary
  getHealthSummary: async (
    mongoManager: any,
    chainModel: any, 
    bridgeModel: any
  ) => {
    const [chainStats, bridgeStats] = await Promise.all([
      mongoManager.aggregate(chainModel, [
        { $match: { updatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      mongoManager.aggregate(bridgeModel, [
        { $match: { updatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    return {
      chains: chainStats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
      bridges: bridgeStats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>)
    };
  },

  // Get performance trends
  getPerformanceTrends: async (
    mongoManager: any,
    chainModel: any,
    chainId: number,
    hours: number = 24
  ) => {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await mongoManager.aggregate(chainModel, [
      { 
        $match: { 
          chainId, 
          updatedAt: { $gte: startTime } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: '$updatedAt'
            }
          },
          avgBlockTime: { $avg: '$blockTime.current' },
          avgVolumeUSD: { $avg: '$volumeUSD' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  },

  // Get latency trends
  getLatencyTrends: async (
    mongoManager: any,
    bridgeModel: any,
    provider: string,
    hours: number = 24
  ) => {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await mongoManager.aggregate(bridgeModel, [
      { 
        $match: { 
          provider, 
          updatedAt: { $gte: startTime } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: '$updatedAt'
            }
          },
          avgLatency: { $avg: '$latency' },
          minLatency: { $min: '$latency' },
          maxLatency: { $max: '$latency' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  },

  // Upsert chain stats
  upsertChainStats: async (
    mongoManager: any,
    chainModel: any,
    chainId: number,
    statsData: Partial<ChainStatsDocument>
  ) => {
    return await mongoManager.upsert(
      chainModel,
      { chainId },
      { 
        $set: {
          ...statsData,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    );
  },

  // Upsert bridge stats
  upsertBridgeStats: async (
    mongoManager: any,
    bridgeModel: any,
    provider: string,
    statsData: Partial<BridgeStatsDocument>
  ) => {
    return await mongoManager.upsert(
      bridgeModel,
      { provider },
      { 
        $set: {
          ...statsData,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    );
  },

  // Cleanup old stats
  cleanupOldStats: async (
    mongoManager: any,
    chainModel: any,
    bridgeModel: any,
    overviewModel: any,
    olderThan: Date
  ) => {
    const results = await Promise.all([
      mongoManager.deleteMany(chainModel, { createdAt: { $lt: olderThan } }),
      mongoManager.deleteMany(bridgeModel, { createdAt: { $lt: olderThan } }),
      mongoManager.deleteMany(overviewModel, { createdAt: { $lt: olderThan } })
    ]);

    return {
      chainStatsDeleted: results[0].deletedCount,
      bridgeStatsDeleted: results[1].deletedCount,
      overviewDeleted: results[2].deletedCount
    };
  }
}; 