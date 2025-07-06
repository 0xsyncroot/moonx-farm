import { 
  DatabaseManager, 
  createDatabaseConfig,
  createDatabase
} from '@moonx-farm/infrastructure';
import { createLogger, LogContext } from '@moonx-farm/common';

const logger = createLogger('notification-hub-database');

// Helper function to format errors for logging
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper function to create log context
function createLogContext(additionalContext: Record<string, any> = {}): LogContext {
  return {
    service: 'notification-hub-database',
    ...additionalContext
  };
}

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  channels: string;
  data: string;
  metadata: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

interface UserPreferencesRecord {
  user_id: string;
  preferences: string;
}

interface PriceAlertRecord {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  direction: string;
  is_active: boolean;
  created_at: Date;
}

interface NotificationStats {
  total_notifications: number;
  delivered: number;
  failed: number;
  high_priority: number;
  avg_delivery_time: number;
}

export class DatabaseService {
  private db: DatabaseManager;

  constructor() {
    const config = createDatabaseConfig();
    this.db = createDatabase(config);
  }

  async initialize(): Promise<void> {
    await this.db.connect();
    await this.initializeSchema();
    logger.info('Database service initialized successfully');
  }

  async shutdown(): Promise<void> {
    await this.db.disconnect();
    logger.info('Database service shut down');
  }

  async healthCheck(): Promise<boolean> {
    return await this.db.healthCheck();
  }

  getDB(): DatabaseManager {
    return this.db;
  }

  // Notification operations
  async saveNotification(notification: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO notifications (id, user_id, type, title, body, priority, channels, data, metadata, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          notification.id,
          notification.userId,
          notification.type,
          notification.title,
          notification.body,
          notification.priority,
          JSON.stringify(notification.channels),
          JSON.stringify(notification.data),
          JSON.stringify(notification.metadata),
          notification.metadata.createdAt,
          notification.metadata.expiresAt
        ]
      );
    } catch (error) {
      logger.error(`Error saving notification ${notification.id}`, createLogContext({ 
        error: formatError(error), 
        notificationId: notification.id 
      }));
      throw error;
    }
  }

  async updateNotificationStatus(notificationId: string, status: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE notifications SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, notificationId]
      );
    } catch (error) {
      logger.error(`Error updating notification status ${notificationId}`, createLogContext({ 
        error: formatError(error), 
        notificationId 
      }));
      throw error;
    }
  }

  async getScheduledNotifications(): Promise<any[]> {
    try {
      const result = await this.db.query<NotificationRecord>(
        `SELECT * FROM notifications 
         WHERE status = 'scheduled' 
         AND (metadata->>'scheduledAt')::timestamp <= NOW()
         ORDER BY (metadata->>'scheduledAt')::timestamp ASC
         LIMIT 100`
      );
      
      return result.rows.map((row: NotificationRecord) => ({
        ...row,
        channels: JSON.parse(row.channels),
        data: JSON.parse(row.data),
        metadata: JSON.parse(row.metadata)
      }));
    } catch (error) {
      logger.error('Error getting scheduled notifications', createLogContext({ 
        error: formatError(error) 
      }));
      return [];
    }
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<any> {
    try {
      const result = await this.db.query<UserPreferencesRecord>(
        `SELECT preferences FROM user_preferences WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0]?.preferences || '{}');
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting user preferences for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId 
      }));
      return null;
    }
  }

  async updateUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO user_preferences (user_id, preferences, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (user_id) 
         DO UPDATE SET preferences = $2, updated_at = NOW()`,
        [userId, JSON.stringify(preferences)]
      );
    } catch (error) {
      logger.error(`Error updating user preferences for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId 
      }));
      throw error;
    }
  }

  // Price alerts
  async getPriceAlerts(symbol: string, currentPrice: number): Promise<PriceAlertRecord[]> {
    try {
      const result = await this.db.query<PriceAlertRecord>(
        `SELECT * FROM price_alerts 
         WHERE symbol = $1 
         AND is_active = true 
         AND ((direction = 'above' AND target_price <= $2) 
              OR (direction = 'below' AND target_price >= $2))`,
        [symbol, currentPrice]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting price alerts for ${symbol}`, createLogContext({ 
        error: formatError(error), 
        symbol 
      }));
      return [];
    }
  }

  async createPriceAlert(userId: string, symbol: string, targetPrice: number, direction: string): Promise<string> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO price_alerts (id, user_id, symbol, target_price, direction, is_active, created_at) 
         VALUES ($1, $2, $3, $4, $5, true, NOW())`,
        [alertId, userId, symbol, targetPrice, direction]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating price alert for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId, 
        symbol 
      }));
      throw error;
    }
  }

  async deactivatePriceAlert(alertId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE price_alerts SET is_active = false WHERE id = $1`,
        [alertId]
      );
    } catch (error) {
      logger.error(`Error deactivating price alert ${alertId}`, createLogContext({ 
        error: formatError(error), 
        alertId 
      }));
      throw error;
    }
  }

  // User filtering
  async getUsersByFilters(filters: any): Promise<any[]> {
    try {
      let query = 'SELECT id, email, phone FROM users WHERE 1=1';
      const params: any[] = [];
      
      if (filters.vip) {
        query += ' AND is_vip = true';
      }
      
      if (filters.active) {
        query += ' AND last_login_at > NOW() - INTERVAL \'30 days\'';
      }
      
      if (filters.roles && filters.roles.length > 0) {
        query += ' AND role = ANY($' + (params.length + 1) + ')';
        params.push(filters.roles);
      }
      
      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting users by filters', createLogContext({ 
        error: formatError(error), 
        filters 
      }));
      return [];
    }
  }

  // Analytics data
  async getNotificationStats(period: string): Promise<NotificationStats> {
    try {
      const interval = period === '24h' ? '1 day' : '7 days';
      
      const result = await this.db.query<NotificationStats>(
        `SELECT 
           COUNT(*)::int as total_notifications,
           COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int as delivered,
           COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed,
           COUNT(CASE WHEN priority = 'high' THEN 1 END)::int as high_priority,
           COALESCE(AVG(CASE WHEN status = 'delivered' THEN 
             EXTRACT(EPOCH FROM (updated_at - created_at)) END), 0)::float as avg_delivery_time
         FROM notifications 
         WHERE created_at >= NOW() - INTERVAL '${interval}'`
      );
      
      return result.rows[0] || {
        total_notifications: 0,
        delivered: 0,
        failed: 0,
        high_priority: 0,
        avg_delivery_time: 0
      };
    } catch (error) {
      logger.error('Error getting notification stats', createLogContext({ 
        error: formatError(error), 
        period 
      }));
      return {
        total_notifications: 0,
        delivered: 0,
        failed: 0,
        high_priority: 0,
        avg_delivery_time: 0
      };
    }
  }

  // Retry operations
  async getFailedNotifications(limit: number = 100): Promise<any[]> {
    try {
      const result = await this.db.query<NotificationRecord>(
        `SELECT * FROM notifications 
         WHERE status = 'failed' 
         AND (metadata->>'retryCount')::int < 3
         ORDER BY created_at ASC 
         LIMIT $1`,
        [limit]
      );
      
      return result.rows.map((row: NotificationRecord) => ({
        ...row,
        channels: JSON.parse(row.channels),
        data: JSON.parse(row.data),
        metadata: JSON.parse(row.metadata)
      }));
    } catch (error) {
      logger.error('Error getting failed notifications', createLogContext({ 
        error: formatError(error), 
        limit 
      }));
      return [];
    }
  }

  // Database schema initialization
  async initializeSchema(): Promise<void> {
    try {
      // Create notifications table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          priority VARCHAR(20) NOT NULL,
          channels JSONB NOT NULL,
          data JSONB,
          metadata JSONB,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Create indexes for notifications
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)
      `);

      // Create user preferences table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id VARCHAR(255) PRIMARY KEY,
          preferences JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create price alerts table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS price_alerts (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          target_price DECIMAL(20,8) NOT NULL,
          direction VARCHAR(10) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes for price alerts
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts(symbol)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active)
      `);

      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Error initializing database schema', createLogContext({ 
        error: formatError(error) 
      }));
      throw error;
    }
  }

  // Transaction support
  async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return await this.db.transaction(callback);
  }

  // =================================================================
  // VOLUME ALERTS METHODS
  // =================================================================

  async createVolumeAlert(alert: {
    userId: string;
    symbol: string;
    baseToken: string;
    quoteToken: string;
    volumeThreshold: number;
    volumeType?: string;
    timeframe?: string;
    condition?: string;
    baselineVolume?: number;
    spikeMultiplier?: number;
    isRepeating?: boolean;
  }): Promise<string> {
    try {
      const alertId = `vol_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO volume_alerts (id, user_id, symbol, base_token, quote_token, volume_threshold, 
         volume_type, timeframe, condition, baseline_volume, spike_multiplier, is_repeating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          alertId,
          alert.userId,
          alert.symbol,
          alert.baseToken,
          alert.quoteToken,
          alert.volumeThreshold,
          alert.volumeType || 'usd',
          alert.timeframe || '1h',
          alert.condition || 'above',
          alert.baselineVolume,
          alert.spikeMultiplier || 2.0,
          alert.isRepeating || false
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating volume alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        symbol: alert.symbol 
      }));
      throw error;
    }
  }

  async getActiveVolumeAlerts(): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM volume_alerts WHERE is_active = true ORDER BY created_at ASC`
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting active volume alerts', createLogContext({ 
        error: formatError(error) 
      }));
      return [];
    }
  }

  async updateVolumeAlertTrigger(alertId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE volume_alerts 
         SET triggered_count = triggered_count + 1, last_triggered_at = NOW()
         WHERE id = $1`,
        [alertId]
      );
    } catch (error) {
      logger.error(`Error updating volume alert trigger ${alertId}`, createLogContext({ 
        error: formatError(error), 
        alertId 
      }));
      throw error;
    }
  }

  // =================================================================
  // WALLET TRACKING METHODS
  // =================================================================

  async createTrackedWallet(wallet: {
    userId: string;
    walletAddress: string;
    walletLabel?: string;
    walletType?: string;
    trackingSettings?: any;
    notificationSettings?: any;
  }): Promise<string> {
    try {
      const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO tracked_wallets (id, user_id, wallet_address, wallet_label, wallet_type, 
         tracking_settings, notification_settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          walletId,
          wallet.userId,
          wallet.walletAddress,
          wallet.walletLabel || 'Unnamed Wallet',
          wallet.walletType || 'unknown',
          JSON.stringify(wallet.trackingSettings || {}),
          JSON.stringify(wallet.notificationSettings || {})
        ]
      );
      
      return walletId;
    } catch (error) {
      logger.error(`Error creating tracked wallet for ${wallet.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: wallet.userId, 
        walletAddress: wallet.walletAddress 
      }));
      throw error;
    }
  }

  async getTrackedWallets(userId: string): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM tracked_wallets WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
        [userId]
      );
      
      return result.rows.map(row => ({
        ...row,
        tracking_settings: JSON.parse(row.tracking_settings),
        notification_settings: JSON.parse(row.notification_settings)
      }));
    } catch (error) {
      logger.error(`Error getting tracked wallets for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId 
      }));
      return [];
    }
  }

  async getAllTrackedWallets(): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM tracked_wallets WHERE is_active = true ORDER BY user_id, created_at DESC`
      );
      
      return result.rows.map(row => ({
        ...row,
        tracking_settings: JSON.parse(row.tracking_settings),
        notification_settings: JSON.parse(row.notification_settings)
      }));
    } catch (error) {
      logger.error('Error getting all tracked wallets', createLogContext({ 
        error: formatError(error) 
      }));
      return [];
    }
  }

  async deleteTrackedWallet(walletId: string, userId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE tracked_wallets SET is_active = false WHERE id = $1 AND user_id = $2`,
        [walletId, userId]
      );
    } catch (error) {
      logger.error(`Error deleting tracked wallet ${walletId}`, createLogContext({ 
        error: formatError(error), 
        walletId, 
        userId 
      }));
      throw error;
    }
  }

  // =================================================================
  // WHALE ALERTS METHODS
  // =================================================================

  async createWhaleAlert(alert: {
    userId: string;
    symbol: string;
    tokenAddress: string;
    minValueUsd: number;
    transactionTypes?: string[];
    excludeKnownAddresses?: string[];
  }): Promise<string> {
    try {
      const alertId = `whale_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO whale_alerts (id, user_id, symbol, token_address, min_value_usd, 
         transaction_types, exclude_known_addresses)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          alertId,
          alert.userId,
          alert.symbol,
          alert.tokenAddress,
          alert.minValueUsd,
          JSON.stringify(alert.transactionTypes || ['swap', 'transfer']),
          JSON.stringify(alert.excludeKnownAddresses || [])
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating whale alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        symbol: alert.symbol 
      }));
      throw error;
    }
  }

  async getActiveWhaleAlerts(): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM whale_alerts WHERE is_active = true ORDER BY min_value_usd DESC`
      );
      
      return result.rows.map(row => ({
        ...row,
        transaction_types: JSON.parse(row.transaction_types),
        exclude_known_addresses: JSON.parse(row.exclude_known_addresses)
      }));
    } catch (error) {
      logger.error('Error getting active whale alerts', createLogContext({ 
        error: formatError(error) 
      }));
      return [];
    }
  }

  // =================================================================
  // LIQUIDITY ALERTS METHODS
  // =================================================================

  async createLiquidityAlert(alert: {
    userId: string;
    poolAddress: string;
    poolSymbol: string;
    dexName: string;
    alertType: string;
    thresholdSettings: any;
  }): Promise<string> {
    try {
      const alertId = `liq_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO liquidity_alerts (id, user_id, pool_address, pool_symbol, dex_name, 
         alert_type, threshold_settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          alertId,
          alert.userId,
          alert.poolAddress,
          alert.poolSymbol,
          alert.dexName,
          alert.alertType,
          JSON.stringify(alert.thresholdSettings)
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating liquidity alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        poolSymbol: alert.poolSymbol 
      }));
      throw error;
    }
  }

  // =================================================================
  // PORTFOLIO MONITORING METHODS
  // =================================================================

  async createPortfolioAlert(alert: {
    userId: string;
    walletAddress: string;
    alertType: string;
    thresholdSettings: any;
    notificationFrequency?: string;
  }): Promise<string> {
    try {
      const alertId = `portfolio_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO portfolio_alerts (id, user_id, wallet_address, alert_type, 
         threshold_settings, notification_frequency)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          alertId,
          alert.userId,
          alert.walletAddress,
          alert.alertType,
          JSON.stringify(alert.thresholdSettings),
          alert.notificationFrequency || 'immediate'
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating portfolio alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        alertType: alert.alertType 
      }));
      throw error;
    }
  }

  // =================================================================
  // POSITION HEALTH MONITORING METHODS
  // =================================================================

  async createPositionHealthAlert(alert: {
    userId: string;
    protocol: string;
    walletAddress: string;
    positionId?: string;
    healthFactorThreshold?: number;
    collateralRatioThreshold?: number;
    alertLevels?: any[];
  }): Promise<string> {
    try {
      const alertId = `health_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO position_health_alerts (id, user_id, protocol, wallet_address, position_id,
         health_factor_threshold, collateral_ratio_threshold, alert_levels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          alertId,
          alert.userId,
          alert.protocol,
          alert.walletAddress,
          alert.positionId,
          alert.healthFactorThreshold || 1.1,
          alert.collateralRatioThreshold,
          JSON.stringify(alert.alertLevels || [])
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating position health alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        protocol: alert.protocol 
      }));
      throw error;
    }
  }

  async getActivePositionHealthAlerts(): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM position_health_alerts WHERE is_active = true ORDER BY health_factor_threshold ASC`
      );
      
      return result.rows.map(row => ({
        ...row,
        alert_levels: JSON.parse(row.alert_levels)
      }));
    } catch (error) {
      logger.error('Error getting active position health alerts', createLogContext({ 
        error: formatError(error) 
      }));
      return [];
    }
  }

  // =================================================================
  // SECURITY ALERTS METHODS
  // =================================================================

  async createSecurityAlert(alert: {
    userId: string;
    alertType: string;
    monitoredAddresses?: string[];
    riskThreshold?: string;
    autoNotifications?: boolean;
  }): Promise<string> {
    try {
      const alertId = `security_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(
        `INSERT INTO security_alerts (id, user_id, alert_type, monitored_addresses, 
         risk_threshold, auto_notifications)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          alertId,
          alert.userId,
          alert.alertType,
          JSON.stringify(alert.monitoredAddresses || []),
          alert.riskThreshold || 'medium',
          alert.autoNotifications !== false
        ]
      );
      
      return alertId;
    } catch (error) {
      logger.error(`Error creating security alert for ${alert.userId}`, createLogContext({ 
        error: formatError(error), 
        userId: alert.userId, 
        alertType: alert.alertType 
      }));
      throw error;
    }
  }

  // =================================================================
  // ANALYTICS & REPORTING METHODS
  // =================================================================

  async updateDeliveryLog(deliveryLog: {
    notificationId: string;
    channel: string;
    deliveryStatus: string;
    attemptCount?: number;
    providerResponse?: any;
    deliveryTimeMs?: number;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO notification_delivery_log (notification_id, channel, delivery_status, 
         attempt_count, provider_response, delivery_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          deliveryLog.notificationId,
          deliveryLog.channel,
          deliveryLog.deliveryStatus,
          deliveryLog.attemptCount || 1,
          JSON.stringify(deliveryLog.providerResponse || {}),
          deliveryLog.deliveryTimeMs
        ]
      );
    } catch (error) {
      logger.error(`Error updating delivery log for ${deliveryLog.notificationId}`, createLogContext({ 
        error: formatError(error), 
        notificationId: deliveryLog.notificationId,
        channel: deliveryLog.channel 
      }));
      throw error;
    }
  }

  async getUserEngagementMetrics(userId: string, days: number = 30): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
           SUM(notifications_received) as total_received,
           SUM(notifications_clicked) as total_clicked,
           SUM(notifications_dismissed) as total_dismissed,
           AVG(engagement_score) as avg_engagement_score
         FROM user_engagement_metrics 
         WHERE user_id = $1 
         AND date_bucket >= CURRENT_DATE - INTERVAL '${days} days'`,
        [userId]
      );
      
      return result.rows[0] || {
        total_received: 0,
        total_clicked: 0,
        total_dismissed: 0,
        avg_engagement_score: 0
      };
    } catch (error) {
      logger.error(`Error getting engagement metrics for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId 
      }));
      return {};
    }
  }

  async checkRateLimit(userId: string, notificationType: string, channel: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT current_count, limit_count, time_window_minutes, window_start
         FROM rate_limits 
         WHERE user_id = $1 AND notification_type = $2 AND channel = $3`,
        [userId, notificationType, channel]
      );
      
      if (result.rows.length === 0) {
        // No rate limit set, allow
        return true;
      }
      
      const rateLimit = result.rows[0];
      const windowStart = new Date(rateLimit.window_start);
      const now = new Date();
      const windowAge = (now.getTime() - windowStart.getTime()) / (1000 * 60); // minutes
      
      // Reset window if expired
      if (windowAge >= rateLimit.time_window_minutes) {
        await this.db.query(
          `UPDATE rate_limits 
           SET current_count = 1, window_start = NOW() 
           WHERE user_id = $1 AND notification_type = $2 AND channel = $3`,
          [userId, notificationType, channel]
        );
        return true;
      }
      
      // Check if within limit
      if (rateLimit.current_count < rateLimit.limit_count) {
        await this.db.query(
          `UPDATE rate_limits 
           SET current_count = current_count + 1 
           WHERE user_id = $1 AND notification_type = $2 AND channel = $3`,
          [userId, notificationType, channel]
        );
        return true;
      }
      
      return false; // Rate limit exceeded
    } catch (error) {
      logger.error(`Error checking rate limit for ${userId}`, createLogContext({ 
        error: formatError(error), 
        userId, 
        notificationType, 
        channel 
      }));
      return true; // Allow on error
    }
  }

  // =================================================================
  // NOTIFICATION TEMPLATE METHODS
  // =================================================================

  async getNotificationTemplate(type: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT * FROM notification_templates WHERE type = $1 AND is_active = true`,
        [type]
      );
      
      if (result.rows.length > 0) {
        const template = result.rows[0];
        return {
          ...template,
          variables: JSON.parse(template.variables),
          default_channels: JSON.parse(template.default_channels)
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting notification template for ${type}`, createLogContext({ 
        error: formatError(error), 
        type 
      }));
      return null;
    }
  }

  // =================================================================
  // BULK OPERATIONS
  // =================================================================

  async bulkCreateNotifications(notifications: any[]): Promise<string[]> {
    try {
      const notificationIds: string[] = [];
      
      await this.withTransaction(async (tx) => {
        for (const notification of notifications) {
          const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          notificationIds.push(id);
          
          await tx.query(
            `INSERT INTO notifications (id, user_id, type, title, body, priority, channels, data, metadata, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              id,
              notification.userId,
              notification.type,
              notification.title,
              notification.body,
              notification.priority || 'medium',
              JSON.stringify(notification.channels || ['websocket']),
              JSON.stringify(notification.data || {}),
              JSON.stringify(notification.metadata || {}),
              notification.expiresAt
            ]
          );
        }
      });
      
      return notificationIds;
    } catch (error) {
      logger.error(`Error bulk creating notifications`, createLogContext({ 
        error: formatError(error), 
        count: notifications.length 
      }));
      throw error;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 