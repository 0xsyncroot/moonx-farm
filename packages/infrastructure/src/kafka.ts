import { Kafka, KafkaConfig, Producer, Consumer, ConsumerConfig, ProducerConfig } from 'kafkajs';
import { createLogger, ServiceUnavailableError, generateId } from '@moonx-farm/common';

const logger = createLogger('kafka');

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
}

/**
 * Producer configuration
 */
export interface ProducerOptions extends Partial<ProducerConfig> {
  maxInFlightRequests?: number;
  idempotent?: boolean;
  transactionTimeout?: number;
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
  retry?: {
    initialRetryTime?: number;
    retries?: number;
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
}

/**
 * Kafka manager class
 */
export class KafkaManager {
  private kafka: Kafka;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private isConnected = false;

  constructor(config: KafkaManagerConfig) {
    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl as any,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
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
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  /**
   * Connect to Kafka (test connection)
   */
  async connect(): Promise<void> {
    try {
      // Test connection by creating and immediately disconnecting a producer
      const testProducer = this.kafka.producer();
      await testProducer.connect();
      await testProducer.disconnect();

      this.isConnected = true;
      logger.info('Kafka connected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Kafka connection failed', { error: err.message });
      throw new ServiceUnavailableError('Failed to connect to Kafka', {
        originalError: err.message,
      });
    }
  }

  /**
   * Disconnect all producers and consumers
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect all producers
      for (const [id, producer] of this.producers) {
        await producer.disconnect();
        logger.debug('Producer disconnected', { producerId: id });
      }

      // Disconnect all consumers
      for (const [id, consumer] of this.consumers) {
        await consumer.disconnect();
        logger.debug('Consumer disconnected', { consumerId: id });
      }

      this.producers.clear();
      this.consumers.clear();
      this.isConnected = false;

      logger.info('Kafka disconnected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Kafka disconnection failed', { error: err.message });
    }
  }

  /**
   * Create or get a producer
   */
  async createProducer(
    id: string = 'default',
    options: ProducerOptions = {}
  ): Promise<Producer> {
    if (this.producers.has(id)) {
      return this.producers.get(id)!;
    }

    try {
      const producer = this.kafka.producer({
        maxInFlightRequests: options.maxInFlightRequests || 1,
        idempotent: options.idempotent || true,
        transactionTimeout: options.transactionTimeout || 30000,
        ...options,
      });

      await producer.connect();
      this.producers.set(id, producer);

      logger.info('Kafka producer created', { producerId: id });
      return producer;
    } catch (error) {
      const err = error as Error;
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
   * Create or get a consumer
   */
  async createConsumer(
    id: string,
    options: ConsumerOptions
  ): Promise<Consumer> {
    if (this.consumers.has(id)) {
      return this.consumers.get(id)!;
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
        retry: {
          initialRetryTime: options.retry?.initialRetryTime || 100,
          retries: options.retry?.retries || 8,
        },
      });

      await consumer.connect();
      this.consumers.set(id, consumer);

      logger.info('Kafka consumer created', {
        consumerId: id,
        groupId: options.groupId,
      });

      return consumer;
    } catch (error) {
      const err = error as Error;
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
   * Publish a message to a topic
   */
  async publish<T = any>(
    data: T,
    options: PublishOptions,
    producerId: string = 'default'
  ): Promise<void> {
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
      });

      logger.debug('Message published to Kafka', {
        topic: options.topic,
        key: options.key,
        producerId,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to publish message to Kafka', {
        topic: options.topic,
        key: options.key,
        producerId,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to publish Kafka message', {
        topic: options.topic,
        key: options.key,
        originalError: err.message,
      });
    }
  }

  /**
   * Publish multiple messages in batch
   */
  async publishBatch<T = any>(
    messages: Array<{ data: T; options: PublishOptions }>,
    producerId: string = 'default'
  ): Promise<void> {
    try {
      const producer = await this.createProducer(producerId);

      // Group messages by topic
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

      await producer.sendBatch({ topicMessages: batch });

      logger.debug('Batch messages published to Kafka', {
        messageCount: messages.length,
        topics: Object.keys(messagesByTopic),
        producerId,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to publish batch messages to Kafka', {
        messageCount: messages.length,
        producerId,
        error: err.message,
      });
      throw new ServiceUnavailableError('Failed to publish Kafka batch', {
        messageCount: messages.length,
        originalError: err.message,
      });
    }
  }

  /**
   * Subscribe to topics with a consumer
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
          const messageId = generateId();
          
          try {
            const value = message.value?.toString();
            if (!value) {
              logger.warn('Received empty message', { topic, partition, messageId });
              return;
            }

            const parsedMessage = JSON.parse(value);
            
            logger.debug('Processing Kafka message', {
              topic,
              partition,
              offset: message.offset,
              messageId,
              consumerId,
            });

            await handler(topic, parsedMessage, message);
            
            logger.debug('Kafka message processed successfully', {
              topic,
              partition,
              offset: message.offset,
              messageId,
              consumerId,
            });
          } catch (error) {
            const err = error as Error;
            logger.error('Failed to process Kafka message', {
              topic,
              partition,
              offset: message.offset,
              messageId,
              consumerId,
              error: err.message,
            });
            
            // Don't throw here to avoid consumer crash
            // Consider implementing dead letter queue logic
          }
        },
      });

      logger.info('Kafka consumer subscribed and running', {
        consumerId,
        topics,
        groupId: options.groupId,
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
   * Check if Kafka is healthy
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get admin client for topic management
   */
  getAdmin() {
    return this.kafka.admin();
  }

  /**
   * Create topics if they don't exist
   */
  async createTopics(topics: Array<{ topic: string; numPartitions?: number; replicationFactor?: number }>): Promise<void> {
    const admin = this.getAdmin();
    
    try {
      await admin.connect();
      
      const topicConfigs = topics.map(({ topic, numPartitions = 1, replicationFactor = 1 }) => ({
        topic,
        numPartitions,
        replicationFactor,
      }));

      await admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true,
      });

      logger.info('Kafka topics created', { topics: topics.map(t => t.topic) });
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
    } finally {
      await admin.disconnect();
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
 * Create Kafka configuration from environment
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
    retry: {
      initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_TIME || '100'),
      retries: parseInt(process.env.KAFKA_RETRY_COUNT || '8'),
    },
  };
} 