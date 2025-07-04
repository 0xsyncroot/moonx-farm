import { RedisManager } from '../services/redisManager';
import { DeliveryService } from '../services/deliveryService';
import { PrometheusService } from '../services/prometheusService';
import { logger } from '../utils/logger';

export class PriorityWorker {
  private redisManager: RedisManager;
  private deliveryService: DeliveryService;
  private prometheusService: PrometheusService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    redisManager: RedisManager,
    deliveryService: DeliveryService,
    prometheusService: PrometheusService
  ) {
    this.redisManager = redisManager;
    this.deliveryService = deliveryService;
    this.prometheusService = prometheusService;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    // Check every 5 seconds for high-priority notifications
    this.intervalId = setInterval(() => {
      this.processHighPriorityQueue();
    }, 5000);
    
    logger.info('Priority worker started');
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Priority worker stopped');
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  private async processHighPriorityQueue(): Promise<void> {
    try {
      const notification = await this.redisManager.client.rPop('delivery_queue:high');
      
      if (notification) {
        const parsedNotification = JSON.parse(notification);
        await this.deliveryService.deliverNotification(parsedNotification);
        
        await this.prometheusService.recordNotificationDelivered(
          parsedNotification.type,
          'high',
          1,
          1,
          Date.now() - parsedNotification.metadata.createdAt
        );
      }
    } catch (error) {
      logger.error('Error processing high-priority queue:', error);
    }
  }
} 