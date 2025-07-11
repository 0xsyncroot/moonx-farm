import sgMail from '@sendgrid/mail';
import { createLogger } from '@moonx-farm/common';
import {
  Notification,
  NotificationTemplate,
  UserNotificationPreferences,
  DeliveryResult,
  IChannelProvider,
  NotificationChannel
} from '../types';

const logger = createLogger('email-provider');

export class EmailProvider implements IChannelProvider {
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        logger.warn('SendGrid API key not found in environment variables');
        return;
      }

      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      
      logger.info('Email provider initialized with SendGrid');
    } catch (error) {
      logger.error('Failed to initialize Email provider', { error });
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
        throw new Error('Email provider not initialized');
      }

      if (!recipient || !this.isValidEmail(recipient)) {
        throw new Error('Invalid email address');
      }

      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@moonx.farm';
      const fromName = process.env.SENDGRID_FROM_NAME || 'MoonX Farm';

      // Prepare email message
      const emailMessage = {
        to: recipient,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: template.subjectTemplate ? 
          this.renderTemplate(template.subjectTemplate, notification) : 
          notification.title,
        text: this.renderTemplate(template.contentTemplate, notification),
        html: template.htmlTemplate ? 
          this.renderTemplate(template.htmlTemplate, notification) : 
          this.convertTextToHtml(this.renderTemplate(template.contentTemplate, notification)),
        customArgs: {
          notification_id: notification.id.toString(),
          user_id: notification.userId,
          notification_type: notification.notificationType,
          priority: notification.priority
        },
        categories: ['notification', notification.notificationType],
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: false
          },
          openTracking: {
            enable: true
          }
        }
      };

      // Send email
      const response = await sgMail.send(emailMessage);
      const messageId = (response[0] as any).headers?.['x-message-id'] || `email-${notification.id}`;
      const deliveryTime = Date.now() - startTime;

      logger.info('Email notification sent successfully', {
        notificationId: notification.id,
        userId: notification.userId,
        recipient,
        messageId,
        deliveryTime
      });

      return {
        success: true,
        channel: NotificationChannel.EMAIL,
        recipient,
        messageId,
        deliveryTime
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      logger.error('Failed to send email notification', {
        notificationId: notification.id,
        userId: notification.userId,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      });

      return {
        success: false,
        channel: NotificationChannel.EMAIL,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.isInitialized && !!process.env.SENDGRID_API_KEY;
    } catch (error) {
      logger.error('Email availability check failed', { error });
      return false;
    }
  }

  getRecipient(preferences: UserNotificationPreferences): string | null {
    return preferences.emailEnabled && preferences.emailAddress ? preferences.emailAddress : null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private renderTemplate(template: string, notification: Notification): string {
    try {
      // Simple template rendering for email (more complex rendering handled by TemplateService)
      return template
        .replace(/\{\{title\}\}/g, notification.title)
        .replace(/\{\{content\}\}/g, notification.content)
        .replace(/\{\{userId\}\}/g, notification.userId)
        .replace(/\{\{notificationType\}\}/g, notification.notificationType)
        .replace(/\{\{priority\}\}/g, notification.priority)
        .replace(/\{\{timestamp\}\}/g, notification.createdAt.toISOString())
        .replace(/\{\{appUrl\}\}/g, process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm')
        .replace(/\{\{data\}\}/g, JSON.stringify(notification.data || {}));
    } catch (error) {
      logger.warn('Template rendering failed, using fallback', { error });
      return notification.content;
    }
  }

  private convertTextToHtml(text: string): string {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  }

  async sendBatchEmails(
    notifications: Array<{
      notification: Notification;
      recipient: string;
      template: NotificationTemplate;
    }>
  ): Promise<DeliveryResult[]> {
    if (!this.isInitialized) {
      throw new Error('Email provider not initialized');
    }

    const startTime = Date.now();
    const results: DeliveryResult[] = [];

    try {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@moonx.farm';
      const fromName = process.env.SENDGRID_FROM_NAME || 'MoonX Farm';

      // Prepare batch messages
      const messages = notifications.map(({ notification, recipient, template }) => ({
        to: recipient,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: template.subjectTemplate ? 
          this.renderTemplate(template.subjectTemplate, notification) : 
          notification.title,
        text: this.renderTemplate(template.contentTemplate, notification),
        html: template.htmlTemplate ? 
          this.renderTemplate(template.htmlTemplate, notification) : 
          this.convertTextToHtml(this.renderTemplate(template.contentTemplate, notification)),
        customArgs: {
          notification_id: notification.id.toString(),
          user_id: notification.userId,
          notification_type: notification.notificationType,
          priority: notification.priority
        },
        categories: ['notification', notification.notificationType]
      }));

      // Send batch emails
      const response = await sgMail.send(messages);
      const deliveryTime = Date.now() - startTime;

      // Process responses
      response.forEach((res, index) => {
        const { notification, recipient } = notifications[index];
        const messageId = (res as any).headers?.['x-message-id'] || `email-${notification.id}`;

        results.push({
          success: true,
          channel: NotificationChannel.EMAIL,
          recipient,
          messageId,
          deliveryTime
        });
      });

      logger.info('Email batch notifications sent successfully', {
        total: notifications.length,
        successful: results.filter(r => r.success).length
      });

      return results;
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      // If batch fails, mark all as failed
      notifications.forEach(({ notification, recipient }) => {
        results.push({
          success: false,
          channel: NotificationChannel.EMAIL,
          recipient,
          error: error instanceof Error ? error.message : 'Batch send failed',
          deliveryTime
        });
      });

      logger.error('Email batch send failed', { error });
      return results;
    }
  }

  async validateEmailAddress(email: string): Promise<boolean> {
    try {
      if (!this.isValidEmail(email)) {
        return false;
      }

      // Additional validation can be added here if needed
      return true;
    } catch (error) {
      logger.debug('Email validation failed', { email, error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Email provider cleanup completed');
    } catch (error) {
      logger.error('Error during email provider cleanup', { error });
    }
  }
} 