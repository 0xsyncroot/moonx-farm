import { 
  DatabaseManager, 
  createDatabaseConfig, 
  createDatabase 
} from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';
import type {
  UserNotificationPreferences,
  NotificationTemplate,
  Notification,
  NotificationDelivery,
  NotificationQueue,
  NotificationMetrics,
  CreateNotificationRequest,
  UpdatePreferencesRequest,
  LinkTelegramRequest,
  NotificationChannel,
  NotificationType,
  DeliveryStatus,
  NotificationPriority
} from '../types';

const logger = createLogger('notify-db');

export class DatabaseService {
  private db: DatabaseManager;

  constructor() {
    const config = createDatabaseConfig();
    this.db = createDatabase(config);
  }

  async initialize(): Promise<void> {
    await this.db.connect();
    logger.info('Database service initialized');
  }

  async shutdown(): Promise<void> {
    await this.db.disconnect();
    logger.info('Database service shutdown');
  }

  // ==================== User Preferences ====================
  async getUserPreferences(userId: string): Promise<UserNotificationPreferences | null> {
    const result = await this.db.query<UserNotificationPreferences>(
      `SELECT * FROM user_notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async createUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    const result = await this.db.query<UserNotificationPreferences>(
      `INSERT INTO user_notification_preferences (user_id, websocket_enabled, fcm_enabled, email_enabled, telegram_enabled, preferences)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, true, true, false, false, '{}']
    );
    
    logger.info('Created user preferences', { userId });
    return result.rows[0];
  }

  async updateUserPreferences(
    userId: string, 
    updates: UpdatePreferencesRequest
  ): Promise<UserNotificationPreferences> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic SET clause
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setParts.push(`${dbKey} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (setParts.length === 0) {
      throw new Error('No valid updates provided');
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await this.db.query<UserNotificationPreferences>(
      `UPDATE user_notification_preferences 
       SET ${setParts.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('User preferences not found');
    }

    logger.info('Updated user preferences', { userId, updates });
    return result.rows[0];
  }

  async linkTelegram(userId: string, telegramData: LinkTelegramRequest): Promise<void> {
    await this.db.query(
      `UPDATE user_notification_preferences 
       SET telegram_chat_id = $1, telegram_username = $2, telegram_enabled = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [telegramData.telegramChatId, telegramData.telegramUsername, true, userId]
    );

    logger.info('Linked Telegram account', { userId, telegramChatId: telegramData.telegramChatId });
  }

  async unlinkTelegram(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_notification_preferences 
       SET telegram_chat_id = NULL, telegram_username = NULL, telegram_enabled = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    logger.info('Unlinked Telegram account', { userId });
  }

  // ==================== Notifications ====================
  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    const result = await this.db.query<Notification>(
      `INSERT INTO notifications (user_id, notification_type, template_key, title, content, data, priority, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.userId,
        request.notificationType,
        request.templateKey,
        request.title,
        request.content,
        JSON.stringify(request.data || {}),
        request.priority || 'normal',
        request.expiresAt
      ]
    );

    logger.info('Created notification', { 
      notificationId: result.rows[0].id, 
      userId: request.userId, 
      type: request.notificationType 
    });
    
    return result.rows[0];
  }

  async getNotification(notificationId: number): Promise<Notification | null> {
    const result = await this.db.query<Notification>(
      `SELECT * FROM notifications WHERE id = $1`,
      [notificationId]
    );
    return result.rows[0] || null;
  }

  async getUserNotifications(
    userId: string,
    filters: {
      type?: NotificationType;
      isRead?: boolean;
      priority?: NotificationPriority;
      fromDate?: Date;
      toDate?: Date;
    },
    pagination: { page: number; limit: number }
  ): Promise<{ notifications: Notification[]; total: number }> {
    const whereClauses = ['user_id = $1'];
    const values: any[] = [userId];
    let paramIndex = 2;

    // Add filters
    if (filters.type) {
      whereClauses.push(`notification_type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters.isRead !== undefined) {
      whereClauses.push(`is_read = $${paramIndex++}`);
      values.push(filters.isRead);
    }

    if (filters.priority) {
      whereClauses.push(`priority = $${paramIndex++}`);
      values.push(filters.priority);
    }

    if (filters.fromDate) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      values.push(filters.fromDate);
    }

    if (filters.toDate) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      values.push(filters.toDate);
    }

    // Clean up expired notifications
    whereClauses.push(`(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`);

    const whereClause = whereClauses.join(' AND ');
    const offset = (pagination.page - 1) * pagination.limit;

    // Get total count
    const countResult = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
      values
    );

    // Get notifications
    const result = await this.db.query<Notification>(
      `SELECT * FROM notifications 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pagination.limit, offset]
    );

    return {
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count.toString())
    };
  }

  async markAsRead(notificationId: number, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    logger.info('Marked notification as read', { notificationId, userId });
  }

  async deleteNotification(notificationId: number, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    logger.info('Deleted notification', { notificationId, userId });
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      `DELETE FROM notifications 
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    );

    const count = result.rows.length;
    if (count > 0) {
      logger.info('Cleaned up expired notifications', { count });
    }

    return count;
  }

  // ==================== Templates ====================
  async getTemplate(templateKey: string, channel: NotificationChannel): Promise<NotificationTemplate | null> {
    const result = await this.db.query<NotificationTemplate>(
      `SELECT * FROM notification_templates 
       WHERE template_key = $1 AND channel = $2 AND is_active = true`,
      [templateKey, channel]
    );
    return result.rows[0] || null;
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    const result = await this.db.query<NotificationTemplate>(
      `SELECT * FROM notification_templates WHERE is_active = true ORDER BY template_key, channel`
    );
    return result.rows;
  }

  // ==================== Delivery Tracking ====================
  async createDeliveryAttempt(
    notificationId: number,
    channel: NotificationChannel,
    recipient?: string
  ): Promise<NotificationDelivery> {
    const result = await this.db.query<NotificationDelivery>(
      `INSERT INTO notification_deliveries (notification_id, channel, status, recipient)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [notificationId, channel, 'pending', recipient]
    );

    return result.rows[0];
  }

  async updateDeliveryStatus(
    deliveryId: number,
    status: DeliveryStatus,
    responseData?: Record<string, any>,
    failureReason?: string
  ): Promise<void> {
    const now = new Date();
    let statusField = '';
    
    switch (status) {
      case 'sent':
        statusField = 'sent_at = $3';
        break;
      case 'delivered':
        statusField = 'delivered_at = $3';
        break;
      case 'failed':
        statusField = 'failed_at = $3';
        break;
      default:
        statusField = 'updated_at = $3';
    }

    await this.db.query(
      `UPDATE notification_deliveries 
       SET status = $1, ${statusField}, response_data = $4, failure_reason = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [status, deliveryId, now, JSON.stringify(responseData || {}), failureReason]
    );
  }

  async getDeliveryAttempts(notificationId: number): Promise<NotificationDelivery[]> {
    const result = await this.db.query<NotificationDelivery>(
      `SELECT * FROM notification_deliveries 
       WHERE notification_id = $1 
       ORDER BY created_at DESC`,
      [notificationId]
    );
    return result.rows;
  }

  async getFailedDeliveries(maxRetries: number = 3): Promise<NotificationDelivery[]> {
    const result = await this.db.query<NotificationDelivery>(
      `SELECT * FROM notification_deliveries 
       WHERE status = 'failed' 
       AND retry_count < $1 
       AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
       ORDER BY created_at ASC
       LIMIT 100`,
      [maxRetries]
    );
    return result.rows;
  }

  async incrementRetryCount(deliveryId: number, nextRetryAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE notification_deliveries 
       SET retry_count = retry_count + 1, next_retry_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [nextRetryAt, deliveryId]
    );
  }

  // ==================== Queue Management ====================
  async addToQueue(
    notificationId: number,
    channel: NotificationChannel,
    priority: number = 0,
    scheduledAt?: Date
  ): Promise<NotificationQueue> {
    const result = await this.db.query<NotificationQueue>(
      `INSERT INTO notification_queue (notification_id, channel, priority, scheduled_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [notificationId, channel, priority, scheduledAt || new Date()]
    );

    return result.rows[0];
  }

  async getQueuedNotifications(
    channel?: NotificationChannel,
    limit: number = 50
  ): Promise<NotificationQueue[]> {
    const whereClause = channel ? 'WHERE channel = $1' : '';
    const values: any[] = channel ? [channel] : [];
    const limitParam = channel ? '$2' : '$1';
    
    if (channel) {
      values.push(limit);
    } else {
      values.push(limit);
    }

    const result = await this.db.query<NotificationQueue>(
      `SELECT * FROM notification_queue 
       ${whereClause}
       AND processing_at IS NULL 
       AND scheduled_at <= CURRENT_TIMESTAMP
       ORDER BY priority DESC, scheduled_at ASC
       LIMIT ${limitParam}`,
      values
    );

    return result.rows;
  }

  async markQueueItemAsProcessing(queueId: number): Promise<void> {
    await this.db.query(
      `UPDATE notification_queue 
       SET processing_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [queueId]
    );
  }

  async markQueueItemAsProcessed(queueId: number): Promise<void> {
    await this.db.query(
      `UPDATE notification_queue 
       SET processed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [queueId]
    );
  }

  async markQueueItemAsFailed(queueId: number, failureReason: string): Promise<void> {
    await this.db.query(
      `UPDATE notification_queue 
       SET failed_at = CURRENT_TIMESTAMP, failure_reason = $1, retry_count = retry_count + 1
       WHERE id = $2`,
      [failureReason, queueId]
    );
  }

  // ==================== Metrics ====================
  async updateMetrics(
    date: Date,
    channel: NotificationChannel,
    notificationType: NotificationType,
    metrics: {
      totalSent?: number;
      totalDelivered?: number;
      totalFailed?: number;
      avgDeliveryTimeMs?: number;
    }
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_metrics (date, channel, notification_type, total_sent, total_delivered, total_failed, avg_delivery_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (date, channel, notification_type)
       DO UPDATE SET
         total_sent = notification_metrics.total_sent + EXCLUDED.total_sent,
         total_delivered = notification_metrics.total_delivered + EXCLUDED.total_delivered,
         total_failed = notification_metrics.total_failed + EXCLUDED.total_failed,
         avg_delivery_time_ms = (notification_metrics.avg_delivery_time_ms + EXCLUDED.avg_delivery_time_ms) / 2,
         updated_at = CURRENT_TIMESTAMP`,
      [
        date.toISOString().split('T')[0],
        channel,
        notificationType,
        metrics.totalSent || 0,
        metrics.totalDelivered || 0,
        metrics.totalFailed || 0,
        metrics.avgDeliveryTimeMs || 0
      ]
    );
  }

  async getMetrics(
    fromDate: Date,
    toDate: Date,
    channel?: NotificationChannel,
    notificationType?: NotificationType
  ): Promise<NotificationMetrics[]> {
    const whereClauses = ['date >= $1', 'date <= $2'];
    const values: any[] = [fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0]];
    let paramIndex = 3;

    if (channel) {
      whereClauses.push(`channel = $${paramIndex++}`);
      values.push(channel);
    }

    if (notificationType) {
      whereClauses.push(`notification_type = $${paramIndex++}`);
      values.push(notificationType);
    }

    const result = await this.db.query<NotificationMetrics>(
      `SELECT * FROM notification_metrics 
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY date DESC, channel, notification_type`,
      values
    );

    return result.rows;
  }

  // ==================== Health Check ====================
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }
} 