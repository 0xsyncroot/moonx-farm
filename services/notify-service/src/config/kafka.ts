import { Kafka, Consumer } from 'kafkajs';
import { logger } from '../utils/logger';

export const createKafkaConsumer = (): Consumer => {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'notify-service',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    retry: {
      retries: 5,
      initialRetryTime: 100,
      maxRetryTime: 30000
    },
    connectionTimeout: 3000,
    requestTimeout: 30000,
    logLevel: process.env.NODE_ENV === 'production' ? 1 : 4 // ERROR in prod, DEBUG in dev
  });

  const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'notify-service-group',
    sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000'),
    heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000'),
    maxBytesPerPartition: 1048576, // 1MB
    minBytes: 1,
    maxBytes: 10485760, // 10MB
    maxWaitTimeInMs: 5000,
    retry: {
      retries: 8,
      initialRetryTime: 100,
      maxRetryTime: 30000
    },
    allowAutoTopicCreation: true
  });

  // Error handling
  consumer.on('consumer.crash', (error) => {
    logger.error('Kafka consumer crashed:', error);
  });

  consumer.on('consumer.disconnect', () => {
    logger.warn('Kafka consumer disconnected');
  });

  consumer.on('consumer.connect', () => {
    logger.info('Kafka consumer connected');
  });

  return consumer;
};

export const KAFKA_TOPICS = {
  SWAP_EVENTS: 'swap-events',
  ORDER_EVENTS: 'order-events',
  PRICE_UPDATES: 'price-updates',
  PORTFOLIO_UPDATES: 'portfolio-updates',
  SYSTEM_ALERTS: 'system-alerts',
  CHART_UPDATES: 'chart-updates',
  LIQUIDITY_UPDATES: 'liquidity-updates'
} as const;

export type KafkaTopics = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

export const KAFKA_CONSUMER_CONFIG = {
  BATCH_SIZE: parseInt(process.env.KAFKA_BATCH_SIZE || '100'),
  BATCH_TIMEOUT: parseInt(process.env.KAFKA_BATCH_TIMEOUT || '5000'),
  PARALLEL_PROCESSING: parseInt(process.env.KAFKA_PARALLEL_PROCESSING || '3'),
  MAX_RETRY_ATTEMPTS: parseInt(process.env.KAFKA_MAX_RETRY_ATTEMPTS || '3'),
  RETRY_DELAY: parseInt(process.env.KAFKA_RETRY_DELAY || '1000')
};

export default createKafkaConsumer; 