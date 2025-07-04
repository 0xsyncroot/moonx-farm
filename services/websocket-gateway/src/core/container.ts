// Dependency Injection Container for WebSocket Gateway
// Essential services for WebSocket Gateway functionality

import { logger } from '@moonx-farm/common';
import { RedisManager, createRedisConfig } from '@moonx-farm/infrastructure';
import { createWebSocketConfig } from '../config';
import { AuthService } from '../services/authService';
import { SocketMiddleware } from '../middleware/socketMiddleware';
import { ConnectionManager } from '../services/connectionManager';
import { PrometheusMetrics } from '../services/prometheusMetrics';
import { HealthService } from '../services/healthService';
import { LoadBalancer } from '../services/loadBalancer';
import { MessageRouter } from '../services/messageRouter';
import { KafkaConsumerService } from '../services/kafkaConsumer';
import { EventBroadcasterService } from '../services/eventBroadcaster';

export interface ServiceContainer {
  // Infrastructure
  config: ReturnType<typeof createWebSocketConfig>;
  redisManager: RedisManager;
  
  // Core Services
  authService: AuthService;
  connectionManager: ConnectionManager;
  prometheusMetrics: PrometheusMetrics;
  healthService: HealthService;
  loadBalancer: LoadBalancer;
  messageRouter: MessageRouter;
  
  // Event Streaming Services
  kafkaConsumerService: KafkaConsumerService;
  eventBroadcasterService: EventBroadcasterService;
  
  // Middleware
  socketMiddleware: SocketMiddleware;
}

export class Container {
  private services: Partial<ServiceContainer> = {};
  private initialized = false;

  async initialize(): Promise<ServiceContainer> {
    if (this.initialized) {
      return this.services as ServiceContainer;
    }

    logger.info('🔧 Initializing WebSocket Gateway container...');

    try {
      // 1. Load configuration
      this.initializeConfig();
      
      // 2. Initialize infrastructure
      await this.initializeInfrastructure();
      
      // 3. Initialize core services
      this.initializeCoreServices();
      
      // 4. Initialize middleware
      this.initializeMiddleware();
      
      this.initialized = true;
      logger.info('✅ WebSocket Gateway container initialized successfully');
      
      return this.services as ServiceContainer;
    } catch (error) {
      logger.error('❌ Failed to initialize service container:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private initializeConfig(): void {
    this.services.config = createWebSocketConfig();
    logger.info('📄 Configuration loaded');
  }

  private async initializeInfrastructure(): Promise<void> {
    // Redis Manager - use infrastructure package helper
    const redisConfig = createRedisConfig();
    this.services.redisManager = new RedisManager(redisConfig);
    await this.services.redisManager.connect();
    logger.info('📦 Redis connected');
  }

  private initializeCoreServices(): void {
    const config = this.services.config!;
    
    // Metrics (independent)
    this.services.prometheusMetrics = new PrometheusMetrics();
    
    // Auth Service - calls external auth-service
    this.services.authService = new AuthService();
    
    // Connection Manager (in-memory, no Redis dependency for now)
    this.services.connectionManager = new ConnectionManager();
    
    // Load Balancer - Production Ready
    this.services.loadBalancer = new LoadBalancer({
      maxConnectionsPerInstance: config.get('MAX_CONNECTIONS') || 10000,
      healthCheckInterval: 30000, // 30 seconds
      instanceTTL: 120000, // 2 minutes
      algorithm: 'least-connections', // Use least-connections for better distribution
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        timeoutMs: 30000,
        resetTimeoutMs: 60000
      },
      redis: {
        enabled: true,
        keyPrefix: 'wsg:lb:',
        ttl: 60
      }
    }, this.services.redisManager);
    
    // Message Router
    this.services.messageRouter = new MessageRouter();
    
    // Kafka Consumer Service - for event streaming
    this.services.kafkaConsumerService = new KafkaConsumerService({
      brokers: (config.get('KAFKA_BROKERS') || 'localhost:9092').split(','),
      clientId: config.get('KAFKA_CLIENT_ID') || 'websocket-gateway',
      groupId: config.get('KAFKA_GROUP_ID') || 'websocket-gateway-group',
      topics: (config.get('KAFKA_TOPICS') || 'price.updates,order.book.updates,trade.notifications,portfolio.updates,system.alerts').split(','),
      sessionTimeout: config.get('KAFKA_SESSION_TIMEOUT') || 10000,
      heartbeatInterval: config.get('KAFKA_HEARTBEAT_INTERVAL') || 3000,
      maxBytesPerPartition: config.get('KAFKA_MAX_BYTES_PER_PARTITION') || 1048576
    });
    
    // Note: EventBroadcasterService will be initialized in Gateway after Socket.IO setup
    
    // Health Service (depends on auth service, redis, and kafka)
    const healthCheckableServices = [
      this.services.authService,
      // Wrap RedisManager to make it compatible with HealthCheckable
      this.services.redisManager ? {
        ...this.services.redisManager,
        isHealthy: async () => this.services.redisManager!.isHealthy()
      } : undefined,
      // Add Kafka health check
      {
        constructor: { name: 'KafkaConsumerService' },
        isHealthy: () => Promise.resolve(this.services.kafkaConsumerService!.isHealthy())
      }
    ].filter(service => service !== undefined);
    
    this.services.healthService = new HealthService(healthCheckableServices);
    
    logger.info('🔧 Core services initialized');
  }

  private initializeMiddleware(): void {
    const { authService } = this.services;
    
    // Socket Middleware - only needs auth service
    this.services.socketMiddleware = new SocketMiddleware({
      authService: authService!
    });
    
    logger.info('🛡️ Middleware initialized');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down service container...');
    
    try {
      // Shutdown Kafka consumer
      if (this.services.kafkaConsumerService) {
        await this.services.kafkaConsumerService.disconnect();
      }
      
      // Shutdown Redis manager
      if (this.services.redisManager) {
        await this.services.redisManager.disconnect();
      }
      
      logger.info('✅ Service container shut down successfully');
    } catch (error) {
      logger.error('❌ Error during shutdown:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Initialize EventBroadcasterService after Socket.IO is setup
  initializeEventBroadcaster(socketIoServer: any): void {
    if (!this.services.connectionManager || !this.services.prometheusMetrics) {
      throw new Error('Core services must be initialized before EventBroadcaster');
    }
    
    this.services.eventBroadcasterService = new EventBroadcasterService(
      socketIoServer,
      this.services.connectionManager,
      this.services.prometheusMetrics
    );
    
    logger.info('📡 EventBroadcasterService initialized');
  }

  // Getters for specific services
  getService<T extends keyof ServiceContainer>(serviceName: T): ServiceContainer[T] {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not initialized`);
    }
    return service;
  }
}

// Singleton instance
export const container = new Container(); 