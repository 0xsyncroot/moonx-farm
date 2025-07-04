// Kafka Consumer Service for WebSocket Gateway
import { Consumer, Kafka, KafkaConfig } from 'kafkajs';
import { logger } from '@moonx-farm/common';
import { DEXEvent } from '../types';

interface KafkaConsumerConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  topics: string[];
  maxBytesPerPartition?: number;
  heartbeatInterval?: number;
  sessionTimeout?: number;
}

export class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConsumerConfig;
  private isConnected = false;
  private messageHandler?: (event: DEXEvent) => Promise<void>;

  constructor(config: KafkaConsumerConfig) {
    this.config = config;
    
    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      // Performance optimizations for DEX trading
      connectionTimeout: 1000,
      requestTimeout: 5000,
      enforceRequestTimeout: true,
      retry: {
        initialRetryTime: 100,
        retries: 3,
        maxRetryTime: 1000
      }
    };

    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer({ 
      groupId: config.groupId,
      // Performance settings for real-time trading
      sessionTimeout: config.sessionTimeout || 10000,
      heartbeatInterval: config.heartbeatInterval || 3000,
      maxBytesPerPartition: config.maxBytesPerPartition || 1024 * 1024, // 1MB
      allowAutoTopicCreation: false
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('🔗 Kafka consumer connected', { 
        clientId: this.config.clientId,
        groupId: this.config.groupId
      });
    } catch (error) {
      logger.error('❌ Failed to connect Kafka consumer', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async subscribe(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka consumer not connected');
    }

    try {
      await this.consumer.subscribe({
        topics: this.config.topics,
        fromBeginning: false // Only consume new messages for real-time
      });

      logger.info('📡 Subscribed to Kafka topics', { 
        topics: this.config.topics 
      });
    } catch (error) {
      logger.error('❌ Failed to subscribe to Kafka topics', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async startConsumer(messageHandler: (event: DEXEvent) => Promise<void>): Promise<void> {
    this.messageHandler = messageHandler;

    try {
      await this.consumer.run({
        // Performance: Process messages in parallel
        partitionsConsumedConcurrently: 10,
        eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
          try {
            if (!message.value) return;

            const event: DEXEvent = JSON.parse(message.value.toString());
            
            // Add processing metadata
            event.timestamp = event.timestamp || Date.now();
            
            // Log for debugging (remove in production)
            logger.debug('📨 Received Kafka message', {
              topic,
              partition,
              offset: message.offset,
              type: event.type,
              symbol: event.symbol,
              processingTime: Date.now() - event.timestamp
            });

            // Process the event
            if (this.messageHandler) {
              await this.messageHandler(event);
            }
            
          } catch (error) {
            logger.error('❌ Error processing Kafka message', {
              topic,
              partition,
              offset: message.offset,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      });
    } catch (error) {
      logger.error('❌ Kafka consumer error', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      logger.info('🔌 Kafka consumer disconnected');
    } catch (error) {
      logger.error('❌ Error disconnecting Kafka consumer', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected;
  }

  // Get consumer info
  getConsumerInfo() {
    return {
      clientId: this.config.clientId,
      groupId: this.config.groupId,
      topics: this.config.topics,
      isConnected: this.isConnected
    };
  }
} 