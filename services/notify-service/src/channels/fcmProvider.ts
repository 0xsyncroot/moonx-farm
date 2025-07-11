import * as admin from 'firebase-admin';
import { createLogger } from '@moonx-farm/common';
import type {
  Notification,
  NotificationTemplate,
  UserNotificationPreferences,
  DeliveryResult,
  IChannelProvider
} from '../types';

const logger = createLogger('fcm-provider');

export class FCMProvider implements IChannelProvider {
  private app: admin.app.App | null = null;
  private messaging: admin.messaging.Messaging | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Check if required environment variables are present
      const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        logger.warn('Missing Firebase environment variables', { missingVars });
        return;
      }

      // Parse the private key (handle escaped newlines)
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token'
      };

      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } else {
        this.app = admin.apps[0] as admin.app.App;
      }

      this.messaging = admin.messaging(this.app);
      this.isInitialized = true;

      logger.info('FCM provider initialized', { 
        projectId: process.env.FIREBASE_PROJECT_ID 
      });
    } catch (error) {
      logger.error('Failed to initialize FCM provider', { error });
    }
  }

  async send(
    notification: Notification,
    recipient: string,
    template: NotificationTemplate
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized || !this.messaging) {
        throw new Error('FCM provider not initialized');
      }

      if (!recipient || !this.isValidFCMToken(recipient)) {
        throw new Error('Invalid FCM token');
      }

      // Prepare FCM message
      const message: admin.messaging.Message = {
        token: recipient,
        notification: {
          title: template.subjectTemplate ? 
            this.renderTemplate(template.subjectTemplate, notification) : 
            notification.title,
          body: this.renderTemplate(template.contentTemplate, notification),
        },
        data: {
          notificationId: notification.id.toString(),
          userId: notification.userId,
          notificationType: notification.notificationType,
          priority: notification.priority,
          timestamp: notification.createdAt.toISOString(),
          ...(notification.data && this.convertToStringData(notification.data))
        },
        android: {
          priority: this.getAndroidPriority(notification.priority),
          notification: {
            channelId: this.getNotificationChannelId(notification.notificationType),
            priority: this.getAndroidNotificationPriority(notification.priority),
            sound: notification.priority === 'urgent' ? 'urgent' : 'default',
            tag: `moonx_${notification.notificationType}`,
            color: this.getNotificationColor(notification.notificationType),
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: notification.priority === 'urgent' ? 'urgent.caf' : 'default',
              badge: 1,
              'content-available': 1,
              category: notification.notificationType
            }
          },
          headers: {
            'apns-priority': notification.priority === 'urgent' ? '10' : '5',
            'apns-push-type': 'alert'
          }
        },
        webpush: {
          headers: {
            'TTL': '3600' // 1 hour TTL for web push
          },
          notification: {
            icon: '/icons/notification-icon.png',
            badge: '/icons/badge-icon.png',
            tag: `moonx_${notification.id}`,
            requireInteraction: notification.priority === 'urgent',
            renotify: true
          }
        }
      };

      // Send the message
      const response = await this.messaging.send(message);
      const deliveryTime = Date.now() - startTime;

      logger.info('FCM notification sent successfully', {
        notificationId: notification.id,
        userId: notification.userId,
        messageId: response,
        deliveryTime
      });

      return {
        success: true,
        channel: 'fcm' as any,
        recipient,
        messageId: response,
        deliveryTime
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      logger.error('Failed to send FCM notification', {
        notificationId: notification.id,
        userId: notification.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      });

      return {
        success: false,
        channel: 'fcm' as any,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.messaging) {
        return false;
      }

      // Test connection by getting the app instance
      const app = this.messaging.app;
      return app != null;
    } catch (error) {
      logger.error('FCM availability check failed', { error });
      return false;
    }
  }

  getRecipient(preferences: UserNotificationPreferences): string | null {
    return preferences.fcmEnabled && preferences.fcmToken ? preferences.fcmToken : null;
  }

  private isValidFCMToken(token: string): boolean {
    // FCM tokens are typically 163+ characters long
    return token.length > 100 && /^[A-Za-z0-9_:-]+$/.test(token);
  }

  private renderTemplate(template: string, notification: Notification): string {
    try {
      // Simple template rendering for FCM (more complex rendering handled by TemplateService)
      return template
        .replace(/\{\{title\}\}/g, notification.title)
        .replace(/\{\{content\}\}/g, notification.content)
        .replace(/\{\{userId\}\}/g, notification.userId)
        .replace(/\{\{notificationType\}\}/g, notification.notificationType);
    } catch (error) {
      logger.warn('Template rendering failed, using fallback', { error });
      return notification.content;
    }
  }

  private convertToStringData(data: Record<string, any>): Record<string, string> {
    const stringData: Record<string, string> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    });

    return stringData;
  }

  private getAndroidPriority(priority: string): 'normal' | 'high' {
    return priority === 'urgent' || priority === 'high' ? 'high' : 'normal';
  }

  private getAndroidNotificationPriority(priority: string): 'default' | 'high' | 'low' | 'max' | 'min' {
    switch (priority) {
      case 'urgent': return 'max';
      case 'high': return 'high';
      case 'low': return 'low';
      default: return 'default';
    }
  }

  private getNotificationChannelId(notificationType: string): string {
    switch (notificationType) {
      case 'trading': return 'trading_notifications';
      case 'price_alert': return 'price_alert_notifications';
      case 'portfolio': return 'portfolio_notifications';
      case 'security': return 'security_notifications';
      case 'system': return 'system_notifications';
      default: return 'default_notifications';
    }
  }

  private getNotificationColor(notificationType: string): string {
    switch (notificationType) {
      case 'trading': return '#00C851'; // Green
      case 'price_alert': return '#FF8800'; // Orange
      case 'portfolio': return '#007BFF'; // Blue
      case 'security': return '#FF4444'; // Red
      case 'system': return '#6C757D'; // Gray
      default: return '#007BFF'; // Blue
    }
  }

  async sendBatchNotifications(
    notifications: Array<{
      notification: Notification;
      recipient: string;
      template: NotificationTemplate;
    }>
  ): Promise<DeliveryResult[]> {
    if (!this.isInitialized || !this.messaging) {
      throw new Error('FCM provider not initialized');
    }

    const startTime = Date.now();
    const results: DeliveryResult[] = [];

    try {
      // Prepare batch messages
      const messages: admin.messaging.Message[] = notifications.map(({ notification, recipient, template }) => ({
        token: recipient,
        notification: {
          title: template.subjectTemplate ? 
            this.renderTemplate(template.subjectTemplate, notification) : 
            notification.title,
          body: this.renderTemplate(template.contentTemplate, notification),
        },
        data: {
          notificationId: notification.id.toString(),
          userId: notification.userId,
          notificationType: notification.notificationType,
          priority: notification.priority,
          timestamp: notification.createdAt.toISOString(),
          ...(notification.data && this.convertToStringData(notification.data))
        }
      }));

      // Send batch (FCM allows up to 500 messages per batch)
      const batchSize = 500;
      const batches: admin.messaging.Message[][] = [];
      
      for (let i = 0; i < messages.length; i += batchSize) {
        batches.push(messages.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          const response = await this.messaging.sendAll(batch);
          
          response.responses.forEach((result, index) => {
            const originalIndex = batches.indexOf(batch) * batchSize + index;
            const { notification, recipient } = notifications[originalIndex];
            
            if (result.success) {
              results.push({
                success: true,
                channel: 'fcm' as any,
                recipient,
                messageId: result.messageId,
                deliveryTime: Date.now() - startTime
              });
            } else {
              results.push({
                success: false,
                channel: 'fcm' as any,
                recipient,
                error: result.error?.message || 'Unknown error',
                deliveryTime: Date.now() - startTime
              });
            }
          });
        } catch (error) {
          // If batch fails, mark all as failed
          const startIndex = batches.indexOf(batch) * batchSize;
          const endIndex = Math.min(startIndex + batchSize, notifications.length);
          
          for (let i = startIndex; i < endIndex; i++) {
            results.push({
              success: false,
              channel: 'fcm' as any,
              recipient: notifications[i].recipient,
              error: error instanceof Error ? error.message : 'Batch send failed',
              deliveryTime: Date.now() - startTime
            });
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info('FCM batch notifications completed', {
        total: notifications.length,
        successful: successCount,
        failed: notifications.length - successCount
      });

      return results;
    } catch (error) {
      logger.error('FCM batch send failed', { error });
      throw error;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.messaging) {
        return false;
      }

      if (!this.isValidFCMToken(token)) {
        return false;
      }

      // Test send a data-only message to validate token
      await this.messaging.send({
        token,
        data: { test: 'validation' }
      }, true); // Dry run

      return true;
    } catch (error) {
      logger.debug('FCM token validation failed', { token: token.substring(0, 10) + '...', error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.app) {
        // Firebase app cleanup is typically handled automatically
        logger.info('FCM provider cleanup completed');
      }
    } catch (error) {
      logger.error('Error during FCM provider cleanup', { error });
    }
  }
} 