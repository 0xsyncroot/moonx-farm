import { createLogger } from '@moonx-farm/common';
import { NotificationProcessor } from '../services/notificationProcessor';
import { DatabaseService } from '../services/databaseService';

const logger = createLogger('TopicHandlers');

export class TopicHandlers {
  private notificationProcessor: NotificationProcessor;
  private databaseService: DatabaseService;

  constructor(notificationProcessor: NotificationProcessor, databaseService: DatabaseService) {
    this.notificationProcessor = notificationProcessor;
    this.databaseService = databaseService;
  }

  // Handler for price alert events
  async handlePriceAlerts(message: any): Promise<void> {
    try {
      const { userId, symbol, price, direction, targetPrice } = message;
      
      logger.info(`Processing price alert for ${symbol}: ${price} (${direction} ${targetPrice})`);
      
      // Create notification
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'price_alert',
        title: `Price Alert: ${symbol}`,
        body: `${symbol} has reached ${price} USD (${direction} ${targetPrice})`,
        priority: 'medium',
        channels: ['websocket', 'push'],
        data: {
          symbol,
          price,
          direction,
          targetPrice,
          timestamp: message.timestamp
        }
      });

      // Notification created and processed automatically
      logger.info(`Price alert notification created for ${symbol} to user ${userId}`);
    } catch (error) {
      logger.error(`Error processing price alert: ${error}`);
      throw error;
    }
  }

  // Handler for volume alert events
  async handleVolumeAlerts(message: any): Promise<void> {
    try {
      const { userId, symbol, volume, timeframe, threshold } = message;
      
      logger.info(`Processing volume alert for ${symbol}: ${volume} in ${timeframe}`);
      
      // Create notification
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'volume_alert',
        title: `Volume Alert: ${symbol}`,
        body: `${symbol} volume has reached ${volume} in the last ${timeframe}`,
        priority: 'medium',
        channels: ['websocket', 'push'],
        data: {
          symbol,
          volume,
          timeframe,
          threshold,
          timestamp: message.timestamp
        }
      });

      // Notification created and processed automatically
      logger.info(`Volume alert notification created for ${symbol} to user ${userId}`);
    } catch (error) {
      logger.error(`Error processing volume alert: ${error}`);
      throw error;
    }
  }

  // Handler for whale transaction events
  async handleWhaleAlerts(message: any): Promise<void> {
    try {
      const { userId, symbol, amount, valueUsd, transactionType, walletAddress } = message;
      
      logger.info(`Processing whale alert for ${symbol}: ${amount} tokens (${valueUsd} USD)`);
      
      // Create notification
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'whale_alert',
        title: `Whale Alert: ${symbol}`,
        body: `Large ${transactionType} of ${amount} ${symbol} (${valueUsd} USD)`,
        priority: 'high',
        channels: ['websocket', 'push'],
        data: {
          symbol,
          amount,
          valueUsd,
          transactionType,
          walletAddress,
          timestamp: message.timestamp
        }
      });

      // Notification created and processed automatically
      logger.info(`Whale alert notification created for ${symbol} to user ${userId}`);
    } catch (error) {
      logger.error(`Error processing whale alert: ${error}`);
      throw error;
    }
  }

  // Handler for wallet activity events
  async handleWalletActivity(message: any): Promise<void> {
    try {
      const { userId, walletAddress, activityType, details } = message;
      
      logger.info(`Processing wallet activity for ${walletAddress}: ${activityType}`);
      
      // Get wallet label from database
      const walletInfo = await this.databaseService.getTrackedWallets(userId);
      const wallet = walletInfo?.find(w => w.wallet_address === walletAddress);
      const walletLabel = wallet?.wallet_label || walletAddress;
      
      // Create notification
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'wallet_activity',
        title: `Wallet Activity: ${walletLabel}`,
        body: `${walletLabel} has ${activityType} ${details}`,
        priority: 'medium',
        channels: ['websocket', 'push'],
        data: {
          walletAddress,
          walletLabel,
          activityType,
          details,
          timestamp: message.timestamp
        }
      });

      // Notification created and processed automatically
      logger.info(`Wallet activity notification created for ${walletAddress} to user ${userId}`);
    } catch (error) {
      logger.error(`Error processing wallet activity: ${error}`);
      throw error;
    }
  }

  // Handler for system alerts
  async handleSystemAlerts(message: any): Promise<void> {
    try {
      const { userId, alertType, alertMessage, priority = 'urgent' } = message;
      
      logger.info(`Processing system alert: ${alertType}`);
      
      // Create notification
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'system_alert',
        title: `System Alert: ${alertType}`,
        body: alertMessage,
        priority,
        channels: ['websocket', 'push', 'email'],
        data: {
          alertType,
          timestamp: message.timestamp
        }
      });

      // Notification created and processed automatically
      logger.info(`System alert notification created for user ${userId}`);
    } catch (error) {
      logger.error(`Error processing system alert: ${error}`);
      throw error;
    }
  }

  // Handler for user events (welcome, etc.)
  async handleUserEvents(message: any): Promise<void> {
    try {
      const { userId, eventType, username, data } = message;
      
      logger.info(`Processing user event: ${eventType} for user ${userId}`);
      
      let notification;
      
      switch (eventType) {
        case 'welcome':
          notification = await this.notificationProcessor.createNotification({
            userId,
            type: 'welcome',
            title: 'Welcome to MoonX Farm!',
            body: `Welcome ${username}! Your account is now active.`,
            priority: 'low',
            channels: ['websocket', 'email'],
            data: {
              username,
              timestamp: message.timestamp
            }
          });
          break;
          
        default:
          logger.warn(`Unknown user event type: ${eventType}`);
          return;
      }
      
      if (notification) {
        // Notification created and processed automatically
        logger.info(`User event notification created for ${eventType} to user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error processing user event: ${error}`);
      throw error;
    }
  }

  // Get all topic handlers as a mapping
  getTopicHandlers() {
    return {
      'price.alerts': this.handlePriceAlerts.bind(this),
      'volume.alerts': this.handleVolumeAlerts.bind(this),
      'whale.alerts': this.handleWhaleAlerts.bind(this),
      'wallet.activity': this.handleWalletActivity.bind(this),
      'system.alerts': this.handleSystemAlerts.bind(this),
      'user.events': this.handleUserEvents.bind(this)
    };
  }
} 