import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { KafkaConsumerPool } from './services/kafkaConsumerPool';
import { NotificationProcessor } from './services/notificationProcessor';
import { DeliveryService } from './services/deliveryService';
import { EmailService } from './services/emailService';
import { PushNotificationService } from './services/pushNotificationService';
import { SchedulerService } from './services/schedulerService';
import { AnalyticsService } from './services/analyticsService';
import { RedisManager } from './services/redisManager';
import { DatabaseService } from './services/databaseService';
import { PrometheusService } from './services/prometheusService';
import { createLogger } from '@moonx-farm/common';
import { redisService } from './services/redisService';
import { kafkaService } from './services/kafkaService';
import { PriorityWorker } from './workers/priorityWorker';
import { BatchWorker } from './workers/batchWorker';
import { RetryWorker } from './workers/retryWorker';
import { AuthService } from './middleware/auth';

const logger = createLogger('NotificationHub');

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
  private kafkaConsumerPool!: KafkaConsumerPool;
  private notificationProcessor!: NotificationProcessor;
  private deliveryService!: DeliveryService;
  private emailService!: EmailService;
  private pushService!: PushNotificationService;
  private schedulerService!: SchedulerService;
  private analyticsService!: AnalyticsService;
  private redisManager!: RedisManager;
  private databaseService!: DatabaseService;
  private prometheusService!: PrometheusService;
  private authService!: AuthService;

  constructor() {
    this.initializeHub();
  }

  private async initializeHub() {
    try {
      logger.info('Initializing Notification Hub...');
      
      // Initialize Fastify
      this.fastify = Fastify({
        logger: {
          level: process.env['LOG_LEVEL'] || 'info',
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

      // Initialize services
      await this.initializeServices();

      // Setup gateway communication
      await this.setupGatewayCommunication();

      // Setup routes
      await this.setupRoutes();

      // Start Kafka consumers
      await this.startKafkaConsumers();

      // Start server
      await this.startServer();

      logger.info('Notification Hub initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Notification Hub: ${error}`);
      process.exit(1);
    }
  }

  private async registerPlugins() {
    await this.fastify.register(cors, {
      origin: process.env['ALLOWED_ORIGINS']?.split(',') || ['*'],
      credentials: true
    });

    await this.fastify.register(helmet);

    logger.info('Fastify plugins registered');
  }

  private async initializeServices() {
    // Initialize infrastructure services
    await redisService.initialize();
    await kafkaService.initialize();
    
    // Auto-create Kafka topics if they don't exist
    await this.ensureKafkaTopicsExist();
    
    logger.info('Infrastructure services initialized');

    // Initialize core services
    this.databaseService = new DatabaseService();
    this.redisManager = new RedisManager();
    this.prometheusService = new PrometheusService();
    
    // Initialize notification processor
    this.notificationProcessor = new NotificationProcessor(
      this.redisManager,
      this.databaseService,
      this.prometheusService
    );

    // Initialize Kafka consumer pool
    this.kafkaConsumerPool = new KafkaConsumerPool(this.notificationProcessor);

    // Initialize delivery services (to be implemented)
    this.emailService = new EmailService({
      sendgrid: {
        apiKey: process.env['SENDGRID_API_KEY'] || '',
        fromEmail: process.env['SENDGRID_FROM_EMAIL'] || 'noreply@moonx.farm',
        fromName: process.env['SENDGRID_FROM_NAME'] || 'MoonX Farm'
      },
      smtp: {
        host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
        port: parseInt(process.env['SMTP_PORT'] || '587'),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: {
          user: process.env['SMTP_USER'] || '',
          pass: process.env['SMTP_PASSWORD'] || ''
        }
      },
      from: process.env['EMAIL_FROM'] || 'MoonXFarm <noreply@moonx.farm>'
    });
    
    this.pushService = new PushNotificationService({
      firebase: {
        projectId: process.env['FIREBASE_PROJECT_ID'] || '',
        privateKey: process.env['FIREBASE_PRIVATE_KEY'] || '',
        clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] || ''
      }
    });
    
    this.deliveryService = new DeliveryService(
      redisService.getRedis(),
      this.emailService,
      this.pushService,
      this.redisManager,
      this.prometheusService
    );
    
    // Initialize workers for SchedulerService
    const priorityWorker = new PriorityWorker(
      this.deliveryService,
      this.notificationProcessor
    );
    
    const batchWorker = new BatchWorker(
      this.deliveryService,
      this.databaseService
    );
    
    const retryWorker = new RetryWorker(
      this.deliveryService,
      this.databaseService,
      this.redisManager
    );
    
    // Now initialize SchedulerService with proper parameters
    this.schedulerService = new SchedulerService(
      this.databaseService,
      priorityWorker,
      batchWorker,
      retryWorker
    );
    
    // Note: SchedulerService needs workers - will be initialized after workers are created
    this.analyticsService = new AnalyticsService(this.databaseService, this.redisManager);

    // Initialize AuthService
    const authServiceUrl = process.env['AUTH_SERVICE_URL'] || 'http://localhost:3001';
    this.authService = new AuthService(authServiceUrl);

    logger.info('Core services initialized');
  }

  private async setupGatewayCommunication() {
    try {
      const redis = redisService.getRedis();
      
      // Subscribe to gateway events
      await redis.command('SUBSCRIBE', 'hub:events');
      
      // Set up message handler for gateway events
      await redis.command('CONFIG', 'SET', 'notify-keyspace-events', 'Ex');
      
      logger.info('WebSocket Gateway communication established');
      
      // Listen for WebSocket Gateway events
      this.listenToGatewayEvents();
      
    } catch (error) {
      logger.error(`Failed to setup gateway communication: ${error}`);
    }
  }

  private async listenToGatewayEvents() {
    try {
      // For now, we'll poll for gateway events or use a different approach
      // The actual Redis pub/sub integration will be implemented when 
      // infrastructure package supports event listeners
      
      logger.info('Gateway event listening setup completed (polling mode)');
      
      // Start periodic check for gateway events
      this.startGatewayEventPolling();
      
    } catch (error) {
      logger.error(`Error setting up gateway event listener: ${error}`);
    }
  }

  private startGatewayEventPolling() {
    // Poll for gateway events every 5 seconds
    setInterval(async () => {
      try {
        // Check for new gateway events in Redis
        // This will be implemented once we have proper infrastructure support
        await this.checkForGatewayEvents();
      } catch (error) {
        logger.error(`Error polling gateway events: ${error}`);
      }
    }, 5000);
  }

  private async checkForGatewayEvents() {
    try {
      const redis = redisService.getRedis();
      
      // Check for events in a queue or list
      const events = await redis.command('LPOP', 'hub:events:queue');
      
      if (events) {
        const event: HubEvent = JSON.parse(events as string);
        await this.handleGatewayEvent(event);
      }
    } catch (error) {
      // Silently ignore errors in polling to avoid spam
      // logger.debug(`Error checking gateway events: ${error}`);
    }
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
        if (event.metadata?.['messageId']) {
          await this.analyticsService.trackDelivery(
            event.metadata['messageId'],
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
      const redis = redisService.getRedis();
      await redis.command('PUBLISH', 'gateway:commands', JSON.stringify(message));
      this.prometheusService.incrementGatewayMessages();
    } catch (error) {
      logger.error(`Error sending message to gateway: ${error}`);
    }
  }

  private async startKafkaConsumers() {
    // Define topic handlers
    const topicHandlers = {
      'price.alerts': this.handlePriceAlert.bind(this),
      'volume.alerts': this.handleVolumeAlert.bind(this),
      'whale.alerts': this.handleWhaleAlert.bind(this),
      'wallet.activity': this.handleWalletActivity.bind(this),
      'system.alerts': this.handleSystemAlert.bind(this),
      'user.events': this.handleUserEvent.bind(this)
    };

    await this.kafkaConsumerPool.start(topicHandlers);
    logger.info('Kafka consumers started');
  }

  private async handlePriceAlert(message: any) {
    const { userId, symbol, price, targetPrice, direction } = message;
    
    const notification = await this.notificationProcessor.createNotification({
      userId,
      type: 'price_alert',
      title: 'Price Alert',
      body: `${symbol} has reached your target price of $${targetPrice}`,
      priority: 'high',
      channels: ['websocket', 'push'],
      data: {
        symbol,
        currentPrice: price,
        targetPrice,
        direction
      }
    });

    await this.deliveryService.deliverNotification(notification);
  }

  private async handleVolumeAlert(message: any) {
    const { userId, symbol, volume, threshold } = message;
    
    const notification = await this.notificationProcessor.createNotification({
      userId,
      type: 'volume_alert',
      title: 'Volume Alert',
      body: `${symbol} volume has spiked to ${volume} (threshold: ${threshold})`,
      priority: 'medium',
      channels: ['websocket', 'push'],
      data: {
        symbol,
        volume,
        threshold
      }
    });

    await this.deliveryService.deliverNotification(notification);
  }

  private async handleWhaleAlert(message: any) {
    const { userId, symbol, amount, txHash } = message;
    
    const notification = await this.notificationProcessor.createNotification({
      userId,
      type: 'whale_alert',
      title: 'Whale Alert',
      body: `Large transaction detected: ${amount} ${symbol}`,
      priority: 'medium',
      channels: ['websocket', 'push'],
      data: {
        symbol,
        amount,
        txHash
      }
    });

    await this.deliveryService.deliverNotification(notification);
  }

  private async handleWalletActivity(message: any) {
    const { userId, walletAddress, activity } = message;
    
    const notification = await this.notificationProcessor.createNotification({
      userId,
      type: 'wallet_activity',
      title: 'Wallet Activity',
      body: `Activity detected on wallet ${walletAddress}`,
      priority: 'low',
      channels: ['websocket'],
      data: {
        walletAddress,
        activity
      }
    });

    await this.deliveryService.deliverNotification(notification);
  }

  private async handleSystemAlert(message: any) {
    const { title, body, priority = 'medium' } = message;
    
    // Get all active users
    const users = await this.databaseService.getUsersByFilters({ active: true });
    
    for (const user of users) {
      const notification = await this.notificationProcessor.createNotification({
        userId: user.id,
        type: 'system_alert',
        title,
        body,
        priority,
        channels: ['websocket', 'push'],
        data: { systemAlert: true }
      });

      await this.deliveryService.deliverNotification(notification);
    }
  }

  private async handleUserEvent(message: any) {
    const { userId, eventType, data } = message;
    
    const notification = await this.notificationProcessor.createNotification({
      userId,
      type: eventType,
      title: data.title || 'User Event',
      body: data.body || 'New user event',
      priority: data.priority || 'low',
      channels: ['websocket'],
      data
    });

    await this.deliveryService.deliverNotification(notification);
  }

  private async setupRoutes() {
    try {
      // Import router registration function
      const { registerRoutes } = await import('./routes');
      
      // Register all routes with services
      await registerRoutes(this.fastify, {
        redisService,
        kafkaService,
        databaseService: this.databaseService,
        kafkaConsumerPool: this.kafkaConsumerPool,
        prometheusService: this.prometheusService,
        analyticsService: this.analyticsService,
        schedulerService: this.schedulerService,
        notificationProcessor: this.notificationProcessor,
        redisManager: this.redisManager,
        authService: this.authService
      });

      logger.info('All API routes registered successfully');
    } catch (error) {
      logger.error(`Error setting up routes: ${error}`);
      throw error;
    }
  }

  private async startServer() {
    const port = parseInt(process.env['PORT'] || '3008');
    const host = process.env['HOST'] || '0.0.0.0';

    await this.fastify.listen({ port, host });
    logger.info(`Notification Hub listening on ${host}:${port}`);
  }

  private async ensureKafkaTopicsExist() {
    try {
      const kafka = kafkaService.getKafka();
      
      const requiredTopics = [
        {
          topic: 'price.alerts',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: 'volume.alerts',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: 'whale.alerts',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: 'wallet.activity',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: 'system.alerts',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '2592000000' }, // 30 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: 'user.events',
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
      ];

      // Check existing topics
      const existingTopics = await kafka.listTopics();
      logger.info(`Existing Kafka topics: ${existingTopics.join(', ')}`);

      // Filter out topics that already exist
      const topicsToCreate = requiredTopics.filter(
        topic => !existingTopics.includes(topic.topic)
      );

      if (topicsToCreate.length === 0) {
        logger.info('All required Kafka topics already exist');
        return;
      }

      logger.info(`Creating ${topicsToCreate.length} Kafka topics...`);
      
      // Create topics
      await kafka.createTopics(topicsToCreate);
      
      logger.info('Kafka topics created successfully:');
      topicsToCreate.forEach(topic => {
        logger.info(`  - ${topic.topic} (${topic.numPartitions} partitions, ${topic.replicationFactor} replicas)`);
      });

    } catch (error) {
      logger.warn(`Could not create Kafka topics: ${error}`);
      logger.warn('Topics may need to be created manually or Kafka may not be available');
    }
  }

  public async shutdown() {
    logger.info('Shutting down Notification Hub...');

    try {
      // Stop Kafka consumers
      await this.kafkaConsumerPool.stop();

      // Shutdown infrastructure services
      await kafkaService.shutdown();
      await redisService.shutdown();

      // Close HTTP server
      await this.fastify.close();

      logger.info('Notification Hub shut down successfully');
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
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