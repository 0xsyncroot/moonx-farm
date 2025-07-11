import axios from 'axios';
import { createLogger } from '@moonx-farm/common';
import {
  Notification,
  NotificationTemplate,
  UserNotificationPreferences,
  DeliveryResult,
  IChannelProvider,
  NotificationChannel
} from '../types';

const logger = createLogger('telegram-provider');

interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>>;
}

export class TelegramProvider implements IChannelProvider {
  private botToken: string | null = null;
  private baseUrl: string = '';
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        logger.warn('Telegram bot token not found in environment variables');
        return;
      }

      this.botToken = botToken;
      this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
      
      // Test bot connection
      await this.testConnection();
      this.isInitialized = true;
      
      logger.info('Telegram provider initialized');
    } catch (error) {
      logger.error('Failed to initialize Telegram provider', { error });
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      if (response.data.ok) {
        logger.info('Telegram bot connection verified', { 
          botUsername: response.data.result.username 
        });
      } else {
        throw new Error('Invalid bot token');
      }
    } catch (error) {
      throw new Error(`Telegram bot connection failed: ${error}`);
    }
  }

  async send(
    notification: Notification,
    recipient: string,
    template: NotificationTemplate
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized || !this.botToken) {
        throw new Error('Telegram provider not initialized');
      }

      if (!recipient || !this.isValidChatId(recipient)) {
        throw new Error('Invalid Telegram chat ID');
      }

      // Prepare message content
      const message = this.formatMessage(notification, template);

      // Send message
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: recipient,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        disable_notification: notification.priority === 'low',
        reply_markup: this.createInlineKeyboard(notification)
      });

      const deliveryTime = Date.now() - startTime;

      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        
        logger.info('Telegram notification sent successfully', {
          notificationId: notification.id,
          userId: notification.userId,
          chatId: recipient,
          messageId,
          deliveryTime
        });

        return {
          success: true,
          channel: NotificationChannel.TELEGRAM,
          recipient,
          messageId: messageId.toString(),
          deliveryTime
        };
      } else {
        throw new Error(response.data.description || 'Failed to send message');
      }
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      logger.error('Failed to send Telegram notification', {
        notificationId: notification.id,
        userId: notification.userId,
        chatId: recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      });

      return {
        success: false,
        channel: NotificationChannel.TELEGRAM,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.isInitialized && !!this.botToken;
    } catch (error) {
      logger.error('Telegram availability check failed', { error });
      return false;
    }
  }

  getRecipient(preferences: UserNotificationPreferences): string | null {
    return preferences.telegramEnabled && preferences.telegramChatId ? 
      preferences.telegramChatId : null;
  }

  private isValidChatId(chatId: string): boolean {
    // Telegram chat IDs can be negative numbers for groups/channels
    return /^-?\d+$/.test(chatId);
  }

  private formatMessage(notification: Notification, template: NotificationTemplate): string {
    try {
      let message = this.renderTemplate(template.contentTemplate, notification);
      
      // Add priority indicator
      const priorityEmoji = this.getPriorityEmoji(notification.priority);
      message = `${priorityEmoji} ${message}`;

      // Add notification type context
      const typeEmoji = this.getTypeEmoji(notification.notificationType);
      message = `${typeEmoji} ${message}`;

      // Add timestamp
      const timestamp = new Date(notification.createdAt).toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      message += `\n\n<i>📅 ${timestamp} UTC</i>`;

      return message;
    } catch (error) {
      logger.warn('Message formatting failed, using fallback', { error });
      return `🔔 ${notification.title}\n\n${notification.content}`;
    }
  }

  private renderTemplate(template: string, notification: Notification): string {
    try {
      return template
        .replace(/\{\{title\}\}/g, notification.title)
        .replace(/\{\{content\}\}/g, notification.content)
        .replace(/\{\{userId\}\}/g, notification.userId)
        .replace(/\{\{notificationType\}\}/g, notification.notificationType)
        .replace(/\{\{priority\}\}/g, notification.priority)
        .replace(/\{\{timestamp\}\}/g, notification.createdAt.toISOString())
        .replace(/\{\{appUrl\}\}/g, process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm')
        .replace(/\{\{data\}\}/g, JSON.stringify(notification.data || {}))
        // HTML formatting for Telegram
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```(.*?)```/gs, '<pre>$1</pre>');
    } catch (error) {
      logger.warn('Template rendering failed, using fallback', { error });
      return notification.content;
    }
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'normal': return '🔔';
      case 'low': return '🔕';
      default: return '🔔';
    }
  }

  private getTypeEmoji(notificationType: string): string {
    switch (notificationType) {
      case 'trading': return '💰';
      case 'price_alert': return '📈';
      case 'portfolio': return '📊';
      case 'security': return '🔒';
      case 'system': return '⚙️';
      default: return '📢';
    }
  }

  private createInlineKeyboard(notification: Notification): TelegramInlineKeyboard {
    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: []
    };

    // Add "View Details" button for app redirection
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm';
    keyboard.inline_keyboard.push([
      {
        text: '🔗 View Details',
        url: `${appUrl}/notifications/${notification.id}`
      }
    ]);

    // Add type-specific buttons
    if (notification.notificationType === 'trading' && notification.data?.explorerUrl) {
      keyboard.inline_keyboard.push([
        {
          text: '🔍 View on Explorer',
          url: notification.data.explorerUrl
        }
      ]);
    }

    return keyboard;
  }

  async sendBatchNotifications(
    notifications: Array<{
      notification: Notification;
      recipient: string;
      template: NotificationTemplate;
    }>
  ): Promise<DeliveryResult[]> {
    if (!this.isInitialized) {
      throw new Error('Telegram provider not initialized');
    }

    const results: DeliveryResult[] = [];
    const startTime = Date.now();

    try {
      // Telegram doesn't have native batch sending, so we'll use concurrent requests
      const promises = notifications.map(async ({ notification, recipient, template }) => {
        return this.send(notification, recipient, template);
      });

      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const { notification, recipient } = notifications[index];
          results.push({
            success: false,
            channel: NotificationChannel.TELEGRAM,
            recipient,
            error: result.reason?.message || 'Batch send failed',
            deliveryTime: Date.now() - startTime
          });
        }
      });

      logger.info('Telegram batch notifications completed', {
        total: notifications.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      logger.error('Telegram batch send failed', { error });
      throw error;
    }
  }

  async validateChatId(chatId: string): Promise<boolean> {
    try {
      if (!this.isValidChatId(chatId)) {
        return false;
      }

      // Test send a message to validate chat ID
      const response = await axios.post(`${this.baseUrl}/getChat`, {
        chat_id: chatId
      });

      return response.data.ok;
    } catch (error) {
      logger.debug('Telegram chat ID validation failed', { chatId, error });
      return false;
    }
  }

  async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Telegram provider not initialized');
      }

      const response = await axios.post(`${this.baseUrl}/setWebhook`, {
        url: webhookUrl,
        drop_pending_updates: true
      });

      if (response.data.ok) {
        logger.info('Telegram webhook set successfully', { webhookUrl });
        return true;
      } else {
        logger.error('Failed to set Telegram webhook', { error: response.data.description });
        return false;
      }
    } catch (error) {
      logger.error('Failed to set Telegram webhook', { error });
      return false;
    }
  }

  async deleteWebhook(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Telegram provider not initialized');
      }

      const response = await axios.post(`${this.baseUrl}/deleteWebhook`);

      if (response.data.ok) {
        logger.info('Telegram webhook deleted successfully');
        return true;
      } else {
        logger.error('Failed to delete Telegram webhook', { error: response.data.description });
        return false;
      }
    } catch (error) {
      logger.error('Failed to delete Telegram webhook', { error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Telegram provider cleanup completed');
    } catch (error) {
      logger.error('Error during Telegram provider cleanup', { error });
    }
  }
} 