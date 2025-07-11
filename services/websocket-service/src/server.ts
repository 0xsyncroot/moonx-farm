import Fastify, { FastifyInstance } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from './config';
import { serviceRegistry } from './services/serviceRegistry';
import { registerRoutes } from './routes';
import { connectionHandler } from './handlers/connectionHandler';

const logger = createLogger('websocket-server');

export class WebSocketServer {
  private fastify: FastifyInstance;
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Fix MaxListenersExceededWarning
    process.setMaxListeners(20);
    this.fastify = Fastify({
      logger: {
        level: websocketConfig.logging.level as any,
        transport: websocketConfig.isDevelopment ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        } : undefined
      },
      trustProxy: true,
      disableRequestLogging: false
    });

    this.initialize();
  }

  /**
   * Initialize server with async setup
   */
  private async initialize(): Promise<void> {
    await this.setupPlugins();
    await this.setupRoutes();
    this.setupHealthCheck();
  }

  /**
   * Setup Fastify plugins
   */
  private async setupPlugins(): Promise<void> {
    try {
      // CORS configuration
      await this.fastify.register(import('@fastify/cors'), {
        origin: websocketConfig.cors.origin,
        credentials: websocketConfig.cors.credentials
      });

      // WebSocket plugin
      await this.fastify.register(import('@fastify/websocket'));

      // Security headers
      await this.fastify.register(import('@fastify/helmet'), {
        contentSecurityPolicy: false
      });

      // Rate limiting for HTTP requests
      if (websocketConfig.rateLimit.enabled) {
        await this.fastify.register(import('@fastify/rate-limit'), {
          max: websocketConfig.rateLimit.maxConnectionsPerIp,
          timeWindow: websocketConfig.rateLimit.windowSize
        });
      }

      // Swagger documentation (development only)
      if (websocketConfig.swagger.enabled && websocketConfig.isDevelopment) {
        await this.fastify.register(import('@fastify/swagger'), {
          openapi: {
            info: {
              title: 'MoonX Farm WebSocket Service',
              description: 'Real-time WebSocket service for MoonX Farm DEX',
              version: '1.0.0'
            },
            servers: [
              {
                url: `http://${websocketConfig.host}:${websocketConfig.port}`,
                description: 'Development server'
              }
            ]
          }
        });

        await this.fastify.register(import('@fastify/swagger-ui'), {
          routePrefix: websocketConfig.swagger.path,
          uiConfig: {
            docExpansion: 'full',
            deepLinking: false
          }
        });
      }

      logger.info('Fastify plugins registered');
    } catch (error) {
      logger.error('Failed to setup Fastify plugins', { error });
      throw error;
    }
  }

  /**
   * Setup HTTP routes using routes directory
   */
  private async setupRoutes(): Promise<void> {
    try {
      const websocketHandlers = {
        handleConnection: connectionHandler.handleConnection.bind(connectionHandler)
      };
      
      await registerRoutes(this.fastify, websocketHandlers);
      logger.info('HTTP and WebSocket routes configured');
    } catch (error) {
      logger.error('Failed to setup routes', { error });
      throw error;
    }
  }

  /**
   * Setup health check monitoring
   */
  private setupHealthCheck(): void {
    if (websocketConfig.healthCheck.enabled) {
      this.healthCheckInterval = setInterval(async () => {
        // Health check logic moved to healthRoutes.ts
        // This periodic check can be removed or simplified
        logger.debug('Health check interval triggered');
      }, websocketConfig.healthCheck.interval);

      logger.info('Health check monitoring enabled');
    }
  }



  /**
   * Create Kafka topics if they don't exist
   */
  private async ensureKafkaTopics(): Promise<void> {
    try {
      logger.info('🔧 Ensuring Kafka topics exist...');
      
      // Import KafkaManager from infrastructure package
      const { KafkaManager } = await import('@moonx-farm/infrastructure');
      
      // Create KafkaManager instance with config
      const kafkaManager = new KafkaManager({
        brokers: websocketConfig.kafka.brokers.split(',').map(b => b.trim()),
        clientId: websocketConfig.kafka.clientId,
        connectionTimeout: 10000,
        requestTimeout: 30000,
      });

      logger.info('📡 Connecting to Kafka...', {
        brokers: websocketConfig.kafka.brokers,
        clientId: websocketConfig.kafka.clientId
      });

      await kafkaManager.connect();
      
      // Get existing topics
      const existingTopics = await kafkaManager.listTopics();
      logger.debug('📋 Existing topics:', existingTopics);
      
      // Define topics to create
      const topicsToCreate = [
        {
          topic: websocketConfig.kafka.mainTopic,
          numPartitions: 6,
          replicationFactor: 1,
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' },
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'segment.ms', value: '3600000' },     // 1 hour
            { name: 'compression.type', value: 'gzip' },
            { name: 'max.message.bytes', value: '1000000' }, // 1MB
            { name: 'min.insync.replicas', value: '1' }
          ]
        },
        {
          topic: websocketConfig.kafka.eventProcessing.deadLetterQueueTopic,
          numPartitions: 2,
          replicationFactor: 1,
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' },
            { name: 'retention.ms', value: '2592000000' }, // 30 days
            { name: 'segment.ms', value: '86400000' },     // 24 hours
            { name: 'compression.type', value: 'gzip' }
          ]
        }
      ].filter(topicConfig => !existingTopics.includes(topicConfig.topic));
      
      if (topicsToCreate.length === 0) {
        logger.info('✅ All Kafka topics already exist');
      } else {
        logger.info(`📝 Creating ${topicsToCreate.length} Kafka topics...`, {
          topics: topicsToCreate.map(t => t.topic)
        });
        
        await kafkaManager.createTopics(topicsToCreate);
        
        logger.info('✅ Kafka topics created successfully', {
          createdTopics: topicsToCreate.map(t => ({
            topic: t.topic,
            partitions: t.numPartitions,
            replication: t.replicationFactor
          }))
        });
      }
      
      await kafkaManager.disconnect();
      logger.info('✅ Kafka topics ready');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log warning but don't fail startup - topics might exist already
      logger.warn('Failed to create Kafka topics', { 
        error: errorMessage,
        note: 'Topics might already exist or need manual creation',
        config: {
          brokers: websocketConfig.kafka.brokers,
          mainTopic: websocketConfig.kafka.mainTopic,
          dlqTopic: websocketConfig.kafka.eventProcessing.deadLetterQueueTopic
        }
      });
      
      // Only throw error if it's a connection issue
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
        throw new Error(`Kafka connection failed: ${errorMessage}. Please ensure Kafka is running at: ${websocketConfig.kafka.brokers}`);
      }
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Ensure Kafka topics exist before starting consumer
      await this.ensureKafkaTopics();
      
      // Start all services
      await serviceRegistry.startAll();
      
      // Start Fastify server
      await this.fastify.listen({ 
        port: websocketConfig.port, 
        host: websocketConfig.host 
      });
      
      logger.info('WebSocket server started with post-connection authentication', {
        host: websocketConfig.host,
        port: websocketConfig.port,
        environment: websocketConfig.environment,
        services: serviceRegistry.getServiceCount()
      });

    } catch (error) {
      logger.error('Failed to start WebSocket server', { error });
      throw error;
    }
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown');

    try {
      // Clear health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Stop all services
      await serviceRegistry.stopAll();

      // Close Fastify server
      await this.fastify.close();
      logger.info('Fastify server closed');

      logger.info('Graceful shutdown completed');

    } catch (error) {
      logger.error('Error during shutdown', { error });
      throw error;
    }
  }
}

// Create and export server instance
export const server = new WebSocketServer();

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, initiating graceful shutdown');
  try {
    await server.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGTERM shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, initiating graceful shutdown');
  try {
    await server.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGINT shutdown', { error });
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
} 