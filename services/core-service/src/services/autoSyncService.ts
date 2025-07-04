import { PortfolioService } from './portfolioService';
import { CacheService } from './cacheService';
import { DatabaseService } from './databaseService';
import { createConfig } from '@moonx-farm/configs';

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

interface RateLimitInfo {
  userId: string;
  requestCount: number;
  lastRequestAt: Date;
  windowStart: Date;
}

export class AutoSyncService {
  private portfolioService: PortfolioService;
  private cacheService: CacheService;
  private db: DatabaseService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private syncErrors = 0;
  private lastProcessedAt?: Date;
  private activeSync: Set<string> = new Set(); // Track active syncs
  private rateLimitMap: Map<string, RateLimitInfo> = new Map(); // Rate limiting

  // Rate limiting config
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 sync requests per 15 minutes per user
  private readonly MIN_SYNC_INTERVAL = 5 * 60 * 1000; // Minimum 5 minutes between syncs

  constructor(
    portfolioService: PortfolioService, 
    cacheService: CacheService,
    databaseService: DatabaseService
  ) {
    this.portfolioService = portfolioService;
    this.cacheService = cacheService;
    this.db = databaseService;
    
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
      this.activeSync.clear();
      this.rateLimitMap.clear();
      
      console.log('🔄 AutoSync Service started');

      // Run sync check every 2 minutes (reduced frequency for better performance)
      this.syncInterval = setInterval(async () => {
        try {
          await this.processSyncQueue();
          this.lastProcessedAt = new Date();
          
          // Clean up old rate limit data every 30 minutes
          if (this.lastProcessedAt.getMinutes() % 30 === 0) {
            this.cleanupRateLimitData();
          }
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
      this.activeSync.clear();
      this.rateLimitMap.clear();
      
      console.log('⏹️ AutoSync Service stopped gracefully');
    } catch (error) {
      console.error('Error stopping AutoSync Service:', error);
    }
  }

  /**
   * Check if user can trigger sync (rate limiting)
   */
  private checkRateLimit(userId: string): { allowed: boolean; remainingRequests?: number; resetTime?: Date } {
    const userKey = `user:${userId}`;
    const now = new Date();
    
    let rateLimitInfo = this.rateLimitMap.get(userKey);
    
    if (!rateLimitInfo) {
      // First request
      rateLimitInfo = {
        userId,
        requestCount: 1,
        lastRequestAt: now,
        windowStart: now
      };
      this.rateLimitMap.set(userKey, rateLimitInfo);
      return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
    }
    
    // Check if window has expired
    if (now.getTime() - rateLimitInfo.windowStart.getTime() > this.RATE_LIMIT_WINDOW) {
      // Reset window
      rateLimitInfo.requestCount = 1;
      rateLimitInfo.windowStart = now;
      rateLimitInfo.lastRequestAt = now;
      this.rateLimitMap.set(userKey, rateLimitInfo);
      return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
    }
    
    // Check if exceeded rate limit
    if (rateLimitInfo.requestCount >= this.RATE_LIMIT_MAX_REQUESTS) {
      const resetTime = new Date(rateLimitInfo.windowStart.getTime() + this.RATE_LIMIT_WINDOW);
      return { allowed: false, remainingRequests: 0, resetTime };
    }
    
    // Check minimum interval between requests
    if (now.getTime() - rateLimitInfo.lastRequestAt.getTime() < this.MIN_SYNC_INTERVAL) {
      return { allowed: false, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - rateLimitInfo.requestCount };
    }
    
    // Allow request
    rateLimitInfo.requestCount++;
    rateLimitInfo.lastRequestAt = now;
    this.rateLimitMap.set(userKey, rateLimitInfo);
    
    return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - rateLimitInfo.requestCount };
  }

  /**
   * Clean up old rate limit data
   */
  private cleanupRateLimitData(): void {
    const now = new Date();
    for (const [key, rateLimitInfo] of this.rateLimitMap.entries()) {
      if (now.getTime() - rateLimitInfo.windowStart.getTime() > this.RATE_LIMIT_WINDOW) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Check if user sync is already active
   */
  private isSyncActive(userId: string, walletAddress: string): boolean {
    const syncKey = `${userId}:${walletAddress}`;
    return this.activeSync.has(syncKey);
  }

  /**
   * Mark sync as active
   */
  private markSyncActive(userId: string, walletAddress: string): void {
    const syncKey = `${userId}:${walletAddress}`;
    this.activeSync.add(syncKey);
  }

  /**
   * Mark sync as completed
   */
  private markSyncCompleted(userId: string, walletAddress: string): void {
    const syncKey = `${userId}:${walletAddress}`;
    this.activeSync.delete(syncKey);
  }

  /**
   * Trigger user sync manually (for API calls) with rate limiting
   */
  async triggerUserSync(userId: string, walletAddress: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<{
    success: boolean;
    message: string;
    rateLimitInfo?: { remainingRequests: number; resetTime?: Date };
  }> {
    try {
      // Check rate limit
      const rateLimitCheck = this.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          message: 'Rate limit exceeded. Please wait before triggering another sync.',
          rateLimitInfo: {
            remainingRequests: rateLimitCheck.remainingRequests || 0,
            resetTime: rateLimitCheck.resetTime
          }
        };
      }

      // Check if sync is already active
      if (this.isSyncActive(userId, walletAddress)) {
        return {
          success: false,
          message: 'Sync is already in progress for this user.',
          rateLimitInfo: {
            remainingRequests: rateLimitCheck.remainingRequests || 0
          }
        };
      }

      // Add to triggered syncs queue
      const triggeredSync: TriggeredSync = {
        userId,
        walletAddress,
        priority,
        triggeredAt: new Date(),
        reason: 'manual_trigger'
      };

      // Add to global trigger queue
      await this.addToTriggerQueue(triggeredSync);

      console.log(`📨 Manual sync triggered for user ${userId} with ${priority} priority`);

      // If service is running, try to process immediately
      if (this.isRunning) {
        // Process triggered syncs immediately for high priority
        if (priority === 'high') {
          setTimeout(() => {
            this.processTriggeredSyncs().catch(error => {
              console.error('Error processing immediate sync:', error);
            });
          }, 1000);
        }
      }

      return {
        success: true,
        message: 'Sync triggered successfully',
        rateLimitInfo: {
          remainingRequests: rateLimitCheck.remainingRequests || 0
        }
      };

    } catch (error) {
      console.error('Error triggering user sync:', error);
      return {
        success: false,
        message: 'Failed to trigger sync due to internal error'
      };
    }
  }

  /**
   * Process the sync queue with priority ordering and concurrent processing
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isRunning) {
      console.log('AutoSync service not running, skipping queue processing');
      return;
    }

    try {
      console.log('🔄 Processing sync queue...');

      // Process all types concurrently but with limited concurrency
      const maxConcurrent = 3; // Maximum 3 concurrent syncs
      const currentActive = this.activeSync.size;
      
      if (currentActive >= maxConcurrent) {
        console.log(`Sync queue processing skipped - ${currentActive} active syncs (max: ${maxConcurrent})`);
        return;
      }

      const availableSlots = maxConcurrent - currentActive;
      
      // 1. Process triggered syncs first (highest priority)
      await this.processTriggeredSyncs(availableSlots);
      
      // 2. Process scheduled syncs if slots available
      const remainingSlots = maxConcurrent - this.activeSync.size;
      if (remainingSlots > 0) {
        await this.processScheduledSyncs(remainingSlots);
      }
      
      // 3. Process stale syncs with lowest priority
      const finalSlots = maxConcurrent - this.activeSync.size;
      if (finalSlots > 0) {
        await this.processStaleSyncs(finalSlots);
      }
      
      console.log(`✅ Sync queue processing completed (${this.activeSync.size} active syncs)`);
      
    } catch (error) {
      console.error('Error processing sync queue:', error);
      throw error;
    }
  }

  /**
   * Process high-priority triggered syncs with concurrency limit
   */
  private async processTriggeredSyncs(maxSlots: number = 3): Promise<void> {
    try {
      const triggeredUsers = await this.getTriggeredSyncs();
      
      if (triggeredUsers.length === 0) {
        return;
      }

      console.log(`Found ${triggeredUsers.length} triggered syncs to process`);
      
      // Process up to maxSlots syncs concurrently
      const toProcess = triggeredUsers.slice(0, maxSlots);
      const promises = toProcess.map(async (user) => {
        try {
          if (this.isSyncActive(user.userId, user.walletAddress)) {
            return; // Skip if already active
          }
          
          console.log(`🔄 Processing triggered sync for user ${user.userId} (reason: ${user.reason})`);
          
          this.markSyncActive(user.userId, user.walletAddress);
          await this.performUserSync(user.userId, user.walletAddress, 'triggered');
          
        } catch (error) {
          console.error(`Error processing triggered sync for user ${user.userId}:`, error);
        } finally {
          this.markSyncCompleted(user.userId, user.walletAddress);
          
          // Remove from trigger queue
          await this.removeFromTriggerQueue(user.userId, user.walletAddress);
        }
      });

      await Promise.all(promises);
      
    } catch (error) {
      console.error('Error processing triggered syncs:', error);
    }
  }

  /**
   * Process normal-priority scheduled syncs
   */
  private async processScheduledSyncs(maxSlots: number = 3): Promise<void> {
    try {
      // Find users whose portfolios need scheduled refresh
      const usersNeedingSync = await this.getUsersNeedingSync();
      
      if (usersNeedingSync.length === 0) {
        return;
      }

      console.log(`Found ${usersNeedingSync.length} users needing scheduled sync`);
      
      // Filter out users already being synced and limit to available slots
      const availableUsers = usersNeedingSync.filter(user => 
        !this.isSyncActive(user.userId, user.walletAddress)
      );
      
      const batch = availableUsers.slice(0, maxSlots);
      
      const syncPromises = batch.map(async (user) => {
        try {
          console.log(`🔄 Processing scheduled sync for user ${user.userId}`);
          
          this.markSyncActive(user.userId, user.walletAddress);
          await this.performUserSync(user.userId, user.walletAddress, 'scheduled');
          
        } catch (error) {
          console.error(`Failed scheduled sync for user ${user.userId}:`, error);
        } finally {
          this.markSyncCompleted(user.userId, user.walletAddress);
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
  private async processStaleSyncs(maxSlots: number = 3): Promise<void> {
    try {
      // Find portfolios that are very stale (> 1 hour old)
      const stalePortfolios = await this.getStalePortfolios();
      
      if (stalePortfolios.length === 0) {
        return;
      }

      console.log(`Found ${stalePortfolios.length} stale portfolios`);
      
      // Filter out users already being synced and limit to 1 slot (low priority)
      const availablePortfolios = stalePortfolios.filter(portfolio => 
        !this.isSyncActive(portfolio.userId, portfolio.walletAddress)
      );
      
      const batch = availablePortfolios.slice(0, Math.min(maxSlots, 1)); // Max 1 stale sync at a time
      
      const syncPromises = batch.map(async (portfolio) => {
        try {
          console.log(`🔄 Processing stale sync for user ${portfolio.userId}`);
          
          this.markSyncActive(portfolio.userId, portfolio.walletAddress);
          await this.performUserSync(portfolio.userId, portfolio.walletAddress, 'stale');
          
        } catch (error) {
          console.error(`Failed stale sync for user ${portfolio.userId}:`, error);
        } finally {
          this.markSyncCompleted(portfolio.userId, portfolio.walletAddress);
        }
      });
      
      await Promise.allSettled(syncPromises);
    } catch (error) {
      console.error('Error processing stale syncs:', error);
    }
  }

  /**
   * Perform actual user sync (no cache locking needed - using activeSync tracking)
   */
  private async performUserSync(userId: string, walletAddress: string, reason: string): Promise<void> {
    try {
      console.log(`🔄 Starting ${reason} sync for user ${userId}`);

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
    }
  }

  /**
   * Add triggered sync to queue
   */
  private async addToTriggerQueue(triggeredSync: TriggeredSync): Promise<void> {
    try {
      // Get current queue
      const queueData = await this.cacheService.get('sync_trigger_queue');
      const currentQueue: TriggeredSync[] = queueData && Array.isArray(queueData) ? queueData : [];
      
      // Remove any existing trigger for same user/wallet
      const filteredQueue = currentQueue.filter(item => 
        !(item.userId === triggeredSync.userId && item.walletAddress === triggeredSync.walletAddress)
      );
      
      // Add new trigger
      filteredQueue.push(triggeredSync);
      
      // Update queue in cache (5 minutes TTL)
      await this.cacheService.set('sync_trigger_queue', filteredQueue, 300);
      
    } catch (error) {
      console.error('Error adding to trigger queue:', error);
    }
  }

  /**
   * Remove triggered sync from queue
   */
  private async removeFromTriggerQueue(userId: string, walletAddress: string): Promise<void> {
    try {
      // Get current queue
      const queueData = await this.cacheService.get('sync_trigger_queue');
      if (!queueData || !Array.isArray(queueData)) return;
      
      const currentQueue: TriggeredSync[] = queueData;
      
      // Remove trigger for user/wallet
      const filteredQueue = currentQueue.filter(item => 
        !(item.userId === userId && item.walletAddress === walletAddress)
      );
      
      // Update queue in cache
      await this.cacheService.set('sync_trigger_queue', filteredQueue, 300);
      
    } catch (error) {
      console.error('Error removing from trigger queue:', error);
    }
  }

  /**
   * Get triggered syncs from cache
   */
  private async getTriggeredSyncs(): Promise<TriggeredSync[]> {
    try {
      // Get triggered sync queue from cache
      const queueData = await this.cacheService.get('sync_trigger_queue');
      
      if (!queueData) {
        return [];
      }
      
      const triggers: TriggeredSync[] = Array.isArray(queueData) 
        ? queueData 
        : [];
      
      // Filter out expired triggers (older than 5 minutes)
      const now = new Date();
      const validTriggers = triggers.filter(trigger => {
        const triggerTime = new Date(trigger.triggeredAt);
        const timeDiff = now.getTime() - triggerTime.getTime();
        return timeDiff < 5 * 60 * 1000; // 5 minutes
      });
      
      // Sort by priority (high -> normal -> low) and triggered time
      validTriggers.sort((a, b) => {
        const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime();
      });
      
      return validTriggers;
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
      // Use the helper function from the migration
      const query = `
        SELECT upsert_user_sync_status($1, $2, $3, 'portfolio', 'completed', 0, 0, 0, NULL, '{}')
      `;
      
      await this.db.query(query, [userId, walletAddress, reason]);
      
      console.log(`✅ Updated sync status for user ${userId} - reason: ${reason}`);
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

  /**
   * Get sync status for specific user
   */
  async getUserSyncStatus(userId: string, walletAddress: string): Promise<{
    userId: string;
    walletAddress: string;
    lastSyncAt: Date | null;
    syncStatus: 'current' | 'recent' | 'stale' | 'never';
    isRunning: boolean;
    activeSyncOperations: number;
    totalTokens: number;
    totalValueUsd: number;
    syncFrequency: number;
    nextScheduledSync: Date | null;
  }> {
    try {
      const lastSyncTime = await this.getLastSyncTime(userId, walletAddress);
      
      // Check if user has running sync operations
      const runningOpsQuery = `
        SELECT COUNT(*) as count
        FROM sync_operations 
        WHERE user_id = $1 AND wallet_address = $2 AND status IN ('pending', 'running')
      `;
      const runningOpsResult = await this.db.query(runningOpsQuery, [userId, walletAddress]);
      const activeSyncOperations = parseInt(runningOpsResult.rows?.[0]?.count || '0');

      // Get portfolio summary
      const portfolioQuery = `
        SELECT 
          COUNT(*) as token_count,
          COALESCE(SUM(value_usd), 0) as total_value_usd
        FROM user_token_holdings 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      const portfolioResult = await this.db.query(portfolioQuery, [userId, walletAddress]);
      const totalTokens = parseInt(portfolioResult.rows?.[0]?.token_count || '0');
      const totalValueUsd = parseFloat(portfolioResult.rows?.[0]?.total_value_usd || '0');

      // Determine sync status
      let syncStatus: 'current' | 'recent' | 'stale' | 'never' = 'never';
      if (lastSyncTime) {
        const now = new Date();
        const timeDiff = now.getTime() - lastSyncTime.getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        
        if (minutesDiff <= 5) {
          syncStatus = 'current';
        } else if (minutesDiff <= 60) {
          syncStatus = 'recent';
        } else {
          syncStatus = 'stale';
        }
      }

      // Calculate next scheduled sync (every 15 minutes for active users)
      const nextScheduledSync = lastSyncTime 
        ? new Date(lastSyncTime.getTime() + (15 * 60 * 1000))
        : new Date(Date.now() + (15 * 60 * 1000));

      return {
        userId,
        walletAddress,
        lastSyncAt: lastSyncTime,
        syncStatus,
        isRunning: activeSyncOperations > 0,
        activeSyncOperations,
        totalTokens,
        totalValueUsd,
        syncFrequency: 15, // minutes
        nextScheduledSync
      };

    } catch (error) {
      console.error('Error getting user sync status:', error);
      return {
        userId,
        walletAddress,
        lastSyncAt: null,
        syncStatus: 'never',
        isRunning: false,
        activeSyncOperations: 0,
        totalTokens: 0,
        totalValueUsd: 0,
        syncFrequency: 15,
        nextScheduledSync: null
      };
    }
  }

  /**
   * Get sync operations history for specific user
   */
  async getUserSyncOperations(userId: string, walletAddress: string, options: {
    limit?: number;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    type?: 'portfolio' | 'trades' | 'full';
    days?: number;
  } = {}): Promise<Array<{
    id: string;
    type: string;
    status: string;
    priority: string;
    startedAt: Date;
    completedAt: Date | null;
    duration: number | null;
    tokensLynced: number;
    chainsLynced: number;
    totalValueUsd: number;
    error: string | null;
    retryCount: number;
  }>> {
    try {
      const {
        limit = 20,
        status,
        type,
        days = 7
      } = options;

      let query = `
        SELECT 
          id, type, status, priority, started_at, completed_at, 
          duration_ms, tokens_synced, chains_synced, total_value_usd, 
          error, retry_count
        FROM sync_operations 
        WHERE user_id = $1 AND wallet_address = $2
      `;
      
      const params: any[] = [userId, walletAddress];
      let paramIndex = 3;

      // Add filters
      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (type) {
        query += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (days) {
        query += ` AND started_at >= NOW() - INTERVAL '${days} days'`;
      }

      query += ` ORDER BY started_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await this.db.query(query, params);
      
      return result.rows?.map((row: any) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        priority: row.priority,
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        duration: row.duration_ms,
        tokensLynced: row.tokens_synced || 0,
        chainsLynced: row.chains_synced || 0,
        totalValueUsd: parseFloat(row.total_value_usd || '0'),
        error: row.error,
        retryCount: row.retry_count || 0
      })) || [];

    } catch (error) {
      console.error('Error getting user sync operations:', error);
      return [];
    }
  }

  /**
   * Trigger bulk sync for multiple users
   */
  async triggerBulkSync(options: {
    userIds?: string[];
    walletAddresses?: string[];
    priority?: 'high' | 'normal' | 'low';
    syncType?: 'portfolio' | 'trades' | 'full';
    batchSize?: number;
  }): Promise<{
    totalRequests: number;
    successfulTriggers: number;
    failedTriggers: number;
  }> {
    try {
      const { userIds = [], walletAddresses = [], priority = 'low', syncType = 'portfolio', batchSize = 10 } = options;
      
      let totalRequests = 0;
      let successfulTriggers = 0;
      let failedTriggers = 0;
      
      // Process userIds
      if (userIds.length > 0) {
        // Get wallet addresses for userIds
        const userQuery = `
          SELECT id, wallet_address 
          FROM users 
          WHERE id = ANY($1)
        `;
        const userResult = await this.db.query(userQuery, [userIds]);
        
        for (const user of userResult.rows) {
          try {
            await this.triggerUserSync(user.id, user.wallet_address, priority);
            successfulTriggers++;
          } catch (error) {
            console.error(`Failed to trigger sync for user ${user.id}:`, error);
            failedTriggers++;
          }
          totalRequests++;
        }
      }
      
      // Process walletAddresses
      if (walletAddresses.length > 0) {
        // Get userIds for wallet addresses
        const walletQuery = `
          SELECT id, wallet_address 
          FROM users 
          WHERE wallet_address = ANY($1)
        `;
        const walletResult = await this.db.query(walletQuery, [walletAddresses]);
        
        for (const user of walletResult.rows) {
          try {
            await this.triggerUserSync(user.id, user.wallet_address, priority);
            successfulTriggers++;
          } catch (error) {
            console.error(`Failed to trigger sync for wallet ${user.wallet_address}:`, error);
            failedTriggers++;
          }
          totalRequests++;
        }
      }
      
      console.log(`📊 Bulk sync completed: ${successfulTriggers}/${totalRequests} successful`);
      
      return {
        totalRequests,
        successfulTriggers,
        failedTriggers
      };
      
    } catch (error) {
      console.error('Error in bulk sync:', error);
      throw error;
    }
  }

  /**
   * Pause sync service
   */
  async pauseService(reason?: string): Promise<{
    success: boolean;
    previousState: boolean;
    currentState: boolean;
    reason?: string;
  }> {
    try {
      const previousState = this.isRunning;
      this.isRunning = false;
      
      // Cache pause reason
      if (reason) {
        await this.cacheService.set('sync_pause_reason', reason, 3600); // 1 hour
      }

      console.log(`🔴 AutoSync service paused. Reason: ${reason || 'No reason provided'}`);
      
      return {
        success: true,
        previousState,
        currentState: this.isRunning,
        reason
      };

    } catch (error) {
      console.error('Error pausing sync service:', error);
      return {
        success: false,
        previousState: this.isRunning,
        currentState: this.isRunning
      };
    }
  }

  /**
   * Resume sync service
   */
  async resumeService(): Promise<{
    success: boolean;
    previousState: boolean;
    currentState: boolean;
    pauseReason?: string;
  }> {
    try {
      const previousState = this.isRunning;
      
      // Get pause reason if exists
      const pauseReason = await this.cacheService.get('sync_pause_reason') as string | undefined;
      
      this.isRunning = true;
      
      // Clear pause reason
      await this.cacheService.del('sync_pause_reason');

      console.log(`🟢 AutoSync service resumed. Was paused for: ${pauseReason || 'Unknown reason'}`);
      
      return {
        success: true,
        previousState,
        currentState: this.isRunning,
        pauseReason
      };

    } catch (error) {
      console.error('Error resuming sync service:', error);
      return {
        success: false,
        previousState: this.isRunning,
        currentState: this.isRunning
      };
    }
  }

  /**
   * Get detailed sync statistics
   */
  async getDetailedSyncStats(timeframe: string = '24h', breakdown: string = 'type'): Promise<{
    timeframe: string;
    breakdown: string;
    summary: {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      averageDuration: number;
      totalTokensSynced: number;
      totalValueSynced: number;
    };
    breakdownData: Array<{
      category: string;
      count: number;
      successRate: number;
      avgDuration: number;
      totalValue: number;
    }>;
    serviceStatus: {
      isRunning: boolean;
      lastProcessedAt: Date | null;
      queueLength: number;
    };
  }> {
    try {
      // Calculate time range
      const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720; // 30d = 720h
      
      // Get summary statistics
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_syncs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_syncs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
          AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE 0 END) as avg_duration,
          SUM(tokens_synced) as total_tokens_synced,
          SUM(total_value_usd) as total_value_synced
        FROM sync_operations 
        WHERE started_at >= NOW() - INTERVAL '${hours} hours'
      `;
      const summaryResult = await this.db.query(summaryQuery);
      const summary = summaryResult.rows[0];
      
      // Get breakdown data
      let breakdownQuery = '';
      if (breakdown === 'type') {
        breakdownQuery = `
          SELECT 
            type as category,
            COUNT(*) as count,
            ROUND(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
            AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE 0 END) as avg_duration,
            SUM(total_value_usd) as total_value
          FROM sync_operations 
          WHERE started_at >= NOW() - INTERVAL '${hours} hours'
          GROUP BY type
          ORDER BY count DESC
        `;
      } else if (breakdown === 'chain') {
        breakdownQuery = `
          SELECT 
            'chain_' || chains_synced as category,
            COUNT(*) as count,
            ROUND(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
            AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE 0 END) as avg_duration,
            SUM(total_value_usd) as total_value
          FROM sync_operations 
          WHERE started_at >= NOW() - INTERVAL '${hours} hours'
          GROUP BY chains_synced
          ORDER BY count DESC
        `;
      } else {
        // breakdown by user
        breakdownQuery = `
          SELECT 
            user_id as category,
            COUNT(*) as count,
            ROUND(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
            AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE 0 END) as avg_duration,
            SUM(total_value_usd) as total_value
          FROM sync_operations 
          WHERE started_at >= NOW() - INTERVAL '${hours} hours'
          GROUP BY user_id
          ORDER BY count DESC
          LIMIT 10
        `;
      }
      
      const breakdownResult = await this.db.query(breakdownQuery);
      
      // Get service status
      const queueQuery = `
        SELECT COUNT(*) as queue_length
        FROM sync_operations 
        WHERE status IN ('pending', 'running')
      `;
      const queueResult = await this.db.query(queueQuery);
      
      return {
        timeframe,
        breakdown,
        summary: {
          totalSyncs: parseInt(summary.total_syncs) || 0,
          successfulSyncs: parseInt(summary.successful_syncs) || 0,
          failedSyncs: parseInt(summary.failed_syncs) || 0,
          averageDuration: parseFloat(summary.avg_duration) || 0,
          totalTokensSynced: parseInt(summary.total_tokens_synced) || 0,
          totalValueSynced: parseFloat(summary.total_value_synced) || 0
        },
        breakdownData: breakdownResult.rows.map((row: any) => ({
          category: row.category,
          count: parseInt(row.count),
          successRate: parseFloat(row.success_rate) || 0,
          avgDuration: parseFloat(row.avg_duration) || 0,
          totalValue: parseFloat(row.total_value) || 0
        })),
        serviceStatus: {
          isRunning: this.isRunning,
          lastProcessedAt: this.lastProcessedAt || null,
          queueLength: parseInt(queueResult.rows[0].queue_length) || 0
        }
      };
      
    } catch (error) {
      console.error('Error getting detailed sync stats:', error);
      throw error;
    }
  }

  /**
   * Cancel specific sync operation
   */
  async cancelSyncOperation(operationId: string, userId: string): Promise<{
    found: boolean;
    cancelled: boolean;
    previousStatus?: string;
  }> {
    try {
      // Find the operation
      const findQuery = `
        SELECT id, status, user_id
        FROM sync_operations 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await this.db.query(findQuery, [operationId, userId]);
      
      if (result.rows.length === 0) {
        return { found: false, cancelled: false };
      }
      
      const operation = result.rows[0];
      const previousStatus = operation.status;
      
      // Can only cancel pending operations
      if (operation.status !== 'pending') {
        return { found: true, cancelled: false, previousStatus };
      }
      
      // Update status to cancelled
      const updateQuery = `
        UPDATE sync_operations 
        SET status = 'cancelled', completed_at = NOW()
        WHERE id = $1 AND user_id = $2
      `;
      await this.db.query(updateQuery, [operationId, userId]);
      
      console.log(`❌ Cancelled sync operation ${operationId} for user ${userId}`);
      
      return { found: true, cancelled: true, previousStatus };
      
    } catch (error) {
      console.error('Error cancelling sync operation:', error);
      throw error;
    }
  }
} 