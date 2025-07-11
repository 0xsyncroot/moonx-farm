import { createLogger } from '@moonx-farm/common';
import { DatabaseService } from './databaseService';
import {
  UserNotificationPreferences,
  UpdatePreferencesRequest,
  LinkTelegramRequest,
  IPreferencesService
} from '../types';

const logger = createLogger('preferences-service');

export class PreferencesService implements IPreferencesService {
  private db: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.db = databaseService;
  }

  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    try {
      let preferences = await this.db.getUserPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist
        preferences = await this.db.createUserPreferences(userId);
        logger.info('Created default preferences for user', { userId });
      }

      return preferences;
    } catch (error) {
      logger.error('Failed to get user preferences', { error, userId });
      throw error;
    }
  }

  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesRequest
  ): Promise<UserNotificationPreferences> {
    try {
      // Validate updates
      this.validatePreferencesUpdate(updates);

      // Ensure user preferences exist
      await this.getUserPreferences(userId);

      // Update preferences
      const updatedPreferences = await this.db.updateUserPreferences(userId, updates);
      
      logger.info('Updated user preferences', { 
        userId, 
        updates: this.sanitizeLogData(updates)
      });

      return updatedPreferences;
    } catch (error) {
      logger.error('Failed to update preferences', { error, userId, updates });
      throw error;
    }
  }

  async linkTelegram(userId: string, telegramData: LinkTelegramRequest): Promise<void> {
    try {
      // Validate Telegram data
      this.validateTelegramData(telegramData);

      // Update preferences to link Telegram
      await this.db.linkTelegram(userId, telegramData);
      
      logger.info('Linked Telegram account', { 
        userId, 
        telegramChatId: telegramData.telegramChatId,
        telegramUsername: telegramData.telegramUsername
      });
    } catch (error) {
      logger.error('Failed to link Telegram', { error, userId, telegramData });
      throw error;
    }
  }

  async unlinkTelegram(userId: string): Promise<void> {
    try {
      await this.db.unlinkTelegram(userId);
      logger.info('Unlinked Telegram account', { userId });
    } catch (error) {
      logger.error('Failed to unlink Telegram', { error, userId });
      throw error;
    }
  }

  async enableChannel(userId: string, channel: string): Promise<UserNotificationPreferences> {
    try {
      const updates: UpdatePreferencesRequest = {};
      
      switch (channel) {
        case 'websocket':
          updates.websocketEnabled = true;
          break;
        case 'fcm':
          updates.fcmEnabled = true;
          break;
        case 'email':
          updates.emailEnabled = true;
          break;
        case 'telegram':
          updates.telegramEnabled = true;
          break;
        default:
          throw new Error(`Invalid channel: ${channel}`);
      }

      return await this.updatePreferences(userId, updates);
    } catch (error) {
      logger.error('Failed to enable channel', { error, userId, channel });
      throw error;
    }
  }

  async disableChannel(userId: string, channel: string): Promise<UserNotificationPreferences> {
    try {
      const updates: UpdatePreferencesRequest = {};
      
      switch (channel) {
        case 'websocket':
          updates.websocketEnabled = false;
          break;
        case 'fcm':
          updates.fcmEnabled = false;
          break;
        case 'email':
          updates.emailEnabled = false;
          break;
        case 'telegram':
          updates.telegramEnabled = false;
          break;
        default:
          throw new Error(`Invalid channel: ${channel}`);
      }

      return await this.updatePreferences(userId, updates);
    } catch (error) {
      logger.error('Failed to disable channel', { error, userId, channel });
      throw error;
    }
  }

  async updateFCMToken(userId: string, fcmToken: string): Promise<UserNotificationPreferences> {
    try {
      if (!fcmToken || fcmToken.trim().length === 0) {
        throw new Error('Invalid FCM token');
      }

      const updates: UpdatePreferencesRequest = {
        fcmToken: fcmToken.trim()
      };

      return await this.updatePreferences(userId, updates);
    } catch (error) {
      logger.error('Failed to update FCM token', { error, userId });
      throw error;
    }
  }

  async updateEmailAddress(userId: string, emailAddress: string): Promise<UserNotificationPreferences> {
    try {
      if (!this.isValidEmail(emailAddress)) {
        throw new Error('Invalid email address');
      }

      const updates: UpdatePreferencesRequest = {
        emailAddress: emailAddress.trim().toLowerCase()
      };

      return await this.updatePreferences(userId, updates);
    } catch (error) {
      logger.error('Failed to update email address', { error, userId });
      throw error;
    }
  }

  async getChannelStatuses(userId: string): Promise<{
    websocket: { enabled: boolean; configured: boolean };
    fcm: { enabled: boolean; configured: boolean };
    email: { enabled: boolean; configured: boolean };
    telegram: { enabled: boolean; configured: boolean };
  }> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      return {
        websocket: {
          enabled: preferences.websocketEnabled,
          configured: true // WebSocket doesn't need special configuration
        },
        fcm: {
          enabled: preferences.fcmEnabled,
          configured: !!preferences.fcmToken
        },
        email: {
          enabled: preferences.emailEnabled,
          configured: !!preferences.emailAddress
        },
        telegram: {
          enabled: preferences.telegramEnabled,
          configured: !!preferences.telegramChatId
        }
      };
    } catch (error) {
      logger.error('Failed to get channel statuses', { error, userId });
      throw error;
    }
  }

  async bulkUpdatePreferences(
    userUpdates: Array<{
      userId: string;
      updates: UpdatePreferencesRequest;
    }>
  ): Promise<UserNotificationPreferences[]> {
    try {
      const results: UserNotificationPreferences[] = [];
      
      for (const { userId, updates } of userUpdates) {
        try {
          const updatedPreferences = await this.updatePreferences(userId, updates);
          results.push(updatedPreferences);
        } catch (error) {
          logger.error('Failed to update preferences for user in bulk', { error, userId });
          // Continue with other users even if one fails
        }
      }

      logger.info('Bulk preferences update completed', { 
        total: userUpdates.length,
        successful: results.length,
        failed: userUpdates.length - results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed bulk preferences update', { error });
      throw error;
    }
  }

  private validatePreferencesUpdate(updates: UpdatePreferencesRequest): void {
    // Validate email if provided
    if (updates.emailAddress !== undefined && updates.emailAddress !== null) {
      if (!this.isValidEmail(updates.emailAddress)) {
        throw new Error('Invalid email address format');
      }
    }

    // Validate FCM token if provided
    if (updates.fcmToken !== undefined && updates.fcmToken !== null) {
      if (updates.fcmToken.trim().length === 0) {
        throw new Error('FCM token cannot be empty');
      }
    }
  }

  private validateTelegramData(telegramData: LinkTelegramRequest): void {
    if (!telegramData.telegramChatId || telegramData.telegramChatId.trim().length === 0) {
      throw new Error('Telegram chat ID is required');
    }

    // Validate chat ID format (should be a number, potentially negative)
    if (!/^-?\d+$/.test(telegramData.telegramChatId)) {
      throw new Error('Invalid Telegram chat ID format');
    }
  }

  private isValidEmail(email: string): boolean {
    if (!email || email.trim().length === 0) {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private sanitizeLogData(data: any): any {
    // Remove sensitive information from logs
    const sanitized = { ...data };
    
    if (sanitized.fcmToken) {
      sanitized.fcmToken = `${sanitized.fcmToken.substring(0, 10)}...`;
    }

    return sanitized;
  }
} 