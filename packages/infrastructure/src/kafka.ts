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

  constructor(maxConnections: number = 10, idleTimeout: number = 300000) {
    this.maxConnections = maxConnections;
    this.idleTimeout = idleTimeout;
    
    // Cleanup idle connections
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  addProducer(id: string, producer: Producer): void {
    if (this.producers.size >= this.maxConnections) {
      this.removeOldestProducer();
    }
    
    this.producers.set(id, producer);
    this.lastUsed.set(id, Date.now());
  }

  addConsumer(id: string, consumer: Consumer): void {
    if (this.consumers.size >= this.maxConnections) {
      this.removeOldestConsumer();
    }
    
    this.consumers.set(id, consumer);
    this.lastUsed.set(id, Date.now());
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
    }
    return consumer;
  }

  async removeProducer(id: string): Promise<void> {
    const producer = this.producers.get(id);
    if (producer) {
      await producer.disconnect();
      this.producers.delete(id);
      this.lastUsed.delete(id);
    }
  }

  async removeConsumer(id: string): Promise<void> {
    const consumer = this.consumers.get(id);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(id);
      this.lastUsed.delete(id);
    }
  }

  private removeOldestProducer(): void {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, time] of this.lastUsed) {
      if (this.producers.has(id) && time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.removeProducer(oldestId);
    }
  }

  private removeOldestConsumer(): void {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, time] of this.lastUsed) {
      if (this.consumers.has(id) && time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.removeConsumer(oldestId);
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    
    for (const [id, lastUsedTime] of this.lastUsed) {
      if (now - lastUsedTime > this.idleTimeout) {
        if (this.producers.has(id)) {
          this.removeProducer(id);
        } else if (this.consumers.has(id)) {
          this.removeConsumer(id);
        }
      }
    }
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
  private metrics: KafkaMetrics;
  private config: KafkaManagerConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: KafkaManagerConfig) {
    this.config = config;
    this.connectionPool = new KafkaConnectionPool(
      config.maxConnections || 10,
      config.idleConnectionTimeout || 300000
    );
    
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
    // Graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('exit', () => this.gracefulShutdown());
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
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
      
      logger.info('Kafka connected successfully', {
        clientId: this.config.clientId,
        brokers: this.config.brokers,
        enableMetrics: this.config.enableMetrics,
      });
    } catch (error) {
      const err = error as Error;
      this.metrics.connectionErrors++;
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
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting Kafka graceful shutdown...');

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
      logger.info('Kafka graceful shutdown completed');
    } catch (error) {
      const err = error as Error;
      logger.error('Kafka graceful shutdown failed', { error: err.message });
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

      this.connectionPool.addProducer(id, producer);
      this.metrics.activeProducers++;

      logger.info('Kafka producer created', { 
        producerId: id,
        transactional: options.enableTransactions,
        compression: options.compression,
      });
      
      return producer;
    } catch (error) {
      const err = error as Error;
      this.metrics.producerErrors++;
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
      this.connectionPool.addConsumer(id, consumer);
      this.metrics.activeConsumers++;

      logger.info('Kafka consumer created', {
        consumerId: id,
        groupId: options.groupId,
        isolationLevel: options.isolationLevel,
      });

      return consumer;
    } catch (error) {
      const err = error as Error;
      this.metrics.consumerErrors++;
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
      this.metrics.messagesProduced++;
      this.updateTopicStats(options.topic, 'produced');
      this.updateAverageTime('produce', Date.now() - startTime);

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
      this.metrics.producerErrors++;
      this.updateTopicStats(options.topic, 'error');
      
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
      this.metrics.messagesProduced += messages.length;
      Object.keys(messagesByTopic).forEach(topic => {
        this.updateTopicStats(topic, 'produced', messagesByTopic[topic].length);
      });
      this.updateAverageTime('produce', Date.now() - startTime);

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
      this.metrics.producerErrors++;
      
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
            this.metrics.messagesConsumed++;
            this.updateTopicStats(topic, 'consumed');
            this.updateAverageTime('consume', Date.now() - startTime);
            
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
            this.metrics.consumerErrors++;
            this.updateTopicStats(topic, 'error');
            
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
          for (const message of batch.messages) {
            await this.processMessage(message, batch.topic, handler, consumerId);
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
    consumerId: string
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
      this.metrics.messagesConsumed++;
      this.updateTopicStats(topic, 'consumed');
      this.updateAverageTime('consume', Date.now() - startTime);
      
    } catch (error) {
      const err = error as Error;
      this.metrics.consumerErrors++;
      this.updateTopicStats(topic, 'error');
      
      logger.error('Failed to process message in batch', {
        topic,
        messageId,
        consumerId,
        error: err.message,
      });
      
      throw error;
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
      const dlqMessage = {
        originalTopic,
        errorMessage,
        originalMessage: originalMessage.value?.toString(),
        timestamp: new Date().toISOString(),
        headers: originalMessage.headers,
      };

      await this.publish(dlqMessage, {
        topic: deadLetterTopic,
        key: originalMessage.key?.toString(),
      });
      
      logger.info('Message sent to dead letter queue', {
        originalTopic,
        deadLetterTopic,
        errorMessage,
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
   * Update topic statistics
   */
  private updateTopicStats(topic: string, action: 'produced' | 'consumed' | 'error', count = 1): void {
    if (!this.metrics.topicStats[topic]) {
      this.metrics.topicStats[topic] = {
        messagesProduced: 0,
        messagesConsumed: 0,
        errors: 0,
      };
    }

    switch (action) {
      case 'produced':
        this.metrics.topicStats[topic].messagesProduced += count;
        break;
      case 'consumed':
        this.metrics.topicStats[topic].messagesConsumed += count;
        break;
      case 'error':
        this.metrics.topicStats[topic].errors += count;
        break;
    }
  }

  /**
   * Update average processing time
   */
  private updateAverageTime(action: 'produce' | 'consume', duration: number): void {
    if (action === 'produce') {
      this.metrics.averageProduceTime = 
        (this.metrics.averageProduceTime + duration) / 2;
    } else {
      this.metrics.averageConsumeTime = 
        (this.metrics.averageConsumeTime + duration) / 2;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.admin) {
          await this.admin.listTopics();
        }
      } catch (error) {
        this.metrics.connectionErrors++;
        logger.warn('Kafka health check failed', { error });
      }
    }, 30000); // Every 30 seconds
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
    return {
      ...this.metrics,
      activeProducers: poolStats.producers,
      activeConsumers: poolStats.consumers,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
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