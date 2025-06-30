import { PortfolioService } from './portfolioService';
import { CacheService } from './cacheService';
import { DatabaseService } from './databaseService';
import { createConfig } from '@moonx-farm/configs';

interface UserSyncStatus {
  userId: string;
  walletAddress: string;
  lastSyncAt: Date;
  syncFrequency: number; // minutes
  priorityLevel: 'high' | 'normal' | 'low';
}

interface TriggeredSync {
  userId: string;
  walletAddress: string;
  priority: 'high' | 'normal' | 'low';
  triggeredAt: Date;
  reason: string;
}

interface SyncStats {
  totalUsers: number;
  usersNeedingSync: number;
  stalePortfolios: number;
  isRunning: boolean;
  lastProcessedAt?: Date;
  syncErrors: number;
}

export class AutoSyncService {
  private portfolioService: PortfolioService;
  private cacheService: CacheService;
  private db: DatabaseService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: any;
  private syncErrors = 0;
  private lastProcessedAt?: Date;

  constructor(
    portfolioService: PortfolioService, 
    cacheService: CacheService,
    databaseService: DatabaseService
  ) {
    this.portfolioService = portfolioService;
    this.cacheService = cacheService;
    this.db = databaseService;
    
    // Get Core Service configuration
    this.config = createConfig('core-service');
    
    console.log('✅ AutoSyncService initialized with Core Service configuration');
  }

  /**
   * Start the auto-sync service with comprehensive error handling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('AutoSync Service is already running');
      return;
    }
    
    try {
      this.isRunning = true;
      this.syncErrors = 0;
      console.log('🔄 AutoSync Service started');

      // Run sync check every 2 minutes
      this.syncInterval = setInterval(async () => {
        try {
          await this.processSyncQueue();
          this.lastProcessedAt = new Date();
        } catch (error) {
          this.syncErrors++;
          console.error('AutoSync processing error:', error);
          
          // If too many errors, temporarily pause
          if (this.syncErrors > 10) {
            console.error('Too many sync errors, pausing for 5 minutes');
            await this.pause(5 * 60 * 1000); // 5 minutes
            this.syncErrors = 0; // Reset counter
          }
        }
      }, 2 * 60 * 1000); // 2 minutes

      // Initial sync check after startup delay
      setTimeout(() => {
        this.processSyncQueue().catch(error => {
          console.error('Initial sync check failed:', error);
        });
      }, 10000); // 10 seconds after start

      console.log('✅ AutoSync Service started successfully');
    } catch (error) {
      console.error('Failed to start AutoSync Service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the auto-sync service gracefully
   */
  async stop(): Promise<void> {
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      this.isRunning = false;
      console.log('⏹️ AutoSync Service stopped gracefully');
    } catch (error) {
      console.error('Error stopping AutoSync Service:', error);
    }
  }

  /**
   * Trigger immediate sync for a user
   */
  async triggerUserSync(userId: string, walletAddress: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    if (!userId || !walletAddress) {
      throw new Error('User ID and wallet address are required for sync trigger');
    }

    try {
      // Trigger immediate sync for user (e.g., when they login or make a trade)
      const syncKey = `sync_trigger:${userId}:${walletAddress}`;
      
      const triggerData: TriggeredSync = {
        userId,
        walletAddress,
        priority,
        triggeredAt: new Date(),
        reason: priority === 'high' ? 'user_action' : 'auto_trigger'
      };

      await this.cacheService.set(syncKey, triggerData, 300); // 5 minutes TTL

      console.log(`🚀 Triggered ${priority} priority sync for user ${userId}`);
    } catch (error) {
      console.error(`Failed to trigger sync for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process the sync queue with priority ordering
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isRunning) {
      console.log('AutoSync service not running, skipping queue processing');
      return;
    }

    try {
      console.log('🔄 Processing sync queue...');

      // 1. Check triggered syncs (high priority)
      await this.processTriggeredSyncs();
      
      // 2. Check scheduled syncs (normal priority)
      await this.processScheduledSyncs();
      
      // 3. Check stale data (low priority)
      await this.processStaleSyncs();
      
      console.log('✅ Sync queue processing completed');
      
    } catch (error) {
      console.error('Error processing sync queue:', error);
      throw error;
    }
  }

  /**
   * Process high-priority triggered syncs
   */
  private async processTriggeredSyncs(): Promise<void> {
    try {
      // Check for users who need immediate sync (login, trades, etc.)
      const triggeredUsers = await this.getTriggeredSyncs();
      
      if (triggeredUsers.length === 0) {
        return;
      }

      console.log(`Found ${triggeredUsers.length} triggered syncs to process`);
      
      for (const user of triggeredUsers) {
        try {
          console.log(`🔄 Processing triggered sync for user ${user.userId} (reason: ${user.reason})`);
          
          await this.performUserSync(user.userId, user.walletAddress, 'triggered');
          
          // Remove from triggered queue
          await this.cacheService.del(`sync_trigger:${user.userId}:${user.walletAddress}`);
          
        } catch (error) {
          console.error(`Failed triggered sync for user ${user.userId}:`, error);
          // Continue with other users
        }
      }
    } catch (error) {
      console.error('Error processing triggered syncs:', error);
    }
  }

  /**
   * Process normal-priority scheduled syncs
   */
  private async processScheduledSyncs(): Promise<void> {
    try {
      // Find users whose portfolios need scheduled refresh
      const usersNeedingSync = await this.getUsersNeedingSync();
      
      if (usersNeedingSync.length === 0) {
        return;
      }

      console.log(`Found ${usersNeedingSync.length} users needing scheduled sync`);
      
      // Limit concurrent syncs to avoid overwhelming APIs
      const maxConcurrentSyncs = 3; // Reduced for stability
      const batch = usersNeedingSync.slice(0, maxConcurrentSyncs);
      
      const syncPromises = batch.map(async (user) => {
        try {
          console.log(`🔄 Processing scheduled sync for user ${user.userId}`);
          return await this.performUserSync(user.userId, user.walletAddress, 'scheduled');
        } catch (error) {
          console.error(`Failed scheduled sync for user ${user.userId}:`, error);
          return null;
        }
      });
      
      await Promise.allSettled(syncPromises);
    } catch (error) {
      console.error('Error processing scheduled syncs:', error);
    }
  }

  /**
   * Process low-priority stale syncs
   */
  private async processStaleSyncs(): Promise<void> {
    try {
      // Find portfolios that are very stale (> 1 hour old)
      const stalePortfolios = await this.getStalePortfolios();
      
      if (stalePortfolios.length === 0) {
        return;
      }

      console.log(`Found ${stalePortfolios.length} stale portfolios`);
      
      // Process 1 stale sync per cycle (low priority)
      const portfolio = stalePortfolios[0];
      
      if (portfolio) {
        try {
          console.log(`🔄 Processing stale sync for user ${portfolio.userId}`);
          await this.performUserSync(portfolio.userId, portfolio.walletAddress, 'stale');
        } catch (error) {
          console.error(`Failed stale sync for user ${portfolio.userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing stale syncs:', error);
    }
  }

  /**
   * Perform actual user sync with locking mechanism
   */
  private async performUserSync(userId: string, walletAddress: string, reason: string): Promise<void> {
    const syncLockKey = `sync_lock:${userId}:${walletAddress}`;
    
    try {
      // Check if already syncing
      const isLocked = await this.cacheService.exists(syncLockKey);
      
      if (isLocked) {
        console.log(`⏭️ Skipping sync for ${userId} - already in progress`);
        return;
      }

      // Set sync lock (10 minutes)
      await this.cacheService.set(syncLockKey, { 
        startedAt: new Date(), 
        reason,
        pid: process.pid 
      }, 600);

      console.log(`🔒 Acquired sync lock for user ${userId}`);

      // Perform sync
      const syncOperation = await this.portfolioService.syncPortfolio(userId, {
        walletAddress,
        forceRefresh: reason === 'triggered' // Force refresh for triggered syncs
      });

      // Update sync status
      await this.updateUserSyncStatus(userId, walletAddress, reason);
      
      console.log(`✅ Completed ${reason} sync for user ${userId} - status: ${syncOperation.status}`);
      
    } catch (error) {
      console.error(`❌ Sync failed for user ${userId}:`, error);
      throw error;
    } finally {
      // Always release lock
      try {
        await this.cacheService.del(syncLockKey);
        console.log(`🔓 Released sync lock for user ${userId}`);
      } catch (lockError) {
        console.warn(`Failed to release sync lock for user ${userId}:`, lockError);
      }
    }
  }

  /**
   * Get triggered syncs from cache
   */
  private async getTriggeredSyncs(): Promise<TriggeredSync[]> {
    try {
      // In production, you'd use Redis SCAN to find triggered sync keys
      // For now, simplified implementation using a known pattern
      const triggers: TriggeredSync[] = [];
      
      // This is a simplified version - in production you'd scan Redis keys
      // matching pattern "sync_trigger:*" and parse the data
      
      return triggers;
    } catch (error) {
      console.error('Error getting triggered syncs:', error);
      return [];
    }
  }

  /**
   * Get users needing sync from database
   */
  private async getUsersNeedingSync(): Promise<Array<{ userId: string; walletAddress: string; lastSyncAt: Date }>> {
    try {
      // Find users whose last portfolio sync was > 15 minutes ago
      const query = `
        SELECT DISTINCT user_id, wallet_address, MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE last_updated < NOW() - INTERVAL '15 minutes'
        GROUP BY user_id, wallet_address
        ORDER BY last_sync ASC
        LIMIT 20
      `;
      
      const result = await this.db.query(query);
      
      if (!result?.rows) {
        return [];
      }
      
      return result.rows.map((row: any) => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastSyncAt: new Date(row.last_sync)
      }));
    } catch (error) {
      console.error('Error getting users needing sync:', error);
      return [];
    }
  }

  /**
   * Get stale portfolios from database
   */
  private async getStalePortfolios(): Promise<Array<{ userId: string; walletAddress: string; lastSyncAt: Date }>> {
    try {
      // Find portfolios not synced in > 2 hours (increased for stability)
      const query = `
        SELECT DISTINCT user_id, wallet_address, MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE last_updated < NOW() - INTERVAL '2 hours'
        GROUP BY user_id, wallet_address
        ORDER BY last_sync ASC
        LIMIT 10
      `;
      
      const result = await this.db.query(query);
      
      if (!result?.rows) {
        return [];
      }
      
      return result.rows.map((row: any) => ({
        userId: row.user_id,
        walletAddress: row.wallet_address,
        lastSyncAt: new Date(row.last_sync)
      }));
    } catch (error) {
      console.error('Error getting stale portfolios:', error);
      return [];
    }
  }

  /**
   * Update user sync status in database
   */
  private async updateUserSyncStatus(userId: string, walletAddress: string, reason: string): Promise<void> {
    try {
      const query = `
        INSERT INTO user_sync_status (user_id, wallet_address, last_sync_at, sync_reason, updated_at)
        VALUES ($1, $2, NOW(), $3, NOW())
        ON CONFLICT (user_id, wallet_address) 
        DO UPDATE SET 
          last_sync_at = NOW(),
          sync_reason = $3,
          updated_at = NOW()
      `;
      
      await this.db.query(query, [userId, walletAddress, reason]);
    } catch (error) {
      console.warn('Error updating sync status:', error);
      // Don't throw - sync status update failure shouldn't break the main flow
    }
  }

  /**
   * Pause the service temporarily
   */
  private async pause(durationMs: number): Promise<void> {
    console.log(`⏸️ Pausing AutoSync service for ${durationMs / 1000} seconds`);
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  // Public methods for triggering syncs
  async onUserLogin(userId: string, walletAddress: string): Promise<void> {
    try {
      await this.triggerUserSync(userId, walletAddress, 'high');
      console.log(`Triggered high-priority sync on user login: ${userId}`);
    } catch (error) {
      console.error(`Failed to trigger sync on user login for ${userId}:`, error);
    }
  }

  async onUserTrade(userId: string, walletAddress: string): Promise<void> {
    try {
      await this.triggerUserSync(userId, walletAddress, 'high');
      console.log(`Triggered high-priority sync on user trade: ${userId}`);
    } catch (error) {
      console.error(`Failed to trigger sync on user trade for ${userId}:`, error);
    }
  }

  async onUserAccess(userId: string, walletAddress: string): Promise<void> {
    try {
      // Check if needs sync (last sync > 10 minutes)
      const lastSync = await this.getLastSyncTime(userId, walletAddress);
      const now = new Date();
      const diffMinutes = lastSync ? (now.getTime() - lastSync.getTime()) / (1000 * 60) : Infinity;
      
      if (diffMinutes > 10) {
        await this.triggerUserSync(userId, walletAddress, 'normal');
        console.log(`Triggered normal-priority sync on user access: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to trigger sync on user access for ${userId}:`, error);
    }
  }

  /**
   * Get last sync time for a user
   */
  private async getLastSyncTime(userId: string, walletAddress: string): Promise<Date | null> {
    try {
      const query = `
        SELECT MAX(last_updated) as last_sync
        FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      
      const result = await this.db.query(query, [userId, walletAddress]);
      return result.rows?.[0]?.last_sync ? new Date(result.rows[0].last_sync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Get comprehensive sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const [totalUsers, usersNeedingSync, stalePortfolios] = await Promise.allSettled([
        this.getTotalUsersCount(),
        this.getUsersNeedingSync().then(users => users.length),
        this.getStalePortfolios().then(portfolios => portfolios.length)
      ]);

      return {
        totalUsers: totalUsers.status === 'fulfilled' ? totalUsers.value : 0,
        usersNeedingSync: usersNeedingSync.status === 'fulfilled' ? usersNeedingSync.value : 0,
        stalePortfolios: stalePortfolios.status === 'fulfilled' ? stalePortfolios.value : 0,
        isRunning: this.isRunning,
        ...(this.lastProcessedAt && { lastProcessedAt: this.lastProcessedAt }),
        syncErrors: this.syncErrors
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        totalUsers: 0,
        usersNeedingSync: 0,
        stalePortfolios: 0,
        isRunning: this.isRunning,
        syncErrors: this.syncErrors
      };
    }
  }

  /**
   * Get total users count from database
   */
  private async getTotalUsersCount(): Promise<number> {
    try {
      const result = await this.db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM user_token_holdings'
      );
      return parseInt(result.rows?.[0]?.count || '0');
    } catch (error) {
      console.error('Error getting total users count:', error);
      return 0;
    }
  }

  /**
   * Health check for the auto-sync service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    isRunning: boolean;
    lastProcessed: Date | null;
    errorCount: number;
    database: boolean;
    cache: boolean;
  }> {
    const health = {
      status: 'healthy' as 'healthy' | 'unhealthy',
      isRunning: this.isRunning,
      lastProcessed: this.lastProcessedAt || null,
      errorCount: this.syncErrors,
      database: false,
      cache: false
    };

    try {
      // Check database connectivity
      await this.db.query('SELECT 1 as health_check');
      health.database = true;

      // Check cache connectivity
      await this.cacheService.set('autosync_health_check', 'ok', 10);
      const cacheResult = await this.cacheService.get('autosync_health_check');
      health.cache = cacheResult === 'ok';

      // Determine overall health
      const isHealthy = health.isRunning && 
                       health.database && 
                       health.cache && 
                       health.errorCount < 5;

      health.status = isHealthy ? 'healthy' : 'unhealthy';

    } catch (error) {
      console.error('AutoSync service health check failed:', error);
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Force trigger sync for all users (admin function)
   */
  async forceGlobalSync(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('AutoSync service is not running');
    }

    try {
      console.log('🚀 Starting forced global sync...');
      
      // Get all unique users
      const users = await this.getAllUsers();
      
      console.log(`Triggering sync for ${users.length} users`);
      
      // Trigger sync for all users with normal priority
      const promises = users.map(user => 
        this.triggerUserSync(user.userId, user.walletAddress, 'normal')
          .catch(error => console.error(`Failed to trigger sync for ${user.userId}:`, error))
      );
      
      await Promise.allSettled(promises);
      
      console.log('✅ Global sync triggered for all users');
    } catch (error) {
      console.error('Failed to trigger global sync:', error);
      throw error;
    }
  }

  /**
   * Get all users from database
   */
  private async getAllUsers(): Promise<Array<{ userId: string; walletAddress: string }>> {
    try {
      const query = `
        SELECT DISTINCT user_id, wallet_address
        FROM user_token_holdings
        ORDER BY user_id
      `;
      
      const result = await this.db.query(query);
      
      return result.rows?.map((row: any) => ({
        userId: row.user_id,
        walletAddress: row.wallet_address
      })) || [];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
} 