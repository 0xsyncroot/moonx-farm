import { createLogger } from '@moonx-farm/common';

const logger = createLogger('PushNotificationService');

interface FCMConfig {
  firebase: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
}

interface PushNotificationData {
  tokens: string[];
  title: string;
  body: string;
  data?: any;
  priority: 'high' | 'medium' | 'low';
}

interface PushResult {
  success: boolean;
  error?: string;
  successCount: number;
  failureCount: number;
  results?: any[];
}

export class PushNotificationService {
  private config: FCMConfig;
  private fcmApp: any;

  constructor(config: FCMConfig) {
    this.config = config;
    this.initializeFCM();
  }

  private initializeFCM() {
    try {
      // Initialize Firebase Admin SDK
      // Note: In real implementation, you would use firebase-admin
      logger.info('Firebase FCM initialized for push notifications');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize Firebase FCM:', { error: errorMessage });
    }
  }

  async sendNotification(data: PushNotificationData): Promise<PushResult> {
    try {
      const { tokens, title, body, data: payload, priority } = data;
      
      // Prepare FCM message
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...payload,
          timestamp: Date.now().toString()
        },
        android: {
          priority: this.mapPriority(priority),
          notification: {
            title,
            body,
            icon: 'ic_notification',
            color: '#FF6B35'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              badge: 1,
              sound: 'default'
            }
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png'
          }
        }
      };

      // Send to multiple tokens
      const results = await Promise.allSettled(
        tokens.map(token => this.sendToToken(token, message))
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      logger.info(`Push notification sent: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending push notification:', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
        successCount: 0,
        failureCount: data.tokens.length
      };
    }
  }

  private async sendToToken(token: string, message: any): Promise<any> {
    try {
      // Simulate FCM send
      // In real implementation: await admin.messaging().send({ ...message, token })
      logger.debug(`Push notification sent to token: ${token.substring(0, 20)}...`);
      return { success: true, messageId: `msg_${Date.now()}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send push to token ${token}:`, { error: errorMessage });
      throw error;
    }
  }

  private mapPriority(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high': return 'high';
      case 'medium': return 'normal';
      case 'low': return 'normal';
      default: return 'normal';
    }
  }

  async sendBatchNotifications(notifications: PushNotificationData[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    
    for (const notification of notifications) {
      const result = await this.sendNotification(notification);
      results.push(result);
    }

    return results;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Validate FCM token
      // In real implementation: await admin.messaging().send({ token, dryRun: true })
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Invalid FCM token:', { error: errorMessage });
      return false;
    }
  }

  async getStats(): Promise<any> {
    return {
      service: 'push-notification',
      provider: 'firebase-fcm',
      projectId: this.config.firebase.projectId,
      initialized: !!this.fcmApp
    };
  }
} 