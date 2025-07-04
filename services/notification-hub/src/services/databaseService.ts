import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export class DatabaseService {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.initializePool();
  }

  private initializePool() {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT NOW()');
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Database disconnection error:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  // Notification operations
  async saveNotification(notification: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
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
      logger.error(`Error saving notification ${notification.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateNotificationStatus(notificationId: string, status: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE notifications SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, notificationId]
      );
    } catch (error) {
      logger.error(`Error updating notification status ${notificationId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getScheduledNotifications(): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM notifications 
         WHERE status = 'scheduled' 
         AND (metadata->>'scheduledAt')::timestamp <= NOW()
         ORDER BY (metadata->>'scheduledAt')::timestamp ASC
         LIMIT 100`
      );
      
      return result.rows.map(row => ({
        ...row,
        channels: JSON.parse(row.channels),
        data: JSON.parse(row.data),
        metadata: JSON.parse(row.metadata)
      }));
    } catch (error) {
      logger.error('Error getting scheduled notifications:', error);
      return [];
    } finally {
      client.release();
    }
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT preferences FROM user_preferences WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].preferences);
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting user preferences for ${userId}:`, error);
      return null;
    } finally {
      client.release();
    }
  }

  // Price alerts
  async getPriceAlerts(symbol: string, currentPrice: number): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM price_alerts 
         WHERE symbol = $1 
         AND is_active = true 
         AND ((direction = 'above' AND target_price <= $2) 
              OR (direction = 'below' AND target_price >= $2))`,
        [symbol, currentPrice]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting price alerts for ${symbol}:`, error);
      return [];
    } finally {
      client.release();
    }
  }

  // User filtering
  async getUsersByFilters(filters: any): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT id, email, phone FROM users WHERE 1=1';
      const params: any[] = [];
      
      if (filters.vip) {
        query += ' AND is_vip = true';
      }
      
      if (filters.active) {
        query += ' AND last_login_at > NOW() - INTERVAL \'30 days\'';
      }
      
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting users by filters:', error);
      return [];
    } finally {
      client.release();
    }
  }

  // Analytics data
  async getNotificationStats(period: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const interval = period === '24h' ? '1 day' : '7 days';
      
      const result = await client.query(
        `SELECT 
           COUNT(*) as total_notifications,
           COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
           COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
           AVG(CASE WHEN status = 'delivered' THEN 
             EXTRACT(EPOCH FROM (updated_at - created_at)) END) as avg_delivery_time
         FROM notifications 
         WHERE created_at >= NOW() - INTERVAL '${interval}'`,
        []
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {};
    } finally {
      client.release();
    }
  }

  // Database schema initialization
  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create notifications table
      await client.query(`
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
          expires_at TIMESTAMP WITH TIME ZONE,
          INDEX (user_id),
          INDEX (type),
          INDEX (status),
          INDEX (created_at)
        )
      `);

      // Create user preferences table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id VARCHAR(255) PRIMARY KEY,
          preferences JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create price alerts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS price_alerts (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          target_price DECIMAL(20,8) NOT NULL,
          direction VARCHAR(10) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          INDEX (user_id),
          INDEX (symbol),
          INDEX (is_active)
        )
      `);

      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Error initializing database schema:', error);
    } finally {
      client.release();
    }
  }
} 