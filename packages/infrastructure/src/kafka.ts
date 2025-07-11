import { Kafka, KafkaConfig, Producer, Consumer, ConsumerConfig, ProducerConfig, Admin, logLevel } from 'kafkajs';
import { createLogger, ServiceUnavailableError, generateId } from '@moonx-farm/common';

const logger = createLogger('kafka');

/**
 * Map log level strings to kafkajs enum values
 * KafkaJS log levels: NOTHING=0, ERROR=1, WARN=2, INFO=4, DEBUG=5
 */
function mapLogLevel(level: string): logLevel {
  switch (level) {
    case 'nothing': return logLevel.NOTHING;
    case 'error': return logLevel.ERROR;
    case 'warn': return logLevel.WARN;
    case 'info': return logLevel.INFO;
    case 'debug': return logLevel.DEBUG;
    default: return logLevel.WARN; // Default to WARN to reduce noise
  }
}

/**
 * Kafka configuration options
 */
export interface KafkaManagerConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  // Enhanced options
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'nothing';
  maxConnections?: number;
  idleConnectionTimeout?: number;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  enableMetrics?: boolean;
  transactionTimeout?: number;
  schemaRegistry?: {
    url: string;
    auth?: {
      username: string;
      password: string;
    };
  };
  // Additional enhanced options (backward compatible)
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
  maxTopicStats?: number;
  healthCheckInterval?: number;
  shutdownTimeout?: number;
  batchErrorIsolation?: boolean;
  enableMovingAverage?: boolean;
  movingAverageWindow?: number;
}

/**
 * Producer configuration
 */
export interface ProducerOptions extends Partial<ProducerConfig> {
  maxInFlightRequests?: number;
  idempotent?: boolean;
  transactionTimeout?: number;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  batchSize?: number;
  lingerMs?: number;
  maxRequestSize?: number;
  retryDelayMs?: number;
  enableTransactions?: boolean;
  transactionalId?: string;
}

/**
 * Consumer configuration
 */
export interface ConsumerOptions extends Partial<ConsumerConfig> {
  groupId: string;
  sessionTimeout?: number;
  rebalanceTimeout?: number;
  heartbeatInterval?: number;
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
  autoCommit?: boolean;
  autoCommitInterval?: number;
  partitionAssignmentStrategy?: string[];
  isolationLevel?: 'read_uncommitted' | 'read_committed';
  enableDeadLetterQueue?: boolean;
  deadLetterQueueTopic?: string;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
    maxRetryTime?: number;
  };
}

/**
 * Message publishing options
 */
export interface PublishOptions {
  topic: string;
  key?: string;
  partition?: number;
  timestamp?: string;
  headers?: Record<string, string>;
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  acks?: number;
  timeout?: number;
  schema?: string;
}

/**
 * Kafka metrics interface
 */
export interface KafkaMetrics {
  messagesProduced: number;
  messagesConsumed: number;
  producerErrors: number;
  consumerErrors: number;
  connectionErrors: number;
  averageProduceTime: number;
  averageConsumeTime: number;
  activeProducers: number;
  activeConsumers: number;
  topicStats: Record<string, {
    messagesProduced: number;
    messagesConsumed: number;
    errors: number;
  }>;
  // Enhanced metrics
  circuitBreaker?: {
    state: string;
    failures: number;
  };
}

/**
 * Circuit breaker for Kafka operations
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  getState(): { state: string; failures: number } {
    return { state: this.state, failures: this.failures };
  }
}

/**
 * Thread-safe metrics with memory management
 */
class ThreadSafeMetrics {
  private metrics: KafkaMetrics;
  private produceTimings: number[] = [];
  private consumeTimings: number[] = [];
  private maxTopicStats: number;
  private movingAverageWindow: number;
  private readonly lock = new Map<string, Promise<void>>();

  constructor(maxTopicStats = 1000, movingAverageWindow = 100) {
    this.maxTopicStats = maxTopicStats;
    this.movingAverageWindow = movingAverageWindow;
    this.metrics = {
      messagesProduced: 0,
      messagesConsumed: 0,
      producerErrors: 0,
      consumerErrors: 0,
      connectionErrors: 0,
      averageProduceTime: 0,
      averageConsumeTime: 0,
      activeProducers: 0,
      activeConsumers: 0,
      topicStats: {},
    };
  }

  async updateTopicStats(topic: string, action: 'produced' | 'consumed' | 'error', count = 1): Promise<void> {
    const lockKey = `topic_${topic}`;
    
    if (this.lock.has(lockKey)) {
      await this.lock.get(lockKey);
    }

    const lockPromise = this.updateTopicStatsUnsafe(topic, action, count);
    this.lock.set(lockKey, lockPromise);
    
    try {
      await lockPromise;
    } finally {
      this.lock.delete(lockKey);
    }
  }

  private async updateTopicStatsUnsafe(topic: string, action: 'produced' | 'consumed' | 'error', count = 1): Promise<void> {
    if (!this.metrics.topicStats[topic]) {
      // Memory management: remove oldest topics if limit reached
      const topicKeys = Object.keys(this.metrics.topicStats);
      if (topicKeys.length >= this.maxTopicStats) {
        const oldestTopic = topicKeys[0];
        delete this.metrics.topicStats[oldestTopic];
      }
      
      this.metrics.topicStats[topic] = {
        messagesProduced: 0,
        messagesConsumed: 0,
        errors: 0,
      };
    }

    const stats = this.metrics.topicStats[topic];
    switch (action) {
      case 'produced':
        stats.messagesProduced += count;
        this.metrics.messagesProduced += count;
        break;
      case 'consumed':
        stats.messagesConsumed += count;
        this.metrics.messagesConsumed += count;
        break;
      case 'error':
        stats.errors += count;
        break;
    }
  }

  updateAverageTime(action: 'produce' | 'consume', duration: number): void {
    if (action === 'produce') {
      this.produceTimings.push(duration);
      if (this.produceTimings.length > this.movingAverageWindow) {
        this.produceTimings.shift();
      }
      this.metrics.averageProduceTime = this.produceTimings.reduce((a, b) => a + b, 0) / this.produceTimings.length;
    } else {
      this.consumeTimings.push(duration);
      if (this.consumeTimings.length > this.movingAverageWindow) {
        this.consumeTimings.shift();
      }
      this.metrics.averageConsumeTime = this.consumeTimings.reduce((a, b) => a + b, 0) / this.consumeTimings.length;
    }
  }

  incrementCounter(key: keyof KafkaMetrics, count = 1): void {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number) += count;
    }
  }

  getMetrics(): KafkaMetrics {
    return { ...this.metrics };
  }

  setCircuitBreakerState(state: { state: string; failures: number }): void {
    this.metrics.circuitBreaker = state;
  }

  reset(): void {
    this.metrics = {
      messagesProduced: 0,
      messagesConsumed: 0,
      producerErrors: 0,
      consumerErrors: 0,
      connectionErrors: 0,
      averageProduceTime: 0,
      averageConsumeTime: 0,
      activeProducers: 0,
      activeConsumers: 0,
      topicStats: {},
    };
    this.produceTimings = [];
    this.consumeTimings = [];
  }
}

/**
 * Connection pool for managing Kafka connections
 */
class KafkaConnectionPool {
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private maxConnections: number;
  private idleTimeout: number;
  private lastUsed: Map<string, number> = new Map();
  private connectionLocks: Map<string, Promise<void>> = new Map();
  // Track active consumers to prevent cleanup
  private activeConsumers: Set<string> = new Set();

  constructor(maxConnections: number = 10, idleTimeout: number = 300000) {
    this.maxConnections = maxConnections;
    this.idleTimeout = idleTimeout;
    
    // Cleanup idle connections - but protect active consumers
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  async addProducer(id: string, producer: Producer): Promise<void> {
    const lockKey = `producer_${id}`;
    
    if (this.connectionLocks.has(lockKey)) {
      await this.connectionLocks.get(lockKey);
    }

    const lockPromise = this.addProducerUnsafe(id, producer);
    this.connectionLocks.set(lockKey, lockPromise);
    
    try {
      await lockPromise;
    } finally {
      this.connectionLocks.delete(lockKey);
    }
  }

  private async addProducerUnsafe(id: string, producer: Producer): Promise<void> {
    if (this.producers.size >= this.maxConnections) {
      await this.removeOldestProducer();
    }
    
    this.producers.set(id, producer);
    this.lastUsed.set(id, Date.now());
  }

  async addConsumer(id: string, consumer: Consumer): Promise<void> {
    const lockKey = `consumer_${id}`;
    
    if (this.connectionLocks.has(lockKey)) {
      await this.connectionLocks.get(lockKey);
    }

    const lockPromise = this.addConsumerUnsafe(id, consumer);
    this.connectionLocks.set(lockKey, lockPromise);
    
    try {
      await lockPromise;
    } finally {
      this.connectionLocks.delete(lockKey);
    }
  }

  private async addConsumerUnsafe(id: string, consumer: Consumer): Promise<void> {
    if (this.consumers.size >= this.maxConnections) {
      await this.removeOldestConsumer();
    }
    
    this.consumers.set(id, consumer);
    this.lastUsed.set(id, Date.now());
    this.activeConsumers.add(id);
  }

  getProducer(id: string): Producer | undefined {
    const producer = this.producers.get(id);
    if (producer) {
      this.lastUsed.set(id, Date.now());
    }
    return producer;
  }

  getConsumer(id: string): Consumer | undefined {
    const consumer = this.consumers.get(id);
    if (consumer) {
      this.lastUsed.set(id, Date.now());
      // Mark as active when accessed
      this.activeConsumers.add(id);
    }
    return consumer;
  }

  async removeProducer(id: string): Promise<void> {
    const producer = this.producers.get(id);
    if (producer) {
      try {
        await producer.disconnect();
      } catch (error) {
        logger.warn('Failed to disconnect producer', { id, error });
      }
      this.producers.delete(id);
      this.lastUsed.delete(id);
    }
  }

  async removeConsumer(id: string): Promise<void> {
    const consumer = this.consumers.get(id);
    if (consumer) {
      try {
        await consumer.disconnect();
      } catch (error) {
        logger.warn('Failed to disconnect consumer', { id, error });
      }
      this.consumers.delete(id);
      this.lastUsed.delete(id);
      this.activeConsumers.delete(id);
    }
  }

  private async removeOldestProducer(): Promise<void> {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, time] of this.lastUsed) {
      if (this.producers.has(id) && time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      await this.removeProducer(oldestId);
    }
  }

  private async removeOldestConsumer(): Promise<void> {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, time] of this.lastUsed) {
      if (this.consumers.has(id) && time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      await this.removeConsumer(oldestId);
    }
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const cleanupPromises: Promise<void>[] = [];
    
    for (const [id, lastUsedTime] of this.lastUsed) {
      // Skip cleanup for active consumers - they should stay connected
      if (this.activeConsumers.has(id) && this.consumers.has(id)) {
        logger.debug('Skipping cleanup for active consumer', { consumerId: id });
        continue;
      }
      
      if (now - lastUsedTime > this.idleTimeout) {
        if (this.producers.has(id)) {
          cleanupPromises.push(this.removeProducer(id));
        } else if (this.consumers.has(id)) {
          // Only cleanup inactive consumers
          logger.info('Cleaning up idle consumer', { 
            consumerId: id, 
            idleTime: now - lastUsedTime,
            isActive: this.activeConsumers.has(id)
          });
          cleanupPromises.push(this.removeConsumer(id));
        }
      }
    }
    
    await Promise.all(cleanupPromises);
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    
    for (const [id] of this.producers) {
      disconnectPromises.push(this.removeProducer(id));
    }
    
    for (const [id] of this.consumers) {
      disconnectPromises.push(this.removeConsumer(id));
    }
    
    await Promise.all(disconnectPromises);
  }

  getStats(): { producers: number; consumers: number } {
    return {
      producers: this.producers.size,
      consumers: this.consumers.size,
    };
  }
}

/**
 * Enhanced Kafka manager class
 */
export class KafkaManager {
  private kafka: Kafka;
  private connectionPool: KafkaConnectionPool;
  private admin?: Admin;
  private isConnected = false;
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;
  private threadSafeMetrics: ThreadSafeMetrics;
  private circuitBreaker?: CircuitBreaker;
  private config: KafkaManagerConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: KafkaManagerConfig) {
    this.config = {
      // Set enhanced defaults
      maxTopicStats: 1000,
      healthCheckInterval: 30000,
      shutdownTimeout: 30000,
      batchErrorIsolation: true,
      enableMovingAverage: true,
      movingAverageWindow: 100,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 30000,
      ...config,
    };
    
    this.connectionPool = new KafkaConnectionPool(
      this.config.maxConnections || 10,
      this.config.idleConnectionTimeout || 300000
    );
    
    this.threadSafeMetrics = new ThreadSafeMetrics(
      this.config.maxTopicStats,
      this.config.movingAverageWindow
    );

    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerResetTimeout
      );
    }

    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl as any,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
      logLevel: mapLogLevel(config.logLevel || 'warn'),
      retry: {
        initialRetryTime: config.retry?.initialRetryTime || 100,
        retries: config.retry?.retries || 8,
      },
    };

    this.kafka = new Kafka(kafkaConfig);
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // REMOVED: Global signal handlers that cause unexpected consumer disconnections
    // Applications should manage their own lifecycle and call gracefulShutdown() explicitly
    // 
    // Previously was:
    // process.on('SIGINT', () => this.gracefulShutdown());
    // process.on('SIGTERM', () => this.gracefulShutdown());
    // process.on('exit', () => this.gracefulShutdown());
    
    // Infrastructure should NOT manage process lifecycle automatically
    // Each service should handle shutdown explicitly in their main application code
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    const connectOperation = async () => {
      // Test connection by creating and immediately disconnecting a producer
      const testProducer = this.kafka.producer();
      await testProducer.connect();
      await testProducer.disconnect();

      // Initialize admin client
      this.admin = this.kafka.admin();
      await this.admin.connect();

      this.isConnected = true;
      
      // Start health check
      if (this.config.enableMetrics) {
        this.startHealthCheck();
      }
      
      logger.info('Enhanced Kafka connected successfully', {
        clientId: this.config.clientId,
        brokers: this.config.brokers,
        enableMetrics: this.config.enableMetrics,
        circuitBreaker: this.config.enableCircuitBreaker,
      });
    };

    try {
      if (this.circuitBreaker) {
        await this.circuitBreaker.execute(connectOperation);
      } else {
        await connectOperation();
      }
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('connectionErrors');
      logger.error('Kafka connection failed', { error: err.message });
      throw new ServiceUnavailableError('Failed to connect to Kafka', {
        originalError: err.message,
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    logger.info('Starting enhanced Kafka graceful shutdown...');

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    const shutdownTimeout = setTimeout(() => {
      logger.warn('Kafka shutdown timeout reached, forcing shutdown');
    }, this.config.shutdownTimeout);

    try {
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Disconnect all connections
      await this.connectionPool.disconnectAll();

      // Disconnect admin client
      if (this.admin) {
        await this.admin.disconnect();
      }

      this.isConnected = false;
      logger.info('Enhanced Kafka graceful shutdown completed');
    } catch (error) {
      const err = error as Error;
      logger.error('Enhanced Kafka graceful shutdown failed', { error: err.message });
    } finally {
      clearTimeout(shutdownTimeout);
    }
  }

  /**
   * Disconnect all producers and consumers
   */
  async disconnect(): Promise<void> {
    await this.gracefulShutdown();
  }

  /**
   * Create or get a producer with enhanced options
   */
  async createProducer(
    id: string = 'default',
    options: ProducerOptions = {}
  ): Promise<Producer> {
    const existingProducer = this.connectionPool.getProducer(id);
    if (existingProducer) {
      return existingProducer;
    }

    try {
      const producer = this.kafka.producer({
        maxInFlightRequests: options.maxInFlightRequests || 1,
        idempotent: options.idempotent ?? true,
        transactionTimeout: options.transactionTimeout || 30000,
        compression: options.compression || this.config.compression,
        ...options,
      });

      await producer.connect();
      
      // Enable transactions if requested
      if (options.enableTransactions && options.transactionalId) {
        // Transaction will be handled by the producer when sending messages
        logger.info('Producer configured for transactions', { 
          producerId: id,
          transactionalId: options.transactionalId,
        });
      }

      await this.connectionPool.addProducer(id, producer);
      this.threadSafeMetrics.incrementCounter('activeProducers');

      logger.info('Kafka producer created', { 
        producerId: id,
        transactional: options.enableTransactions,
        compression: options.compression,
      });
      
      return producer;
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('producerErrors');
      logger.error('Failed to create Kafka producer', {
        producerId: id,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to create Kafka producer', {
        producerId: id,
        originalError: err.message,
      });
    }
  }

  /**
   * Create or get a consumer with enhanced options
   */
  async createConsumer(
    id: string,
    options: ConsumerOptions
  ): Promise<Consumer> {
    const existingConsumer = this.connectionPool.getConsumer(id);
    if (existingConsumer) {
      return existingConsumer;
    }

    try {
      const consumer = this.kafka.consumer({
        ...options,
        groupId: options.groupId,
        sessionTimeout: options.sessionTimeout || 30000,
        rebalanceTimeout: options.rebalanceTimeout || 60000,
        heartbeatInterval: options.heartbeatInterval || 3000,
        maxBytesPerPartition: options.maxBytesPerPartition || 1048576,
        minBytes: options.minBytes || 1,
        maxBytes: options.maxBytes || 10485760,
        maxWaitTimeInMs: options.maxWaitTimeInMs || 5000,
        allowAutoTopicCreation: false,
        retry: {
          initialRetryTime: options.retry?.initialRetryTime || 100,
          retries: options.retry?.retries || 8,
          maxRetryTime: options.retry?.maxRetryTime || 30000,
        },
      });

      await consumer.connect();
      await this.connectionPool.addConsumer(id, consumer);
      this.threadSafeMetrics.incrementCounter('activeConsumers');

      logger.info('Kafka consumer created', {
        consumerId: id,
        groupId: options.groupId,
        isolationLevel: options.isolationLevel,
      });

      return consumer;
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('consumerErrors');
      logger.error('Failed to create Kafka consumer', {
        consumerId: id,
        groupId: options.groupId,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to create Kafka consumer', {
        consumerId: id,
        originalError: err.message,
      });
    }
  }

  /**
   * Enhanced publish with metrics and retries
   */
  async publish<T = any>(
    data: T,
    options: PublishOptions,
    producerId: string = 'default'
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const producer = await this.createProducer(producerId);

      const message = {
        key: options.key,
        value: JSON.stringify(data),
        partition: options.partition,
        timestamp: options.timestamp,
        headers: options.headers,
      };

      await producer.send({
        topic: options.topic,
        messages: [message],
        acks: options.acks || -1,
        timeout: options.timeout || 30000,
      });

      // Update metrics
      await this.threadSafeMetrics.updateTopicStats(options.topic, 'produced');
      this.threadSafeMetrics.updateAverageTime('produce', Date.now() - startTime);

      // Only log slow operations to reduce noise
      if (Date.now() - startTime > 1000) {
        logger.info('Slow message publish to Kafka', {
          topic: options.topic,
          key: options.key,
          producerId,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('producerErrors');
      await this.threadSafeMetrics.updateTopicStats(options.topic, 'error');
      
      logger.error('Failed to publish message to Kafka', {
        topic: options.topic,
        key: options.key,
        producerId,
        error: err.message,
        duration: Date.now() - startTime,
      });
      
      throw new ServiceUnavailableError('Failed to publish Kafka message', {
        topic: options.topic,
        key: options.key,
        originalError: err.message,
      });
    }
  }

  /**
   * Enhanced batch publish with compression and optimization
   */
  async publishBatch<T = any>(
    messages: Array<{ data: T; options: PublishOptions }>,
    producerId: string = 'default'
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const producer = await this.createProducer(producerId);

      // Group messages by topic and optimize batching
      const messagesByTopic = messages.reduce((acc, { data, options }) => {
        if (!acc[options.topic]) {
          acc[options.topic] = [];
        }
        acc[options.topic].push({
          key: options.key,
          value: JSON.stringify(data),
          partition: options.partition,
          timestamp: options.timestamp,
          headers: options.headers,
        });
        return acc;
      }, {} as Record<string, any[]>);

      // Send messages for each topic
      const batch = Object.entries(messagesByTopic).map(([topic, msgs]) => ({
        topic,
        messages: msgs,
      }));

      await producer.sendBatch({ 
        topicMessages: batch,
        acks: -1,
        timeout: 30000,
      });

      // Update metrics
      for (const topic of Object.keys(messagesByTopic)) {
        await this.threadSafeMetrics.updateTopicStats(topic, 'produced', messagesByTopic[topic].length);
      }
      this.threadSafeMetrics.updateAverageTime('produce', Date.now() - startTime);

      // Only log batch operations that are slow or large
      if (Date.now() - startTime > 1000 || messages.length > 100) {
        logger.info('Kafka batch publish completed', {
          messageCount: messages.length,
          topics: Object.keys(messagesByTopic),
          producerId,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('producerErrors');
      
      logger.error('Failed to publish batch messages to Kafka', {
        messageCount: messages.length,
        producerId,
        error: err.message,
        duration: Date.now() - startTime,
      });
      
      throw new ServiceUnavailableError('Failed to publish Kafka batch', {
        messageCount: messages.length,
        originalError: err.message,
      });
    }
  }

  /**
   * Enhanced subscribe with dead letter queue support
   */
  async subscribe(
    consumerId: string,
    topics: string[],
    options: ConsumerOptions,
    handler: (topic: string, message: any, rawMessage: any) => Promise<void>
  ): Promise<void> {
    try {
      const consumer = await this.createConsumer(consumerId, options);

      await consumer.subscribe({
        topics,
        fromBeginning: false,
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const startTime = Date.now();
          const messageId = generateId();
          
          try {
            const value = message.value?.toString();
            if (!value) {
              logger.warn('Received empty message', { topic, partition, messageId });
              return;
            }

            const parsedMessage = JSON.parse(value);
            
            await handler(topic, parsedMessage, message);
            
            // Update metrics
            await this.threadSafeMetrics.updateTopicStats(topic, 'consumed');
            this.threadSafeMetrics.updateAverageTime('consume', Date.now() - startTime);
            
            // Only log slow message processing to reduce noise
            const processingTime = Date.now() - startTime;
            if (processingTime > 1000) {
              logger.info('Slow Kafka message processing', {
                topic,
                partition,
                offset: message.offset,
                messageId,
                consumerId,
                duration: processingTime,
              });
            }
          } catch (error) {
            const err = error as Error;
            this.threadSafeMetrics.incrementCounter('consumerErrors');
            await this.threadSafeMetrics.updateTopicStats(topic, 'error');
            
            logger.error('Failed to process Kafka message', {
              topic,
              partition,
              offset: message.offset,
              messageId,
              consumerId,
              error: err.message,
              duration: Date.now() - startTime,
            });
            
            // Send to dead letter queue if enabled
            if (options.enableDeadLetterQueue && options.deadLetterQueueTopic) {
              await this.sendToDeadLetterQueue(
                options.deadLetterQueueTopic,
                message,
                err.message,
                topic
              );
            }
          }
        },
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          // Process messages in batch for better performance
          await this.processMessagesBatch(batch.messages, batch.topic, handler, consumerId, options);
          
          for (const message of batch.messages) {
            resolveOffset(message.offset);
            await heartbeat();
          }
        },
      });

      logger.info('Kafka consumer subscribed and running', {
        consumerId,
        topics,
        groupId: options.groupId,
        deadLetterQueue: options.enableDeadLetterQueue,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to subscribe Kafka consumer', {
        consumerId,
        topics,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to subscribe Kafka consumer', {
        consumerId,
        topics,
        originalError: err.message,
      });
    }
  }

  /**
   * Process individual message (helper for batch processing)
   */
  private async processMessage(
    message: any,
    topic: string,
    handler: (topic: string, message: any, rawMessage: any) => Promise<void>,
    consumerId: string,
    options?: { enableDeadLetterQueue?: boolean; deadLetterQueueTopic?: string }
  ): Promise<void> {
    const startTime = Date.now();
    const messageId = generateId();
    
    try {
      const value = message.value?.toString();
      if (!value) {
        logger.warn('Received empty message', { topic, messageId });
        return;
      }

      const parsedMessage = JSON.parse(value);
      await handler(topic, parsedMessage, message);
      
      // Update metrics
      await this.threadSafeMetrics.updateTopicStats(topic, 'consumed');
      this.threadSafeMetrics.updateAverageTime('consume', Date.now() - startTime);
      
    } catch (error) {
      const err = error as Error;
      this.threadSafeMetrics.incrementCounter('consumerErrors');
      await this.threadSafeMetrics.updateTopicStats(topic, 'error');
      
      logger.error('Failed to process message in batch', {
        topic,
        messageId,
        consumerId,
        error: err.message,
      });
      
      // Send to dead letter queue if enabled
      if (options?.enableDeadLetterQueue && options?.deadLetterQueueTopic) {
        await this.sendToDeadLetterQueue(
          options.deadLetterQueueTopic,
          message,
          err.message,
          topic
        );
      }
      
      throw error;
    }
  }

  /**
   * Process messages batch with error isolation
   */
  async processMessagesBatch(
    messages: any[],
    topic: string,
    handler: (topic: string, message: any, rawMessage: any) => Promise<void>,
    consumerId: string,
    options?: { enableDeadLetterQueue?: boolean; deadLetterQueueTopic?: string }
  ): Promise<void> {
    if (!this.config.batchErrorIsolation) {
      // Original behavior for backward compatibility
      for (const message of messages) {
        await this.processMessage(message, topic, handler, consumerId, options);
      }
      return;
    }

    // Process messages with error isolation
    const results = await Promise.allSettled(
      messages.map(message => this.processMessage(message, topic, handler, consumerId, options))
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Batch processing completed with errors', {
        total: messages.length,
        failures: failures.length,
        topic,
        consumerId,
      });
    }
  }

  /**
   * Send message to dead letter queue
   */
  private async sendToDeadLetterQueue(
    deadLetterTopic: string,
    originalMessage: any,
    errorMessage: string,
    originalTopic: string
  ): Promise<void> {
    try {
      const retryCount = parseInt(originalMessage.headers?.retryCount || '0') + 1;
      
      // Prevent infinite loops in DLQ
      if (retryCount > 3) {
        logger.error('Max retry count exceeded for DLQ message', {
          originalTopic,
          errorMessage,
          retryCount,
        });
        return;
      }

      const dlqMessage = {
        originalTopic,
        errorMessage,
        originalMessage: originalMessage.value?.toString(),
        timestamp: new Date().toISOString(),
        headers: originalMessage.headers,
        retryCount,
      };

      // Use circuit breaker for DLQ to prevent cascading failures
      const dlqOperation = () => this.publish(dlqMessage, {
        topic: deadLetterTopic,
        key: originalMessage.key?.toString(),
        headers: { retryCount: retryCount.toString() },
      });

      if (this.circuitBreaker) {
        await this.circuitBreaker.execute(dlqOperation);
      } else {
        await dlqOperation();
      }
      
      logger.info('Message sent to dead letter queue', {
        originalTopic,
        deadLetterTopic,
        retryCount,
      });
    } catch (error) {
      logger.error('Failed to send message to dead letter queue', {
        originalTopic,
        deadLetterTopic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.admin && this.isConnected) {
          await this.admin.listTopics();
        }
      } catch (error) {
        this.threadSafeMetrics.incrementCounter('connectionErrors');
        logger.warn('Kafka health check failed', { error });
      }
    }, this.config.healthCheckInterval || 30000);
  }

  /**
   * Check if Kafka is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isConnected || this.isShuttingDown) {
        return false;
      }

      // Test admin connection
      if (this.admin) {
        await this.admin.listTopics();
      }

      return true;
    } catch (error) {
      logger.error('Kafka health check failed', { error });
      return false;
    }
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): KafkaMetrics {
    const poolStats = this.connectionPool.getStats();
    const metrics = this.threadSafeMetrics.getMetrics();
    
    // Update circuit breaker state in metrics
    if (this.circuitBreaker) {
      this.threadSafeMetrics.setCircuitBreakerState(this.circuitBreaker.getState());
    }
    
    return {
      ...metrics,
      activeProducers: poolStats.producers,
      activeConsumers: poolStats.consumers,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.threadSafeMetrics.reset();
  }

  /**
   * Get admin client for topic management
   */
  getAdmin(): Admin {
    if (!this.admin) {
      throw new Error('Admin client not initialized. Call connect() first.');
    }
    return this.admin;
  }

  /**
   * Create topics with enhanced options
   */
  async createTopics(
    topics: Array<{
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
      configEntries?: Array<{ name: string; value: string }>;
    }>
  ): Promise<void> {
    const admin = this.getAdmin();
    
    try {
      const topicConfigs = topics.map(({ 
        topic, 
        numPartitions = 1, 
        replicationFactor = 1,
        configEntries = []
      }) => ({
        topic,
        numPartitions,
        replicationFactor,
        configEntries,
      }));

      await admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true,
        timeout: 30000,
      });

      logger.info('Kafka topics created', { 
        topics: topics.map(t => t.topic),
        count: topics.length,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to create Kafka topics', {
        topics: topics.map(t => t.topic),
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to create Kafka topics', {
        topics,
        originalError: err.message,
      });
    }
  }

  /**
   * Delete topics
   */
  async deleteTopics(topics: string[]): Promise<void> {
    const admin = this.getAdmin();
    
    try {
      await admin.deleteTopics({
        topics,
        timeout: 30000,
      });

      logger.info('Kafka topics deleted', { topics });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to delete Kafka topics', {
        topics,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to delete Kafka topics', {
        topics,
        originalError: err.message,
      });
    }
  }

  /**
   * List all topics
   */
  async listTopics(): Promise<string[]> {
    const admin = this.getAdmin();
    
    try {
      return await admin.listTopics();
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to list Kafka topics', { error: err.message });
      throw new ServiceUnavailableError('Failed to list Kafka topics', {
        originalError: err.message,
      });
    }
  }

  /**
   * Get topic metadata
   */
  async getTopicMetadata(topics: string[]): Promise<any> {
    const admin = this.getAdmin();
    
    try {
      return await admin.fetchTopicMetadata({ topics });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to fetch topic metadata', { 
        topics, 
        error: err.message 
      });
      throw new ServiceUnavailableError('Failed to fetch topic metadata', {
        topics,
        originalError: err.message,
      });
    }
  }
}

/**
 * Create a Kafka manager instance
 */
export function createKafka(config: KafkaManagerConfig): KafkaManager {
  return new KafkaManager(config);
}

/**
 * Create enhanced Kafka configuration from environment
 */
export function createKafkaConfig(): KafkaManagerConfig {
  const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
  
  return {
    clientId: process.env.KAFKA_CLIENT_ID || 'moonx-farm',
    brokers,
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD ? {
      mechanism: (process.env.KAFKA_SASL_MECHANISM as any) || 'plain',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    } : undefined,
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000'),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000'),
    logLevel: process.env.KAFKA_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'nothing' || 'warn',
    maxConnections: parseInt(process.env.KAFKA_MAX_CONNECTIONS || '10'),
    idleConnectionTimeout: parseInt(process.env.KAFKA_IDLE_TIMEOUT || '300000'),
    compression: (process.env.KAFKA_COMPRESSION as any) || 'gzip',
    enableMetrics: process.env.KAFKA_ENABLE_METRICS === 'true',
    transactionTimeout: parseInt(process.env.KAFKA_TRANSACTION_TIMEOUT || '30000'),
    
    // Enhanced options with environment support
    enableCircuitBreaker: process.env.KAFKA_ENABLE_CIRCUIT_BREAKER !== 'false',
    circuitBreakerThreshold: parseInt(process.env.KAFKA_CIRCUIT_BREAKER_THRESHOLD || '5'),
    circuitBreakerResetTimeout: parseInt(process.env.KAFKA_CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
    maxTopicStats: parseInt(process.env.KAFKA_MAX_TOPIC_STATS || '1000'),
    healthCheckInterval: parseInt(process.env.KAFKA_HEALTH_CHECK_INTERVAL || '30000'),
    shutdownTimeout: parseInt(process.env.KAFKA_SHUTDOWN_TIMEOUT || '30000'),
    batchErrorIsolation: process.env.KAFKA_BATCH_ERROR_ISOLATION !== 'false',
    enableMovingAverage: process.env.KAFKA_ENABLE_MOVING_AVERAGE !== 'false',
    movingAverageWindow: parseInt(process.env.KAFKA_MOVING_AVERAGE_WINDOW || '100'),
    
    retry: {
      initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_TIME || '100'),
      retries: parseInt(process.env.KAFKA_RETRY_COUNT || '8'),
    },
    schemaRegistry: process.env.KAFKA_SCHEMA_REGISTRY_URL ? {
      url: process.env.KAFKA_SCHEMA_REGISTRY_URL,
      auth: process.env.KAFKA_SCHEMA_REGISTRY_USERNAME && process.env.KAFKA_SCHEMA_REGISTRY_PASSWORD ? {
        username: process.env.KAFKA_SCHEMA_REGISTRY_USERNAME,
        password: process.env.KAFKA_SCHEMA_REGISTRY_PASSWORD,
      } : undefined,
    } : undefined,
  };
}