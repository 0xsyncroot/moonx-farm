import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createClient } from 'redis';
import { KafkaConsumerPool } from './services/kafkaConsumerPool';
import { NotificationProcessor } from './services/notificationProcessor';
import { DeliveryService } from './services/deliveryService';
import { EmailService } from './services/emailService';
import { PushNotificationService } from './services/pushNotificationService';
import { SchedulerService } from './services/schedulerService';
import { AnalyticsService } from './services/analyticsService';
import { RedisManager } from './services/redisManager';
import { DatabaseService } from './services/databaseService';
import { PriorityWorker } from './workers/priorityWorker';
import { BatchWorker } from './workers/batchWorker';
import { RetryWorker } from './workers/retryWorker';
import { logger } from './utils/logger';
import { PrometheusService } from './services/prometheusService';
import { createNotificationHubConfig } from '@moonx-farm/configs';

interface GatewayMessage {
  type: 'send_notification' | 'broadcast' | 'disconnect_user' | 'update_user_preferences';
  targetConnections?: string[];
  userId?: string;
  message?: any;
  priority?: 'high' | 'medium' | 'low';
}

interface HubEvent {
  type: 'connection_established' | 'connection_lost' | 'message_ack' | 'user_activity';
  connectionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

class NotificationHub {
  private fastify: any;
  private redisClient: any;
  private gatewayRedisClient: any;
  private kafkaConsumerPool: KafkaConsumerPool;
  private notificationProcessor: NotificationProcessor;
  private deliveryService: DeliveryService;
  private emailService: EmailService;
  private pushService: PushNotificationService;
  private schedulerService: SchedulerService;
  private analyticsService: AnalyticsService;
  private redisManager: RedisManager;
  private databaseService: DatabaseService;
  private prometheusService: PrometheusService;
  
  // Workers
  private priorityWorker: PriorityWorker;
  private batchWorker: BatchWorker;
  private retryWorker: RetryWorker;

  constructor() {
    this.initializeHub();
  }

  private async initializeHub() {
    try {
      // Load configuration
      const config = createNotificationHubConfig();
      
      // Initialize Fastify
      this.fastify = Fastify({
        logger: {
          level: config.logging.level,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname'
            }
          }
        }
      });

      // Register plugins
      await this.registerPlugins();

      // Initialize Redis connections
      await this.initializeRedis();

      // Initialize database
      await this.initializeDatabase();

      // Initialize core services
      await this.initializeServices();

      // Initialize workers
      await this.initializeWorkers();

      // Setup gateway communication
      await this.setupGatewayCommunication();

      // Setup routes
      this.setupRoutes();

      // Start Kafka consumers
      await this.startKafkaConsumers();

      // Start workers
      await this.startWorkers();

      // Start server
      await this.startServer();

      logger.info('Notification Hub initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Notification Hub:', error);
      process.exit(1);
    }
  }

  private async registerPlugins() {
    await this.fastify.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      credentials: true
    });

    await this.fastify.register(helmet);

    logger.info('Fastify plugins registered');
  }

  private async initializeRedis() {
    // Main Redis client for caching and state
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Dedicated Redis client for gateway communication
    this.gatewayRedisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    await this.redisClient.connect();
    await this.gatewayRedisClient.connect();

    logger.info('Redis clients connected');
  }

  private async initializeDatabase() {
    this.databaseService = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'moonx_notifications',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    });

    await this.databaseService.connect();
    logger.info('Database connected');
  }

  private async initializeServices() {
    // Core infrastructure services
    this.redisManager = new RedisManager(this.redisClient);
    this.prometheusService = new PrometheusService();
    
    // External delivery services
    this.emailService = new EmailService({
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASSWORD || ''
        }
      },
      from: process.env.EMAIL_FROM || 'MoonXFarm <noreply@moonx.farm>'
    });

    this.pushService = new PushNotificationService({
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
      }
    });

    // Core business logic services
    this.notificationProcessor = new NotificationProcessor(
      this.redisManager,
      this.databaseService,
      this.prometheusService
    );

    this.deliveryService = new DeliveryService(
      this.gatewayRedisClient,
      this.emailService,
      this.pushService,
      this.redisManager,
      this.prometheusService
    );

    this.schedulerService = new SchedulerService(
      this.redisManager,
      this.databaseService
    );

    this.analyticsService = new AnalyticsService(
      this.databaseService,
      this.redisManager
    );

    // Kafka consumer pool
    this.kafkaConsumerPool = new KafkaConsumerPool(
      {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        groupId: 'notification-hub-group',
        clientId: 'notification-hub'
      },
      this.notificationProcessor
    );

    logger.info('Core services initialized');
  }

  private async initializeWorkers() {
    this.priorityWorker = new PriorityWorker(
      this.redisManager,
      this.deliveryService,
      this.prometheusService
    );

    this.batchWorker = new BatchWorker(
      this.redisManager,
      this.deliveryService,
      this.emailService,
      this.pushService
    );

    this.retryWorker = new RetryWorker(
      this.redisManager,
      this.deliveryService,
      this.databaseService
    );

    logger.info('Workers initialized');
  }

  private async setupGatewayCommunication() {
    // Subscribe to events from WebSocket Gateway
    await this.gatewayRedisClient.subscribe('hub:events', (message: string) => {
      try {
        const event: HubEvent = JSON.parse(message);
        this.handleGatewayEvent(event);
      } catch (error) {
        logger.error('Error processing gateway event:', error);
      }
    });

    logger.info('Gateway communication established');
  }

  private async handleGatewayEvent(event: HubEvent) {
    switch (event.type) {
      case 'connection_established':
        await this.analyticsService.trackConnection(event.userId!, 'connect');
        await this.redisManager.updateUserStatus(event.userId!, 'online');
        logger.info(`User ${event.userId} connected via gateway`);
        break;

      case 'connection_lost':
        await this.analyticsService.trackConnection(event.userId!, 'disconnect');
        await this.redisManager.updateUserStatus(event.userId!, 'offline');
        logger.info(`User ${event.userId} disconnected from gateway`);
        break;

      case 'message_ack':
        if (event.metadata?.messageId) {
          await this.analyticsService.trackDelivery(
            event.metadata.messageId,
            'websocket',
            'acknowledged'
          );
        }
        break;

      case 'user_activity':
        await this.redisManager.updateUserActivity(event.userId!);
        break;

      default:
        logger.warn(`Unknown gateway event: ${event.type}`);
    }
  }

  private async sendToGateway(message: GatewayMessage) {
    try {
      await this.gatewayRedisClient.publish('gateway:commands', JSON.stringify(message));
      this.prometheusService.incrementGatewayMessages();
    } catch (error) {
      logger.error('Error sending message to gateway:', error);
    }
  }

  private async startKafkaConsumers() {
    // Define topic handlers
    const topicHandlers = {
      'swap-events': this.handleSwapEvent.bind(this),
      'order-events': this.handleOrderEvent.bind(this),
      'price-updates': this.handlePriceUpdate.bind(this),
      'portfolio-updates': this.handlePortfolioUpdate.bind(this),
      'system-alerts': this.handleSystemAlert.bind(this),
      'chart-updates': this.handleChartUpdate.bind(this),
      'liquidity-updates': this.handleLiquidityUpdate.bind(this)
    };

    await this.kafkaConsumerPool.start(topicHandlers);
    logger.info('Kafka consumers started');
  }

  private async handleSwapEvent(message: any) {
    const { type, userId, data } = message;
    
    if (type === 'swap_completed') {
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'swap_completed',
        title: 'Swap Completed',
        body: `Your swap of ${data.fromToken} to ${data.toToken} has completed`,
        priority: 'high',
        channels: ['websocket', 'push'],
        data: {
          txHash: data.txHash,
          fromToken: data.fromToken,
          toToken: data.toToken,
          amount: data.amount
        }
      });

      await this.deliveryService.deliverNotification(notification);
    }
  }

  private async handleOrderEvent(message: any) {
    const { type, userId, data } = message;
    
    if (type === 'order_filled') {
      const notification = await this.notificationProcessor.createNotification({
        userId,
        type: 'order_filled',
        title: 'Order Filled',
        body: `Your ${data.orderType} order has been executed`,
        priority: 'high',
        channels: ['websocket', 'push', 'email'],
        data: {
          orderId: data.orderId,
          orderType: data.orderType,
          amount: data.amount,
          price: data.price
        }
      });

      await this.deliveryService.deliverNotification(notification);
    }
  }

  private async handlePriceUpdate(message: any) {
    const { symbol, price, timestamp } = message;
    
    // Check for price alerts
    const alerts = await this.databaseService.getPriceAlerts(symbol, price);
    
    for (const alert of alerts) {
      const notification = await this.notificationProcessor.createNotification({
        userId: alert.userId,
        type: 'price_alert',
        title: 'Price Alert',
        body: `${symbol} has reached your target price of $${alert.targetPrice}`,
        priority: 'medium',
        channels: ['websocket', 'push'],
        data: {
          symbol,
          currentPrice: price,
          targetPrice: alert.targetPrice,
          direction: alert.direction
        }
      });

      await this.deliveryService.deliverNotification(notification);
    }

    // Send real-time price updates to chart subscribers
    await this.sendToGateway({
      type: 'send_notification',
      targetConnections: await this.redisManager.getRoomConnections(`chart:${symbol}`),
      message: {
        type: 'price_update',
        symbol,
        price,
        timestamp
      }
    });
  }

  private async handlePortfolioUpdate(message: any) {
    const { userId, totalValue, pnl, pnlPercentage } = message;
    
    // Send real-time portfolio update
    const userConnections = await this.redisManager.getUserConnections(userId);
    
    await this.sendToGateway({
      type: 'send_notification',
      targetConnections: userConnections,
      message: {
        type: 'portfolio_update',
        userId,
        totalValue,
        pnl,
        pnlPercentage,
        timestamp: Date.now()
      }
    });
  }

  private async handleSystemAlert(message: any) {
    const { type, title, body, filters } = message;
    
    // Broadcast system message
    await this.sendToGateway({
      type: 'broadcast',
      message: {
        type: 'system_message',
        title,
        body,
        timestamp: Date.now()
      }
    });

    // Also send as persistent notification
    const users = await this.databaseService.getUsersByFilters(filters);
    
    for (const user of users) {
      const notification = await this.notificationProcessor.createNotification({
        userId: user.id,
        type: 'system_maintenance',
        title,
        body,
        priority: 'medium',
        channels: ['websocket', 'email'],
        data: { systemAlert: true }
      });

      await this.deliveryService.deliverNotification(notification);
    }
  }

  private async handleChartUpdate(message: any) {
    const { symbol, data } = message;
    
    // Send to chart subscribers
    await this.sendToGateway({
      type: 'send_notification',
      targetConnections: await this.redisManager.getRoomConnections(`chart:${symbol}`),
      message: {
        type: 'chart_update',
        symbol,
        ...data
      }
    });
  }

  private async handleLiquidityUpdate(message: any) {
    const { pool, liquidity, timestamp } = message;
    
    // Send to liquidity pool subscribers
    await this.sendToGateway({
      type: 'send_notification',
      targetConnections: await this.redisManager.getRoomConnections(`liquidity:${pool}`),
      message: {
        type: 'liquidity_update',
        pool,
        liquidity,
        timestamp
      }
    });
  }

  private async startWorkers() {
    // Start priority worker for high-priority notifications
    this.priorityWorker.start();
    
    // Start batch worker for bulk operations
    this.batchWorker.start();
    
    // Start retry worker for failed deliveries
    this.retryWorker.start();
    
    // Start scheduler service for delayed notifications
    this.schedulerService.start();

    logger.info('All workers started');
  }

  private setupRoutes() {
    // Health check
    this.fastify.get('/health', async (request: any, reply: any) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: this.redisClient.isReady,
          database: await this.databaseService.isHealthy(),
          kafka: this.kafkaConsumerPool.isHealthy(),
          gateway: true // TODO: Check gateway connectivity
        },
        metrics: {
          processedMessages: await this.prometheusService.getProcessedMessages(),
          deliveredNotifications: await this.prometheusService.getDeliveredNotifications(),
          failedDeliveries: await this.prometheusService.getFailedDeliveries(),
          averageProcessingTime: await this.prometheusService.getAverageProcessingTime()
        },
        workers: {
          priorityWorker: this.priorityWorker.isRunning(),
          batchWorker: this.batchWorker.isRunning(),
          retryWorker: this.retryWorker.isRunning(),
          scheduler: this.schedulerService.isRunning()
        }
      };

      reply.send(health);
    });

    // Metrics endpoint
    this.fastify.get('/metrics', async (request: any, reply: any) => {
      const metrics = await this.prometheusService.getMetrics();
      reply.type('text/plain').send(metrics);
    });

    // Analytics endpoint
    this.fastify.get('/analytics', async (request: any, reply: any) => {
      const analytics = await this.analyticsService.getAnalytics(
        request.query.period || '24h'
      );
      reply.send(analytics);
    });

    // Manual notification endpoint (for testing/admin)
    this.fastify.post('/notifications/send', async (request: any, reply: any) => {
      const notification = await this.notificationProcessor.createNotification(request.body);
      await this.deliveryService.deliverNotification(notification);
      
      reply.send({ 
        success: true, 
        notificationId: notification.id 
      });
    });

    logger.info('Routes registered');
  }

  private async startServer() {
    const port = parseInt(process.env.PORT || '3008');
    const host = process.env.HOST || '0.0.0.0';

    await this.fastify.listen({ port, host });
    logger.info(`Notification Hub listening on ${host}:${port}`);
  }

  public async shutdown() {
    logger.info('Shutting down Notification Hub...');

    try {
      // Stop workers
      await this.priorityWorker.stop();
      await this.batchWorker.stop();
      await this.retryWorker.stop();
      await this.schedulerService.stop();

      // Stop Kafka consumers
      await this.kafkaConsumerPool.stop();

      // Close Redis connections
      await this.redisClient.quit();
      await this.gatewayRedisClient.quit();

      // Close database connection
      await this.databaseService.disconnect();

      // Close HTTP server
      await this.fastify.close();

      logger.info('Notification Hub shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Initialize Notification Hub
const hub = new NotificationHub();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await hub.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await hub.shutdown();
  process.exit(0);
});

export default hub; 