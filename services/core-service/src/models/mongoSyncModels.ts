import { 
  Schema, 
  Document, 
  Model, 
  Types, 
  HydratedDocument 
} from '@moonx-farm/infrastructure';

/**
 * User Sync Status Document Interface
 */
export interface IUserSyncStatus extends Document {
  userId: string;
  walletAddress: string;
  lastSyncAt: Date;
  lastSyncOperationId?: Types.ObjectId;
  syncReason: 'manual' | 'scheduled' | 'triggered' | 'periodic' | 'auto' | 'no_portfolio_data';
  syncType: 'portfolio' | 'trades' | 'metadata' | 'full';
  syncStatus: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  // Sync results
  tokensCount: number;
  chainsCount: number;
  totalValueUsd: number;
  syncDurationMs: number;
  
  // Sync statistics
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  avgSyncDurationMs: number;
  
  // Status flags
  isSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  
  // Error tracking
  lastErrorMessage?: string;
  lastErrorAt?: Date;
  consecutiveFailures: number;
  
  // Metadata
  metadata?: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sync Operation Document Interface
 */
export interface ISyncOperation extends Document {
  userId: string;
  walletAddress: string;
  type: 'portfolio' | 'trades' | 'metadata' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Results
  tokensSync: number;
  chainsSync: number;
  totalValueUsd: number;
  
  // Error handling
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  
  // Worker information
  workerId?: string;
  workerVersion?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Sync Status Schema
 */
export const userSyncStatusSchema = new Schema<IUserSyncStatus>({
  userId: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    required: true
  },
  lastSyncAt: {
    type: Date,
    required: true
  },
  lastSyncOperationId: {
    type: Schema.Types.ObjectId,
    ref: 'SyncOperation',
    default: null
  },
  syncReason: {
    type: String,
    enum: ['manual', 'scheduled', 'triggered', 'periodic', 'auto', 'no_portfolio_data'],
    default: 'manual'
  },
  syncType: {
    type: String,
    enum: ['portfolio', 'trades', 'metadata', 'full'],
    default: 'portfolio'
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  
  // Sync results
  tokensCount: {
    type: Number,
    default: 0,
    min: 0
  },
  chainsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalValueUsd: {
    type: Number,
    default: 0,
    min: 0
  },
  syncDurationMs: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Sync statistics
  totalSyncs: {
    type: Number,
    default: 0,
    min: 0
  },
  successfulSyncs: {
    type: Number,
    default: 0,
    min: 0
  },
  failedSyncs: {
    type: Number,
    default: 0,
    min: 0
  },
  avgSyncDurationMs: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status flags
  isSyncEnabled: {
    type: Boolean,
    default: true
  },
  autoSyncIntervalMinutes: {
    type: Number,
    default: 15,
    min: 1,
    max: 1440 // Max 24 hours
  },
  
  // Error tracking
  lastErrorMessage: {
    type: String,
    default: null
  },
  lastErrorAt: {
    type: Date,
    default: null
  },
  consecutiveFailures: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Metadata
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'user_sync_status'
});

/**
 * Sync Operation Schema
 */
export const syncOperationSchema = new Schema<ISyncOperation>({
  userId: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['portfolio', 'trades', 'metadata', 'full'],
    default: 'portfolio',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    required: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  
  // Timing
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  durationMs: {
    type: Number,
    default: null,
    min: 0
  },
  
  // Results
  tokensSync: {
    type: Number,
    default: 0,
    min: 0
  },
  chainsSync: {
    type: Number,
    default: 0,
    min: 0
  },
  totalValueUsd: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Error handling
  errorMessage: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: 0
  },
  
  // Worker information
  workerId: {
    type: String,
    default: null
  },
  workerVersion: {
    type: String,
    default: null
  },
  
  // Metadata
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'sync_operations'
});

// NOTE: Indexes are now managed by MongoManager.createIndexes() method
// This provides consistent index management across all services
// See: services/core-service/src/services/mongoSyncService.ts

/**
 * Export the schemas for use in MongoManager
 */
export const SyncSchemas = {
  UserSyncStatus: userSyncStatusSchema,
  SyncOperation: syncOperationSchema
};

/**
 * Type definitions for models
 */
export type UserSyncStatusModel = Model<IUserSyncStatus>;
export type SyncOperationModel = Model<ISyncOperation>;

/**
 * Helper interface for creating sync status records
 */
export interface CreateUserSyncStatusInput {
  userId: string;
  walletAddress: string;
  syncReason: 'manual' | 'scheduled' | 'triggered' | 'periodic' | 'auto' | 'no_portfolio_data';
  syncType?: 'portfolio' | 'trades' | 'metadata' | 'full';
  syncStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  tokensCount?: number;
  chainsCount?: number;
  totalValueUsd?: number;
  syncDurationMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Helper interface for creating sync operation records
 */
export interface CreateSyncOperationInput {
  userId: string;
  walletAddress: string;
  type: 'portfolio' | 'trades' | 'metadata' | 'full';
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  tokensSync?: number;
  chainsSync?: number;
  totalValueUsd?: number;
  errorMessage?: string;
  retryCount?: number;
  workerId?: string;
  workerVersion?: string;
  metadata?: Record<string, any>;
}

// Types are already exported at the top of the file 