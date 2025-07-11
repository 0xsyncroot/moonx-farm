import { createLogger } from '@moonx-farm/common';
import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';
import type {
  Notification,
  NotificationTemplate,
  UserNotificationPreferences,
  DeliveryResult,
  IChannelProvider
} from '../types';

const logger = createLogger('websocket-provider');

export class WebSocketProvider implements IChannelProvider {
  private kafkaProducer: any;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const kafkaConfig = createKafkaConfig();
      const kafka = createKafka(kafkaConfig);
      this.kafkaProducer = await kafka.createProducer('websocket-provider');
      this.isInitialized = true;
      
      logger.info('WebSocket provider initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket provider', { error });
    }
  }

  async send(
    notification: Notification,
    recipient: string,
    template: NotificationTemplate
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        throw new Error('WebSocket provider not initialized');
      }

      // Prepare WebSocket message
      const message = {
        type: 'notification',
        id: notification.id,
        userId: notification.userId,
        notificationType: notification.notificationType,
        title: notification.title,
        content: notification.content,
        data: notification.data,
        priority: notification.priority,
        timestamp: notification.createdAt,
        expiresAt: notification.expiresAt
      };

      // Publish to WebSocket topic via Kafka
      await this.kafkaProducer.publish(message, {
        topic: 'websocket.notifications',
        key: notification.userId,
        headers: {
          'notification-id': notification.id.toString(),
          'user-id': notification.userId,
          'priority': notification.priority
        }
      });

      const deliveryTime = Date.now() - startTime;

      logger.info('WebSocket notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
        deliveryTime
      });

      return {
        success: true,
        channel: 'websocket' as any,
        recipient,
        messageId: `ws-${notification.id}`,
        deliveryTime
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      logger.error('Failed to send WebSocket notification', {
        notificationId: notification.id,
        userId: notification.userId,
        error,
        deliveryTime
      });

      return {
        success: false,
        channel: 'websocket' as any,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.isInitialized && this.kafkaProducer != null;
    } catch (error) {
      logger.error('WebSocket availability check failed', { error });
      return false;
    }
  }

  getRecipient(preferences: UserNotificationPreferences): string | null {
    // WebSocket doesn't need a specific recipient address
    // The userId is used as the routing key
    return preferences.websocketEnabled ? preferences.userId : null;
  }

  async publishToWebSocketTopic(
    userId: string,
    notificationData: any,
    priority: string = 'normal'
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('WebSocket provider not initialized');
      }

      await this.kafkaProducer.publish(notificationData, {
        topic: 'websocket.notifications',
        key: userId,
        headers: {
          'user-id': userId,
          'priority': priority,
          'timestamp': Date.now().toString()
        }
      });

      logger.debug('Published to WebSocket topic', { userId, priority });
    } catch (error) {
      logger.error('Failed to publish to WebSocket topic', { userId, error });
      throw error;
    }
  }

  async publishBroadcast(
    notificationData: any,
    userIds?: string[]
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('WebSocket provider not initialized');
      }

      if (userIds && userIds.length > 0) {
        // Send to specific users
        const promises = userIds.map(userId =>
          this.kafkaProducer.publish(notificationData, {
            topic: 'websocket.notifications',
            key: userId,
            headers: {
              'user-id': userId,
              'broadcast': 'targeted',
              'timestamp': Date.now().toString()
            }
          })
        );

        await Promise.all(promises);
        logger.info('Broadcast notification sent to specific users', { userCount: userIds.length });
      } else {
        // Global broadcast
        await this.kafkaProducer.publish(notificationData, {
          topic: 'websocket.broadcast',
          key: 'global',
          headers: {
            'broadcast': 'global',
            'timestamp': Date.now().toString()
          }
        });

        logger.info('Global broadcast notification sent');
      }
    } catch (error) {
      logger.error('Failed to publish broadcast notification', { error });
      throw error;
    }
  }

  async publishSystemNotification(
    notificationData: {
      type: 'maintenance' | 'update' | 'announcement';
      title: string;
      content: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('WebSocket provider not initialized');
      }

      const message = {
        ...notificationData,
        messageType: 'system',
        timestamp: new Date().toISOString(),
        id: `system-${Date.now()}`
      };

      await this.kafkaProducer.publish(message, {
        topic: 'websocket.system',
        key: 'system',
        headers: {
          'notification-type': notificationData.type,
          'priority': 'high',
          'timestamp': Date.now().toString()
        }
      });

      logger.info('System notification published', { type: notificationData.type });
    } catch (error) {
      logger.error('Failed to publish system notification', { error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.kafkaProducer) {
        // Kafka cleanup would be handled by the Kafka manager
        logger.info('WebSocket provider cleanup completed');
      }
    } catch (error) {
      logger.error('Error during WebSocket provider cleanup', { error });
    }
  }
} 