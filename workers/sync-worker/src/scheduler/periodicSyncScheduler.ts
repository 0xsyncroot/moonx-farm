import { config } from '@/config';
import { logger } from '@/utils/logger';
import { Queue } from 'bullmq';
import { createRedisConfig } from '@moonx-farm/infrastructure';
import { SyncJobData } from '@/types';
import { DatabaseService } from '@/services/databaseService';

interface PeriodicSyncConfig {
  // Market hours sync (9 AM - 5 PM UTC) - more frequent syncs
  marketHoursInterval: number;
  // Off-hours sync (5 PM - 9 AM UTC) - less frequent syncs
  offHoursInterval: number;
  // Stale data threshold - force sync if user data is older than this
  staleDataThreshold: number;
  // Maximum users to sync per batch
  maxBatchSize: number;
  // Enable/disable periodic sync
  enabled: boolean;
}

interface UserSyncInfo {
  userId: string;
  walletAddress: string;
  lastSyncAt: Date;
  lastActiveAt: Date;
  syncCount: number;
  priority: 'high' | 'medium' | 'low';
}

export class PeriodicSyncScheduler {
  private syncQueue: Queue;
  private databaseService: DatabaseService;
  private isRunning = false;
  private schedulerInterval?: NodeJS.Timeout;
  private staleDataCheckInterval?: NodeJS.Timeout;
  private userSyncInfo: Map<string, UserSyncInfo> = new Map();
  
  private readonly config: PeriodicSyncConfig = {
    marketHoursInterval: parseInt(process.env.PERIODIC_SYNC_MARKET_HOURS_INTERVAL || '300000'), // 5 minutes
    offHoursInterval: parseInt(process.env.PERIODIC_SYNC_OFF_HOURS_INTERVAL || '900000'), // 15 minutes
    staleDataThreshold: parseInt(process.env.PERIODIC_SYNC_STALE_THRESHOLD || '3600000'), // 1 hour
    maxBatchSize: parseInt(process.env.PERIODIC_SYNC_BATCH_SIZE || '10'),
    enabled: process.env.PERIODIC_SYNC_ENABLED !== 'false', // enabled by default
  };

  // Max users to load from database (configurable)
  private readonly maxUsersToLoad = parseInt(process.env.PERIODIC_SYNC_MAX_USERS || '0'); // 0 = unlimited

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    
    // Initialize Redis-based BullMQ queue (same as MessageQueueListener)
    const redisConfig = createRedisConfig();
    const connectionConfig: any = {
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      db: redisConfig.db || 0,
    };
    
    if (redisConfig.password) {
      connectionConfig.password = redisConfig.password;
    }
    
    this.syncQueue = new Queue('sync-jobs', {
      connection: connectionConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: config.worker.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.worker.retryDelay,
        },
      },
    });
    
    logger.info('📅 Periodic Sync Scheduler initialized (Redis-based)', {
      marketHoursInterval: this.config.marketHoursInterval,
      offHoursInterval: this.config.offHoursInterval,
      staleDataThreshold: this.config.staleDataThreshold,
      maxBatchSize: this.config.maxBatchSize,
      enabled: this.config.enabled,
    });
  }

  /**
   * Start periodic sync scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      logger.warn('📅 Periodic sync scheduler already running or disabled');
      return;
    }

    try {
      this.isRunning = true;

      // Load active users from database
      await this.loadActiveUsersFromDatabase();

      // Start main scheduler
      this.startMainScheduler();

      // Start stale data checker
      this.startStaleDataChecker();

      logger.info('📅 Periodic sync scheduler started successfully', {
        marketHoursInterval: this.config.marketHoursInterval,
        offHoursInterval: this.config.offHoursInterval,
        activeUsers: this.userSyncInfo.size,
      });

    } catch (error) {
      logger.error('❌ Failed to start periodic sync scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop periodic sync scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('📅 Periodic sync scheduler already stopped');
      return;
    }

    try {
      this.isRunning = false;

      // Clear intervals
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval);
        delete this.schedulerInterval;
      }

      if (this.staleDataCheckInterval) {
        clearInterval(this.staleDataCheckInterval);
        delete this.staleDataCheckInterval;
      }

      // Close BullMQ queue
      await this.syncQueue.close();

      logger.info('📅 Periodic sync scheduler stopped successfully');

    } catch (error) {
      logger.error('❌ Error stopping periodic sync scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load active users from database
   */
  private async loadActiveUsersFromDatabase(): Promise<void> {
    try {
      // Get all users with sync enabled from user_sync_status table
      // Use configurable limit (0 = unlimited)
      const limit = this.maxUsersToLoad > 0 ? this.maxUsersToLoad : undefined;
      const users = await this.databaseService.getAllEnabledUsers(limit);

      this.userSyncInfo.clear();

      for (const user of users) {
        this.userSyncInfo.set(user.userId, {
          userId: user.userId,
          walletAddress: user.walletAddress,
          lastSyncAt: user.lastUpdated,
          lastActiveAt: user.lastUpdated, // Assume last sync = last active
          syncCount: 0,
          priority: 'medium',
        });
      }

      logger.info('📅 Loaded active users from database', {
        userCount: this.userSyncInfo.size,
        maxUsersConfig: this.maxUsersToLoad || 'unlimited'
      });

    } catch (error) {
      logger.error('❌ Error loading active users from database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start main scheduler with market-aware intervals
   */
  private startMainScheduler(): void {
    const runScheduler = async () => {
      try {
        if (!this.isRunning) return;

        const isMarketHours = this.isMarketHours();
        const interval = isMarketHours ? this.config.marketHoursInterval : this.config.offHoursInterval;

        logger.debug('📅 Running periodic sync check', {
          isMarketHours,
          interval,
          registeredUsers: this.userSyncInfo.size,
        });

        // Get users that need periodic sync
        const usersToSync = this.getUsersForPeriodicSync(isMarketHours);

        if (usersToSync.length > 0) {
          await this.schedulePeriodicSyncBatch(usersToSync);
        }

        // Refresh user list from database periodically (every hour)
        if (Date.now() % (60 * 60 * 1000) < interval) {
          await this.loadActiveUsersFromDatabase();
        }

        // Schedule next run
        this.schedulerInterval = setTimeout(runScheduler, interval);

      } catch (error) {
        logger.error('❌ Error in periodic sync scheduler', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Retry after 1 minute on error
        this.schedulerInterval = setTimeout(runScheduler, 60000);
      }
    };

    // Start immediately
    runScheduler();
  }

  /**
   * Start stale data checker (runs every 30 minutes)
   */
  private startStaleDataChecker(): void {
    this.staleDataCheckInterval = setInterval(async () => {
      try {
        if (!this.isRunning) return;

        const staleUsers = this.getStaleUsers();

        if (staleUsers.length > 0) {
          logger.info('🔄 Found users with stale data', {
            count: staleUsers.length,
            threshold: this.config.staleDataThreshold,
          });

          await this.schedulePeriodicSyncBatch(staleUsers, 'high');
        }

      } catch (error) {
        logger.error('❌ Error in stale data checker', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 30 * 60 * 1000); // Check every 30 minutes
  }

  /**
   * Check if current time is market hours (9 AM - 5 PM UTC)
   */
  private isMarketHours(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    return utcHour >= 9 && utcHour < 17; // 9 AM - 5 PM UTC
  }

  /**
   * Get users that need periodic sync
   */
  private getUsersForPeriodicSync(isMarketHours: boolean): UserSyncInfo[] {
    const now = new Date();
    const syncThreshold = isMarketHours ? this.config.marketHoursInterval : this.config.offHoursInterval;
    const usersToSync: UserSyncInfo[] = [];

    this.userSyncInfo.forEach((userInfo) => {
      const timeSinceLastSync = now.getTime() - userInfo.lastSyncAt.getTime();
      const timeSinceLastActive = now.getTime() - userInfo.lastActiveAt.getTime();
      
      // Only sync if:
      // 1. User was active recently (within 24 hours)
      // 2. Time since last sync exceeds threshold
      const isActiveRecently = timeSinceLastActive < 24 * 60 * 60 * 1000; // 24 hours
      const needsSync = timeSinceLastSync > syncThreshold;

      if (isActiveRecently && needsSync) {
        usersToSync.push(userInfo);
      }
    });

    // Sort by priority and last sync time
    usersToSync.sort((a, b) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return a.lastSyncAt.getTime() - b.lastSyncAt.getTime();
    });

    return usersToSync.slice(0, this.config.maxBatchSize);
  }

  /**
   * Get users with stale data
   */
  private getStaleUsers(): UserSyncInfo[] {
    const now = new Date();
    const staleUsers: UserSyncInfo[] = [];

    this.userSyncInfo.forEach((userInfo) => {
      const timeSinceLastSync = now.getTime() - userInfo.lastSyncAt.getTime();
      
      if (timeSinceLastSync > this.config.staleDataThreshold) {
        staleUsers.push(userInfo);
      }
    });

    return staleUsers;
  }

  /**
   * Schedule periodic sync batch using Redis BullMQ
   */
  private async schedulePeriodicSyncBatch(
    users: UserSyncInfo[],
    priority: 'high' | 'medium' | 'low' = 'low'
  ): Promise<void> {
    try {
      logger.info('📅 Scheduling periodic sync batch', {
        userCount: users.length,
        priority,
      });

      // ✅ DEDUPLICATION: Check for active operations for all users
      const activeOperations = await this.databaseService.mongoSyncService.getActiveSyncOperations();
      const activeUserIds = new Set(activeOperations.map(op => op.userId));

      // Filter out users who already have active operations
      const filteredUsers = users.filter(user => {
        const hasActiveOperation = activeUserIds.has(user.userId);
        if (hasActiveOperation) {
          logger.debug('📅 Skipping user with active sync operation', {
            userId: user.userId,
            walletAddress: user.walletAddress,
            reason: 'deduplication',
            source: 'periodic_sync'
          });
          return false;
        }
        return true;
      });

      if (filteredUsers.length === 0) {
        logger.info('📅 No users to sync after deduplication', {
          originalCount: users.length,
          filteredCount: filteredUsers.length,
          activeOperations: activeOperations.length,
          priority
        });
        return;
      }

      logger.info('📅 Users filtered for periodic sync after deduplication', {
        originalCount: users.length,
        filteredCount: filteredUsers.length,
        skippedCount: users.length - filteredUsers.length,
        activeOperations: activeOperations.length,
        priority
      });

      const jobs = [];

      for (const user of filteredUsers) {
        const syncJobData: SyncJobData = {
          userId: user.userId,
          walletAddress: user.walletAddress,
          priority,
          metadata: {
            source: 'periodic_sync',
            isMarketHours: this.isMarketHours(),
            lastSyncAt: user.lastSyncAt.toISOString(),
            scheduledAt: new Date().toISOString(),
            deduplication_check: 'passed'
          },
        };

        // Add job to BullMQ queue
        const job = this.syncQueue.add('sync-job', {
          ...syncJobData,
          jobId: `periodic_${user.userId}_${Date.now()}`,
          triggeredAt: new Date(),
          syncType: 'portfolio',
        }, {
          priority: this.getPriorityValue(priority),
          delay: Math.random() * 5000, // Random delay 0-5 seconds to avoid thundering herd
          jobId: `periodic_${user.userId}_${Date.now()}`,
        });

        jobs.push(job);

        // Update last sync time
        user.lastSyncAt = new Date();
        user.syncCount++;
      }

      // Wait for all jobs to be queued
      await Promise.all(jobs);

      logger.info('✅ Periodic sync batch scheduled successfully', {
        originalCount: users.length,
        scheduledCount: filteredUsers.length,
        skippedCount: users.length - filteredUsers.length,
        priority,
      });

    } catch (error) {
      logger.error('❌ Error scheduling periodic sync batch', {
        error: error instanceof Error ? error.message : String(error),
        userCount: users.length,
      });
    }
  }

  /**
   * Register user for periodic sync (called when user performs manual sync)
   */
  async registerUser(userId: string, walletAddress: string): Promise<void> {
    const userInfo: UserSyncInfo = {
      userId,
      walletAddress,
      lastSyncAt: new Date(),
      lastActiveAt: new Date(),
      syncCount: 0,
      priority: 'medium',
    };

    this.userSyncInfo.set(userId, userInfo);

    logger.debug('📅 User registered for periodic sync', {
      userId,
      walletAddress,
      totalUsers: this.userSyncInfo.size,
    });
  }

  /**
   * Update user activity
   */
  async updateUserActivity(userId: string): Promise<void> {
    const userInfo = this.userSyncInfo.get(userId);
    if (userInfo) {
      userInfo.lastActiveAt = new Date();
      
      // Increase priority for active users
      if (userInfo.priority === 'low') {
        userInfo.priority = 'medium';
      }
    }
  }

  /**
   * Update user sync info
   */
  async updateUserSyncInfo(userId: string, lastSyncAt: Date): Promise<void> {
    const userInfo = this.userSyncInfo.get(userId);
    if (userInfo) {
      userInfo.lastSyncAt = lastSyncAt;
      userInfo.syncCount++;
    }
  }

  /**
   * Remove user from periodic sync
   */
  async unregisterUser(userId: string): Promise<void> {
    this.userSyncInfo.delete(userId);
    
    logger.debug('📅 User unregistered from periodic sync', {
      userId,
      remainingUsers: this.userSyncInfo.size,
    });
  }

  /**
   * Get priority value for BullMQ
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    const priorityMap = {
      high: 1,
      medium: 5,
      low: 10,
    };
    return priorityMap[priority];
  }

  /**
   * Get scheduler statistics
   */
  getStats(): any {
    const now = new Date();
    const activeUsers = Array.from(this.userSyncInfo.values()).filter(
      user => now.getTime() - user.lastActiveAt.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      totalUsers: this.userSyncInfo.size,
      activeUsers: activeUsers.length,
      isMarketHours: this.isMarketHours(),
      config: this.config,
      nextScheduledSync: this.schedulerInterval ? 'scheduled' : 'not_scheduled',
    };
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if scheduler is running and queue is accessible
      const queueStats = await this.syncQueue.getWaiting();
      return this.isRunning && Array.isArray(queueStats);
    } catch (error) {
      logger.error('Periodic sync scheduler health check failed', { error });
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    logger.info('📅 Graceful shutdown of periodic sync scheduler...');
    
    try {
      await this.stop();
      logger.info('📅 Periodic sync scheduler shutdown completed');
    } catch (error) {
      logger.error('❌ Error during periodic sync scheduler shutdown', { error });
      throw error;
    }
  }
} 