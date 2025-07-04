import { RedisManager } from './redisManager';
import { DatabaseService } from './databaseService';
import { logger } from '../utils/logger';

export class SchedulerService {
  private redisManager: RedisManager;
  private databaseService: DatabaseService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(redisManager: RedisManager, databaseService: DatabaseService) {
    this.redisManager = redisManager;
    this.databaseService = databaseService;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    // Check every 30 seconds
    this.intervalId = setInterval(() => {
      this.processScheduledNotifications();
    }, 30000);
    
    logger.info('Scheduler service started');
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Scheduler service stopped');
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  private async processScheduledNotifications(): Promise<void> {
    try {
      const notifications = await this.databaseService.getScheduledNotifications();
      
      for (const notification of notifications) {
        await this.redisManager.addToDeliveryQueue(notification, notification.priority);
        await this.databaseService.updateNotificationStatus(notification.id, 'queued');
      }
      
      if (notifications.length > 0) {
        logger.info(`Processed ${notifications.length} scheduled notifications`);
      }
    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
    }
  }
} 