import 'dotenv/config';
import { createServer } from 'http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { createSocketServer } from './config/socket';
import { createKafkaConsumer } from './config/kafka';
import { createRedisClient } from './config/redis';
import { SocketManager } from './services/socketManager';
import { NotificationService } from './services/notificationService';
import { KafkaConsumerService } from './services/kafkaConsumer';
import { RedisManager } from './services/redisManager';
import { EmailService } from './services/emailService';
import { PushNotificationService } from './services/pushService';
import { notificationRoutes } from './routes/notifications';
import { healthRoutes } from './routes/health';
import { logger } from './utils/logger';
import { PrometheusService } from './services/prometheusService';
import { createNotifyServiceConfig } from '@moonx-farm/configs';

class NotifyServer {
  private fastify: any;
  private httpServer: any;
  private io: any;
  private kafkaConsumer: any;
  private redisClient: any;
  private socketManager: SocketManager;
  private notificationService: NotificationService;
  private kafkaConsumerService: KafkaConsumerService;
  private redisManager: RedisManager;
  private emailService: EmailService;
  private pushService: PushNotificationService;
  private prometheusService: PrometheusService;

  constructor() {
    this.initializeServer();
  }

  private async initializeServer() {
    try {
      // Load configuration
      const config = createNotifyServiceConfig();
      
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

      // Initialize external services
      await this.initializeExternalServices();

      // Initialize internal services
      await this.initializeInternalServices();

      // Setup routes
      await this.setupRoutes();

      // Start server
      await this.startServer();

      logger.info('Notify Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  private async registerPlugins() {
    // CORS
    await this.fastify.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    });

    // Security
    await this.fastify.register(helmet);

    // Rate limiting
    await this.fastify.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
    });

    // JWT
    await this.fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key'
    });

    logger.info('Fastify plugins registered');
  }

  private async initializeExternalServices() {
    // Redis
    this.redisClient = createRedisClient();
    await this.redisClient.connect();
    logger.info('Redis connected');

    // Kafka
    this.kafkaConsumer = createKafkaConsumer();
    await this.kafkaConsumer.connect();
    logger.info('Kafka consumer connected');

    // Socket.IO
    this.httpServer = createServer(this.fastify.server);
    this.io = createSocketServer(this.httpServer);
    logger.info('Socket.IO server created');
  }

  private async initializeInternalServices() {
    // Initialize service managers
    this.redisManager = new RedisManager(this.redisClient);
    this.emailService = new EmailService();
    this.pushService = new PushNotificationService();
    this.prometheusService = new PrometheusService();

    // Initialize core services
    this.socketManager = new SocketManager(this.io, this.redisManager);
    this.notificationService = new NotificationService(
      this.socketManager,
      this.redisManager,
      this.emailService,
      this.pushService
    );

    // Initialize Kafka consumer service
    this.kafkaConsumerService = new KafkaConsumerService(
      this.kafkaConsumer,
      this.notificationService
    );

    // Setup Socket.IO event handlers
    this.setupSocketHandlers();

    logger.info('Internal services initialized');
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: any) => {
      logger.info(`Client connected: ${socket.id}`);
      
      socket.on('join_room', (data: any) => {
        this.socketManager.joinRoom(socket, data.room);
      });

      socket.on('leave_room', (data: any) => {
        this.socketManager.leaveRoom(socket, data.room);
      });

      socket.on('subscribe_notifications', (data: any) => {
        this.socketManager.subscribeToNotifications(socket, data.types);
      });

      socket.on('unsubscribe_notifications', (data: any) => {
        this.socketManager.unsubscribeFromNotifications(socket, data.types);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.socketManager.handleDisconnect(socket);
      });
    });
  }

  private async setupRoutes() {
    // Health check routes
    await this.fastify.register(healthRoutes, { prefix: '/health' });

    // Notification routes
    await this.fastify.register(notificationRoutes, { 
      prefix: '/api/v1/notifications',
      notificationService: this.notificationService,
      socketManager: this.socketManager
    });

    // Metrics endpoint
    this.fastify.get('/metrics', async (request: any, reply: any) => {
      const metrics = await this.prometheusService.getMetrics();
      reply.type('text/plain').send(metrics);
    });

    logger.info('Routes registered');
  }

  private async startServer() {
    const port = parseInt(process.env.PORT || '3006');
    const host = process.env.HOST || '0.0.0.0';

    // Start Kafka consumers
    await this.kafkaConsumerService.start();

    // Start HTTP server
    await this.fastify.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);

    // Start Socket.IO server
    this.httpServer.listen(port + 1, () => {
      logger.info(`Socket.IO server listening on port ${port + 1}`);
    });
  }

  public async shutdown() {
    logger.info('Shutting down server...');

    try {
      // Stop Kafka consumers
      await this.kafkaConsumerService.stop();
      await this.kafkaConsumer.disconnect();

      // Close Redis connection
      await this.redisClient.quit();

      // Close Socket.IO server
      this.io.close();

      // Close HTTP server
      await this.fastify.close();

      logger.info('Server shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Initialize server
const server = new NotifyServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await server.shutdown();
  process.exit(0);
});

export default server; 