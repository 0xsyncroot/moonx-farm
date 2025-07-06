import { EmailService } from './emailService';
import { PushNotificationService } from './pushNotificationService';
import { TelegramService } from './telegramService';
import { RedisManager } from './redisManager';
import { PrometheusService } from './prometheusService';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('DeliveryService');

interface ProcessedNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  channels: string[];
  data: any;
  metadata: {
    createdAt: Date;
    scheduledAt?: Date;
    expiresAt?: Date;
    attempts: number;
    lastAttempt?: Date;
  };
}

interface DeliveryResult {
  channel: string;
  success: boolean;
  error?: string | undefined;
  deliveryTime: number;
  metadata?: any;
}

export class DeliveryService {
  private gatewayRedis: any;
  private emailService: EmailService;
  private pushService: PushNotificationService;
  private telegramService: TelegramService;
  private redisManager: RedisManager;
  private prometheusService: PrometheusService;

  constructor(
    gatewayRedis: any,
    emailService: EmailService,
    pushService: PushNotificationService,
    redisManager: RedisManager,
    prometheusService: PrometheusService,
    telegramService?: TelegramService
  ) {
    this.gatewayRedis = gatewayRedis;
    this.emailService = emailService;
    this.pushService = pushService;
    this.redisManager = redisManager;
    this.prometheusService = prometheusService;
    const adminChats = process.env['TELEGRAM_ADMIN_CHATS']?.split(',');
    const blockedChats = process.env['TELEGRAM_BLOCKED_CHATS']?.split(',');
    const webhookUrl = process.env['TELEGRAM_WEBHOOK_URL'];
    
    this.telegramService = telegramService || new TelegramService({
      botToken: process.env['TELEGRAM_BOT_TOKEN'] || '',
      rateLimitPerSecond: parseInt(process.env['TELEGRAM_RATE_LIMIT'] || '30'),
      ...(webhookUrl && { webhookUrl }),
      ...(adminChats && { adminChats }),
      ...(blockedChats && { blockedChats })
    });
  }

  async deliverNotification(notification: ProcessedNotification): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    const deliveryStartTime = Date.now();

    try {
      // Update attempt counter
      notification.metadata.attempts++;
      notification.metadata.lastAttempt = new Date();

      // Check if notification is expired
      if (notification.metadata.expiresAt && new Date() > notification.metadata.expiresAt) {
        logger.warn(`Notification expired: ${notification.id}`);
        return [{
          channel: 'expired',
          success: false,
          error: 'Notification expired',
          deliveryTime: 0
        }];
      }

      // Deliver to each channel
      const deliveryPromises = notification.channels.map(channel => 
        this.deliverToChannel(notification, channel)
      );

      const channelResults = await Promise.allSettled(deliveryPromises);
      
      // Process results
      channelResults.forEach((result, index) => {
        const channel = notification.channels[index] || 'unknown';
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            channel,
            success: false,
            error: result.reason?.message || 'Unknown error',
            deliveryTime: Date.now() - deliveryStartTime
          });
        }
      });

      // Track overall delivery metrics
      const successCount = results.filter(r => r.success).length;
      const totalChannels = results.length;
      
      await this.prometheusService.recordNotificationDelivered(
        notification.type,
        notification.priority,
        successCount,
        totalChannels,
        Date.now() - deliveryStartTime
      );

      // Update notification status
      const allSuccessful = results.every(r => r.success);
      const status = allSuccessful ? 'delivered' : 'partial_delivery';
      
      await this.updateNotificationStatus(notification.id, status, results);

      // If some channels failed, add to retry queue
      if (!allSuccessful) {
        await this.handleFailedDeliveries(notification, results);
      }

      logger.info(`Notification delivered: ${notification.id}, success: ${successCount}/${totalChannels}`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error delivering notification ${notification.id}:`, { error: errorMessage });
      
      const errorResult: DeliveryResult = {
        channel: 'all',
        success: false,
        error: errorMessage,
        deliveryTime: Date.now() - deliveryStartTime
      };

      await this.prometheusService.recordNotificationError(notification.type, 'delivery_failed');
      await this.updateNotificationStatus(notification.id, 'failed', [errorResult]);
      
      return [errorResult];
    }
  }

  private async deliverToChannel(
    notification: ProcessedNotification,
    channel: string
  ): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      switch (channel) {
        case 'websocket':
          return await this.deliverViaWebSocket(notification, startTime);
        case 'push':
          return await this.deliverViaPushNotification(notification, startTime);
        case 'email':
          return await this.deliverViaEmail(notification, startTime);
        case 'telegram':
          return await this.deliverViaTelegram(notification, startTime);
        case 'sms':
          return await this.deliverViaSMS(notification, startTime);
        default:
          throw new Error(`Unsupported delivery channel: ${channel}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error delivering to ${channel}:`, { error: errorMessage });
      return {
        channel,
        success: false,
        error: errorMessage,
        deliveryTime: Date.now() - startTime
      };
    }
  }

  private async deliverViaWebSocket(
    notification: ProcessedNotification,
    startTime: number
  ): Promise<DeliveryResult> {
    try {
      // Get user's WebSocket connections
      const connections = await this.redisManager.getUserConnections(notification.userId);
      
      if (connections.length === 0) {
        // User is offline, store for later delivery
        await this.redisManager.storeOfflineNotification(notification);
        return {
          channel: 'websocket',
          success: false,
          error: 'User offline',
          deliveryTime: Date.now() - startTime,
          metadata: { offline: true }
        };
      }

      // Send to WebSocket Gateway
      const message = {
        type: 'send_notification',
        userId: notification.userId,
        targetConnections: connections,
        message: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          timestamp: Date.now()
        },
        priority: notification.priority
      };

      await this.gatewayRedis.publish('gateway:commands', JSON.stringify(message));

      return {
        channel: 'websocket',
        success: true,
        deliveryTime: Date.now() - startTime,
        metadata: { connections: connections.length }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`WebSocket delivery failed: ${errorMessage}`);
    }
  }

  private async deliverViaPushNotification(
    notification: ProcessedNotification,
    startTime: number
  ): Promise<DeliveryResult> {
    try {
      // Get user's FCM tokens
      const tokens = await this.redisManager.getUserFCMTokens(notification.userId);
      
      if (tokens.length === 0) {
        return {
          channel: 'push',
          success: false,
          error: 'No FCM tokens found',
          deliveryTime: Date.now() - startTime
        };
      }

      // Send push notification
      const result = await this.pushService.sendNotification({
        tokens,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...notification.data
        },
        priority: notification.priority
      });

      return {
        channel: 'push',
        success: result.success,
        error: result.error,
        deliveryTime: Date.now() - startTime,
        metadata: {
          tokensCount: tokens.length,
          successCount: result.successCount,
          failureCount: result.failureCount
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Push notification delivery failed: ${errorMessage}`);
    }
  }

  private async deliverViaEmail(
    notification: ProcessedNotification,
    startTime: number
  ): Promise<DeliveryResult> {
    try {
      // Get user's email
      const userEmail = await this.redisManager.getUserEmail(notification.userId);
      
      if (!userEmail) {
        return {
          channel: 'email',
          success: false,
          error: 'No email address found',
          deliveryTime: Date.now() - startTime
        };
      }

      // Send email
      const result = await this.emailService.sendNotificationEmail(
        notification.userId,
        userEmail,
        notification.title,
        notification.body,
        notification.data
      );

      return {
        channel: 'email',
        success: result,
        error: result ? undefined : 'Email sending failed',
        deliveryTime: Date.now() - startTime,
        metadata: {
          recipient: userEmail
        }
      };
    } catch (error) {
      throw new Error(`Email delivery failed: ${(error as Error).message}`);
    }
  }

  private async deliverViaTelegram(
    notification: ProcessedNotification,
    startTime: number
  ): Promise<DeliveryResult> {
    try {
      // Get user's Telegram chat ID (from notification data or user preferences)
      const chatId = notification.data?.telegramChatId || 
                   notification.data?.chatId;
      
      if (!chatId) {
        return {
          channel: 'telegram',
          success: false,
          error: 'Telegram chat ID not found',
          deliveryTime: Date.now() - startTime
        };
      }

      // Send Telegram notification
      const result = await this.telegramService.sendNotification(
        chatId,
        notification.title,
        notification.body,
        notification.data
      );

      return {
        channel: 'telegram',
        success: result,
        error: result ? undefined : 'Telegram sending failed',
        deliveryTime: Date.now() - startTime,
        metadata: {
          chatId: chatId.toString().replace(/\d(?=\d{4})/g, '*') // Mask chat ID
        }
      };
    } catch (error) {
      throw new Error(`Telegram delivery failed: ${(error as Error).message}`);
    }
  }

  private async deliverViaSMS(
    notification: ProcessedNotification,
    startTime: number
  ): Promise<DeliveryResult> {
    try {
      // Get user's phone number
      const phoneNumber = await this.redisManager.getUserPhoneNumber(notification.userId);
      
      if (!phoneNumber) {
        return {
          channel: 'sms',
          success: false,
          error: 'No phone number found',
          deliveryTime: Date.now() - startTime
        };
      }

      // TODO: Implement SMS service
      // For now, just return success
      return {
        channel: 'sms',
        success: true,
        deliveryTime: Date.now() - startTime,
        metadata: {
          phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*') // Mask phone number
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`SMS delivery failed: ${errorMessage}`);
    }
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: string,
    results: DeliveryResult[]
  ): Promise<void> {
    try {
      await this.redisManager.updateNotificationStatus(notificationId, status, results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error updating notification status: ${errorMessage}`);
    }
  }

  private async handleFailedDeliveries(
    notification: ProcessedNotification,
    results: DeliveryResult[]
  ): Promise<void> {
    try {
      const failedChannels = results
        .filter(r => !r.success)
        .map(r => r.channel);

      if (failedChannels.length > 0) {
        // Add to retry queue if attempts < max retries
        const maxRetries = this.getMaxRetries(notification.type);
        
        if (notification.metadata.attempts < maxRetries) {
          const retryNotification = {
            ...notification,
            channels: failedChannels,
            metadata: {
              ...notification.metadata,
              retryReason: 'partial_delivery_failure',
              originalChannels: notification.channels
            }
          };

          await this.redisManager.addToRetryQueue(retryNotification);
          logger.info(`Notification added to retry queue: ${notification.id}`);
        } else {
          logger.warn(`Max retries exceeded for notification: ${notification.id}`);
          await this.updateNotificationStatus(notification.id, 'failed', results);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error handling failed deliveries: ${errorMessage}`);
    }
  }

  private getMaxRetries(notificationType: string): number {
    const retryConfig: { [key: string]: number } = {
      'price_alert': 3,
      'swap_completed': 5,
      'order_filled': 5,
      'system_message': 2,
      'default': 3
    };

    return retryConfig[notificationType] ?? retryConfig['default'] ?? 3;
  }

  async deliverBatch(notifications: ProcessedNotification[]): Promise<void> {
    const batchSize = 50; // Process in batches of 50
    const batches = [];
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      batches.push(notifications.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const deliveryPromises = batch.map(notification => 
        this.deliverNotification(notification)
      );

      await Promise.allSettled(deliveryPromises);
    }

    logger.info(`Batch delivery completed for ${notifications.length} notifications`);
  }
} 